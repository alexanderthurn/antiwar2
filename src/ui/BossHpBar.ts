import { Container, Graphics, BitmapText } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import type { CombatEntity } from '../entities/CombatEntity';
import { kewlText } from './KewlFont';

export class BossHpBar extends Container {
  private barBg = new Graphics();
  private barFill = new Graphics();
  private nameText: BitmapText;
  private boss: CombatEntity | null = null;
  private bossName = 'Boss';

  constructor() {
    super();
    this.nameText = kewlText({ text: '', size: 18 });
    this.position.set(DESIGN.width / 2 - 280, 88);
    this.addChild(this.barBg, this.barFill, this.nameText);
    this.nameText.position.set(0, -26);
    this.visible = false;
  }

  track(entity: CombatEntity, name: string): void {
    this.boss = entity;
    this.bossName = name;
    this.visible = true;
    this.refresh();
  }

  clear(): void {
    this.boss = null;
    this.visible = false;
  }

  refresh(): void {
    if (!this.boss?.alive) {
      this.visible = false;
      return;
    }
    const w = 560;
    const h = 18;
    const ratio = Math.max(0, Math.min(1, this.boss.hp / this.boss.maxHp));

    this.barBg.clear();
    this.barBg.roundRect(0, 0, w, h, 4).fill({ color: 0x111111, alpha: 0.85 });
    this.barBg.stroke({ color: 0x884444, width: 2 });

    this.barFill.clear();
    if (ratio > 0) {
      this.barFill.roundRect(2, 2, (w - 4) * ratio, h - 4, 3).fill({
        color: ratio > 0.35 ? 0xcc2222 : 0xff4400,
        alpha: 0.95,
      });
    }

    this.nameText.text = `${this.bossName}  ${Math.ceil(this.boss.hp).toLocaleString()} / ${this.boss.maxHp.toLocaleString()}`;
  }
}
