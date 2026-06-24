import { playMusic, playSound, sfxPath } from './SoundManager';

export function playMenuClick(): void {
  playSound(sfxPath('menu_click.ogg'), 0.5);
}

export function playMenuChange(): void {
  playSound(sfxPath('menu_change.ogg'), 0.4);
}

export function playMenuMusic(): void {
  playMusic(sfxPath('menu.ogg'));
}
