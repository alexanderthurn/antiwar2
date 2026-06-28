import { publicUrl } from './PublicPath';

function campaignBase(campaignId: string): string {
  return `assets/campaign/${campaignId}`;
}

/** FNV-1a 32-bit hash of raw level JSON text. */
export function hashLevelJsonText(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export async function fetchLevelJsonText(campaignId: string, file: string): Promise<string> {
  const path = `${campaignBase(campaignId)}/${file}`;
  const res = await fetch(publicUrl(path));
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.text();
}

export async function hashLevelFile(campaignId: string, file: string): Promise<number> {
  const text = await fetchLevelJsonText(campaignId, file);
  return hashLevelJsonText(text);
}
