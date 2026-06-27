#!/usr/bin/env node
/**
 * One-time migration: v1 frame-based speeds → per-second units in campaign JSON.
 * - speed, rotationSpeed, startRocketSpeed: × 60
 * - aiConfig.dropIntervalSec (or legacy aiParams[2]): ÷ 60 (frames → seconds)
 * - stealthTicks → stealthPhaseSec (values unchanged; already seconds)
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const V1_FRAME_RATE = 60;
const CAMPAIGN_ROOT = join(import.meta.dirname, '..', 'public', 'campaign');

function roundNum(n) {
  const r = Math.round(n * 1000) / 1000;
  return Number.isInteger(r) ? r : r;
}

function migratePack(pack) {
  if (pack.config?.startRocketSpeed != null) {
    pack.config.startRocketSpeed = roundNum(pack.config.startRocketSpeed * V1_FRAME_RATE);
  }

  for (const bomb of Object.values(pack.bombs ?? {})) {
    bomb.speed = roundNum(bomb.speed * V1_FRAME_RATE);
    bomb.rotationSpeed = roundNum(bomb.rotationSpeed * V1_FRAME_RATE);
  }

  for (const plane of Object.values(pack.airplanes ?? {})) {
    plane.speed = roundNum(plane.speed * V1_FRAME_RATE);
    plane.rotationSpeed = roundNum(plane.rotationSpeed * V1_FRAME_RATE);
    const dropSec =
      plane.aiConfig?.dropIntervalSec ??
      (Array.isArray(plane.aiParams) && plane.aiParams.length >= 3 ? plane.aiParams[2] : null);
    if (dropSec != null && dropSec > 0) {
      const converted = roundNum(dropSec / V1_FRAME_RATE);
      if (plane.aiConfig) plane.aiConfig.dropIntervalSec = converted;
      else if (plane.aiParams) plane.aiParams[2] = converted;
    }
    if (plane.stealthTicks != null) {
      plane.stealthPhaseSec = plane.stealthTicks;
      delete plane.stealthTicks;
    }
  }
}

function listLevelPacks(campaignId) {
  const dir = join(CAMPAIGN_ROOT, campaignId);
  return readdirSync(dir)
    .filter((f) => /^\d+\.json$/.test(f))
    .map((f) => join(dir, f));
}

const campaignArg = process.argv.indexOf('--campaign');
const campaignFilter =
  campaignArg >= 0 ? process.argv[campaignArg + 1] : null;

const campaignIds = campaignFilter
  ? [campaignFilter]
  : readdirSync(CAMPAIGN_ROOT).filter((name) => {
      if (name === 'registry.json' || name === 'format.md') return false;
      return readdirSync(join(CAMPAIGN_ROOT, name)).some((f) => f === 'index.json');
    });

for (const campaignId of campaignIds) {
  for (const path of listLevelPacks(campaignId)) {
    const pack = JSON.parse(readFileSync(path, 'utf8'));
    migratePack(pack);
    writeFileSync(path, `${JSON.stringify(pack, null, 2)}\n`);
    console.log(`migrated ${campaignId}/${path.split('/').pop()}`);
  }
}
