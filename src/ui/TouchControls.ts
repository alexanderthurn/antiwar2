import { Container, Graphics } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import { kewlText } from './KewlFont';

const BTN_W = 140;
const BTN_H = 72;
const BTN_Y = DESIGN.groundY - 88;
const PAUSE_BTN_X = (DESIGN.width - BTN_W) / 2;

export class TouchControls extends Container {
  constructor(onPause: () => void) {
    super();
    this.eventMode = 'passive';
    this.addChild(this.makeActionButton('Pause', PAUSE_BTN_X, BTN_Y, onPause));
  }

  isOnButton(designX: number, designY: number): boolean {
    return this.hitButton(designX, designY, PAUSE_BTN_X, BTN_Y);
  }

  private hitButton(x: number, y: number, bx: number, by: number): boolean {
    return x >= bx && x <= bx + BTN_W && y >= by && y <= by + BTN_H;
  }

  private paintActionButton(bg: Graphics): void {
    bg.clear();
    bg.roundRect(0, 0, BTN_W, BTN_H, 10).fill({ color: 0x223344, alpha: 0.82 });
    bg.stroke({ color: 0x88aacc, width: 2, alpha: 0.9 });
  }

  private makeActionButton(
    label: string,
    x: number,
    y: number,
    onTap: () => void,
  ): Container {
    const btn = new Container();
    btn.position.set(x, y);
    btn.eventMode = 'static';

    const bg = new Graphics();
    this.paintActionButton(bg);
    btn.addChild(bg);

    const text = kewlText({ text: label, size: 18, anchorX: 0.5, anchorY: 0.5 });
    text.position.set(BTN_W / 2, BTN_H / 2);
    btn.addChild(text);

    btn.on('pointertap', (e) => {
      e.stopPropagation();
      onTap();
    });

    return btn;
  }
}
