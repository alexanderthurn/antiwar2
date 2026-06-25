import type { Container } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import { pollGamepads } from '../multiplayer/GamepadInput';

const CENTER_X = DESIGN.width / 2;
const CENTER_Y = DESIGN.height / 2;

/** Map explosion radius (design px) to rumble intensity 0–1. */
export function explosionRadiusToIntensity(radius: number): number {
  return Math.min(1, Math.max(0.15, (radius - 30) / 170));
}

export interface RumbleTriggerOptions {
  /** Bypass per-round rumble mode (cheat / test). */
  force?: boolean;
  /** Plane-only gate for round `rumble: 1`. */
  planeOnly?: boolean;
  /** Round rumble mode: 0=off, 1=planes, 2=all. */
  roundMode?: number;
}

function pulseGamepadRumble(intensity: number, durationMs: number): void {
  const mag = Math.min(1, Math.max(0, intensity));
  const duration = Math.max(16, Math.round(durationMs));

  for (const snap of pollGamepads()) {
    const pad = navigator.getGamepads?.()[snap.index];
    const actuator = pad?.vibrationActuator;
    if (!actuator) continue;
    void actuator
      .playEffect('dual-rumble', {
        startDelay: 0,
        duration,
        weakMagnitude: mag * 0.45,
        strongMagnitude: mag,
      })
      .catch(() => {
        /* unsupported or blocked */
      });
  }
}

function pulseNavigatorVibrate(intensity: number, durationMs: number): void {
  if (typeof navigator.vibrate !== 'function') return;
  const ms = Math.max(16, Math.round(durationMs));
  const mag = Math.min(1, Math.max(0, intensity));
  if (mag <= 0) return;

  if (mag > 0.65) {
    navigator.vibrate([Math.round(ms * 0.55), 40, Math.round(ms * 0.45)]);
    return;
  }
  navigator.vibrate(ms);
}

/**
 * Screen shake (offset + slight zoom from playfield center) plus gamepad / device haptics.
 */
export class RumbleController {
  private timer = 0;
  private duration = 0.2;
  private peakIntensity = 0;

  constructor(private readonly target: Container) {
    target.pivot.set(CENTER_X, CENTER_Y);
    this.reset();
  }

  reset(): void {
    this.timer = 0;
    this.peakIntensity = 0;
    this.target.position.set(CENTER_X, CENTER_Y);
    this.target.scale.set(1);
  }

  trigger(
    intensity: number,
    duration = 0.2,
    opts: RumbleTriggerOptions = {},
  ): void {
    const roundMode = opts.roundMode ?? 0;
    if (!opts.force) {
      if (roundMode === 0) return;
      if (opts.planeOnly && roundMode < 1) return;
    }

    const peak = Math.min(1, Math.max(0, intensity));
    if (peak <= 0) return;

    this.peakIntensity = Math.max(this.peakIntensity, peak);
    this.duration = Math.max(0.08, duration);
    this.timer = Math.max(this.timer, this.duration);

    const durationMs = this.duration * 1000;
    pulseGamepadRumble(peak, durationMs);
    pulseNavigatorVibrate(peak, durationMs);
  }

  update(dt: number): void {
    if (this.timer <= 0) {
      if (this.peakIntensity > 0) this.reset();
      return;
    }

    this.timer -= dt;
    const life = Math.max(0, this.timer / this.duration);

    const maxPx = 6 + this.peakIntensity * 26;
    const maxScale = 0.008 + this.peakIntensity * 0.055;

    const ox = (Math.random() - 0.5) * 2 * maxPx * life;
    const oy = (Math.random() - 0.5) * 2 * maxPx * life;
    const scale = 1 + maxScale * life;

    this.target.position.set(CENTER_X + ox, CENTER_Y + oy);
    this.target.scale.set(scale);

    if (this.timer <= 0) this.reset();
  }
}
