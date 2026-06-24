import { BitmapText, Container, Graphics, Rectangle, Sprite, type Texture } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import type { LevelSession, UpgradeKey } from '../core/LevelSession';
import type { LevelPack } from '../data/types';
import { loadTexture } from '../data/AssetLoader';
import type { UiAction } from '../input/UiMenuController';
import { uiBounds } from '../input/FocusableButton';
import { kewlBlockGap, kewlLineHeight, kewlText, UI_TITLE_Y } from './KewlFont';
import { createImageFocusButton, setPlateIconTexture } from './ImageFocusButton';
import { MENU_POINTER_CURSOR } from './MenuPointer';

const UPGRADE_LABELS: Record<UpgradeKey, string> = {
  human: 'Civilian',
  humanHp: 'Civilian HP',
  humanMoney: 'Survivor pay',
  rocket: 'Rocket slot',
  rocketSpeed: 'Rocket speed',
  rocketPower: 'Rocket power',
  aim: 'Lock-on speed',
};

const UPGRADE_ORDER: UpgradeKey[] = [
  'human',
  'humanHp',
  'humanMoney',
  'rocket',
  'rocketSpeed',
  'rocketPower',
  'aim',
];

const SHOP_ICON: Record<UpgradeKey, string> = {
  human: 'assets/gfx/buttons/button_human.png',
  humanHp: 'assets/gfx/buttons/button_human_power.png',
  humanMoney: 'assets/gfx/buttons/button_human_money.png',
  rocket: 'assets/gfx/buttons/button_rocket.png',
  rocketSpeed: 'assets/gfx/buttons/button_rocket_speed.png',
  rocketPower: 'assets/gfx/buttons/button_rocket_power.png',
  aim: 'assets/gfx/buttons/button_aim.png',
};

const SHOP_BASE = 'assets/gfx/buttons/button.png';
const SHOP_GO = 'assets/gfx/buttons/button_go.png';
const SHOP_LOCKED = 'assets/gfx/buttons/button_locked.png';

const SHOP_BTN_SIZE = 96;
const SHOP_CONTINUE_SIZE = SHOP_BTN_SIZE * 2;
const SHOP_ITEMS_TOP_OFFSET = 48;
const LABEL_GAP = 14;
const LABEL_SIZE = 21;
const LEFT_COL_X = DESIGN.width * 0.1;
const RIGHT_COL_X = DESIGN.width * 0.6;
const MARGIN = 48;

interface ShopRow {
  icon: Sprite;
  iconScale: number;
  normalTex: Texture;
  label: BitmapText;
  row: Container & { rowW: number };
  key: UpgradeKey;
}

export class ShopOverlay extends Container {
  readonly menuActions: UiAction[] = [];

  private moneyText!: BitmapText;
  private priceLabels = new Map<UpgradeKey, BitmapText>();
  private shopRows = new Map<UpgradeKey, ShopRow>();
  private lockedTex!: Texture;
  private onBuy: (key: UpgradeKey) => void;
  private onContinue: () => void;
  private canBuy: (key: UpgradeKey) => boolean;

  constructor(
    pack: LevelPack,
    session: LevelSession,
    onBuy: (key: UpgradeKey) => void,
    onContinue: () => void,
    canBuy: (key: UpgradeKey) => boolean,
    _hasMoreRounds: boolean,
  ) {
    super();
    this.onBuy = onBuy;
    this.onContinue = onContinue;
    this.canBuy = canBuy;
    void this.build(pack, session);
  }

  refresh(session: LevelSession): void {
    this.moneyText.text = `Money: $${Math.floor(session.money)}`;
    for (const [key, label] of this.priceLabels) {
      label.text = `${UPGRADE_LABELS[key]}  ($${session.price(key)})`;
    }
    for (const [key, row] of this.shopRows) {
      const affordable = this.canBuy(key);
      setPlateIconTexture(row.icon, affordable ? row.normalTex : this.lockedTex, row.iconScale);
    }
  }

  private async build(pack: LevelPack, session: LevelSession): Promise<void> {
    this.lockedTex = await loadTexture(SHOP_LOCKED);

    const dim = new Graphics();
    dim.rect(0, 0, DESIGN.width, DESIGN.height).fill({ color: 0x000000, alpha: 0.3 });
    dim.eventMode = 'static';
    this.addChild(dim);

    const centerX = DESIGN.width / 2;
    this.moneyText = kewlText({ text: '', size: 28, anchorX: 0.5 });
    this.moneyText.position.set(centerX, UI_TITLE_Y);
    this.addChild(this.moneyText);

    const baseTex = await loadTexture(SHOP_BASE);
    const goTex = await loadTexture(SHOP_GO);
    const iconTex = new Map<UpgradeKey, Texture>();
    for (const key of UPGRADE_ORDER) {
      iconTex.set(key, await loadTexture(SHOP_ICON[key]));
    }

    const enabled = UPGRADE_ORDER.filter((key) => !pack.config.buttonsDisabled?.[key]);
    const leftKeys = enabled.slice(0, 4);
    const rightKeys = enabled.slice(4);

    const rowStep = SHOP_BTN_SIZE + kewlBlockGap(LABEL_SIZE);
    const contentTop = UI_TITLE_Y + kewlLineHeight(28) + kewlBlockGap(28) + SHOP_ITEMS_TOP_OFFSET;

    this.layoutColumn(leftKeys, LEFT_COL_X, contentTop, rowStep, session, baseTex, iconTex);
    this.layoutColumn(rightKeys, RIGHT_COL_X, contentTop, rowStep, session, baseTex, iconTex);

    const cont = createImageFocusButton({
      id: 'shop-continue',
      x: DESIGN.width - MARGIN - SHOP_CONTINUE_SIZE,
      y: DESIGN.height - MARGIN - SHOP_CONTINUE_SIZE,
      w: SHOP_CONTINUE_SIZE,
      h: SHOP_CONTINUE_SIZE,
      iconPlateW: SHOP_BTN_SIZE,
      base: baseTex,
      icon: goTex,
      onPress: () => this.onContinue(),
    });
    this.addChild(cont.view);
    this.menuActions.push(cont.action);

    this.refresh(session);
  }

  private layoutColumn(
    keys: UpgradeKey[],
    leftX: number,
    contentTop: number,
    rowStep: number,
    session: LevelSession,
    baseTex: Texture,
    iconTex: Map<UpgradeKey, Texture>,
  ): void {
    if (keys.length === 0) return;
    let y = contentTop;
    for (const key of keys) {
      const row = this.makeRow(key, session, baseTex, iconTex.get(key)!);
      row.row.position.set(leftX, y);
      this.addChild(row.row);
      y += rowStep;
    }
  }

  private makeRow(
    key: UpgradeKey,
    session: LevelSession,
    baseTex: Texture,
    normalTex: Texture,
  ): ShopRow {
    const row = new Container() as Container & { rowW: number };
    row.eventMode = 'static';
    row.cursor = MENU_POINTER_CURSOR;

    const affordable = this.canBuy(key);
    const btn = createImageFocusButton({
      id: `shop-${key}`,
      x: 0,
      y: 0,
      w: SHOP_BTN_SIZE,
      h: SHOP_BTN_SIZE,
      base: baseTex,
      icon: affordable ? normalTex : this.lockedTex,
      onPress: () => this.onBuy(key),
      enabled: () => this.canBuy(key),
    });
    row.addChild(btn.view);
    btn.view.eventMode = 'none';

    const label = kewlText({
      text: `${UPGRADE_LABELS[key]}  ($${session.price(key)})`,
      size: LABEL_SIZE,
    });
    label.position.set(SHOP_BTN_SIZE + LABEL_GAP, (SHOP_BTN_SIZE - kewlLineHeight(LABEL_SIZE)) / 2);
    label.eventMode = 'none';
    row.addChild(label);
    this.priceLabels.set(key, label);

    const rowW = SHOP_BTN_SIZE + LABEL_GAP + label.width + 16;
    const rowH = SHOP_BTN_SIZE;
    row.rowW = rowW;
    row.hitArea = new Rectangle(0, 0, rowW, rowH);

    const activate = () => {
      if (this.canBuy(key)) this.onBuy(key);
    };
    row.on('pointertap', activate);

    const setFocused = (focused: boolean) => {
      btn.action.setFocused?.(focused);
      if (label.destroyed) return;
      label.scale.set(focused ? 1.04 : 1);
    };

    this.menuActions.push({
      id: `shop-${key}`,
      bounds: uiBounds(row, rowW, rowH),
      activate,
      setFocused,
      enabled: () => this.canBuy(key),
    });

    const shopRow: ShopRow = {
      icon: btn.icon,
      iconScale: btn.iconScale,
      normalTex,
      label,
      row,
      key,
    };
    this.shopRows.set(key, shopRow);
    return shopRow;
  }
}
