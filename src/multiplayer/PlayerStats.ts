export class PlayerStats {
  rocketsFired = 0;
  hits = 0;
  kills = 0;
  bombsDestroyed = 0;
  lockOnKills = 0;
  damageDealt = 0;

  reset(): void {
    this.rocketsFired = 0;
    this.hits = 0;
    this.kills = 0;
    this.bombsDestroyed = 0;
    this.lockOnKills = 0;
    this.damageDealt = 0;
  }
}
