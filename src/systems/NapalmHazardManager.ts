import { GROUND_SURFACE_Y } from '../core/DesignSpace';

export interface NapalmCivilianTarget {
  id: number;
  alive: boolean;
  x: number;
  feetY: number;
  halfWidth: number;
}

export interface NapalmDamageCallbacks {
  onCivilianBurnDamage: (civilianId: number, damage: number) => void;
}

interface NapalmZone {
  x: number;
  y: number;
  radius: number;
  life: number;
  damagePerTick: number;
  tickCooldown: number;
  airborne: boolean;
}

/** v1 lifetime 20 ≈ 1.2s ground burn; napalm lifetime 40 ≈ 2.4s. */
const GROUND_LIFE_PER_LIFETIME = 1.2 / 20;
const AIRBORNE_LIFE_S = 0.42;
const GROUND_TICK_S = 0.35;
const AIRBORNE_TICK_S = 0.1;
const RAIN_EXTINGUISH_RATE = 2.4;

export function napalmGroundLifeSec(lifetime: number): number {
  return Math.max(0.8, lifetime * GROUND_LIFE_PER_LIFETIME);
}

/** Lingering napalm pools and short mid-air fire bursts that damage civilians. */
export class NapalmHazardManager {
  private readonly zones: NapalmZone[] = [];

  clear(): void {
    this.zones.length = 0;
  }

  registerExplosion(
    x: number,
    y: number,
    radius: number,
    power: number,
    lifetime: number,
  ): void {
    const airborne = y < GROUND_SURFACE_Y - 20;

    if (airborne) {
      this.zones.push({
        x,
        y,
        radius: Math.max(28, radius * 0.75),
        life: AIRBORNE_LIFE_S,
        damagePerTick: Math.max(8, power * 0.1),
        tickCooldown: AIRBORNE_TICK_S * 0.5,
        airborne: true,
      });
    }

    this.zones.push({
      x,
      y: GROUND_SURFACE_Y,
      radius: Math.max(32, radius * 0.95),
      life: napalmGroundLifeSec(lifetime),
      damagePerTick: Math.max(12, power * 0.17),
      tickCooldown: GROUND_TICK_S * 0.5,
      airborne: false,
    });
  }

  update(
    dt: number,
    rainIntensity: number,
    civilians: NapalmCivilianTarget[],
    cb: NapalmDamageCallbacks,
  ): void {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const zone = this.zones[i]!;
      const rainFactor = zone.airborne ? 0 : rainIntensity * RAIN_EXTINGUISH_RATE;
      zone.life -= dt * (1 + rainFactor);
      if (zone.life <= 0) {
        this.zones.splice(i, 1);
        continue;
      }

      zone.tickCooldown -= dt;
      if (zone.tickCooldown > 0) continue;
      zone.tickCooldown = zone.airborne ? AIRBORNE_TICK_S : GROUND_TICK_S;

      for (const civilian of civilians) {
        if (!civilian.alive) continue;
        if (!this.civilianInZone(civilian, zone)) continue;
        cb.onCivilianBurnDamage(civilian.id, zone.damagePerTick);
      }
    }
  }

  private civilianInZone(civilian: NapalmCivilianTarget, zone: NapalmZone): boolean {
    const dx = civilian.x - zone.x;
    if (zone.airborne) {
      const dy = civilian.feetY - zone.y;
      const r = zone.radius;
      return dx * dx + dy * dy <= r * r;
    }
    return Math.abs(dx) <= zone.radius + civilian.halfWidth * 0.35;
  }
}
