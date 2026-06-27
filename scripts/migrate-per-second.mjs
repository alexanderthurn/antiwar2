#!/usr/bin/env node
/**
 * One-time migration: v1 frame-based speeds → per-second units in campaign JSON.
 * - speed, rotationSpeed, startRocketSpeed: × 60
 * - aiParams[2]: ÷ 60 (frames between drops → seconds)
 * - stealthTicks → stealthPhaseSec (values unchanged; already seconds)
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const V1_FRAME_RATE = 60;
const CAMPAIGN_DIR = join(import.meta.dirname, '..', 'public', 'campaign');

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
    if (Array.isArray(plane.aiParams) && plane.aiParams.length >= 3) {
      plane.aiParams[2] = roundNum(plane.aiParams[2] / V1_FRAME_RATE);
    }
    if (plane.stealthTicks != null) {
      plane.stealthPhaseSec = plane.stealthTicks;
      delete plane.stealthTicks;
    }
  }
}

const files = readdirSync(CAMPAIGN_DIR).filter((f) => /^\d+\.json$/.test(f));
for (const file of files) {
  const path = join(CAMPAIGN_DIR, file);
  const pack = JSON.parse(readFileSync(path, 'utf8'));
  migratePack(pack);
  writeFileSync(path, `${JSON.stringify(pack, null, 2)}\n`);
  console.log(`migrated ${file}`);
}
