import { Container, type BitmapText } from 'pixi.js';
import type { UiAction, UiBounds } from './UiMenuController';
import { MENU_POINTER_CURSOR } from '../ui/MenuPointer';
import { playMenuClick } from '../audio/UiSounds';
import { kewlLineHeight, kewlText } from '../ui/KewlFont';

const HIT_PAD_X = 14;
const HIT_PAD_Y = 10;
const FOCUS_SCALE = 1.06;

export function uiBounds(container: Container, w: number, h: number): () => UiBounds | null {
  return () => {
    if (container.destroyed) return null;
    let x = container.x;
    let y = container.y;
    let node: Container | null = container.parent;
    while (node?.parent?.parent) {
      x += node.x;
      y += node.y;
      node = node.parent;
    }
    return { x, y, w, h };
  };
}

function textHitBounds(btn: Container, text: BitmapText): () => UiBounds | null {
  return () => {
    if (btn.destroyed || text.destroyed) return null;
    const local = text.getLocalBounds();
    let x = btn.x + local.x - HIT_PAD_X;
    let y = btn.y + local.y - HIT_PAD_Y;
    let node: Container | null = btn.parent;
    while (node?.parent?.parent) {
      x += node.x;
      y += node.y;
      node = node.parent;
    }
    return {
      x,
      y,
      w: local.width + HIT_PAD_X * 2,
      h: local.height + HIT_PAD_Y * 2,
    };
  };
}

export interface FocusableButtonOptions {
  label: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  id: string;
  onPress: () => void;
  fontSize?: number;
  enabled?: () => boolean;
  /** When true, anchor label at horizontal center of w (default: left-aligned). */
  center?: boolean;
  /** When false, the caller plays menu click after changing state (e.g. settings toggles). */
  playClick?: boolean;
}

/** Text-only menu button for pointer tap and unified menu focus. */
export function createFocusableButton(opts: FocusableButtonOptions): { view: Container; action: UiAction } {
  const btn = new Container();
  btn.position.set(opts.x, opts.y);
  btn.eventMode = 'static';
  btn.cursor = MENU_POINTER_CURSOR;

  const fontSize = opts.fontSize ?? 24;
  const text = kewlText({ text: opts.label, size: fontSize });
  const lineH = kewlLineHeight(fontSize);

  if (opts.center && opts.w) {
    text.anchor.set(0.5, 0);
    text.position.set(opts.w / 2, 0);
  } else {
    text.anchor.set(0, 0);
    text.position.set(0, 0);
  }
  btn.addChild(text);

  const hitW = opts.w ?? text.width + HIT_PAD_X * 2;
  const hitH = opts.h ?? lineH + HIT_PAD_Y;

  const setFocused = (focused: boolean) => {
    if (text.destroyed) return;
    const s = focused ? FOCUS_SCALE : 1;
    text.scale.set(s);
    if (opts.center && opts.w) {
      text.position.set(opts.w / 2, 0);
    }
  };

  const activate = () => {
    if (opts.enabled?.() === false) return;
    if (opts.playClick !== false) playMenuClick();
    opts.onPress();
  };

  btn.on('pointertap', activate);

  const action: UiAction = {
    id: opts.id,
    bounds: opts.w || opts.h ? uiBounds(btn, hitW, hitH) : textHitBounds(btn, text),
    activate,
    setFocused,
    enabled: opts.enabled,
  };

  return { view: btn, action };
}
