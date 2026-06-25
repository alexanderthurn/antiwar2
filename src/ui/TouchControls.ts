import { Container } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import { kewlText } from './KewlFont';

const PAUSE_BTN_X = DESIGN.width / 2;
const PAUSE_BTN_Y = DESIGN.groundY + DESIGN.groundHeight / 2;
const HIT_W = 180;
const HIT_H = 56;

export class TouchControls extends Container {
  constructor(onPause: () => void) {
    super();
    this.eventMode = 'passive';
    this.addChild(this.makeTextButton('Pause', onPause));
  }

  isOnButton(designX: number, designY: number): boolean {
    return (
      designX >= PAUSE_BTN_X - HIT_W / 2 &&
      designX <= PAUSE_BTN_X + HIT_W / 2 &&
      designY >= PAUSE_BTN_Y - HIT_H / 2 &&
      designY <= PAUSE_BTN_Y + HIT_H / 2
    );
  }

  private makeTextButton(label: string, onTap: () => void): Container {
    const btn = new Container();
    btn.position.set(PAUSE_BTN_X, PAUSE_BTN_Y);
    btn.eventMode = 'static';
    btn.hitArea = {
      contains: (x, y) =>
        x >= -HIT_W / 2 && x <= HIT_W / 2 && y >= -HIT_H / 2 && y <= HIT_H / 2,
    };

    const text = kewlText({ text: label, size: 22, anchorX: 0.5, anchorY: 0.5 });
    btn.addChild(text);

    btn.on('pointertap', (e) => {
      e.stopPropagation();
      onTap();
    });

    return btn;
  }
}
