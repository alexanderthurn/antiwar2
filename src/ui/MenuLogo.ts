import { Container, Rectangle, Sprite, type Texture } from 'pixi.js';
import { playMenuClick } from '../audio/UiSounds';
import { MENU_POINTER_CURSOR } from './MenuPointer';

const SHAKE_DECAY = 5;
const SHAKE_MAX = 18;
const SHAKE_PER_CLICK = 2;
const HOVER_SHAKE = 0.5;

/** Animated logo — gentle sine bob/sway; hover for a light shake, tap to ramp it up. */
export class MenuLogo extends Container {
  private readonly sprite: Sprite;
  private time = 0;
  private shakeLevel = 0;
  private hovered = false;
  private readonly baseX: number;
  private readonly baseY: number;

  constructor(tex: Texture, centerX: number, topY: number, targetHeight: number) {
    super();
    this.sprite = new Sprite(tex);
    this.sprite.anchor.set(0.5);
    const aspect = tex.width / tex.height;
    const width = targetHeight * aspect;
    this.sprite.height = targetHeight;
    this.sprite.width = width;
    this.baseX = centerX;
    this.baseY = topY + targetHeight / 2;
    this.sprite.position.set(this.baseX, this.baseY);

    const pad = 12;
    this.eventMode = 'static';
    this.cursor = MENU_POINTER_CURSOR;
    this.hitArea = new Rectangle(
      this.baseX - width / 2 - pad,
      this.baseY - targetHeight / 2 - pad,
      width + pad * 2,
      targetHeight + pad * 2,
    );
    this.on('pointerover', () => {
      this.hovered = true;
    });
    this.on('pointerout', () => {
      this.hovered = false;
    });
    this.on('pointertap', () => {
      playMenuClick();
      this.shakeLevel = Math.min(this.shakeLevel + SHAKE_PER_CLICK, SHAKE_MAX);
    });

    this.addChild(this.sprite);
  }

  update(dt: number): void {
    this.time += dt;
    this.shakeLevel = Math.max(0, this.shakeLevel - SHAKE_DECAY * dt);

    const bobY = Math.sin(this.time * 1.8) * 6;
    const swayX = Math.sin(this.time * 1.2) * 4;
    const rot = Math.sin(this.time * 0.9) * 0.02;

    const s = this.hovered ? Math.max(this.shakeLevel, HOVER_SHAKE) : this.shakeLevel;
    const freq = 28 + s * 10;
    const shakeX =
      Math.sin(this.time * freq) * s * 2.8 +
      Math.sin(this.time * freq * 2.3) * s * 1.4;
    const shakeY =
      Math.cos(this.time * freq * 1.4) * s * 2.2 +
      Math.sin(this.time * freq * 1.9) * s * 1.2;
    const shakeRot = Math.sin(this.time * freq * 0.8) * s * 0.012;

    this.sprite.position.set(this.baseX + swayX + shakeX, this.baseY + bobY + shakeY);
    this.sprite.rotation = rot + shakeRot;
  }
}
