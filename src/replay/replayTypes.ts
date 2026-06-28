import type { UpgradeKey } from '../core/LevelSession';

export const REPLAY_MAGIC = 'AWR1';
export const REPLAY_FORMAT_VERSION = 1;

export interface ReplayHeader {
  formatVersion: number;
  gameVersion: number;
  levelHash: number;
  boardId: string;
  rngSeed: number;
  simHz: number;
}

export interface ReplayFooter {
  timeMs: number;
  score: number;
  totalSimTicks: number;
}

export type ShopEvent =
  | { kind: 'buy'; key: UpgradeKey }
  | { kind: 'continue' };

export interface PlayerTickInput {
  aimX: number;
  aimY: number;
  fireLeft: boolean;
  fireRight: boolean;
  edgeLeft: boolean;
  edgeRight: boolean;
}

export interface RoundReplay {
  shopEvents: ShopEvent[];
  ticks: PlayerTickInput[][];
}

export interface DecodedReplay {
  header: ReplayHeader;
  rounds: RoundReplay[];
  footer: ReplayFooter;
}
