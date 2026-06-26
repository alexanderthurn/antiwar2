import { settingsStore } from '../core/SettingsStore';
import { publicUrl } from '../core/PublicPath';

/** Master switch — individual sound/music still respect settings toggles. */
export const AUDIO_ENABLED = true;

const cache = new Map<string, HTMLAudioElement>();
let killStreakAudio: HTMLAudioElement | null = null;
let music: HTMLAudioElement | null = null;
/** Resolved URL of the track that should be playing for the current scene (kept while muted). */
let activeMusicSrc: string | null = null;
let musicElementSrc: string | null = null;
/** Per-level music gain (v1 MUSIC_VOLUME / CHANGE_VOLUME), multiplied with user setting. */
let levelMusicVolume = 1;

export function setLevelMusicVolume(volume: number): void {
  levelMusicVolume = Math.max(0, volume);
  applyMusicPlayback();
}

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
  return s.musicVolume * levelMusicVolume;
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

function stopKillStreakAudio(): void {
  if (!killStreakAudio) return;
  killStreakAudio.pause();
  killStreakAudio.currentTime = 0;
  killStreakAudio = null;
}

/** Play kill-streak VO — only one at a time; a new streak stops the previous clip. */
export function playKillStreakSound(path: string, volume = 0.7): void {
  if (!AUDIO_ENABLED) return;
  const vol = sfxVolume(volume);
  if (vol <= 0) return;
  stopKillStreakAudio();
  const src = resolvePath(path);
  let base = cache.get(src);
  if (!base) {
    base = new Audio(src);
    cache.set(src, base);
  }
  const audio = base.cloneNode() as HTMLAudioElement;
  audio.volume = vol;
  killStreakAudio = audio;
  audio.addEventListener('ended', () => {
    if (killStreakAudio === audio) killStreakAudio = null;
  }, { once: true });
  void audio.play().catch(() => {
    if (killStreakAudio === audio) killStreakAudio = null;
  });
}

export function playMusic(path: string): void {
  if (!AUDIO_ENABLED) return;
  activeMusicSrc = resolvePath(path);
  applyMusicPlayback();
}

export function stopMusic(): void {
  music?.pause();
  if (music) music.currentTime = 0;
  music = null;
  activeMusicSrc = null;
  musicElementSrc = null;
  levelMusicVolume = 1;
}

function applyMusicPlayback(): void {
  if (!activeMusicSrc) return;
  const vol = musicVolume();
  if (vol <= 0) {
    music?.pause();
    return;
  }
  if (music && musicElementSrc === activeMusicSrc) {
    music.volume = vol;
    if (music.paused) void music.play().catch(() => {});
    return;
  }
  music?.pause();
  music = new Audio(activeMusicSrc);
  musicElementSrc = activeMusicSrc;
  music.loop = true;
  music.volume = vol;
  void music.play().catch(() => {});
}

export function syncMusicFromSettings(): void {
  applyMusicPlayback();
}

export function sfxPath(relative: string): string {
  return relative.startsWith('assets/') ? relative : `assets/sfx/${relative}`;
}

settingsStore.subscribe(() => applyMusicPlayback());
