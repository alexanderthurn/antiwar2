import type { DecodedReplay, PlayerTickInput, ShopEvent } from './replayTypes';

export class ReplayDriver {
  readonly replay: DecodedReplay;
  private globalTick = 0;
  private roundIndex = 0;
  private roundTick = 0;
  private shopEventIndex = 0;
  private playing = true;
  private speed = 1;
  private seekTarget: number | null = null;

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
    this.speed = Math.max(0.25, Math.min(8, s));
  }

  cycleSpeed(): void {
    const steps = [0.5, 1, 2, 4, 8];
    const i = steps.indexOf(this.speed);
    this.speed = steps[(i + 1) % steps.length] ?? 1;
  }

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
    this.seekTarget = Math.max(0, Math.min(this.getTotalTicks(), Math.floor(tick)));
    this.playing = false;
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
    this.roundIndex = 0;
    this.roundTick = 0;
    this.shopEventIndex = 0;
  }

  syncPosition(globalTick: number): void {
    this.globalTick = 0;
    this.roundIndex = 0;
    this.roundTick = 0;
    this.shopEventIndex = 0;
    for (let r = 0; r < this.replay.rounds.length && this.globalTick < globalTick; r++) {
      const round = this.replay.rounds[r]!;
      const ticksInRound = round.ticks.length;
      if (this.globalTick + ticksInRound <= globalTick) {
        this.globalTick += ticksInRound;
        this.roundIndex = r + 1;
        this.roundTick = 0;
        this.shopEventIndex = round.shopEvents.length;
      } else {
        this.roundIndex = r;
        const remaining = globalTick - this.globalTick;
        this.roundTick = remaining;
        this.globalTick = globalTick;
        break;
      }
    }
  }

  currentRoundShopEvents(): ShopEvent[] {
    const round = this.replay.rounds[this.roundIndex];
    return round?.shopEvents ?? [];
  }

  peekShopEvent(): ShopEvent | null {
    const events = this.currentRoundShopEvents();
    return events[this.shopEventIndex] ?? null;
  }

  consumeShopEvent(): ShopEvent | null {
    const ev = this.peekShopEvent();
    if (ev) this.shopEventIndex += 1;
    return ev;
  }

  getCombatInput(): PlayerTickInput[] | null {
    const round = this.replay.rounds[this.roundIndex];
    if (!round) return null;
    const row = round.ticks[this.roundTick];
    if (!row) return null;
    return row.map((t) => ({ ...t }));
  }

  /** Advance one sim tick after combat step. Returns false when replay ended. */
  advanceTick(): boolean {
    const round = this.replay.rounds[this.roundIndex];
    if (!round) return false;
    if (this.roundTick + 1 < round.ticks.length) {
      this.roundTick += 1;
      this.globalTick += 1;
      return this.globalTick < this.getTotalTicks();
    }
    this.globalTick += 1;
    return this.globalTick < this.getTotalTicks();
  }

  onRoundShopStarted(roundIdx: number): void {
    this.roundIndex = roundIdx;
    this.roundTick = 0;
    this.shopEventIndex = 0;
  }

  onShopContinued(): void {
    this.roundIndex += 1;
    this.roundTick = 0;
    this.shopEventIndex = 0;
  }
}
