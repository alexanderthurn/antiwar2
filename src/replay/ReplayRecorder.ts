import type { PlayerSlot } from '../multiplayer/PlayerSlot';
import { capturePlayerTick, emptyPlayerTick, encodeReplay } from './ReplayFormat';
import type { PlayerTickInput, ReplayFooter, ReplayHeader } from './replayTypes';

export class ReplayRecorder {
  private readonly ticks: import('./replayTypes').ReplayTick[] = [];
  private playerCount = 1;
  private finished = false;
  private encoded: Uint8Array | null = null;

  constructor(readonly header: ReplayHeader) {}

  onCombatTick(players: PlayerSlot[], edgeLeft: boolean, edgeRight: boolean): void {
    if (this.finished) return;
    const row = players.map((p) => {
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
    this.playerCount = Math.max(1, row.length);
    this.ticks.push({ phase: 'combat', combat: row });
  }

  onShopTick(cursorX: number, cursorY: number, confirmEdge: boolean, shortcutSlot: number): void {
    if (this.finished) return;
    this.ticks.push({
      phase: 'shop',
      shop: { cursorX, cursorY, confirmEdge, shortcutSlot },
    });
  }

  holdLastInput(): PlayerTickInput[] {
    for (let i = this.ticks.length - 1; i >= 0; i--) {
      const tick = this.ticks[i];
      if (tick?.phase === 'combat' && tick.combat?.length) {
        return tick.combat.map((t) => ({ ...t, edgeLeft: false, edgeRight: false }));
      }
    }
    return [emptyPlayerTick()];
  }

  async finish(footer: Omit<ReplayFooter, 'totalSimTicks'>): Promise<Uint8Array> {
    this.finished = true;
    this.encoded = await encodeReplay({
      header: this.header,
      playerCount: this.playerCount,
      ticks: this.ticks,
      footer: { ...footer, totalSimTicks: this.ticks.length },
    });
    return this.encoded;
  }

  getEncoded(): Uint8Array | null {
    return this.encoded;
  }

  getTotalSimTicks(): number {
    return this.ticks.length;
  }
}
