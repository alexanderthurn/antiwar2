import {
  GRAPHICS_ORDER,
  graphicsQualityFromLegacyParticle,
  type GraphicsQuality,
} from './GraphicsQuality';

export interface GameSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  soundVolume: number;
  musicVolume: number;
  graphicsQuality: GraphicsQuality;
}

const STORAGE_KEY = 'antiwar2_settings';

const DEFAULTS: GameSettings = {
  soundEnabled: true,
  musicEnabled: true,
  soundVolume: 0.7,
  musicVolume: 0.5,
  graphicsQuality: 'high',
};

type Listener = (settings: GameSettings) => void;

interface LegacyStoredSettings extends Partial<GameSettings> {
  particleQuality?: 'low' | 'normal' | 'high';
}

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

  cycleGraphicsQuality(): void {
    const idx = GRAPHICS_ORDER.indexOf(this.settings.graphicsQuality);
    const next = GRAPHICS_ORDER[(idx + 1) % GRAPHICS_ORDER.length]!;
    this.set({ graphicsQuality: next });
  }

  resetToDefaults(): void {
    this.settings = { ...DEFAULTS };
    this.save();
    this.notify();
  }

  reloadFromStorage(): void {
    this.settings = this.load();
    this.notify();
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
      const parsed = JSON.parse(raw) as LegacyStoredSettings;
      const graphicsQuality =
        parsed.graphicsQuality ??
        (parsed.particleQuality
          ? graphicsQualityFromLegacyParticle(parsed.particleQuality)
          : DEFAULTS.graphicsQuality);
      return { ...DEFAULTS, ...parsed, graphicsQuality };
    } catch {
      return { ...DEFAULTS };
    }
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
  }
}

export const settingsStore = new SettingsStore();
