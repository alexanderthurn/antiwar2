#!/usr/bin/env node
/**
 * Merges SCREAM / LAST_SCREAM from old v1 airplanes.txt files into campaign JSON.
 * Run: node scripts/patch-airplane-screams.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const OLD_DATA = join(import.meta.dirname, '../old/data');
const CAMPAIGN_DIR = join(import.meta.dirname, '../public/campaign');

function normalizeSfxPath(raw) {
  let p = raw.trim().split(/\s+/)[0];
  if (p.startsWith('assets/sfx/')) p = p.slice('assets/sfx/'.length);
  if (p.startsWith('sfx/')) p = p.slice(4);
  if (p.startsWith('snd/')) p = p.slice(4);
  return p;
}

function parseAirplanesTxt(content) {
  const map = new Map();
  let current = null;
  for (const line of content.split('\n')) {
    const section = line.match(/^\[([^\]]+)\]/);
    if (section) {
      current = section[1];
      map.set(current, {});
      continue;
    }
    if (!current) continue;
    const entry = map.get(current);
    const scream = line.match(/^SCREAM:\s*(.+)/i);
    const last = line.match(/^LAST_SCREAM:\s*(.+)/i);
    if (scream) entry.scream = normalizeSfxPath(scream[1]);
    if (last) entry.lastScream = normalizeSfxPath(last[1]);
  }
  return map;
}

function loadAllOldScreams() {
  const merged = new Map();
  for (const folder of readdirSync(OLD_DATA, { withFileTypes: true })) {
    if (!folder.isDirectory()) continue;
    const path = join(OLD_DATA, folder.name, 'airplanes.txt');
    try {
      const part = parseAirplanesTxt(readFileSync(path, 'utf8'));
      for (const [name, sounds] of part) {
        const prev = merged.get(name) ?? {};
        merged.set(name, { ...prev, ...sounds });
      }
    } catch {
      // no airplanes.txt in this pack
    }
  }
  return merged;
}

const oldScreams = loadAllOldScreams();
let filesUpdated = 0;
let planesUpdated = 0;

for (let i = 1; i <= 13; i++) {
  const file = join(CAMPAIGN_DIR, `${i}.json`);
  const pack = JSON.parse(readFileSync(file, 'utf8'));
  let changed = false;

  for (const [name, def] of Object.entries(pack.airplanes ?? {})) {
    const src = oldScreams.get(name);
    if (!src) continue;
    if (src.scream && def.scream !== src.scream) {
      def.scream = src.scream;
      changed = true;
      planesUpdated += 1;
    }
    if (src.lastScream && def.lastScream !== src.lastScream) {
      def.lastScream = src.lastScream;
      changed = true;
      planesUpdated += 1;
    }
  }

  if (changed) {
    writeFileSync(file, `${JSON.stringify(pack, null, 2)}\n`);
    console.log(`patched ${i}.json`);
    filesUpdated += 1;
  }
}

console.log(`done — ${filesUpdated} file(s), ${planesUpdated} plane field(s) updated`);
