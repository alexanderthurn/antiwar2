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
  /** v1 IS_FEEDER — civilian knockback on nearby blast. */
  feeder?: number;
}

export interface StoryLimits {
  maxTime?: number;
  maxRoundTime?: number;
  maxRockets?: number;
  maxRoundRockets?: number;
  maxHumanDeaths?: number;
  minMoney?: number;
}

export interface FlightBand {
  minY: number;
  maxY: number;
}

export interface GlideTarget {
  startX: number;
  endX: number;
}

export interface AirplaneAiConfig {
  /** Vertical patrol band (px, design space). */
  flightBand?: FlightBand;
  /** Average seconds between primary weapon drops. */
  dropIntervalSec?: number;
  /** PARACHUTE — horizontal glide targets before ground detonation. */
  glideTarget?: GlideTarget;
}

export interface AirplaneDef {
  hp: number;
  speed: number;
  rotationSpeed: number;
  weapons: string[];
  ai: string;
  aiConfig?: AirplaneAiConfig;
  /** @deprecated Use `aiConfig`. Removed from level JSON after migration. */
  aiParams?: [number, number, number];
  drawStyle: number;
  image: string;
  scale: [number, number];
  /** v1 SCREAM — played when the plane is hit but not destroyed. */
  scream?: string;
  /** v1 LAST_SCREAM — played when the plane is destroyed. */
  lastScream?: string;
  /** v1 IS_STEALTHED — seconds per stealth/visible phase (0 = off). */
  stealthPhaseSec?: number;
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
  /** Overrides config.assets.background for this round and all later rounds. */
  background?: string;
  /** Overrides config.assets.ground for this round and all later rounds. */
  ground?: string;
  /** Overrides music track for this round and all later rounds (v1 CHANGE_MUSIC). */
  music?: string;
  /** Level music gain for this round and all later rounds (v1 CHANGE_VOLUME). */
  musicVolume?: number;
  /** Partial SFX bank overrides — sticky merge (explosion, newRound, shoot, …). */
  sounds?: Partial<LevelSoundsConfig>;
  intro?: { text?: string; image?: string; time?: number; sound?: string };
  winSound?: string;
  maxAirplanes: number;
  endmaster: number;
  rumble?: number;
  storyLimits?: Partial<StoryLimits>;
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
  /** v1 BLOODY — blood FX intensity multiplier (default 1). */
  bloody?: number;
  storyLimits?: StoryLimits;
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
  /** Stable campaign id for save keys, e.g. `aw` → runs `aw_` / `aw_h`. */
  id: string;
  campaignName: string;
  mapImage: string;
  levels: Array<{
    file: string;
    name: string;
    mapX: number;
    mapY: number;
    pathType: number;
  }>;
}

export interface CampaignRegistryEntry {
  id: string;
  menuTitle: string;
}

export interface CampaignRegistry {
  schemaVersion: number;
  campaigns: CampaignRegistryEntry[];
}

function campaignBase(campaignId: string): string {
  return `campaign/${campaignId}`;
}

export async function loadCampaignRegistry(): Promise<CampaignRegistry> {
  const res = await fetch(publicUrl('campaign/registry.json'));
  if (!res.ok) throw new Error('Failed to load campaign registry');
  return res.json() as Promise<CampaignRegistry>;
}

export async function loadLevelPack(campaignId: string, file: string): Promise<LevelPack> {
  const path = `${campaignBase(campaignId)}/${file}`;
  const res = await fetch(publicUrl(path));
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json() as Promise<LevelPack>;
}

export async function loadCampaignIndex(campaignId: string): Promise<CampaignIndex> {
  const path = `${campaignBase(campaignId)}/index.json`;
  const res = await fetch(publicUrl(path));
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json() as Promise<CampaignIndex>;
}
