import {
  BlurFilter,
  Container,
  Matrix,
  RenderTexture,
  Sprite,
  type Container as PixiContainer,
  type Renderer,
} from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';

/** Render scale for the backdrop capture — half res keeps blur cheap. */
const CAPTURE_SCALE = 0.5;
const BLUR_STRENGTH = 50;

/**
 * Full-window backdrop: a blurred, cover-scaled snapshot of the design scene.
 * Fills letterbox/pillarbox margins without per-level art.
 */
export class BlurBackdrop extends Container {
  private readonly sprite = new Sprite();
  private readonly rt: RenderTexture;
  private readonly blur = new BlurFilter({ strength: BLUR_STRENGTH, quality: 2 });
  private readonly captureMatrix = new Matrix();
  private ready = false;
  private enabled = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.ready = false;
      this.visible = false;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  constructor() {
    super();
    this.eventMode = 'none';
    this.sprite.anchor.set(0.5);
    this.sprite.filters = [this.blur];
    this.addChild(this.sprite);

    const w = Math.max(1, Math.round(DESIGN.width * CAPTURE_SCALE));
    const h = Math.max(1, Math.round(DESIGN.height * CAPTURE_SCALE));
    this.rt = RenderTexture.create({ width: w, height: h });
    this.sprite.texture = this.rt;
  }

  sync(canvasWidth: number, canvasHeight: number): void {
    if (!this.enabled) {
      this.visible = false;
      return;
    }

    const coverScale = Math.max(canvasWidth / DESIGN.width, canvasHeight / DESIGN.height);
    const containScale = Math.min(canvasWidth / DESIGN.width, canvasHeight / DESIGN.height);
    const letterboxed = coverScale > containScale + 0.0001;

    this.visible = this.ready && letterboxed;
    if (!this.visible) return;

    const textureScale = DESIGN.width / this.rt.width;
    this.sprite.position.set(canvasWidth / 2, canvasHeight / 2);
    this.sprite.scale.set(textureScale * coverScale);
  }

  capture(
    renderer: Renderer,
    gameRoot: PixiContainer,
    menuCursor: PixiContainer,
    viewportMask: PixiContainer,
  ): void {
    if (!this.enabled) return;

    const prevMask = gameRoot.mask;
    const cursorVisible = menuCursor.visible;
    const maskVisible = viewportMask.visible;

    menuCursor.visible = false;
    viewportMask.visible = false;
    gameRoot.mask = null;

    this.captureMatrix.identity().scale(CAPTURE_SCALE, CAPTURE_SCALE);
    renderer.render({
      container: gameRoot,
      target: this.rt,
      transform: this.captureMatrix,
      clear: true,
    });
    renderer.resetState();

    gameRoot.mask = prevMask;
    menuCursor.visible = cursorVisible;
    viewportMask.visible = maskVisible;
    this.ready = true;
  }
}
