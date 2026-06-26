import { Container, Graphics, Sprite } from 'pixi.js';
import { loadTexture } from '../data/AssetLoader';

export type MenuCursorStyle = 'gamepad' | 'pointer';

/** On-screen pointer for menu navigation — lives on the stage in screen pixels. */
export class MenuCursor extends Container {
  private dot = new Graphics();
  private ring = new Graphics();
  private hand = new Sprite();
  private handReady = false;

  constructor() {
    super();
    this.eventMode = 'none';
    this.hand.visible = false;
    this.addChild(this.ring, this.dot, this.hand);
    this.visible = false;
    void this.loadHand();
  }

  private async loadHand(): Promise<void> {
    const tex = await loadTexture('assets/gfx/hand-cursor.png');
    this.hand.texture = tex;
    this.hand.anchor.set(9 / tex.width, 7 / tex.height);
    this.handReady = true;
  }

  sync(x: number, y: number, visible: boolean, style: MenuCursorStyle = 'gamepad'): void {
    this.visible = visible;
    if (!visible) return;
    this.position.set(x, y);

    const useHand = style === 'pointer' && this.handReady;
    this.hand.visible = useHand;
    this.ring.visible = !useHand;
    this.dot.visible = !useHand;
    if (useHand) return;

    this.ring.clear();
    this.ring.circle(0, 0, 14).stroke({ color: 0xffffff, width: 2, alpha: 0.85 });
    this.dot.clear();
    this.dot.circle(0, 0, 4).fill({ color: 0xffcc44, alpha: 0.95 });
  }
}
