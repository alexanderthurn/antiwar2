const STREAK_WINDOW_SEC = 2.5;

export interface KillStreakEvent {
  slotIndex: number;
  streak: number;
  sound: string;
}

const STREAK_TABLE: Array<{ min: number; sound: string }> = [
  { min: 10, sound: 'holyshit.ogg' },
  { min: 9, sound: 'wickedsick.ogg' },
  { min: 8, sound: 'unstoppable.ogg' },
  { min: 7, sound: 'monsterkill.ogg' },
  { min: 6, sound: 'ultrakill.ogg' },
  { min: 5, sound: 'multikill.ogg' },
  { min: 4, sound: 'multikill.ogg' },
  { min: 3, sound: 'tripplekill.ogg' },
  { min: 2, sound: 'doublekill.ogg' },
];

export class KillStreakTracker {
  private streak = 0;
  private lastKillAt = 0;

  registerKill(nowSec: number): KillStreakEvent | null {
    if (this.streak > 0 && nowSec - this.lastKillAt > STREAK_WINDOW_SEC) {
      this.streak = 0;
    }
    this.streak += 1;
    this.lastKillAt = nowSec;

    if (this.streak < 2) return null;

    const entry = STREAK_TABLE.find((t) => this.streak >= t.min);
    if (!entry) return null;

    return {
      slotIndex: 0,
      streak: this.streak,
      sound: entry.sound,
    };
  }

  reset(): void {
    this.streak = 0;
    this.lastKillAt = 0;
  }
}

/** Per-player kill streak tracking. */
export class KillStreakManager {
  private readonly trackers = Array.from({ length: 5 }, () => new KillStreakTracker());
  private elapsed = 0;

  tick(dt: number): void {
    this.elapsed += dt;
  }

  now(): number {
    return this.elapsed;
  }

  registerKill(slotIndex: number): KillStreakEvent | null {
    const tracker = this.trackers[slotIndex];
    if (!tracker) return null;
    const event = tracker.registerKill(this.elapsed);
    if (event) event.slotIndex = slotIndex;
    return event;
  }

  resetAll(): void {
    this.elapsed = 0;
    for (const t of this.trackers) t.reset();
  }
}
