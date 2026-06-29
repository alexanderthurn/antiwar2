import { Application, Container, Graphics } from 'pixi.js';
import {
  DEFAULT_CAMPAIGN_ID,
  hardcoreRunId,
  HUB_CAMPAIGN_ID,
  isHardcoreRun,
  normalRunId,
  runProgressStore,
  type CampaignRunId,
} from './core/CampaignRun';
import { GAME_VERSION_CODE } from './core/GameVersion';
import { buildBoardId, fetchReplay, fetchScoreMeta, highscoreService, submitHighscore } from './core/HighscoreClient';
import { hashLevelFile } from './core/levelHash';
import { parseBoardId } from './core/leaderboard/boardId';
import { MAX_SIM_STEPS_PER_FRAME, replayMaxStepsPerFrame, SIM_DT } from './core/SimClock';
import { playerProfile } from './core/PlayerProfile';
import { setRunHardcore } from './core/RunMode';
import { shopDigitFromKeyboard } from './core/BuyScript';
import { DESIGN } from './core/DesignSpace';
import {
  clearDevUrl,
  parseDevUrl,
  syncDevUrl,
  type DevGameState,
} from './core/DevDeepLink';
import { clearReplayUrl, parseReplayUrlPlayback, syncReplayPlaybackUrl } from './replay/ReplayDeepLink';
import { decodeReplay } from './replay/ReplayFormat';
import {
  computeLayout,
  clientToStage,
  enrichLayoutForDisplay,
  screenToDesign,
  type ViewportLayout,
} from './core/Viewport';
import { setViewportContext } from './core/ViewportContext';
import { blurBackdropEnabled } from './core/GraphicsQuality';
import { settingsStore } from './core/SettingsStore';
import { watchViewportResize } from './core/ViewportResize';
import { preloadRound } from './data/AssetLoader';
import { isLevelMapEntry, lastPlayableLevelIndex, loadCampaignIndex, loadLevelPack } from './data/types';
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
  private layout: ViewportLayout = {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    gameWidth: 0,
    gameHeight: 0,
    designPxPerCm: 0,
  };
  private mode: SceneMode = 'menu';
  private activeCampaignId = DEFAULT_CAMPAIGN_ID;
  private activeRunId: CampaignRunId = normalRunId(DEFAULT_CAMPAIGN_ID);
  private game: GameScene | null = null;
  private touchUi = false;

  private input = new InputSystem();
  private menuController = new UiMenuController();
  private menuCursor = new MenuCursor();
  private letterbox = new LetterboxOverlay();
  private blurBackdrop = new BlurBackdrop();
  private debugOverlay: DebugOverlay | null = null;
  private menuActionsKey = '';

  private stagePointerPos = { x: 0, y: 0 };
  private pointerOverGame = true;

  private mouseButtons = { left: false, right: false };
  private simAccumulator = 0;
  private replaySimBusy = false;
  /** Only one touch finger drives aim/fire; ignores extra touches that confuse input. */
  private activeTouchPointerId: number | null = null;

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
    pixi.canvas.style.userSelect = 'none';
    pixi.canvas.style.setProperty('-webkit-user-select', 'none');
    pixi.canvas.style.setProperty('-webkit-touch-callout', 'none');
    pixi.canvas.style.setProperty('-webkit-tap-highlight-color', 'transparent');
    pixi.stage.addChild(this.blurBackdrop);
    pixi.stage.addChild(this.gameRoot);
    this.viewportMask.rect(0, 0, DESIGN.width, DESIGN.height).fill(0xffffff);
    this.gameRoot.mask = this.viewportMask;
    this.gameRoot.addChild(this.viewportMask);
    pixi.stage.addChild(this.letterbox);
    pixi.stage.addChild(this.menuCursor);
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

    const playback = parseReplayUrlPlayback();
    if (playback) {
      void this.startReplayById(playback.scoreId, undefined, playback);
      return;
    }

    const dev = parseDevUrl();
    if (dev) {
      void this.bootFromDevUrl(dev);
      return;
    }
    this.showMainMenu(false);
  }

  private async bootFromDevUrl(dev: DevGameState): Promise<void> {
    const index = await loadCampaignIndex(DEFAULT_CAMPAIGN_ID);
    const entry = index.levels[dev.levelIndex];
    if (!entry || !isLevelMapEntry(entry)) {
      console.warn(`[dev-url] Campaign level ${dev.levelIndex + 1} not found`);
      this.showMainMenu(true);
      return;
    }
    const devRunId = normalRunId(DEFAULT_CAMPAIGN_ID);
    runProgressStore.ensureUnlockedAtLeast(devRunId, dev.levelIndex);
    this.activeCampaignId = DEFAULT_CAMPAIGN_ID;
    this.activeRunId = devRunId;

    const pack = await loadLevelPack(DEFAULT_CAMPAIGN_ID, entry.file);
    const roundIndex = Math.min(Math.max(0, dev.roundIndex), pack.rounds.length - 1);
    if (roundIndex !== dev.roundIndex) {
      console.warn(`[dev-url] Round ${roundIndex + 1} out of range — using ${roundIndex + 1}`);
    }

    await this.startLevel(entry.file, dev.levelIndex, {
      levelIndex: dev.levelIndex,
      roundIndex,
      upgradePurchases: dev.upgrades,
      money: dev.money,
    });
  }

  private applyLayout(): void {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    if (width <= 0 || height <= 0) return;

    if (this.pixi.screen.width !== width || this.pixi.screen.height !== height) {
      this.pixi.renderer.resize(width, height);
    }

    this.layout = enrichLayoutForDisplay(
      computeLayout(width, height),
      this.pixi.canvas,
      height,
    );
    setViewportContext({
      layout: this.layout,
      canvas: this.pixi.canvas,
      stageWidth: width,
      stageHeight: height,
    });
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

  private designToStage(x: number, y: number): { x: number; y: number } {
    return {
      x: this.layout.offsetX + x * this.layout.scale,
      y: this.layout.offsetY + y * this.layout.scale,
    };
  }

  private syncMenuCursor(): void {
    if (this.mode === 'game' && this.game?.isReplayMode()) {
      this.pixi.canvas.style.cursor = 'none';
      this.menuCursor.sync(
        this.stagePointerPos.x,
        this.stagePointerPos.y,
        true,
        'pointer',
      );
      return;
    }

    const menuVisible =
      this.mode !== 'game' ||
      (this.game !== null && this.input.modeActive() === 'menu');
    const pointerDriven = this.input.isMenuPointerDriven();

    if (menuVisible && pointerDriven) {
      this.pixi.canvas.style.cursor = 'none';
      this.menuCursor.sync(
        this.stagePointerPos.x,
        this.stagePointerPos.y,
        true,
        'pointer',
      );
      return;
    }

    if (menuVisible) {
      this.pixi.canvas.style.cursor = 'none';
      const { x, y } = this.input.cursor();
      const stage = this.designToStage(x, y);
      this.menuCursor.sync(stage.x, stage.y, true, 'gamepad');
      return;
    }

    if (!this.pointerOverGame) {
      this.pixi.canvas.style.cursor = 'default';
      this.menuCursor.sync(0, 0, false);
      return;
    }

    this.pixi.canvas.style.cursor = 'none';
    this.menuCursor.sync(0, 0, false);
  }

  private setScene(scene: Container): void {
    this.gameRoot.removeChildren();
    this.gameRoot.addChild(scene);
    this.gameRoot.addChild(this.viewportMask);
    this.gameRoot.mask = this.viewportMask;
    this.menuController.clear();
    this.menuActionsKey = '';
  }

  private showMainMenu(resetCampaign = false): void {
    if (resetCampaign) runProgressStore.reset(normalRunId(DEFAULT_CAMPAIGN_ID));
    clearDevUrl();
    clearReplayUrl();
    setRunHardcore(false);
    this.activeCampaignId = DEFAULT_CAMPAIGN_ID;
    this.activeRunId = normalRunId(DEFAULT_CAMPAIGN_ID);
    this.mode = 'menu';
    this.game = null;
    const menu = new MainMenuScene(
      () => this.showCampaignViewFor(HUB_CAMPAIGN_ID, false, { returnTo: 'menu' }),
      () => this.showCredits(),
      () => menu.showSettings(),
      (scoreId, nick) => {
        stopMusic();
        void this.startReplayById(scoreId, nick);
      },
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

  private setActiveRun(campaignId: string, hardcore: boolean): void {
    this.activeCampaignId = campaignId;
    this.activeRunId = hardcore ? hardcoreRunId(campaignId) : normalRunId(campaignId);
  }

  private showCampaignViewFor(
    campaignId: string,
    hardcore: boolean,
    opts?: { newRun?: boolean; returnTo?: string | 'menu' },
  ): void {
    this.setActiveRun(campaignId, hardcore);
    if (opts?.newRun) runProgressStore.reset(this.activeRunId);
    clearDevUrl();
    setRunHardcore(false);
    this.mode = 'campaign';
    this.game = null;
    const activeCampaignId = campaignId;
    const activeRunId = this.activeRunId;
    const returnTo = opts?.returnTo ?? HUB_CAMPAIGN_ID;
    const hardcoreUnlocked = runProgressStore.isNormalCampaignComplete(campaignId);
    this.setScene(
      new CampaignViewScene(
        activeCampaignId,
        activeRunId,
        hardcoreUnlocked,
        () => {
          if (returnTo === 'menu') this.showMainMenu(false);
          else this.showCampaignViewFor(returnTo, false, { returnTo: 'menu' });
        },
        () => this.showCampaignViewFor(activeCampaignId, !isHardcoreRun(activeRunId), { returnTo }),
        (file, levelIndex) => void this.startLevel(file, levelIndex),
        (targetCampaignId) =>
          this.showCampaignViewFor(targetCampaignId, false, { returnTo: activeCampaignId }),
      ),
    );
    playMenuMusic();
  }

  private async applyCampaignUnlockCheat(): Promise<void> {
    const index = await loadCampaignIndex(this.activeCampaignId);
    const max = index.levels.length - 1;
    if (runProgressStore.isAllUnlocked(this.activeRunId, max)) {
      runProgressStore.reset(this.activeRunId);
    } else {
      runProgressStore.unlockAll(this.activeRunId, max);
    }
    this.showCampaignViewFor(this.activeCampaignId, isHardcoreRun(this.activeRunId));
  }

  private async startLevel(file: string, levelIndex: number, devBootstrap?: DevBootstrap): Promise<void> {
    this.mode = 'game';
    this.simAccumulator = 0;
    setRunHardcore(isHardcoreRun(this.activeRunId));
    try {
      const index = await loadCampaignIndex(this.activeCampaignId);
      const finalLevelIndex = lastPlayableLevelIndex(index);
      const pack = await loadLevelPack(this.activeCampaignId, file);
      const roundIndex = devBootstrap?.roundIndex ?? 0;
      await preloadRound(pack, roundIndex);

      const game = new GameScene();
      const runId = this.activeRunId;
      const campaignId = this.activeCampaignId;
      const boardId = buildBoardId(runId, levelIndex);
      const levelHash = await hashLevelFile(campaignId, file);
      if (highscoreService.enabled) {
        await highscoreService.prepareForLevel(boardId);
      }
      let replayBlob: Uint8Array | null = null;
      if (!devBootstrap) {
        game.beginRecording({
          gameVersion: GAME_VERSION_CODE,
          levelHash,
          boardId,
        });
        game.onReplayEncoded((blob) => {
          replayBlob = blob;
        });
      }
      game.onReturnToCampaign = () =>
        this.showCampaignViewFor(campaignId, isHardcoreRun(runId));
      game.onLevelWon = (stats) => {
        const meta = {
          date: Date.now(),
          version: GAME_VERSION_CODE,
          nick: playerProfile.getNick(),
        };
        const timeMs = Math.max(0, Math.floor(stats.timeMs));
        const newRecord = runProgressStore.recordLevelResult(
          runId,
          stats.levelIndex,
          timeMs,
          stats.score,
          meta,
        );
        void submitHighscore({
          boardId,
          time: timeMs,
          score: stats.score,
          replay: replayBlob ?? undefined,
          ...meta,
        });
        const newlyComplete = runProgressStore.completeLevel(
          runId,
          stats.levelIndex,
          finalLevelIndex,
        );
        if (newlyComplete && runId === normalRunId(campaignId)) {
          game.setEndScreenTitle('Campaign complete!\nHardcore mode unlocked.');
        } else if (newRecord) {
          game.setEndScreenTitle('New highscore!');
        }
      };
      game.onLevelComplete = () =>
        this.showCampaignViewFor(campaignId, isHardcoreRun(runId));
      game.onRoundStarted = (state) => syncDevUrl(state);

      const bootstrap: DevBootstrap = devBootstrap ?? { levelIndex, roundIndex: 0 };
      await game.loadLevel(pack, bootstrap.roundIndex, bootstrap);
      if (this.touchUi) game.enableTouchControls();

      this.game = game;
      this.setScene(game);
    } catch (err) {
      console.error('[startLevel] Failed to load level', err);
      this.game = null;
      this.showCampaignViewFor(this.activeCampaignId, isHardcoreRun(this.activeRunId));
    }
  }

  private async startReplayById(
    scoreId: number,
    nickHint?: string,
    urlPlayback?: { speed: number; playing: boolean },
  ): Promise<void> {
    const meta = (await fetchScoreMeta(scoreId)) ?? {
      id: scoreId,
      boardId: '',
      nick: nickHint ?? 'Player',
      time: 0,
      score: 0,
      hasReplay: true,
    };
    if (!meta.hasReplay) {
      console.warn(`[replay] score ${scoreId} has no replay flag — trying anyway`);
    }

    const blob = await fetchReplay(scoreId);
    if (!blob) {
      console.warn(`[replay] failed to load replay ${scoreId}`);
      this.showMainMenu(false);
      return;
    }

    let replay;
    try {
      replay = await decodeReplay(blob);
    } catch (err) {
      console.warn('[replay] decode failed', err);
      this.showMainMenu(false);
      return;
    }

    const boardId = replay.header.boardId || meta.boardId;
    const parsed = parseBoardId(boardId);
    if (!parsed) {
      console.warn(`[replay] invalid boardId ${boardId}`);
      this.showMainMenu(false);
      return;
    }

    const { campaignId, levelIndex, hardcore } = parsed;
    const index = await loadCampaignIndex(campaignId);
    const entry = index.levels[levelIndex];
    if (!entry || !isLevelMapEntry(entry)) {
      console.warn(`[replay] level ${levelIndex} not found`);
      this.showMainMenu(false);
      return;
    }

    const packHash = await hashLevelFile(campaignId, entry.file);
    if (packHash !== replay.header.levelHash) {
      console.warn('[replay] level hash mismatch — level data may have changed');
    }

    this.mode = 'game';
    setRunHardcore(hardcore);
    this.activeCampaignId = campaignId;
    this.activeRunId = hardcore ? hardcoreRunId(campaignId) : normalRunId(campaignId);
    this.simAccumulator = 0;

    try {
      const pack = await loadLevelPack(campaignId, entry.file);
      await preloadRound(pack, 0);

      const game = new GameScene();
      const nick = meta.nick || nickHint || 'Player';
      game.onReturnToCampaign = () => {
        clearReplayUrl();
        this.showMainMenu(false);
      };

      const bootstrap: DevBootstrap = { levelIndex, roundIndex: 0, skipIntro: true };
      await game.loadLevel(pack, 0, bootstrap);
      if (this.touchUi) game.enableTouchControls();

      this.game = game;
      this.setScene(game);

      await game.beginReplay(replay, nick, () => {
        clearReplayUrl();
        this.showMainMenu(false);
      }, scoreId, urlPlayback);

      const driver = game.getReplayDriver();
      if (driver) syncReplayPlaybackUrl(scoreId, driver);
    } catch (err) {
      console.error('[replay] failed to start', err);
      this.game = null;
      this.showMainMenu(false);
    }
  }

  private tick = (): void => {
    const frameDt = this.pixi.ticker.deltaTime / 60;
    this.input.setLayout(this.layout);
    this.input.beginFrame(frameDt);

    if (this.mode === 'game' && this.game) {
      const driver = this.game.getReplayDriver();
      if (driver?.isPlaying() && !driver.isSeeking() && !driver.isAtEnd()) {
        this.simAccumulator += frameDt * driver.getSpeed();
      } else if (!this.game.isReplayMode()) {
        this.simAccumulator += frameDt;
      }

      if (this.game.isReplaySeeking() || driver?.isSeeking()) {
        if (!this.replaySimBusy) {
          this.replaySimBusy = true;
          void this.runReplaySeekFrame(frameDt).finally(() => {
            this.replaySimBusy = false;
          });
        }
      } else if (this.game.isReplayMode()) {
        if (!this.replaySimBusy) {
          this.replaySimBusy = true;
          void this.runReplaySimBatch(frameDt).finally(() => {
            this.replaySimBusy = false;
          });
        }
      } else {
        let steps = 0;
        while (this.simAccumulator >= SIM_DT && steps < MAX_SIM_STEPS_PER_FRAME) {
          this.simAccumulator -= SIM_DT;
          steps++;
          const isLast = steps >= MAX_SIM_STEPS_PER_FRAME || this.simAccumulator < SIM_DT;
          this.game.update(SIM_DT, this.input, this.menuController, { visuals: isLast });
        }
      }

      this.syncMenuCursor();
      this.syncBackdrop();
    } else {
      this.simAccumulator = 0;
      this.input.setMode('menu');
      const scene = this.gameRoot.children[0];
      if (isMenuActionsHost(scene)) {
        const actions = scene.getMenuActions();
        const key = actions.map((a) => a.id).join('|');
        if (key !== this.menuActionsKey) {
          this.menuActionsKey = key;
          this.menuController.setActions(actions);
        }
        const handled = scene.handleMenuInput?.(this.input) === true;
        if (!handled) {
          this.menuController.update(this.input);
          if (this.input.cancelPressed()) scene.onMenuCancel?.();
        }
      }

      if (scene && 'update' in scene && typeof scene.update === 'function') {
        scene.update(frameDt);
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

  private async runReplaySeekFrame(_frameDt: number): Promise<void> {
    this.game?.update(SIM_DT, this.input, this.menuController, { visuals: true });
  }

  private async runReplaySimBatch(frameDt: number): Promise<void> {
    if (!this.game?.isReplayMode()) return;
    const driver = this.game.getReplayDriver();
    if (!driver) return;

    if (driver.isPlaying() && !driver.isAtEnd()) {
      this.simAccumulator += frameDt * driver.getSpeed();
    }

    if (this.game.isReplayInShop()) {
      this.simAccumulator = 0;
      this.game.update(SIM_DT, this.input, this.menuController, { visuals: true });
      return;
    }

    if (driver.isPlaying() && driver.isAtEnd()) {
      this.simAccumulator = 0;
      if (this.game.loopReplayIfAtEnd()) return;
    }

    if (!driver.isPlaying() || driver.isAtEnd()) {
      this.game.update(frameDt, this.input, this.menuController, { visuals: true, replayIdle: true });
      return;
    }

    const maxSteps = replayMaxStepsPerFrame(driver.getSpeed());
    let steps = 0;
    while (this.simAccumulator >= SIM_DT && steps < maxSteps) {
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      if (!driver.isPlaying() || driver.isAtEnd()) break;
      this.simAccumulator -= SIM_DT;
      steps++;
      const isLast = steps >= maxSteps || this.simAccumulator < SIM_DT;
      this.game.update(SIM_DT, this.input, this.menuController, { visuals: isLast });
    }
  };

  private bindInput(): void {
    const canvas = this.pixi.canvas;

    const isPrimaryTouch = (e: PointerEvent): boolean => {
      if (e.pointerType !== 'touch') return true;
      return this.activeTouchPointerId === null || e.pointerId === this.activeTouchPointerId;
    };

    const suppressTouchDefault = (e: PointerEvent): void => {
      if (e.pointerType === 'touch') e.preventDefault();
    };

    const beginPointer = (e: PointerEvent): void => {
      if (e.pointerType === 'touch') {
        suppressTouchDefault(e);
        if (this.activeTouchPointerId !== null && e.pointerId !== this.activeTouchPointerId) {
          return;
        }
        this.activeTouchPointerId = e.pointerId;
        canvas.setPointerCapture(e.pointerId);
      }

      const { x, y } = this.stagePointer(e.clientX, e.clientY);
      this.stagePointerPos.x = x;
      this.stagePointerPos.y = y;
      if (this.layout) {
        this.pointerOverGame = screenToDesign(x, y, this.layout).inGame;
      }
      this.input.onPointerDown(x, y);
      if (this.mode !== 'game' || this.game?.isReplayMode()) return;
      if (this.touchUi) this.game?.handleTouchPointerDown(this.input, x, y);
    };

    const movePointer = (e: PointerEvent): void => {
      if (!isPrimaryTouch(e)) return;
      suppressTouchDefault(e);

      const { x, y } = this.stagePointer(e.clientX, e.clientY);
      this.stagePointerPos.x = x;
      this.stagePointerPos.y = y;
      if (this.layout) {
        this.pointerOverGame = screenToDesign(x, y, this.layout).inGame;
      }
      this.input.onPointerMove(x, y);
      if (this.mode === 'game' && this.game && !this.game.isReplayMode()) {
        if (this.touchUi) this.game.handleTouchPointerMove(this.input, x, y);
        else this.game.handlePointerMove(this.input, x, y);
      }
    };

    const endPointer = (e: PointerEvent): void => {
      if (e.pointerType === 'touch') {
        if (this.activeTouchPointerId !== e.pointerId) return;
        suppressTouchDefault(e);
        this.activeTouchPointerId = null;
        if (canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      }

      this.input.onPointerUp();
      if (this.mode !== 'game' || this.game?.isReplayMode()) return;
      if (this.touchUi) this.game?.handleTouchPointerUp(this.input);
    };

    canvas.addEventListener('pointerdown', beginPointer);
    canvas.addEventListener('pointermove', movePointer);
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('selectstart', (e) => e.preventDefault());
    canvas.addEventListener('dragstart', (e) => e.preventDefault());

    if (this.touchUi) {
      document.addEventListener('contextmenu', (e) => e.preventDefault(), { capture: true });
      document.addEventListener(
        'gesturestart',
        (e) => e.preventDefault(),
        { capture: true, passive: false },
      );
    }

    if (!this.touchUi) {
      this.pixi.canvas.addEventListener('mousedown', (e) => {
        if (this.mode !== 'game' || this.game?.isReplayMode()) return;
        if (e.button === 0) this.mouseButtons.left = true;
        if (e.button === 2) this.mouseButtons.right = true;
        this.game?.notifyPointerFireDown(e.button === 0, e.button === 2);
        this.game?.setPointerFire(this.input, this.mouseButtons.left, this.mouseButtons.right);
      });
      window.addEventListener('mouseup', (e) => {
        if (this.mode !== 'game' || this.game?.isReplayMode()) return;
        if (e.button === 0) this.mouseButtons.left = false;
        if (e.button === 2) this.mouseButtons.right = false;
        this.game?.setPointerFire(this.input, this.mouseButtons.left, this.mouseButtons.right);
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (this.mode === 'game' && this.game?.handleReplayKey(e.key, e.code)) {
        e.preventDefault();
        return;
      }
      if (e.key === 'Escape') {
        if (this.mode === 'game' && this.game?.isReplayMode()) {
          return;
        }
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
        if (this.mode === 'campaign') {
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
      const shopDigit = shopDigitFromKeyboard(e);
      if (shopDigit !== null && this.mode === 'game' && this.game) {
        this.game.runBuyMacro(shopDigit);
      }
    });
  }
}
