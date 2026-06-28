import type { CampaignRunId } from '../CampaignRun';
import { isHardcoreRun } from '../CampaignRun';

/** Leaderboard key, e.g. `aw_5`, `aw_h_5`, `iraq_2004_h_3`. */
export function buildBoardId(runId: CampaignRunId, levelIndex: number): string {
  const level = Math.max(0, Math.floor(levelIndex));
  if (isHardcoreRun(runId)) {
    const campaign = runId.slice(0, -2);
    return `${campaign}_h_${level}`;
  }
  if (runId.endsWith('_')) {
    const campaign = runId.slice(0, -1);
    return `${campaign}_${level}`;
  }
  return `${runId}_${level}`;
}
