import { DESIGN, TOUCH_AIM_EXTRA_CM } from '../core/DesignSpace';
import { screenToDesign, stickToDesign, type ViewportLayout } from '../core/Viewport';
import { pollGamepads } from '../multiplayer/GamepadInput';
import type { PlayerManager } from '../multiplayer/PlayerManager';
import type { PlayerSlot } from '../multiplayer/PlayerSlot';

export type InputMode = 'menu' | 'combat';

export interface PlayerAimPoint {
  slot: PlayerSlot;
  x: number;
  y: number;
}

const UI_CURSOR_SPEED = 720;
const MENU_STICK_DEADZONE = 0.2;

/**
 * Unified pointer, touch, and gamepad input.
 * Combat routes aim/fire to player slots; menu mode drives a shared UI cursor.
 */
export class InputSystem {
  private layout: ViewportLayout | null = null;
  private mode: InputMode = 'menu';

  private cursorX = DESIGN.width / 2;
  private cursorY = DESIGN.height / 2;
  private pointerDown = false;
  private pointerDownEdge = false;

  private gamepadPrevA = new Map<number, boolean>();
  private gamepadPrevB = new Map<number, boolean>();
  private gamepadPrevStart = new Map<number, boolean>();
  private gamepadPrevDpadUp = false;
  private gamepadPrevDpadDown = false;

  private confirmEdge = false;
  private cancelEdge = false;
  private pauseEdge = false;
  private navPrevEdge = false;
  private navNextEdge = false;
  private joinNavPrevEdge = false;
  private joinNavNextEdge = false;
  private joinConfirmEdge = false;
  private joinPanelFocused = false;
  private pointerDrivesMenu = true;

  setLayout(layout: ViewportLayout): void {
    this.layout = layout;
  }

  setMode(mode: InputMode): void {
    this.mode = mode;
  }

  modeActive(): InputMode {
    return this.mode;
  }

  cursor(): { x: number; y: number } {
    return { x: this.cursorX, y: this.cursorY };
  }

  snapCursor(x: number, y: number): void {
    this.cursorX = Math.max(0, Math.min(DESIGN.width, x));
    this.cursorY = Math.max(0, Math.min(DESIGN.height, y));
  }

  confirmPressed(): boolean {
    return this.confirmEdge;
  }

  cancelPressed(): boolean {
    return this.cancelEdge;
  }

  pausePressed(): boolean {
    return this.pauseEdge;
  }

  menuNavigatePrev(): boolean {
    return this.navPrevEdge;
  }

  menuNavigateNext(): boolean {
    return this.navNextEdge;
  }

  joinNavigatePrev(): boolean {
    return this.joinNavPrevEdge;
  }

  joinNavigateNext(): boolean {
    return this.joinNavNextEdge;
  }

  joinConfirmPressed(): boolean {
    return this.joinConfirmEdge;
  }

  setJoinPanelFocused(focused: boolean): void {
    this.joinPanelFocused = focused;
  }

  isMenuPointerDriven(): boolean {
    return this.pointerDrivesMenu;
  }

  onPointerMove(clientX: number, clientY: number): void {
    if (!this.layout) return;
    this.pointerDrivesMenu = true;
    const { x, y, inGame } = screenToDesign(clientX, clientY, this.layout);
    if (inGame) {
      this.cursorX = x;
      this.cursorY = y;
    }
  }

  onPointerDown(clientX: number, clientY: number): void {
    if (!this.layout) return;
    this.pointerDrivesMenu = true;
    const { x, y, inGame } = screenToDesign(clientX, clientY, this.layout);
    if (!inGame) return;
    this.cursorX = x;
    this.cursorY = y;
    if (!this.pointerDown) this.pointerDownEdge = true;
    this.pointerDown = true;
  }

  onPointerUp(): void {
    this.pointerDown = false;
  }

  /** Call at the start of each frame before reading edge flags. */
  beginFrame(dt: number): void {
    this.confirmEdge = false;
    this.cancelEdge = false;
    this.pauseEdge = false;
    this.navPrevEdge = false;
    this.navNextEdge = false;
    this.joinNavPrevEdge = false;
    this.joinNavNextEdge = false;
    this.joinConfirmEdge = false;

    if (this.mode === 'menu') {
      this.pollMenuGamepads(dt);
      // Pointer/touch activate via Pixi pointertap on release; gamepad uses confirm here.
      if (this.pointerDownEdge && !this.pointerDrivesMenu) this.confirmEdge = true;
    } else if (this.mode === 'combat') {
      this.pollCombatJoinGamepads();
    }

    this.pointerDownEdge = false;
  }

  applyPointerMove(players: PlayerManager, clientX: number, clientY: number): void {
    if (!this.layout || this.mode !== 'combat') return;
    const slot = this.pointerSlot(players);
    if (!slot) return;
    const { x, y, inGame } = screenToDesign(clientX, clientY, this.layout);
    if (inGame) slot.setAim(x, y);
  }

  /** Touch aim — crosshair sits above the finger by ground height plus a physical cm offset. */
  applyTouchPointerMove(players: PlayerManager, stageX: number, stageY: number): void {
    if (!this.layout || this.mode !== 'combat') return;
    const slot = this.pointerSlot(players);
    if (!slot) return;
    const { x, y, inGame } = screenToDesign(stageX, stageY, this.layout);
    if (!inGame) return;
    const offsetY = DESIGN.groundHeight + this.layout.designPxPerCm * TOUCH_AIM_EXTRA_CM;
    slot.setAim(x, Math.max(0, y - offsetY));
  }

  setPointerFire(players: PlayerManager, left: boolean, right: boolean): void {
    if (this.mode !== 'combat') return;
    const slot = this.pointerSlot(players);
    if (!slot) return;
    slot.setFire(left, right);
  }

  updateCombat(
    players: PlayerManager,
    callbacks?: {
      onJoin?: (slot: PlayerSlot) => void;
      onLeave?: (slot: PlayerSlot) => void;
    },
  ): void {
    if (this.mode !== 'combat') return;

    for (const pad of pollGamepads()) {
      const prevA = this.gamepadPrevA.get(pad.index) ?? false;
      const prevB = this.gamepadPrevB.get(pad.index) ?? false;
      let slot = players.slotByGamepad(pad.index);

      if (!slot && pad.buttonA && !prevA && !this.joinPanelFocused) {
        const joined = players.joinGamepad(pad.index);
        if (joined) {
          slot = joined;
          callbacks?.onJoin?.(joined);
        }
      }

      if (slot?.active && slot.gamepadIndex === pad.index) {
        if (pad.buttonB && !prevB) {
          if (slot.index > 0) {
            players.leave(slot.index);
            callbacks?.onLeave?.(slot);
          }
        } else {
          const pos = stickToDesign(pad.axisX, pad.axisY, 1, slot.crosshairX, slot.crosshairY);
          slot.setAim(pos.x, pos.y);
          slot.setFire(pad.buttonL1, pad.buttonR1);
        }
      }

      this.gamepadPrevA.set(pad.index, pad.buttonA);
      this.gamepadPrevB.set(pad.index, pad.buttonB);
    }
  }

  pollPauseToggle(): boolean {
    let requested = this.pauseEdge;
    for (const pad of pollGamepads()) {
      const prev = this.gamepadPrevStart.get(pad.index) ?? false;
      if (pad.buttonStart && !prev) requested = true;
      this.gamepadPrevStart.set(pad.index, pad.buttonStart);
    }
    return requested;
  }

  aimPoints(players: PlayerManager): PlayerAimPoint[] {
    return players.active().map((slot) => ({
      slot,
      x: slot.crosshairX,
      y: slot.crosshairY,
    }));
  }

  private pollCombatJoinGamepads(): void {
    const pad = pollGamepads()[0];
    if (!pad) {
      this.gamepadPrevDpadUp = false;
      this.gamepadPrevDpadDown = false;
      return;
    }

    const prevA = this.gamepadPrevA.get(pad.index) ?? false;

    if (pad.dpadUp && !this.gamepadPrevDpadUp) this.joinNavPrevEdge = true;
    if (pad.dpadDown && !this.gamepadPrevDpadDown) this.joinNavNextEdge = true;
    if (pad.buttonA && !prevA && this.joinPanelFocused) this.joinConfirmEdge = true;

    this.gamepadPrevA.set(pad.index, pad.buttonA);
    this.gamepadPrevDpadUp = pad.dpadUp;
    this.gamepadPrevDpadDown = pad.dpadDown;
  }

  private pollMenuGamepads(dt: number): void {
    const pads = pollGamepads();
    const pad = pads[0];

    if (pad) {
      const prevA = this.gamepadPrevA.get(pad.index) ?? false;
      const prevB = this.gamepadPrevB.get(pad.index) ?? false;
      const prevStart = this.gamepadPrevStart.get(pad.index) ?? false;

      if (pad.buttonA && !prevA) this.confirmEdge = true;
      if (pad.buttonB && !prevB) this.cancelEdge = true;
      if (pad.buttonStart && !prevStart) this.pauseEdge = true;

      const mag = Math.hypot(pad.axisX, pad.axisY);
      if (mag >= MENU_STICK_DEADZONE) {
        this.pointerDrivesMenu = false;
        const nx = pad.axisX / mag;
        const ny = pad.axisY / mag;
        this.cursorX = Math.max(0, Math.min(DESIGN.width, this.cursorX + nx * UI_CURSOR_SPEED * dt));
        this.cursorY = Math.max(0, Math.min(DESIGN.height, this.cursorY + ny * UI_CURSOR_SPEED * dt));
      }

      if (pad.dpadUp && !this.gamepadPrevDpadUp) {
        this.navPrevEdge = true;
        this.pointerDrivesMenu = false;
      }
      if (pad.dpadDown && !this.gamepadPrevDpadDown) {
        this.navNextEdge = true;
        this.pointerDrivesMenu = false;
      }

      this.gamepadPrevA.set(pad.index, pad.buttonA);
      this.gamepadPrevB.set(pad.index, pad.buttonB);
      this.gamepadPrevStart.set(pad.index, pad.buttonStart);
      this.gamepadPrevDpadUp = pad.dpadUp;
      this.gamepadPrevDpadDown = pad.dpadDown;
    } else {
      this.gamepadPrevDpadUp = false;
      this.gamepadPrevDpadDown = false;
    }
  }

  private pointerSlot(players: PlayerManager): PlayerSlot | undefined {
    return players.active().find((s) => s.aimSource === 'pointer');
  }
}
