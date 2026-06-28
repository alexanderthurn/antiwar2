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
  kewlText,
  MENU_BTN_START_Y,
  MENU_BTN_WIDTH,
  MENU_ITEM_FONT_SIZE,
  MENU_TITLE_FONT_SIZE,
  UI_TITLE_Y,
} from './KewlFont';

const CONTENT_TOP = UI_TITLE_Y + kewlLineHeight(MENU_TITLE_FONT_SIZE) + 48;
const CONTENT_BOTTOM = MENU_BTN_START_Y - 24;
const BODY_FONT_SIZE = 20;

export class PersonalScoresOverlay extends Container implements MenuActionsHost {
  private menuActions: UiAction[] = [];
  private scrollY = 0;
  private maxScroll = 0;
  private bodyText: BitmapText | null = null;
  private scrollLayer = new Container();
  private onBack: () => void;

  constructor(onBack: () => void) {
    super();
    this.onBack = onBack;
    void this.build();
  }

  getMenuActions(): UiAction[] {
    return this.menuActions;
  }

  onMenuCancel(): void {
    this.onBack();
  }

  private async build(): Promise<void> {
    this.addChild(await createMenuBackground());

    const centerX = DESIGN.width / 2;
    const title = kewlText({
      text: 'My Scores',
      size: MENU_TITLE_FONT_SIZE,
      anchorX: 0.5,
    });
    title.position.set(centerX, UI_TITLE_Y);
    this.addChild(title);

    const subtitle = kewlText({
      text: playerProfile.getNick(),
      size: MENU_ITEM_FONT_SIZE,
      anchorX: 0.5,
    });
    subtitle.position.set(centerX, UI_TITLE_Y + kewlLineHeight(MENU_TITLE_FONT_SIZE) + 8);
    this.addChild(subtitle);

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

  private setScroll(next: number): void {
    this.scrollY = Math.max(0, Math.min(this.maxScroll, next));
    if (this.bodyText) {
      this.bodyText.position.y = CONTENT_TOP - this.scrollY;
    }
  }
}
