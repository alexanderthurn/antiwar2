/** Parse `?replay=123` for direct replay playback. */
export function parseReplayUrl(): number | null {
  const raw = new URLSearchParams(window.location.search).get('replay');
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function syncReplayUrl(scoreId: number): void {
  const params = new URLSearchParams(window.location.search);
  params.set('replay', String(scoreId));
  const query = params.toString();
  window.history.replaceState(null, '', query ? `${window.location.pathname}?${query}` : window.location.pathname);
}

export function clearReplayUrl(): void {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('replay')) return;
  params.delete('replay');
  const query = params.toString();
  window.history.replaceState(null, '', query ? `${window.location.pathname}?${query}` : window.location.pathname);
}
