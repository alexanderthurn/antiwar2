import { BitmapText, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import type { LevelPack } from '../data/types';
import { loadTexture } from '../data/AssetLoader';
import {
  kewlLineHeight,
  kewlMeasuredSize,
  kewlString,
  kewlText,
} from './KewlFont';

const CARD_W = DESIGN.width / 2;
const CARD_H = DESIGN.height / 2;
const PAD = 28;
const UPPER_GAP = 16;
const RIGHT_COL_W = 300;
const TITLE_SIZE = 32;
const META_SIZE = 20;
const DESC_SIZE = 20;
const PANEL_RADIUS = 10;
const PANEL_FILL = { color: 0x000000, alpha: 0.92 };
const PANEL_STROKE = { color: 0x444444, width: 2, alpha: 0.9 };
const HEADER_CLEAR = 80;
const DIVIDER_COLOR = 0x333333;
/** Expand top-right map zone so nearby entries flip the card to bottom-left. */
const TOP_RIGHT_ZONE_MARGIN = 80;

const CARD_TOP_RIGHT = { x: DESIGN.width - CARD_W, y: HEADER_CLEAR };
const CARD_BOTTOM_LEFT = { x: 0, y: DESIGN.height - CARD_H };

export interface CampaignPreviewAnchor {
  x: number;
  y: number;
}

function wrapKewlText(text: string, maxWidth: number, size: number, maxLines: number): string {
  const words = kewlString(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (kewlMeasuredSize(test, size).width <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length >= maxLines && words.length > 0) {
    const last = lines[lines.length - 1]!;
    lines[lines.length - 1] = last.length > 3 ? `${last.slice(0, -3)}...` : `${last}...`;
  }
  return lines.join('\n');
}

export function deriveLevelDifficulty(pack: LevelPack): string {
  if (pack.meta.difficulty) return pack.meta.difficulty;
  if (/training/i.test(pack.meta.name)) return 'Tutorial';
  if (/boss/i.test(pack.meta.name)) return 'Boss';
  const rounds = pack.rounds.length;
  if (rounds <= 3) return 'Easy';
  if (rounds <= 7) return 'Normal';
  if (rounds <= 10) return 'Hard';
  return 'Very Hard';
}

function isNearTopRightZone(anchor: CampaignPreviewAnchor): boolean {
  return (
    anchor.x >= DESIGN.width / 2 - TOP_RIGHT_ZONE_MARGIN &&
    anchor.y <= DESIGN.height / 2 + TOP_RIGHT_ZONE_MARGIN
  );
}

function placeCard(anchor: CampaignPreviewAnchor): { x: number; y: number } {
  return isNearTopRightZone(anchor) ? CARD_BOTTOM_LEFT : CARD_TOP_RIGHT;
}

/** Half-screen level detail card shown when hovering a campaign map node. */
export class CampaignLevelPreview extends Container {
  private card = new Container();
  private background = new Graphics();
  private divider = new Graphics();
  private titleText!: BitmapText;
  private difficultyLine!: BitmapText;
  private authorLine!: BitmapText;
  private descriptionText!: BitmapText;
  private thumbSprite!: Sprite;
  private thumbTextures = new Map<string, Texture>();
  private activeLevelIndex: number | null = null;

  constructor() {
    super();
    this.visible = false;
    this.eventMode = 'none';
    this.card.eventMode = 'none';
    this.addChild(this.card);
    this.buildChrome();
  }

  private buildChrome(): void {
    this.background.roundRect(0, 0, CARD_W, CARD_H, PANEL_RADIUS).fill(PANEL_FILL);
    this.background.roundRect(0, 0, CARD_W, CARD_H, PANEL_RADIUS).stroke(PANEL_STROKE);
    this.card.addChild(this.background);

    this.divider.eventMode = 'none';
    this.card.addChild(this.divider);

    this.thumbSprite = new Sprite();
    this.card.addChild(this.thumbSprite);

    this.titleText = kewlText({ text: '', size: TITLE_SIZE, anchorX: 1 });
    this.card.addChild(this.titleText);

    this.difficultyLine = kewlText({ text: '', size: META_SIZE, anchorX: 1 });
    this.card.addChild(this.difficultyLine);
    this.authorLine = kewlText({ text: '', size: META_SIZE, anchorX: 1 });
    this.card.addChild(this.authorLine);

    this.descriptionText = kewlText({ text: '', size: DESC_SIZE });
    this.card.addChild(this.descriptionText);
  }

  private layoutCard(pack: LevelPack, tex: Texture | undefined): void {
    const midY = CARD_H / 2;
    const descW = CARD_W - PAD * 2;
    const descAreaTop = midY + PAD;
    const descAreaH = CARD_H - descAreaTop - PAD;
    const descLineH = kewlLineHeight(DESC_SIZE);
    const maxDescLines = Math.max(1, Math.floor(descAreaH / descLineH));

    this.divider.clear();
    this.divider.moveTo(PAD, midY).lineTo(CARD_W - PAD, midY).stroke({ color: DIVIDER_COLOR, width: 2 });

    const upperTop = PAD;
    const upperBottom = midY - 12;
    const upperH = upperBottom - upperTop;
    const rightX = CARD_W - PAD;
    const thumbW = CARD_W - PAD * 2 - RIGHT_COL_W - UPPER_GAP;
    const thumbH = upperH;
    const thumbX = PAD;
    const thumbY = upperTop;

    if (tex) {
      const scale = Math.min(thumbW / tex.width, thumbH / tex.height);
      this.thumbSprite.texture = tex;
      this.thumbSprite.scale.set(scale);
      this.thumbSprite.position.set(
        thumbX + (thumbW - tex.width * scale) / 2,
        thumbY + (thumbH - tex.height * scale) / 2,
      );
    }

    let rightY = upperTop;
    this.titleText.text = pack.meta.name;
    this.titleText.position.set(rightX, rightY);
    rightY += kewlLineHeight(TITLE_SIZE) + 12;

    const metaLineH = kewlLineHeight(META_SIZE);
    this.difficultyLine.text = `Difficulty: ${deriveLevelDifficulty(pack)}`;
    this.difficultyLine.position.set(rightX, rightY);
    rightY += metaLineH + 8;
    this.authorLine.text = `Author: ${pack.meta.author}`;
    this.authorLine.position.set(rightX, rightY);

    this.descriptionText.text = wrapKewlText(
      pack.meta.description,
      descW,
      DESC_SIZE,
      maxDescLines,
    );
    this.descriptionText.position.set(PAD, descAreaTop);
  }

  async preloadThumbnails(packs: LevelPack[]): Promise<void> {
    const paths = new Set<string>();
    for (const pack of packs) {
      paths.add(pack.meta.thumbnail ?? 'assets/gfx/thumbs/desert.png');
    }
    await Promise.all(
      [...paths].map(async (path) => {
        if (!this.thumbTextures.has(path)) {
          this.thumbTextures.set(path, await loadTexture(path));
        }
      }),
    );
  }

  show(levelIndex: number, pack: LevelPack, anchor: CampaignPreviewAnchor): void {
    this.activeLevelIndex = levelIndex;
    const thumbPath = pack.meta.thumbnail ?? 'assets/gfx/thumbs/desert.png';
    const tex = this.thumbTextures.get(thumbPath);
    this.layoutCard(pack, tex);

    const pos = placeCard(anchor);
    this.card.position.set(pos.x, pos.y);
    this.visible = true;
  }

  hideIfLevel(levelIndex: number): void {
    if (this.activeLevelIndex === levelIndex) this.hide();
  }

  hide(): void {
    this.activeLevelIndex = null;
    this.visible = false;
  }
}
