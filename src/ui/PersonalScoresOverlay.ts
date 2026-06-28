import { BitmapText, Container, Graphics, Rectangle } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import { playerProfile } from '../core/PlayerProfile';
import {
  loadPersonalScoreRows,
  personalScoreRowLabel,
  type PersonalScoreRow,
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
const CONTENT_LEFT = 160;
const BODY_FONT_SIZE = 20;
const CHANGE_USERNAME_LABEL = 'Change username';

export class PersonalScoresOverlay extends Container implements MenuActionsHost {
  private staticActions: UiAction[] = [];
  private rowActions: UiAction[] = [];
  private scrollY = 0;
  private maxScroll = 0;
  private titleText: BitmapText | null = null;
  private scrollLayer = new Container();
  private contentLayer = new Container();
  private onBack: () => void;
  private onChangeUsername: () => void;
  private onWatchReplay?: (scoreId: number, nick: string) => void;
  private unsubNick: (() => void) | null = null;

  constructor(
    onBack: () => void,
    onChangeUsername: () => void,
    onWatchReplay?: (scoreId: number, nick: string) => void,
  ) {
    super();
    this.onBack = onBack;
    this.onChangeUsername = onChangeUsername;
    this.onWatchReplay = onWatchReplay;
    void this.build();
  }

  getMenuActions(): UiAction[] {
    return [...this.staticActions, ...this.rowActions];
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
    this.staticActions.push(changeUsername.action);

    const mask = new Graphics();
    mask.rect(120, CONTENT_TOP, DESIGN.width - 240, CONTENT_BOTTOM - CONTENT_TOP).fill(0xffffff);
    this.addChild(mask);

    this.scrollLayer.mask = mask;
    this.scrollLayer.eventMode = 'static';
    this.scrollLayer.hitArea = new Rectangle(
      120,
      CONTENT_TOP,
      DESIGN.width - 240,
      CONTENT_BOTTOM - CONTENT_TOP,
    );
    this.scrollLayer.on('wheel', (event) => {
      this.setScroll(this.scrollY + event.deltaY * 0.5);
    });
    this.scrollLayer.addChild(this.contentLayer);
    this.addChild(this.scrollLayer);

    const loading = kewlText({ text: 'Loading...', size: BODY_FONT_SIZE, anchorX: 0.5 });
    loading.position.set(centerX, CONTENT_TOP + 24);
    this.contentLayer.addChild(loading);

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
    this.staticActions.push(back.action);

    this.unsubNick = playerProfile.subscribe(() => {
      if (this.titleText) {
        this.titleText.text = kewlString(playerProfile.getNick());
      }
      void this.reloadScores();
    });

    try {
      const rows = await loadPersonalScoreRows();
      loading.destroy();
      this.renderRows(rows);
    } catch {
      loading.text = 'Could not load scores.';
    }
  }

  private async reloadScores(): Promise<void> {
    try {
      const rows = await loadPersonalScoreRows();
      this.renderRows(rows);
    } catch {
      this.renderEmpty('Could not load scores.');
    }
  }

  private renderEmpty(message: string): void {
    this.contentLayer.removeChildren();
    this.rowActions = [];
    const text = kewlText({ text: message, size: BODY_FONT_SIZE });
    text.position.set(CONTENT_LEFT, 0);
    this.contentLayer.addChild(text);
    this.maxScroll = 0;
    this.setScroll(0);
  }

  private renderRows(rows: PersonalScoreRow[]): void {
    this.contentLayer.removeChildren();
    this.rowActions = [];

    if (rows.length === 0) {
      this.renderEmpty('No scores yet.\nFinish a level to see your times here.');
      return;
    }

    const lineH = kewlLineHeight(BODY_FONT_SIZE);
    let y = 0;
    let lastHeader = '';

    for (const row of rows) {
      const header = row.modeLabel
        ? `${row.campaignName} — ${row.modeLabel}`
        : row.campaignName;
      if (header !== lastHeader) {
        if (lastHeader !== '') y += lineH;
        const headerText = kewlText({ text: header, size: BODY_FONT_SIZE });
        headerText.position.set(CONTENT_LEFT, y);
        this.contentLayer.addChild(headerText);
        y += lineH;
        lastHeader = header;
      }

      const replayable = this.canWatchReplay(row);
      const label = personalScoreRowLabel(row);

      if (replayable) {
        const scoreId = row.scoreId!;
        const rowBtn = createFocusableButton({
          id: `personal-score-${scoreId}`,
          label,
          x: CONTENT_LEFT,
          y,
          w: 480,
          fontSize: BODY_FONT_SIZE,
          onPress: () => {
            this.onWatchReplay?.(scoreId, playerProfile.getNick());
          },
        });
        rowBtn.view.on('wheel', (event) => {
          this.setScroll(this.scrollY + event.deltaY * 0.5);
        });
        this.contentLayer.addChild(rowBtn.view);
        this.rowActions.push(rowBtn.action);
      } else {
        const line = kewlText({ text: label, size: BODY_FONT_SIZE });
        line.position.set(CONTENT_LEFT, y);
        this.contentLayer.addChild(line);
      }

      y += lineH;
    }

    this.maxScroll = Math.max(0, y - (CONTENT_BOTTOM - CONTENT_TOP) + 24);
    this.setScroll(this.scrollY);
  }

  private canWatchReplay(row: PersonalScoreRow): boolean {
    return !!this.onWatchReplay && row.source === 'online' && !!row.scoreId && row.scoreId > 0;
  }

  private setScroll(next: number): void {
    this.scrollY = Math.max(0, Math.min(this.maxScroll, next));
    this.contentLayer.position.y = CONTENT_TOP - this.scrollY;
  }
}
