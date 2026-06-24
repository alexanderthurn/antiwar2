/** Cleanup returned by {@link watchViewportResize}. */
export type ViewportResizeCleanup = () => void;

/**
 * Subscribe to every common signal that can change the drawable game area.
 *
 * Covered cases:
 * - window resize (browser chrome, DevTools dock, split panes)
 * - host element size changes via CSS/layout (ResizeObserver)
 * - mobile orientation changes
 * - mobile browser UI show/hide and pinch-zoom (visualViewport)
 */
export function watchViewportResize(
  target: HTMLElement,
  onResize: () => void,
): ViewportResizeCleanup {
  let raf = 0;
  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      onResize();
    });
  };

  const ro = new ResizeObserver(schedule);
  ro.observe(target);

  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);

  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
  }

  return () => {
    if (raf) cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener('resize', schedule);
    window.removeEventListener('orientationchange', schedule);
    if (vv) {
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
    }
  };
}
