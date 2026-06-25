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
  aim: 'Lock speed',
};

const UPGRADE_ORDER: UpgradeKey[] = [
  'rocket',
  'rocketSpeed',
  'rocketPower',
  'aim',
  'human',
  'humanHp',
  'humanMoney',
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
const SHOP_AUTO = 'assets/gfx/buttons/button_auto.PNG';
const SHOP_LOCKED = 'assets/gfx/buttons/button_locked.png';

const SHOP_BTN_SIZE = 96;
const SHOP_CONTINUE_SIZE = SHOP_BTN_SIZE * 2;
const SHOP_ITEMS_TOP_OFFSET = 48;
const LABEL_GAP = 14;
const LABEL_SIZE = 21;
const SHOP_EDGE = 96;
const LEFT_COL_X = SHOP_EDGE;
const RIGHT_COL_X = 1920/2;

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
  private onAutoBuy: () => void;
  private onContinue: () => void;
  private canBuy: (key: UpgradeKey) => boolean;
  private autoBuyView: Container | null = null;
  private autoBuyAction: UiAction | null = null;

  constructor(
    pack: LevelPack,
    session: LevelSession,
    onBuy: (key: UpgradeKey) => void,
    onAutoBuy: () => void,
    onContinue: () => void,
    canBuy: (key: UpgradeKey) => boolean,
    _hasMoreRounds: boolean,
  ) {
    super();
    this.onBuy = onBuy;
    this.onAutoBuy = onAutoBuy;
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
    this.refreshAutoBuyVisibility();
  }

  private hasBuyableItem(): boolean {
    for (const key of this.shopRows.keys()) {
      if (this.canBuy(key)) return true;
    }
    return false;
  }

  private refreshAutoBuyVisibility(): void {
    if (!this.autoBuyView) return;
    const visible = this.hasBuyableItem();
    this.autoBuyView.visible = visible;
    if (this.autoBuyAction) {
      this.autoBuyAction.enabled = () => visible && this.hasBuyableItem();
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
    const autoTex = await loadTexture(SHOP_AUTO);
    const iconTex = new Map<UpgradeKey, Texture>();
    for (const key of UPGRADE_ORDER) {
      iconTex.set(key, await loadTexture(SHOP_ICON[key]));
    }

    const rowStep = SHOP_BTN_SIZE + kewlBlockGap(LABEL_SIZE);
    const contentTop = UI_TITLE_Y + kewlLineHeight(28) + kewlBlockGap(28) + SHOP_ITEMS_TOP_OFFSET;
    const leftColumnCount = 4;

    for (let i = 0; i < UPGRADE_ORDER.length; i++) {
      const key = UPGRADE_ORDER[i];
      if (pack.config.buttonsDisabled?.[key]) continue;

      const col = i < leftColumnCount ? LEFT_COL_X : RIGHT_COL_X;
      const row = i < leftColumnCount ? i : i - leftColumnCount;
      const y = contentTop + row * rowStep;

      const shopRow = this.makeRow(key, session, baseTex, iconTex.get(key)!);
      shopRow.row.position.set(col, y);
      this.addChild(shopRow.row);
    }

    const bottomY = DESIGN.height - SHOP_EDGE - SHOP_CONTINUE_SIZE;
    const goX = DESIGN.width - SHOP_EDGE - SHOP_CONTINUE_SIZE;

    const auto = createImageFocusButton({
      id: 'shop-auto-buy',
      x: goX - SHOP_CONTINUE_SIZE*1.1,
      y: bottomY,
      w: SHOP_CONTINUE_SIZE,
      h: SHOP_CONTINUE_SIZE,
      iconPlateW: SHOP_BTN_SIZE,
      base: baseTex,
      icon: autoTex,
      onPress: () => this.onAutoBuy(),
      enabled: () => this.hasBuyableItem(),
    });
    this.autoBuyView = auto.view;
    this.autoBuyAction = auto.action;
    this.addChild(auto.view);
    this.menuActions.push(auto.action);

    const cont = createImageFocusButton({
      id: 'shop-continue',
      x: goX,
      y: bottomY,
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

    let rowHovered = false;
    let rowFocused = false;
    const applyRowVisual = () => {
      const active = rowHovered || rowFocused;
      btn.setHovered(active);
      if (label.destroyed) return;
      label.scale.set(active ? 1.04 : 1);
    };

    row.on('pointerover', () => {
      rowHovered = true;
      applyRowVisual();
    });
    row.on('pointerout', () => {
      rowHovered = false;
      applyRowVisual();
    });

    const setFocused = (focused: boolean) => {
      rowFocused = focused;
      applyRowVisual();
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
