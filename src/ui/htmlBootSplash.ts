/** Instant splash from index.html — remove once the Pixi boot loader is ready. */
export function hideHtmlBootSplash(): void {
  const el = document.getElementById('html-boot');
  if (!el) return;
  el.classList.add('is-hidden');
  el.setAttribute('aria-busy', 'false');
  window.setTimeout(() => el.remove(), 220);
}

/** Optional status line while JS is still parsing / initializing. */
export function setHtmlBootMessage(message: string): void {
  const el = document.querySelector('#html-boot p');
  if (el) el.textContent = message;
}
