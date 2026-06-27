import type { LevelRecord } from './CampaignRun';

export interface HighscorePayload extends LevelRecord {
  campaignId: string;
  levelIndex: number;
  hardcore: boolean;
}

/** Online highscore upload — stub until PHP backend is wired up. */
export async function submitHighscore(_payload: HighscorePayload): Promise<void> {
  // no-op
}
