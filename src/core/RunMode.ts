/** Whether the current level run uses hardcore rules (2× enemy speed). */
let runHardcore = false;

export function setRunHardcore(hardcore: boolean): void {
  runHardcore = hardcore;
}

export function isRunHardcore(): boolean {
  return runHardcore;
}

/** Enemy plane / bomb speed multiplier (hardcore = 2×). */
export function combatSpeedMultiplier(): number {
  return runHardcore ? 2 : 1;
}
