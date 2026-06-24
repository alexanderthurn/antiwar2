import type { AirplaneDef, BombDef } from '../data/types';
import type { EntityTraits } from './EntityTraits';

export function traitsForPlayerProjectile(def: BombDef): EntityTraits {
  return {
    lockOnTarget: false,
    homingTarget: false,
    hittableByPlayer: false,
    hurtsHumansOnGround: false,
    explodesOnDeath: false,
    deathRumble: 'none',
    checkOutOfScreen: def.checkOutOfScreen,
    countsForRoundWin: false,
    isPlayerProjectile: true,
  };
}

export function traitsForEnemyBomb(def: BombDef): EntityTraits {
  return {
    lockOnTarget: true,
    homingTarget: true,
    hittableByPlayer: true,
    hurtsHumansOnGround: true,
    explodesOnDeath: true,
    deathRumble: 'explosion',
    checkOutOfScreen: def.checkOutOfScreen,
    countsForRoundWin: false,
    isPlayerProjectile: false,
  };
}

export function traitsForAirplane(_def: AirplaneDef): EntityTraits {
  return {
    lockOnTarget: true,
    homingTarget: true,
    hittableByPlayer: true,
    hurtsHumansOnGround: false,
    explodesOnDeath: true,
    deathRumble: 'plane',
    checkOutOfScreen: false,
    countsForRoundWin: true,
    isPlayerProjectile: false,
  };
}
