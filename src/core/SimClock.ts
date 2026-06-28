/** Fixed simulation rate for deterministic replays. */
export const SIM_HZ = 60;
export const SIM_DT = 1 / SIM_HZ;
export const MAX_SIM_STEPS_PER_FRAME = 4;

/** Replay may run more than one tick per display frame at high speed. */
export function replayMaxStepsPerFrame(speed: number): number {
  return Math.max(MAX_SIM_STEPS_PER_FRAME, Math.ceil(speed));
}
