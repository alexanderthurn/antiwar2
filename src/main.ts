import { Application } from 'pixi.js';
import { App } from './App';
import { DESIGN } from './core/DesignSpace';
import { DEV_DEEP_LINK_ENABLED } from './core/DevDeepLink';
import { isDebugMode } from './core/DebugMode';
import { preloadEverything } from './data/AssetLoader';
import { BootLoader, waitFrames } from './ui/BootLoader';
import { hideHtmlBootSplash, setHtmlBootMessage } from './ui/htmlBootSplash';
import { installKewlFont } from './ui/KewlFont';

async function main(): Promise<void> {
  const host = document.getElementById('app');
  if (!host) throw new Error('#app missing');

  setHtmlBootMessage('Loading…');
  await installKewlFont();

  const pixi = new Application();
  await pixi.init({
    background: '#000000',
    antialias: true,
  });

  const app = new App(pixi, host);
  app.prepareForBoot();

  const loader = new BootLoader(pixi);
  app.mountBootLoader(loader);
  loader.showTextOnly();

  const bootstrap = await loader.loadBootstrap();
  loader.showBranded(bootstrap);
  hideHtmlBootSplash();
  await waitFrames(2);

  await preloadEverything((done, total, label) => loader.setProgress(done, total, label));

  loader.destroy({ children: true });
  app.clearBootLoader();
  app.init();

  console.info(`Antiwar — ${DESIGN.width}×${DESIGN.height}`);
  console.info('Cheats (-): in-game kill enemies; menu/campaign toggle unlock all / lock all');
  if (DEV_DEEP_LINK_ENABLED) {
    console.info(
      'Dev URL: ?level=1&round=2&upgrades=rocket:2,aim&money=5000 (level/round are 1-based)',
    );
  }
  if (isDebugMode()) {
    console.info('Debug overlay: ?debug=true');
  }
}

main().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="color:#f88;padding:2rem">${String(err)}</pre>`;
});
