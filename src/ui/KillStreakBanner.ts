import { Container } from 'pixi.js';
import { DESIGN } from '../core/DesignSpace';
import type { KillStreakEvent } from '../systems/KillStreakTracker';
import { kewlText } from './KewlFont';

interface Banner {
  container: Container;
  age: number;
  duration: number;
}

export class KillStreakBanner extends Container {
  private active: Banner[] = [];

  show(event: KillStreakEvent, _color: number): void {
    const container = new Container();
    const label = kewlText({
      text: event.label,
      size: event.streak >= 5 ? 52 : 44,
      anchorX: 0.5,
    });
    label.position.set(DESIGN.width / 2, DESIGN.height / 2 - 120);
    container.addChild(label);

    const sub = kewlText({
      text: `P${event.slotIndex + 1} / ${event.streak} kills`,
      size: 22,
      anchorX: 0.5,
    });
    sub.position.set(DESIGN.width / 2, DESIGN.height / 2 - 70);
    container.addChild(sub);

    this.addChild(container);
    this.active.push({ container, age: 0, duration: 1.8 });
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i]!;
      b.age += dt;
      const t = b.age / b.duration;
      b.container.alpha = 1 - t ** 2;
      b.container.y = -t * 24;
      if (b.age >= b.duration) {
        b.container.destroy({ children: true });
        this.active.splice(i, 1);
      }
    }
  }

  clear(): void {
    for (const b of this.active) b.container.destroy({ children: true });
    this.active.length = 0;
  }
}
