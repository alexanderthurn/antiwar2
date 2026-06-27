import { Container, Graphics } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import { createFocusableButton } from '../input/FocusableButton';
import type { UiAction } from '../input/UiMenuController';
import { kewlText, MENU_BTN_START_Y, MENU_BTN_WIDTH, MENU_ITEM_FONT_SIZE, MENU_TITLE_FONT_SIZE, menuRowStep, UI_TITLE_Y } from '../ui/KewlFont';

const PAUSE_DIM_ALPHA = 0.8;

export class PauseOverlay extends Container {
  readonly menuActions: UiAction[] = [];

  constructor(
    onResume: () => void,
    onSettings: () => void,
    onRestart: () => void,
    onExit: () => void,
  ) {
    super();
    this.eventMode = 'static';

    const dim = new Graphics();
    dim.rect(0, 0, DESIGN.width, DESIGN.height).fill({ color: 0x000000, alpha: PAUSE_DIM_ALPHA });
    dim.eventMode = 'static';
    this.addChild(dim);

    const centerX = DESIGN.width / 2;
    const title = kewlText({ text: 'Paused', size: MENU_TITLE_FONT_SIZE, anchorX: 0.5 });
    title.position.set(centerX, UI_TITLE_Y);
    this.addChild(title);

    const btnW = MENU_BTN_WIDTH;
    const btnX = centerX - btnW / 2;
    const btnStep = menuRowStep(MENU_ITEM_FONT_SIZE);
    const labels = [
      { id: 'pause-resume', label: 'Resume', onPress: onResume },
      { id: 'pause-restart', label: 'Restart', onPress: onRestart },
      { id: 'pause-settings', label: 'Options', onPress: onSettings },
      { id: 'pause-quit', label: 'Quit', onPress: onExit },
    ];
    let btnY = MENU_BTN_START_Y;

    for (const entry of labels) {
      this.addChild(this.makeButton(entry.id, entry.label, btnX, btnY, btnW, entry.onPress));
      btnY += btnStep;
    }
  }

  private makeButton(
    id: string,
    label: string,
    x: number,
    y: number,
    w: number,
    onClick: () => void,
  ): Container {
    const { view, action } = createFocusableButton({
      id,
      label,
      x,
      y,
      w,
      center: true,
      fontSize: MENU_ITEM_FONT_SIZE,
      onPress: onClick,
    });
    this.menuActions.push(action);
    return view;
  }
}
