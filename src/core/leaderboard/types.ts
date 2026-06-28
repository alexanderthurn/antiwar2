import type { LevelRecord } from '../CampaignRun';

export interface LeaderboardEntry {
  id?: number;
  rank: number;
  nick: string;
  time: number;
  score: number;
  version: number;
  date: number;
  hasReplay?: boolean;
  wallGapMs?: number;
  suspicious?: boolean;
}

export interface PlayerScoreEntry {
  id?: number;
  boardId: string;
  nick: string;
  rank: number;
  time: number;
  score: number;
  version: number;
  date: number;
  hasReplay?: boolean;
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
  replay?: Uint8Array;
}

export interface HighscoreProvider {
  readonly id: string;
  prepare(boardId: string): Promise<PrepareResult | null>;
  submit(payload: ScoreSubmit): Promise<SubmitResult>;
  fetchReplay(scoreId: number): Promise<Uint8Array | null>;
  fetchTop(boardId: string, opts?: { limit?: number; distinct?: boolean }): Promise<LeaderboardEntry[]>;
}
