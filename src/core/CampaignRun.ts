/** Default campaign id — dev URLs and save keys. */
export const DEFAULT_CAMPAIGN_ID = 'aw';

/** Saved playthrough key, e.g. `aw_`, `aw_h`, `iraq_2004_`, `iraq_2004_h`. */
export type CampaignRunId = string;

export interface LevelRecord {
  time: number;
  score: number;
  date: number;
  version: number;
  nick: string;
}

export interface RunProgress {
  unlockedIndex: number;
  campaignComplete: boolean;
  levels: Record<string, LevelRecord>;
}

export interface LevelWonStats {
  levelIndex: number;
  timeMs: number;
  score: number;
}

const STORAGE_PREFIX = 'antiwar2_run_';

function emptyProgress(): RunProgress {
  return { unlockedIndex: 0, campaignComplete: false, levels: {} };
}

function storageKey(runId: CampaignRunId): string {
  return `${STORAGE_PREFIX}${runId}`;
}

export function normalRunId(campaignId: string): CampaignRunId {
  return `${campaignId}_`;
}

export function hardcoreRunId(campaignId: string): CampaignRunId {
  return `${campaignId}_h`;
}

export function campaignIdFromRunId(runId: CampaignRunId): string {
  if (runId.endsWith('_h')) return runId.slice(0, -2);
  if (runId.endsWith('_')) return runId.slice(0, -1);
  return runId;
}

export function isHardcoreRun(runId: CampaignRunId): boolean {
  return runId.endsWith('_h');
}

/** v1-style level score: money remaining at victory (higher is better). */
export function computeLevelScore(money: number): number {
  return Math.floor(money);
}

export function formatLevelTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`;
  return `${total}s`;
}

/** hh:mm:ss for campaign highscore display. */
export function formatLevelTimeHms(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatHighscoreLine(record: LevelRecord): string {
  return `Best: ${formatLevelTimeHms(record.time)}`;
}

/** Time is primary; score breaks ties on equal time. */
export function isBetterLevelRecord(
  prev: LevelRecord | undefined,
  time: number,
  score: number,
): boolean {
  if (!prev) return true;
  if (time < prev.time) return true;
  if (time === prev.time && score > prev.score) return true;
  return false;
}

/** Per-run campaign progress — each normal/hardcore campaign has isolated saves. */
export class RunProgressStore {
  private readonly cache = new Map<CampaignRunId, RunProgress>();

  get(runId: CampaignRunId): Readonly<RunProgress> {
    let progress = this.cache.get(runId);
    if (!progress) {
      progress = this.load(runId);
      this.cache.set(runId, progress);
    }
    return progress;
  }

  isUnlocked(runId: CampaignRunId, levelIndex: number): boolean {
    return levelIndex <= this.get(runId).unlockedIndex;
  }

  isCompleted(runId: CampaignRunId, levelIndex: number): boolean {
    return levelIndex < this.get(runId).unlockedIndex;
  }

  getLevelStats(runId: CampaignRunId, levelIndex: number): LevelRecord | undefined {
    return this.get(runId).levels[String(levelIndex)];
  }

  isNormalCampaignComplete(campaignId: string): boolean {
    return this.get(normalRunId(campaignId)).campaignComplete;
  }

  /** @returns true when this run just became campaign-complete for the first time. */
  completeLevel(runId: CampaignRunId, levelIndex: number, finalLevelIndex: number): boolean {
    const progress = this.mutable(runId);
    const wasComplete = progress.campaignComplete;
    progress.unlockedIndex = Math.max(progress.unlockedIndex, levelIndex + 1);
    if (levelIndex >= finalLevelIndex) progress.campaignComplete = true;
    this.save(runId, progress);
    return !wasComplete && progress.campaignComplete;
  }

  /**
   * Saves a level result when it beats the stored record (time first, score tiebreak).
   * @returns true when the record was replaced.
   */
  recordLevelResult(
    runId: CampaignRunId,
    levelIndex: number,
    timeMs: number,
    score: number,
    record: Omit<LevelRecord, 'time' | 'score'>,
  ): boolean {
    const progress = this.mutable(runId);
    const key = String(levelIndex);
    const prev = progress.levels[key];
    const time = Math.max(0, Math.floor(timeMs));
    const nextScore = Math.floor(score);

    if (!isBetterLevelRecord(prev, time, nextScore)) return false;

    progress.levels[key] = {
      time,
      score: nextScore,
      date: record.date,
      version: record.version,
      nick: record.nick,
    };
    this.save(runId, progress);
    return true;
  }

  reset(runId: CampaignRunId): void {
    const progress = emptyProgress();
    this.cache.set(runId, progress);
    this.save(runId, progress);
  }

  unlockAll(runId: CampaignRunId, maxUnlockedIndex: number): void {
    const progress = this.mutable(runId);
    progress.unlockedIndex = Math.max(0, maxUnlockedIndex);
    progress.campaignComplete = true;
    this.save(runId, progress);
  }

  isAllUnlocked(runId: CampaignRunId, maxUnlockedIndex: number): boolean {
    return this.get(runId).unlockedIndex >= maxUnlockedIndex;
  }

  ensureUnlockedAtLeast(runId: CampaignRunId, levelIndex: number): void {
    const progress = this.mutable(runId);
    const next = Math.max(0, levelIndex);
    if (next <= progress.unlockedIndex) return;
    progress.unlockedIndex = next;
    this.save(runId, progress);
  }

  afterStorageClear(): void {
    this.cache.clear();
  }

  private mutable(runId: CampaignRunId): RunProgress {
    const progress = structuredClone(this.get(runId)) as RunProgress;
    this.cache.set(runId, progress);
    return progress;
  }

  private load(runId: CampaignRunId): RunProgress {
    try {
      const raw = localStorage.getItem(storageKey(runId));
      if (!raw) return emptyProgress();
      const parsed = JSON.parse(raw) as Partial<RunProgress>;
      const levels: Record<string, LevelRecord> = {};
      if (parsed.levels && typeof parsed.levels === 'object') {
        for (const [key, entry] of Object.entries(parsed.levels)) {
          const record = parseLevelRecord(entry);
          if (record) levels[key] = record;
        }
      }
      return {
        unlockedIndex:
          typeof parsed.unlockedIndex === 'number' && parsed.unlockedIndex >= 0
            ? Math.floor(parsed.unlockedIndex)
            : 0,
        campaignComplete: parsed.campaignComplete === true,
        levels,
      };
    } catch {
      return emptyProgress();
    }
  }

  private save(runId: CampaignRunId, progress: RunProgress): void {
    try {
      localStorage.setItem(storageKey(runId), JSON.stringify(progress));
    } catch {
      // ignore quota / private browsing
    }
  }
}

function parseLevelRecord(raw: unknown): LevelRecord | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const entry = raw as Record<string, unknown>;
  if (typeof entry.time !== 'number' || typeof entry.score !== 'number') return undefined;
  return {
    time: Math.max(0, Math.floor(entry.time)),
    score: Math.floor(entry.score),
    date: typeof entry.date === 'number' ? entry.date : 0,
    version: typeof entry.version === 'number' ? entry.version : 0,
    nick: typeof entry.nick === 'string' ? entry.nick : '',
  };
}

export const runProgressStore = new RunProgressStore();
