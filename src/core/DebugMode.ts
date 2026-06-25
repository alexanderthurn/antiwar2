/** `?debug=true` or `?debug=1` — shows on-screen stats overlay. */
export function isDebugMode(): boolean {
  const value = new URLSearchParams(window.location.search).get('debug');
  return value === 'true' || value === '1';
}

/** Keep debug flag when other URL helpers rewrite the query string. */
export function appendDebugParam(params: URLSearchParams): void {
  if (!isDebugMode()) return;
  params.set('debug', 'true');
}
