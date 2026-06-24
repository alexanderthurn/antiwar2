/** Fair rocket cap split — remainder goes to lowest cap (lower slot on tie). */
export function distributeRocketCaps(maxRockets: number, activeCount: number): number[] {
  if (activeCount <= 0) return [];
  const caps = Array.from({ length: activeCount }, () => Math.floor(maxRockets / activeCount));
  let remainder = maxRockets % activeCount;
  while (remainder > 0) {
    const minCap = Math.min(...caps);
    const i = caps.findIndex((c) => c === minCap);
    caps[i]! += 1;
    remainder -= 1;
  }
  return caps;
}
