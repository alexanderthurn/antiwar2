#!/usr/bin/env node
/**
 * Adds config.sounds overrides, intro.sound on text-only intros, and winSound on boss rounds.
 * Run: node scripts/patch-campaign-sounds.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CAMPAIGN_DIR = join(import.meta.dirname, '../public/campaign');

/** Per-level config.sounds (merged over code defaults). */
const LEVEL_SOUNDS = {
  3: { music: 'boss.ogg' },
  6: { music: 'boss.ogg' },
  9: { music: 'boss.ogg', shoot: 'piu.ogg' },
  12: {
    music: 'boss.ogg',
    winner: 'ultimate_winner.ogg',
    win: 'ultimate_winner.ogg',
  },
};

/** Intro voice by exact intro text (v1 + sensible fallbacks). */
const INTRO_SOUND_BY_TEXT = {
  'Welcome to Mangoos Game': 'welcome.ogg',
  'You are dead': 'yeahbaby.ogg',
  'get your money to start': 'pay.ogg',
  'kill your first enemies': 'gong.ogg',
  'ok, this is the bigger version': 'gong.ogg',
  'Can the rain extinguish the napalm?': 'gong.ogg',
  'BOMBS, BOMBS, BOMBS': 'gong.ogg',
  'anthrax darkens the sky': 'gong.ogg',
  'Fight!': 'gong.ogg',
  'search and find???': 'gong.ogg',
  'The nuclear sun is rising.': 'gong.ogg',
  'clean your carpet... NO, it cleans you!': 'laugh.ogg',
  'the next day starts with... WAR!!!': 'gong.ogg',
  "find the nukes, or they'll find you": 'gong.ogg',
  'oh oh, new developed bombs...': 'gong.ogg',
  'again the sky rains fire': 'gong.ogg',
  'you are the best, kill the rest': 'winner.ogg',
  'Nukes! Lots of Nukes!': 'gong.ogg',
  'Nuclear Winter': 'oerks.ogg',
  'Hidden and dangerous': 'gong.ogg',
  'Viech Attacks!': 'oerks.ogg',
  'Here comes Fred': 'oe.ogg',
  'No Blood for Oe': 'pay.ogg',
  'Survive this!': 'oerks.ogg',
};

const INTRO_SOUND_BY_PARTIAL = [{ includes: 'ausgegangen', sound: 'laugh.ogg' }];

function normalizeSfxPath(path) {
  if (!path) return path;
  if (path.startsWith('assets/sfx/')) return path.slice('assets/sfx/'.length);
  return path;
}

function introSoundForText(text) {
  if (!text) return undefined;
  const exact = INTRO_SOUND_BY_TEXT[text];
  if (exact) return exact;
  for (const rule of INTRO_SOUND_BY_PARTIAL) {
    if (text.includes(rule.includes)) return rule.sound;
  }
  return undefined;
}

function patchPack(pack) {
  let changed = false;
  const levelSounds = LEVEL_SOUNDS[pack.id];
  if (levelSounds) {
    pack.config.sounds = { ...(pack.config.sounds ?? {}), ...levelSounds };
    changed = true;
  }

  const bossWin =
    pack.id === 12 ? 'ultimate_winner.ogg' : pack.id === 3 || pack.id === 6 || pack.id === 9 ? 'winner.ogg' : null;

  for (const round of pack.rounds) {
    if (round.intro) {
      if (round.intro.sound) {
        const norm = normalizeSfxPath(round.intro.sound);
        if (norm !== round.intro.sound) {
          round.intro.sound = norm;
          changed = true;
        }
      } else {
        const mapped = introSoundForText(round.intro.text);
        const fallback = round.intro.text && !round.intro.image ? 'gong.ogg' : mapped;
        const sound = mapped ?? (round.intro.text ? fallback : undefined);
        if (sound) {
          round.intro.sound = sound;
          changed = true;
        }
      }
    }

    if (bossWin && round.endmaster >= 0 && !round.winSound) {
      round.winSound = bossWin;
      changed = true;
    }
  }

  return changed;
}

let total = 0;
for (let i = 1; i <= 12; i++) {
  const file = join(CAMPAIGN_DIR, `${i}.json`);
  const pack = JSON.parse(readFileSync(file, 'utf8'));
  if (patchPack(pack)) {
    writeFileSync(file, `${JSON.stringify(pack, null, 2)}\n`);
    console.log(`patched ${i}.json`);
    total += 1;
  } else {
    console.log(`skipped ${i}.json (no changes)`);
  }
}
console.log(`done — ${total} file(s) updated`);
