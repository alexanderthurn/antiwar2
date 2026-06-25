import { Container } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import { loadTexture } from '../data/AssetLoader';
import { createFocusableButton } from '../input/FocusableButton';
import type { MenuActionsHost } from '../input/MenuActionsHost';
import type { UiAction } from '../input/UiMenuController';
import { createImageFocusButton } from '../ui/ImageFocusButton';
import { createMenuBackground } from '../ui/MenuBackground';
import { kewlBlockGap, kewlLineHeight, kewlMeasuredSize, kewlText, kewlTextLeftInset } from '../ui/KewlFont';

const FOOTER_MARGIN = 21;
const FOOTER_FONT_SIZE = 21;
const LOGO_HEIGHT = 56;
const LOGO_GAP = 36;
const IMPRINT_URL = 'https://feuerware.com/2025/imprint.html';
const PRIVACY_URL = 'https://feuerware.com/2025/privacy.html';

const THIRD_PARTY_LOGOS = [
  { id: 'credits-logo-fw', image: 'assets/gfx/3rdparty/fw-logo.png', url: 'https://feuerware.com' },
  { id: 'credits-logo-pixijs', image: 'assets/gfx/3rdparty/pixijs-logo.png', url: 'https://pixijs.com' },
  {
    id: 'credits-logo-android',
    image: 'assets/gfx/3rdparty/android-logo.png',
    url: 'https://play.google.com/store',
  },
  {
    id: 'credits-logo-steam',
    image: 'assets/gfx/3rdparty/steam-logo.png',
    url: 'https://store.steampowered.com',
  },
] as const;

function openUrl(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export class CreditsScene extends Container implements MenuActionsHost {
  private menuActions: UiAction[] = [];
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
    const title = kewlText({ text: 'Credits', size: 48, anchorX: 0.5 });
    title.position.set(centerX, 100);
    this.addChild(title);

    const body = kewlText({
      text:
        'Antiwar\n\n' +
        'made by Feuerware\n' +
        'and friends',
      size: 24,
      align: 'center',
      anchorX: 0.5,
    });
    const bodyY = 100 + kewlLineHeight(48) + kewlBlockGap(48);
    body.position.set(centerX, bodyY);
    this.addChild(body);

    const logoRowY = bodyY + body.height + kewlBlockGap(24);
    const textures = await Promise.all(THIRD_PARTY_LOGOS.map((logo) => loadTexture(logo.image)));
    const logoSizes = textures.map((tex) => ({
      w: LOGO_HEIGHT * (tex.width / tex.height),
      h: LOGO_HEIGHT,
    }));
    const rowWidth =
      logoSizes.reduce((sum, size) => sum + size.w, 0) + LOGO_GAP * (logoSizes.length - 1);
    let logoX = centerX - rowWidth / 2;

    for (let i = 0; i < THIRD_PARTY_LOGOS.length; i++) {
      const logo = THIRD_PARTY_LOGOS[i]!;
      const size = logoSizes[i]!;
      const { view, action } = createImageFocusButton({
        id: logo.id,
        x: logoX,
        y: logoRowY,
        w: size.w,
        h: size.h,
        icon: textures[i]!,
        onPress: () => openUrl(logo.url),
      });
      this.addChild(view);
      this.menuActions.push(action);
      logoX += size.w + LOGO_GAP;
    }

    const footerLineH = kewlLineHeight(FOOTER_FONT_SIZE);
    const footerY = DESIGN.height - FOOTER_MARGIN - footerLineH;

    this.addChild(
      this.makeFooterLink(
        'credits-imprint',
        'Imprint',
        FOOTER_MARGIN - kewlTextLeftInset(FOOTER_FONT_SIZE),
        footerY,
        IMPRINT_URL,
      ),
    );

    const privacyText = 'Data Privacy';
    const privacyW = kewlMeasuredSize(privacyText, FOOTER_FONT_SIZE).width;
    this.addChild(
      this.makeFooterLink(
        'credits-privacy',
        privacyText,
        DESIGN.width - FOOTER_MARGIN - privacyW - 20,
        footerY,
        PRIVACY_URL,
        'right',
        privacyW,
      ),
    );

    this.addChild(
      this.makeButton('credits-back', 'Back', centerX - 100, DESIGN.height - 100, 200, this.onBack),
    );
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
      fontSize: 20,
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
