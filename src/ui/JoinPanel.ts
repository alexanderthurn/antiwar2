import { Container, Graphics, BitmapText } from 'pixi.js';
import { DESIGN, PLAYER_COLORS } from '../core/DesignSpace';
import type { InputSystem } from '../input/InputSystem';
import type { PlayerManager } from '../multiplayer/PlayerManager';
import { kewlBlockGap, kewlLineHeight, kewlText } from './KewlFont';

const ROW_W = 260;
const ROW_H = 28;
const ROW_X = 0;
const LABEL_SIZE = 12;
const STATS_SIZE = 10;

export class JoinPanel extends Container {
  private rows: Container[] = [];
  private rowHighlights: Graphics[] = [];
  private rowLabels: BitmapText[] = [];
  private rowStats: BitmapText[] = [];
  private onToggle: (slotIndex: number) => void;
  private focusSlot: number | null = null;

  constructor(players: PlayerManager, onToggle: (slotIndex: number) => void) {
    super();
    this.onToggle = onToggle;

    const title = kewlText({ text: 'Players', size: 14 });
    title.position.set(0, 0);
    this.addChild(title);

    const rowStep = kewlLineHeight(LABEL_SIZE) + kewlBlockGap(6);
    let rowY = kewlLineHeight(14) + kewlBlockGap(10);
    for (let i = 0; i < 5; i++) {
      const { row, highlight, label, stats } = this.makeRow(i);
      row.y = rowY;
      this.addChild(row);
      this.rows.push(row);
      this.rowHighlights.push(highlight);
      this.rowLabels.push(label);
      this.rowStats.push(stats);
      rowY += rowStep;
    }

    const hint = kewlText({ text: 'D-pad up/down row / A toggle / B leave', size: 9 });
    hint.position.set(0, rowY + kewlBlockGap(8));
    this.addChild(hint);

    this.position.set(DESIGN.width - 380, 16);
    this.eventMode = 'static';
    this.refresh(players);
  }

  hasFocus(): boolean {
    return this.focusSlot !== null;
  }

  handleInput(input: InputSystem): void {
    if (input.joinNavigatePrev()) {
      this.moveFocus(-1);
    } else if (input.joinNavigateNext()) {
      this.moveFocus(1);
    }

    if (this.focusSlot !== null && input.joinConfirmPressed()) {
      this.onToggle(this.focusSlot);
    }
  }

  private moveFocus(delta: number): void {
    const slots = [1, 2, 3, 4];
    if (this.focusSlot === null) {
      this.focusSlot = delta > 0 ? slots[0]! : slots[slots.length - 1]!;
    } else {
      const idx = slots.indexOf(this.focusSlot);
      const next = (idx + delta + slots.length * 4) % slots.length;
      this.focusSlot = slots[next]!;
    }
    this.updateHighlights();
  }

  private updateHighlights(): void {
    for (let i = 0; i < this.rowHighlights.length; i++) {
      const hl = this.rowHighlights[i]!;
      hl.visible = this.focusSlot === i && i > 0;
    }
  }

  private makeRow(slotIndex: number): {
    row: Container;
    highlight: Graphics;
    label: BitmapText;
    stats: BitmapText;
  } {
    const row = new Container();
    row.eventMode = 'static';
    row.cursor = slotIndex === 0 ? 'default' : 'pointer';

    const highlight = new Graphics();
    highlight.roundRect(ROW_X - 4, -2, ROW_W, ROW_H, 4).stroke({
      color: 0xffcc44,
      width: 2,
    });
    highlight.visible = false;
    row.addChild(highlight);

    const dot = new Graphics();
    dot.circle(0, 0, 5).fill({ color: PLAYER_COLORS[slotIndex] ?? 0xffffff });
    dot.position.set(10, 8);
    row.addChild(dot);

    const label = kewlText({ text: '', size: LABEL_SIZE });
    label.position.set(22, 0);
    row.addChild(label);

    const stats = kewlText({ text: '', size: STATS_SIZE });
    stats.position.set(22, kewlLineHeight(LABEL_SIZE));
    row.addChild(stats);

    if (slotIndex > 0) {
      row.on('pointertap', () => {
        this.focusSlot = slotIndex;
        this.updateHighlights();
        this.onToggle(slotIndex);
      });
    }

    return { row, highlight, label, stats };
  }

  refresh(players: PlayerManager): void {
    for (let i = 0; i < this.rowLabels.length; i++) {
      const slot = players.slot(i)!;
      const label = this.rowLabels[i]!;
      const stats = this.rowStats[i]!;
      if (slot.active) {
        const s = slot.stats;
        const leaveHint = i > 0 ? '  [B / tap to leave]' : '';
        label.text = `${slot.label()}  ${slot.deviceLabel()}${leaveHint}`;
        label.style.fill = slot.color();
        stats.text =
          `rk ${s.rocketsFired} · hit ${s.hits} · kill ${s.kills} · guided ${s.lockOnKills} · dmg ${s.damageDealt}`;
        stats.visible = true;
      } else {
        const status = i === 0 ? 'Mouse' : '— A to join / tap row';
        label.text = `${slot.label()}  ${status}`;
        label.style.fill = 0x888888;
        stats.visible = false;
      }
    }
    this.updateHighlights();
  }
}
