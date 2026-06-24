import type { UpgradeKey } from './LevelSession';
import { UPGRADE_KEYS } from './LevelSession';

/** Set to `false` before release — disables reading and writing dev URL params. */
export const DEV_DEEP_LINK_ENABLED = true;

export interface DevGameState {
  levelIndex: number;
  roundIndex: number;
  upgrades: Partial<Record<UpgradeKey, number>>;
  money?: number;
}

function parseUpgradeParam(raw: string | null): Partial<Record<UpgradeKey, number>> {
  if (!raw?.trim()) return {};
  const upgrades: Partial<Record<UpgradeKey, number>> = {};
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [keyRaw, countRaw] = trimmed.split(':');
    const key = keyRaw?.trim() as UpgradeKey;
    if (!UPGRADE_KEYS.includes(key)) {
      console.warn(`[dev-url] Unknown upgrade "${keyRaw}"`);
      continue;
    }
    const count = countRaw ? Math.max(1, parseInt(countRaw, 10) || 1) : 1;
    upgrades[key] = (upgrades[key] ?? 0) + count;
  }
  return upgrades;
}

function serializeUpgrades(upgrades: Partial<Record<UpgradeKey, number>>): string {
  const parts: string[] = [];
  for (const key of UPGRADE_KEYS) {
    const count = upgrades[key];
    if (!count) continue;
    parts.push(count > 1 ? `${key}:${count}` : key);
  }
  return parts.join(',');
}

/** Parse `?level=1&round=2&upgrades=rocket:2,aim&money=5000` (level/round are 1-based). */
export function parseDevUrl(): DevGameState | null {
  if (!DEV_DEEP_LINK_ENABLED) return null;
  const params = new URLSearchParams(window.location.search);
  const levelRaw = params.get('level');
  if (!levelRaw) return null;

  const levelIndex = parseInt(levelRaw, 10) - 1;
  if (!Number.isFinite(levelIndex) || levelIndex < 0) {
    console.warn(`[dev-url] Invalid level "${levelRaw}"`);
    return null;
  }

  const roundRaw = params.get('round') ?? params.get('stage');
  const roundIndex = roundRaw ? Math.max(0, parseInt(roundRaw, 10) - 1) : 0;
  if (roundRaw && !Number.isFinite(roundIndex)) {
    console.warn(`[dev-url] Invalid round "${roundRaw}"`);
    return null;
  }

  const upgrades = parseUpgradeParam(params.get('upgrades'));
  const moneyRaw = params.get('money');
  const money = moneyRaw != null ? parseInt(moneyRaw, 10) : undefined;

  return { levelIndex, roundIndex, upgrades, money: Number.isFinite(money) ? money : undefined };
}

/** Update the browser URL to reflect the current dev jump-in point (no navigation). */
export function syncDevUrl(state: DevGameState): void {
  if (!DEV_DEEP_LINK_ENABLED) return;

  const params = new URLSearchParams();
  params.set('level', String(state.levelIndex + 1));
  params.set('round', String(state.roundIndex + 1));

  const upgradeStr = serializeUpgrades(state.upgrades);
  if (upgradeStr) params.set('upgrades', upgradeStr);
  if (state.money != null) params.set('money', String(Math.floor(state.money)));

  const query = params.toString();
  const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState(null, '', url);
}

/** Strip dev params when leaving gameplay (e.g. back to main menu). */
export function clearDevUrl(): void {
  if (!DEV_DEEP_LINK_ENABLED) return;
  if (!window.location.search) return;
  window.history.replaceState(null, '', window.location.pathname);
}
