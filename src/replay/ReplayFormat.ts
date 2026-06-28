import { DESIGN } from '../core/DesignSpace';
import { UPGRADE_KEYS, type UpgradeKey } from '../core/LevelSession';
import { deflateBytes, inflateBytes } from './compress';
import {
  REPLAY_FORMAT_VERSION,
  REPLAY_MAGIC,
  type DecodedReplay,
  type PlayerTickInput,
  type ReplayFooter,
  type ReplayHeader,
  type RoundReplay,
  type ShopEvent,
} from './replayTypes';

const AIM_SCALE = 4095;

function quantizeAim(v: number, max: number): number {
  return Math.max(0, Math.min(AIM_SCALE, Math.round((v / max) * AIM_SCALE)));
}

function dequantizeAim(q: number, max: number): number {
  return (q / AIM_SCALE) * max;
}

function upgradeIndex(key: UpgradeKey): number {
  const i = UPGRADE_KEYS.indexOf(key);
  return i >= 0 ? i : 0;
}

function upgradeFromIndex(i: number): UpgradeKey {
  return UPGRADE_KEYS[Math.max(0, Math.min(UPGRADE_KEYS.length - 1, i))] ?? 'rocket';
}

function writeU8(buf: number[], v: number): void {
  buf.push(v & 0xff);
}

function writeU16(buf: number[], v: number): void {
  buf.push((v >>> 8) & 0xff, v & 0xff);
}

function writeU32(buf: number[], v: number): void {
  buf.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
}

function writeStr(buf: number[], s: string): void {
  const bytes = new TextEncoder().encode(s);
  writeU16(buf, bytes.length);
  for (const b of bytes) buf.push(b);
}

function readU8(data: Uint8Array, off: { i: number }): number {
  return data[off.i++]!;
}

function readU16(data: Uint8Array, off: { i: number }): number {
  const v = (data[off.i]! << 8) | data[off.i + 1]!;
  off.i += 2;
  return v;
}

function readU32(data: Uint8Array, off: { i: number }): number {
  const v =
  (data[off.i]! << 24) | (data[off.i + 1]! << 16) | (data[off.i + 2]! << 8) | data[off.i + 3]!;
  off.i += 4;
  return v >>> 0;
}

function readStr(data: Uint8Array, off: { i: number }): string {
  const len = readU16(data, off);
  const slice = data.subarray(off.i, off.i + len);
  off.i += len;
  return new TextDecoder().decode(slice);
}

function packPlayerTick(p: PlayerTickInput): number[] {
  const out: number[] = [];
  writeU16(out, quantizeAim(p.aimX, DESIGN.width));
  writeU16(out, quantizeAim(p.aimY, DESIGN.height));
  let flags = 0;
  if (p.fireLeft) flags |= 1;
  if (p.fireRight) flags |= 2;
  if (p.edgeLeft) flags |= 4;
  if (p.edgeRight) flags |= 8;
  writeU8(out, flags);
  return out;
}

function unpackPlayerTick(data: Uint8Array, off: { i: number }): PlayerTickInput {
  const ax = readU16(data, off);
  const ay = readU16(data, off);
  const flags = readU8(data, off);
  return {
    aimX: dequantizeAim(ax, DESIGN.width),
    aimY: dequantizeAim(ay, DESIGN.height),
    fireLeft: (flags & 1) !== 0,
    fireRight: (flags & 2) !== 0,
    edgeLeft: (flags & 4) !== 0,
    edgeRight: (flags & 8) !== 0,
  };
}

function encodeCombatBlock(ticks: PlayerTickInput[][]): Uint8Array {
  const buf: number[] = [];
  writeU16(buf, ticks.length > 0 ? ticks[0]!.length : 1);
  writeU32(buf, ticks.length);
  for (const tick of ticks) {
    for (const player of tick) buf.push(...packPlayerTick(player));
  }
  return new Uint8Array(buf);
}

function decodeCombatBlock(raw: Uint8Array): PlayerTickInput[][] {
  const off = { i: 0 };
  const playerCount = readU16(raw, off);
  const tickCount = readU32(raw, off);
  const ticks: PlayerTickInput[][] = [];
  for (let t = 0; t < tickCount; t++) {
    const row: PlayerTickInput[] = [];
    for (let p = 0; p < playerCount; p++) row.push(unpackPlayerTick(raw, off));
    ticks.push(row);
  }
  return ticks;
}

function encodeShopEvents(events: ShopEvent[]): Uint8Array {
  const buf: number[] = [];
  writeU16(buf, events.length);
  for (const ev of events) {
    if (ev.kind === 'buy') {
      writeU8(buf, 1);
      writeU8(buf, upgradeIndex(ev.key));
    } else {
      writeU8(buf, 2);
    }
  }
  return new Uint8Array(buf);
}

function decodeShopEvents(raw: Uint8Array): ShopEvent[] {
  const off = { i: 0 };
  const count = readU16(raw, off);
  const out: ShopEvent[] = [];
  for (let i = 0; i < count; i++) {
    const kind = readU8(raw, off);
    if (kind === 1) out.push({ kind: 'buy', key: upgradeFromIndex(readU8(raw, off)) });
    else out.push({ kind: 'continue' });
  }
  return out;
}

export interface EncodeReplayInput {
  header: ReplayHeader;
  rounds: RoundReplay[];
  footer: ReplayFooter;
}

export async function encodeReplay(input: EncodeReplayInput): Promise<Uint8Array> {
  const body: number[] = [];
  writeStr(body, REPLAY_MAGIC);
  writeU16(body, input.header.formatVersion);
  writeU32(body, input.header.gameVersion);
  writeU32(body, input.header.levelHash);
  writeStr(body, input.header.boardId);
  writeU32(body, input.header.rngSeed);
  writeU8(body, input.header.simHz);
  writeU8(body, input.rounds.length);

  for (const round of input.rounds) {
    const shop = await deflateBytes(encodeShopEvents(round.shopEvents));
    writeU32(body, shop.length);
    body.push(...shop);
    const combat = await deflateBytes(encodeCombatBlock(round.ticks));
    writeU32(body, combat.length);
    body.push(...combat);
  }

  writeU32(body, input.footer.timeMs);
  writeU32(body, input.footer.score);
  writeU32(body, input.footer.totalSimTicks);

  return new Uint8Array(body);
}

export async function decodeReplay(blob: Uint8Array): Promise<DecodedReplay> {
  const off = { i: 0 };
  const magic = readStr(blob, off);
  if (magic !== REPLAY_MAGIC) throw new Error('invalid_replay_magic');

  const formatVersion = readU16(blob, off);
  if (formatVersion !== REPLAY_FORMAT_VERSION) throw new Error('unsupported_replay_version');

  const header: ReplayHeader = {
    formatVersion,
    gameVersion: readU32(blob, off),
    levelHash: readU32(blob, off),
    boardId: readStr(blob, off),
    rngSeed: readU32(blob, off),
    simHz: readU8(blob, off),
  };

  const roundCount = readU8(blob, off);
  const rounds: RoundReplay[] = [];
  for (let r = 0; r < roundCount; r++) {
    const shopLen = readU32(blob, off);
    const shopRaw = await inflateBytes(blob.subarray(off.i, off.i + shopLen));
    off.i += shopLen;
    const combatLen = readU32(blob, off);
    const combatRaw = await inflateBytes(blob.subarray(off.i, off.i + combatLen));
    off.i += combatLen;
    rounds.push({
      shopEvents: decodeShopEvents(shopRaw),
      ticks: decodeCombatBlock(combatRaw),
    });
  }

  const footer: ReplayFooter = {
    timeMs: readU32(blob, off),
    score: readU32(blob, off),
    totalSimTicks: readU32(blob, off),
  };

  return { header, rounds, footer };
}

export function capturePlayerTick(
  aimX: number,
  aimY: number,
  fireLeft: boolean,
  fireRight: boolean,
  edgeLeft: boolean,
  edgeRight: boolean,
): PlayerTickInput {
  return { aimX, aimY, fireLeft, fireRight, edgeLeft, edgeRight };
}

export function emptyPlayerTick(): PlayerTickInput {
  return {
    aimX: DESIGN.width / 2,
    aimY: DESIGN.height / 2,
    fireLeft: false,
    fireRight: false,
    edgeLeft: false,
    edgeRight: false,
  };
}
