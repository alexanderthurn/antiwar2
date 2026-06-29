import type { UpgradeKey } from '../core/LevelSession';

export const REPLAY_MAGIC = 'AWR2';
export const REPLAY_FORMAT_VERSION = 2;

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

export interface PlayerTickInput {
  aimX: number;
  aimY: number;
  fireLeft: boolean;
  fireRight: boolean;
  edgeLeft: boolean;
  edgeRight: boolean;
}

export interface ShopTickInput {
  cursorX: number;
  cursorY: number;
  confirmEdge: boolean;
  /** 0 = none, 1–9 = shop shortcut slot */
  shortcutSlot: number;
}

export type ReplayPhase = 'combat' | 'shop';

export interface ReplayTick {
  phase: ReplayPhase;
  combat?: PlayerTickInput[];
  shop?: ShopTickInput;
}

export interface DecodedReplay {
  header: ReplayHeader;
  playerCount: number;
  ticks: ReplayTick[];
  footer: ReplayFooter;
}

/** @deprecated AWR2 uses unified ticks only */
export type ShopEvent =
  | { kind: 'buy'; key: UpgradeKey }
  | { kind: 'continue' };
