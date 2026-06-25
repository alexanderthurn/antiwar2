import { Application, Container, Graphics } from 'pixi.js';
import { CampaignProgress } from './core/CampaignProgress';
import { DESIGN } from './core/DesignSpace';
import {
  clearDevUrl,
  parseDevUrl,
  syncDevUrl,
  type DevGameState,
} from './core/DevDeepLink';
import { computeLayout, clientToStage, type ViewportLayout } from './core/Viewport';
import { blurBackdropEnabled } from './core/GraphicsQuality';
import { settingsStore } from './core/SettingsStore';
import { watchViewportResize } from './core/ViewportResize';
import { preloadRound } from './data/AssetLoader';
import { loadCampaignIndex, loadLevelPack } from './data/types';
import { stopMusic } from './audio/SoundManager';
import { playMenuMusic } from './audio/UiSounds';
import { InputSystem } from './input/InputSystem';
import { isMenuActionsHost } from './input/MenuActionsHost';
import { MenuCursor } from './input/MenuCursor';
import { UiMenuController } from './input/UiMenuController';
import { LetterboxOverlay } from './ui/LetterboxOverlay';
import { BlurBackdrop } from './ui/BlurBackdrop';
import { DebugOverlay } from './ui/DebugOverlay';
import { isDebugMode } from './core/DebugMode';
import { MENU_POINTER_CURSOR } from './ui/MenuPointer';
import { CampaignViewScene } from './scenes/CampaignViewScene';
import { CreditsScene } from './scenes/CreditsScene';
import { GameScene, type DevBootstrap } from './scenes/GameScene';
import { MainMenuScene } from './scenes/MainMenuScene';

function wantsTouchUi(): boolean {
  return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

type SceneMode = 'menu' | 'campaign' | 'game' | 'credits';

export class App {
  private readonly gameRoot = new Container();
  private readonly viewportMask = new Graphics();
  private layout: ViewportLayout = { scale: 1, offsetX: 0, offsetY: 0, gameWidth: 0, gameHeight: 0 };
  private mode: SceneMode = 'menu';
  private campaignProgress = new CampaignProgress();
  private game: GameScene | null = null;
  private touchUi = false;

  private input = new InputSystem();
  private menuController = new UiMenuController();
  private menuCursor = new MenuCursor();
  private letterbox = new LetterboxOverlay();
  private blurBackdrop = new BlurBackdrop();
  private debugOverlay: DebugOverlay | null = null;
  private menuActionsKey = '';

  private mouseButtons = { left: false, right: false };

  constructor(
    private readonly pixi: Application,
    private readonly host: HTMLElement,
  ) {
    host.appendChild(pixi.canvas);
    pixi.canvas.style.display = 'block';
    pixi.canvas.style.width = '100%';
    pixi.canvas.style.height = '100%';
    pixi.canvas.style.cursor = 'none';
    pixi.canvas.style.touchAction = 'none';
    pixi.stage.addChild(this.blurBackdrop);
    pixi.stage.addChild(this.gameRoot);
    this.viewportMask.rect(0, 0, DESIGN.width, DESIGN.height).fill(0xffffff);
    this.gameRoot.mask = this.viewportMask;
    this.gameRoot.addChild(this.viewportMask);
    pixi.stage.addChild(this.letterbox);
    this.gameRoot.addChild(this.menuCursor);
    this.touchUi = wantsTouchUi();
    this.pixi.ticker.add(this.tick);
    this.bindInput();
    settingsStore.subscribe(() => this.applyGraphicsSettings());
    this.applyGraphicsSettings();
    if (isDebugMode()) {
      this.debugOverlay = new DebugOverlay(host);
    }
  }

  private applyGraphicsSettings(): void {
    this.blurBackdrop.setEnabled(blurBackdropEnabled(settingsStore.get().graphicsQuality));
  }

  init(): void {
    this.applyLayout();
    watchViewportResize(this.host, () => this.applyLayout());

    const dev = parseDevUrl();
    if (dev) {
      void this.bootFromDevUrl(dev);
      return;
    }
    this.showMainMenu(false);
  }

  private async bootFromDevUrl(dev: DevGameState): Promise<void> {
    const index = await loadCampaignIndex();
    const entry = index.levels[dev.levelIndex];
    if (!entry) {
      console.warn(`[dev-url] Campaign level ${dev.levelIndex + 1} not found`);
      this.showMainMenu(true);
      return;
    }
    this.campaignProgress.reset();
    this.campaignProgress.playingIndex = dev.levelIndex;
    for (let i = 0; i < dev.levelIndex; i++) this.campaignProgress.completeLevel(i);

    const pack = await loadLevelPack(entry.file);
    const roundIndex = Math.min(Math.max(0, dev.roundIndex), pack.rounds.length - 1);
    if (roundIndex !== dev.roundIndex) {
      console.warn(`[dev-url] Round ${roundIndex + 1} out of range — using ${roundIndex + 1}`);
    }

    await this.startLevel(entry.file, dev.levelIndex, {
      levelIndex: dev.levelIndex,
      roundIndex,
      upgradePurchases: dev.upgrades,
      money: dev.money,
      skipIntro: true,
    });
  }

  private applyLayout(): void {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    if (width <= 0 || height <= 0) return;

    if (this.pixi.screen.width !== width || this.pixi.screen.height !== height) {
      this.pixi.renderer.resize(width, height);
    }

    this.layout = computeLayout(width, height);
    this.gameRoot.scale.set(this.layout.scale);
    this.gameRoot.position.set(this.layout.offsetX, this.layout.offsetY);
    this.blurBackdrop.sync(width, height);
    this.letterbox.sync(width, height, this.layout);
    this.input.setLayout(this.layout);
  }

  private syncBackdrop(): void {
    if (!this.blurBackdrop.isEnabled()) return;
    const { width, height } = this.pixi.screen;
    if (width <= 0 || height <= 0) return;
    this.blurBackdrop.capture(
      this.pixi.renderer,
      this.gameRoot,
      this.menuCursor,
      this.viewportMask,
    );
    this.blurBackdrop.sync(width, height);
  }

  private stagePointer(clientX: number, clientY: number): { x: number; y: number } {
    const { width, height } = this.pixi.screen;
    return clientToStage(clientX, clientY, this.pixi.canvas, width, height);
  }

  private syncMenuCursor(): void {
    const menuVisible =
      this.mode !== 'game' ||
      (this.game !== null && this.input.modeActive() === 'menu');
    const pointerDriven = this.input.isMenuPointerDriven();
    this.pixi.canvas.style.cursor = menuVisible && pointerDriven ? MENU_POINTER_CURSOR : 'none';

    if (!menuVisible || pointerDriven) {
      this.menuCursor.sync(0, 0, false);
      return;
    }
    const { x, y } = this.input.cursor();
    this.menuCursor.sync(x, y, true);
  }

  private setScene(scene: Container): void {
    this.gameRoot.removeChildren();
    this.gameRoot.addChild(scene);
    this.gameRoot.addChild(this.viewportMask);
    this.gameRoot.mask = this.viewportMask;
    this.gameRoot.addChild(this.menuCursor);
    this.menuController.clear();
    this.menuActionsKey = '';
  }

  private showMainMenu(resetCampaign = false): void {
    if (resetCampaign) this.campaignProgress.reset();
    clearDevUrl();
    this.mode = 'menu';
    this.game = null;
    const menu = new MainMenuScene(
      () => this.showCampaignView(false),
      () => this.showCredits(),
      () => menu.showSettings(),
    );
    this.setScene(menu);
    playMenuMusic();
  }

  private showCredits(): void {
    clearDevUrl();
    stopMusic();
    this.mode = 'credits';
    this.game = null;
    this.setScene(new CreditsScene(() => this.showMainMenu(false)));
  }

  private showCampaignView(newRun = false): void {
    if (newRun) this.campaignProgress.reset();
    clearDevUrl();
    this.mode = 'campaign';
    this.game = null;
    this.setScene(
      new CampaignViewScene(
        this.campaignProgress,
        () => this.showMainMenu(false),
        (file, levelIndex) => void this.startLevel(file, levelIndex),
      ),
    );
    playMenuMusic();
  }

  private async applyCampaignUnlockCheat(): Promise<void> {
    const index = await loadCampaignIndex();
    const max = index.levels.length - 1;
    if (this.campaignProgress.isAllUnlocked(max)) {
      this.campaignProgress.reset();
    } else {
      this.campaignProgress.unlockAll(max);
    }
    this.showCampaignView(false);
  }

  private async startLevel(file: string, levelIndex: number, devBootstrap?: DevBootstrap): Promise<void> {
    this.mode = 'game';
    this.campaignProgress.playingIndex = levelIndex;
    const pack = await loadLevelPack(file);
    const roundIndex = devBootstrap?.roundIndex ?? 0;
    await preloadRound(pack, roundIndex);

    const game = new GameScene();
    game.onReturnToMenu = () => this.showMainMenu(false);
    game.onReturnToCampaign = () => this.showCampaignView(false);
    game.onLevelComplete = () => {
      this.campaignProgress.completeLevel(levelIndex);
      this.showCampaignView(false);
    };
    game.onRoundStarted = (state) => syncDevUrl(state);

    const bootstrap: DevBootstrap = devBootstrap ?? { levelIndex, roundIndex: 0 };
    await game.loadLevel(pack, bootstrap.roundIndex, bootstrap);
    if (this.touchUi) game.enableTouchControls(this.input);

    this.game = game;
    this.setScene(game);
  }

  private tick = (): void => {
    const dt = this.pixi.ticker.deltaTime / 60;
    this.input.setLayout(this.layout);
    this.input.beginFrame(dt);

    if (this.mode === 'game' && this.game) {
      this.game.update(dt, this.input, this.menuController);
      this.syncMenuCursor();
      this.syncBackdrop();
    } else {
      this.input.setMode('menu');
      const scene = this.gameRoot.children[0];
      if (isMenuActionsHost(scene)) {
        const actions = scene.getMenuActions();
        const key = actions.map((a) => a.id).join('|');
        if (key !== this.menuActionsKey) {
          this.menuActionsKey = key;
          this.menuController.setActions(actions);
        }
        this.menuController.update(this.input);
        if (this.input.cancelPressed()) scene.onMenuCancel?.();
      }

      if (scene && 'update' in scene && typeof scene.update === 'function') {
        scene.update(dt);
      }

      this.syncMenuCursor();
      this.syncBackdrop();
    }

    this.debugOverlay?.update(this.pixi.ticker, {
      graphicsQuality: settingsStore.get().graphicsQuality,
      renderer: this.pixi.renderer,
      stage: this.pixi.stage,
      viewportWidth: this.host.clientWidth,
      viewportHeight: this.host.clientHeight,
      devicePixelRatio: window.devicePixelRatio,
    });
  };

  private bindInput(): void {
    this.pixi.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = this.stagePointer(e.clientX, e.clientY);
      this.input.onPointerMove(x, y);
      if (this.mode === 'game' && this.game) {
        if (this.touchUi) this.game.handleTouchPointerMove(this.input, x, y);
        else this.game.handlePointerMove(this.input, x, y);
      }
    });

    this.pixi.canvas.addEventListener('pointerdown', (e) => {
      const { x, y } = this.stagePointer(e.clientX, e.clientY);
      this.input.onPointerDown(x, y);
      if (this.mode !== 'game') return;
      if (this.touchUi) this.game?.handleTouchPointerDown(this.input, x, y);
    });

    this.pixi.canvas.addEventListener('pointerup', () => {
      this.input.onPointerUp();
      if (this.mode !== 'game') return;
      if (this.touchUi) this.game?.handleTouchPointerUp(this.input);
    });

    this.pixi.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    if (!this.touchUi) {
      this.pixi.canvas.addEventListener('mousedown', (e) => {
        if (this.mode !== 'game') return;
        if (e.button === 0) this.mouseButtons.left = true;
        if (e.button === 2) this.mouseButtons.right = true;
        this.game?.setPointerFire(this.input, this.mouseButtons.left, this.mouseButtons.right);
      });
      window.addEventListener('mouseup', (e) => {
        if (this.mode !== 'game') return;
        if (e.button === 0) this.mouseButtons.left = false;
        if (e.button === 2) this.mouseButtons.right = false;
        this.game?.setPointerFire(this.input, this.mouseButtons.left, this.mouseButtons.right);
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.key === 'Escape') {
        if (this.mode === 'game') {
          this.game?.togglePause();
        } else if (this.mode === 'credits' || this.mode === 'campaign') {
          const scene = this.gameRoot.children[0];
          if (isMenuActionsHost(scene)) scene.onMenuCancel?.();
        }
        return;
      }
      if (e.key === '-') {
        if (this.mode === 'game' && this.game) {
          this.game.cheatKillVisibleEnemies();
          return;
        }
        if (this.mode === 'campaign' || this.mode === 'menu') {
          void this.applyCampaignUnlockCheat();
        }
        return;
      }
      if (e.key === '+' || e.key === '=') {
        if (this.mode === 'game' && this.game) {
          this.game.cheatKillCivilians();
        }
        return;
      }
      if (e.code === 'NumpadMultiply' || e.key === '*') {
        if (this.mode === 'game' && this.game) {
          this.game.cheatTestRumble();
        }
        return;
      }
    });
  }
}
