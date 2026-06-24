import { settingsStore } from '../core/SettingsStore';
import { publicUrl } from '../core/PublicPath';

/** Master switch — individual sound/music still respect settings toggles. */
export const AUDIO_ENABLED = true;

const cache = new Map<string, HTMLAudioElement>();
let music: HTMLAudioElement | null = null;
let musicPath: string | null = null;

function resolvePath(path: string): string {
  return publicUrl(path);
}

function sfxVolume(requested: number): number {
  const s = settingsStore.get();
  if (!s.soundEnabled) return 0;
  return requested * s.soundVolume;
}

function musicVolume(): number {
  const s = settingsStore.get();
  if (!s.musicEnabled) return 0;
  return s.musicVolume;
}

/** Play a one-shot sound from assets/sfx (or any public path). */
export function playSound(path: string, volume = 0.7): void {
  if (!AUDIO_ENABLED) return;
  const vol = sfxVolume(volume);
  if (vol <= 0) return;
  const src = resolvePath(path);
  let base = cache.get(src);
  if (!base) {
    base = new Audio(src);
    cache.set(src, base);
  }
  const audio = base.cloneNode() as HTMLAudioElement;
  audio.volume = vol;
  void audio.play().catch(() => {});
}

export function playMusic(path: string): void {
  if (!AUDIO_ENABLED) return;
  const src = resolvePath(path);
  const vol = musicVolume();
  if (vol <= 0) {
    stopMusic();
    return;
  }
  if (music && musicPath === src && !music.paused) {
    music.volume = vol;
    return;
  }
  stopMusic();
  musicPath = src;
  music = new Audio(src);
  music.loop = true;
  music.volume = vol;
  void music.play().catch(() => {});
}

export function stopMusic(): void {
  if (!music) return;
  music.pause();
  music.currentTime = 0;
  music = null;
  musicPath = null;
}

export function syncMusicFromSettings(): void {
  if (!music) return;
  const vol = musicVolume();
  if (vol <= 0) {
    stopMusic();
    return;
  }
  music.volume = vol;
  if (music.paused) void music.play().catch(() => {});
}

export function sfxPath(relative: string): string {
  return relative.startsWith('assets/') ? relative : `assets/sfx/${relative}`;
}

settingsStore.subscribe(() => syncMusicFromSettings());
