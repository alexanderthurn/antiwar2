import { DESIGN } from './DesignSpace';

export interface ViewportLayout {
  scale: number;
  offsetX: number;
  offsetY: number;
  gameWidth: number;
  gameHeight: number;
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
