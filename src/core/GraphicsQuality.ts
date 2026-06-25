/** User-facing graphics preset — drives particles, blur margins, and related effects. */
export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

/** Internal effect tier used by particle and explosion systems. */
export type EffectQuality = 'low' | 'normal' | 'high' | 'ultra';

export const GRAPHICS_ORDER: GraphicsQuality[] = ['low', 'medium', 'high', 'ultra'];

export const GRAPHICS_LABELS: Record<GraphicsQuality, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  ultra: 'Ultra',
};

export function effectQualityForGraphics(quality: GraphicsQuality): EffectQuality {
  switch (quality) {
    case 'low':
      return 'low';
    case 'medium':
      return 'normal';
    case 'high':
      return 'high';
    case 'ultra':
      return 'ultra';
  }
}

export function blurBackdropEnabled(quality: GraphicsQuality): boolean {
  return quality === 'high' || quality === 'ultra';
}

/** Map legacy `particleQuality` saves to the new graphics preset. */
export function graphicsQualityFromLegacyParticle(
  particleQuality: 'low' | 'normal' | 'high',
): GraphicsQuality {
  switch (particleQuality) {
    case 'low':
      return 'low';
    case 'normal':
      return 'medium';
    case 'high':
      return 'high';
  }
}
