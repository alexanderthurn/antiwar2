import { BitmapText, Container, Graphics, Rectangle } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import { formatLevelTimeHms } from '../core/CampaignRun';
import { ReplayDriver } from '../replay/ReplayDriver';
import { kewlText } from './KewlFont';

const BAR_H = 28;
const BAR_Y = DESIGN.height - BAR_H - 12;
const BAR_X = 80;
const BAR_W = DESIGN.width - 160;
const CTRL_Y = BAR_Y - 44;
const BTN_H = 30;
const SPEED_BTN_W = 68;
const SPEED_GAP = 8;
const PLAY_BTN_W = 56;

export class ReplayOverlay extends Container {
  private bar = new Graphics();
  private timeText: BitmapText;
  private playBtn = new Container();
  private playBg = new Graphics();
  private playLabel: BitmapText;
  private speedBtns: Container[] = [];
  private speedBgs: Graphics[] = [];
  private driver: ReplayDriver;
  private onExit: () => void;

  constructor(driver: ReplayDriver, _nick: string, onExit: () => void) {
    super();
    this.driver = driver;
    this.onExit = onExit;
    this.eventMode = 'static';
    this.interactiveChildren = true;

    this.bar.eventMode = 'none';
    this.addChild(this.bar);

    this.timeText = kewlText({
      text: '',
      size: 14,
      align: 'right',
      anchorX: 1,
      anchorY: 0.5,
    });
    this.timeText.position.set(BAR_X + BAR_W, CTRL_Y);
    this.timeText.eventMode = 'none';
    this.addChild(this.timeText);

    this.playBtn.position.set(BAR_X, CTRL_Y);
    this.playBtn.eventMode = 'static';
    this.playBtn.cursor = 'pointer';
    this.playBtn.hitArea = new Rectangle(-PLAY_BTN_W / 2, -BTN_H / 2, PLAY_BTN_W, BTN_H);
    this.playBtn.addChild(this.playBg);
    this.playLabel = kewlText({ text: '||', size: 14, anchorX: 0.5, anchorY: 0.5 });
    this.playBtn.addChild(this.playLabel);
    this.playBtn.on('pointertap', (e) => {
      e.stopPropagation();
      this.driver.togglePlaying();
      this.refresh();
    });
    this.addChild(this.playBtn);

    let speedX = BAR_X + PLAY_BTN_W + 16;
    for (const speed of ReplayDriver.SPEEDS) {
      const btn = new Container();
      btn.position.set(speedX + SPEED_BTN_W / 2, CTRL_Y);
      btn.eventMode = 'static';
      btn.cursor = 'pointer';
      btn.hitArea = new Rectangle(-SPEED_BTN_W / 2, -BTN_H / 2, SPEED_BTN_W, BTN_H);

      const bg = new Graphics();
      const label = kewlText({
        text: speed < 1 ? `${speed}x` : `${speed}x`,
        size: 13,
        anchorX: 0.5,
        anchorY: 0.5,
      });
      btn.addChild(bg, label);
      btn.on('pointertap', (e) => {
        e.stopPropagation();
        this.driver.setSpeed(speed);
        this.refresh();
      });

      this.speedBtns.push(btn);
      this.speedBgs.push(bg);
      this.addChild(btn);
      speedX += SPEED_BTN_W + SPEED_GAP;
    }

    this.refresh();
  }

  refresh(opts?: { seeking?: boolean }): void {
    const total = this.driver.getTotalTicks();
    const tick = this.driver.getGlobalTick();
    const progress = total > 0 ? tick / total : 0;
    const cur = formatLevelTimeHms(this.driver.getTimeMs());
    const end = formatLevelTimeHms(this.driver.getFooterTimeMs());
    const playing = this.driver.isPlaying();

    this.timeText.text = opts?.seeking ? `${cur} / ${end} …` : `${cur} / ${end}`;
    this.playLabel.text = playing ? '>' : '||';
    this.drawBtn(this.playBg, PLAY_BTN_W, playing ? 0x226633 : 0x333333);

    const speed = this.driver.getSpeed();
    for (let i = 0; i < ReplayDriver.SPEEDS.length; i++) {
      const active = ReplayDriver.SPEEDS[i] === speed;
      this.drawBtn(this.speedBgs[i]!, SPEED_BTN_W, active ? 0x225588 : 0x2a2a2a);
    }

    this.bar.clear();
    this.bar.roundRect(BAR_X, BAR_Y, BAR_W, BAR_H, 4).fill({ color: 0x222222, alpha: 0.85 });
    if (progress > 0) {
      this.bar
        .roundRect(BAR_X, BAR_Y, BAR_W * progress, BAR_H, 4)
        .fill({ color: 0x44aaff, alpha: opts?.seeking ? 0.65 : 0.9 });
    }
    const knobX = BAR_X + BAR_W * progress;
    this.bar.circle(knobX, BAR_Y + BAR_H / 2, 8).fill(0xffffff);
  }

  private drawBtn(bg: Graphics, w: number, color: number): void {
    bg.clear();
    bg.roundRect(-w / 2, -BTN_H / 2, w, BTN_H, 4).fill({ color, alpha: 0.95 });
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
    if (key === '[') {
      const steps = ReplayDriver.SPEEDS;
      const i = steps.indexOf(this.driver.getSpeed() as (typeof steps)[number]);
      this.driver.setSpeed(steps[Math.max(0, i - 1)] ?? 0.25);
      this.refresh();
      return true;
    }
    if (key === ']') {
      this.driver.cycleSpeed();
      this.refresh();
      return true;
    }
    for (let i = 0; i < ReplayDriver.SPEEDS.length; i++) {
      if (key === String(i + 1)) {
        this.driver.setSpeed(ReplayDriver.SPEEDS[i]!);
        this.refresh();
        return true;
      }
    }
    return false;
  }
}
