import { Container, Graphics, Sprite } from 'pixi.js';
import {
  isHardcoreRun,
  type CampaignRunId,
  runProgressStore,
} from '../core/CampaignRun';
import { DESIGN } from '../core/DesignSpace';
import { createFocusableButton } from '../input/FocusableButton';
import type { MenuActionsHost } from '../input/MenuActionsHost';
import type { UiAction } from '../input/UiMenuController';
import { loadTexture } from '../data/AssetLoader';
import {
  loadCampaignIndex,
  loadLevelPack,
  type CampaignIndex,
  type LevelPack,
} from '../data/types';
import { MENU_POINTER_CURSOR } from '../ui/MenuPointer';
import { createMenuBackground } from '../ui/MenuBackground';
import { CampaignLevelPreview } from '../ui/CampaignLevelPreview';
import { kewlMeasuredSize, kewlText, kewlTextAtCenter } from '../ui/KewlFont';

const MAP_BUTTON_BY_PATH: Record<number, string> = {
  0: 'assets/gfx/buttons_map/button_training.png',
  1: 'assets/gfx/buttons_map/button_desert.png',
  2: 'assets/gfx/buttons_map/button_bonus.png',
  3: 'assets/gfx/buttons_map/button_white.png',
};

const MAP_ICON_SCALE = 1.5;
const FOCUS_SCALE = 1.06;
/** Kewl glyph box center ≠ visual center on map button art — nudge label up/left. */
const MAP_LEVEL_LABEL_OFFSET = { x: -8, y: -6 };

export class CampaignViewScene extends Container implements MenuActionsHost {
  private menuActions: UiAction[] = [];
  private onBack: () => void;
  private levelPacks: LevelPack[] = [];
  private preview: CampaignLevelPreview | null = null;

  constructor(
    private readonly campaignId: string,
    private readonly runId: CampaignRunId,
    private readonly hardcoreUnlocked: boolean,
    onBack: () => void,
    onToggleHardcore: () => void,
    onStartLevel: (file: string, levelIndex: number) => void,
  ) {
    super();
    this.onBack = onBack;
    void this.build(onToggleHardcore, onStartLevel);
  }

  getMenuActions(): UiAction[] {
    return this.menuActions;
  }

  onMenuCancel(): void {
    this.onBack();
  }

  private async build(
    onToggleHardcore: () => void,
    onStartLevel: (file: string, levelIndex: number) => void,
  ): Promise<void> {
    const index = await loadCampaignIndex(this.campaignId);
    this.levelPacks = await Promise.all(
      index.levels.map((entry) => loadLevelPack(this.campaignId, entry.file)),
    );

    this.addChild(await createMenuBackground());
    const mapTex = await loadTexture(index.mapImage);
    const map = new Sprite(mapTex);
    map.width = DESIGN.width;
    map.height = DESIGN.height;
    this.addChild(map);

    this.preview = new CampaignLevelPreview();
    await this.preview.preloadThumbnails(this.levelPacks);

    const dim = new Graphics();
    dim.rect(0, 0, DESIGN.width, 72).fill({ color: 0x000000, alpha: 0.55 });
    this.addChild(dim);

    const back = createFocusableButton({
      id: 'campaign-back',
      label: 'Back',
      x: 16,
      y: 16,
      w: 140,
      fontSize: 18,
      onPress: () => this.onBack(),
    });
    this.addChild(back.view);
    this.menuActions.push(back.action);

    const title = kewlText({
      text: index.campaignName,
      size: 28,
      anchorX: 0.5,
    });
    title.position.set(DESIGN.width / 2, 36);
    this.addChild(title);

    if (this.hardcoreUnlocked) {
      const modeLabel = isHardcoreRun(this.runId) ? 'Hardcore' : 'Normal';
      const modeFont = 18;
      const modePadX = 14;
      const modeTextW = kewlMeasuredSize(modeLabel, modeFont).width;
      const modeW = modeTextW + modePadX * 2;
      const mode = createFocusableButton({
        id: 'campaign-mode',
        label: modeLabel,
        x: DESIGN.width - 16 - modeW,
        y: 16,
        w: modeW,
        align: 'right',
        fontSize: modeFont,
        onPress: () => onToggleHardcore(),
      });
      this.addChild(mode.view);
      this.menuActions.push(mode.action);
    }

    const buttonTex = new Map<number, Awaited<ReturnType<typeof loadTexture>>>();
    for (const pathType of [0, 1, 2, 3]) {
      buttonTex.set(pathType, await loadTexture(MAP_BUTTON_BY_PATH[pathType]!));
    }

    for (let i = 0; i < index.levels.length; i++) {
      this.addChild(this.makeNode(index, i, onStartLevel, buttonTex));
    }

    this.addChild(this.preview);
  }

  private makeNode(
    index: CampaignIndex,
    levelIndex: number,
    onStartLevel: (file: string, levelIndex: number) => void,
    buttonTex: Map<number, Awaited<ReturnType<typeof loadTexture>>>,
  ): Container {
    const entry = index.levels[levelIndex]!;
    const unlocked = runProgressStore.isUnlocked(this.runId, levelIndex);
    const completed = runProgressStore.isCompleted(this.runId, levelIndex);

    const node = new Container();
    node.position.set(entry.mapX, entry.mapY);
    node.eventMode = unlocked ? 'static' : 'none';
    node.cursor = unlocked ? MENU_POINTER_CURSOR : 'default';

    const tex = buttonTex.get(entry.pathType) ?? buttonTex.get(1)!;
    const icon = new Sprite(tex);
    icon.anchor.set(0.5);
    icon.scale.set(MAP_ICON_SCALE);
    if (!unlocked) icon.alpha = 0.4;
    else if (completed) icon.alpha = 0.85;
    node.addChild(icon);

    const levelNum = kewlTextAtCenter({
      text: String(levelIndex + 1),
      size: 18,
    });
    levelNum.position.set(MAP_LEVEL_LABEL_OFFSET.x, MAP_LEVEL_LABEL_OFFSET.y);
    node.addChild(levelNum);

    if (unlocked) {
      const pack = this.levelPacks[levelIndex]!;
      const activate = () => onStartLevel(entry.file, levelIndex);
      node.on('pointertap', activate);

      const w = icon.width;
      const h = icon.height;
      this.menuActions.push({
        id: `level-${levelIndex}`,
        bounds: () =>
          node.destroyed ? null : { x: node.x - w / 2, y: node.y - h / 2, w, h },
        activate,
        setFocused: (focused) => {
          if (node.destroyed) return;
          node.scale.set(focused ? FOCUS_SCALE : 1);
          if (focused) {
            const record = runProgressStore.getLevelStats(this.runId, levelIndex);
            this.preview?.show(levelIndex, pack, { x: entry.mapX, y: entry.mapY }, record);
          } else this.preview?.hideIfLevel(levelIndex);
        },
      });
    }

    return node;
  }
}
