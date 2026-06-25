import { Container, Graphics } from 'pixi.js';
import type { ViewportLayout } from '../core/Viewport';

/** Soft edge darkening over letterbox margins — sits above the sharp playfield. */
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

    const hasMargins = offsetX > 0.5 || offsetY > 0.5;
    this.visible = hasMargins;
    if (!hasMargins) return;

    const alpha = 0.4;
    const fill = { color: 0x000000, alpha };

    if (offsetY > 0.5) {
      this.bars.rect(0, 0, canvasWidth, offsetY).fill(fill);
      this.bars
        .rect(0, offsetY + gameHeight, canvasWidth, canvasHeight - offsetY - gameHeight)
        .fill(fill);
    }
    if (offsetX > 0.5) {
      this.bars.rect(0, offsetY, offsetX, gameHeight).fill(fill);
      this.bars
        .rect(offsetX + gameWidth, offsetY, canvasWidth - offsetX - gameWidth, gameHeight)
        .fill(fill);
    }
  }
}
