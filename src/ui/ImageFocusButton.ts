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
  /** When false, pointertap does not fire onPress (menu confirm handles activation). */
  pointerActivates?: boolean;
}

/** Uniform scale so overlay sprites keep their native size relative to the base plate. */
export function plateIconScale(baseTex: Texture, displayW: number): number {
  return displayW / baseTex.width;
}

/** Sprite button with optional base plate; scales on menu focus and pointer hover. */
export function createImageFocusButton(
  opts: ImageFocusButtonOptions,
): { view: Container; action: UiAction; icon: Sprite; iconScale: number; setHovered: (hovered: boolean) => void } {
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

  let menuFocused = false;
  let pointerHovered = false;

  const applyVisual = () => {
    if (gfx.destroyed) return;
    const active = menuFocused || pointerHovered;
    gfx.scale.set(active ? FOCUS_SCALE : 1);
    gfx.position.set(
      active ? plateW * (1 - FOCUS_SCALE) * 0.5 : 0,
      active ? plateH * (1 - FOCUS_SCALE) * 0.5 : 0,
    );
  };

  const setFocused = (focused: boolean) => {
    menuFocused = focused;
    applyVisual();
  };

  const setHovered = (hovered: boolean) => {
    pointerHovered = hovered;
    applyVisual();
  };

  const activate = () => {
    if (opts.enabled?.() === false) return;
    playMenuClick();
    opts.onPress();
  };

  view.on('pointerover', () => setHovered(true));
  view.on('pointerout', () => setHovered(false));
  if (opts.pointerActivates !== false) {
    view.on('pointertap', activate);
  }

  const action: UiAction = {
    id: opts.id,
    bounds: uiBounds(view, plateW, plateH),
    activate,
    setFocused,
    enabled: opts.enabled,
  };

  return { view, action, icon, iconScale: iconUniformScale, setHovered };
}

/** Keep overlay at native ratio when swapping textures (e.g. locked icon). */
export function setPlateIconTexture(icon: Sprite, texture: Texture, iconScale: number): void {
  icon.texture = texture;
  icon.scale.set(iconScale);
}
