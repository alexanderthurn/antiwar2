#!/usr/bin/env node
/**
 * Convert v1 data/<pack>/ text files to public/campaign/N.json
 * Usage: node scripts/convert-v1.mjs --source data/schnappi --out public/campaign/13.json --id 12
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const X_SCALE = 1920 / 1024;
const Y_SCALE = 1080 / 768;

function parseIniSections(text) {
  const sections = new Map();
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = cleanLine(raw);
    if (!line) continue;
    const sec = line.match(/^\[(.+)\]$/);
    if (sec) {
      current = sec[1];
      sections.set(current, {});
      continue;
    }
    if (!current) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    sections.get(current)[key] = value;
  }
  return sections;
}

/** v1 levels.txt repeats section names — each `[...]` block is one round. */
function parseLevelSections(text) {
  const rounds = [];
  let current = null;
  let currentName = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = cleanLine(raw);
    if (!line) continue;
    const sec = line.match(/^\[(.+)\]$/);
    if (sec) {
      if (current) rounds.push({ name: currentName, fields: current });
      currentName = sec[1];
      current = {};
      continue;
    }
    if (!current) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    current[key] = value;
  }
  if (current) rounds.push({ name: currentName, fields: current });
  return rounds;
}

function cleanLine(raw) {
  return raw.split('//')[0].split("'")[0].trim();
}

function num(v, fallback = 0) {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function scaleCoord(x, y) {
  return [Math.round(x * X_SCALE), Math.round(y * Y_SCALE)];
}

function renamePlaneImageFile(filename) {
  const base = filename.replace(/\\/g, '/').split('/').pop() ?? filename;
  const map = {
    'schnappi.png': 'dragi.png',
    'schnappi2.png': 'dragi2.png',
    'schnappi3.png': 'dragi3.png',
    'schnappi4.png': 'dragi4.png',
  };
  return map[base.toLowerCase()] ?? base;
}

function gfxPath(p, kind = 'auto') {
  const n = p.replace(/\\/g, '/');
  if (n.startsWith('assets/')) return n;
  if (n.startsWith('gfx/')) return `assets/${n}`;
  if (n.startsWith('AIRPLANES/') || n.startsWith('airplanes/')) return `assets/gfx/${n}`;
  if (n.startsWith('BOMBS/') || n.startsWith('bombs/')) return `assets/gfx/${n}`;
  if (kind === 'bomb') return `assets/gfx/BOMBS/${n}`;
  if (kind === 'plane') return `assets/gfx/AIRPLANES/${renamePlaneImageFile(n)}`;
  if (n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.PNG') || n.endsWith('.JPG')) {
    if (n.includes('/')) return `assets/gfx/${n}`;
    return `assets/gfx/backgrounds/${n}`;
  }
  return `assets/gfx/${n}`;
}

function sfxPath(p) {
  const n = p.replace(/\\/g, '/');
  if (n.startsWith('assets/')) return n;
  if (n.startsWith('sfx/')) return n.replace(/^sfx\//, '');
  return n;
}

function parseConfig(cfg) {
  const buttonsDisabled = {};
  const mapBtn = {
    BUTTON_HUMAN_DISABLED: 'human',
    BUTTON_HUMAN_HP_DISABLED: 'humanHp',
    BUTTON_HUMAN_MONEY_DISABLED: 'humanMoney',
    BUTTON_ROCKET_DISABLED: 'rocket',
    BUTTON_ROCKET_SPEED_DISABLED: 'rocketSpeed',
    BUTTON_ROCKET_POWER_DISABLED: 'rocketPower',
    BUTTON_AIMTIME_DISABLED: 'aim',
    BUTTON_AIM_DISABLED: 'aim',
  };
  for (const [k, field] of Object.entries(mapBtn)) {
    if (cfg[k] === '1') buttonsDisabled[field] = true;
  }

  const upgrades = {
    human: { price: num(cfg.PRICE_HUMAN, 100), priceFactor: num(cfg.FACTOR_PRICE_HUMAN, 1), statFactor: null },
    humanHp: { price: num(cfg.PRICE_HUMAN_HP, 100), priceFactor: num(cfg.FACTOR_PRICE_HUMAN_HP, 1), statFactor: num(cfg.FACTOR_HUMAN_HP, 1.1) },
    humanMoney: { price: num(cfg.PRICE_HUMAN_MONEY, 100), priceFactor: num(cfg.FACTOR_PRICE_HUMAN_MONEY, 1), statFactor: num(cfg.FACTOR_HUMAN_MONEY, 1.15) },
    rocket: { price: num(cfg.PRICE_ROCKET, 100), priceFactor: num(cfg.FACTOR_PRICE_ROCKET, 1), statFactor: null },
    rocketSpeed: { price: num(cfg.PRICE_ROCKET_SPEED, 100), priceFactor: num(cfg.FACTOR_PRICE_ROCKET_SPEED, 1), statFactor: num(cfg.FACTOR_ROCKET_SPEED, 1.1) },
    rocketPower: { price: num(cfg.PRICE_ROCKET_POWER, 100), priceFactor: num(cfg.FACTOR_PRICE_ROCKET_POWER, 1), statFactor: num(cfg.FACTOR_ROCKET_POWER, 1.1) },
    aim: { price: num(cfg.PRICE_AIM, 100), priceFactor: num(cfg.FACTOR_PRICE_AIM, 1), statFactor: num(cfg.FACTOR_AIM, 0.9) },
  };

  const bg = cfg.CHANGE_BACKGROUND || cfg.BACKGROUND || 'mangoo.jpg';
  const ground = cfg.CHANGE_GROUND || 'ground.png';

  return {
    startMoney: num(cfg.START_MONEY, 1000),
    startHumans: num(cfg.START_HUMANS, 1),
    startRockets: num(cfg.START_ROCKETS, 3),
    startHumanHp: num(cfg.START_HUMAN_HP, 100),
    startHumanMoney: num(cfg.START_HUMAN_MONEY, 300),
    startRocketPower: num(cfg.START_ROCKET_POWER, 50),
    startRocketSpeed: num(cfg.START_ROCKET_SPEED, 6),
    startAimTime: num(cfg.START_AIMTIME, 1000),
    aimPower: num(cfg.AIM_POWER, 2),
    maxHumans: num(cfg.MAX_HUMANS, 10),
    maxRockets: num(cfg.MAX_ROCKETS, 10),
    humanHpRefresh: num(cfg.HUMAN_HPREFRESH, 1),
    moneyFactor: num(cfg.MONEY_FACTOR, 1),
    crashingRockets: num(cfg.CRASHING_ROCKETS, 2),
    bloody: cfg.BLOODY ? num(cfg.BLOODY, 1) : undefined,
    buttonsDisabled,
    upgrades,
    assets: {
      tower: 'assets/gfx/tower.png',
      cannon: 'assets/gfx/cannon.png',
      crosshair: 'assets/gfx/crosshair1.png',
      human: 'assets/gfx/human.png',
      ground: gfxPath(ground),
      background: gfxPath(bg),
    },
  };
}

function parseBombs(sections) {
  const bombs = {};
  for (const [name, s] of sections) {
    if (name === 'STANDARD' || name.startsWith('LEVEL') || name.startsWith('MISSION') || name.startsWith('TUTORIAL')) continue;
    if (!s.IMAGE) continue;
    bombs[name] = {
      image: gfxPath(s.IMAGE, 'bomb'),
      scale: [num(s.SCALE_X, 1), num(s.SCALE_Y, 1)],
      hp: num(s.HP, 10),
      damage: num(s.TP, 100),
      speed: num(s.SPEED, 1),
      rotationSpeed: num(s.ROTATION_SPEED, 5),
      explosion: {
        type: num(s.EXPLOSION_TYP, 1),
        power: num(s.EXPLOSION_POWER, 0),
        range: num(s.EXPLOSION_RANGE, 1),
        lifetime: num(s.EXPLOSION_LIFETIME, 20),
      },
      trail: num(s.DRAW_SCHWEIF, 0),
      checkOutOfScreen: s.CHECK_FOR_OUTOFSCREEN === '1',
      feeder: s.IS_FEEDER ? num(s.IS_FEEDER, 0) : undefined,
    };
  }
  return bombs;
}

function renamePlaneType(name) {
  return name
    .replace(/^SCHNAPPI3$/i, 'DRAGI3')
    .replace(/^SCHNAPPI2$/i, 'DRAGI2')
    .replace(/^SCHNAPPI$/i, 'DRAGI');
}

function parseAirplanes(sections) {
  const airplanes = {};
  for (const [name, s] of sections) {
    if (!s.HP || !s.KI) continue;
    const weapons = [];
    const count = num(s.BOMB_TYPS, 0);
    for (let i = 0; i < count; i++) {
      const w = s[`BOMB_TYP_${i}`];
      if (w) weapons.push(w);
    }
    airplanes[renamePlaneType(name)] = {
      hp: num(s.HP, 50),
      speed: num(s.SPEED, 2),
      rotationSpeed: num(s.ROTATION_SPEED, 360),
      weapons,
      ai: s.KI,
      aiParams: [num(s.KI_PARAM_A, 0), num(s.KI_PARAM_B, 300), num(s.KI_PARAM_C, 300)],
      drawStyle: num(s.DRAWSTYLE, 0),
      image: gfxPath(s.IMAGE, 'plane'),
      scale: [num(s.SCALE_X, 1), num(s.SCALE_Y, 1)],
      stealthTicks: s.IS_STEALTHED ? num(s.IS_STEALTHED, 0) : undefined,
      scream: s.SCREAM ? sfxPath(s.SCREAM) : undefined,
      lastScream: s.LAST_SCREAM ? sfxPath(s.LAST_SCREAM) : undefined,
    };
  }
  return airplanes;
}

function parseRounds(levelSections) {
  const rounds = [];
  for (const { name, fields: s } of levelSections) {
    const spawns = [];
    for (let i = 0; i < 500; i++) {
      const raw = s[`AIRPLANE_${i}`];
      if (!raw) break;
      const m = raw.match(/^([^,]+),(.+)$/);
      if (!m) continue;
      const type = renamePlaneType(m[1].trim());
      const parts = m[2].split(',').map((p) => p.trim());
      let x = num(parts[0], 0);
      let y = num(parts[1], 0);
      const angle = num(parts[2], 0);
      if (parts[0]?.includes('-') && parts.length === 2) {
        const fix = parts[0].match(/^(\d+)-(\d+)$/);
        if (fix) {
          x = num(fix[1], 0);
          y = -num(fix[2], 0);
        }
      }
      const [sx, sy] = scaleCoord(x, y);
      spawns.push({ kind: 'airplane', type, x: sx, y: sy, angle });
    }
    const weather = (s.WEATHER || '0,0,0,0,0').split(',').slice(0, 5).map((v) => num(v, 0));
    const round = {
      name,
      weather,
      maxAirplanes: num(s.MAX_AIRPLANES, 0),
      endmaster: num(s.ENDMASTER, -1),
      rumble: num(s.RUMBLE, 2),
      spawns,
    };
    if (s.CHANGE_BACKGROUND || s.BACKGROUND) round.background = gfxPath(s.CHANGE_BACKGROUND || s.BACKGROUND);
    if (s.CHANGE_GROUND) round.ground = gfxPath(s.CHANGE_GROUND);
    if (s.STORY_MAX_ROUNDROCKETS && num(s.STORY_MAX_ROUNDROCKETS) >= 0) {
      round.storyLimits = {
        maxRoundRockets: num(s.STORY_MAX_ROUNDROCKETS),
        ...(s.STORY_MAX_ROUNDTIME && num(s.STORY_MAX_ROUNDTIME) >= 0
          ? { maxRoundTime: num(s.STORY_MAX_ROUNDTIME) }
          : {}),
      };
    }
    rounds.push(round);
  }
  return rounds;
}

function main() {
  const args = process.argv.slice(2);
  const srcIdx = args.indexOf('--source');
  const outIdx = args.indexOf('--out');
  const idIdx = args.indexOf('--id');
  if (srcIdx < 0 || outIdx < 0 || idIdx < 0) {
    console.error('Usage: node scripts/convert-v1.mjs --source data/schnappi --out public/campaign/13.json --id 12');
    process.exit(1);
  }
  const source = args[srcIdx + 1];
  const out = args[outIdx + 1];
  const id = Number(args[idIdx + 1]);
  const dir = join(import.meta.dirname, '..', source);

  const configText = readFileSync(join(dir, 'config.txt'), 'utf8');
  const configFlat = Object.fromEntries(
    configText.split(/\r?\n/)
      .map((l) => l.split('//')[0].trim())
      .filter((l) => l.includes(':'))
      .map((l) => {
        const i = l.indexOf(':');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );

  const levels = parseLevelSections(readFileSync(join(dir, 'levels.txt'), 'utf8'));
  const bombs = parseBombs(parseIniSections(readFileSync(join(dir, 'bombs.txt'), 'utf8')));
  const airplanes = parseAirplanes(parseIniSections(readFileSync(join(dir, 'airplanes.txt'), 'utf8')));
  const rounds = parseRounds(levels);

  const packConfig = parseConfig(configFlat);
  if (rounds[0]?.background) packConfig.assets.background = rounds[0].background;
  if (rounds[0]?.ground) packConfig.assets.ground = rounds[0].ground;

  const pack = {
    schemaVersion: 1,
    id,
    meta: {
      name: 'Dragi',
      author: configFlat.AUTHOR || 'Mangoo',
      description: 'Little crocodile wants revenge. Shoot it down!',
      thumbnail: gfxPath(configFlat.IMAGE || 'gfx/thumbs/dragi.png'),
      difficulty: 'easy',
    },
    config: packConfig,
    bombs,
    airplanes,
    rounds,
  };

  if (!pack.bombs.BOMB_PLAYER) {
    pack.bombs.BOMB_PLAYER = {
      image: 'assets/gfx/BOMBS/player_rocket.png',
      scale: [0.8, 0.8],
      hp: 10,
      damage: 100,
      speed: 2,
      rotationSpeed: 20,
      explosion: { type: 1, power: 0, range: 1, lifetime: 20 },
      trail: 1,
      checkOutOfScreen: true,
    };
  }

  writeFileSync(join(import.meta.dirname, '..', out), `${JSON.stringify(pack, null, 2)}\n`);
  console.log(`Wrote ${out} — ${rounds.length} rounds, ${Object.keys(airplanes).length} planes`);
}

main();
