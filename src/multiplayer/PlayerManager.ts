import { DESIGN } from '../core/DesignSpace';
import { PlayerSlot } from './PlayerSlot';
import { distributeRocketCaps } from './rocketCaps';

export class PlayerManager {
  readonly slots: PlayerSlot[] = Array.from({ length: 5 }, (_, i) => new PlayerSlot(i));

  constructor() {
    const p1 = this.slots[0]!;
    p1.active = true;
    p1.aimSource = 'pointer';
  }

  active(): PlayerSlot[] {
    return this.slots.filter((s) => s.active);
  }

  slot(index: number): PlayerSlot | undefined {
    return this.slots[index];
  }

  slotByGamepad(gamepadIndex: number): PlayerSlot | undefined {
    return this.slots.find((s) => s.active && s.gamepadIndex === gamepadIndex);
  }

  freePlayerSlot(): number | null {
    for (let i = 1; i < this.slots.length; i++) {
      if (!this.slots[i]!.active) return i;
    }
    return null;
  }

  joinGamepad(gamepadIndex: number): PlayerSlot | null {
    const existing = this.slotByGamepad(gamepadIndex);
    if (existing) return existing;

    const slotIndex = this.freePlayerSlot();
    if (slotIndex === null) return null;

    const slot = this.slots[slotIndex]!;
    slot.active = true;
    slot.aimSource = 'gamepad';
    slot.gamepadIndex = gamepadIndex;
    slot.crosshairX = DESIGN.width / 2 + slotIndex * 40;
    slot.crosshairY = DESIGN.height / 2;
    slot.lockProgressMs = 0;
    slot.lockTarget = null;
    slot.rocketsInFlight = 0;
    slot.syncCrosshairPosition();
    slot.crosshair.visible = true;
    slot.setTurretsVisible(true);
    return slot;
  }

  leave(slotIndex: number): void {
    if (slotIndex === 0) return;
    const slot = this.slots[slotIndex];
    if (!slot?.active) return;
    slot.active = false;
    slot.gamepadIndex = -1;
    slot.fireLeft = false;
    slot.fireRight = false;
    slot.autoFireCooldownLeft = 0;
    slot.autoFireCooldownRight = 0;
    slot.lockTarget = null;
    slot.lockProgressMs = 0;
    slot.crosshair.visible = false;
    slot.setTurretsVisible(false);
  }

  redistributeCaps(maxRockets: number): void {
    const active = this.active();
    const caps = distributeRocketCaps(maxRockets, active.length);
    for (let i = 0; i < active.length; i++) {
      active[i]!.rocketCap = caps[i] ?? 0;
    }
  }
}
