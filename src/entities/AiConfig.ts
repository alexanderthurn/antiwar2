import type { AirplaneAiConfig, AirplaneDef } from '../data/types';

export interface ResolvedAiConfig {
  flightBand: { minY: number; maxY: number };
  dropIntervalSec: number | null;
  glideTarget: { startX: number; endX: number } | null;
}

const AI_ALIASES: Record<string, string> = {
  KIHELISIMPLE: 'HELISIMPLE',
  KIHELIAPACHE: 'HELIAPACHE',
  KIFIGHTERLIZZARD: 'FIGHTERLIZZARD',
  KICARRIER: 'CARRIER',
  KIPARACHUTE: 'PARACHUTE',
};

export function normalizeAI(ai: string): string {
  const upper = ai.toUpperCase();
  return AI_ALIASES[upper] ?? upper;
}

const DEFAULT_FLIGHT_BAND = { minY: 0, maxY: 300 };

function flightBandFromLegacy(def: AirplaneDef): { minY: number; maxY: number } | null {
  const legacy = def.aiParams;
  if (!legacy) return null;
  return { minY: legacy[0], maxY: legacy[1] };
}

function glideTargetFromLegacy(def: AirplaneDef): { startX: number; endX: number } | null {
  const legacy = def.aiParams;
  if (!legacy) return null;
  return { startX: legacy[0], endX: legacy[1] };
}

function dropIntervalFromSources(cfg: AirplaneAiConfig | undefined, def: AirplaneDef): number | null {
  if (cfg?.dropIntervalSec != null && cfg.dropIntervalSec > 0) return cfg.dropIntervalSec;
  const legacy = def.aiParams?.[2];
  if (legacy != null && legacy > 0) return legacy;
  return null;
}

/** Merge `aiConfig` with legacy `aiParams` (deprecated). */
export function resolveAiConfig(def: AirplaneDef): ResolvedAiConfig {
  const ai = normalizeAI(def.ai);
  const cfg = def.aiConfig;

  if (ai === 'PARACHUTE' || cfg?.glideTarget) {
    const glideTarget = cfg?.glideTarget ?? glideTargetFromLegacy(def);
    if (glideTarget) {
      return {
        flightBand: DEFAULT_FLIGHT_BAND,
        dropIntervalSec: null,
        glideTarget,
      };
    }
  }

  const flightBand = cfg?.flightBand ?? flightBandFromLegacy(def) ?? DEFAULT_FLIGHT_BAND;
  const dropIntervalSec = dropIntervalFromSources(cfg, def);

  return {
    flightBand,
    dropIntervalSec,
    glideTarget: null,
  };
}
