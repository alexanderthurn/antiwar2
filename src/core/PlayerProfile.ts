const STORAGE_KEY = 'antiwar2_nick';

function randomNick(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `Player${n}`;
}

export class PlayerProfile {
  private nick: string;

  constructor() {
    this.nick = this.load();
  }

  getNick(): string {
    return this.nick;
  }

  /** Called after a full localStorage wipe — assigns a fresh random nick. */
  afterStorageClear(): void {
    this.nick = randomNick();
    this.save();
  }

  private load(): string {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return raw;
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
