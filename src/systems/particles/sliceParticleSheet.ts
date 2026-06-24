import { Rectangle, Texture } from 'pixi.js';

/** Slice a uniform grid from a particle spritesheet (e.g. particle.png 4×4). */
export function sliceParticleSheet(
  sheet: Texture,
  cols: number,
  rows: number,
  frameStart = 0,
  frameCount?: number,
): Texture[] {
  const frameW = Math.floor(sheet.width / cols);
  const frameH = Math.floor(sheet.height / rows);
  const total = cols * rows;
  const end = frameCount != null ? Math.min(frameStart + frameCount, total) : total;
  const frames: Texture[] = [];

  for (let i = frameStart; i < end; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const rect = new Rectangle(col * frameW, row * frameH, frameW, frameH);
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
