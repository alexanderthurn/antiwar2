import { DESIGN } from './DesignSpace';

export interface ViewportLayout {
  scale: number;
  offsetX: number;
  offsetY: number;
  gameWidth: number;
  gameHeight: number;
  /** Design-space pixels for 1 physical cm on the displayed canvas (0 if unknown). */
  designPxPerCm: number;
}

export function computeLayout(canvasWidth: number, canvasHeight: number): ViewportLayout {
  const scale = Math.min(canvasWidth / DESIGN.width, canvasHeight / DESIGN.height);
  const gameWidth = DESIGN.width * scale;
  const gameHeight = DESIGN.height * scale;
  return {
    scale,
    offsetX: (canvasWidth - gameWidth) / 2,
    offsetY: (canvasHeight - gameHeight) / 2,
    gameWidth,
    gameHeight,
    designPxPerCm: 0,
  };
}

let cssCmInPx: number | undefined;

/** Browser-reported size of 1 CSS cm in layout pixels (device-dependent). */
export function cssCentimetersToPixels(cm: number): number {
  if (cssCmInPx === undefined) {
    const probe = document.createElement('div');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.width = '1cm';
    document.body.appendChild(probe);
    cssCmInPx = probe.getBoundingClientRect().width;
    probe.remove();
  }
  return cssCmInPx * cm;
}

/** Map physical centimeters on screen to design-space pixels for the current canvas layout. */
export function cssCmToDesignPixels(
  cm: number,
  layout: ViewportLayout,
  canvas: HTMLCanvasElement,
  stageHeight: number,
): number {
  if (layout.scale <= 0) return 0;
  const clientPx = cssCentimetersToPixels(cm);
  const rect = canvas.getBoundingClientRect();
  if (rect.height <= 0) return 0;
  const stagePx = clientPx * (stageHeight / rect.height);
  return stagePx / layout.scale;
}

export function enrichLayoutForDisplay(
  layout: ViewportLayout,
  canvas: HTMLCanvasElement,
  stageHeight: number,
): ViewportLayout {
  return {
    ...layout,
    designPxPerCm: cssCmToDesignPixels(1, layout, canvas, stageHeight),
  };
}

/** Map viewport client coords to Pixi stage/canvas pixel coords. */
export function clientToStage(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  stageWidth: number,
  stageHeight: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return {
    x: (clientX - rect.left) * (stageWidth / rect.width),
    y: (clientY - rect.top) * (stageHeight / rect.height),
  };
}

export function screenToDesign(
  sx: number,
  sy: number,
  layout: ViewportLayout,
): { x: number; y: number; inGame: boolean } {
  const { scale, offsetX, offsetY, gameWidth, gameHeight } = layout;
  const inGame =
    sx >= offsetX &&
    sx <= offsetX + gameWidth &&
    sy >= offsetY &&
    sy <= offsetY + gameHeight;
  const x = Math.max(0, Math.min(DESIGN.width, (sx - offsetX) / scale));
  const y = Math.max(0, Math.min(DESIGN.height, (sy - offsetY) / scale));
  return { x, y, inGame };
}

export function stickToDesign(
  stickX: number,
  stickY: number,
  sensitivity: number,
  currentX: number,
  currentY: number,
): { x: number; y: number } {
  const deadzone = 0.15;
  const mag = Math.hypot(stickX, stickY);
  if (mag < deadzone) {
    return { x: currentX, y: currentY };
  }
  const cx = DESIGN.width / 2 + stickX * (DESIGN.width / 2) * sensitivity;
  const cy = DESIGN.height / 2 + stickY * (DESIGN.height / 2) * sensitivity;
  return {
    x: Math.max(0, Math.min(DESIGN.width, cx)),
    y: Math.max(0, Math.min(DESIGN.height, cy)),
  };
}
