import type { UpgradeKey } from './LevelSession';

/** v1 buyscript.txt [STANDARD] — keys 1–9 (not configurable). */
export const BUY_MACROS: Readonly<Record<number, readonly UpgradeKey[]>> = {
  1: ['human'],
  2: ['humanHp'],
  3: ['humanMoney'],
  4: ['rocket'],
  5: ['rocketSpeed'],
  6: ['rocketPower'],
  7: ['aim'],
  8: ['human', 'human', 'human', 'human', 'human', 'human'],
  9: ['human', 'humanHp', 'humanMoney', 'rocket', 'rocketSpeed', 'rocketPower', 'aim'],
};

/** Extra delay before each subsequent purchase in a macro (ms). */
export const BUY_MACRO_STEP_MS = 100;

export function shopDigitFromKeyboard(e: KeyboardEvent): number | null {
  if (e.code.startsWith('Digit')) {
    const digit = Number.parseInt(e.code.slice(5), 10);
    if (digit >= 1 && digit <= 9) return digit;
  }
  if (e.code.startsWith('Numpad')) {
    const digit = Number.parseInt(e.code.slice(6), 10);
    if (digit >= 1 && digit <= 9) return digit;
  }
  return null;
}
