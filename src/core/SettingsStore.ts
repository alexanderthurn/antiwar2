export type ParticleQuality = 'low' | 'normal' | 'high';

export interface GameSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  soundVolume: number;
  musicVolume: number;
  particleQuality: ParticleQuality;
}

const STORAGE_KEY = 'antiwar2_settings';

const DEFAULTS: GameSettings = {
  soundEnabled: true,
  musicEnabled: true,
  soundVolume: 0.7,
  musicVolume: 0.5,
  particleQuality: 'normal',
};

const PARTICLE_ORDER: ParticleQuality[] = ['low', 'normal', 'high'];

type Listener = (settings: GameSettings) => void;

export class SettingsStore {
  private settings: GameSettings;
  private readonly listeners = new Set<Listener>();

  constructor() {
    this.settings = this.load();
  }

  get(): Readonly<GameSettings> {
    return this.settings;
  }

  set(patch: Partial<GameSettings>): void {
    this.settings = { ...this.settings, ...patch };
    this.save();
    this.notify();
  }

  cycleParticleQuality(): void {
    const idx = PARTICLE_ORDER.indexOf(this.settings.particleQuality);
    const next = PARTICLE_ORDER[(idx + 1) % PARTICLE_ORDER.length]!;
    this.set({ particleQuality: next });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.settings);
    }
  }

  private load(): GameSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed = JSON.parse(raw) as Partial<GameSettings>;
      return { ...DEFAULTS, ...parsed };
    } catch {
      return { ...DEFAULTS };
    }
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
  }
}

export const settingsStore = new SettingsStore();
