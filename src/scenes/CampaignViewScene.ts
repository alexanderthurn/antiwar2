import { Container, Graphics, Sprite } from 'pixi.js';
import type { CampaignProgress } from '../core/CampaignProgress';
import { DESIGN } from '../core/DesignSpace';
import { createFocusableButton } from '../input/FocusableButton';
import type { MenuActionsHost } from '../input/MenuActionsHost';
import type { UiAction } from '../input/UiMenuController';
import { loadTexture } from '../data/AssetLoader';
import { loadCampaignIndex, type CampaignIndex } from '../data/types';
import { MENU_POINTER_CURSOR } from '../ui/MenuPointer';
import { createMenuBackground } from '../ui/MenuBackground';
import { kewlTextAtCenter } from '../ui/KewlFont';

const MAP_BUTTON_BY_PATH: Record<number, string> = {
  0: 'assets/gfx/buttons_map/button_training.png',
  1: 'assets/gfx/buttons_map/button_desert.png',
  2: 'assets/gfx/buttons_map/button_bonus.png',
  3: 'assets/gfx/buttons_map/button_white.png',
};

const MAP_ICON_SCALE = 1.5;
const FOCUS_SCALE = 1.06;

export class CampaignViewScene extends Container implements MenuActionsHost {
  private menuActions: UiAction[] = [];
  private onBack: () => void;

  constructor(
    progress: CampaignProgress,
    onBack: () => void,
    onStartLevel: (file: string, levelIndex: number) => void,
  ) {
    super();
    this.onBack = onBack;
    void this.build(progress, onStartLevel);
  }

  getMenuActions(): UiAction[] {
    return this.menuActions;
  }

  onMenuCancel(): void {
    this.onBack();
  }

  private async build(
    progress: CampaignProgress,
    onStartLevel: (file: string, levelIndex: number) => void,
  ): Promise<void> {
    const index = await loadCampaignIndex();
    this.addChild(await createMenuBackground());
    const mapTex = await loadTexture(index.mapImage);
    const map = new Sprite(mapTex);
    map.width = DESIGN.width;
    map.height = DESIGN.height;
    this.addChild(map);

    const dim = new Graphics();
    dim.rect(0, 0, DESIGN.width, 72).fill({ color: 0x000000, alpha: 0.55 });
    this.addChild(dim);

    const back = createFocusableButton({
      id: 'campaign-back',
      label: 'Menu',
      x: 16,
      y: 16,
      w: 140,
      fontSize: 18,
      onPress: () => this.onBack(),
    });
    this.addChild(back.view);
    this.menuActions.push(back.action);

    const buttonTex = new Map<number, Awaited<ReturnType<typeof loadTexture>>>();
    for (const pathType of [0, 1, 2, 3]) {
      buttonTex.set(pathType, await loadTexture(MAP_BUTTON_BY_PATH[pathType]!));
    }

    for (let i = 0; i < index.levels.length; i++) {
      this.addChild(this.makeNode(index, i, progress, onStartLevel, buttonTex));
    }
  }

  private makeNode(
    index: CampaignIndex,
    levelIndex: number,
    progress: CampaignProgress,
    onStartLevel: (file: string, levelIndex: number) => void,
    buttonTex: Map<number, Awaited<ReturnType<typeof loadTexture>>>,
  ): Container {
    const entry = index.levels[levelIndex]!;
    const unlocked = progress.isUnlocked(levelIndex);
    const completed = progress.isCompleted(levelIndex);

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
    node.addChild(levelNum);

    if (unlocked) {
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
        },
      });
    }

    return node;
  }
}
