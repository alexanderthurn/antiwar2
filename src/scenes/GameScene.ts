import { BitmapText, Container, Graphics, Rectangle, Sprite, Texture, type Texture as Tex } from 'pixi.js';
import { playKillStreakSound, playSound, sfxPath } from '../audio/SoundManager';
import { createLevelAudio, type LevelAudio } from '../audio/LevelSounds';
import { DESIGN, V1_SPRITES, towerXForSlot } from '../core/DesignSpace';
import { effectQualityForGraphics, weatherQualityForGraphics } from '../core/GraphicsQuality';
import { settingsStore } from '../core/SettingsStore';
import { LevelSession, UPGRADE_KEYS, type UpgradeKey } from '../core/LevelSession';
import { computeLevelScore, type LevelWonStats } from '../core/CampaignRun';
import { SIM_DT } from '../core/SimClock';
import { newReplaySeed, resetSimRng, simRng } from '../core/SimRng';
import { BUY_MACRO_STEP_MS, BUY_MACROS } from '../core/BuyScript';
import { DEV_DEEP_LINK_ENABLED, type DevGameState } from '../core/DevDeepLink';
import { loadTexture, preloadRound } from '../data/AssetLoader';
import {
  hasActiveStoryLimits,
  resolveRoundAudio,
  resolveRoundVisuals,
  resolveStoryLimits,
} from '../data/RoundSettings';
import { loadCollisionShapes } from '../data/CollisionShapes';
import { beginCollisionFrame } from '../systems/collision';
import type { BombDef, LevelPack, RoundDef, StoryLimits } from '../data/types';
import { CombatEntity } from '../entities/CombatEntity';
import { EntityController } from '../entities/EntityController';
import {
  bombExplosionRadius,
  planeExplosionRadius,
  planeExplosionType,
} from '../entities/ExplosionRadius';
import { PlayerManager } from '../multiplayer/PlayerManager';
import type { InputSystem } from '../input/InputSystem';
import { PlayerSlot } from '../multiplayer/PlayerSlot';
import { CloudLayer } from '../systems/CloudLayer';
import { WeatherLayer } from '../systems/WeatherLayer';
import { NightVisionLayer } from '../systems/NightVisionLayer';
import { ExplosionManager } from '../systems/ExplosionManager';
import { ParticleFxManager } from '../systems/particles/ParticleFxManager';
import { KillStreakManager } from '../systems/KillStreakTracker';
import {
  explosionRadiusToIntensity,
  RumbleController,
} from '../systems/RumbleController';
import { BossHpBar } from '../ui/BossHpBar';
import { EntityHpBarOverlay } from '../ui/EntityHpBarOverlay';
import { GameHud, playerRocketIconScale } from '../ui/GameHud';
import { JoinPanel } from '../ui/JoinPanel';
import { PauseOverlay } from '../ui/PauseOverlay';
import { TouchControls } from '../ui/TouchControls';
import { ShopOverlay } from '../ui/ShopOverlay';
import { SettingsOverlay } from '../ui/SettingsOverlay';
import type { MenuActionsHost } from '../input/MenuActionsHost';
import type { UiAction } from '../input/UiMenuController';
import type { UiMenuController } from '../input/UiMenuController';
import { kewlString, kewlText } from '../ui/KewlFont';
import { ReplayDriver } from '../replay/ReplayDriver';
import { ReplayRecorder } from '../replay/ReplayRecorder';
import type { DecodedReplay, ReplayHeader } from '../replay/replayTypes';
import { ReplayOverlay } from '../ui/ReplayOverlay';
import { syncReplayPlaybackUrl } from '../replay/ReplayDeepLink';

const HUMAN_FRAME_W = 256;
const HUMAN_FRAME_H = 344;
const HUMAN_FRAME_COLS = 3;
/** human.png rows (1-based): 2 = walk right, 4 = walk left — 3 frames per row. */
const HUMAN_ROW_WALK_RIGHT = 1;
const HUMAN_ROW_WALK_LEFT = 3;
const HUMAN_SCALE = 0.2;
const HUMAN_WALK_PX_PER_FRAME = 7;
const GROUND_FEET_Y = DESIGN.groundY+2;
const CIVILIAN_WALK_SPEED = 50;
const CIVILIAN_MIN_X = 120;
const CIVILIAN_MAX_X = DESIGN.width - 120;

/** Top-right player roster — disabled until the UI is redesigned. */
const SHOW_JOIN_PANEL = false;
const END_SCREEN_ANIM_S = 2.4;
/** Max display scale when rocket damage exceeds the level base (2× damage → 1.5× size). */
const PLAYER_ROCKET_DAMAGE_SCALE_MAX = 2;
/** Seconds between autofire shots while fire is held (clicks are not limited). */
const PLAYER_AUTO_FIRE_COOLDOWN_S = 0.5;
const PLAYER_TOUCH_AUTO_FIRE_COOLDOWN_S = PLAYER_AUTO_FIRE_COOLDOWN_S * 0.5;
/** Damage multiplier for rockets fired with an active lock-on target. */
const LOCK_ON_ROCKET_DAMAGE_FACTOR = 2.0;

type Phase = 'playing' | 'shop' | 'levelComplete' | 'gameOver' | 'paused';

interface AirplaneSpawn {
  type: string;
  x: number;
  y: number;
}

interface CivilianDamageSource {
  explosionType?: number;
  explosionRange?: number;
  hitFrom?: { x: number; y: number };
  feeder?: number;
  /** Napalm pool / ember tick — throttles repeated screams. */
  lingeringBurn?: boolean;
}

interface Civilian {
  id: number;
  sprite: Sprite;
  x: number;
  hp: number;
  maxHp: number;
  dir: 1 | -1;
  alive: boolean;
  walkDist: number;
  lastBurnScreamMs: number;
}

export interface DevBootstrap {
  levelIndex: number;
  roundIndex: number;
  upgradePurchases?: Partial<Record<UpgradeKey, number>>;
  money?: number;
  skipIntro?: boolean;
}

export class GameScene extends Container implements MenuActionsHost {
  private static nextCivilianId = 1;

  private level!: LevelPack;
  private round!: RoundDef;
  private roundIndex = 0;
  private phase: Phase = 'playing';
  private session = new LevelSession();
  private sessionInitialized = false;

  private bgLayer = new Container();
  private cloudLayer = new CloudLayer();
  private weatherLayer = new WeatherLayer();
  private trailLayer = new Container();
  private nightVisionLayer = new NightVisionLayer();
  private entityLayer = new Container();
  private fxLayer = new Container();
  private groundLayer = new Container();
  private groundEntityLayer = new Container();
  private worldLayer = new Container();
  private uiLayer = new Container();
  private entities = new EntityController();
  private explosionManager = new ExplosionManager();
  private particleFx = new ParticleFxManager();
  private entityHpBars = new EntityHpBarOverlay();
  private killStreaks = new KillStreakManager();
  private players = new PlayerManager();

  private inputRef: InputSystem | null = null;
  private menuActionsKey = '';
  private menuSource: object | null = null;

  private playerRocketTex!: Texture;
  private humanBaseTex!: Tex;

  private civilians: Civilian[] = [];
  private introOverlay: Container | null = null;
  private gameHud: GameHud | null = null;
  private levelElapsedMs = 0;
  private shopOverlay: ShopOverlay | null = null;
  private buyMacroRunning = false;
  private roundElapsedMs = 0;
  private levelRocketsFired = 0;
  private roundRocketsFired = 0;
  private levelCivilianDeaths = 0;
  private storyLimits: StoryLimits = {};
  private joinPanel: JoinPanel | null = null;
  private bossHpBar: BossHpBar | null = null;
  private pauseOverlay: PauseOverlay | null = null;
  private settingsOverlay: SettingsOverlay | null = null;
  private touchControls: TouchControls | null = null;
  private touchFireActive = false;
  private pointerFireEdgeLeft = false;
  private pointerFireEdgeRight = false;
  private pauseBeforePhase: Phase = 'playing';
  private settingsUnsub: (() => void) | null = null;

  private airplaneSpawnQueue: AirplaneSpawn[] = [];
  private pendingAirplaneSpawns = 0;
  private airplaneSpawnGeneration = 0;
  private roundBootstrapping = false;
  private readonly rumbleFx: RumbleController;
  private rumbleTestStep = 0;
  private endScreenFx: {
    overlay: Container;
    label: BitmapText;
    age: number;
    onDone: () => void;
  } | null = null;
  private campaignLevelIndex = 0;
  private pendingEndScreenTitle: string | null = null;
  private levelAudio!: LevelAudio;

  private replayRecorder: ReplayRecorder | null = null;
  private replayDriver: ReplayDriver | null = null;
  private replayScoreId: number | null = null;
  private replayOverlay: ReplayOverlay | null = null;
  private replaySeeking = false;
  private replaySeekReady = false;
  private replaySeekTargetTick = 0;
  private replaySeekInitial = false;
  private seekBatchInFlight = false;
  private seekGeneration = 0;
  private seekCompleteResolvers: Array<() => void> = [];
  private static readonly SEEK_TICKS_PER_FRAME = 1800;
  private replayShopBusy = false;
  private onReplayFinished?: (blob: Uint8Array) => void;

  /** Return to campaign map (pause / level complete). */
  onReturnToCampaign?: () => void;
  /** Level beaten — persist unlock before the end-screen animation. */
  onLevelWon?: (stats: LevelWonStats) => void;
  /** Level finished — back to campaign map after the end-screen animation. */
  onLevelComplete?: () => void;
  /** Fired when a round/stage begins (for dev URL sync). */
  onRoundStarted?: (state: DevGameState) => void;

  isReplayMode(): boolean {
    return this.replayDriver !== null;
  }

  isReplaySeeking(): boolean {
    return this.replaySeeking;
  }

  isReplayInShop(): boolean {
    return this.replayDriver !== null && this.phase === 'shop';
  }

  getReplayDriver(): ReplayDriver | null {
    return this.replayDriver;
  }

  /** Restart from tick 0 and keep playing when a replay run finishes. */
  loopReplayIfAtEnd(): boolean {
    if (!this.replayDriver || !this.replayDriver.isPlaying() || !this.replayDriver.isAtEnd()) {
      return false;
    }
    if (this.replaySeeking) return false;
    void this.prepareSeekReplay(0, true);
    return true;
  }

  handleReplayKey(key: string, code: string): boolean {
    return this.replayOverlay?.handleKey(key, code) ?? false;
  }

  beginRecording(header: Omit<ReplayHeader, 'formatVersion' | 'simHz' | 'rngSeed'> & { rngSeed?: number }): void {
    const seed = header.rngSeed ?? newReplaySeed();
    resetSimRng(seed);
    this.replayRecorder = new ReplayRecorder({
      formatVersion: 1,
      gameVersion: header.gameVersion,
      levelHash: header.levelHash,
      boardId: header.boardId,
      rngSeed: seed,
      simHz: 60,
    });
    this.replayDriver = null;
  }

  onReplayEncoded(cb: (blob: Uint8Array) => void): void {
    this.onReplayFinished = cb;
  }

  async beginReplay(
    replay: DecodedReplay,
    nick: string,
    onExit: () => void,
    scoreId: number,
    initialPlayback?: { speed: number; playing: boolean },
  ): Promise<void> {
    this.replayDriver = new ReplayDriver(replay);
    this.replayScoreId = scoreId;
    this.replayRecorder = null;
    resetSimRng(replay.header.rngSeed);
    this.replayOverlay = new ReplayOverlay(this.replayDriver, scoreId, nick, onExit);
    this.replayOverlay.zIndex = 10_000;
    this.uiLayer.sortableChildren = true;
    this.uiLayer.addChild(this.replayOverlay);
    void this.prepareSeekReplay(0, initialPlayback?.playing !== false);
    await this.whenSeekComplete();
    if (this.replayDriver) {
      if (initialPlayback?.speed !== undefined) {
        this.replayDriver.setSpeed(initialPlayback.speed);
      }
      if (initialPlayback?.playing !== undefined) {
        this.replayDriver.setPlaying(initialPlayback.playing);
      }
      this.replayOverlay.refresh();
      this.syncReplayDeepLink();
    }
  }

  private syncReplayDeepLink(): void {
    if (this.replayDriver && this.replayScoreId !== null) {
      syncReplayPlaybackUrl(this.replayScoreId, this.replayDriver);
    }
  }

  private whenSeekComplete(): Promise<void> {
    if (!this.replaySeeking) return Promise.resolve();
    return new Promise((resolve) => this.seekCompleteResolvers.push(resolve));
  }

  private handleReplaySeekRequest(tick: number): void {
    if (!this.replayDriver) return;
    if (tick === this.replayDriver.getGlobalTick() && !this.replaySeeking) {
      this.replayDriver.setPlaying(this.replayDriver.wasPlayingBeforeSeek());
      return;
    }
    void this.prepareSeekReplay(tick);
  }

  private renderSeekFrame(dt: number, input: InputSystem): void {
    this.explosionManager.update(dt);
    this.particleFx.update(dt, this.particleBuckets(), { rain: this.round.weather[0] ?? 0 });
    this.killStreaks.tick(dt);
    this.bossHpBar?.refresh();
    this.entityHpBars.update(
      dt,
      this.entities.living(),
      this.civilians,
      input.aimPoints(this.players),
    );
    this.updateRumble(dt);
    this.cloudLayer.update(dt);
    this.weatherLayer.update(dt);
    this.nightVisionLayer.update(
      this.round.weather[4] ?? 0,
      input.aimPoints(this.players).map(({ x, y }) => ({ x, y })),
    );
    this.updateHud();
  }

  private async prepareSeekReplay(tick: number, initial = false): Promise<void> {
    if (!this.replayDriver || !this.level) return;
    const gen = ++this.seekGeneration;
    this.replaySeeking = true;
    this.replaySeekReady = false;
    this.replaySeekTargetTick = tick;
    this.replaySeekInitial = initial;
    this.seekBatchInFlight = false;
    this.replayDriver.resetPosition();
    this.replayDriver.syncPosition(0);

    this.sessionInitialized = false;
    CombatEntity.resetIdCounter();
    GameScene.nextCivilianId = 1;
    resetSimRng(this.replayDriver.replay.header.rngSeed);

    if (this.inputRef) this.releaseTouchFire(this.inputRef);
    this.closePause();
    this.closeShop();
    if (this.endScreenFx) {
      this.endScreenFx.overlay.destroy({ children: true });
      this.endScreenFx = null;
    }

    this.session.initFromLevel(this.level);
    this.clearAllCivilians();
    this.levelElapsedMs = 0;
    this.levelRocketsFired = 0;
    this.levelCivilianDeaths = 0;
    this.roundRocketsFired = 0;

    await this.spawnCivilians(this.level.config.startHumans);
    await this.startRound(0, true);
    if (gen !== this.seekGeneration) return;

    this.replayDriver.onRoundShopStarted(0);
    this.replaySeekReady = true;
    if (this.replayDriver.getGlobalTick() >= this.replaySeekTargetTick) {
      this.finishSeekReplay();
    }
  }

  private finishSeekReplay(): void {
    if (!this.replayDriver) return;
    this.replayDriver.syncPosition(this.replayDriver.getGlobalTick());
    this.replaySeeking = false;
    this.replaySeekReady = false;
    this.seekBatchInFlight = false;
    if (this.replaySeekInitial) {
      this.replayDriver.setPlaying(true);
      this.replaySeekInitial = false;
    } else {
      this.replayDriver.setPlaying(false);
    }
    this.replayOverlay?.refresh({ seeking: this.replaySeeking });
    this.syncReplayDeepLink();
    for (const resolve of this.seekCompleteResolvers) resolve();
    this.seekCompleteResolvers = [];
  }

  private async runSeekBatch(): Promise<void> {
    if (!this.replaySeeking || !this.replaySeekReady || !this.replayDriver || this.seekBatchInFlight) return;
    this.seekBatchInFlight = true;
    const target = this.replaySeekTargetTick;
    const gen = this.seekGeneration;
    try {
      let steps = 0;
      let stagnant = 0;
      let lastTick = this.replayDriver.getGlobalTick();
      while (
        steps < GameScene.SEEK_TICKS_PER_FRAME &&
        this.replayDriver.getGlobalTick() < target
      ) {
        await this.replaySimStep(false);
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        steps++;
        const now = this.replayDriver.getGlobalTick();
        if (now === lastTick) {
          stagnant++;
          if (stagnant >= 8) {
            await this.unstickReplaySeek();
            stagnant = 0;
          }
        } else {
          stagnant = 0;
          lastTick = now;
        }
        if (this.phase === 'levelComplete' || this.phase === 'gameOver') break;
        if (this.replaySeekTargetTick !== target || this.seekGeneration !== gen) return;
      }
      if (
        this.replayDriver.getGlobalTick() >= target ||
        this.phase === 'levelComplete' ||
        this.phase === 'gameOver'
      ) {
        this.finishSeekReplay();
      }
    } finally {
      this.seekBatchInFlight = false;
    }
  }

  private async unstickReplaySeek(): Promise<void> {
    if (!this.replayDriver) return;
    if (this.phase === 'shop') {
      if (this.replayDriver.peekShopEvent()) {
        await this.processReplayShopAsync();
      } else {
        const hasMore = this.roundIndex + 1 < this.level.rounds.length;
        await this.continueFromShop(hasMore);
      }
      return;
    }
    if (this.phase !== 'playing') {
      this.finishSeekReplay();
    }
  }

  setEndScreenTitle(title: string): void {
    this.pendingEndScreenTitle = title;
  }

  constructor() {
    super();
    this.label = 'GameScene';
    this.worldLayer.label = 'worldLayer';
    this.uiLayer.label = 'uiLayer';
    this.bgLayer.label = 'bgLayer';
    this.weatherLayer.label = 'weatherLayer';
    this.trailLayer.label = 'trailLayer';
    this.entityLayer.label = 'entityLayer';
    this.fxLayer.label = 'fxLayer';
    this.groundLayer.label = 'groundLayer';
    this.groundEntityLayer.label = 'groundEntityLayer';
    this.nightVisionLayer.label = 'nightVisionLayer';
    this.cloudLayer.backLayer.label = 'cloudBackLayer';
    this.cloudLayer.frontLayer.label = 'cloudFrontLayer';
    this.groundLayer.eventMode = 'none';
    this.groundEntityLayer.eventMode = 'none';
    this.worldLayer.addChild(
      this.bgLayer,
      this.cloudLayer.backLayer,
      this.weatherLayer,
      this.trailLayer,
      this.entityLayer,
      this.fxLayer,
      this.cloudLayer.frontLayer,
      this.groundLayer,
      this.groundEntityLayer,
      this.nightVisionLayer,
    );
    this.addChild(this.worldLayer, this.uiLayer);
    this.rumbleFx = new RumbleController(this.worldLayer);
    this.fxLayer.addChild(this.entityHpBars);
    this.entities.attachHomingLines(this.entityLayer);
    void Promise.all([
      this.explosionManager.load(),
      this.particleFx.load(),
      loadCollisionShapes(),
    ]).then(() => {
      this.explosionManager.attach(this.fxLayer);
      this.particleFx.attach(this.trailLayer, this.fxLayer);
      this.applySettingsEffects();
    });
    this.settingsUnsub = settingsStore.subscribe(() => this.applySettingsEffects());
  }

  destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.settingsUnsub?.();
    this.settingsUnsub = null;
    super.destroy(options);
  }

  private applySettingsEffects(): void {
    const quality = effectQualityForGraphics(settingsStore.get().graphicsQuality);
    const weather = weatherQualityForGraphics(settingsStore.get().graphicsQuality);
    this.explosionManager.setEffectQuality(quality);
    this.particleFx.setEffectQuality(quality);
    this.weatherLayer.setEffectQuality(weather);
    this.cloudLayer.setEffectQuality(weather);
  }

  async loadLevel(pack: LevelPack, roundIndex = 0, devBootstrap?: DevBootstrap): Promise<void> {
    this.level = pack;
    if (devBootstrap) this.campaignLevelIndex = devBootstrap.levelIndex;

    if (!this.sessionInitialized) {
      if (!this.replayDriver && !this.replayRecorder) {
        resetSimRng(newReplaySeed());
      }
      CombatEntity.resetIdCounter();
      GameScene.nextCivilianId = 1;
      this.session.initFromLevel(pack);
      if (devBootstrap?.money != null) this.session.money = devBootstrap.money;
      this.sessionInitialized = true;
    }

    this.clearCombat();
    this.levelElapsedMs = 0;
    this.levelRocketsFired = 0;
    this.levelCivilianDeaths = 0;
    this.playerRocketTex = await loadTexture(this.level.bombs.BOMB_PLAYER!.image);
    this.humanBaseTex = await loadTexture(pack.config.assets.human ?? 'assets/campaign/aw/human.png');

    if (this.civilians.length === 0) {
      await this.spawnCivilians(pack.config.startHumans);
      if (devBootstrap?.upgradePurchases && Object.keys(devBootstrap.upgradePurchases).length > 0) {
        const extraHumans = this.session.applyDevPurchases(devBootstrap.upgradePurchases, pack);
        for (let i = 0; i < extraHumans; i++) {
          await this.spawnOneCivilian(
            CIVILIAN_MIN_X + simRng().nextFloat(0, CIVILIAN_MAX_X - CIVILIAN_MIN_X),
          );
        }
        this.syncCombatStats();
        this.refreshCivilianHp();
      }
    }

    await this.setupPlayers(pack);
    if (this.gameHud) this.gameHud.destroy({ children: true });
    this.gameHud = new GameHud(this.playerRocketTex);
    this.uiLayer.addChild(this.gameHud);
    this.syncHudVisibility();
    this.updateHud();
    this.levelAudio = createLevelAudio();
    const startRoundIndex = devBootstrap?.roundIndex ?? roundIndex;
    const skipIntro = devBootstrap?.skipIntro ?? this.replayDriver !== null;
    await this.startRound(startRoundIndex, skipIntro);
  }

  private async startRound(roundIndex: number, skipIntro = false): Promise<void> {
    const round = this.level.rounds[roundIndex];
    if (!round) throw new Error(`Round ${roundIndex} missing in ${this.level.meta.name}`);

    this.roundBootstrapping = true;
    try {
      this.roundIndex = roundIndex;
      this.round = round;
      this.phase = 'playing';
      this.wonRound = false;
      this.roundElapsedMs = 0;
      this.roundRocketsFired = 0;
      this.storyLimits = resolveStoryLimits(this.level, roundIndex);
      this.rumbleFx.reset();
      this.clearCombat();
      this.closeShop();
      this.syncCombatStats();
      this.refreshCivilianHp();
      for (const s of this.players.active()) s.stats.reset();
      this.killStreaks.resetAll();
      await preloadRound(this.level, roundIndex);
      await this.buildBackground();
      this.applyRoundAudio();
      this.applyRoundWeather();
      await this.spawnAirplanes();
      if (roundIndex > 0) this.levelAudio.playNewRound();
      if (skipIntro) {
        if (this.introOverlay) {
          this.introOverlay.destroy({ children: true });
          this.introOverlay = null;
        }
      } else {
        void this.showIntro();
      }
      this.updateHud();
      this.notifyRoundStarted();
    } finally {
      this.roundBootstrapping = false;
    }
  }

  private notifyRoundStarted(): void {
    if (!DEV_DEEP_LINK_ENABLED) return;
    this.onRoundStarted?.({
      levelIndex: this.campaignLevelIndex,
      roundIndex: this.roundIndex,
      upgrades: this.session.purchaseSnapshot(),
      money: this.session.money,
    });
  }

  private applyRoundWeather(): void {
    this.applySettingsEffects();
    this.cloudLayer.setWeather(this.round.weather);
    this.weatherLayer.setWeather(this.round.weather);
  }

  private applyRoundAudio(): void {
    const { sounds, musicVolume } = resolveRoundAudio(this.level, this.roundIndex);
    this.levelAudio.applyRound(sounds, musicVolume);
  }

  private wonRound = false;

  private clearCombat(): void {
    this.entities.clear();
    this.explosionManager.clear();
    this.particleFx.clear();
    this.entityHpBars.clear();
    this.bossHpBar?.clear();
    for (const s of this.players.slots) s.rocketsInFlight = 0;
    this.airplaneSpawnQueue = [];
    this.airplaneSpawnGeneration += 1;
    this.pendingAirplaneSpawns = 0;
    if (this.introOverlay) {
      this.introOverlay.destroy({ children: true });
      this.introOverlay = null;
    }
  }

  private syncCombatStats(): void {
    this.players.redistributeCaps(this.session.maxTeamRockets);
  }

  private entityCallbacks() {
    return {
      onEntityDeath: (entity: CombatEntity, opts?: { skipExplosion?: boolean }) =>
        this.handleEntityDeath(entity, opts),
      onGroundExplosion: (
        x: number,
        y: number,
        range: number,
        damage: number,
        explosionType: number,
        rumble: 'plane' | 'explosion' | 'none',
        hurtsCivilians = true,
        lifetime = 20,
      ) =>
        this.handleGroundExplosion(
          x,
          y,
          range,
          damage,
          explosionType,
          rumble,
          hurtsCivilians,
          lifetime,
        ),
      onDropBomb: (
        _parent: CombatEntity,
        bombDef: BombDef,
        x: number,
        y: number,
        velocity?: { vx: number; vy: number },
      ) => {
        void this.entities.spawnFallingBomb(
          bombDef,
          x,
          y,
          (p) => this.tex(p),
          this.entityLayer,
          0,
          velocity,
        );
      },
      onSkyBomb: (bombDef: BombDef, x: number) => {
        void this.entities.spawnFallingBomb(bombDef, x, -40, (p) => this.tex(p), this.entityLayer);
      },
      onSpawnChildAirplane: (typeName: string, x: number, y: number) => {
        void this.spawnChildAirplane(typeName, x, y);
      },
      onProjectileRemoved: (ownerSlot: number) => {
        const ps = this.players.slot(ownerSlot);
        if (ps) ps.rocketsInFlight = Math.max(0, ps.rocketsInFlight - 1);
      },
      onProjectileHit: (
        ownerSlot: number,
        target: CombatEntity,
        damage: number,
        killed: boolean,
        guided: boolean,
        hitX: number,
        hitY: number,
        rocketDef: BombDef,
      ) => {
        this.entityHpBars.notifyHit(target);
        const rocketType = rocketDef.explosion.type ?? 1;
        const rocketRadius = bombExplosionRadius(rocketDef);
        const planeWillBurst = killed && target.traits.countsForRoundWin;
        this.spawnExplosionAt(hitX, hitY, rocketType, rocketRadius, 'none', !planeWillBurst);
        this.particleFx.spawnImpact(hitX, hitY, { guided, killed });
        if (!killed && target.traits.countsForRoundWin) {
          this.particleFx.spawnAirplaneHitDebris(hitX, hitY);
          if (target.airplaneDef?.scream) {
            this.levelAudio.playNamed(target.airplaneDef.scream, 0.65);
          }
        }
        const ps = this.players.slot(ownerSlot);
        if (!ps) return;
        ps.stats.hits += 1;
        ps.stats.damageDealt += damage;
        if (!killed) return;
        if (target.traits.countsForRoundWin) {
          ps.stats.kills += 1;
          if (guided) ps.stats.lockOnKills += 1;
          const streak = this.killStreaks.registerKill(ownerSlot);
          if (streak) playKillStreakSound(sfxPath(streak.sound));
        } else if (target.motion.kind === 'fall') {
          ps.stats.bombsDestroyed += 1;
        }
      },
      onBombHitsCivilian: (bomb: CombatEntity, civilianId: number, hitX: number, hitY: number) => {
        const def = bomb.bombDef;
        if (!def) return;
        const civilian = this.civilians.find((c) => c.id === civilianId);
        if (!civilian?.alive) return;
        this.applyCivilianDamage(civilian, def.damage, {
          hitFrom: { x: hitX, y: hitY },
          feeder: def.feeder,
          explosionType: def.explosion.type,
        });
        if (def.feeder && def.feeder > 0) {
          this.applyFeederKnockback(civilian, hitX, def.feeder);
        }
      },
    };
  }

  private spawnExplosionAt(
    x: number,
    y: number,
    type: number,
    radius: number,
    rumble: 'plane' | 'explosion' | 'none' = 'none',
    playAudio = true,
    fxOpts?: { lifetime?: number; power?: number },
  ): void {
    this.explosionManager.spawn(x, y, type, radius);
    this.particleFx.spawnExplosion(x, y, type, radius, fxOpts);
    if (playAudio) this.levelAudio.playExplosion(type);
    if (rumble === 'plane') this.triggerRumble(true, explosionRadiusToIntensity(radius));
    else if (rumble === 'explosion') this.triggerRumble(false, explosionRadiusToIntensity(radius));
  }

  private handleEntityDeath(entity: CombatEntity, opts?: { skipExplosion?: boolean }): void {
    if (entity.traits.countsForRoundWin) {
      const deathVoice = entity.airplaneDef?.lastScream ?? entity.airplaneDef?.scream;
      if (deathVoice) this.levelAudio.playNamed(deathVoice, 0.75);
    }
    if (!opts?.skipExplosion) {
      const expType = entity.traits.countsForRoundWin
        ? planeExplosionType(entity)
        : entity.bombDef?.explosion.type ?? 1;
      const radius = entity.traits.countsForRoundWin
        ? planeExplosionRadius(entity)
        : bombExplosionRadius(entity.bombDef);
      const rumble = entity.traits.deathRumble;
      const fxOpts =
        expType === 4 && entity.bombDef
          ? {
              lifetime: entity.bombDef.explosion.lifetime,
              power: entity.bombDef.explosion.power,
            }
          : undefined;
      this.spawnExplosionAt(entity.x, entity.y, expType, radius, rumble, true, fxOpts);
    }

    for (const p of this.players.active()) {
      if (p.lockTarget === entity) {
        p.lockTarget = null;
        p.lockProgressMs = 0;
        p.setCrosshairLockVisual(false, false, this.session.aimTimeMs);
      }
    }
    if (entity.traits.countsForRoundWin) this.trySpawnQueuedAirplane();
  }

  private handleGroundExplosion(
    x: number,
    y: number,
    range: number,
    damage: number,
    explosionType: number,
    rumble: 'plane' | 'explosion' | 'none',
    hurtsCivilians = true,
    lifetime = 20,
  ): void {
    if (hurtsCivilians) {
      this.damageCiviliansAt(x, GROUND_FEET_Y, range, damage, explosionType);
    }
    this.spawnExplosionAt(x, y, explosionType, range, rumble, true, {
      lifetime,
      power: damage,
    });
  }

  private async spawnChildAirplane(typeName: string, x: number, y: number): Promise<void> {
    const def = this.level.airplanes[typeName];
    if (!def) return;
    await this.entities.spawnAirplane(typeName, def, x, y, -1, false, (p) => this.tex(p), this.entityLayer);
  }

  private spawnAirplaneAt(
    type: string,
    x: number,
    y: number,
    spawnIndex: number,
  ): Promise<void> {
    const def = this.level.airplanes[type];
    if (!def) return Promise.resolve();
    const isBoss = spawnIndex === this.round.endmaster;
    const generation = this.airplaneSpawnGeneration;
    this.pendingAirplaneSpawns += 1;
    return this.entities
      .spawnAirplane(type, def, x, y, spawnIndex, isBoss, (p) => this.tex(p), this.entityLayer)
      .then((entity) => {
        if (generation !== this.airplaneSpawnGeneration) return;
        if (isBoss) {
          if (!this.bossHpBar) {
            this.bossHpBar = new BossHpBar();
            this.uiLayer.addChild(this.bossHpBar);
          }
          this.bossHpBar.track(entity);
        }
      })
      .finally(() => {
        if (generation === this.airplaneSpawnGeneration) {
          this.pendingAirplaneSpawns = Math.max(0, this.pendingAirplaneSpawns - 1);
        }
      });
  }

  private async tex(path: string) {
    return loadTexture(path);
  }

  private humanFrame(col = 0, row = 1): Texture {
    const frame = new Rectangle(
      col * HUMAN_FRAME_W,
      row * HUMAN_FRAME_H,
      HUMAN_FRAME_W,
      HUMAN_FRAME_H,
    );
    return new Texture({
      source: this.humanBaseTex.source,
      frame,
      orig: frame,
    });
  }

  private placeHuman(sprite: Sprite, x: number, dir: 1 | -1, frameCol = 0): void {
    const col = ((frameCol % HUMAN_FRAME_COLS) + HUMAN_FRAME_COLS) % HUMAN_FRAME_COLS;
    const row = dir > 0 ? HUMAN_ROW_WALK_RIGHT : HUMAN_ROW_WALK_LEFT;
    sprite.texture = this.humanFrame(col, row);
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(HUMAN_SCALE, HUMAN_SCALE);
    sprite.position.set(x, GROUND_FEET_Y);
  }

  private async buildBackground(): Promise<void> {
    const { background, ground: groundPath } = resolveRoundVisuals(this.level, this.roundIndex);

    this.bgLayer.removeChildren();
    const bgTex = await loadTexture(background);
    const bg = new Sprite(bgTex);
    bg.width = DESIGN.width;
    bg.height = DESIGN.height;
    this.bgLayer.addChild(bg);

    this.groundLayer.removeChildren();
    const groundTex = await loadTexture(groundPath);
    const ground = new Sprite(groundTex);
    ground.width = DESIGN.width;
    ground.height = DESIGN.groundHeight;
    ground.y = DESIGN.groundY;
    this.groundLayer.addChild(ground);
  }

  private async setupPlayers(pack: LevelPack): Promise<void> {
    const crosshairTex = await this.tex(pack.config.assets.crosshair ?? 'assets/gfx/crosshair1.png');
    const towerTex = await this.tex(pack.config.assets.tower!);
    const cannonTex = await this.tex(pack.config.assets.cannon!);
    const pivot = V1_SPRITES.cannonPivot;
    const footY = GROUND_FEET_Y;

    for (const slot of this.players.slots) {
      const p = `p${slot.index + 1}`;
      slot.crosshair.label = `${p}:crosshair`;
      slot.leftBase.label = `${p}:towerL`;
      slot.rightBase.label = `${p}:towerR`;
      slot.leftCannon.label = `${p}:cannonL`;
      slot.rightCannon.label = `${p}:cannonR`;
      slot.crosshair.texture = crosshairTex;
      slot.crosshair.anchor.set(0.5);
      slot.crosshair.tint = slot.color();
      if (!slot.crosshair.parent) this.uiLayer.addChild(slot.crosshair);

      slot.leftBase.texture = towerTex;
      slot.rightBase.texture = towerTex;
      slot.leftCannon.texture = cannonTex;
      slot.rightCannon.texture = cannonTex;

      for (const s of [slot.leftBase, slot.rightBase]) {
        s.anchor.set(0.5, 1);
        if (!s.parent) this.groundEntityLayer.addChild(s);
      }
      slot.leftBase.scale.set(1, 1);
      slot.rightBase.scale.set(-1, 1);

      for (const s of [slot.leftCannon, slot.rightCannon]) {
        s.anchor.set(pivot.x, pivot.y);
        if (!s.parent) this.groundEntityLayer.addChild(s);
      }
      slot.leftCannon.scale.set(1, 1);
      slot.rightCannon.scale.set(-1, 1);

      const pos = towerXForSlot(slot.index);
      slot.leftBase.position.set(pos.left, footY);
      slot.rightBase.position.set(pos.right, footY);
      const towerCenterY = footY - slot.leftBase.height / 2;
      slot.leftCannon.position.set(pos.left, towerCenterY);
      slot.rightCannon.position.set(pos.right, towerCenterY);

      slot.crosshair.visible = slot.active;
      slot.setTurretsVisible(slot.active);
      slot.syncCrosshairPosition();
    }

    if (SHOW_JOIN_PANEL) {
      if (!this.joinPanel) {
        this.joinPanel = new JoinPanel(this.players, (i) => this.togglePlayerSlot(i));
        this.uiLayer.addChild(this.joinPanel);
      }
      this.joinPanel.refresh(this.players);
    }
  }

  private togglePlayerSlot(slotIndex: number): void {
    if (slotIndex === 0) return;
    const slot = this.players.slot(slotIndex);
    if (!slot) return;
    if (slot.active) {
      this.players.leave(slotIndex);
    } else {
      slot.active = true;
      slot.aimSource = 'gamepad';
      slot.gamepadIndex = -1;
      slot.crosshair.visible = true;
      slot.setTurretsVisible(true);
      slot.syncCrosshairPosition();
    }
    this.players.redistributeCaps(this.session.maxTeamRockets);
    this.joinPanel?.refresh(this.players);
  }

  private async spawnCivilians(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      const x =
        count === 1
          ? DESIGN.width / 2
          : CIVILIAN_MIN_X + ((CIVILIAN_MAX_X - CIVILIAN_MIN_X) * (i + 0.5)) / count;
      await this.spawnOneCivilian(x);
    }
  }

  private spawnCivilianAt(x: number, dir: 1 | -1 = simRng().next() < 0.5 ? -1 : 1): void {
    const sprite = new Sprite(Texture.EMPTY);
    this.placeHuman(sprite, x, dir);
    sprite.visible = true;
    this.groundEntityLayer.addChild(sprite);

    this.civilians.push({
      id: GameScene.nextCivilianId++,
      sprite,
      x,
      hp: this.session.humanHp,
      maxHp: this.session.humanHp,
      dir,
      alive: true,
      walkDist: 0,
      lastBurnScreamMs: 0,
    });
    sprite.label = `civilian#${this.civilians[this.civilians.length - 1]!.id}`;
  }

  private async spawnOneCivilian(x: number): Promise<void> {
    this.spawnCivilianAt(x);
  }

  private purgeDeadCivilians(): void {
    for (let i = this.civilians.length - 1; i >= 0; i--) {
      const c = this.civilians[i]!;
      if (c.alive) continue;
      c.sprite.destroy();
      this.civilians.splice(i, 1);
    }
  }

  private aliveCivilianCount(): number {
    return this.civilians.filter((c) => c.alive).length;
  }

  private ensureCheatCivilians(target = 7): void {
    this.purgeDeadCivilians();

    for (const c of this.civilians) {
      if (!c.alive) continue;
      c.sprite.visible = true;
      c.hp = c.maxHp;
    }

    const alive = this.aliveCivilianCount();
    for (let i = alive; i < target; i++) {
      const x = CIVILIAN_MIN_X + ((CIVILIAN_MAX_X - CIVILIAN_MIN_X) * (i + 0.5)) / target;
      const dir: 1 | -1 = i % 2 === 0 ? 1 : -1;
      this.spawnCivilianAt(x, dir);
    }
  }

  private refreshCivilianHp(): void {
    if (this.level.config.humanHpRefresh >= 1) {
      for (const c of this.civilians) {
        if (!c.alive) continue;
        c.maxHp = this.session.humanHp;
        c.hp = this.session.humanHp;
      }
    }
  }

  private async spawnAirplanes(): Promise<void> {
    const pending: AirplaneSpawn[] = [];
    for (const spawn of this.round.spawns) {
      if (spawn.kind !== 'airplane') continue;
      pending.push({ type: spawn.type, x: spawn.x, y: spawn.y });
    }

    const max = this.round.maxAirplanes;
    if (max <= 0) {
      this.airplaneSpawnQueue = [];
      await Promise.all(pending.map((s, i) => this.spawnAirplaneAt(s.type, s.x, s.y, i)));
      return;
    }

    this.airplaneSpawnQueue = pending.slice(max);
    await Promise.all(pending.slice(0, max).map((s, i) => this.spawnAirplaneAt(s.type, s.x, s.y, i)));
  }

  private trySpawnQueuedAirplane(): void {
    const max = this.round.maxAirplanes;
    if (max <= 0 || this.airplaneSpawnQueue.length === 0) return;
    if (this.entities.roundWinTargetsAlive() >= max) return;

    const next = this.airplaneSpawnQueue.shift()!;
    const spawnIndex = this.round.spawns.findIndex(
      (s) => s.kind === 'airplane' && s.type === next.type && s.x === next.x && s.y === next.y,
    );
    void this.spawnAirplaneAt(next.type, next.x, next.y, spawnIndex >= 0 ? spawnIndex : max);
  }


  private async showIntro(): Promise<void> {
    const intro = this.round.intro;
    const text = intro?.text;
    const hasContent = Boolean(text || intro?.image || intro?.sound);
    if (!hasContent) return;

    const tutorial = this.level.id === 1;
    const onBackground = tutorial && !intro?.image;
    if (intro?.sound) playSound(sfxPath(intro.sound));

    const overlay = new Container();
    overlay.eventMode = 'none';

    const centerY = DESIGN.height / 2;

    if (text) {
      const label = kewlText({
        text: kewlString(text),
        size: onBackground ? 36 : 32,
        align: 'center',
        anchorX: 0.5,
        anchorY: 0.5,
      });
      const textY = intro?.image ? centerY - 100 : centerY;
      label.position.set(DESIGN.width / 2, textY);
      overlay.addChild(label);
    }

    if (intro?.image) {
      const tex = await loadTexture(intro.image);
      const img = new Sprite(tex);
      img.anchor.set(0.5);
      const maxW = 420;
      if (img.width > maxW) img.scale.set(maxW / img.width);
      const imgY = text ? centerY + 100 : centerY;
      img.position.set(DESIGN.width / 2, imgY);
      overlay.addChild(img);
    }

    (onBackground ? this.bgLayer : this.uiLayer).addChild(overlay);
    this.introOverlay = overlay;

    const ms = intro?.time ?? 3000;
    setTimeout(() => {
      if (this.introOverlay !== overlay) return;
      overlay.destroy({ children: true });
      this.introOverlay = null;
    }, ms);
  }

  handlePointerMove(input: InputSystem, clientX: number, clientY: number): void {
    if (this.phase !== 'playing') return;
    input.applyPointerMove(this.players, clientX, clientY);
  }

  handleTouchPointerDown(input: InputSystem, designX: number, designY: number): void {
    if (this.phase !== 'playing') return;
    if (this.touchControls?.isOnButton(designX, designY)) return;
    this.touchFireActive = true;
    input.applyTouchPointerMove(this.players, designX, designY);
    const fire = this.resolveTouchFireTower(this.pointerCrosshairX());
    if (fire.left) this.pointerFireEdgeLeft = true;
    if (fire.right) this.pointerFireEdgeRight = true;
    this.setPointerFire(input, fire.left, fire.right);
  }

  handleTouchPointerMove(input: InputSystem, designX: number, designY: number): void {
    if (this.phase !== 'playing') return;
    input.applyTouchPointerMove(this.players, designX, designY);
    if (!this.touchFireActive) return;
    this.syncTouchFire(input);
  }

  handleTouchPointerUp(input: InputSystem): void {
    this.touchFireActive = false;
    this.setPointerFire(input, false, false);
  }

  enableTouchControls(): void {
    if (this.touchControls) return;
    this.touchFireActive = false;
    this.touchControls = new TouchControls(() => this.togglePause());
    this.uiLayer.addChild(this.touchControls);
  }

  releaseTouchFire(input: InputSystem): void {
    this.touchFireActive = false;
    this.setPointerFire(input, false, false);
  }

  private pointerCrosshairX(): number {
    return this.players.slot(0)?.crosshairX ?? DESIGN.width / 2;
  }

  private resolveTouchFireTower(crosshairX: number): { left: boolean; right: boolean } {
    if (crosshairX < DESIGN.width / 2) return { left: true, right: false };
    return { left: false, right: true };
  }

  private syncTouchFire(input: InputSystem): void {
    const fire = this.resolveTouchFireTower(this.pointerCrosshairX());
    this.setPointerFire(input, fire.left, fire.right);
  }

  setPointerFire(input: InputSystem, left: boolean, right: boolean): void {
    input.setPointerFire(this.players, left, right);
  }

  /** One shot per mouse button press — not limited by autofire cooldown. */
  notifyPointerFireDown(left: boolean, right: boolean): void {
    if (left) this.pointerFireEdgeLeft = true;
    if (right) this.pointerFireEdgeRight = true;
  }

  getMenuActions(): UiAction[] {
    if (this.settingsOverlay) return this.settingsOverlay.getMenuActions();
    if (this.pauseOverlay) return this.pauseOverlay.menuActions;
    if (this.shopOverlay) return this.shopOverlay.menuActions;
    return [];
  }

  private syncMenuActions(menu: UiMenuController): void {
    const source = this.settingsOverlay ?? this.pauseOverlay ?? this.shopOverlay;
    const actions = this.getMenuActions();
    const key = actions.map((a) => a.id).join('|');
    if (source !== this.menuSource || key !== this.menuActionsKey) {
      this.menuSource = source;
      this.menuActionsKey = key;
      menu.setActions(actions);
    }
  }

  onMenuCancel(): void {
    if (this.settingsOverlay) {
      this.closeSettings();
      return;
    }
    if (this.phase === 'paused') {
      this.closePause();
      return;
    }
  }

  togglePause(): void {
    if (this.phase === 'gameOver' || this.phase === 'levelComplete') return;
    if (this.phase === 'paused') {
      this.closePause();
      return;
    }
    if (this.phase !== 'playing' && this.phase !== 'shop') return;

    this.pauseBeforePhase = this.phase;
    this.phase = 'paused';
    this.rumbleFx.reset();
    if (this.inputRef) this.releaseTouchFire(this.inputRef);
    if (this.pauseOverlay) return;

    this.pauseOverlay = new PauseOverlay(
      () => this.closePause(),
      () => this.openSettings(),
      () => void this.restartLevel(),
      () => {
        this.closePause();
        this.onReturnToCampaign?.();
      },
    );
    this.uiLayer.addChild(this.pauseOverlay);
    if (this.shopOverlay) this.shopOverlay.eventMode = 'none';
    this.menuSource = null;
    this.menuActionsKey = '';
  }

  private openSettings(): void {
    if (this.settingsOverlay) return;
    this.settingsOverlay = new SettingsOverlay(() => this.closeSettings());
    this.uiLayer.addChild(this.settingsOverlay);
    this.menuSource = null;
    this.menuActionsKey = '';
  }

  private closeSettings(): void {
    if (this.settingsOverlay) {
      this.settingsOverlay.destroy({ children: true });
      this.settingsOverlay = null;
      this.menuSource = null;
      this.menuActionsKey = '';
      if (this.phase === 'paused' && !this.pauseOverlay) {
        this.phase = this.pauseBeforePhase;
      }
    }
  }

  private clearAllCivilians(): void {
    for (const c of this.civilians) c.sprite.destroy();
    this.civilians = [];
  }

  private async restartLevel(): Promise<void> {
    if (this.roundBootstrapping || !this.level) return;

    if (this.inputRef) this.releaseTouchFire(this.inputRef);

    this.closePause();
    this.closeShop();
    if (this.endScreenFx) {
      this.endScreenFx.overlay.destroy({ children: true });
      this.endScreenFx = null;
    }

    this.session.initFromLevel(this.level);
    this.clearAllCivilians();
    await this.spawnCivilians(this.level.config.startHumans);
    this.levelElapsedMs = 0;

    await this.startRound(0);
  }

  private closePause(): void {
    this.closeSettings();
    if (this.pauseOverlay) {
      this.pauseOverlay.destroy({ children: true });
      this.pauseOverlay = null;
      this.menuSource = null;
      this.menuActionsKey = '';
    }
    if (this.shopOverlay && this.pauseBeforePhase === 'shop') {
      this.shopOverlay.eventMode = 'passive';
    }
    if (this.phase === 'paused') this.phase = this.pauseBeforePhase;
  }

  update(dt: number, input: InputSystem, menu: UiMenuController, opts?: { visuals?: boolean; fastForward?: boolean; replayIdle?: boolean }): void {
    const visuals = opts?.visuals !== false;
    const fastForward = opts?.fastForward === true;
    const replayIdle = opts?.replayIdle === true;
    this.inputRef = input;

    if (this.replayDriver && !fastForward) {
      const seek = this.replayDriver.consumeSeekTarget();
      if (seek !== null) {
        this.handleReplaySeekRequest(seek);
      }
    }

    if (this.replaySeeking && !fastForward) {
      if (visuals && this.replaySeekReady && !this.seekBatchInFlight) {
        void this.runSeekBatch();
      }
      if (visuals) {
        if (this.replaySeekReady && this.round) {
          this.renderSeekFrame(dt, input);
        }
        this.replayOverlay?.refresh({ seeking: true, fastForward: true });
      }
      this.syncHudVisibility();
      return;
    }

    if (replayIdle && !fastForward) {
      if (visuals) {
        if (this.round) this.renderSeekFrame(dt, input);
        this.replayOverlay?.refresh();
      }
      this.syncHudVisibility();
      return;
    }

    if (this.replayDriver && visuals) {
      this.replayOverlay?.refresh({ seeking: this.replaySeeking });
    }

    this.syncHudVisibility();

    if (this.endScreenFx) {
      if (visuals) this.tickEndScreenFx(dt);
      return;
    }

    if (this.phase === 'playing' || this.phase === 'shop') {
      this.levelElapsedMs += dt * 1000;
    }

    if (this.phase === 'playing') {
      this.roundElapsedMs += dt * 1000;
      this.checkStoryLimits();
    }

    const menuPhase =
      this.phase === 'shop' ||
      this.phase === 'paused' ||
      this.phase === 'gameOver' ||
      this.phase === 'levelComplete';
    input.setMode(menuPhase ? 'menu' : 'combat');

    if (!this.replayDriver && (this.phase === 'playing' || this.phase === 'paused') && input.pollPauseToggle()) {
      this.togglePause();
    }

    if (this.replayDriver && this.phase === 'shop') {
      if (!this.replayShopBusy) {
        this.processReplayShop();
      }
      if (visuals) {
        this.explosionManager.update(dt);
        this.particleFx.update(dt, this.particleBuckets(), { rain: this.round.weather[0] ?? 0 });
      }
      return;
    }

    if (menuPhase) {
      if (this.phase === 'shop') this.updateHud();
      if (!this.replayDriver && input.cancelPressed()) this.onMenuCancel();
      this.syncMenuActions(menu);
      if (!this.replayDriver) menu.update(input);
      this.releaseTouchFire(input);
      if (visuals) {
        this.explosionManager.update(dt);
        this.particleFx.update(dt, this.particleBuckets(), { rain: this.round.weather[0] ?? 0 });
      }
      return;
    }

    this.menuSource = null;
    this.menuActionsKey = '';

    if (this.phase === 'gameOver' || this.phase === 'levelComplete') {
      if (this.replayDriver && visuals) {
        this.renderSeekFrame(dt, input);
        this.replayOverlay?.refresh();
      }
      return;
    }

    beginCollisionFrame();

    if (visuals) {
      this.explosionManager.update(dt);
      this.particleFx.update(dt, this.particleBuckets(), { rain: this.round.weather[0] ?? 0 });
      this.killStreaks.tick(dt);
      this.bossHpBar?.refresh();
      this.entityHpBars.update(
        dt,
        this.entities.living(),
        this.civilians,
        input.aimPoints(this.players),
      );
      this.updateRumble(dt);
      this.cloudLayer.update(dt);
      this.weatherLayer.update(dt);
      this.nightVisionLayer.update(
        this.round.weather[4] ?? 0,
        input.aimPoints(this.players).map(({ x, y }) => ({ x, y })),
      );
    }

    if (this.replayDriver) {
      this.applyReplayCombatInput();
    } else {
      input.updateCombat(this.players, {
        onJoin: () => {
          this.players.redistributeCaps(this.session.maxTeamRockets);
          this.joinPanel?.refresh(this.players);
        },
        onLeave: () => {
          this.players.redistributeCaps(this.session.maxTeamRockets);
          this.joinPanel?.refresh(this.players);
        },
      });
    }

    this.joinPanel?.handleInput(input);
    input.setJoinPanelFocused(this.joinPanel?.hasFocus() ?? false);

    for (const player of this.players.active()) {
      player.autoFireCooldownLeft = Math.max(0, player.autoFireCooldownLeft - dt);
      player.autoFireCooldownRight = Math.max(0, player.autoFireCooldownRight - dt);
      this.updateAimLock(player, dt);
      this.updateTurretAim(player);
      const isPointer = player.aimSource === 'pointer';
      const clickLeft = isPointer && this.pointerFireEdgeLeft;
      const clickRight = isPointer && this.pointerFireEdgeRight;
      if (clickLeft) this.tryFireClick(player, player.leftCannon, 'left');
      if (clickRight) this.tryFireClick(player, player.rightCannon, 'right');
      if (player.fireLeft && !clickLeft) {
        this.tryFireAuto(player, player.leftCannon, 'left');
      }
      if (player.fireRight && !clickRight) {
        this.tryFireAuto(player, player.rightCannon, 'right');
      }
    }
    const recordedEdgeL = this.pointerFireEdgeLeft;
    const recordedEdgeR = this.pointerFireEdgeRight;
    this.pointerFireEdgeLeft = false;
    this.pointerFireEdgeRight = false;

    this.updateCivilians(dt);
    this.entities.update(
      dt,
      this.level,
      { loadTex: (p) => this.tex(p), layer: this.entityLayer },
      this.entityCallbacks(),
      this.civilians,
    );
    this.updateNapalmHazards();
    this.checkWinLoss();
    this.updateHud();

    if (this.replayRecorder && this.phase === 'playing') {
      this.replayRecorder.onCombatTick(this.players.active(), recordedEdgeL, recordedEdgeR);
    }

    if (
      this.replayDriver &&
      this.phase === 'playing' &&
      (this.replayDriver.isPlaying() || this.replaySeeking)
    ) {
      this.replayDriver.advanceTick();
    }
  }

  private applyReplayCombatInput(): void {
    if (!this.replayDriver) return;
    const row = this.replayDriver.getCombatInput();
    if (!row) return;
    const active = this.players.active();
    for (let i = 0; i < active.length && i < row.length; i++) {
      const p = active[i]!;
      const s = row[i]!;
      p.setAim(s.aimX, s.aimY);
      p.setFire(s.fireLeft, s.fireRight);
      if (p.aimSource === 'pointer') {
        if (s.edgeLeft) this.pointerFireEdgeLeft = true;
        if (s.edgeRight) this.pointerFireEdgeRight = true;
      }
    }
  }

  private async replaySimStep(visuals: boolean): Promise<void> {
    if (!this.inputRef || !this.replayDriver) return;
    const menu = { update: () => {} } as unknown as UiMenuController;
    if (this.phase === 'shop') {
      await this.processReplayShopAsync();
      return;
    }
    if (this.phase !== 'playing') return;
    this.update(SIM_DT, this.inputRef, menu, { visuals, fastForward: true });
  }

  private processReplayShop(): void {
    if (!this.replayDriver || this.phase !== 'shop' || this.replayShopBusy) return;
    const ev = this.replayDriver.peekShopEvent();
    if (!ev) return;
    if (ev.kind === 'buy') {
      if (this.buyUpgrade(ev.key, false)) {
        this.replayDriver.consumeShopEvent();
      } else {
        this.replayDriver.consumeShopEvent();
      }
      return;
    }
    this.replayDriver.consumeShopEvent();
    const hasMore = this.roundIndex + 1 < this.level.rounds.length;
    this.replayDriver.onShopContinued();
    void this.continueFromShop(hasMore);
  }

  private async processReplayShopAsync(): Promise<void> {
    if (!this.replayDriver || this.phase !== 'shop' || this.replayShopBusy) return;
    const ev = this.replayDriver.peekShopEvent();
    if (!ev) return;
    if (ev.kind === 'buy') {
      if (this.buyUpgrade(ev.key, false)) {
        this.replayDriver.consumeShopEvent();
      } else {
        this.replayDriver.consumeShopEvent();
      }
      return;
    }
    this.replayDriver.consumeShopEvent();
    const hasMore = this.roundIndex + 1 < this.level.rounds.length;
    this.replayDriver.onShopContinued();
    await this.continueFromShop(hasMore);
  }

  private updateCivilians(dt: number): void {
    for (const c of this.civilians) {
      if (!c.alive) continue;
      c.x += c.dir * CIVILIAN_WALK_SPEED * dt;
      if (c.x < CIVILIAN_MIN_X) {
        c.x = CIVILIAN_MIN_X;
        c.dir = 1;
      } else if (c.x > CIVILIAN_MAX_X) {
        c.x = CIVILIAN_MAX_X;
        c.dir = -1;
      }
      c.walkDist += CIVILIAN_WALK_SPEED * dt;
      const frameCol = Math.floor(c.walkDist / HUMAN_WALK_PX_PER_FRAME) % HUMAN_FRAME_COLS;
      this.placeHuman(c.sprite, c.x, c.dir, frameCol);
    }
  }

  private updateRumble(dt: number): void {
    this.rumbleFx.update(dt);
  }

  private triggerRumble(planeOnly = false, intensity = 0.5, force = false): void {
    this.rumbleFx.trigger(intensity, 0.2, {
      force,
      planeOnly,
      roundMode: this.round.rumble ?? 0,
    });
  }

  /** Cheat: cycle rumble intensity — bound to `*` / numpad multiply. */
  cheatTestRumble(): void {
    if (this.phase !== 'playing') return;
    const steps = [0.2, 0.4, 0.6, 0.8, 1] as const;
    const intensity = steps[this.rumbleTestStep % steps.length]!;
    this.rumbleTestStep += 1;
    this.rumbleFx.trigger(intensity, 0.35, { force: true });
    console.info(`[rumble test] intensity ${intensity} (screen + gamepad + vibrate)`);
  }

  private aimEnabled(): boolean {
    return !this.level.config.buttonsDisabled?.aim;
  }

  private updateAimLock(player: PlayerSlot, dt: number): void {
    if (!this.aimEnabled()) {
      player.lockProgressMs = 0;
      player.lockTarget = null;
      player.setCrosshairLockVisual(false, false, this.session.aimTimeMs);
      return;
    }

    const target = this.entities.findLockTargetAt(player.crosshairX, player.crosshairY);
    if (!target) {
      player.lockProgressMs = 0;
      player.lockTarget = null;
      player.setCrosshairLockVisual(false, false, this.session.aimTimeMs);
      return;
    }

    player.lockProgressMs += dt * 1000;
    const locked = player.lockProgressMs >= this.session.aimTimeMs;
    player.lockTarget = locked ? target : null;
    player.setCrosshairLockVisual(!locked, locked, this.session.aimTimeMs);
  }

  private isAimLocked(player: PlayerSlot): boolean {
    return this.aimEnabled() && player.lockTarget?.alive === true;
  }

  private guidedRocketDamage(): number {
    const aimPower = Math.min(this.level.config.aimPower, 10);
    const ratio = this.session.baseAimTimeMs / Math.max(1, this.session.aimTimeMs);
    return Math.round(
      this.session.rocketPower * aimPower * ratio * LOCK_ON_ROCKET_DAMAGE_FACTOR,
    );
  }

  private updateTurretAim(player: PlayerSlot): void {
    this.aimCannon(player.leftCannon, player.crosshairX, player.crosshairY);
    this.aimCannon(player.rightCannon, player.crosshairX, player.crosshairY);
  }

  private aimCannon(cannon: Sprite, tx: number, ty: number): void {
    let angle = Math.atan2(ty - cannon.y, tx - cannon.x);
    if (cannon.scale.x < 0) angle += Math.PI;
    cannon.rotation = angle;
  }

  private canFireRocket(): boolean {
    const max = this.storyLimits.maxRoundRockets;
    if (max !== undefined && max >= 0 && this.roundRocketsFired >= max) return false;
    const levelMax = this.storyLimits.maxRockets;
    if (levelMax !== undefined && levelMax >= 0 && this.levelRocketsFired >= levelMax) return false;
    return true;
  }

  private checkStoryLimits(): void {
    if (!hasActiveStoryLimits(this.storyLimits)) return;
    const limits = this.storyLimits;
    if (limits.maxRoundTime !== undefined && limits.maxRoundTime >= 0 && this.roundElapsedMs >= limits.maxRoundTime) {
      this.failStoryLimit('Time up');
      return;
    }
    if (limits.maxTime !== undefined && limits.maxTime >= 0 && this.levelElapsedMs >= limits.maxTime) {
      this.failStoryLimit('Time up');
      return;
    }
    if (limits.minMoney !== undefined && limits.minMoney >= 0 && this.session.money < limits.minMoney) {
      this.failStoryLimit('Out of money');
    }
  }

  private failStoryLimit(reason: string): void {
    if (this.phase !== 'playing') return;
    this.phase = 'gameOver';
    this.clearTransientGameUi();
    this.levelAudio.playGameOver();
    this.startEndScreenFx(reason, () => this.onReturnToCampaign?.());
  }

  private tryFireClick(player: PlayerSlot, cannon: Sprite, side: 'left' | 'right'): void {
    if (!this.canFireRocket()) return;
    if (player.rocketsInFlight >= player.rocketCap) return;
    this.spawnRocket(player, cannon);
    // Holding after the initial click should wait for the autofire interval, not fire again immediately.
    const stillHeld = side === 'left' ? player.fireLeft : player.fireRight;
    if (!stillHeld) return;
    const delay = this.touchControls
      ? PLAYER_TOUCH_AUTO_FIRE_COOLDOWN_S
      : PLAYER_AUTO_FIRE_COOLDOWN_S;
    if (side === 'left') player.autoFireCooldownLeft = delay;
    else player.autoFireCooldownRight = delay;
  }

  private tryFireAuto(player: PlayerSlot, cannon: Sprite, side: 'left' | 'right'): void {
    if (!this.canFireRocket()) return;
    const cooldown =
      side === 'left' ? player.autoFireCooldownLeft : player.autoFireCooldownRight;
    if (cooldown > 0) return;
    if (player.rocketsInFlight >= player.rocketCap) return;
    this.spawnRocket(player, cannon);
    const delay = this.touchControls
      ? PLAYER_TOUCH_AUTO_FIRE_COOLDOWN_S
      : PLAYER_AUTO_FIRE_COOLDOWN_S;
    if (side === 'left') player.autoFireCooldownLeft = delay;
    else player.autoFireCooldownRight = delay;
  }

  private rocketDamageDisplayScale(damage: number, baseDamage: number): number {
    if (damage <= baseDamage) return 1;
    const ratio = damage / baseDamage;
    return Math.min(PLAYER_ROCKET_DAMAGE_SCALE_MAX, 1 + (ratio - 1) * 0.5);
  }

  private spawnRocket(player: PlayerSlot, cannon: Sprite): void {
    const def = this.level.bombs.BOMB_PLAYER!;
    const locked = this.isAimLocked(player);
    const damage = locked ? this.guidedRocketDamage() : this.session.rocketPower;
    const displayScale =
      playerRocketIconScale(this.playerRocketTex)
      * this.rocketDamageDisplayScale(damage, this.level.config.startRocketPower);

    const sprite = new Sprite(this.playerRocketTex);
    sprite.anchor.set(0.5);
    sprite.scale.set(displayScale);
    const angle = Math.atan2(player.crosshairY - cannon.y, player.crosshairX - cannon.x);
    const muzzle = V1_SPRITES.cannonMuzzle;
    const sx = cannon.x + Math.cos(angle) * muzzle;
    const sy = cannon.y + Math.sin(angle) * muzzle;
    sprite.position.set(sx, sy);

    if (locked) sprite.tint = 0xff4444;

    const speed = this.session.rocketSpeed;
    this.entities.spawnPlayerProjectile(
      sprite,
      def,
      {
        x: sx,
        y: sy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        damage,
        ownerSlot: player.index,
        homingTarget: locked ? player.lockTarget : null,
        guidedShot: locked,
      },
      this.entityLayer,
    );
    this.particleFx.spawnMuzzleFlash(sx, sy, angle, locked);
    this.levelAudio.playShoot();
    player.stats.rocketsFired += 1;
    this.roundRocketsFired += 1;
    this.levelRocketsFired += 1;
    player.rocketsInFlight += 1;
  }

  private particleBuckets() {
    return {
      projectiles: this.entities.projectiles(),
      crashingPlanes: this.entities.crashingPlanes(),
      fallingBombs: this.entities.fallingBombs(),
      damagedAirplanes: this.entities.damagedAirplanes(),
    };
  }

  private updateNapalmHazards(): void {
    const targets = this.civilians.map((c) => ({
      id: c.id,
      alive: c.alive,
      sprite: c.sprite,
    }));

    for (const hit of this.particleFx.queryNapalmBurnHits(targets)) {
      const civilian = this.civilians.find((c) => c.id === hit.civilianId);
      if (!civilian?.alive) continue;
      this.applyCivilianDamage(civilian, hit.damage, {
        explosionType: 4,
        lingeringBurn: true,
        hitFrom: { x: hit.hitX, y: hit.hitY },
      });
    }
  }

  private applyFeederKnockback(c: Civilian, fromX: number, feeder: number): void {
    const push = feeder * 12;
    const dir = c.x >= fromX ? 1 : -1;
    c.x = Math.max(CIVILIAN_MIN_X, Math.min(CIVILIAN_MAX_X, c.x + dir * push));
    c.sprite.x = c.x;
  }

  private applyCivilianDamage(
    c: Civilian,
    damage: number,
    source?: CivilianDamageSource,
  ): void {
    if (!c.alive || damage <= 0) return;
    const wasAlive = c.hp > 0;
    c.hp -= damage;
    if (c.hp <= 0) {
      this.killCivilian(c, damage, source);
    } else if (wasAlive) {
      this.entityHpBars.notifyCivilianHit(c);
      const expType = source?.explosionType ?? 1;
      if (expType === 4 && source?.lingeringBurn) {
        if (this.roundElapsedMs - c.lastBurnScreamMs >= 800) {
          this.levelAudio.playCivilianHit(4);
          c.lastBurnScreamMs = this.roundElapsedMs;
        }
      } else {
        this.levelAudio.playCivilianHit(expType);
      }
      this.spawnCivilianBloodFx(c, damage, source, true);
    }
  }

  private damageCiviliansAt(
    x: number,
    y: number,
    radius: number,
    damage: number,
    explosionType = 0,
  ): void {
    const r2 = radius * radius;
    const source: CivilianDamageSource = {
      explosionType,
      explosionRange: radius,
      hitFrom: { x, y },
    };
    for (const c of this.civilians) {
      if (!c.alive) continue;
      const dx = c.x - x;
      const dy = (GROUND_FEET_Y - 20) - y;
      if (dx * dx + dy * dy > r2) continue;
      this.applyCivilianDamage(c, damage, source);
    }
  }

  private civilianBloodSpawnArea(c: Civilian) {
    const h = c.sprite.height;
    const w = c.sprite.width;
    return {
      cx: c.x,
      cy: GROUND_FEET_Y - h * 0.52,
      width: w * 0.94,
      height: h * 0.9,
    };
  }

  private spawnCivilianBloodFx(
    c: Civilian,
    damage: number,
    source?: CivilianDamageSource,
    wound = false,
  ): void {
    this.particleFx.spawnCivilianBlood(c.x, 0, {
      damage,
      bloody: this.level.config.bloody ?? 1,
      explosionType: source?.explosionType,
      explosionRange: source?.explosionRange,
      spawnArea: this.civilianBloodSpawnArea(c),
      hitFrom: source?.hitFrom,
      wound,
    });
  }

  private killCivilian(
    c: Civilian,
    killingDamage = 0,
    source?: CivilianDamageSource,
  ): void {
    c.alive = false;
    c.sprite.visible = false;
    this.spawnCivilianBloodFx(c, killingDamage, source);
    this.levelAudio.playCivilianDeath(source?.explosionType ?? 1);
    this.levelCivilianDeaths += 1;
    const maxDeaths = this.storyLimits.maxHumanDeaths;
    if (maxDeaths !== undefined && maxDeaths >= 0 && this.levelCivilianDeaths > maxDeaths) {
      this.failStoryLimit('Too many casualties');
      return;
    }
    this.session.resetHumanPrice();
    if (!this.civilians.some((h) => h.alive)) {
      this.phase = 'gameOver';
      this.clearTransientGameUi();
      this.levelAudio.playGameOver();
      this.startEndScreenFx('Game over', () => this.onReturnToCampaign?.());
    }
  }

  private hasMoreRounds(): boolean {
    return this.roundIndex + 1 < this.level.rounds.length;
  }

  private checkWinLoss(): void {
    if (this.wonRound || this.phase !== 'playing') return;
    if (this.roundBootstrapping || this.pendingAirplaneSpawns > 0) return;
    if (this.entities.roundWinTargetsAlive() === 0 && this.airplaneSpawnQueue.length === 0) {
      this.wonRound = true;
      const survivors = this.civilians.filter((c) => c.alive).length;
      this.session.payoutSurvivors(survivors, this.level.config.moneyFactor);
      if (this.hasMoreRounds()) {
        this.playRoundWinSound();
        this.openShop();
      } else {
        void this.finishLevel();
      }
    }
  }

  private playRoundWinSound(): void {
    this.levelAudio.playRoundWin(this.round.winSound);
  }

  private openShop(): void {
    const hasMoreRounds = this.hasMoreRounds();
    this.phase = 'shop';
    this.replayDriver?.onRoundShopStarted(this.roundIndex);
    this.rumbleFx.reset();
    this.clearCombat();
    this.clearTransientGameUi();
    this.closeShop();
    if (this.replayDriver) {
      return;
    }
    this.shopOverlay = new ShopOverlay(
      this.level,
      this.session,
      (key) => this.buyUpgrade(key),
      () => this.autoBuyUpgrades(),
      () => void this.continueFromShop(hasMoreRounds),
      (key) => this.canBuyShopUpgrade(key),
      this.roundIndex + 1,
      this.level.rounds.length,
      hasMoreRounds,
    );
    this.uiLayer.addChild(this.shopOverlay);
    this.updateHud();
  }

  private clearTransientGameUi(): void {
    if (this.introOverlay) {
      this.introOverlay.destroy({ children: true });
      this.introOverlay = null;
    }
  }

  private shopUpgradeKeys(): UpgradeKey[] {
    return UPGRADE_KEYS.filter((key) => !this.level.config.buttonsDisabled?.[key]);
  }

  private canBuyShopUpgrade(key: UpgradeKey): boolean {
    if (!this.level.config.upgrades[key]) return false;
    if (key === 'human' && this.civilians.filter((c) => c.alive).length >= this.level.config.maxHumans) {
      return false;
    }
    return this.session.money >= this.session.price(key);
  }

  private findCheapestBuyableUpgrade(): UpgradeKey | null {
    let cheapest: UpgradeKey | null = null;
    let cheapestPrice = Infinity;
    for (const key of this.shopUpgradeKeys()) {
      if (!this.canBuyShopUpgrade(key)) continue;
      const price = this.session.price(key);
      if (price < cheapestPrice) {
        cheapestPrice = price;
        cheapest = key;
      }
    }
    return cheapest;
  }

  private autoBuyUpgrades(): void {
    let purchased = false;
    while (true) {
      const key = this.findCheapestBuyableUpgrade();
      if (!key) break;
      if (this.buyUpgrade(key, false)) purchased = true;
    }
    if (purchased) {
      this.levelAudio.playPay();
      this.shopOverlay?.refresh(this.session);
    }
  }

  /** v1 buyscript.txt keys 1–9 — shop phase only. */
  runBuyMacro(digit: number): void {
    if (this.phase !== 'shop' || this.buyMacroRunning) return;
    const sequence = BUY_MACROS[digit];
    if (!sequence?.length) return;
    void this.executeBuyMacro(sequence);
  }

  private async executeBuyMacro(sequence: readonly UpgradeKey[]): Promise<void> {
    this.buyMacroRunning = true;
    try {
      let purchased = false;
      for (let i = 0; i < sequence.length; i++) {
        if (i > 0) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, BUY_MACRO_STEP_MS * i);
          });
        }
        if (this.phase !== 'shop') return;
        if (this.buyUpgrade(sequence[i]!, false)) purchased = true;
      }
      if (purchased) this.levelAudio.playPay();
    } finally {
      this.buyMacroRunning = false;
    }
  }

  private closeShop(): void {
    if (this.shopOverlay) {
      this.shopOverlay.destroy({ children: true });
      this.shopOverlay = null;
      this.menuSource = null;
      this.menuActionsKey = '';
    }
  }

  private buyUpgrade(key: UpgradeKey, playSound = true): boolean {
    if (key === 'human' && this.civilians.filter((c) => c.alive).length >= this.level.config.maxHumans) {
      if (playSound) this.levelAudio.playNoMoney();
      return false;
    }
    if (!this.session.tryBuy(key, this.level)) {
      if (playSound) this.levelAudio.playNoMoney();
      return false;
    }

    if (playSound) this.levelAudio.playPay();

    if (this.replayRecorder) this.replayRecorder.onShopBuy(key);

    if (key === 'human') {
      void this.spawnOneCivilian(
        CIVILIAN_MIN_X + simRng().nextFloat(0, CIVILIAN_MAX_X - CIVILIAN_MIN_X),
      );
    }

    this.syncCombatStats();
    this.refreshCivilianHp();
    this.shopOverlay?.refresh(this.session);
    this.updateHud();
    this.notifyRoundStarted();
    return true;
  }

  private async continueFromShop(hasMoreRounds: boolean): Promise<void> {
    if (this.replayShopBusy) return;
    this.replayShopBusy = true;
    try {
      if (this.replayRecorder) this.replayRecorder.onShopContinue();

      if (hasMoreRounds) {
        await this.startRound(this.roundIndex + 1, this.replayDriver !== null);
        return;
      }
      await this.finishLevel();
    } finally {
      this.replayShopBusy = false;
    }
  }

  private applyReplayFinalShopEvents(): void {
    if (!this.replayDriver) return;
    this.replayDriver.onRoundShopStarted(this.roundIndex);
    while (true) {
      const ev = this.replayDriver.peekShopEvent();
      if (!ev) break;
      if (ev.kind === 'buy') this.buyUpgrade(ev.key, false);
      this.replayDriver.consumeShopEvent();
    }
  }

  private async finishLevel(): Promise<void> {
    this.rumbleFx.reset();
    this.clearCombat();
    this.clearTransientGameUi();
    this.closeShop();
    this.applyReplayFinalShopEvents();

    const score = computeLevelScore(this.session.money);
    const timeMs = Math.max(0, Math.floor(this.levelElapsedMs));

    if (this.replayRecorder) {
      const blob = await this.replayRecorder.finish({ timeMs, score });
      this.onReplayFinished?.(blob);
    }

    if (this.replayDriver) {
      if (this.replayDriver.isPlaying()) {
        void this.prepareSeekReplay(0, true);
      } else {
        this.replayDriver.syncPosition(this.replayDriver.getTotalTicks());
        this.phase = 'levelComplete';
        this.replayOverlay?.refresh({ seeking: this.replaySeeking });
      }
      return;
    }

    this.onLevelWon?.({
      levelIndex: this.campaignLevelIndex,
      timeMs,
      score,
    });
    this.phase = 'levelComplete';
    this.levelAudio.playLevelWin();
    const title = this.pendingEndScreenTitle
      ?? (this.level.id === 1 ? 'Tutorial complete!' : 'Victory');
    this.pendingEndScreenTitle = null;
    this.startEndScreenFx(
      title,
      () => this.onLevelComplete?.(),
    );
  }

  private startEndScreenFx(title: string, onDone: () => void): void {
    const overlay = new Container();
    overlay.eventMode = 'none';

    const dim = new Graphics();
    dim.rect(0, 0, DESIGN.width, DESIGN.height).fill({ color: 0x000000, alpha: 0.45 });
    overlay.addChild(dim);

    const label = kewlText({
      text: kewlString(title),
      size: 40,
      align: 'center',
      anchorX: 0.5,
      anchorY: 0.5,
    });
    label.position.set(DESIGN.width / 2, DESIGN.height / 2);
    label.alpha = 0;
    label.scale.set(0.88);
    overlay.addChild(label);

    this.uiLayer.addChild(overlay);
    this.endScreenFx = { overlay, label, age: 0, onDone };
  }

  private tickEndScreenFx(dt: number): void {
    const fx = this.endScreenFx;
    if (!fx) return;

    fx.age += dt;
    const fadeIn = 0.25;
    const fadeOut = 0.4;
    const holdEnd = END_SCREEN_ANIM_S - fadeOut;

    if (fx.age < fadeIn) {
      const p = fx.age / fadeIn;
      fx.label.alpha = p;
      fx.label.scale.set(0.88 + 0.12 * p);
    } else if (fx.age >= holdEnd) {
      const p = Math.min(1, (fx.age - holdEnd) / fadeOut);
      fx.label.alpha = 1 - p;
      fx.label.scale.set(1 + p * 0.06);
    } else {
      fx.label.alpha = 1;
      fx.label.scale.set(1);
    }

    if (fx.age >= END_SCREEN_ANIM_S) {
      fx.overlay.destroy({ children: true });
      const done = fx.onDone;
      this.endScreenFx = null;
      done();
    }
  }

  private availableRockets(): number {
    return this.players.active().reduce(
      (sum, player) => sum + Math.max(0, player.rocketCap - player.rocketsInFlight),
      0,
    );
  }

  private syncHudVisibility(): void {
    if (!this.gameHud) return;
    const showHud =
      !this.replayDriver &&
      (this.phase === 'playing' || this.phase === 'shop' || this.phase === 'paused');
    this.gameHud.visible = showHud;

    const showCombatCrosshair = this.phase === 'playing' || this.phase === 'paused';
    for (const slot of this.players.slots) {
      slot.crosshair.visible = slot.active && showCombatCrosshair;
    }
  }

  private updateHud(): void {
    if (!this.round) return;
    this.joinPanel?.refresh(this.players);
    this.gameHud?.refresh(
      this.availableRockets(),
      this.session.money,
      this.levelElapsedMs / 1000,
      this.storyLimits,
      { roundRocketsFired: this.roundRocketsFired, roundElapsedMs: this.roundElapsedMs },
    );
  }

  isRoundComplete(): boolean {
    return this.phase === 'shop' || this.phase === 'levelComplete';
  }

  private cheatCivilianDamageTier = 0;

  private static readonly CHEAT_CIVILIAN_DAMAGE_TIERS = [
    { damage: 10, explosionType: 0, explosionRange: 0 },
    { damage: 50, explosionType: 0, explosionRange: 0 },
    { damage: 100, explosionType: 1, explosionRange: 40 },
    { damage: 250, explosionType: 1, explosionRange: 80 },
    { damage: 800, explosionType: 1, explosionRange: 120 },
    { damage: 2000, explosionType: 3, explosionRange: 160 },
    { damage: 5000, explosionType: 3, explosionRange: 200 },
  ] as const;

  isGameOver(): boolean {
    return this.phase === 'gameOver';
  }

  isLevelComplete(): boolean {
    return this.phase === 'levelComplete';
  }

  cheatKillVisibleEnemies(): void {
    if (this.phase !== 'playing') return;
    this.entities.killVisibleEnemies(
      this.level,
      { loadTex: (p) => this.tex(p), layer: this.entityLayer },
      this.entityCallbacks(),
    );
  }

  cheatKillCivilians(): void {
    if (this.phase !== 'playing') return;

    this.purgeDeadCivilians();
    if (this.aliveCivilianCount() < 7) {
      this.ensureCheatCivilians(7);
      return;
    }

    const tierIndex =
      this.cheatCivilianDamageTier % GameScene.CHEAT_CIVILIAN_DAMAGE_TIERS.length;
    const tier = GameScene.CHEAT_CIVILIAN_DAMAGE_TIERS[tierIndex]!;
    this.cheatCivilianDamageTier += 1;

    this.particleFx.clearBlood();

    let killed = 0;
    for (const c of this.civilians) {
      if (!c.alive) continue;
      c.alive = false;
      c.sprite.visible = false;
      const hitSide = killed % 2 === 0 ? 1 : -1;
      this.particleFx.spawnCivilianBlood(c.x, 0, {
        damage: tier.damage,
        explosionType: tier.explosionType,
        explosionRange: tier.explosionRange,
        intensityTier: tierIndex,
        spawnArea: this.civilianBloodSpawnArea(c),
        hitFrom: { x: c.x + hitSide * 140, y: GROUND_FEET_Y - c.sprite.height * 0.55 },
      });
      killed += 1;
    }

    if (killed > 0) {
      this.levelAudio.playCivilianDeath();
    }
  }
}
