import { Rectangle, Texture } from 'pixi.js';

/** Slice a horizontal strip (e.g. fire.png — 5 frames in one row). */
export function sliceFireSheet(sheet: Texture, frameCount: number): Texture[] {
  const frameW = Math.floor(sheet.width / frameCount);
  const frameH = sheet.height;
  const frames: Texture[] = [];

  for (let i = 0; i < frameCount; i++) {
    const rect = new Rectangle(i * frameW, 0, frameW, frameH);
    frames.push(
      new Texture({
        source: sheet.source,
        frame: rect,
        orig: rect,
      }),
    );
  }
  return frames;
}
