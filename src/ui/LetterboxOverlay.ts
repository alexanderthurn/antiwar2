import { Container, Graphics } from 'pixi.js';
import type { ViewportLayout } from '../core/Viewport';

/** Opaque bars over letterbox margins — drawn above all game content. */
export class LetterboxOverlay extends Container {
  private bars = new Graphics();

  constructor() {
    super();
    this.eventMode = 'none';
    this.addChild(this.bars);
  }

  sync(canvasWidth: number, canvasHeight: number, layout: ViewportLayout): void {
    const { offsetX, offsetY, gameWidth, gameHeight } = layout;
    this.bars.clear();

    if (offsetY > 0.5) {
      this.bars.rect(0, 0, canvasWidth, offsetY).fill(0x000000);
      this.bars
        .rect(0, offsetY + gameHeight, canvasWidth, canvasHeight - offsetY - gameHeight)
        .fill(0x000000);
    }
    if (offsetX > 0.5) {
      this.bars.rect(0, offsetY, offsetX, gameHeight).fill(0x000000);
      this.bars
        .rect(offsetX + gameWidth, offsetY, canvasWidth - offsetX - gameWidth, gameHeight)
        .fill(0x000000);
    }
  }
}
