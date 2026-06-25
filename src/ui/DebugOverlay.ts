import type { Container, Renderer, Ticker } from 'pixi.js';
import { GRAPHICS_LABELS, type GraphicsQuality } from '../core/GraphicsQuality';
import { collectPixiRenderStats, rendererLabel } from '../debug/PixiRenderStats';

const SAMPLE_INTERVAL_MS = 500;

export interface DebugStatsSnapshot {
  graphicsQuality: GraphicsQuality;
  renderer: Renderer;
  stage: Container;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
}

interface PerformanceMemory {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
}

/** Fixed DOM overlay for `?debug=true` — screen space, above the canvas. */
export class DebugOverlay {
  private readonly root: HTMLDivElement;
  private frameCount = 0;
  private lastSampleAt = performance.now();
  private displayFps = 0;

  constructor(host: HTMLElement) {
    this.root = document.createElement('div');
    Object.assign(this.root.style, {
      position: 'absolute',
      top: '8px',
      left: '8px',
      zIndex: '1000',
      padding: '6px 10px',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: '12px',
      lineHeight: '1.45',
      color: '#b8f0b0',
      background: 'rgba(0, 0, 0, 0.72)',
      border: '1px solid rgba(120, 220, 100, 0.35)',
      borderRadius: '4px',
      pointerEvents: 'none',
      whiteSpace: 'pre',
      userSelect: 'none',
    } as Partial<CSSStyleDeclaration>);
    host.style.position = 'relative';
    host.appendChild(this.root);
  }

  update(_ticker: Ticker, snapshot: DebugStatsSnapshot): void {
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastSampleAt < SAMPLE_INTERVAL_MS) return;

    const elapsed = now - this.lastSampleAt;
    this.displayFps = Math.round((this.frameCount * 1000) / elapsed);
    this.frameCount = 0;
    this.lastSampleAt = now;

    const lines = [
      `FPS ${this.displayFps}`,
      `graphics ${GRAPHICS_LABELS[snapshot.graphicsQuality]}`,
      `renderer ${rendererLabel(snapshot.renderer)}`,
      `viewport ${snapshot.viewportWidth}×${snapshot.viewportHeight}  dpr ${snapshot.devicePixelRatio.toFixed(2)}`,
      `canvas ${snapshot.renderer.width}×${snapshot.renderer.height}  res ${snapshot.renderer.resolution.toFixed(2)}`,
    ];

    const memoryLine = formatMemoryLine();
    if (memoryLine) lines.push(memoryLine);

    lines.push(...collectPixiRenderStats(snapshot.stage, snapshot.renderer));
    this.root.textContent = lines.join('\n');
  }

  destroy(): void {
    this.root.remove();
  }
}

function formatMemoryLine(): string | null {
  const memory = (performance as Performance & { memory?: PerformanceMemory }).memory;
  if (!memory) return null;
  const usedMb = memory.usedJSHeapSize / 1048576;
  const limitMb = memory.jsHeapSizeLimit / 1048576;
  return `mem ${usedMb.toFixed(1)} / ${limitMb.toFixed(0)} MB`;
}
