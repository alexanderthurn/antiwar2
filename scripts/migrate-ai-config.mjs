#!/usr/bin/env node
/**
 * Migrate airplane aiParams → aiConfig in campaign JSON.
 * Usage: node scripts/migrate-ai-config.mjs [--campaign aw]
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CAMPAIGN_ROOT = join(import.meta.dirname, '..', 'public', 'campaign');

const AI_ALIASES = {
  KIHELISIMPLE: 'HELISIMPLE',
  KIHELIAPACHE: 'HELIAPACHE',
  KIFIGHTERLIZZARD: 'FIGHTERLIZZARD',
  KICARRIER: 'CARRIER',
  KIPARACHUTE: 'PARACHUTE',
};

function normalizeAI(ai) {
  const upper = String(ai).toUpperCase();
  return AI_ALIASES[upper] ?? upper;
}

function roundNum(n) {
  const r = Math.round(n * 1000) / 1000;
  return Number.isInteger(r) ? r : r;
}

function migratePlane(plane) {
  if (!plane.aiParams && plane.aiConfig) return false;

  const [a, b, c] = plane.aiParams ?? [0, 300, 5];
  const ai = normalizeAI(plane.ai);

  if (ai === 'PARACHUTE') {
    plane.aiConfig = {
      glideTarget: { startX: a, endX: b },
    };
  } else {
    plane.aiConfig = {
      flightBand: { minY: a, maxY: b },
      ...(c > 0 ? { dropIntervalSec: roundNum(c) } : {}),
    };
  }

  delete plane.aiParams;
  return true;
}

function migratePack(pack) {
  let changed = false;
  for (const plane of Object.values(pack.airplanes ?? {})) {
    if (migratePlane(plane)) changed = true;
  }
  return changed;
}

function listLevelPacks(campaignId) {
  const dir = join(CAMPAIGN_ROOT, campaignId);
  return readdirSync(dir)
    .filter((f) => /^\d+\.json$/.test(f))
    .map((f) => join(dir, f));
}

const campaignArg = process.argv.indexOf('--campaign');
const campaignFilter = campaignArg >= 0 ? process.argv[campaignArg + 1] : null;

const campaignIds = campaignFilter
  ? [campaignFilter]
  : readdirSync(CAMPAIGN_ROOT).filter((name) => {
      if (name === 'registry.json' || name === 'format.md') return false;
      const dir = join(CAMPAIGN_ROOT, name);
      return existsSync(dir) && existsSync(join(dir, 'index.json'));
    });

let total = 0;
for (const campaignId of campaignIds) {
  for (const path of listLevelPacks(campaignId)) {
    const pack = JSON.parse(readFileSync(path, 'utf8'));
    if (!migratePack(pack)) continue;
    writeFileSync(path, `${JSON.stringify(pack, null, 2)}\n`);
    console.log(`migrated ${campaignId}/${path.split('/').pop()}`);
    total += 1;
  }
}
console.log(`done — ${total} file(s) updated`);
