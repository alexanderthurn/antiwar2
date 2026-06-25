import { Sprite } from 'pixi.js';
import { DESIGN, PLAYER_COLORS } from '../core/DesignSpace';
import type { CombatEntity } from '../entities/CombatEntity';
import { PlayerStats } from './PlayerStats';

export type PlayerAimSource = 'pointer' | 'gamepad';

export class PlayerSlot {
  readonly index: number;
  active = false;
  /** How this player's crosshair is driven — game logic only reads crosshairX/Y. */
  aimSource: PlayerAimSource = 'pointer';
  gamepadIndex = -1;

  readonly crosshair = new Sprite();
  readonly leftBase = new Sprite();
  readonly rightBase = new Sprite();
  readonly leftCannon = new Sprite();
  readonly rightCannon = new Sprite();
  readonly stats = new PlayerStats();

  crosshairX = DESIGN.width / 2;
  crosshairY = DESIGN.height / 2;
  lockProgressMs = 0;
  lockTarget: CombatEntity | null = null;
  rocketsInFlight = 0;
  rocketCap = 0;
  autoFireCooldownLeft = 0;
  autoFireCooldownRight = 0;
  fireLeft = false;
  fireRight = false;

  constructor(index: number) {
    this.index = index;
  }

  color(): number {
    return PLAYER_COLORS[this.index] ?? PLAYER_COLORS[0]!;
  }

  label(): string {
    return `P${this.index + 1}`;
  }

  deviceLabel(): string {
    if (this.aimSource === 'pointer') return 'Pointer';
    return this.gamepadIndex >= 0 ? `Gamepad ${this.gamepadIndex + 1}` : 'Gamepad';
  }

  setAim(x: number, y: number): void {
    this.crosshairX = x;
    this.crosshairY = y;
    this.syncCrosshairPosition();
  }

  setFire(left: boolean, right: boolean): void {
    this.fireLeft = left;
    this.fireRight = right;
  }

  setCrosshairLockVisual(charging: boolean, locked: boolean, aimTimeMs: number): void {
    if (locked) {
      this.crosshair.tint = 0xff2222;
      this.crosshair.rotation = 0;
      return;
    }
    if (charging) {
      const progress = Math.min(1, this.lockProgressMs / Math.max(1, aimTimeMs));
      this.crosshair.tint = this.color();
      this.crosshair.rotation = progress * Math.PI;
      return;
    }
    this.crosshair.tint = this.color();
    this.crosshair.rotation = 0;
  }

  syncCrosshairPosition(): void {
    this.crosshair.position.set(this.crosshairX, this.crosshairY);
  }

  setTurretsVisible(visible: boolean): void {
    for (const s of [this.leftBase, this.rightBase, this.leftCannon, this.rightCannon]) {
      s.visible = visible;
    }
  }
}
