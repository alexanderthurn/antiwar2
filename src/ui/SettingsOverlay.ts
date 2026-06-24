import { BitmapText, Container, Graphics } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import {
  settingsStore,
  type GameSettings,
  type ParticleQuality,
} from '../core/SettingsStore';
import { createFocusableButton } from '../input/FocusableButton';
import type { MenuActionsHost } from '../input/MenuActionsHost';
import type { UiAction } from '../input/UiMenuController';
import { kewlBlockGap, kewlLineHeight, kewlString, kewlText } from './KewlFont';
import { createMenuBackground } from './MenuBackground';

const PARTICLE_LABELS: Record<ParticleQuality, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
};

const PANEL_W = 560;
const ROW_FONT = 22;
const ROW_H = kewlLineHeight(ROW_FONT) + kewlBlockGap(ROW_FONT);
const ROW_GAP = kewlBlockGap(18);
const BACK_FONT = 20;

export class SettingsOverlay extends Container implements MenuActionsHost {
  private menuActions: UiAction[] = [];
  private rowLabels = new Map<string, { prefix: string; text: BitmapText }>();
  private onBack: () => void;
  private unsub: (() => void) | null = null;

  constructor(onBack: () => void) {
    super();
    this.onBack = onBack;
    void this.build();
  }

  private async build(): Promise<void> {
    this.addChild(await createMenuBackground());

    const dim = new Graphics();
    dim.rect(0, 0, DESIGN.width, DESIGN.height).fill({ color: 0x000000, alpha: 0.45 });
    dim.eventMode = 'static';
    this.addChild(dim);

    const rows = [
      {
        id: 'settings-sound',
        label: 'Sound',
        onPress: () => {
          const s = settingsStore.get();
          settingsStore.set({ soundEnabled: !s.soundEnabled });
        },
      },
      {
        id: 'settings-music',
        label: 'Music',
        onPress: () => {
          const s = settingsStore.get();
          settingsStore.set({ musicEnabled: !s.musicEnabled });
        },
      },
      {
        id: 'settings-particles',
        label: 'Particles',
        onPress: () => settingsStore.cycleParticleQuality(),
      },
    ] as const;

    const padTop = 40;
    const padBottom = 36;
    const titleBlock = kewlLineHeight(36) + kewlBlockGap(36);
    const backBlock = kewlLineHeight(BACK_FONT) + kewlBlockGap(BACK_FONT);
    const rowsBlock = rows.length * ROW_H + (rows.length - 1) * ROW_GAP;
    const panelH = padTop + titleBlock + rowsBlock + backBlock + padBottom;
    const panelX = DESIGN.width / 2 - PANEL_W / 2;
    const panelY = DESIGN.height / 2 - panelH / 2;
    const centerX = DESIGN.width / 2;

    const panel = new Graphics();
    panel.roundRect(panelX, panelY, PANEL_W, panelH, 12).fill({
      color: 0x1a1a2e,
      alpha: 0.97,
    });
    this.addChild(panel);

    const title = kewlText({ text: 'Settings', size: 36, anchorX: 0.5 });
    title.position.set(centerX, panelY + padTop);
    this.addChild(title);

    let rowY = panelY + padTop + titleBlock;
    for (const row of rows) {
      this.addRow(row.id, row.label, centerX, rowY, row.onPress);
      rowY += ROW_H + ROW_GAP;
    }

    const backW = 200;
    const back = createFocusableButton({
      id: 'settings-back',
      label: '< Back',
      x: centerX - backW / 2,
      y: rowY + kewlBlockGap(ROW_FONT),
      center: true,
      w: backW,
      fontSize: BACK_FONT,
      onPress: () => this.onBack(),
    });
    this.addChild(back.view);
    this.menuActions.push(back.action);

    this.unsub = settingsStore.subscribe(() => this.refresh());
    this.refresh();
  }

  destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.unsub?.();
    this.unsub = null;
    super.destroy(options);
  }

  getMenuActions(): UiAction[] {
    return this.menuActions;
  }

  onMenuCancel(): void {
    this.onBack();
  }

  private addRow(
    id: string,
    label: string,
    centerX: number,
    y: number,
    onPress: () => void,
  ): void {
    const rowW = PANEL_W - 80;
    const { view, action } = createFocusableButton({
      id,
      label: `${label}: ...`,
      x: centerX - rowW / 2,
      y,
      w: rowW,
      center: true,
      fontSize: ROW_FONT,
      onPress,
    });
    this.addChild(view);

    const text = view.children[0] as BitmapText;
    this.rowLabels.set(id, { prefix: label, text });

    this.menuActions.push(action);
  }

  private refresh(): void {
    const s = settingsStore.get();
    this.setRow('settings-sound', s.soundEnabled ? 'ON' : 'OFF');
    this.setRow('settings-music', s.musicEnabled ? 'ON' : 'OFF');
    this.setRow('settings-particles', PARTICLE_LABELS[s.particleQuality]);
  }

  private setRow(id: string, value: string): void {
    const row = this.rowLabels.get(id);
    if (row) row.text.text = kewlString(`${row.prefix}: ${value}`);
  }
}

export function formatSettingsSummary(s: GameSettings): string {
  return `Sound ${s.soundEnabled ? 'on' : 'off'} / Music ${s.musicEnabled ? 'on' : 'off'} / ${PARTICLE_LABELS[s.particleQuality]} particles`;
}
