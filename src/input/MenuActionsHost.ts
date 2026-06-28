import type { InputSystem } from './InputSystem';
import type { UiAction } from './UiMenuController';

export interface MenuActionsHost {
  getMenuActions(): UiAction[];
  onMenuCancel?(): void;
  /** Return true to handle menu navigation/confirm/cancel locally this frame. */
  handleMenuInput?(input: InputSystem): boolean;
}

export function isMenuActionsHost(value: unknown): value is MenuActionsHost {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getMenuActions' in value &&
    typeof (value as MenuActionsHost).getMenuActions === 'function'
  );
}
