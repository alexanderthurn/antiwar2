import { playMusic, playSound, sfxPath } from './SoundManager';

const MENU_ACTIVATE_VOLUME = 0.5;
const MENU_HOVER_VOLUME = 0.12;

/** Menu item activated (tap, click, confirm). */
export function playMenuClick(): void {
  playSound(sfxPath('menu_changemenu.ogg'), MENU_ACTIVATE_VOLUME);
}

/** Menu focus moved (keyboard, gamepad, pointer hover). */
export function playMenuChange(): void {
  playSound(sfxPath('menu_changemenu.ogg'), MENU_HOVER_VOLUME);
}

export function playMenuMusic(): void {
  playMusic(sfxPath('menu.ogg'));
}
