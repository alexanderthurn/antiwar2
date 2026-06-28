import type { UpgradeKey } from '../core/LevelSession';
import type { PlayerSlot } from '../multiplayer/PlayerSlot';
import { capturePlayerTick, emptyPlayerTick, encodeReplay } from './ReplayFormat';
import type { PlayerTickInput, ReplayFooter, ReplayHeader, RoundReplay } from './replayTypes';

export class ReplayRecorder {
  private readonly rounds: RoundReplay[] = [];
  private currentRound: RoundReplay = { shopEvents: [], ticks: [] };
  private roundTickIndex = 0;
  private totalSimTicks = 0;
  private lastHeld: PlayerTickInput[] = [];
  private finished = false;
  private encoded: Uint8Array | null = null;

  constructor(
    readonly header: ReplayHeader,
  ) {
    this.rounds.push(this.currentRound);
  }

  onCombatTick(players: PlayerSlot[], edgeLeft: boolean, edgeRight: boolean): void {
    if (this.finished) return;
    const row: PlayerTickInput[] = players.map((p) => {
      const isPointer = p.aimSource === 'pointer';
      return capturePlayerTick(
        p.crosshairX,
        p.crosshairY,
        p.fireLeft,
        p.fireRight,
        isPointer && edgeLeft,
        isPointer && edgeRight,
      );
    });
    this.currentRound.ticks.push(row);
    this.lastHeld = row.map((t) => ({ ...t, edgeLeft: false, edgeRight: false }));
    this.roundTickIndex += 1;
    this.totalSimTicks += 1;
  }

  onShopBuy(key: UpgradeKey): void {
    if (this.finished) return;
    this.currentRound.shopEvents.push({ kind: 'buy', key });
  }

  onShopContinue(): void {
    if (this.finished) return;
    this.currentRound.shopEvents.push({ kind: 'continue' });
    this.currentRound = { shopEvents: [], ticks: [] };
    this.rounds.push(this.currentRound);
    this.roundTickIndex = 0;
    this.lastHeld = [];
  }

  holdLastInput(): PlayerTickInput[] {
    if (this.lastHeld.length === 0) return [emptyPlayerTick()];
    return this.lastHeld.map((t) => ({ ...t }));
  }

  async finish(footer: Omit<ReplayFooter, 'totalSimTicks'>): Promise<Uint8Array> {
    this.finished = true;
    this.encoded = await encodeReplay({
      header: this.header,
      rounds: this.rounds.filter((r, i, arr) => r.ticks.length > 0 || r.shopEvents.length > 0 || i < arr.length - 1),
      footer: { ...footer, totalSimTicks: this.totalSimTicks },
    });
    return this.encoded;
  }

  getEncoded(): Uint8Array | null {
    return this.encoded;
  }

  getTotalSimTicks(): number {
    return this.totalSimTicks;
  }
}
