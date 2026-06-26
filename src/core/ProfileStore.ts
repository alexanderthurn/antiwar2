const STORAGE_KEY = 'antiwar2_profile';

export interface PlayerProfile {
  hardcoreEnabled: boolean;
}

const DEFAULTS: PlayerProfile = {
  hardcoreEnabled: false,
};

type Listener = (profile: PlayerProfile) => void;

export class ProfileStore {
  private profile: PlayerProfile = { ...DEFAULTS };
  private readonly listeners = new Set<Listener>();

  constructor() {
    this.load();
  }

  get(): Readonly<PlayerProfile> {
    return this.profile;
  }

  set(patch: Partial<PlayerProfile>): void {
    this.profile = { ...this.profile, ...patch };
    this.save();
    this.notify();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.profile);
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
      this.profile = { ...DEFAULTS, ...parsed };
    } catch {
      // ignore
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
    } catch {
      // ignore
    }
  }
}

export const profileStore = new ProfileStore();

/** Enemy plane / bomb speed multiplier (hardcore = 2×). */
export function combatSpeedMultiplier(): number {
  return profileStore.get().hardcoreEnabled ? 2 : 1;
}
