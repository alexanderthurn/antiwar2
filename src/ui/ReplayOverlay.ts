import { BitmapText, Container, Graphics } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import { formatLevelTimeHms } from '../core/CampaignRun';
import type { ReplayDriver } from '../replay/ReplayDriver';
import { kewlText } from './KewlFont';

const BAR_H = 28;
const BAR_Y = DESIGN.height - BAR_H - 12;
const BAR_X = 80;
const BAR_W = DESIGN.width - 160;

export class ReplayOverlay extends Container {
  private bar = new Graphics();
  private scrubHit = new Graphics();
  private labelText: BitmapText;
  private driver: ReplayDriver;
  private onExit: () => void;
  private dragging = false;

  constructor(driver: ReplayDriver, nick: string, onExit: () => void) {
    super();
    this.driver = driver;
    this.onExit = onExit;

    this.labelText = kewlText({
      text: `REPLAY — ${nick}`,
      size: 16,
    });
    this.labelText.position.set(BAR_X, BAR_Y - 22);
    this.addChild(this.labelText);

    this.scrubHit.rect(BAR_X, BAR_Y, BAR_W, BAR_H).fill({ color: 0xffffff, alpha: 0.001 });
    this.scrubHit.eventMode = 'static';
    this.scrubHit.cursor = 'pointer';
    this.scrubHit.on('pointerdown', (e) => {
      this.dragging = true;
      this.scrubToPointer(e.globalX);
    });
    this.scrubHit.on('globalpointermove', (e) => {
      if (!this.dragging) return;
      this.scrubToPointer(e.globalX);
    });
    this.scrubHit.on('pointerup', () => {
      this.dragging = false;
    });
    this.scrubHit.on('pointerupoutside', () => {
      this.dragging = false;
    });
    this.addChild(this.scrubHit);
    this.addChild(this.bar);

    this.eventMode = 'none';
    this.refresh();
  }

  private scrubToPointer(globalX: number): void {
    const local = (globalX - BAR_X) / BAR_W;
    const tick = Math.floor(local * this.driver.getTotalTicks());
    this.driver.requestSeek(tick);
    this.refresh();
  }

  refresh(): void {
    const total = this.driver.getTotalTicks();
    const tick = this.driver.getGlobalTick();
    const progress = total > 0 ? tick / total : 0;
    const cur = formatLevelTimeHms(this.driver.getTimeMs());
    const end = formatLevelTimeHms(this.driver.getFooterTimeMs());
    const state = this.driver.isPlaying() ? '>' : '||';
    const speed = this.driver.getSpeed();
    this.labelText.text = `REPLAY ${state} ${speed}x  ${cur} / ${end}`;

    this.bar.clear();
    this.bar.roundRect(BAR_X, BAR_Y, BAR_W, BAR_H, 4).fill({ color: 0x222222, alpha: 0.85 });
    if (progress > 0) {
      this.bar.roundRect(BAR_X, BAR_Y, BAR_W * progress, BAR_H, 4).fill({ color: 0x44aaff, alpha: 0.9 });
    }
    const knobX = BAR_X + BAR_W * progress;
    this.bar.circle(knobX, BAR_Y + BAR_H / 2, 10).fill(0xffffff);
  }

  handleKey(key: string, code: string): boolean {
    if (key === 'Escape' || key === 'q' || key === 'Q') {
      this.onExit();
      return true;
    }
    if (key === ' ' || code === 'Space') {
      this.driver.togglePlaying();
      this.refresh();
      return true;
    }
    if (key === 'ArrowLeft') {
      this.driver.seekBySeconds(-5);
      this.refresh();
      return true;
    }
    if (key === 'ArrowRight') {
      this.driver.seekBySeconds(5);
      this.refresh();
      return true;
    }
    if (key === '[') {
      const steps = [0.5, 1, 2, 4, 8];
      const i = steps.indexOf(this.driver.getSpeed());
      this.driver.setSpeed(steps[Math.max(0, i - 1)] ?? 0.5);
      this.refresh();
      return true;
    }
    if (key === ']') {
      this.driver.cycleSpeed();
      this.refresh();
      return true;
    }
    if (key === 'Home') {
      this.driver.requestSeek(0);
      this.refresh();
      return true;
    }
    if (key === 'End') {
      this.driver.requestSeek(this.driver.getTotalTicks());
      this.refresh();
      return true;
    }
    return false;
  }
}
