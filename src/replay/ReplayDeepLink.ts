import { ReplayDriver } from './ReplayDriver';

export type ReplayUrlPlayback = {
  scoreId: number;
  speed: number;
  playing: boolean;
};

function parsePlaying(raw: string | null): boolean | null {
  if (raw === null) return null;
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return null;
}

function nearestReplaySpeed(value: number): (typeof ReplayDriver.SPEEDS)[number] {
  const speeds = ReplayDriver.SPEEDS;
  let best: (typeof speeds)[number] = speeds[0]!;
  let bestDist = Math.abs(value - best);
  for (const speed of speeds) {
    const dist = Math.abs(value - speed);
    if (dist < bestDist) {
      best = speed;
      bestDist = dist;
    }
  }
  return best;
}

function parseSpeed(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return null;
  return nearestReplaySpeed(n);
}

/** Parse `?replay=123&speed=16&playing=1` for direct replay playback. */
export function parseReplayUrl(): number | null {
  return parseReplayUrlPlayback()?.scoreId ?? null;
}

export function parseReplayUrlPlayback(): ReplayUrlPlayback | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('replay');
  if (!raw) return null;
  const scoreId = Number.parseInt(raw, 10);
  if (!Number.isFinite(scoreId) || scoreId <= 0) return null;
  return {
    scoreId,
    speed: parseSpeed(params.get('speed')) ?? 1,
    playing: parsePlaying(params.get('playing')) ?? true,
  };
}

export function syncReplayPlaybackUrl(scoreId: number, driver: ReplayDriver): void {
  const params = new URLSearchParams(window.location.search);
  params.set('replay', String(scoreId));
  params.set('speed', String(driver.getSpeed()));
  params.set('playing', driver.isPlaying() ? '1' : '0');
  const query = params.toString();
  window.history.replaceState(null, '', query ? `${window.location.pathname}?${query}` : window.location.pathname);
}

/** @deprecated Use syncReplayPlaybackUrl */
export function syncReplayUrl(scoreId: number): void {
  const params = new URLSearchParams(window.location.search);
  params.set('replay', String(scoreId));
  params.set('speed', '1');
  params.set('playing', '1');
  const query = params.toString();
  window.history.replaceState(null, '', query ? `${window.location.pathname}?${query}` : window.location.pathname);
}

export function clearReplayUrl(): void {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('replay') && !params.has('speed') && !params.has('playing')) return;
  params.delete('replay');
  params.delete('speed');
  params.delete('playing');
  const query = params.toString();
  window.history.replaceState(null, '', query ? `${window.location.pathname}?${query}` : window.location.pathname);
}
