import { BitmapText, Container } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import {
  settingsStore,
  type GameSettings,
} from '../core/SettingsStore';
import { GRAPHICS_LABELS } from '../core/GraphicsQuality';
import { createFocusableButton } from '../input/FocusableButton';
import type { MenuActionsHost } from '../input/MenuActionsHost';
import type { UiAction } from '../input/UiMenuController';
import { playMenuClick } from '../audio/UiSounds';
import { kewlBlockGap, kewlLineHeight, kewlString, kewlText, UI_TITLE_Y } from './KewlFont';

const ROW_FONT = 22;
const BACK_FONT = 20;
const BTN_W = 420;

export class SettingsOverlay extends Container implements MenuActionsHost {
  private menuActions: UiAction[] = [];
  private rowLabels = new Map<string, { prefix: string; text: BitmapText }>();
  private onBack: () => void;
  private unsub: (() => void) | null = null;

  constructor(onBack: () => void) {
    super();
    this.onBack = onBack;
    this.build();
  }

  private build(): void {
    const centerX = DESIGN.width / 2;
    const title = kewlText({ text: 'Options', size: 36, anchorX: 0.5 });
    title.position.set(centerX, UI_TITLE_Y);
    this.addChild(title);

    const rows = [
      {
        id: 'settings-sound',
        label: 'Sound',
        onPress: () => {
          const s = settingsStore.get();
          settingsStore.set({ soundEnabled: !s.soundEnabled });
          playMenuClick();
        },
      },
      {
        id: 'settings-music',
        label: 'Music',
        onPress: () => {
          const s = settingsStore.get();
          settingsStore.set({ musicEnabled: !s.musicEnabled });
          playMenuClick();
        },
      },
      {
        id: 'settings-graphics',
        label: 'Graphics',
        onPress: () => {
          settingsStore.cycleGraphicsQuality();
          playMenuClick();
        },
      },
    ] as const;

    const btnX = centerX - BTN_W / 2;
    const rowStep = kewlLineHeight(ROW_FONT) + kewlBlockGap(ROW_FONT);
    const backStep = kewlLineHeight(BACK_FONT) + kewlBlockGap(BACK_FONT);
    const blockH = rows.length * rowStep + backStep;
    let rowY = (DESIGN.height - blockH) / 2;

    for (const row of rows) {
      this.addRow(row.id, row.label, btnX, rowY, row.onPress);
      rowY += rowStep;
    }

    const backW = 200;
    const back = createFocusableButton({
      id: 'settings-back',
      label: 'Back',
      x: centerX - backW / 2,
      y: rowY,
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
    x: number,
    y: number,
    onPress: () => void,
  ): void {
    const { view, action } = createFocusableButton({
      id,
      label: `${label}: ...`,
      x,
      y,
      w: BTN_W,
      center: true,
      fontSize: ROW_FONT,
      playClick: false,
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
    this.setRow('settings-graphics', GRAPHICS_LABELS[s.graphicsQuality]);
  }

  private setRow(id: string, value: string): void {
    const row = this.rowLabels.get(id);
    if (row) row.text.text = kewlString(`${row.prefix}: ${value}`);
  }
}

export function formatSettingsSummary(s: GameSettings): string {
  return `Sound ${s.soundEnabled ? 'on' : 'off'} / Music ${s.musicEnabled ? 'on' : 'off'} / ${GRAPHICS_LABELS[s.graphicsQuality]} graphics`;
}
