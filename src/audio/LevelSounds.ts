import { playMusic, playSound, sfxPath } from './SoundManager';

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
  pay: string;
  noMoney: string;
  gameOver: string;
}

export const DEFAULT_LEVEL_SOUNDS: LevelSoundsConfig = {
  explosion: ['explosion2.ogg', 'explosion3.ogg'],
  scream: ['bloodscream.ogg'],
  dieScream: 'bloodscream.ogg',
  shoot: 'shoot.ogg',
  anthrax: 'anthrax.ogg',
  newRound: 'gong.ogg',
  winner: 'winner.ogg',
  win: 'win.ogg',
  music: 'game.ogg',
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

function pickRandom(paths: string[]): string {
  return paths[Math.floor(Math.random() * paths.length)]!;
}

export class LevelAudio {
  constructor(private readonly sounds: LevelSoundsConfig) {}

  playMusic(): void {
    playMusic(sfxPath(this.sounds.music));
  }

  playShoot(): void {
    playSound(sfxPath(this.sounds.shoot), 0.65);
  }

  playExplosion(explosionType: number): void {
    const file = explosionType === 2 ? this.sounds.anthrax : pickRandom(this.sounds.explosion);
    playSound(sfxPath(file), 0.75);
  }

  playCivilianHit(): void {
    playSound(sfxPath(pickRandom(this.sounds.scream)), 0.7);
  }

  playCivilianDeath(): void {
    playSound(sfxPath(this.sounds.dieScream), 0.75);
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
