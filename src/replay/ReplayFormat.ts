import { DESIGN } from '../core/DesignSpace';
import { deflateBytes, inflateBytes } from './compress';
import {
  REPLAY_FORMAT_VERSION,
  REPLAY_MAGIC,
  type DecodedReplay,
  type PlayerTickInput,
  type ReplayFooter,
  type ReplayHeader,
  type ReplayTick,
  type ShopTickInput,
} from './replayTypes';

const AIM_SCALE = 4095;
const PHASE_COMBAT = 0;
const PHASE_SHOP = 1;

function quantizeAim(v: number, max: number): number {
  return Math.max(0, Math.min(AIM_SCALE, Math.round((v / max) * AIM_SCALE)));
}

function dequantizeAim(q: number, max: number): number {
  return (q / AIM_SCALE) * max;
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

function packShopTick(s: ShopTickInput): number[] {
  const out: number[] = [];
  writeU16(out, quantizeAim(s.cursorX, DESIGN.width));
  writeU16(out, quantizeAim(s.cursorY, DESIGN.height));
  let flags = 0;
  if (s.confirmEdge) flags |= 1;
  flags |= (Math.max(0, Math.min(15, s.shortcutSlot)) & 0xf) << 1;
  writeU8(out, flags);
  return out;
}

function unpackShopTick(data: Uint8Array, off: { i: number }): ShopTickInput {
  const cx = readU16(data, off);
  const cy = readU16(data, off);
  const flags = readU8(data, off);
  return {
    cursorX: dequantizeAim(cx, DESIGN.width),
    cursorY: dequantizeAim(cy, DESIGN.height),
    confirmEdge: (flags & 1) !== 0,
    shortcutSlot: (flags >> 1) & 0xf,
  };
}

function encodeTickStream(ticks: ReplayTick[], playerCount: number): Uint8Array {
  const buf: number[] = [];
  writeU16(buf, playerCount);
  writeU32(buf, ticks.length);
  for (const tick of ticks) {
    if (tick.phase === 'shop') {
      writeU8(buf, PHASE_SHOP);
      buf.push(...packShopTick(tick.shop ?? emptyShopTick()));
    } else {
      writeU8(buf, PHASE_COMBAT);
      const row = tick.combat ?? [];
      for (let p = 0; p < playerCount; p++) {
        buf.push(...packPlayerTick(row[p] ?? emptyPlayerTick()));
      }
    }
  }
  return new Uint8Array(buf);
}

function decodeTickStream(raw: Uint8Array): { playerCount: number; ticks: ReplayTick[] } {
  const off = { i: 0 };
  const playerCount = readU16(raw, off);
  const tickCount = readU32(raw, off);
  const ticks: ReplayTick[] = [];
  for (let t = 0; t < tickCount; t++) {
    const phase = readU8(raw, off);
    if (phase === PHASE_SHOP) {
      ticks.push({ phase: 'shop', shop: unpackShopTick(raw, off) });
    } else {
      const row: PlayerTickInput[] = [];
      for (let p = 0; p < playerCount; p++) row.push(unpackPlayerTick(raw, off));
      ticks.push({ phase: 'combat', combat: row });
    }
  }
  return { playerCount, ticks };
}

export interface EncodeReplayInput {
  header: ReplayHeader;
  playerCount: number;
  ticks: ReplayTick[];
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

  const stream = await deflateBytes(encodeTickStream(input.ticks, input.playerCount));
  writeU32(body, stream.length);
  body.push(...stream);

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

  const streamLen = readU32(blob, off);
  const streamRaw = await inflateBytes(blob.subarray(off.i, off.i + streamLen));
  off.i += streamLen;
  const { playerCount, ticks } = decodeTickStream(streamRaw);

  const footer: ReplayFooter = {
    timeMs: readU32(blob, off),
    score: readU32(blob, off),
    totalSimTicks: readU32(blob, off),
  };

  return { header, playerCount, ticks, footer };
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

export function emptyShopTick(): ShopTickInput {
  return {
    cursorX: DESIGN.width / 2,
    cursorY: DESIGN.height / 2,
    confirmEdge: false,
    shortcutSlot: 0,
  };
}
