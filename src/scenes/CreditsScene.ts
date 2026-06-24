import { Container } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import { createFocusableButton } from '../input/FocusableButton';
import type { MenuActionsHost } from '../input/MenuActionsHost';
import type { UiAction } from '../input/UiMenuController';
import { createMenuBackground } from '../ui/MenuBackground';
import { kewlBlockGap, kewlLineHeight, kewlText } from '../ui/KewlFont';

export class CreditsScene extends Container implements MenuActionsHost {
  private menuActions: UiAction[] = [];
  private onBack: () => void;

  constructor(onBack: () => void) {
    super();
    this.onBack = onBack;
    void this.build();
  }

  getMenuActions(): UiAction[] {
    return this.menuActions;
  }

  onMenuCancel(): void {
    this.onBack();
  }

  private async build(): Promise<void> {
    this.addChild(await createMenuBackground());

    const centerX = DESIGN.width / 2;
    const title = kewlText({ text: 'Credits', size: 48, anchorX: 0.5 });
    title.position.set(centerX, 100);
    this.addChild(title);

    const body = kewlText({
      text:
        'Antiwar 2\n\n' +
        'Game design & development\nFeuerware\n\n' +
        'Built with Pixi.js',
      size: 24,
      align: 'center',
      anchorX: 0.5,
    });
    body.position.set(centerX, 100 + kewlLineHeight(48) + kewlBlockGap(48));
    this.addChild(body);

    this.addChild(
      this.makeButton('credits-back', '< Back', centerX - 100, DESIGN.height - 100, 200, this.onBack),
    );
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
      fontSize: 20,
      onPress: onClick,
    });
    this.menuActions.push(action);
    return view;
  }
}
