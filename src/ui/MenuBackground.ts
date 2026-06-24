import { Sprite } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import { loadTexture } from '../data/AssetLoader';

export const MENU_BG_PATH = 'assets/gfx/menu.jpg';

/** Full-screen menu backdrop stretched to design resolution. */
export async function createMenuBackground(): Promise<Sprite> {
  const tex = await loadTexture(MENU_BG_PATH);
  const bg = new Sprite(tex);
  bg.width = DESIGN.width;
  bg.height = DESIGN.height;
  return bg;
}
