import type { InputSystem } from './InputSystem';
import { playMenuChange } from '../audio/UiSounds';

export interface UiBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface UiAction {
  id: string;
  bounds: () => UiBounds | null;
  activate: () => void;
  setFocused?: (focused: boolean) => void;
  enabled?: () => boolean;
}

export class UiMenuController {
  private actions: UiAction[] = [];
  private focusIndex = 0;
  private hoveredId: string | null = null;

  setActions(actions: UiAction[]): void {
    // Previous actions may belong to destroyed overlays — don't touch their visuals.
    this.actions = actions;
    this.focusIndex = 0;
    this.hoveredId = null;
    this.applyFocusVisuals();
  }

  clear(): void {
    this.actions = [];
    this.focusIndex = 0;
    this.hoveredId = null;
  }

  update(input: InputSystem): void {
    if (this.actions.length === 0) return;

    const { x, y } = input.cursor();
    const hit = this.hitTest(x, y);

    if (hit?.id !== this.hoveredId) {
      this.setHovered(hit?.id ?? null);
    }

    if (input.menuNavigatePrev()) {
      this.moveFocus(-1, input);
    } else if (input.menuNavigateNext()) {
      this.moveFocus(1, input);
    }

    if (input.confirmPressed()) {
      const target = hit ?? this.focusedAction();
      if (target?.enabled?.() === false) return;
      target?.activate();
    }
  }

  private hitTest(x: number, y: number): UiAction | null {
    for (let i = this.actions.length - 1; i >= 0; i--) {
      const action = this.actions[i]!;
      if (action.enabled?.() === false) continue;
      const b = action.bounds();
      if (!b) continue;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return action;
    }
    return null;
  }

  private focusedAction(): UiAction | undefined {
    const enabled = this.actions.filter((a) => a.enabled?.() !== false);
    if (enabled.length === 0) return undefined;
    const idx = ((this.focusIndex % enabled.length) + enabled.length) % enabled.length;
    return enabled[idx];
  }

  private moveFocus(delta: number, input: InputSystem): void {
    const enabled = this.actions.filter((a) => a.enabled?.() !== false);
    if (enabled.length === 0) return;
    this.focusIndex = (this.focusIndex + delta + enabled.length * 8) % enabled.length;
    const focused = enabled[this.focusIndex]!;
    this.setHovered(focused.id);
    const b = focused.bounds();
    if (b) input.snapCursor(b.x + b.w / 2, b.y + b.h / 2);
  }

  private setHovered(id: string | null): void {
    if (this.hoveredId === id) return;
    if (id !== null) playMenuChange();
    for (const action of this.actions) {
      this.safeSetFocused(action, action.id === id);
    }
    this.hoveredId = id;
    if (id) {
      const idx = this.actions.findIndex((a) => a.id === id);
      if (idx >= 0) this.focusIndex = idx;
    }
  }

  private applyFocusVisuals(): void {
    for (const action of this.actions) {
      this.safeSetFocused(action, action.id === this.hoveredId);
    }
  }

  private safeSetFocused(action: UiAction, focused: boolean): void {
    if (!action.bounds()) return;
    action.setFocused?.(focused);
  }
}

