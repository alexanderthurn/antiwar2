const STORAGE_KEY = 'antiwar2_client_id';

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `aw2-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export function getClientId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const id = randomId();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return randomId();
  }
}

export function resetClientIdAfterStorageClear(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
