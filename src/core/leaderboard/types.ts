import type { LevelRecord } from '../CampaignRun';

export interface LeaderboardEntry {
  rank: number;
  nick: string;
  time: number;
  score: number;
  version: number;
  date: number;
  wallGapMs?: number;
  suspicious?: boolean;
}

export interface PlayerScoreEntry {
  boardId: string;
  nick: string;
  rank: number;
  time: number;
  score: number;
  version: number;
  date: number;
  wallGapMs?: number;
  suspicious?: boolean;
}

export interface SubmitResult {
  accepted: boolean;
  id?: number;
  rank?: number;
  reason?: string;
}

export interface PrepareResult {
  boardId: string;
  checksum: string;
  expiresIn: number;
}

export interface ScoreSubmit extends LevelRecord {
  boardId: string;
  checksum: string;
}

export interface HighscoreProvider {
  readonly id: string;
  prepare(boardId: string): Promise<PrepareResult | null>;
  submit(payload: ScoreSubmit): Promise<SubmitResult>;
  fetchTop(boardId: string, opts?: { limit?: number; distinct?: boolean }): Promise<LeaderboardEntry[]>;
}
