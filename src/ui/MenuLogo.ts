import { Container, Sprite, type Texture } from 'pixi.js';

/** Animated logo — gentle sine bob/sway like the original menu. */
export class MenuLogo extends Container {
  private readonly sprite: Sprite;
  private time = 0;
  private readonly baseX: number;
  private readonly baseY: number;

  constructor(tex: Texture, centerX: number, topY: number, targetHeight: number) {
    super();
    this.sprite = new Sprite(tex);
    this.sprite.anchor.set(0.5);
    const aspect = tex.width / tex.height;
    this.sprite.height = targetHeight;
    this.sprite.width = targetHeight * aspect;
    this.baseX = centerX;
    this.baseY = topY + targetHeight / 2;
    this.sprite.position.set(this.baseX, this.baseY);
    this.addChild(this.sprite);
  }

  update(dt: number): void {
    this.time += dt;
    const bobY = Math.sin(this.time * 1.8) * 6;
    const swayX = Math.sin(this.time * 1.2) * 4;
    const rot = Math.sin(this.time * 0.9) * 0.02;
    this.sprite.position.set(this.baseX + swayX, this.baseY + bobY);
    this.sprite.rotation = rot;
  }
}
