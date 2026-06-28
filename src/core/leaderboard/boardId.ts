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

export interface ParsedBoardId {
  campaignId: string;
  levelIndex: number;
  hardcore: boolean;
}

/** Inverse of {@link buildBoardId} for known campaign board keys. */
export function parseBoardId(boardId: string): ParsedBoardId | null {
  const hardcore = boardId.match(/^(.+)_h_(\d+)$/);
  if (hardcore) {
    return {
      campaignId: hardcore[1]!,
      levelIndex: Number.parseInt(hardcore[2]!, 10),
      hardcore: true,
    };
  }
  const normal = boardId.match(/^(.+)_(\d+)$/);
  if (normal) {
    return {
      campaignId: normal[1]!,
      levelIndex: Number.parseInt(normal[2]!, 10),
      hardcore: false,
    };
  }
  return null;
}
