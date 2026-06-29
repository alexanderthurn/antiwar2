import type { UpgradeKey } from '../core/LevelSession';
import type { GamepadSnapshot } from '../multiplayer/GamepadInput';

/** Screen order in ShopOverlay — slots 1–7 map to these upgrades. */
export const SHOP_UPGRADE_ORDER: UpgradeKey[] = [
  'rocket',
  'rocketSpeed',
  'rocketPower',
  'aim',
  'human',
  'humanHp',
  'humanMoney',
];

export const SHOP_SLOT_AUTOBUY = 8;
export const SHOP_SLOT_CONTINUE = 9;
export const SHOP_SLOT_MIN = 1;
export const SHOP_SLOT_MAX = 9;

export type ShopSlotAction =
  | { kind: 'buy'; key: UpgradeKey }
  | { kind: 'autobuy' }
  | { kind: 'continue' };

export function shopSlotAction(slot: number): ShopSlotAction | null {
  if (slot < SHOP_SLOT_MIN || slot > SHOP_SLOT_MAX) return null;
  if (slot === SHOP_SLOT_AUTOBUY) return { kind: 'autobuy' };
  if (slot === SHOP_SLOT_CONTINUE) return { kind: 'continue' };
  const key = SHOP_UPGRADE_ORDER[slot - 1];
  return key ? { kind: 'buy', key } : null;
}

export function shopSlotFromKeyboard(e: KeyboardEvent): number | null {
  if (e.code.startsWith('Digit')) {
    const digit = Number.parseInt(e.code.slice(5), 10);
    if (digit >= SHOP_SLOT_MIN && digit <= SHOP_SLOT_MAX) return digit;
  }
  if (e.code.startsWith('Numpad')) {
    const digit = Number.parseInt(e.code.slice(6), 10);
    if (digit >= SHOP_SLOT_MIN && digit <= SHOP_SLOT_MAX) return digit;
  }
  return null;
}

/** Gamepad shop shortcuts (no menu focus navigation in shop). */
export function shopSlotFromGamepad(pad: GamepadSnapshot, prev: GamepadShopPrev): number | null {
  if (pad.dpadUp && !prev.dpadUp) return 1;
  if (pad.dpadRight && !prev.dpadRight) return 2;
  if (pad.dpadDown && !prev.dpadDown) return 3;
  if (pad.dpadLeft && !prev.dpadLeft) return 4;
  if (pad.buttonL1 && !prev.buttonL1) return 5;
  if (pad.buttonR1 && !prev.buttonR1) return 6;
  if (pad.buttonB && !prev.buttonB) return 7;
  if (pad.buttonA && !prev.buttonA) return SHOP_SLOT_AUTOBUY;
  if (pad.buttonStart && !prev.buttonStart) return SHOP_SLOT_CONTINUE;
  return null;
}

export interface GamepadShopPrev {
  dpadUp: boolean;
  dpadRight: boolean;
  dpadDown: boolean;
  dpadLeft: boolean;
  buttonL1: boolean;
  buttonR1: boolean;
  buttonA: boolean;
  buttonB: boolean;
  buttonStart: boolean;
}

export function emptyGamepadShopPrev(): GamepadShopPrev {
  return {
    dpadUp: false,
    dpadRight: false,
    dpadDown: false,
    dpadLeft: false,
    buttonL1: false,
    buttonR1: false,
    buttonA: false,
    buttonB: false,
    buttonStart: false,
  };
}

export function snapshotGamepadShopPrev(pad: GamepadSnapshot): GamepadShopPrev {
  return {
    dpadUp: pad.dpadUp,
    dpadRight: pad.dpadRight,
    dpadDown: pad.dpadDown,
    dpadLeft: pad.dpadLeft,
    buttonL1: pad.buttonL1,
    buttonR1: pad.buttonR1,
    buttonA: pad.buttonA,
    buttonB: pad.buttonB,
    buttonStart: pad.buttonStart,
  };
}
