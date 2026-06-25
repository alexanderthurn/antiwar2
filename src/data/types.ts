import { publicUrl } from '../core/PublicPath';
import type { LevelSoundsConfig } from '../audio/LevelSounds';

export interface ExplosionDef {
  type: number;
  power: number;
  range: number;
  lifetime: number;
}

export interface BombDef {
  image: string;
  scale: [number, number];
  hp: number;
  damage: number;
  speed: number;
  rotationSpeed: number;
  explosion: ExplosionDef;
  trail: number;
  checkOutOfScreen: boolean;
  onDeath?: { bomb: string; count: number };
}

export interface AirplaneDef {
  hp: number;
  speed: number;
  rotationSpeed: number;
  weapons: string[];
  ai: string;
  aiParams: [number, number, number];
  drawStyle: number;
  image: string;
  scale: [number, number];
  /** v1 SCREAM — played when the plane is hit but not destroyed. */
  scream?: string;
  /** v1 LAST_SCREAM — played when the plane is destroyed. */
  lastScream?: string;
  /** v1 IS_STEALTHED — seconds per stealth/visible phase (0 = off). */
  stealthTicks?: number;
}

export interface SpawnDef {
  kind: 'airplane' | 'helper';
  type: string;
  x: number;
  y: number;
  angle: number;
}

export interface RoundDef {
  name: string;
  weather: number[];
  intro?: { text?: string; image?: string; time?: number; sound?: string };
  winSound?: string;
  maxAirplanes: number;
  endmaster: number;
  rumble?: number;
  spawns: SpawnDef[];
}

export interface LevelConfig {
  startMoney: number;
  startHumans: number;
  startRockets: number;
  startHumanHp: number;
  startHumanMoney: number;
  startRocketPower: number;
  startRocketSpeed: number;
  startAimTime: number;
  aimPower: number;
  maxHumans: number;
  maxRockets: number;
  humanHpRefresh: number;
  moneyFactor: number;
  crashingRockets?: number;
  assets: Record<string, string>;
  sounds?: Partial<LevelSoundsConfig>;
  buttonsDisabled?: Partial<Record<string, boolean>>;
  upgrades: Record<string, UpgradeDef>;
}

export interface UpgradeDef {
  price: number;
  priceFactor: number;
  statFactor: number | null;
}

export interface LevelPack {
  schemaVersion: number;
  id: number;
  meta: { name: string; author: string; description: string; thumbnail?: string; difficulty?: string };
  config: LevelConfig;
  bombs: Record<string, BombDef>;
  airplanes: Record<string, AirplaneDef>;
  rounds: RoundDef[];
}

export interface CampaignIndex {
  schemaVersion: number;
  campaignName: string;
  mapImage: string;
  levels: Array<{ file: string; name: string; mapX: number; mapY: number; pathType: number }>;
}

export async function loadLevelPack(file: string): Promise<LevelPack> {
  const res = await fetch(publicUrl(`campaign/${file}`));
  if (!res.ok) throw new Error(`Failed to load campaign/${file}`);
  return res.json() as Promise<LevelPack>;
}

export async function loadCampaignIndex(): Promise<CampaignIndex> {
  const res = await fetch(publicUrl('campaign/index.json'));
  if (!res.ok) throw new Error('Failed to load campaign index');
  return res.json() as Promise<CampaignIndex>;
}
