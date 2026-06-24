import { Container, Graphics } from 'pixi.js';

/** On-screen pointer for menu navigation when the OS cursor is hidden. */
export class MenuCursor extends Container {
  private dot = new Graphics();
  private ring = new Graphics();

  constructor() {
    super();
    this.eventMode = 'none';
    this.addChild(this.ring, this.dot);
    this.visible = false;
  }

  sync(x: number, y: number, visible: boolean): void {
    this.visible = visible;
    if (!visible) return;
    this.position.set(x, y);
    this.ring.clear();
    this.ring.circle(0, 0, 14).stroke({ color: 0xffffff, width: 2, alpha: 0.85 });
    this.dot.clear();
    this.dot.circle(0, 0, 4).fill({ color: 0xffcc44, alpha: 0.95 });
  }
}
