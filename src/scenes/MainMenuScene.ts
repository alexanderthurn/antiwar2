import { Container } from 'pixi.js';
import packageJson from '../../package.json';
import { playSound, sfxPath } from '../audio/SoundManager';
import { DESIGN } from '../core/DesignSpace';
import { playerProfile } from '../core/PlayerProfile';
import { loadTexture } from '../data/AssetLoader';
import { createFocusableButton } from '../input/FocusableButton';
import type { MenuActionsHost } from '../input/MenuActionsHost';
import type { UiAction } from '../input/UiMenuController';
import { createMenuBackground } from '../ui/MenuBackground';
import { MenuLogo } from '../ui/MenuLogo';
import { HowToPlayOverlay } from '../ui/HowToPlayOverlay';
import { PersonalScoresOverlay } from '../ui/PersonalScoresOverlay';
import { SettingsOverlay } from '../ui/SettingsOverlay';
import { kewlLineHeight, kewlMeasuredSize, kewlTextLeftInset, MENU_BTN_START_Y, MENU_BTN_WIDTH, MENU_FOOTER_FONT_SIZE, MENU_ITEM_FONT_SIZE, menuRowStep, UI_TITLE_MAIN_MENU_Y } from '../ui/KewlFont';

const LOGO_PATH = 'assets/gfx/logo.png';
const LOGO_HEIGHT = 200;
const FOOTER_MARGIN = 21;

let welcomePlayed = false;
const VERSION_URL = 'https://github.com/alexanderthurn/antiwar2';

export class MainMenuScene extends Container implements MenuActionsHost {
  private menuActions: UiAction[] = [];
  private mainActions: UiAction[] = [];
  private menuContent = new Container();
  private settingsOverlay: SettingsOverlay | null = null;
  private howToPlayOverlay: HowToPlayOverlay | null = null;
  private personalScoresOverlay: PersonalScoresOverlay | null = null;
  private logo: MenuLogo | null = null;

  constructor(
    onPlay: () => void,
    onCredits: () => void,
    onSettings: () => void,
  ) {
    super();
    void this.build(onPlay, onCredits, onSettings);
  }

  update(dt: number): void {
    this.logo?.update(dt);
  }

  showSettings(): void {
    if (this.settingsOverlay) return;
    this.menuContent.visible = false;
    this.settingsOverlay = new SettingsOverlay(() => this.closeSettings());
    this.addChild(this.settingsOverlay);
  }

  closeSettings(): void {
    if (this.settingsOverlay) {
      this.settingsOverlay.destroy({ children: true });
      this.settingsOverlay = null;
      this.menuContent.visible = true;
    }
  }

  showHowToPlay(): void {
    if (this.howToPlayOverlay) return;
    this.menuContent.visible = false;
    this.howToPlayOverlay = new HowToPlayOverlay(() => this.closeHowToPlay());
    this.addChild(this.howToPlayOverlay);
  }

  closeHowToPlay(): void {
    if (this.howToPlayOverlay) {
      this.howToPlayOverlay.destroy({ children: true });
      this.howToPlayOverlay = null;
      this.menuContent.visible = true;
    }
  }

  showPersonalScores(): void {
    if (this.personalScoresOverlay) return;
    this.menuContent.visible = false;
    this.personalScoresOverlay = new PersonalScoresOverlay(() => this.closePersonalScores());
    this.addChild(this.personalScoresOverlay);
  }

  closePersonalScores(): void {
    if (this.personalScoresOverlay) {
      this.personalScoresOverlay.destroy({ children: true });
      this.personalScoresOverlay = null;
      this.menuContent.visible = true;
    }
  }

  getMenuActions(): UiAction[] {
    return (
      this.personalScoresOverlay?.getMenuActions()
      ?? this.howToPlayOverlay?.getMenuActions()
      ?? this.settingsOverlay?.getMenuActions()
      ?? this.mainActions
    );
  }

  onMenuCancel(): void {
    if (this.personalScoresOverlay) this.closePersonalScores();
    else if (this.howToPlayOverlay) this.closeHowToPlay();
    else if (this.settingsOverlay) this.closeSettings();
  }

  private async build(
    onPlay: () => void,
    onCredits: () => void,
    onSettings: () => void,
  ): Promise<void> {
    this.addChild(this.menuContent);
    this.menuContent.addChild(await createMenuBackground());
    if (!welcomePlayed) {
      playSound(sfxPath('welcome.ogg'), 0.55);
      welcomePlayed = true;
    }

    const centerX = DESIGN.width / 2;
    const logoTex = await loadTexture(LOGO_PATH);
    this.logo = new MenuLogo(logoTex, centerX, UI_TITLE_MAIN_MENU_Y, LOGO_HEIGHT);
    this.menuContent.addChild(this.logo);

    const btnW = MENU_BTN_WIDTH;
    const btnX = centerX - btnW / 2;
    const btnStep = menuRowStep(MENU_ITEM_FONT_SIZE);
    let btnY = MENU_BTN_START_Y;

    this.menuContent.addChild(this.makeButton('menu-play', 'Play', btnX, btnY, btnW, onPlay));
    btnY += btnStep;

    this.menuContent.addChild(this.makeButton('menu-settings', 'Options', btnX, btnY, btnW, onSettings));
    btnY += btnStep;
    this.menuContent.addChild(this.makeButton('menu-how-to-play', 'How to play', btnX, btnY, btnW, () => this.showHowToPlay()));
    btnY += btnStep;
    this.menuContent.addChild(this.makeButton('menu-credits', 'Credits', btnX, btnY, btnW, onCredits));

    const footerLineH = kewlLineHeight(MENU_FOOTER_FONT_SIZE);
    const footerY = DESIGN.height - FOOTER_MARGIN - footerLineH;

    const versionText = `Version: ${packageJson.version}`;
    this.menuContent.addChild(
      this.makeFooterButton(
        'menu-version',
        versionText,
        FOOTER_MARGIN - kewlTextLeftInset(MENU_FOOTER_FONT_SIZE),
        footerY,
        () => window.open(VERSION_URL, '_blank', 'noopener,noreferrer'),
      ),
    );

    const playerName = playerProfile.getNick();
    const playerNameW = kewlMeasuredSize(playerName, MENU_FOOTER_FONT_SIZE).width;
    this.menuContent.addChild(
      this.makeFooterButton(
        'menu-player',
        playerName,
        DESIGN.width - FOOTER_MARGIN - playerNameW - 20,
        footerY,
        () => this.showPersonalScores(),
        'right',
        playerNameW,
      ),
    );

    this.mainActions = [...this.menuActions];
  }

  private makeButton(
    id: string,
    label: string,
    x: number,
    y: number,
    w: number,
    onClick: () => void,
  ): Container {
    const { view, action } = createFocusableButton({
      id,
      label,
      x,
      y,
      w,
      center: true,
      fontSize: MENU_ITEM_FONT_SIZE,
      onPress: onClick,
    });
    this.menuActions.push(action);
    return view;
  }

  private makeFooterButton(
    id: string,
    label: string,
    x: number,
    y: number,
    onPress: () => void,
    align: 'left' | 'right' = 'left',
    w?: number,
  ): Container {
    const { view, action } = createFocusableButton({
      id,
      label,
      x,
      y,
      w,
      align,
      fontSize: MENU_FOOTER_FONT_SIZE,
      onPress,
    });
    this.menuActions.push(action);
    return view;
  }
}
