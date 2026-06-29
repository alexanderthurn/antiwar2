import type { DecodedReplay, PlayerTickInput, ReplayTick, ShopTickInput } from './replayTypes';

export class ReplayDriver {
  readonly replay: DecodedReplay;
  private globalTick = 0;
  private playing = true;
  private speed = 1;
  private seekTarget: number | null = null;
  private playingBeforeSeek = false;

  constructor(replay: DecodedReplay) {
    this.replay = replay;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  setPlaying(v: boolean): void {
    this.playing = v;
  }

  togglePlaying(): void {
    this.playing = !this.playing;
  }

  getSpeed(): number {
    return this.speed;
  }

  setSpeed(s: number): void {
    this.speed = Math.max(0.25, Math.min(16, s));
  }

  cycleSpeed(): void {
    const steps = ReplayDriver.SPEEDS;
    const i = steps.indexOf(this.speed as (typeof steps)[number]);
    this.speed = steps[(i + 1) % steps.length] ?? 1;
  }

  static readonly SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16] as const;

  getGlobalTick(): number {
    return this.globalTick;
  }

  getTotalTicks(): number {
    return this.replay.footer.totalSimTicks;
  }

  getProgress(): number {
    const total = this.getTotalTicks();
    if (total <= 0) return 0;
    return this.globalTick / total;
  }

  getTimeMs(): number {
    const hz = this.replay.header.simHz || 60;
    return Math.floor((this.globalTick / hz) * 1000);
  }

  getFooterTimeMs(): number {
    return this.replay.footer.timeMs;
  }

  isAtEnd(): boolean {
    return this.globalTick >= this.getTotalTicks();
  }

  isSeeking(): boolean {
    return this.seekTarget !== null;
  }

  requestSeek(tick: number): void {
    this.playingBeforeSeek = this.playing;
    this.seekTarget = Math.max(0, Math.min(this.getTotalTicks(), Math.floor(tick)));
    this.playing = false;
  }

  wasPlayingBeforeSeek(): boolean {
    return this.playingBeforeSeek;
  }

  seekBySeconds(deltaSec: number): void {
    const hz = this.replay.header.simHz || 60;
    this.requestSeek(this.globalTick + Math.round(deltaSec * hz));
  }

  seekByTicks(delta: number): void {
    this.requestSeek(this.globalTick + delta);
  }

  consumeSeekTarget(): number | null {
    const t = this.seekTarget;
    this.seekTarget = null;
    return t;
  }

  resetPosition(): void {
    this.globalTick = 0;
  }

  syncPosition(globalTick: number): void {
    this.globalTick = Math.max(0, Math.min(this.getTotalTicks(), globalTick));
  }

  getCurrentTick(): ReplayTick | null {
    return this.replay.ticks[this.globalTick] ?? null;
  }

  getPhase(): 'combat' | 'shop' | null {
    return this.getCurrentTick()?.phase ?? null;
  }

  getCombatInput(): PlayerTickInput[] | null {
    const tick = this.getCurrentTick();
    if (!tick || tick.phase !== 'combat' || !tick.combat) return null;
    return tick.combat.map((t) => ({ ...t }));
  }

  getShopInput(): ShopTickInput | null {
    const tick = this.getCurrentTick();
    if (!tick || tick.phase !== 'shop' || !tick.shop) return null;
    return { ...tick.shop };
  }

  /** Advance one sim tick after the step completes. */
  advanceTick(): boolean {
    if (this.globalTick >= this.getTotalTicks()) return false;
    this.globalTick += 1;
    return this.globalTick < this.getTotalTicks();
  }
}
