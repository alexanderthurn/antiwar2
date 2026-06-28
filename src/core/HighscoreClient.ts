import type { LevelRecord } from './CampaignRun';
import { highscoreService } from './leaderboard/HighscoreService';
import type { SubmitResult } from './leaderboard/types';

export type { LeaderboardEntry, PrepareResult, SubmitResult } from './leaderboard/types';
export { buildBoardId } from './leaderboard/boardId';
export { highscoreService } from './leaderboard/HighscoreService';

export interface HighscorePayload extends LevelRecord {
  boardId: string;
  replay?: Uint8Array;
}

/** Submit online score (requires prior prepareForLevel for same boardId). */
export async function submitHighscore(payload: HighscorePayload): Promise<SubmitResult> {
  return highscoreService.submitScore(payload);
}

/** Fetch replay blob for a leaderboard score row. */
export async function fetchReplay(scoreId: number): Promise<Uint8Array | null> {
  return highscoreService.fetchReplay(scoreId);
}

export async function fetchScoreMeta(scoreId: number): Promise<{
  id: number;
  boardId: string;
  nick: string;
  time: number;
  score: number;
  hasReplay: boolean;
} | null> {
  return highscoreService.fetchScoreMeta(scoreId);
}
