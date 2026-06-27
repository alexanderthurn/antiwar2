import type { LevelSoundsConfig } from '../audio/LevelSounds';
import { resolveLevelSounds } from '../audio/LevelSounds';
import type { LevelPack, StoryLimits } from './types';

const DEFAULT_BACKGROUND = 'assets/gfx/backgrounds/mangoo.jpg';
const DEFAULT_GROUND = 'assets/gfx/backgrounds/ground.png';

export interface RoundVisuals {
  background: string;
  ground: string;
}

export interface ResolvedRoundAudio {
  sounds: LevelSoundsConfig;
  musicVolume: number;
}

function stickyRoundLimit(pack: LevelPack, roundIndex: number): number {
  return Math.min(roundIndex, pack.rounds.length - 1);
}

/** v1-style sticky resolution: round overrides apply for that round and all later rounds. */
export function resolveRoundVisuals(pack: LevelPack, roundIndex: number): RoundVisuals {
  let background = pack.config.assets.background ?? DEFAULT_BACKGROUND;
  let ground = pack.config.assets.ground ?? DEFAULT_GROUND;

  for (let i = 0; i <= stickyRoundLimit(pack, roundIndex); i++) {
    const round = pack.rounds[i]!;
    if (round.background !== undefined) background = round.background;
    if (round.ground !== undefined) ground = round.ground;
  }

  return { background, ground };
}

/** Sticky music / SFX bank overrides (v1 CHANGE_MUSIC, CHANGE_VOLUME, per-round sound sets). */
export function resolveRoundAudio(pack: LevelPack, roundIndex: number): ResolvedRoundAudio {
  let partial: Partial<LevelSoundsConfig> = { ...pack.config.sounds };
  let musicVolume = partial.musicVolume ?? 1;

  for (let i = 0; i <= stickyRoundLimit(pack, roundIndex); i++) {
    const round = pack.rounds[i]!;
    if (round.sounds) partial = { ...partial, ...round.sounds };
    if (round.music !== undefined) partial = { ...partial, music: round.music };
    if (round.musicVolume !== undefined) musicVolume = round.musicVolume;
  }

  return {
    sounds: resolveLevelSounds(partial),
    musicVolume,
  };
}

function mergeStoryLimits(base: StoryLimits | undefined, patch: Partial<StoryLimits> | undefined): StoryLimits {
  const out: StoryLimits = { ...base };
  if (!patch) return out;
  for (const [key, value] of Object.entries(patch) as [keyof StoryLimits, number | undefined][]) {
    if (value !== undefined && value >= 0) out[key] = value;
  }
  return out;
}

function isActiveLimit(value: number | undefined): value is number {
  return value !== undefined && value >= 0;
}

/** Sticky story limits (v1 STORY_MAX_* in levels.txt / config). */
export function resolveStoryLimits(pack: LevelPack, roundIndex: number): StoryLimits {
  let limits = mergeStoryLimits(undefined, pack.config.storyLimits);

  for (let i = 0; i <= stickyRoundLimit(pack, roundIndex); i++) {
    const round = pack.rounds[i]!;
    if (round.storyLimits) limits = mergeStoryLimits(limits, round.storyLimits);
  }

  return limits;
}

export function hasActiveStoryLimits(limits: StoryLimits): boolean {
  return (
    isActiveLimit(limits.maxTime)
    || isActiveLimit(limits.maxRoundTime)
    || isActiveLimit(limits.maxRockets)
    || isActiveLimit(limits.maxRoundRockets)
    || isActiveLimit(limits.maxHumanDeaths)
    || isActiveLimit(limits.minMoney)
  );
}
