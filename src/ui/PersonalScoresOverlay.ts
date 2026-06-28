import { BitmapText, Container, Graphics } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import { playerProfile } from '../core/PlayerProfile';
import {
  formatPersonalScoreRows,
  loadPersonalScoreRows,
} from '../core/leaderboard/personalScores';
import { createFocusableButton } from '../input/FocusableButton';
import type { MenuActionsHost } from '../input/MenuActionsHost';
import type { UiAction } from '../input/UiMenuController';
import { createMenuBackground } from './MenuBackground';
import {
  kewlLineHeight,
  kewlMeasuredSize,
  kewlString,
  kewlText,
  kewlTextLeftInset,
  MENU_BTN_START_Y,
  MENU_BTN_WIDTH,
  MENU_FOOTER_FONT_SIZE,
  MENU_ITEM_FONT_SIZE,
} from './KewlFont';

const SCREEN_MARGIN = 21;
const CONTENT_TOP = SCREEN_MARGIN + kewlLineHeight(MENU_FOOTER_FONT_SIZE) + 24;
const CONTENT_BOTTOM = MENU_BTN_START_Y - 24;
const BODY_FONT_SIZE = 20;
const CHANGE_USERNAME_LABEL = 'Change username';

export class PersonalScoresOverlay extends Container implements MenuActionsHost {
  private menuActions: UiAction[] = [];
  private scrollY = 0;
  private maxScroll = 0;
  private bodyText: BitmapText | null = null;
  private titleText: BitmapText | null = null;
  private scrollLayer = new Container();
  private onBack: () => void;
  private onChangeUsername: () => void;
  private unsubNick: (() => void) | null = null;

  constructor(onBack: () => void, onChangeUsername: () => void) {
    super();
    this.onBack = onBack;
    this.onChangeUsername = onChangeUsername;
    void this.build();
  }

  getMenuActions(): UiAction[] {
    return this.menuActions;
  }

  onMenuCancel(): void {
    this.onBack();
  }

  destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.unsubNick?.();
    this.unsubNick = null;
    super.destroy(options);
  }

  private async build(): Promise<void> {
    this.addChild(await createMenuBackground());

    const centerX = DESIGN.width / 2;
    const title = kewlText({
      text: playerProfile.getNick(),
      size: MENU_FOOTER_FONT_SIZE,
    });
    title.position.set(
      SCREEN_MARGIN - kewlTextLeftInset(MENU_FOOTER_FONT_SIZE),
      SCREEN_MARGIN,
    );
    this.addChild(title);
    this.titleText = title;

    const changeUsernameW = Math.max(
      kewlMeasuredSize(CHANGE_USERNAME_LABEL, MENU_FOOTER_FONT_SIZE).width,
      180,
    );
    const changeUsername = createFocusableButton({
      id: 'personal-scores-change-username',
      label: CHANGE_USERNAME_LABEL,
      x: DESIGN.width - SCREEN_MARGIN - changeUsernameW - 20,
      y: SCREEN_MARGIN,
      w: changeUsernameW,
      align: 'right',
      fontSize: MENU_FOOTER_FONT_SIZE,
      onPress: () => this.onChangeUsername(),
    });
    this.addChild(changeUsername.view);
    this.menuActions.push(changeUsername.action);

    const mask = new Graphics();
    mask.rect(120, CONTENT_TOP, DESIGN.width - 240, CONTENT_BOTTOM - CONTENT_TOP).fill(0xffffff);
    this.addChild(mask);

    this.scrollLayer.mask = mask;
    this.addChild(this.scrollLayer);

    const loading = kewlText({ text: 'Loading...', size: BODY_FONT_SIZE, anchorX: 0.5 });
    loading.position.set(centerX, CONTENT_TOP + 24);
    this.scrollLayer.addChild(loading);

    const hit = new Graphics();
    hit.rect(120, CONTENT_TOP, DESIGN.width - 240, CONTENT_BOTTOM - CONTENT_TOP)
      .fill({ color: 0xffffff, alpha: 0.001 });
    hit.eventMode = 'static';
    hit.on('wheel', (event) => {
      this.setScroll(this.scrollY + event.deltaY * 0.5);
    });
    this.addChild(hit);

    const btnX = centerX - MENU_BTN_WIDTH / 2;
    const back = createFocusableButton({
      id: 'personal-scores-back',
      label: 'Back',
      x: btnX,
      y: MENU_BTN_START_Y,
      center: true,
      w: MENU_BTN_WIDTH,
      fontSize: MENU_ITEM_FONT_SIZE,
      onPress: () => this.onBack(),
    });
    this.addChild(back.view);
    this.menuActions.push(back.action);

    this.unsubNick = playerProfile.subscribe(() => {
      if (this.titleText) {
        this.titleText.text = kewlString(playerProfile.getNick());
      }
      void this.reloadScores();
    });

    try {
      const rows = await loadPersonalScoreRows();
      loading.destroy();
      this.bodyText = kewlText({
        text: formatPersonalScoreRows(rows),
        size: BODY_FONT_SIZE,
      });
      this.bodyText.position.set(160, CONTENT_TOP);
      this.scrollLayer.addChild(this.bodyText);
      this.maxScroll = Math.max(0, this.bodyText.height - (CONTENT_BOTTOM - CONTENT_TOP) + 24);
      this.setScroll(0);
    } catch {
      loading.text = 'Could not load scores.';
    }
  }

  private async reloadScores(): Promise<void> {
    if (!this.bodyText) return;
    try {
      const rows = await loadPersonalScoreRows();
      this.bodyText.text = formatPersonalScoreRows(rows);
      this.maxScroll = Math.max(0, this.bodyText.height - (CONTENT_BOTTOM - CONTENT_TOP) + 24);
      this.setScroll(this.scrollY);
    } catch {
      this.bodyText.text = 'Could not load scores.';
    }
  }

  private setScroll(next: number): void {
    this.scrollY = Math.max(0, Math.min(this.maxScroll, next));
    if (this.bodyText) {
      this.bodyText.position.y = CONTENT_TOP - this.scrollY;
    }
  }
}
