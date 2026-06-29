import { DESIGN } from '../core/DesignSpace';
import type { LevelPack } from '../data/types';
import { kewlBlockGap, kewlLineHeight, UI_TITLE_Y } from '../ui/KewlFont';
import { SHOP_SLOT_AUTOBUY, SHOP_SLOT_CONTINUE, SHOP_UPGRADE_ORDER } from './ShopBindings';

const SHOP_BTN_SIZE = 96;
const SHOP_CONTINUE_SIZE = SHOP_BTN_SIZE * 2;
const SHOP_ITEMS_TOP_OFFSET = 48;
const SHOP_EDGE = 96;
const LEFT_COL_X = SHOP_EDGE;
const RIGHT_COL_X = 1920 / 2;

/** Menu cursor target for shop shortcut slots 1–9. */
export function shopSlotCenter(slot: number, _pack: LevelPack): { x: number; y: number } | null {
  if (slot < 1 || slot > 9) return null;

  const rowStep = SHOP_BTN_SIZE + kewlBlockGap(21);
  const contentTop =
    UI_TITLE_Y + kewlLineHeight(28) + kewlBlockGap(28) + kewlLineHeight(20) + kewlBlockGap(20) + SHOP_ITEMS_TOP_OFFSET;
  const leftColumnCount = 4;
  const bottomY = DESIGN.height - SHOP_EDGE - SHOP_CONTINUE_SIZE;
  const goX = DESIGN.width - SHOP_EDGE - SHOP_CONTINUE_SIZE;

  if (slot >= 1 && slot <= 7) {
    const key = SHOP_UPGRADE_ORDER[slot - 1];
    if (!key) return null;
    const i = SHOP_UPGRADE_ORDER.indexOf(key);
    const col = i < leftColumnCount ? LEFT_COL_X : RIGHT_COL_X;
    const row = i < leftColumnCount ? i : i - leftColumnCount;
    const y = contentTop + row * rowStep;
    return { x: col + SHOP_BTN_SIZE / 2, y: y + SHOP_BTN_SIZE / 2 };
  }
  if (slot === SHOP_SLOT_AUTOBUY) {
    const x = goX - SHOP_CONTINUE_SIZE * 1.1;
    return { x: x + SHOP_CONTINUE_SIZE / 2, y: bottomY + SHOP_CONTINUE_SIZE / 2 };
  }
  if (slot === SHOP_SLOT_CONTINUE) {
    return { x: goX + SHOP_CONTINUE_SIZE / 2, y: bottomY + SHOP_CONTINUE_SIZE / 2 };
  }
  return null;
}
