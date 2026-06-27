import { marked } from 'https://esm.sh/marked@15.0.7';

const SECTIONS = {
  authoring: { file: 'level-authoring.md', title: 'Level authoring' },
  tests: { file: 'level-tests.md', title: 'Level tests' },
};

const contentEl = document.getElementById('content');
const navLinks = [...document.querySelectorAll('[data-section]')];

/** Pre-applied shop upgrades on every test link (dev URL bootstrap). */
const TEST_DEV_BOOST = 'upgrades=human:5,rocket:3,rocketPower:3';

/** Game root URL (strip /web/… so dev links work from any host). */
function gameBaseUrl() {
  const url = new URL(window.location.href);
  const path = url.pathname.replace(/\/web(?:\/.*)?$/, '/');
  return `${url.origin}${path}`;
}

/** Turn `?level=8&round=4` or `../?level=8` into an absolute play URL. */
function resolvePlayHref(href) {
  if (!href) return href;
  if (href.startsWith('play:')) {
    const [, level, round = '1'] = href.split(':');
    return `${gameBaseUrl()}?level=${level}&round=${round}&${TEST_DEV_BOOST}`;
  }
  if (href.startsWith('?')) return `${gameBaseUrl()}${href}`;
  if (href.startsWith('../?')) return `${gameBaseUrl()}${href.slice(3)}`;
  return href;
}

function rewritePlayLinks(root) {
  for (const link of root.querySelectorAll('a[href]')) {
    const resolved = resolvePlayHref(link.getAttribute('href'));
    if (resolved !== link.getAttribute('href')) {
      link.href = resolved;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.title = resolved;
    }
  }
}

function setActiveNav(sectionId) {
  for (const link of navLinks) {
    link.classList.toggle('active', link.dataset.section === sectionId);
  }
}

async function loadSection(sectionId) {
  const section = SECTIONS[sectionId];
  if (!section) return;

  document.title = `${section.title} — Antiwar docs`;
  setActiveNav(sectionId);
  contentEl.innerHTML = '<p class="loading">Loading…</p>';

  try {
    const res = await fetch(section.file);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const md = await res.text();
    contentEl.innerHTML = marked.parse(md, { gfm: true, breaks: false });
    rewritePlayLinks(contentEl);
  } catch (err) {
    contentEl.innerHTML = `<p class="error">Failed to load <code>${section.file}</code>: ${err.message}</p>`;
  }
}

function sectionFromHash() {
  const id = window.location.hash.replace(/^#/, '');
  return id in SECTIONS ? id : 'authoring';
}

window.addEventListener('hashchange', () => {
  void loadSection(sectionFromHash());
});

for (const link of navLinks) {
  link.addEventListener('click', (event) => {
    const id = link.dataset.section;
    if (!id || id === sectionFromHash()) return;
    event.preventDefault();
    window.location.hash = id;
  });
}

void loadSection(sectionFromHash());
