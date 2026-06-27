/** Default campaign id — dev URLs and legacy save migration. */
export const DEFAULT_CAMPAIGN_ID = 'aw';

/** Saved playthrough key, e.g. `aw_`, `aw_h`, `iraq_2004_`, `iraq_2004_h`. */
export type CampaignRunId = string;

export interface LevelRunStats {
  bestTimeSec?: number;
  bestScore?: number;
  completedAt?: string;
}

export interface RunProgress {
  unlockedIndex: number;
  campaignComplete: boolean;
  levels: Record<string, LevelRunStats>;
}

export interface LevelWonStats {
  levelIndex: number;
  timeSec: number;
  score: number;
}

const STORAGE_PREFIX = 'antiwar2_run_';
const LEGACY_CAMPAIGN_KEY = 'antiwar2_campaign';
const LEGACY_HIGHSCORE_KEY = 'antiwar2_highscores';

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

export function formatLevelTime(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`;
  return `${total}s`;
}

/** Per-run campaign progress — each normal/hardcore campaign has isolated saves. */
export class RunProgressStore {
  private readonly cache = new Map<CampaignRunId, RunProgress>();
  private migratedLegacy = false;

  get(runId: CampaignRunId): Readonly<RunProgress> {
    this.migrateLegacyOnce();
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

  getLevelStats(runId: CampaignRunId, levelIndex: number): LevelRunStats | undefined {
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

  recordLevelResult(runId: CampaignRunId, levelIndex: number, timeSec: number, score: number): void {
    const progress = this.mutable(runId);
    const key = String(levelIndex);
    const prev = progress.levels[key] ?? {};
    const next: LevelRunStats = { ...prev };

    if (prev.bestTimeSec === undefined || timeSec < prev.bestTimeSec) {
      next.bestTimeSec = timeSec;
    }
    if (prev.bestScore === undefined || score > prev.bestScore) {
      next.bestScore = score;
    }
    if (!prev.completedAt) {
      next.completedAt = new Date().toISOString().slice(0, 10);
    }

    progress.levels[key] = next;
    this.save(runId, progress);
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

  private mutable(runId: CampaignRunId): RunProgress {
    this.migrateLegacyOnce();
    const progress = structuredClone(this.get(runId)) as RunProgress;
    this.cache.set(runId, progress);
    return progress;
  }

  private load(runId: CampaignRunId): RunProgress {
    try {
      const raw = localStorage.getItem(storageKey(runId));
      if (!raw) return emptyProgress();
      const parsed = JSON.parse(raw) as Partial<RunProgress>;
      return {
        unlockedIndex:
          typeof parsed.unlockedIndex === 'number' && parsed.unlockedIndex >= 0
            ? Math.floor(parsed.unlockedIndex)
            : 0,
        campaignComplete: parsed.campaignComplete === true,
        levels: parsed.levels && typeof parsed.levels === 'object' ? parsed.levels : {},
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

  private migrateLegacyOnce(): void {
    if (this.migratedLegacy) return;
    this.migratedLegacy = true;

    const normalId = normalRunId(DEFAULT_CAMPAIGN_ID);
    if (localStorage.getItem(storageKey(normalId))) return;

    try {
      const legacyRaw = localStorage.getItem(LEGACY_CAMPAIGN_KEY);
      if (!legacyRaw) return;

      const legacy = JSON.parse(legacyRaw) as {
        unlockedIndex?: number;
        campaignComplete?: boolean;
      };
      const progress = emptyProgress();
      if (typeof legacy.unlockedIndex === 'number' && legacy.unlockedIndex >= 0) {
        progress.unlockedIndex = Math.floor(legacy.unlockedIndex);
      }
      if (legacy.campaignComplete === true) progress.campaignComplete = true;

      const scoresRaw = localStorage.getItem(LEGACY_HIGHSCORE_KEY);
      if (scoresRaw) {
        const scores = JSON.parse(scoresRaw) as Record<string, { score?: number }>;
        for (const [id, entry] of Object.entries(scores)) {
          if (!entry || typeof entry.score !== 'number') continue;
          const levelIndex = Number(id) - 1;
          if (levelIndex < 0) continue;
          progress.levels[String(levelIndex)] = { bestScore: entry.score };
        }
      }

      this.cache.set(normalId, progress);
      this.save(normalId, progress);
      localStorage.removeItem(LEGACY_CAMPAIGN_KEY);
      localStorage.removeItem(LEGACY_HIGHSCORE_KEY);
    } catch {
      // ignore corrupt legacy save
    }
  }
}

export const runProgressStore = new RunProgressStore();
