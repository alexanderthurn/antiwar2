import { createHttpProvider } from './HttpHighscoreProvider';
import type { PrepareResult, ScoreSubmit, SubmitResult } from './types';

/** Holds prepare checksum for the active level attempt. */
export class HighscoreService {
  private checksum: string | null = null;
  private boardId: string | null = null;
  private readonly http = createHttpProvider();

  get enabled(): boolean {
    return this.http !== null;
  }

  async prepareForLevel(boardId: string): Promise<PrepareResult | null> {
    this.boardId = boardId;
    this.checksum = null;
    if (!this.http) return null;
    const result = await this.http.prepare(boardId);
    this.checksum = result?.checksum ?? null;
    return result;
  }

  clearPrepare(): void {
    this.checksum = null;
    this.boardId = null;
  }

  async submitScore(
    payload: Omit<ScoreSubmit, 'checksum'> & { boardId: string; replay?: Uint8Array },
  ): Promise<SubmitResult> {
    if (!this.http || !this.checksum) {
      return { accepted: false, reason: 'not_prepared' };
    }
    if (payload.boardId !== this.boardId) {
      return { accepted: false, reason: 'board_mismatch' };
    }
    const result = await this.http.submit({
      ...payload,
      checksum: this.checksum,
    });
    this.clearPrepare();
    return result;
  }

  async fetchReplay(scoreId: number): Promise<Uint8Array | null> {
    if (!this.http) return null;
    return this.http.fetchReplay(scoreId);
  }

  async fetchScoreMeta(scoreId: number): Promise<{
    id: number;
    boardId: string;
    nick: string;
    time: number;
    score: number;
    hasReplay: boolean;
  } | null> {
    if (!this.http) return null;
    return this.http.fetchScoreMeta(scoreId);
  }
}

export const highscoreService = new HighscoreService();
