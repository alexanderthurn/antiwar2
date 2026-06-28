import { BitmapText, Container, Graphics } from 'pixi.js';
import { playerProfile, sanitizeNick } from '../core/PlayerProfile';
import { designToClient } from '../core/Viewport';
import { getViewportContext } from '../core/ViewportContext';
import type { InputSystem } from '../input/InputSystem';
import type { UiAction } from '../input/UiMenuController';
import { pollGamepads } from '../multiplayer/GamepadInput';
import { playMenuClick } from '../audio/UiSounds';
import { createFocusableButton } from '../input/FocusableButton';
import {
  KEWL_FONT_DISPLAY_SCALE,
  kewlLineHeight,
  kewlMeasuredSize,
  kewlString,
} from './KewlFont';

const CHARSET = ' ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
const CURSOR_CHAR = '|';
const EDIT_PAD_X = 36;
const EDIT_PAD_Y = 28;
const EDIT_FOCUS_SCALE = 1.2;
const EDIT_BORDER = 6;
const EDIT_RADIUS = 14;

function isConfirmKey(e: KeyboardEvent): boolean {
  return e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter';
}

function isCancelKey(e: KeyboardEvent): boolean {
  return e.key === 'Escape' || e.code === 'Escape';
}

export class NickNameField {
  readonly view: Container;
  readonly action: UiAction;

  private readonly fontSize: number;
  private readonly designX: number;
  private readonly designY: number;
  private readonly designW: number;
  private readonly prefix: string;
  private readonly onNickChanged: (nick: string) => void;
  private labelText: BitmapText;
  private editHighlight: Graphics;
  private editBox = { x: 0, y: 0, w: 0, h: 0 };
  private editing = false;
  private draft = '';
  private caret = 0;
  private savedNick = '';
  private domInput: HTMLInputElement | null = null;
  private blinkOn = true;
  private blinkTimer = 0;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private unsubNick: (() => void) | null = null;
  private prevPad = {
    a: false,
    b: false,
    l1: false,
    up: false,
    down: false,
    left: false,
    right: false,
  };

  constructor(opts: {
    id: string;
    x: number;
    y: number;
    w: number;
    fontSize: number;
    prefix?: string;
    center?: boolean;
    align?: 'left' | 'center' | 'right';
    onNickChanged?: (nick: string) => void;
  }) {
    this.fontSize = opts.fontSize;
    this.designX = opts.x;
    this.designY = opts.y;
    this.designW = opts.w;
    this.prefix = opts.prefix ?? '';
    this.onNickChanged = opts.onNickChanged ?? (() => {});
    this.savedNick = playerProfile.getNick();
    this.draft = this.savedNick;

    const { view, action } = createFocusableButton({
      id: opts.id,
      label: this.displayLabel(),
      x: opts.x,
      y: opts.y,
      w: opts.w,
      align: opts.align ?? (opts.center ? 'center' : 'right'),
      center: opts.center,
      fontSize: opts.fontSize,
      onPress: () => this.beginEdit(),
    });
    this.view = view;
    this.action = action;
    this.labelText = view.children[0] as BitmapText;
    this.editHighlight = new Graphics();
    this.editHighlight.visible = false;
    this.view.addChildAt(this.editHighlight, 0);
    this.unsubNick = playerProfile.subscribe((nick) => {
      if (!this.editing) {
        this.savedNick = nick;
        this.draft = nick;
        this.refreshLabel();
      }
    });
  }

  isEditing(): boolean {
    return this.editing;
  }

  update(dt: number): void {
    if (!this.editing) return;

    this.blinkTimer += dt;
    if (this.blinkTimer >= 0.45) {
      this.blinkTimer = 0;
      this.blinkOn = !this.blinkOn;
      this.refreshLabel();
    }

    this.syncDomInput();
  }

  handleMenuInput(input: InputSystem): boolean {
    if (!this.editing) return false;

    this.handleGamepad();

    if (input.confirmPressed()) {
      this.commitEdit();
      return true;
    }
    if (input.cancelPressed()) {
      this.cancelEdit();
      return true;
    }

    return true;
  }

  cancelEditIfActive(): boolean {
    if (!this.editing) return false;
    this.cancelEdit();
    return true;
  }

  destroy(): void {
    this.unsubNick?.();
    this.unsubNick = null;
    this.endDomInput();
    this.view.destroy({ children: true });
  }

  beginEdit(): void {
    if (this.editing) return;
    playMenuClick();
    this.editing = true;
    this.savedNick = playerProfile.getNick();
    this.draft = this.savedNick;
    this.caret = this.draft.length;
    this.blinkOn = true;
    this.blinkTimer = 0;
    this.createDomInput();
    this.setEditingVisual(true);
    this.refreshLabel();
    this.domInput?.focus();
    this.domInput?.select();
  }

  private displayLabel(): string {
    let body: string;
    if (!this.editing) {
      body = this.savedNick;
    } else {
      const before = this.draft.slice(0, this.caret);
      const after = this.draft.slice(this.caret);
      const cursor = this.blinkOn ? CURSOR_CHAR : ' ';
      body = `${before}${cursor}${after}`;
    }
    return `${this.prefix}${body}`;
  }

  private refreshLabel(): void {
    this.labelText.text = kewlString(this.displayLabel());
    if (this.editing) {
      this.layoutEditHighlight();
    }
  }

  private commitEdit(): void {
    if (!this.editing) return;
    const nick = sanitizeNick(this.draft);
    if (nick === '') {
      this.cancelEdit();
      return;
    }
    playMenuClick();
    playerProfile.setNick(nick);
    this.savedNick = nick;
    this.endEdit();
    this.onNickChanged(nick);
  }

  private cancelEdit(): void {
    if (!this.editing) return;
    playMenuClick();
    this.draft = this.savedNick;
    this.endEdit();
  }

  private endEdit(): void {
    this.editing = false;
    this.endDomInput();
    this.setEditingVisual(false);
    this.refreshLabel();
  }

  private setEditingVisual(active: boolean): void {
    if (!active) {
      this.editHighlight.visible = false;
      this.labelText.scale.set(1);
      return;
    }

    this.editHighlight.visible = true;
    this.labelText.scale.set(EDIT_FOCUS_SCALE);
    this.layoutEditHighlight();
  }

  private layoutEditHighlight(): void {
    const lineH = kewlLineHeight(this.fontSize);
    const label = this.displayLabel().replace(CURSOR_CHAR, 'M');
    const textW = kewlMeasuredSize(label, this.fontSize).width * EDIT_FOCUS_SCALE;
    const boxW = Math.max(this.designW + EDIT_PAD_X, textW + EDIT_PAD_X * 2);
    const boxH = lineH * EDIT_FOCUS_SCALE + EDIT_PAD_Y * 2;
    const x = (this.designW - boxW) / 2;
    const y = -EDIT_PAD_Y;

    this.editBox = { x, y, w: boxW, h: boxH };
    this.editHighlight.clear();
    this.editHighlight
      .roundRect(x, y, boxW, boxH, EDIT_RADIUS)
      .fill({ color: 0x0c1e3c, alpha: 0.94 })
      .stroke({ color: 0x88ccff, width: EDIT_BORDER, alpha: 1 });
  }

  private createDomInput(): void {
    this.endDomInput();

    const input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.autocapitalize = 'off';
    input.spellcheck = false;
    input.maxLength = 32;
    input.value = this.draft;
    input.style.position = 'fixed';
    input.style.margin = '0';
    input.style.padding = '0';
    input.style.border = 'none';
    input.style.outline = 'none';
    input.style.background = 'transparent';
    input.style.color = 'transparent';
    input.style.caretColor = 'transparent';
    input.style.opacity = '0.01';
    input.style.zIndex = '1000';

    input.addEventListener('input', () => {
      this.draft = sanitizeNick(input.value);
      this.caret = input.selectionStart ?? this.draft.length;
      input.value = this.draft;
      this.refreshLabel();
    });

    input.addEventListener('keydown', (e) => {
      if (isConfirmKey(e)) {
        e.preventDefault();
        this.commitEdit();
      } else if (isCancelKey(e)) {
        e.preventDefault();
        this.cancelEdit();
      }
    });

    document.body.appendChild(input);
    this.domInput = input;
    this.syncDomInput();

    this.keydownHandler = (e: KeyboardEvent) => {
      if (!this.editing) return;
      if (isConfirmKey(e)) {
        e.preventDefault();
        e.stopPropagation();
        this.commitEdit();
      } else if (isCancelKey(e)) {
        e.preventDefault();
        e.stopPropagation();
        this.cancelEdit();
      }
    };
    window.addEventListener('keydown', this.keydownHandler, true);
  }

  private endDomInput(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler, true);
      this.keydownHandler = null;
    }
    this.domInput?.remove();
    this.domInput = null;
  }

  private syncDomInput(): void {
    const input = this.domInput;
    const ctx = getViewportContext();
    if (!input || !ctx) return;

    const lineH = kewlLineHeight(this.fontSize);
    const boxX = this.designX + this.editBox.x;
    const boxY = this.designY + this.editBox.y;
    const topLeft = designToClient(boxX, boxY, ctx.layout);
    const fontPx = this.fontSize * KEWL_FONT_DISPLAY_SCALE * EDIT_FOCUS_SCALE * ctx.layout.scale;
    const widthPx = this.editBox.w * ctx.layout.scale;
    const heightPx = Math.max(this.editBox.h, lineH * EDIT_FOCUS_SCALE) * ctx.layout.scale;

    input.style.left = `${topLeft.x}px`;
    input.style.top = `${topLeft.y}px`;
    input.style.width = `${widthPx}px`;
    input.style.height = `${heightPx}px`;
    input.style.fontSize = `${fontPx}px`;

    if (document.activeElement === input && input.value !== this.draft) {
      input.value = this.draft;
      input.setSelectionRange(this.caret, this.caret);
    }
  }

  private handleGamepad(): void {
    const pad = pollGamepads()[0];
    if (!pad) {
      this.prevPad = { a: false, b: false, l1: false, up: false, down: false, left: false, right: false };
      return;
    }

    if (pad.dpadLeft && !this.prevPad.left) this.moveCaret(-1);
    if (pad.dpadRight && !this.prevPad.right) this.moveCaret(1);
    if (pad.dpadUp && !this.prevPad.up) this.cycleChar(1);
    if (pad.dpadDown && !this.prevPad.down) this.cycleChar(-1);
    if (pad.buttonL1 && !this.prevPad.l1) this.backspace();

    this.prevPad = {
      a: pad.buttonA,
      b: pad.buttonB,
      l1: pad.buttonL1,
      up: pad.dpadUp,
      down: pad.dpadDown,
      left: pad.dpadLeft,
      right: pad.dpadRight,
    };
  }

  private moveCaret(delta: number): void {
    this.caret = Math.max(0, Math.min(this.draft.length, this.caret + delta));
    this.syncDraftToDom();
    this.refreshLabel();
  }

  private cycleChar(delta: number): void {
    if (this.caret < this.draft.length) {
      const ch = this.draft[this.caret] ?? CHARSET[0]!;
      const idx = CHARSET.indexOf(ch);
      const base = idx >= 0 ? idx : 0;
      const next = CHARSET[(base + delta + CHARSET.length) % CHARSET.length]!;
      this.draft = this.draft.slice(0, this.caret) + next + this.draft.slice(this.caret + 1);
    } else if (delta > 0) {
      this.draft += CHARSET[1] ?? 'A';
      this.caret = this.draft.length;
    }
    this.syncDraftToDom();
    this.refreshLabel();
  }

  private backspace(): void {
    if (this.caret <= 0) return;
    this.draft = this.draft.slice(0, this.caret - 1) + this.draft.slice(this.caret);
    this.caret--;
    this.syncDraftToDom();
    this.refreshLabel();
  }

  private syncDraftToDom(): void {
    if (!this.domInput) return;
    this.domInput.value = this.draft;
    this.domInput.setSelectionRange(this.caret, this.caret);
  }
}
