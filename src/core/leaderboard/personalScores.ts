import {
  formatLevelTimeHms,
  hardcoreRunId,
  normalRunId,
  runProgressStore,
} from '../CampaignRun';
import { isLevelMapEntry, loadCampaignIndex, loadCampaignRegistry } from '../../data/types';
import { buildBoardId } from './boardId';
import { getClientId } from './clientId';
import { createHttpProvider } from './HttpHighscoreProvider';
import type { PlayerScoreEntry } from './types';

export interface PersonalScoreRow {
  boardId: string;
  campaignName: string;
  levelName: string;
  modeLabel: string;
  timeMs: number;
  score: number;
  rank?: number;
  source: 'online' | 'local';
}

export async function loadPersonalScoreRows(): Promise<PersonalScoreRow[]> {
  const registry = await loadCampaignRegistry();
  const onlineByBoard = new Map<string, PlayerScoreEntry>();

  const http = createHttpProvider();
  if (http) {
    for (const entry of await http.fetchPlayerScores(getClientId())) {
      onlineByBoard.set(entry.boardId, entry);
    }
  }

  const rows: PersonalScoreRow[] = [];
  const seenBoards = new Set<string>();

  for (const campaign of registry.campaigns) {
    if (campaign.id === 'hub') continue;

    const index = await loadCampaignIndex(campaign.id);
    const runs = [
      { runId: normalRunId(campaign.id), label: 'Normal' },
      { runId: hardcoreRunId(campaign.id), label: 'Hardcore' },
    ] as const;

    for (const run of runs) {
      const progress = runProgressStore.get(run.runId);
      for (let levelIndex = 0; levelIndex < index.levels.length; levelIndex++) {
        const mapEntry = index.levels[levelIndex]!;
        if (!isLevelMapEntry(mapEntry)) continue;

        const boardId = buildBoardId(run.runId, levelIndex);
        seenBoards.add(boardId);

        const online = onlineByBoard.get(boardId);
        const local = progress.levels[String(levelIndex)];

        if (online) {
          rows.push({
            boardId,
            campaignName: index.campaignName,
            levelName: mapEntry.name,
            modeLabel: run.label,
            timeMs: online.time,
            score: online.score,
            rank: online.rank,
            source: 'online',
          });
        } else if (local) {
          rows.push({
            boardId,
            campaignName: index.campaignName,
            levelName: mapEntry.name,
            modeLabel: run.label,
            timeMs: local.time,
            score: local.score,
            source: 'local',
          });
        }
      }
    }
  }

  for (const entry of onlineByBoard.values()) {
    if (seenBoards.has(entry.boardId)) continue;
    rows.push({
      boardId: entry.boardId,
      campaignName: entry.boardId,
      levelName: '',
      modeLabel: '',
      timeMs: entry.time,
      score: entry.score,
      rank: entry.rank,
      source: 'online',
    });
  }

  return rows;
}

export function formatPersonalScoreRows(rows: PersonalScoreRow[]): string {
  if (rows.length === 0) {
    return 'No scores yet.\nFinish a level to see your times here.';
  }

  const lines: string[] = [];
  let lastHeader = '';

  for (const row of rows) {
    const header = row.modeLabel
      ? `${row.campaignName} — ${row.modeLabel}`
      : row.campaignName;
    if (header !== lastHeader) {
      if (lines.length > 0) lines.push('');
      lines.push(header);
      lastHeader = header;
    }

    const levelLabel = row.levelName || row.boardId;
    const time = formatLevelTimeHms(row.timeMs);
    const rank =
      row.source === 'online' && row.rank !== undefined
        ? `#${row.rank}`
        : '(local)';
    lines.push(`  ${padRight(levelLabel, 18)}${padRight(time, 10)}${rank}`);
  }

  return lines.join('\n');
}

function padRight(text: string, width: number): string {
  return text.length >= width ? `${text} ` : `${text}${' '.repeat(width - text.length)}`;
}
