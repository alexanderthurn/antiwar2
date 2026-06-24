import { Container, Sprite, type Texture } from 'pixi.js';
import type { UiAction } from '../input/UiMenuController';
import { MENU_POINTER_CURSOR } from './MenuPointer';
import { uiBounds } from '../input/FocusableButton';
import { playMenuClick } from '../audio/UiSounds';

const FOCUS_SCALE = 1.06;

export interface ImageFocusButtonOptions {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  icon: Texture;
  base?: Texture;
  /** Overlay scale is based on this plate width; defaults to `w` (use for 2× base + 1× icon). */
  iconPlateW?: number;
  onPress: () => void;
  enabled?: () => boolean;
}

/** Uniform scale so overlay sprites keep their native size relative to the base plate. */
export function plateIconScale(baseTex: Texture, displayW: number): number {
  return displayW / baseTex.width;
}

/** Sprite button with optional base plate; scales on menu focus. */
export function createImageFocusButton(
  opts: ImageFocusButtonOptions,
): { view: Container; action: UiAction; icon: Sprite; iconScale: number } {
  const view = new Container();
  view.position.set(opts.x, opts.y);
  view.eventMode = 'static';
  view.cursor = MENU_POINTER_CURSOR;

  const gfx = new Container();
  view.addChild(gfx);

  let plateW = opts.w;
  let plateH = opts.h;
  let iconUniformScale = Math.min(opts.w / opts.icon.width, opts.h / opts.icon.height);

  if (opts.base) {
    const base = new Sprite(opts.base);
    const plateScale = plateIconScale(opts.base, opts.w);
    base.scale.set(plateScale);
    plateW = opts.base.width * plateScale;
    plateH = opts.base.height * plateScale;
    iconUniformScale = plateIconScale(opts.base, opts.iconPlateW ?? opts.w);
    gfx.addChild(base);
  }

  const icon = new Sprite(opts.icon);
  icon.anchor.set(0.5);
  icon.position.set(plateW / 2, plateH / 2);
  icon.scale.set(iconUniformScale);
  gfx.addChild(icon);

  const setFocused = (focused: boolean) => {
    if (gfx.destroyed) return;
    gfx.scale.set(focused ? FOCUS_SCALE : 1);
    gfx.position.set(
      focused ? plateW * (1 - FOCUS_SCALE) * 0.5 : 0,
      focused ? plateH * (1 - FOCUS_SCALE) * 0.5 : 0,
    );
  };

  const activate = () => {
    if (opts.enabled?.() === false) return;
    playMenuClick();
    opts.onPress();
  };

  view.on('pointertap', activate);

  const action: UiAction = {
    id: opts.id,
    bounds: uiBounds(view, plateW, plateH),
    activate,
    setFocused,
    enabled: opts.enabled,
  };

  return { view, action, icon, iconScale: iconUniformScale };
}

/** Keep overlay at native ratio when swapping textures (e.g. locked icon). */
export function setPlateIconTexture(icon: Sprite, texture: Texture, iconScale: number): void {
  icon.texture = texture;
  icon.scale.set(iconScale);
}
