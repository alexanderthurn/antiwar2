import { Container, Sprite, type Texture } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import { loadTexture } from '../data/AssetLoader';

const NIGHTSHOT_PATH = 'assets/gfx/nightshot.png';
/** 2× viewport — cursor in a corner must still reach the opposite corner. */
const NIGHTSHOT_SIZE_SCALE = 2;

/** v1 night vision — one full-viewport nightshot per crosshair; texture alpha clears the center. */
export class NightVisionLayer extends Container {
  private shots = new Container();
  private sprites: Sprite[] = [];
  private texture: Texture | null = null;
  private ready = false;

  constructor() {
    super();
    this.eventMode = 'none';
    this.addChild(this.shots);
    this.visible = false;
    void this.loadNightshot();
  }

  private async loadNightshot(): Promise<void> {
    this.texture = await loadTexture(NIGHTSHOT_PATH);
    if (this.destroyed) return;
    this.ready = true;
  }

  private ensureSprite(index: number): Sprite {
    let sprite = this.sprites[index];
    if (sprite) return sprite;

    sprite = new Sprite(this.texture!);
    sprite.anchor.set(0.5);
    sprite.width = DESIGN.width * NIGHTSHOT_SIZE_SCALE;
    sprite.height = DESIGN.height * NIGHTSHOT_SIZE_SCALE;
    this.sprites.push(sprite);
    this.shots.addChild(sprite);
    return sprite;
  }

  update(darkness: number, aimPoints: { x: number; y: number }[]): void {
    if (!this.ready || darkness <= 0 || aimPoints.length === 0) {
      this.visible = false;
      for (const sprite of this.sprites) sprite.visible = false;
      return;
    }

    this.visible = true;
    const alpha = Math.min(1, darkness);

    for (let i = 0; i < aimPoints.length; i++) {
      const { x, y } = aimPoints[i]!;
      const sprite = this.ensureSprite(i);
      sprite.position.set(x, y);
      sprite.alpha = alpha;
      sprite.visible = true;
    }
    for (let i = aimPoints.length; i < this.sprites.length; i++) {
      this.sprites[i]!.visible = false;
    }
  }
}
