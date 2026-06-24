import { Container, Graphics } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import { kewlText } from './KewlFont';

export type TouchTowerSide = 'left' | 'right';

const BTN_W = 140;
const BTN_H = 72;
const BTN_Y = DESIGN.groundY - 88;
const LEFT_BTN_X = 48;
const RIGHT_BTN_X = DESIGN.width - 188;
const SETTINGS_BTN_X = (DESIGN.width - BTN_W) / 2;

export class TouchControls extends Container {
  private leftEnabled = true;
  private rightEnabled = true;
  private leftBg!: Graphics;
  private rightBg!: Graphics;

  constructor(onToggle: (side: TouchTowerSide) => void, onSettings: () => void) {
    super();
    this.eventMode = 'passive';

    this.addChild(this.makeTowerButton('LEFT', LEFT_BTN_X, BTN_Y, () => onToggle('left')));
    this.addChild(this.makeActionButton('SETTINGS', SETTINGS_BTN_X, BTN_Y, onSettings));
    this.addChild(this.makeTowerButton('RIGHT', RIGHT_BTN_X, BTN_Y, () => onToggle('right')));
    this.refreshVisuals();
  }

  setTowerEnabled(left: boolean, right: boolean): void {
    this.leftEnabled = left;
    this.rightEnabled = right;
    this.refreshVisuals();
  }

  isOnButton(designX: number, designY: number): boolean {
    return (
      this.hitButton(designX, designY, LEFT_BTN_X, BTN_Y) ||
      this.hitButton(designX, designY, SETTINGS_BTN_X, BTN_Y) ||
      this.hitButton(designX, designY, RIGHT_BTN_X, BTN_Y)
    );
  }

  private hitButton(x: number, y: number, bx: number, by: number): boolean {
    return x >= bx && x <= bx + BTN_W && y >= by && y <= by + BTN_H;
  }

  private refreshVisuals(): void {
    this.paintButton(this.leftBg, this.leftEnabled);
    this.paintButton(this.rightBg, this.rightEnabled);
  }

  private paintButton(bg: Graphics, enabled: boolean): void {
    bg.clear();
    if (enabled) {
      bg.roundRect(0, 0, BTN_W, BTN_H, 10).fill({ color: 0x223344, alpha: 0.82 });
      bg.stroke({ color: 0x88aacc, width: 2, alpha: 0.9 });
    } else {
      bg.roundRect(0, 0, BTN_W, BTN_H, 10).fill({ color: 0x111822, alpha: 0.55 });
      bg.stroke({ color: 0x445566, width: 2, alpha: 0.5 });
    }
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

  private makeTowerButton(
    label: string,
    x: number,
    y: number,
    onTap: () => void,
  ): Container {
    const btn = new Container();
    btn.position.set(x, y);
    btn.eventMode = 'static';

    const bg = new Graphics();
    btn.addChild(bg);
    if (label === 'LEFT') this.leftBg = bg;
    else this.rightBg = bg;

    const text = kewlText({ text: label, size: 22, anchorX: 0.5, anchorY: 0.5 });
    text.position.set(BTN_W / 2, BTN_H / 2);
    btn.addChild(text);

    btn.on('pointertap', (e) => {
      e.stopPropagation();
      onTap();
    });

    return btn;
  }
}
