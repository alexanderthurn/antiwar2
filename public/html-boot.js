(function () {
  const SHOW_DELAY_MS = 500;
  const SHAKE_DECAY = 5;
  const SHAKE_MAX = 18;
  const SHAKE_PER_CLICK = 2;
  const HOVER_SHAKE = 0.5;

  const boot = document.getElementById('html-boot');
  const logo = document.getElementById('html-boot-logo');
  if (!boot || !logo) return;

  let time = 0;
  let shakeLevel = 0;
  let hovered = false;
  let visible = false;
  let hidden = false;
  let rafId = 0;
  let lastTs = 0;
  let showTimer = 0;

  function applyTransform() {
    const bobY = Math.sin(time * 1.8) * 6;
    const swayX = Math.sin(time * 1.2) * 4;
    const rot = Math.sin(time * 0.9) * 0.02;

    const s = hovered ? Math.max(shakeLevel, HOVER_SHAKE) : shakeLevel;
    const freq = 28 + s * 10;
    const shakeX =
      Math.sin(time * freq) * s * 2.8 + Math.sin(time * freq * 2.3) * s * 1.4;
    const shakeY =
      Math.cos(time * freq * 1.4) * s * 2.2 + Math.sin(time * freq * 1.9) * s * 1.2;
    const shakeRot = Math.sin(time * freq * 0.8) * s * 0.012;

    const tx = swayX + shakeX;
    const ty = bobY + shakeY;
    const rotDeg = (rot + shakeRot) * (180 / Math.PI);
    logo.style.transform = 'translate(' + tx + 'px, ' + ty + 'px) rotate(' + rotDeg + 'deg)';
  }

  function tick(ts) {
    if (hidden) return;
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    time += dt;
    shakeLevel = Math.max(0, shakeLevel - SHAKE_DECAY * dt);
    if (visible) applyTransform();
    rafId = requestAnimationFrame(tick);
  }

  function show() {
    if (hidden || visible) return;
    visible = true;
    boot.classList.add('boot-visible');
    boot.classList.remove('boot-pending');
  }

  function hide() {
    if (hidden) return;
    hidden = true;
    if (showTimer) {
      window.clearTimeout(showTimer);
      showTimer = 0;
    }
    if (!visible) {
      boot.remove();
      if (rafId) cancelAnimationFrame(rafId);
      return;
    }
    boot.classList.add('is-hidden');
    boot.setAttribute('aria-busy', 'false');
    window.setTimeout(function () {
      boot.remove();
      if (rafId) cancelAnimationFrame(rafId);
    }, 220);
  }

  showTimer = window.setTimeout(show, SHOW_DELAY_MS);

  const hit = document.getElementById('html-boot-logo-hit');
  if (hit) {
    hit.addEventListener('pointerenter', function () {
      hovered = true;
    });
    hit.addEventListener('pointerleave', function () {
      hovered = false;
    });
    hit.addEventListener('click', function () {
      shakeLevel = Math.min(shakeLevel + SHAKE_PER_CLICK, SHAKE_MAX);
    });
  }

  rafId = requestAnimationFrame(tick);
  window.HtmlBoot = { hide: hide };
})();
