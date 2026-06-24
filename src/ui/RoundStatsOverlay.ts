import { Container, Graphics } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import type { PlayerManager } from '../multiplayer/PlayerManager';
import { kewlBlockGap, kewlLineHeight, kewlText } from './KewlFont';

/** Brief per-player summary shown when a round ends (before shop). */
export class RoundStatsOverlay extends Container {
  constructor(players: PlayerManager, moneyEarned: number) {
    super();

    const panel = new Graphics();
    panel.roundRect(DESIGN.width / 2 - 300, 100, 600, 200, 10).fill({
      color: 0x000000,
      alpha: 0.65,
    });
    this.addChild(panel);

    const title = kewlText({ text: `Round complete  +$${moneyEarned}`, size: 26, anchorX: 0.5 });
    title.position.set(DESIGN.width / 2, 112);
    this.addChild(title);

    const active = players.active();
    let y = 112 + kewlLineHeight(26) + kewlBlockGap(26);
    const lineStep = kewlLineHeight(17) + kewlBlockGap(8);
    if (active.length === 0) {
      const empty = kewlText({ text: 'No active players', size: 18, anchorX: 0.5 });
      empty.position.set(DESIGN.width / 2, y);
      this.addChild(empty);
      return;
    }

    for (const slot of active) {
      const s = slot.stats;
      const line = kewlText({
        text: `${slot.label()}  -  rk ${s.rocketsFired} / hit ${s.hits} / kill ${s.kills} / guided ${s.lockOnKills} / dmg ${s.damageDealt}`,
        size: 17,
        anchorX: 0.5,
      });
      line.position.set(DESIGN.width / 2, y);
      this.addChild(line);
      y += lineStep;
    }
  }
}
