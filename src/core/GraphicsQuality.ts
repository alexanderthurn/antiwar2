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

/** Count multipliers for ambient weather (rain, snow, clouds). */
export interface WeatherQualityProfile {
  rain: number;
  snow: number;
  clouds: number;
}

export const WEATHER_QUALITY: Record<EffectQuality, WeatherQualityProfile> = {
  low: { rain: 0, snow: 0, clouds: 0 },
  normal: { rain: 0.45, snow: 0.45, clouds: 0.45 },
  high: { rain: 1, snow: 1, clouds: 1 },
  ultra: { rain: 1, snow: 1, clouds: 1 },
};

export function weatherQualityForGraphics(quality: GraphicsQuality): WeatherQualityProfile {
  return WEATHER_QUALITY[effectQualityForGraphics(quality)];
}

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
