/** Deterministic PRNG for gameplay simulation (mulberry32). */
export class SimRng {
  private state: number;

  constructor(seed: number) {
    this.state = (seed >>> 0) || 1;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

let active: SimRng | null = null;

export function resetSimRng(seed: number): SimRng {
  active = new SimRng(seed);
  return active;
}

export function simRng(): SimRng {
  if (!active) active = new SimRng((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
  return active;
}

export function newReplaySeed(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0]! >>> 0 || 1;
  }
  return ((Date.now() * 2654435761) >>> 0) || 1;
}
