import { Container, Graphics, Sprite } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import { loadTexture } from '../data/AssetLoader';
import type { MenuActionsHost } from '../input/MenuActionsHost';
import type { UiAction } from '../input/UiMenuController';
import { playMenuClick } from '../audio/UiSounds';
import { MENU_POINTER_CURSOR } from './MenuPointer';
import { createMenuBackground } from './MenuBackground';

/** Tutorial slides — append paths here when adding more images. */
export const TUTORIAL_IMAGE_PATHS = [
  'assets/gfx/tutorial/first.jpg',
  'assets/gfx/tutorial/second.jpg',
] as const;

const IMAGE_MARGIN = 48;

export class HowToPlayOverlay extends Container implements MenuActionsHost {
  private menuActions: UiAction[] = [];
  private slideIndex = 0;
  private imageSprite: Sprite | null = null;
  private textures: Awaited<ReturnType<typeof loadTexture>>[] = [];
  private onClose: () => void;

  constructor(onClose: () => void) {
    super();
    this.onClose = onClose;
    void this.build();
  }

  getMenuActions(): UiAction[] {
    return this.menuActions;
  }

  onMenuCancel(): void {
    this.onClose();
  }

  private async build(): Promise<void> {
    this.addChild(await createMenuBackground());

    const dim = new Graphics();
    dim.rect(0, 0, DESIGN.width, DESIGN.height).fill({ color: 0x000000, alpha: 0.55 });
    dim.eventMode = 'none';
    this.addChild(dim);

    this.textures = await Promise.all(TUTORIAL_IMAGE_PATHS.map(loadTexture));

    const image = new Sprite(this.textures[0]!);
    image.anchor.set(0.5);
    image.position.set(DESIGN.width / 2, DESIGN.height / 2);
    image.eventMode = 'none';
    this.fitImage(image);
    this.imageSprite = image;
    this.addChild(image);

    const activate = () => {
      playMenuClick();
      this.advance();
    };

    const hit = new Graphics();
    hit.rect(0, 0, DESIGN.width, DESIGN.height).fill({ color: 0xffffff, alpha: 0.001 });
    hit.eventMode = 'static';
    hit.cursor = MENU_POINTER_CURSOR;
    hit.on('pointertap', activate);
    this.addChild(hit);

    this.menuActions.push({
      id: 'how-to-play-advance',
      bounds: () => ({ x: 0, y: 0, w: DESIGN.width, h: DESIGN.height }),
      activate,
    });
  }

  private fitImage(sprite: Sprite): void {
    const maxW = DESIGN.width - IMAGE_MARGIN * 2;
    const maxH = DESIGN.height - IMAGE_MARGIN * 2;
    const scale = Math.min(maxW / sprite.texture.width, maxH / sprite.texture.height);
    sprite.scale.set(scale);
  }

  private advance(): void {
    const next = this.slideIndex + 1;
    if (next >= this.textures.length) {
      this.onClose();
      return;
    }
    this.slideIndex = next;
    const sprite = this.imageSprite;
    if (!sprite) return;
    sprite.texture = this.textures[next]!;
    this.fitImage(sprite);
  }
}
