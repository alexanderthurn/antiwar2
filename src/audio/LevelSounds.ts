import { playMusic, playSound, setLevelMusicVolume, sfxPath, syncMusicFromSettings } from './SoundManager';

export interface LevelSoundsConfig {
  explosion: string[];
  scream: string[];
  dieScream: string;
  shoot: string;
  anthrax: string;
  newRound: string;
  winner: string;
  win: string;
  music: string;
  /** Level multiplier on top of the user music volume (v1 MUSIC_VOLUME / CHANGE_VOLUME). */
  musicVolume?: number;
  pay: string;
  noMoney: string;
  gameOver: string;
}

export const DEFAULT_LEVEL_SOUNDS: LevelSoundsConfig = {
  explosion: ['explosion1.ogg', 'explosion2.ogg', 'explosion4.ogg', 'explosion3.ogg'],
  scream: ['scream1.ogg', 'scream2.ogg', 'scream3.ogg', 'scream4.ogg'],
  dieScream: 'scream1.ogg',
  shoot: 'shoot.ogg',
  anthrax: 'anthrax.ogg',
  newRound: 'gong.ogg',
  winner: 'winner.ogg',
  win: 'win.ogg',
  music: 'game.ogg',
  musicVolume: 1,
  pay: 'pay.ogg',
  noMoney: 'nomoney.ogg',
  gameOver: 'error.ogg',
};

export function resolveLevelSounds(partial?: Partial<LevelSoundsConfig>): LevelSoundsConfig {
  return {
    ...DEFAULT_LEVEL_SOUNDS,
    ...partial,
    explosion: partial?.explosion?.length ? partial.explosion : DEFAULT_LEVEL_SOUNDS.explosion,
    scream: partial?.scream?.length ? partial.scream : DEFAULT_LEVEL_SOUNDS.scream,
  };
}

function typeSoundIndex(explosionType: number): number {
  return Math.max(1, Math.min(4, explosionType || 1));
}

function explosionForType(explosionType: number, sounds: LevelSoundsConfig): string {
  const idx = typeSoundIndex(explosionType) - 1;
  return sounds.explosion[idx] ?? `explosion${typeSoundIndex(explosionType)}.ogg`;
}

function screamForType(explosionType: number, sounds: LevelSoundsConfig): string {
  const idx = typeSoundIndex(explosionType) - 1;
  return sounds.scream[idx] ?? `scream${typeSoundIndex(explosionType)}.ogg`;
}

export class LevelAudio {
  private sounds: LevelSoundsConfig;
  private musicTrack = '';

  constructor(initial?: Partial<LevelSoundsConfig>) {
    this.sounds = resolveLevelSounds(initial);
  }

  /** Apply sticky round audio (music track, level volume, SFX bank). */
  applyRound(sounds: LevelSoundsConfig, musicVolume = 1): void {
    const musicChanged = this.sounds.music !== sounds.music;
    this.sounds = sounds;
    setLevelMusicVolume(musicVolume);
    if (musicChanged || !this.musicTrack) {
      this.playMusic();
      return;
    }
    syncMusicFromSettings();
  }

  playMusic(): void {
    this.musicTrack = this.sounds.music;
    playMusic(sfxPath(this.sounds.music));
  }

  playShoot(): void {
    playSound(sfxPath(this.sounds.shoot), 0.65);
  }

  playExplosion(explosionType: number): void {
    if (explosionType <= 0) return;
    playSound(sfxPath(explosionForType(explosionType, this.sounds)), 0.75);
  }

  playCivilianHit(explosionType = 1): void {
    playSound(sfxPath(screamForType(explosionType, this.sounds)), 0.7);
  }

  playCivilianDeath(explosionType = 1): void {
    playSound(sfxPath(screamForType(explosionType, this.sounds)), 0.75);
  }

  playNewRound(): void {
    playSound(sfxPath(this.sounds.newRound), 0.7);
  }

  playRoundWin(winSound?: string): void {
    playSound(sfxPath(winSound ?? this.sounds.winner), 0.75);
  }

  playLevelWin(): void {
    playSound(sfxPath(this.sounds.win), 0.75);
  }

  playPay(): void {
    playSound(sfxPath(this.sounds.pay), 0.65);
  }

  playNoMoney(): void {
    playSound(sfxPath(this.sounds.noMoney), 0.65);
  }

  playGameOver(): void {
    playSound(sfxPath(this.sounds.gameOver), 0.7);
  }

  /** Play a one-shot from a level-relative sfx path (e.g. `boss/overlordsc.ogg`). */
  playNamed(relative: string, volume = 0.7): void {
    playSound(sfxPath(relative), volume);
  }
}

export function createLevelAudio(partial?: Partial<LevelSoundsConfig>): LevelAudio {
  return new LevelAudio(resolveLevelSounds(partial));
}
