export interface HighscoreEntry {
  score: number;
  name: string;
  date: string;
}

const STORAGE_KEY = 'antiwar2_highscores';

/** Local per-level bests (key = level pack id). */
export class HighscoreStore {
  private scores = new Map<number, HighscoreEntry>();

  constructor() {
    this.load();
  }

  get(levelId: number): HighscoreEntry | undefined {
    return this.scores.get(levelId);
  }

  /** Returns true if this score is a new record. */
  tryRecord(levelId: number, score: number, name = 'AAA'): boolean {
    const prev = this.scores.get(levelId);
    if (prev && score <= prev.score) return false;
    this.scores.set(levelId, {
      score,
      name: name.slice(0, 3).toUpperCase() || 'AAA',
      date: new Date().toISOString().slice(0, 10),
    });
    this.save();
    return true;
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, HighscoreEntry>;
      for (const [id, entry] of Object.entries(parsed)) {
        if (entry && typeof entry.score === 'number') {
          this.scores.set(Number(id), entry);
        }
      }
    } catch {
      // ignore
    }
  }

  private save(): void {
    try {
      const obj: Record<string, HighscoreEntry> = {};
      for (const [id, entry] of this.scores) obj[String(id)] = entry;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // ignore
    }
  }
}

export const highscoreStore = new HighscoreStore();

/** v1-style level score: money remaining at victory (higher is better). */
export function computeLevelScore(money: number): number {
  return Math.floor(money);
}
