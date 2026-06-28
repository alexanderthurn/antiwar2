import type { ViewportLayout } from './Viewport';

export interface ViewportContext {
  layout: ViewportLayout;
  canvas: HTMLCanvasElement;
  stageWidth: number;
  stageHeight: number;
}

let active: ViewportContext | null = null;

export function setViewportContext(ctx: ViewportContext | null): void {
  active = ctx;
}

export function getViewportContext(): ViewportContext | null {
  return active;
}
