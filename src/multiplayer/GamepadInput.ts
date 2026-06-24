export interface GamepadSnapshot {
  index: number;
  connected: boolean;
  axisX: number;
  axisY: number;
  buttonA: boolean;
  buttonB: boolean;
  buttonL1: boolean;
  buttonR1: boolean;
  buttonStart: boolean;
  dpadUp: boolean;
  dpadDown: boolean;
  dpadLeft: boolean;
  dpadRight: boolean;
}

/** Poll connected gamepads (standard mapping). */
export function pollGamepads(): GamepadSnapshot[] {
  const pads = navigator.getGamepads?.() ?? [];
  const out: GamepadSnapshot[] = [];
  for (let i = 0; i < pads.length; i++) {
    const pad = pads[i];
    if (!pad) continue;
    out.push({
      index: i,
      connected: pad.connected,
      axisX: pad.axes[0] ?? 0,
      axisY: pad.axes[1] ?? 0,
      buttonA: pad.buttons[0]?.pressed ?? false,
      buttonB: pad.buttons[1]?.pressed ?? false,
      buttonL1: pad.buttons[4]?.pressed ?? false,
      buttonR1: pad.buttons[5]?.pressed ?? false,
      buttonStart: pad.buttons[9]?.pressed ?? false,
      dpadUp: pad.buttons[12]?.pressed ?? false,
      dpadDown: pad.buttons[13]?.pressed ?? false,
      dpadLeft: pad.buttons[14]?.pressed ?? false,
      dpadRight: pad.buttons[15]?.pressed ?? false,
    });
  }
  return out;
}
