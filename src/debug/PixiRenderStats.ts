import type { Container, Renderer } from 'pixi.js';

interface InstructionSetLike {
  instructionSize: number;
  instructions: Array<{ action?: string }>;
  renderables: unknown[];
}

/** Best-effort Pixi v8 frame stats (uses internal instruction-set data when present). */
export function collectPixiRenderStats(stage: Container, renderer: Renderer): string[] {
  const lines: string[] = [];
  const set = (stage as Container & { renderGroup?: { instructionSet?: InstructionSetLike } })
    .renderGroup?.instructionSet;

  if (set) {
    lines.push(`renderables ${set.renderables.length}`);
  }

  if (set && set.instructionSize > 0) {
    let batches = 0;
    for (let i = 0; i < set.instructionSize; i++) {
      if (set.instructions[i]?.action === 'startBatch') batches++;
    }
    if (batches > 0) lines.push(`batches ${batches}`);
    lines.push(`instructions ${set.instructionSize}`);
  }

  const textureSystem = (renderer as { texture?: { managedTextures?: unknown[] } }).texture;
  const textureCount = textureSystem?.managedTextures?.length;
  if (textureCount != null) {
    lines.push(`textures ${textureCount}`);
  }

  if (!lines.length) {
    lines.push('render stats n/a');
  }

  return lines;
}

export function rendererLabel(renderer: Renderer): string {
  if ('gl' in renderer && (renderer as { gl?: unknown }).gl) return 'WebGL';
  if ('gpu' in renderer && (renderer as { gpu?: unknown }).gpu) return 'WebGPU';
  return renderer.constructor.name.replace(/Renderer$/, '') || 'Unknown';
}
