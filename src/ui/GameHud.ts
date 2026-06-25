import { Container, Sprite, type Texture, BitmapText } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import { kewlText } from './KewlFont';

const PAD_X = 24;
const PAD_Y = 16;
const ROW_Y = PAD_Y + 14;
const ROCKET_ICON_LEN = 28;
const ROCKET_GAP = 6;
const HUD_FONT = 22;

function formatElapsed(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export class GameHud extends Container {
  private readonly rockets = new Container();
  private readonly rocketSprites: Sprite[] = [];
  private readonly timeText: BitmapText;
  private readonly moneyText: BitmapText;

  constructor(private readonly rocketTex: Texture) {
    super();
    this.eventMode = 'none';

    this.rockets.position.set(PAD_X, PAD_Y);
    this.addChild(this.rockets);

    this.timeText = kewlText({
      text: '00:00:00',
      size: HUD_FONT,
      align: 'center',
      anchorX: 0.5,
      anchorY: 0.5,
    });
    this.timeText.position.set(DESIGN.width / 2, ROW_Y);
    this.addChild(this.timeText);

    this.moneyText = kewlText({
      text: '$0',
      size: HUD_FONT,
      align: 'right',
      anchorX: 1,
      anchorY: 0.5,
    });
    this.moneyText.position.set(DESIGN.width - PAD_X, ROW_Y);
    this.addChild(this.moneyText);
  }

  refresh(availableRockets: number, money: number, elapsedSec: number): void {
    this.syncRockets(availableRockets);
    this.timeText.text = formatElapsed(elapsedSec);
    this.moneyText.text = `$${Math.floor(money)}`;
  }

  private syncRockets(count: number): void {
    while (this.rocketSprites.length < count) {
      const icon = new Sprite(this.rocketTex);
      icon.anchor.set(0.5);
      icon.rotation = -Math.PI / 2;
      const scale = ROCKET_ICON_LEN / Math.max(icon.texture.width, 1);
      icon.scale.set(scale);
      this.rocketSprites.push(icon);
      this.rockets.addChild(icon);
    }

    while (this.rocketSprites.length > count) {
      const icon = this.rocketSprites.pop()!;
      this.rockets.removeChild(icon);
      icon.destroy();
    }

    let x = 0;
    for (const icon of this.rocketSprites) {
      const w = icon.texture.height * icon.scale.y;
      const h = icon.texture.width * icon.scale.x;
      icon.position.set(x + w / 2, h / 2);
      x += w + ROCKET_GAP;
    }
  }
}
