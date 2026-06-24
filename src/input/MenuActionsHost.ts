import type { UiAction } from './UiMenuController';

export interface MenuActionsHost {
  getMenuActions(): UiAction[];
  onMenuCancel?(): void;
}

export function isMenuActionsHost(value: unknown): value is MenuActionsHost {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getMenuActions' in value &&
    typeof (value as MenuActionsHost).getMenuActions === 'function'
  );
}
