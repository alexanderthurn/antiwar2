import { getClientId } from './clientId';
import type {
  HighscoreProvider,
  LeaderboardEntry,
  PlayerScoreEntry,
  PrepareResult,
  ScoreSubmit,
  SubmitResult,
} from './types';
import { encodeXorPayload } from './xorCodec';

function apiBase(): string | null {
  const raw = import.meta.env.VITE_HIGHSCORE_URL as string | undefined;
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

export class HttpHighscoreProvider implements HighscoreProvider {
  readonly id = 'http';

  private readonly base: string;

  constructor(base?: string) {
    const resolved = base ?? apiBase();
    if (!resolved) throw new Error('VITE_HIGHSCORE_URL is not set');
    this.base = resolved;
  }

  async prepare(boardId: string): Promise<PrepareResult | null> {
    const clientId = getClientId();
    const url = `${this.base}/prepare.php?boardId=${encodeURIComponent(boardId)}&clientId=${encodeURIComponent(clientId)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return null;
      const data = (await res.json()) as PrepareResult;
      if (!data.checksum) return null;
      return data;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  async submit(payload: ScoreSubmit): Promise<SubmitResult> {
    const clientId = getClientId();
    const hex = encodeXorPayload({
      checksum: payload.checksum,
      board_id: payload.boardId,
      time_ms: Math.floor(payload.time),
      nick: payload.nick,
      score: Math.floor(payload.score),
      date: Math.floor(payload.date / 1000),
      version: Math.floor(payload.version),
    });

    const body = new FormData();
    body.set('payload', hex);
    body.set('clientId', clientId);
    if (payload.replay && payload.replay.byteLength > 0) {
      body.set('replay', new Blob([payload.replay as BlobPart]), 'replay.awr');
    }

    try {
      const res = await fetch(`${this.base}/submit.php`, { method: 'POST', body });
      const data = (await res.json()) as SubmitResult & { error?: string };
      if (!res.ok) {
        return { accepted: false, reason: data.error ?? data.reason ?? `http_${res.status}` };
      }
      return { accepted: true, id: data.id, rank: data.rank };
    } catch {
      return { accepted: false, reason: 'network_error' };
    }
  }

  async fetchReplay(scoreId: number): Promise<Uint8Array | null> {
    const url = `${this.base}/replay.php?id=${encodeURIComponent(String(scoreId))}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  async fetchScoreMeta(scoreId: number): Promise<{
    id: number;
    boardId: string;
    nick: string;
    time: number;
    score: number;
    hasReplay: boolean;
  } | null> {
    const url = `${this.base}/score.php?id=${encodeURIComponent(String(scoreId))}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return (await res.json()) as {
        id: number;
        boardId: string;
        nick: string;
        time: number;
        score: number;
        hasReplay: boolean;
      };
    } catch {
      return null;
    }
  }

  async fetchTop(
    boardId: string,
    opts?: { limit?: number; distinct?: boolean },
  ): Promise<LeaderboardEntry[]> {
    const limit = opts?.limit ?? 25;
    const distinct = opts?.distinct !== false ? '1' : '0';
    const url = `${this.base}/leaderboard.php?boardId=${encodeURIComponent(boardId)}&limit=${limit}&distinct=${distinct}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = (await res.json()) as { entries?: LeaderboardEntry[] };
      return data.entries ?? [];
    } catch {
      return [];
    }
  }

  async fetchPlayerScores(nick: string): Promise<PlayerScoreEntry[]> {
    const url = `${this.base}/player_scores.php?nick=${encodeURIComponent(nick)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return [];
      const data = (await res.json()) as { entries?: PlayerScoreEntry[] };
      return data.entries ?? [];
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createHttpProvider(): HttpHighscoreProvider | null {
  const base = apiBase();
  if (!base) return null;
  return new HttpHighscoreProvider(base);
}
