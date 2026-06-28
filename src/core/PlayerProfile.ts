const STORAGE_KEY = 'antiwar2_nick';
export const MAX_NICK_LENGTH = 32;

const NICK_INVALID_CHARS = /[\x00-\x1f=]/g;

function randomNick(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `Player${n}`;
}

export function sanitizeNick(raw: string): string {
  return raw.replace(NICK_INVALID_CHARS, '').trim().slice(0, MAX_NICK_LENGTH);
}

export class PlayerProfile {
  private nick: string;
  private listeners = new Set<(nick: string) => void>();

  constructor() {
    this.nick = this.load();
  }

  getNick(): string {
    return this.nick;
  }

  setNick(raw: string): boolean {
    const nick = sanitizeNick(raw);
    if (nick === '') return false;
    if (nick === this.nick) return true;
    this.nick = nick;
    this.save();
    this.notify();
    return true;
  }

  subscribe(listener: (nick: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Called after a full localStorage wipe — assigns a fresh random nick. */
  afterStorageClear(): void {
    this.nick = randomNick();
    this.save();
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.nick);
  }

  private load(): string {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return sanitizeNick(raw) || randomNick();
    } catch {
      // private browsing
    }
    const nick = randomNick();
    this.saveNick(nick);
    return nick;
  }

  private save(): void {
    this.saveNick(this.nick);
  }

  private saveNick(nick: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, nick);
    } catch {
      // ignore quota / private browsing
    }
  }
}

export const playerProfile = new PlayerProfile();
