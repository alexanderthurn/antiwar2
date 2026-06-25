import { Container } from 'pixi.js';
import packageJson from '../../package.json';
import { playSound, sfxPath } from '../audio/SoundManager';
import { DESIGN } from '../core/DesignSpace';
import { loadTexture } from '../data/AssetLoader';
import { createFocusableButton } from '../input/FocusableButton';
import type { MenuActionsHost } from '../input/MenuActionsHost';
import type { UiAction } from '../input/UiMenuController';
import { createMenuBackground } from '../ui/MenuBackground';
import { MenuLogo } from '../ui/MenuLogo';
import { HowToPlayOverlay } from '../ui/HowToPlayOverlay';
import { SettingsOverlay } from '../ui/SettingsOverlay';
import { kewlLineHeight, kewlMeasuredSize, kewlTextLeftInset, UI_TITLE_MAIN_MENU_Y } from '../ui/KewlFont';

const LOGO_PATH = 'assets/gfx/logo.png';
const LOGO_HEIGHT = 200;
const FOOTER_MARGIN = 21;
const FOOTER_FONT_SIZE = 21;
const CREDIT_URL = 'https://feuerware.com';

let welcomePlayed = false;
const VERSION_URL = 'https://github.com/alexanderthurn/antiwar2';

export class MainMenuScene extends Container implements MenuActionsHost {
  private menuActions: UiAction[] = [];
  private mainActions: UiAction[] = [];
  private menuContent = new Container();
  private settingsOverlay: SettingsOverlay | null = null;
  private howToPlayOverlay: HowToPlayOverlay | null = null;
  private logo: MenuLogo | null = null;

  constructor(
    onCampaign: () => void,
    onCredits: () => void,
    onSettings: () => void,
  ) {
    super();
    void this.build(onCampaign, onCredits, onSettings);
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

  getMenuActions(): UiAction[] {
    return (
      this.howToPlayOverlay?.getMenuActions()
      ?? this.settingsOverlay?.getMenuActions()
      ?? this.mainActions
    );
  }

  onMenuCancel(): void {
    if (this.howToPlayOverlay) this.closeHowToPlay();
    else if (this.settingsOverlay) this.closeSettings();
  }

  private async build(
    onCampaign: () => void,
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

    const btnW = 420;
    const btnX = centerX - btnW / 2;
    const btnSize = 28;
    const btnStep = kewlLineHeight(btnSize) + 10;
    let btnY = 400;

    this.menuContent.addChild(this.makeButton('menu-campaign', 'Campaign', btnX, btnY, btnW, onCampaign));
    btnY += btnStep;
    this.menuContent.addChild(this.makeButton('menu-settings', 'Options', btnX, btnY, btnW, onSettings));
    btnY += btnStep;
    this.menuContent.addChild(this.makeButton('menu-how-to-play', 'How to play', btnX, btnY, btnW, () => this.showHowToPlay()));
    btnY += btnStep;
    this.menuContent.addChild(this.makeButton('menu-credits', 'Credits', btnX, btnY, btnW, onCredits));

    const footerLineH = kewlLineHeight(FOOTER_FONT_SIZE);
    const footerY = DESIGN.height - FOOTER_MARGIN - footerLineH;

    const versionText = `Version: ${packageJson.version}`;
    this.menuContent.addChild(
      this.makeFooterLink(
        'menu-version',
        versionText,
        FOOTER_MARGIN - kewlTextLeftInset(FOOTER_FONT_SIZE),
        footerY,
        VERSION_URL,
      ),
    );

    const creditText = 'Feuerware';
    const creditW = kewlMeasuredSize(creditText, FOOTER_FONT_SIZE).width;
    this.menuContent.addChild(
      this.makeFooterLink(
        'menu-credit',
        creditText,
        DESIGN.width - FOOTER_MARGIN - creditW - 20,
        footerY,
        CREDIT_URL,
        'right',
        creditW,
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
      fontSize: 28,
      onPress: onClick,
    });
    this.menuActions.push(action);
    return view;
  }

  private makeFooterLink(
    id: string,
    label: string,
    x: number,
    y: number,
    url: string,
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
      fontSize: FOOTER_FONT_SIZE,
      onPress: () => window.open(url, '_blank', 'noopener,noreferrer'),
    });
    this.menuActions.push(action);
    return view;
  }
}
