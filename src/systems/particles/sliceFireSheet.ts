import { Rectangle, Texture } from 'pixi.js';

/** Slice a horizontal strip (e.g. fire.png — 5 frames in one row). */
export function sliceFireSheet(sheet: Texture, frameCount: number): Texture[] {
  const base = sheet.frame;
  const frameW = Math.floor(base.width / frameCount);
  const frameH = base.height;
  const frames: Texture[] = [];

  for (let i = 0; i < frameCount; i++) {
    const rect = new Rectangle(base.x + i * frameW, base.y, frameW, frameH);
    const orig = new Rectangle(0, 0, frameW, frameH);
    frames.push(
      new Texture({
        source: sheet.source,
        frame: rect,
        orig,
      }),
    );
  }
  return frames;
}
