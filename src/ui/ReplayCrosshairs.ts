import { Container, Sprite, type Texture } from 'pixi.js';
import type { PlayerSlot } from '../multiplayer/PlayerSlot';

/** Ghost crosshairs shown during replay — separate from live player sprites. */
export class ReplayCrosshairs extends Container {
  private readonly ghosts = new Map<PlayerSlot, Sprite>();

  setTexture(tex: Texture): void {
    for (const ghost of this.ghosts.values()) {
      ghost.texture = tex;
    }
  }

  sync(slots: PlayerSlot[], visible: boolean): void {
    for (const slot of slots) {
      let ghost = this.ghosts.get(slot);
      if (!ghost) {
        ghost = new Sprite();
        ghost.anchor.set(0.5);
        ghost.alpha = 0.92;
        ghost.label = `replay-crosshair-p${slot.index + 1}`;
        this.ghosts.set(slot, ghost);
        this.addChild(ghost);
      }
      const show = visible && slot.active;
      ghost.visible = show;
      if (!show) continue;
      ghost.position.set(slot.crosshairX, slot.crosshairY);
      ghost.rotation = slot.crosshair.rotation;
      ghost.tint = slot.crosshair.tint;
      ghost.scale.copyFrom(slot.crosshair.scale);
    }
  }

  destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.ghosts.clear();
    super.destroy(options);
  }
}
