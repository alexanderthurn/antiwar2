const STORAGE_KEY = 'antiwar2_campaign';

interface SavedCampaign {
  unlockedIndex: number;
}

/** Campaign unlock state — persisted in localStorage across sessions. */
export class CampaignProgress {
  /** Highest level index the player may start (0-based). */
  unlockedIndex = 0;
  /** Level index currently being played. */
  playingIndex = 0;

  constructor() {
    this.load();
  }

  reset(): void {
    this.unlockedIndex = 0;
    this.playingIndex = 0;
    this.save();
  }

  isUnlocked(levelIndex: number): boolean {
    return levelIndex <= this.unlockedIndex;
  }

  isCompleted(levelIndex: number): boolean {
    return levelIndex < this.unlockedIndex;
  }

  completeLevel(levelIndex: number): void {
    this.unlockedIndex = Math.max(this.unlockedIndex, levelIndex + 1);
    this.save();
  }

  /** Ensure a level is playable without lowering existing unlock progress. */
  ensureUnlockedAtLeast(levelIndex: number): void {
    const next = Math.max(0, levelIndex);
    if (next <= this.unlockedIndex) return;
    this.unlockedIndex = next;
    this.save();
  }

  unlockAll(maxUnlockedIndex: number): void {
    this.unlockedIndex = Math.max(0, maxUnlockedIndex);
    this.save();
  }

  isAllUnlocked(maxUnlockedIndex: number): boolean {
    return this.unlockedIndex >= maxUnlockedIndex;
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SavedCampaign>;
      if (typeof parsed.unlockedIndex === 'number' && parsed.unlockedIndex >= 0) {
        this.unlockedIndex = Math.floor(parsed.unlockedIndex);
      }
    } catch {
      // ignore corrupt save
    }
  }

  private save(): void {
    try {
      const data: SavedCampaign = { unlockedIndex: this.unlockedIndex };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore quota / private browsing
    }
  }
}
