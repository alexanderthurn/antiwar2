import { BitmapFont, Cache, type BitmapFontData, BitmapText } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import { loadTexture } from '../data/AssetLoader';

export const KEWL_FONT_FAMILY = 'KewlFont';
/** Shared vertical position for screen titles (Shop, Paused, main menu, etc.). */
export const UI_TITLE_Y = Math.round(DESIGN.height * 0.1);
export const UI_TITLE_MAIN_MENU_Y = Math.round(DESIGN.height * 0.05);
/** Multiplier applied to all kewlText size values (design-space px). */
export const KEWL_FONT_DISPLAY_SCALE = 2;
/** Extra space between lines in multi-line labels (HUD, credits, etc.). */
export const KEWL_LINE_HEIGHT_FACTOR = 1.45;
/** Slight extra gap between characters for readability at 2x scale. */
export const KEWL_LETTER_SPACING_FACTOR = 0.06;

const COLS = 16;
const ROW_OFFSET = 2;
const CELL = 64;
const X_ADVANCE = 40;
const X_OFFSET = 8;

let ready: Promise<void> | null = null;

function buildFontData(): BitmapFontData {
  const chars: BitmapFontData['chars'] = {};
  for (let code = 32; code <= 126; code++) {
    const i = code - 32;
    const gridRow = Math.floor(i / COLS) + ROW_OFFSET;
    const gridCol = i % COLS;
    const letter = String.fromCharCode(code);
    chars[letter] = {
      id: code,
      page: 0,
      x: gridCol * CELL,
      y: gridRow * CELL,
      width: CELL,
      height: CELL,
      xOffset: X_OFFSET,
      yOffset: 0,
      xAdvance: X_ADVANCE,
      kerning: {},
      letter,
    };
  }
  return {
    chars,
    pages: [{ id: 0, file: 'kewlfont.png' }],
    fontSize: CELL,
    lineHeight: CELL,
    baseLineOffset: 6,
    fontFamily: KEWL_FONT_FAMILY,
  };
}

export function installKewlFont(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const tex = await loadTexture('assets/gfx/kewlfont.png');
      const font = new BitmapFont({ data: buildFontData(), textures: [tex] });
      font.applyFillAsTint = false;
      Cache.set(['assets/gfx/kewlfont.png', KEWL_FONT_FAMILY], font);
    })();
  }
  return ready;
}

export function kewlTextSize(designSize: number): number {
  return designSize * KEWL_FONT_DISPLAY_SCALE;
}

export function kewlLineHeight(designSize: number): number {
  return kewlTextSize(designSize) * KEWL_LINE_HEIGHT_FACTOR;
}

/** Vertical gap to leave between stacked text blocks at a given design font size. */
export function kewlBlockGap(designSize: number): number {
  return Math.round(kewlLineHeight(designSize) * 0.45);
}

export interface KewlTextOptions {
  text: string;
  size: number;
  align?: 'left' | 'center' | 'right';
  anchorX?: number;
  anchorY?: number;
}

/** Strip/replace glyphs missing from the kewlfont sheet (ASCII 32–126). */
export function kewlString(text: string): string {
  return text
    .replace(/\u2713/g, '*')
    .replace(/\u2190/g, '<')
    .replace(/\u2014/g, '-')
    .replace(/\u00b7/g, ' / ');
}

function kewlFontScale(designSize: number): number {
  return kewlTextSize(designSize) / CELL;
}

/** Left padding before the first glyph (bitmap xOffset). */
export function kewlTextLeftInset(designSize: number): number {
  return X_OFFSET * kewlFontScale(designSize);
}

export function kewlMeasuredSize(text: string, designSize: number): { width: number; height: number } {
  const fontSize = kewlTextSize(designSize);
  const scale = kewlFontScale(designSize);
  const letterSpacing = designSize * KEWL_LETTER_SPACING_FACTOR * KEWL_FONT_DISPLAY_SCALE;
  const len = text.length;
  if (len === 0) return { width: 0, height: fontSize };
  const advances = (len - 1) * X_ADVANCE * scale;
  const spacing = (len - 1) * letterSpacing;
  return {
    width: kewlTextLeftInset(designSize) + advances + spacing + CELL * scale,
    height: fontSize,
  };
}

/** Bitmap label with its visual center at local (0, 0) — for overlays on sprites. */
export function kewlTextAtCenter(opts: KewlTextOptions): BitmapText {
  const label = kewlText({ ...opts, align: opts.align ?? 'center' });
  label.style.lineHeight = kewlTextSize(opts.size);
  const measured = kewlMeasuredSize(label.text, opts.size);
  const w = label.width > 0 ? label.width : measured.width;
  const h = label.height > 0 ? label.height : measured.height;
  label.pivot.set(w / 2, h / 2);
  label.position.set(0, 0);
  return label;
}

export function kewlText(opts: KewlTextOptions): BitmapText {
  const fontSize = kewlTextSize(opts.size);
  const label = new BitmapText({
    text: kewlString(opts.text),
    style: {
      fontFamily: KEWL_FONT_FAMILY,
      fontSize,
      lineHeight: kewlLineHeight(opts.size),
      letterSpacing: opts.size * KEWL_LETTER_SPACING_FACTOR * KEWL_FONT_DISPLAY_SCALE,
    },
  });
  if (opts.align) label.style.align = opts.align;
  if (opts.anchorX !== undefined || opts.anchorY !== undefined) {
    label.anchor.set(opts.anchorX ?? 0, opts.anchorY ?? 0);
  }
  return label;
}
