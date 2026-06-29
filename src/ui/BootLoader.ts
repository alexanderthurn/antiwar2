import { Application, Container, Graphics, Sprite } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import { preloadBootstrap, type BootstrapTextures } from '../data/AssetLoader';
import { kewlText, UI_TITLE_MAIN_MENU_Y } from './KewlFont';
import { MenuLogo } from './MenuLogo';

const LOGO_HEIGHT = 200;

const BAR_W = 520;
const BAR_H = 28;
const BAR_Y = Math.round(DESIGN.height * 0.62);
const STATUS_Y = BAR_Y - 48;

export function waitFrames(count = 2): Promise<void> {
  return new Promise((resolve) => {
    let left = count;
    const step = () => {
      if (--left <= 0) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/** Full-screen boot loader: text-only → branded → progress while assets preload. */
export class BootLoader extends Container {
  private readonly progressBar = new Graphics();
  private statusText = kewlText({ text: 'Loading…', size: 24, anchorX: 0.5, anchorY: 0.5 });
  private logo: MenuLogo | null = null;
  private progress = 0;
  private tickerUnsub: (() => void) | null = null;

  constructor(private readonly pixi: Application) {
    super();
    this.eventMode = 'none';
    const centerX = DESIGN.width / 2;
    this.statusText.position.set(centerX, STATUS_Y);
    this.addChild(this.progressBar);
    this.addChild(this.statusText);
  }

  showTextOnly(message = 'Loading…'): void {
    this.statusText.text = message;
    this.progressBar.clear();
  }

  async loadBootstrap(): Promise<BootstrapTextures> {
    return preloadBootstrap();
  }

  showBranded(textures: BootstrapTextures): void {
    this.removeChildren();

    const bg = new Sprite(textures.menu);
    bg.width = DESIGN.width;
    bg.height = DESIGN.height;
    this.addChild(bg);

    const centerX = DESIGN.width / 2;
    this.logo = new MenuLogo(textures.logo, centerX, UI_TITLE_MAIN_MENU_Y, LOGO_HEIGHT);
    this.logo.eventMode = 'none';
    this.addChild(this.logo);

    this.statusText = kewlText({ text: 'Loading…', size: 24, anchorX: 0.5, anchorY: 0.5 });
    this.statusText.position.set(centerX, STATUS_Y);
    this.addChild(this.statusText);

    this.progressBar.clear();
    this.addChild(this.progressBar);

    this.tickerUnsub?.();
    const tick = (): void => {
      this.logo?.update(this.pixi.ticker.deltaTime / 60);
    };
    this.pixi.ticker.add(tick);
    this.tickerUnsub = () => this.pixi.ticker.remove(tick);
  }

  setProgress(done: number, total: number, label: string): void {
    this.progress = total > 0 ? Math.min(1, done / total) : 0;
    this.statusText.text = label;
    this.drawProgressBar();
  }

  private drawProgressBar(): void {
    const barX = DESIGN.width / 2 - BAR_W / 2;
    this.progressBar.clear();
    this.progressBar.roundRect(barX, BAR_Y, BAR_W, BAR_H, 4).fill({ color: 0x222222, alpha: 0.85 });
    if (this.progress > 0) {
      this.progressBar
        .roundRect(barX, BAR_Y, BAR_W * this.progress, BAR_H, 4)
        .fill({ color: 0x44aaff, alpha: 0.9 });
    }
    const knobX = barX + BAR_W * this.progress;
    this.progressBar.circle(knobX, BAR_Y + BAR_H / 2, 8).fill(0xffffff);
  }

  destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.tickerUnsub?.();
    this.tickerUnsub = null;
    super.destroy(options);
  }
}
