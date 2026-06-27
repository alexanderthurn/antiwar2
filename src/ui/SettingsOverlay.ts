import { BitmapText, Container } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import { clearAllGameData } from '../core/SavedData';
import {
  settingsStore,
  type GameSettings,
} from '../core/SettingsStore';
import { GRAPHICS_LABELS } from '../core/GraphicsQuality';
import { createFocusableButton } from '../input/FocusableButton';
import type { MenuActionsHost } from '../input/MenuActionsHost';
import type { UiAction } from '../input/UiMenuController';
import { playMenuClick } from '../audio/UiSounds';
import { createMenuBackground } from './MenuBackground';
import {
  kewlLineHeight,
  kewlMeasuredSize,
  kewlString,
  kewlText,
  kewlTextLeftInset,
  MENU_BTN_START_Y,
  MENU_BTN_WIDTH,
  MENU_FOOTER_FONT_SIZE,
  MENU_ITEM_FONT_SIZE,
  MENU_TITLE_FONT_SIZE,
  menuRowStep,
  UI_TITLE_Y,
} from './KewlFont';

const FOOTER_MARGIN = 21;

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

    const centerX = DESIGN.width / 2;
    const title = kewlText({ text: 'Options', size: MENU_TITLE_FONT_SIZE, anchorX: 0.5 });
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

    const btnX = centerX - MENU_BTN_WIDTH / 2;
    const rowStep = menuRowStep(MENU_ITEM_FONT_SIZE);
    let rowY = MENU_BTN_START_Y;

    for (const row of rows) {
      this.addRow(row.id, row.label, btnX, rowY, row.onPress);
      rowY += rowStep;
    }

    const back = createFocusableButton({
      id: 'settings-back',
      label: 'Back',
      x: btnX,
      y: rowY,
      center: true,
      w: MENU_BTN_WIDTH,
      fontSize: MENU_ITEM_FONT_SIZE,
      onPress: () => this.onBack(),
    });
    this.addChild(back.view);
    this.menuActions.push(back.action);

    this.addFooterActions();

    this.unsub = settingsStore.subscribe(() => this.refresh());
    this.refresh();
  }

  private addFooterActions(): void {
    const footerLineH = kewlLineHeight(MENU_FOOTER_FONT_SIZE);
    const footerY = DESIGN.height - FOOTER_MARGIN - footerLineH;

    const clearLabel = 'Clear all game data';
    this.addChild(
      this.makeFooterButton(
        'settings-clear-data',
        clearLabel,
        FOOTER_MARGIN - kewlTextLeftInset(MENU_FOOTER_FONT_SIZE),
        footerY,
        () => clearAllGameData(),
      ),
    );

    const resetLabel = 'Reset options';
    const resetW = kewlMeasuredSize(resetLabel, MENU_FOOTER_FONT_SIZE).width;
    this.addChild(
      this.makeFooterButton(
        'settings-reset-options',
        resetLabel,
        DESIGN.width - FOOTER_MARGIN - resetW - 20,
        footerY,
        () => settingsStore.resetToDefaults(),
        'right',
        resetW,
      ),
    );
  }

  private makeFooterButton(
    id: string,
    label: string,
    x: number,
    y: number,
    onPress: () => void,
    align: 'left' | 'right' = 'left',
    w?: number,
  ): Container {
    const { view, action } = createFocusableButton({
      id,
      label,
      x,
      y,
      w,
      align,
      fontSize: MENU_FOOTER_FONT_SIZE,
      playClick: false,
      onPress: () => {
        onPress();
        playMenuClick();
      },
    });
    this.menuActions.push(action);
    return view;
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
      w: MENU_BTN_WIDTH,
      center: true,
      fontSize: MENU_ITEM_FONT_SIZE,
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
