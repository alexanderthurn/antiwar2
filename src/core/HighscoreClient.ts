import type { LevelRecord } from './CampaignRun';
import { highscoreService } from './leaderboard/HighscoreService';
import type { SubmitResult } from './leaderboard/types';

export type { LeaderboardEntry, PrepareResult, SubmitResult } from './leaderboard/types';
export { buildBoardId } from './leaderboard/boardId';
export { highscoreService } from './leaderboard/HighscoreService';

export interface HighscorePayload extends LevelRecord {
  boardId: string;
}

/** Submit online score (requires prior prepareForLevel for same boardId). */
export async function submitHighscore(payload: HighscorePayload): Promise<SubmitResult> {
  return highscoreService.submitScore(payload);
}
