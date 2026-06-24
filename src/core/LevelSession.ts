import type { LevelPack } from '../data/types';
import { distributeRocketCaps } from '../multiplayer/rocketCaps';

export type UpgradeKey =
  | 'human'
  | 'humanHp'
  | 'humanMoney'
  | 'rocket'
  | 'rocketSpeed'
  | 'rocketPower'
  | 'aim';

export const UPGRADE_KEYS: UpgradeKey[] = [
  'human',
  'humanHp',
  'humanMoney',
  'rocket',
  'rocketSpeed',
  'rocketPower',
  'aim',
];

export class LevelSession {
  money = 0;
  humanHp = 100;
  humanMoney = 300;
  maxTeamRockets = 3;
  rocketPower = 50;
  rocketSpeed = 6;
  aimTimeMs = 1000;
  /** Baseline aim time from level config (for guided-rocket damage ratio). */
  baseAimTimeMs = 1000;
  humanPriceBase = 100;

  private prices = new Map<UpgradeKey, number>();
  private purchaseCounts = new Map<UpgradeKey, number>();

  initFromLevel(pack: LevelPack): void {
    const c = pack.config;
    this.money = c.startMoney;
    this.humanHp = c.startHumanHp;
    this.humanMoney = c.startHumanMoney;
    this.maxTeamRockets = c.startRockets;
    this.rocketPower = c.startRocketPower;
    this.rocketSpeed = c.startRocketSpeed;
    this.aimTimeMs = c.startAimTime;
    this.baseAimTimeMs = c.startAimTime;
    this.humanPriceBase = c.upgrades.human?.price ?? 100;
    this.purchaseCounts.clear();

    for (const key of UPGRADE_KEYS) {
      this.prices.set(key, c.upgrades[key]?.price ?? 100);
    }
  }

  purchaseSnapshot(): Partial<Record<UpgradeKey, number>> {
    const out: Partial<Record<UpgradeKey, number>> = {};
    for (const key of UPGRADE_KEYS) {
      const count = this.purchaseCounts.get(key);
      if (count) out[key] = count;
    }
    return out;
  }

  /** Apply shop upgrades without spending money (dev URL bootstrap). Returns extra civilians to spawn. */
  applyDevPurchases(purchases: Partial<Record<UpgradeKey, number>>, pack: LevelPack): number {
    let humanSpawns = 0;
    for (const key of UPGRADE_KEYS) {
      const count = purchases[key] ?? 0;
      for (let i = 0; i < count; i++) {
        if (this.applyUpgradePurchase(key, pack, true) && key === 'human') humanSpawns++;
      }
    }
    return humanSpawns;
  }

  price(key: UpgradeKey): number {
    return this.prices.get(key) ?? 0;
  }

  rocketCaps(activePlayers: number): number[] {
    return distributeRocketCaps(this.maxTeamRockets, activePlayers);
  }

  tryBuy(key: UpgradeKey, pack: LevelPack): boolean {
    const def = pack.config.upgrades[key];
    if (!def) return false;
    const cost = this.prices.get(key) ?? def.price;
    if (this.money < cost) return false;

    this.money -= cost;
    return this.applyUpgradePurchase(key, pack, true);
  }

  private applyUpgradePurchase(key: UpgradeKey, pack: LevelPack, trackPurchase: boolean): boolean {
    const def = pack.config.upgrades[key];
    if (!def) return false;

    this.prices.set(key, Math.round((this.prices.get(key) ?? def.price) * def.priceFactor));
    if (trackPurchase) {
      this.purchaseCounts.set(key, (this.purchaseCounts.get(key) ?? 0) + 1);
    }

    switch (key) {
      case 'humanHp':
        if (def.statFactor) this.humanHp *= def.statFactor;
        break;
      case 'humanMoney':
        if (def.statFactor) this.humanMoney *= def.statFactor;
        break;
      case 'rocket':
        this.maxTeamRockets += 1;
        break;
      case 'rocketSpeed':
        if (def.statFactor) this.rocketSpeed *= def.statFactor;
        break;
      case 'rocketPower':
        if (def.statFactor) this.rocketPower *= def.statFactor;
        break;
      case 'aim':
        if (def.statFactor) this.aimTimeMs *= def.statFactor;
        break;
      default:
        break;
    }
    return true;
  }

  resetHumanPrice(): void {
    this.prices.set('human', this.humanPriceBase);
  }

  payoutSurvivors(aliveCount: number, moneyFactor: number): void {
    this.money += Math.round(aliveCount * this.humanMoney * moneyFactor);
  }
}
