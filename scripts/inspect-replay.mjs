import { readFileSync } from 'fs';
import { decodeReplay } from '../src/replay/ReplayFormat.ts';

const path = process.argv[2] ?? 'replay14.bin';
const blob = readFileSync(path);
const r = await decodeReplay(new Uint8Array(blob));
console.log('footer', r.footer);

const shopTicks = r.ticks
  .map((t, i) => ({ i, ...t }))
  .filter((t) => t.phase === 'shop');

const confirms = shopTicks.filter((t) => t.shop?.confirmEdge);
const shortcuts = shopTicks.filter((t) => t.shop && t.shop.shortcutSlot > 0);
console.log('shop ticks', shopTicks.length, 'confirms', confirms.length, 'shortcuts', shortcuts.length);

console.log('\nConfirm ticks:');
for (const t of confirms) {
  console.log(`  tick ${t.i}: cursor (${t.shop.cursorX.toFixed(0)}, ${t.shop.cursorY.toFixed(0)}) slot=${t.shop.shortcutSlot}`);
}

console.log('\nShortcut ticks:');
for (const t of shortcuts) {
  console.log(`  tick ${t.i}: slot=${t.shop.shortcutSlot}`);
}

const transitions = [];
for (let i = 1; i < r.ticks.length; i++) {
  if (r.ticks[i].phase !== r.ticks[i - 1].phase) {
    transitions.push({ i, from: r.ticks[i - 1].phase, to: r.ticks[i].phase });
  }
}
console.log('\nphase transitions', transitions);
