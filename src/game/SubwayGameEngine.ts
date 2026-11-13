// Created by Md Shabbir Mia
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SubwayAudioEngine } from './audio';
import {
  buildStageEnvironment,
  buildWeaponViewmodels,
  buildZombieModel,
  DestructibleBinding,
  StationBuildResult,
  ViewmodelRig,
  ZombieRig,
} from './models';
import {
  DEFAULT_AIM_SETTINGS,
  STAGE_DURATION_SECONDS,
  WEAPON_ORDER,
  WEAPON_SPECS,
  applyDestructibleDamage,
  computeBlastFalloff,
  computeLookSensitivity,
  computeStageWave,
  createInitialWeapons,
  getEffectiveSpread,
  getRoundConfig,
  getTargetFov,
  pickArchetypeForRound,
  resolveCircleAabbCollisions,
  shouldSpawnTimedBoss,
  shouldUnlockSectorExit,
  stepHelicopterLanding,
  stepMovingTrain,
  stepMovingVehicle,
  stepPendulumHandle,
  stepWeaponTimers,
  tryFireWeapon,
  tryStartReload,
} from './rules';
import { createSubwayTextures, SubwayTextureBundle } from './textures';
import {
  AimSettings,
  CrosshairColor,
  GamePhase,
  HudSnapshot,
  KillFeedEntry,
  StageId,
  SurfaceMaterial,
  WeaponId,
  WeaponRuntimeState,
} from './types';

// Zero-GC module-scope math scratchpads
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _normalMatrix = new THREE.Matrix3();
const _quat = new THREE.Quaternion();
const _mat4 = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 0, 1);
const _color = new THREE.Color();
const _raycaster = new THREE.Raycaster();
const _centerNdc = new THREE.Vector2(0, 0);

interface PooledParticle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Euler;
  rotVel: THREE.Vector3;
  scale: number;
  life: number;
  maxLife: number;
  gravity: number;
  color: THREE.Color;
}

interface ActiveRocket {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
}

interface ActiveGrenade {
  mesh: THREE.Group;
  ledMat: THREE.MeshBasicMaterial;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  fuseTimer: number;
  bounces: number;
}

interface AcidProjectile {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  damage: number;
  isPlasma?: boolean;
}

interface ShockwaveRing {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
}

interface WorldPickup {
  kind: 'health' | 'ammo';
  mesh: THREE.Group;
  pos: THREE.Vector3;
  active: boolean;
  respawnTimer: number;
}

interface BulletDecal {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
}

interface PooledTracer {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
}

const BEST_SCORE_KEY = 'metro_breach_best_score_v1';
const AIM_SETTINGS_KEY = 'metro_breach_aim_settings_v1';

const CROSSHAIR_HEX: Record<CrosshairColor, number> = {
  cyan: 0x22d3ee,
  green: 0x4ade80,
  amber: 0xfbbf24,
  white: 0xf8fafc,
};

export class SubwayGameEngine {
  private container: HTMLElement;
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private audio = new SubwayAudioEngine();

  private isSoftwareGl = false;
  private renderer!: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private hemiLight!: THREE.HemisphereLight;
  private keyLight!: THREE.DirectionalLight;
  private textures!: SubwayTextureBundle;
  private station!: StationBuildResult;
  private viewmodel!: ViewmodelRig;

  // Dynamic gameplay lists
  private zombies: ZombieRig[] = [];
  private rockets: ActiveRocket[] = [];
  private activeGrenades: ActiveGrenade[] = [];
  private acidOrbs: AcidProjectile[] = [];
  private shockwaves: ShockwaveRing[] = [];
  private pickups: WorldPickup[] = [];
  private decals: BulletDecal[] = [];
  private decalCursor = 0;
  private decalGeo!: THREE.PlaneGeometry;

  // Bullet tracers & atmospheric dust motes
  private tracers: PooledTracer[] = [];
  private tracerCursor = 0;
  private tracerGeo!: THREE.BoxGeometry;
  private dustPoints!: THREE.Points;
  private dustCount = 220;

  // Pooled particle InstancedMesh
  private particleCount = 180;
  private particles: PooledParticle[] = [];
  private particleMesh!: THREE.InstancedMesh;

  // Player state
  private playerPos = new THREE.Vector3(-15.5, 0, -0.4);
  private playerVel = new THREE.Vector3();
  private playerYaw = -Math.PI * 0.44;
  private playerPitch = 0;
  private playerGrounded = true;
  private playerRadius = 0.42;
  private eyeHeight = 1.66;
  private hp = 100;
  private maxHp = 100;
  private ghostHp = 100;
  private walkDistance = 0;
  private stepAccum = 0;
  private isSprinting = false;
  private moveRightInput = 0;

  // Weapon, Grenade, ADS, Scope & Tactical Settings
  private activeWeapon: WeaponId = 'carbine';
  private weapons: Record<WeaponId, WeaponRuntimeState> = createInitialWeapons();
  private grenades = 3;
  private maxGrenades = 5;
  private grenadeCooldown = 0;
  private recoilPitch = 0;
  private weaponKickZ = 0;
  private swayX = 0;
  private swayY = 0;
  private shotgunPumpTimer = 0;
  private muzzleFlashTimer = 0;
  private muzzleLight!: THREE.PointLight;
  private flashlight!: THREE.SpotLight;
  private flashlightTarget!: THREE.Object3D;
  private flashlightOn = true;
  private rmbDown = false;
  private adsToggled = false;
  private isAds = false;
  private zoomTier: 1 | 2 = 1;
  private aimSettings: AimSettings = { ...DEFAULT_AIM_SETTINGS };
  private hitstopTimer = 0;
  private trauma = 0;
  private hitmarkerTimer = 0;
  private hitmarkerKill = false;
  private targetHitTimer = 0;
  private targetHitLabel = '';
  private damageFlashTimer = 0;

  // Campaign Stage & Progression
  private phase: GamePhase = 'title';
  private victory = false;
  private startStage: StageId = 1;
  private round: StageId = 1;
  private roundSpawned = 0;
  private roundKilled = 0;
  private stageElapsed = 0;
  private stageDurationOverride: number | null = null;
  private stageWave = 1;
  private lastBossElapsed = -1;
  private stageClearReady = false;
  private spawnTimer = 1.0;
  private roundBannerTimer = 0;
  private roundBannerText = '';
  private score = 0;
  private bestScore = 0;
  private kills = 0;
  private headshots = 0;
  private elapsedSeconds = 0;
  private titleTime = 0;
  private zombieSeq = 0;
  private killFeedSeq = 0;
  private killFeed: (KillFeedEntry & { ttl: number })[] = [];
  private bossSpawnedThisStage = false;
  private bossPowerText = '';
  private bossPowerTimer = 0;
  private trainAccelForce = 0;
  private trafficBumperCooldown = 0;

  // Input state
  private keysHeld = new Set<string>();
  private mouseDown = false;
  private justFired = false;
  private pointerLocked = false;
  private isDraggingLook = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // Loop & lifecycle
  private frameId = 0;
  private lastFrameMs = 0;
  private hudThrottleTimer = 0;
  private disposed = false;

  // Bound handlers
  private handleResizeBound = () => this.onResize();
  private handleKeyDownBound = (e: KeyboardEvent) => this.onKeyDown(e);
  private handleKeyUpBound = (e: KeyboardEvent) => this.onKeyUp(e);
  private handleMouseDownBound = (e: MouseEvent) => this.onMouseDown(e);
  private handleMouseUpBound = (e: MouseEvent) => this.onMouseUp(e);
  private handleContextMenuBound = (e: MouseEvent) => e.preventDefault();
  private handleMouseMoveBound = (e: MouseEvent) => this.onMouseMove(e);
  private handleWheelBound = (e: WheelEvent) => this.onWheel(e);
  private handlePointerLockChangeBound = () => this.onPointerLockChange();
  private handleBlurBound = () => this.clearInputs();
  private handleVisibilityChangeBound = () => {
    if (document.hidden) this.clearInputs();
  };

  constructor(container: HTMLElement, onHudUpdate: (snapshot: HudSnapshot) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    try {
      const saved = Number(localStorage.getItem(BEST_SCORE_KEY) || '0');
      if (Number.isFinite(saved)) this.bestScore = saved;
      const savedAim = localStorage.getItem(AIM_SETTINGS_KEY);
      if (savedAim) {
        this.aimSettings = { ...DEFAULT_AIM_SETTINGS, ...JSON.parse(savedAim) };
      }
    } catch {
      this.bestScore = 0;
    }

    this.initRendererAndScene();
    this.bindEvents();
    this.syncBodyState('title');
    this.emitHudSnapshot();

    this.lastFrameMs = performance.now();
    this.scheduleNextFrame();
  }

  private detectSoftwareGl(): boolean {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  }

  private initRendererAndScene(): void {
    this.isSoftwareGl = this.detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111a28);
    this.scene.fog = new THREE.FogExp2(0x111a28, 0.011);

    this.camera = new THREE.PerspectiveCamera(
      this.aimSettings.baseFov,
      width / height,
      0.08,
      140,
    );
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    // Balanced studio environment reflections (eliminates harsh black voids without glare)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.54;
    pmrem.dispose();

    // Rich Contrast Hemisphere + Key Directional Lights
    this.hemiLight = new THREE.HemisphereLight(0x88b4e8, 0x1a1e24, 0.36);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xffeed4, 0.72);
    this.keyLight.position.set(10, 14, -6);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.left = -24;
    this.keyLight.shadow.camera.right = 24;
    this.keyLight.shadow.camera.top = 16;
    this.keyLight.shadow.camera.bottom = -16;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    // Textures & Stage Environment
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createSubwayTextures(maxAniso);
    this.station = buildStageEnvironment(this.startStage, this.textures, this.isSoftwareGl);
    this.scene.add(this.station.worldGroup);
    this.applyStageAtmosphere();

    // Viewmodel + muzzle light + tactical weapon flashlight
    this.viewmodel = buildWeaponViewmodels();
    this.syncHoloCrosshairColor();
    this.camera.add(this.viewmodel.root);
    this.muzzleLight = new THREE.PointLight(0xffb84d, 0, 8, 2);
    this.muzzleLight.position.set(0.25, -0.15, -0.9);
    this.camera.add(this.muzzleLight);

    this.flashlightTarget = new THREE.Object3D();
    this.flashlightTarget.position.set(0, -0.02, -10);
    this.camera.add(this.flashlightTarget);
    this.flashlight = new THREE.SpotLight(0xfff4de, 0, 36, Math.PI * 0.19, 0.48, 1.45);
    this.flashlight.position.set(0.14, -0.08, -0.25);
    this.flashlight.target = this.flashlightTarget;
    this.camera.add(this.flashlight);
    this.updateViewmodelVisibility();

    // Pooled InstancedMesh particles (zero GC)
    const partGeo = new THREE.BoxGeometry(0.11, 0.11, 0.11);
    const partMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
      metalness: 0.3,
    });
    this.particleMesh = new THREE.InstancedMesh(partGeo, partMat, this.particleCount);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Euler(),
        rotVel: new THREE.Vector3(),
        scale: 0,
        life: 0,
        maxLife: 1,
        gravity: 12,
        color: new THREE.Color(0xffffff),
      });
      _mat4.makeScale(0, 0, 0);
      this.particleMesh.setMatrixAt(i, _mat4);
      this.particleMesh.setColorAt(i, _color.setHex(0xffffff));
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.particleMesh);

    // Persistent Bullet Hole & Scorch Decal Pool
    this.decalGeo = new THREE.PlaneGeometry(0.24, 0.24);
    for (let i = 0; i < 96; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: this.textures.bulletHoleMaps.concrete,
        transparent: true,
        opacity: 0.94,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(this.decalGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.decals.push({ mesh, mat });
    }

    // Pooled Bullet Tracer Streaks
    this.tracerGeo = new THREE.BoxGeometry(0.014, 0.014, 1.0);
    for (let i = 0; i < 12; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffd580,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.tracerGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.tracers.push({ mesh, mat, life: 0, maxLife: 0.065 });
    }

    // Floating Atmospheric Dust Motes
    const dustPos = new Float32Array(this.dustCount * 3);
    for (let i = 0; i < this.dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 46;
      dustPos[i * 3 + 1] = 0.25 + Math.random() * 4.3;
      dustPos[i * 3 + 2] = -8 + Math.random() * 17;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 0.048,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    this.dustPoints = new THREE.Points(dustGeo, dustMat);
    this.scene.add(this.dustPoints);

    this.initPickups();

    // GPU-only Subtle Bloom Post-Processing (never enabled on SwiftShader)
    if (!this.isSoftwareGl) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.26,
        0.42,
        0.88,
      );
      this.composer.addPass(bloom);
      this.renderer.compile(this.scene, this.camera);
    }

    this.updateTitleCameraTour(0);
    this.renderer.render(this.scene, this.camera);
  }

  private applyStageAtmosphere(): void {
    (this.scene.background as THREE.Color).setHex(this.station.skyColor);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.setHex(this.station.fogColor);
      this.scene.fog.density = this.station.fogDensity;
    }
    this.hemiLight.intensity = this.station.ambientIntensity;
    this.keyLight.intensity = this.station.keyLightIntensity;
  }

  private disposeStationGroup(group: THREE.Group): void {
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => m.dispose());
      }
    });
  }

  private loadStageEnvironment(stage: StageId): void {
    if (this.station) {
      this.scene.remove(this.station.worldGroup);
      this.disposeStationGroup(this.station.worldGroup);
    }
    this.station = buildStageEnvironment(stage, this.textures, this.isSoftwareGl);
    this.scene.add(this.station.worldGroup);
    this.applyStageAtmosphere();
    this.initPickups();
  }

  private initPickups(): void {
    this.pickups.forEach((p) => this.scene.remove(p.mesh));
    this.pickups = [];

    this.station.pickupSpots.forEach((spot, idx) => {
      const kind: 'health' | 'ammo' = idx % 2 === 0 ? 'ammo' : 'health';
      const group = new THREE.Group();
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.28, 0.34),
        new THREE.MeshStandardMaterial({
          color: kind === 'health' ? 0xdbe2ea : 0x3b4d36,
          roughness: 0.45,
          metalness: 0.3,
        }),
      );
      base.position.y = 0.22;
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.08, 0.36),
        new THREE.MeshStandardMaterial({
          color: kind === 'health' ? 0xef4444 : 0xf59e0b,
          emissive: kind === 'health' ? 0x991b1b : 0xb45309,
          emissiveIntensity: 0.85,
        }),
      );
      stripe.position.y = 0.24;
      group.add(base, stripe);
      group.position.copy(spot);
      this.scene.add(group);

      this.pickups.push({
        kind,
        mesh: group,
        pos: spot.clone(),
        active: true,
        respawnTimer: 0,
      });
    });
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResizeBound);
    window.addEventListener('keydown', this.handleKeyDownBound);
    window.addEventListener('keyup', this.handleKeyUpBound);
    window.addEventListener('blur', this.handleBlurBound);
    document.addEventListener('visibilitychange', this.handleVisibilityChangeBound);
    document.addEventListener('pointerlockchange', this.handlePointerLockChangeBound);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('mousedown', this.handleMouseDownBound);
    canvas.addEventListener('contextmenu', this.handleContextMenuBound);
    window.addEventListener('mouseup', this.handleMouseUpBound);
    window.addEventListener('mousemove', this.handleMouseMoveBound);
    canvas.addEventListener('wheel', this.handleWheelBound, { passive: true });
  }

  private syncBodyState(next: GamePhase): void {
    this.phase = next;
    document.body.dataset.state = next;
  }

  private syncHoloCrosshairColor(): void {
    const mat = this.viewmodel.holoDot.material as THREE.MeshBasicMaterial;
    mat.color.setHex(CROSSHAIR_HEX[this.aimSettings.crosshairColor]);
  }

  public setStartStage(stage: StageId): void {
    this.startStage = stage;
    if (this.phase === 'title') {
      this.loadStageEnvironment(stage);
      this.updateTitleCameraTour(0);
      this.renderer.render(this.scene, this.camera);
    }
    this.emitHudSnapshot();
  }

  public setStageDurationOverride(seconds: number | null): void {
    this.stageDurationOverride =
      seconds !== null && Number.isFinite(seconds) && seconds > 0 ? seconds : null;
    this.emitHudSnapshot();
  }

  public updateAimSettings(partial: Partial<AimSettings>): void {
    this.aimSettings = { ...this.aimSettings, ...partial };
    this.syncHoloCrosshairColor();
    try {
      localStorage.setItem(AIM_SETTINGS_KEY, JSON.stringify(this.aimSettings));
    } catch {
      // Ignore storage failures
    }
    if (!this.isAds && this.camera) {
      this.camera.fov = this.aimSettings.baseFov;
      this.camera.updateProjectionMatrix();
    }
    this.emitHudSnapshot();
  }

  private clearDynamicCombatActors(): void {
    this.zombies.forEach((z) => this.scene.remove(z.root));
    this.zombies = [];
    this.rockets.forEach((r) => this.scene.remove(r.mesh));
    this.rockets = [];
    this.activeGrenades.forEach((g) => this.scene.remove(g.mesh));
    this.activeGrenades = [];
    this.acidOrbs.forEach((o) => this.scene.remove(o.mesh));
    this.acidOrbs = [];
    this.shockwaves.forEach((s) => {
      this.scene.remove(s.mesh);
      s.mesh.geometry.dispose();
      s.mat.dispose();
    });
    this.shockwaves = [];
    this.decals.forEach((d) => {
      d.mesh.visible = false;
    });
    this.decalCursor = 0;
  }

  private spawnInitialStageThreats(roundCfg: ReturnType<typeof getRoundConfig>): void {
    const forwardCandidates = this.station.spawnPoints.filter(
      (sp) => sp.x > this.playerPos.x + 8.0 && sp.distanceTo(this.playerPos) < 28.0,
    );
    const b = this.station.floorBounds;
    const introPositions =
      forwardCandidates.length >= 2
        ? [forwardCandidates[0].clone(), forwardCandidates[1].clone()]
        : [
            new THREE.Vector3(Math.min(b.maxX - 1.5, this.playerPos.x + 10.5), 0, -1.0),
            new THREE.Vector3(Math.min(b.maxX - 1.5, this.playerPos.x + 15.0), 0, 1.8),
          ];

    introPositions.forEach((pos, idx) => {
      const archetype = idx === 0 ? 'shambler' : pickArchetypeForRound(this.round, 0.78);
      const rig = buildZombieModel(
        `z_${++this.zombieSeq}`,
        archetype,
        this.textures.contactShadowMap,
        roundCfg.hpMultiplier,
        roundCfg.speedMultiplier,
        roundCfg.damageMultiplier,
      );
      rig.root.position.copy(pos);
      this.scene.add(rig.root);
      this.zombies.push(rig);
      this.roundSpawned += 1;
    });
  }

  public startNewGame(requestLock = true, stageOverride?: StageId): void {
    this.audio.unlock();
    this.audio.setAmbienceActive(true);
    this.clearInputs();

    const targetStage = stageOverride ?? this.startStage;
    this.startStage = targetStage;
    this.round = targetStage;

    this.clearDynamicCombatActors();
    this.loadStageEnvironment(targetStage);

    // Spawn player cleanly in stage entry facing downrange
    this.playerPos.copy(this.station.playerSpawn);
    this.playerVel.set(0, 0, 0);
    this.playerYaw = this.station.playerSpawnYaw;
    this.playerPitch = 0.0;
    this.playerGrounded = true;
    this.hp = 100;
    this.maxHp = 100;
    this.ghostHp = 100;

    this.activeWeapon = 'carbine';
    this.weapons = createInitialWeapons();
    this.grenades = 3;
    this.grenadeCooldown = 0;
    this.flashlightOn = targetStage === 1 || targetStage === 3;
    this.adsToggled = false;
    this.rmbDown = false;
    this.isAds = false;
    this.zoomTier = 1;
    this.isSprinting = false;
    this.swayX = 0;
    this.swayY = 0;
    this.shotgunPumpTimer = 0;
    this.camera.fov = this.aimSettings.baseFov;
    this.camera.updateProjectionMatrix();
    this.updateViewmodelVisibility();

    this.victory = false;
    this.stageClearReady = false;
    this.stageElapsed = 0;
    this.stageWave = 1;
    this.lastBossElapsed = -1;
    this.roundSpawned = 0;
    this.roundKilled = 0;
    this.bossSpawnedThisStage = false;
    this.bossPowerText = '';
    this.bossPowerTimer = 0;
    this.trainAccelForce = 0;
    this.trafficBumperCooldown = 0;
    this.spawnTimer = 1.1;
    this.score = 0;
    this.kills = 0;
    this.headshots = 0;
    this.elapsedSeconds = 0;
    this.trauma = 0;
    this.hitstopTimer = 0;
    this.hitmarkerTimer = 0;
    this.targetHitTimer = 0;
    this.targetHitLabel = '';
    this.damageFlashTimer = 0;
    this.killFeed = [];

    const cfg = getRoundConfig(this.round);
    this.spawnInitialStageThreats(cfg);

    this.triggerRoundBanner(this.round);
    this.syncBodyState('playing');
    this.updateViewmodelVisibility();
    this.emitHudSnapshot();

    if (requestLock) {
      this.requestPointerLockSafe();
    }
  }

  private advanceToNextStage(): void {
    if (this.round >= 4) return;
    const nextStage = (this.round + 1) as StageId;
    this.round = nextStage;
    this.stageClearReady = false;
    this.stageElapsed = 0;
    this.stageWave = 1;
    this.lastBossElapsed = -1;
    this.roundSpawned = 0;
    this.roundKilled = 0;
    this.bossSpawnedThisStage = false;
    this.bossPowerText = '';
    this.bossPowerTimer = 0;
    this.spawnTimer = 1.4;
    this.adsToggled = false;
    this.rmbDown = false;
    this.isAds = false;

    // Breather supplies between 15-minute sectors
    this.hp = Math.min(this.maxHp, this.hp + 45);
    this.grenades = Math.min(this.maxGrenades, this.grenades + 2);
    this.replenishAllAmmo(0.6);

    this.clearDynamicCombatActors();
    this.loadStageEnvironment(nextStage);
    this.playerPos.copy(this.station.playerSpawn);
    this.playerVel.set(0, 0, 0);
    this.playerYaw = this.station.playerSpawnYaw;
    this.playerPitch = 0;
    this.playerGrounded = true;

    const cfg = getRoundConfig(nextStage);
    this.spawnInitialStageThreats(cfg);
    this.triggerRoundBanner(nextStage);
    this.audio.playPickup();
    this.updateViewmodelVisibility();
    this.emitHudSnapshot();
  }

  private replenishAllAmmo(fraction: number): void {
    for (const wid of WEAPON_ORDER) {
      const spec = WEAPON_SPECS[wid];
      const st = this.weapons[wid];
      const add = Math.max(1, Math.round(spec.maxReserve * fraction));
      st.reserve = Math.min(spec.maxReserve, st.reserve + add);
    }
  }

  public pauseGame(): void {
    if (this.phase !== 'playing') return;
    this.clearInputs();
    this.audio.setAmbienceActive(false);
    this.exitPointerLockSafe();
    this.syncBodyState('paused');
    this.emitHudSnapshot();
  }

  public resumeGame(): void {
    if (this.phase !== 'paused') return;
    this.audio.unlock();
    this.audio.setAmbienceActive(true);
    this.clearInputs();
    this.syncBodyState('playing');
    this.updateViewmodelVisibility();
    this.requestPointerLockSafe();
    this.emitHudSnapshot();
  }

  public returnToTitle(): void {
    this.clearInputs();
    this.audio.setAmbienceActive(false);
    this.exitPointerLockSafe();
    this.viewmodel.root.visible = false;
    this.loadStageEnvironment(this.startStage);
    this.syncBodyState('title');
    this.emitHudSnapshot();
  }

  public selectWeapon(id: WeaponId): void {
    if (this.phase !== 'playing' || this.activeWeapon === id) return;
    this.activeWeapon = id;
    this.weaponKickZ = 0.08;
    this.zoomTier = 1;
    this.updateViewmodelVisibility();
    this.audio.playReloadClick();
    this.emitHudSnapshot();
  }

  public toggleMute(): void {
    this.audio.unlock();
    this.audio.toggleMute();
    this.emitHudSnapshot();
  }

  private requestPointerLockSafe(): void {
    try {
      const el = this.renderer.domElement;
      if (document.pointerLockElement !== el && el.requestPointerLock) {
        const res = el.requestPointerLock() as unknown as Promise<void> | undefined;
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      }
    } catch {
      // Headless or sandboxed iframes may reject PointerLock; drag-aim fallback remains active.
    }
  }

  private exitPointerLockSafe(): void {
    try {
      if (document.pointerLockElement && document.exitPointerLock) {
        document.exitPointerLock();
      }
    } catch {
      // Ignore
    }
  }

  private clearInputs(): void {
    this.keysHeld.clear();
    this.mouseDown = false;
    this.rmbDown = false;
    this.justFired = false;
    this.isDraggingLook = false;
  }

  private onPointerLockChange(): void {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.emitHudSnapshot();
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) {
      if (this.phase === 'playing') e.preventDefault();
    }

    if (this.phase === 'title') {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        this.startNewGame(true);
      }
      return;
    }

    if (e.code === 'KeyM') {
      this.toggleMute();
      return;
    }

    if (e.code === 'KeyP' || e.code === 'Escape' || e.code === 'Tab') {
      if (this.phase === 'playing') {
        this.pauseGame();
      } else if (this.phase === 'paused') {
        this.resumeGame();
      }
      return;
    }

    if (this.phase !== 'playing') return;

    this.keysHeld.add(e.code);

    if (e.code === 'Digit1') this.selectWeapon('pistol');
    else if (e.code === 'Digit2') this.selectWeapon('smg');
    else if (e.code === 'Digit3') this.selectWeapon('carbine');
    else if (e.code === 'Digit4') this.selectWeapon('sniper');
    else if (e.code === 'Digit5') this.selectWeapon('shotgun');
    else if (e.code === 'Digit6') this.selectWeapon('lmg');
    else if (e.code === 'Digit7') this.selectWeapon('rpg');
    else if (e.code === 'KeyQ') {
      const next = WEAPON_ORDER[(WEAPON_ORDER.indexOf(this.activeWeapon) + 1) % WEAPON_ORDER.length];
      this.selectWeapon(next);
    } else if (e.code === 'KeyG') {
      this.throwGrenade();
    } else if (e.code === 'KeyE' && this.stageClearReady && this.round < 4) {
      this.advanceToNextStage();
    } else if (e.code === 'KeyZ' && this.activeWeapon === 'sniper') {
      this.zoomTier = this.zoomTier === 1 ? 2 : 1;
      this.audio.playZoomClick();
      this.emitHudSnapshot();
    } else if (e.code === 'KeyR') {
      const w = this.weapons[this.activeWeapon];
      if (tryStartReload(w, WEAPON_SPECS[this.activeWeapon])) {
        this.audio.playReloadClick();
        this.emitHudSnapshot();
      }
    } else if (e.code === 'Space' && this.playerGrounded) {
      this.playerVel.y = 5.9;
      this.playerGrounded = false;
    } else if (e.code === 'KeyF') {
      this.justFired = true;
      this.attemptFire();
    } else if (e.code === 'KeyV') {
      this.adsToggled = !this.adsToggled;
      this.updateViewmodelVisibility();
      this.emitHudSnapshot();
    } else if (e.code === 'KeyL') {
      this.flashlightOn = !this.flashlightOn;
      this.audio.playReloadClick();
      this.emitHudSnapshot();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keysHeld.delete(e.code);
  }

  private onMouseDown(e: MouseEvent): void {
    if (this.phase !== 'playing') return;
    if (e.button === 2) {
      this.rmbDown = true;
      this.adsToggled = false;
      this.updateViewmodelVisibility();
      this.emitHudSnapshot();
      return;
    }
    if (e.button === 1 && this.activeWeapon === 'sniper' && this.isAds) {
      e.preventDefault();
      this.zoomTier = this.zoomTier === 1 ? 2 : 1;
      this.audio.playZoomClick();
      this.emitHudSnapshot();
      return;
    }
    if (e.button !== 0) return;

    this.audio.unlock();
    if (!this.pointerLocked) {
      this.requestPointerLockSafe();
    }
    this.mouseDown = true;
    this.justFired = true;
    this.isDraggingLook = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.attemptFire();
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 2) {
      this.rmbDown = false;
      this.updateViewmodelVisibility();
      this.emitHudSnapshot();
      return;
    }
    this.mouseDown = false;
    this.isDraggingLook = false;
  }

  private onMouseMove(e: MouseEvent): void {
    if (this.phase !== 'playing') return;

    let dx = 0;
    let dy = 0;
    if (this.pointerLocked) {
      dx = e.movementX;
      dy = e.movementY;
    } else if (this.isDraggingLook) {
      dx = e.clientX - this.lastPointerX;
      dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    } else {
      return;
    }

    const sensitivity = computeLookSensitivity(
      this.aimSettings.sensitivity,
      this.aimSettings.adsMultiplier,
      this.isAds,
      this.camera.fov,
      this.aimSettings.baseFov,
    );
    this.playerYaw -= dx * sensitivity;
    this.playerPitch = THREE.MathUtils.clamp(
      this.playerPitch - dy * sensitivity,
      -1.25,
      1.25,
    );

    // Smooth ADS target tracking magnetism (gentle, never snaps)
    if (this.aimSettings.smoothAimAssist && this.isAds && Math.abs(dx) + Math.abs(dy) > 0.3) {
      this.applySmoothAimAssist();
    }

    // Weapon inertia sway opposing look rotation
    this.swayX = THREE.MathUtils.clamp(this.swayX - dx * 0.0005, -0.022, 0.022);
    this.swayY = THREE.MathUtils.clamp(this.swayY + dy * 0.0005, -0.022, 0.022);
  }

  private applySmoothAimAssist(): void {
    let bestDistNdc = 0.08;
    let bestOffsetX = 0;
    let bestOffsetY = 0;

    for (const z of this.zombies) {
      if (z.attackState === 'ko') continue;
      _v1.copy(z.root.position);
      _v1.y += 1.35; // Chest/neck height
      if (_v1.distanceTo(this.camera.position) > 36) continue;
      _v1.project(this.camera);
      if (_v1.z > 1 || _v1.z < -1) continue;
      const d = Math.hypot(_v1.x, _v1.y);
      if (d < bestDistNdc) {
        bestDistNdc = d;
        bestOffsetX = _v1.x;
        bestOffsetY = _v1.y;
      }
    }

    if (bestDistNdc < 0.08) {
      this.playerYaw -= bestOffsetX * 0.028;
      this.playerPitch = THREE.MathUtils.clamp(this.playerPitch + bestOffsetY * 0.022, -1.25, 1.25);
    }
  }

  private onWheel(e: WheelEvent): void {
    if (this.phase !== 'playing') return;
    if (this.activeWeapon === 'sniper' && this.isAds) {
      this.zoomTier = this.zoomTier === 1 ? 2 : 1;
      this.audio.playZoomClick();
      this.emitHudSnapshot();
      return;
    }
    const idx = WEAPON_ORDER.indexOf(this.activeWeapon);
    const dir = e.deltaY > 0 ? 1 : -1;
    const next = WEAPON_ORDER[(idx + dir + WEAPON_ORDER.length) % WEAPON_ORDER.length];
    this.selectWeapon(next);
  }

  private onResize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    if (this.composer) {
      this.composer.setSize(width, height);
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private updateViewmodelVisibility(): void {
    const isScoped = this.activeWeapon === 'sniper' && this.isAds;
    this.viewmodel.root.visible = this.phase === 'playing' && !isScoped;
    for (const wid of WEAPON_ORDER) {
      this.viewmodel.groups[wid].visible = this.activeWeapon === wid;
    }
    const rpgState = this.weapons.rpg;
    this.viewmodel.rpgWarhead.visible = rpgState.mag > 0 && !rpgState.isReloading;
  }

  private triggerRoundBanner(round: StageId): void {
    const cfg = getRoundConfig(round);
    this.roundBannerTimer = 3.2;
    this.roundBannerText = `STAGE ${cfg.round} · ${cfg.stageName.toUpperCase()} — ${cfg.subtitle}`;
    this.audio.playRoundAlert(round >= 2);
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick(): void {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastFrameMs) / 1000;
    this.lastFrameMs = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    if (this.phase === 'title') {
      this.flashlight.intensity = 0;
      this.updateTitleCameraTour(dt);
      this.updateMovingTrain(dt, false);
      this.updateMovingVehicles(dt);
      this.updateRooftopHelicopter(dt);
      this.updatePendulumHandles(dt, 0.25);
      this.updateCeilingLights(dt, 0.15);
      this.updateDustMotes(dt);
    } else if (this.phase === 'playing') {
      this.updatePlaying(dt);
    }

    if (!this.isSoftwareGl && this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    this.scheduleNextFrame();
  }

  private updateTitleCameraTour(dt: number): void {
    this.titleTime += dt;
    this.viewmodel.root.visible = false;
    const t = this.titleTime * 0.24;

    if (this.station.stage === 1) {
      const camX = Math.sin(t) * 11.5;
      const camY = 2.05 + Math.sin(t * 1.4) * 0.28;
      const camZ = -2.2 + Math.cos(t * 0.8) * 2.4;
      this.camera.position.set(camX, camY, camZ);
      _v1.set(camX * 0.4 + 2.5, 1.35, 5.2);
      this.camera.lookAt(_v1);
    } else if (this.station.stage === 2) {
      const camX = -8 + Math.sin(t) * 10;
      this.camera.position.set(camX, 2.8, -3.5 + Math.cos(t) * 2.0);
      _v1.set(camX + 12, 1.4, 1.0);
      this.camera.lookAt(_v1);
    } else if (this.station.stage === 3) {
      const camX = Math.sin(t) * 9.5;
      this.camera.position.set(camX, 2.4, -3.0);
      _v1.set(camX * 0.4 + 4, 1.3, 2.0);
      this.camera.lookAt(_v1);
    } else {
      const camX = -4 + Math.sin(t) * 9.0;
      this.camera.position.set(camX, 3.2, -5.0);
      _v1.set(8, 0.6, 0);
      this.camera.lookAt(_v1);
    }
  }

  private updatePlaying(dt: number): void {
    this.elapsedSeconds += dt;
    const roundCfg = getRoundConfig(this.round);

    if (this.grenadeCooldown > 0) this.grenadeCooldown = Math.max(0, this.grenadeCooldown - dt);
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashTimer <= 0) {
        this.viewmodel.muzzleFlash.visible = false;
        this.muzzleLight.intensity = 0;
      }
    }
    if (this.hitmarkerTimer > 0) this.hitmarkerTimer = Math.max(0, this.hitmarkerTimer - dt);
    if (this.targetHitTimer > 0) this.targetHitTimer = Math.max(0, this.targetHitTimer - dt);
    if (this.bossPowerTimer > 0) {
      this.bossPowerTimer = Math.max(0, this.bossPowerTimer - dt);
      if (this.bossPowerTimer <= 0) this.bossPowerText = '';
    }
    if (this.damageFlashTimer > 0) this.damageFlashTimer = Math.max(0, this.damageFlashTimer - dt);
    if (this.roundBannerTimer > 0) this.roundBannerTimer = Math.max(0, this.roundBannerTimer - dt);
    if (this.shotgunPumpTimer > 0) this.shotgunPumpTimer = Math.max(0, this.shotgunPumpTimer - dt);
    for (let i = this.killFeed.length - 1; i >= 0; i--) {
      this.killFeed[i].ttl -= dt;
      if (this.killFeed[i].ttl <= 0) this.killFeed.splice(i, 1);
    }

    this.ghostHp = THREE.MathUtils.damp(this.ghostHp, this.hp, 3.2, dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.9);

    let simDt = dt;
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      simDt = 0;
    }

    // Weapon timers & auto-fire
    for (const wid of WEAPON_ORDER) {
      const completed = stepWeaponTimers(this.weapons[wid], WEAPON_SPECS[wid], dt);
      if (completed && wid === this.activeWeapon) {
        this.audio.playReloadClick();
        this.updateViewmodelVisibility();
      }
    }

    if (this.mouseDown && WEAPON_SPECS[this.activeWeapon].automatic) {
      this.attemptFire();
    }
    this.justFired = false;

    if (this.trafficBumperCooldown > 0) {
      this.trafficBumperCooldown = Math.max(0, this.trafficBumperCooldown - dt);
    }

    if (simDt > 0) {
      this.updateMovingTrain(simDt, true);
      this.updateMovingVehicles(simDt);
      this.updateRooftopHelicopter(simDt);
      this.updatePlayerMovement(simDt);
      this.updateRockets(simDt);
      this.updateGrenades(simDt);
      this.updateAcidProjectiles(simDt);
      this.updateShockwaves(simDt);
      this.updateZombies(simDt, roundCfg);
      this.updatePickups(simDt);
      this.updateRoundProgression(simDt, roundCfg);
    }

    this.updatePendulumHandles(dt, roundCfg.trainTremor);
    this.updateCeilingLights(dt, roundCfg.flickerIntensity);
    this.updateExtractionBeacon(dt);
    this.updateParticles(dt);
    this.updateTracers(dt);
    this.updateDustMotes(dt);
    this.updateCameraAndViewmodel(dt);

    // Throttle React HUD updates to ~12 Hz
    this.hudThrottleTimer += dt;
    if (this.hudThrottleTimer >= 0.08) {
      this.hudThrottleTimer = 0;
      this.emitHudSnapshot();
    }
  }

  private updateExtractionBeacon(dt: number): void {
    if (!this.stageClearReady || this.round >= 4) return;
    const t = performance.now() * 0.004;
    this.station.extractionRing.rotation.z += dt * 1.8;
    const ringMat = this.station.extractionRing.material as THREE.MeshBasicMaterial;
    const beamMat = this.station.extractionBeam.material as THREE.MeshBasicMaterial;
    ringMat.opacity = 0.55 + Math.sin(t) * 0.25;
    beamMat.opacity = 0.2 + Math.sin(t * 1.4) * 0.08;
    this.station.extractionLight.intensity = 10 + Math.sin(t * 2) * 3;
  }

  private updatePlayerMovement(dt: number): void {
    const turnSpeed = 2.0;
    if (this.keysHeld.has('ArrowLeft')) this.playerYaw += turnSpeed * dt;
    if (this.keysHeld.has('ArrowRight')) this.playerYaw -= turnSpeed * dt;

    let moveForward = 0;
    let moveRight = 0;
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) moveForward += 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) moveForward -= 1;
    if (this.keysHeld.has('KeyD')) moveRight += 1;
    if (this.keysHeld.has('KeyA')) moveRight -= 1;

    _forward.set(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw));
    _right.set(Math.cos(this.playerYaw), 0, -Math.sin(this.playerYaw));

    _v1.set(0, 0, 0);
    _v1.addScaledVector(_forward, moveForward);
    _v1.addScaledVector(_right, moveRight);
    if (_v1.lengthSq() > 0) _v1.normalize();

    const sprint = this.keysHeld.has('ShiftLeft') || this.keysHeld.has('ShiftRight');
    const activeState = this.weapons[this.activeWeapon];
    this.moveRightInput = moveRight;
    const prevAds = this.isAds;
    this.isAds = (this.rmbDown || this.adsToggled) && !activeState.isReloading;
    if (prevAds !== this.isAds) {
      this.updateViewmodelVisibility();
    }
    this.isSprinting =
      sprint && moveForward > 0 && !this.isAds && !this.mouseDown && !activeState.isReloading;

    const speed = this.isSprinting ? 7.8 : this.isAds ? 4.0 : 5.5;

    const targetVx = _v1.x * speed;
    const targetVz = _v1.z * speed;
    this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, targetVx, 14, dt);
    this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, targetVz, 14, dt);

    this.playerVel.y -= 17.5 * dt;
    const nextX = this.playerPos.x + this.playerVel.x * dt;
    const nextZ = this.playerPos.z + this.playerVel.z * dt;

    const resolved = resolveCircleAabbCollisions(
      nextX,
      nextZ,
      this.playerRadius,
      this.station.colliders,
    );

    const bounds = this.station.floorBounds;
    this.playerPos.x = THREE.MathUtils.clamp(resolved.x, bounds.minX, bounds.maxX);
    this.playerPos.z = THREE.MathUtils.clamp(resolved.z, bounds.minZ, bounds.maxZ);

    const floorY = this.getFloorHeightAt(this.playerPos.x, this.playerPos.z);
    this.playerPos.y += this.playerVel.y * dt;
    if (this.playerPos.y <= floorY) {
      this.playerPos.y = floorY;
      this.playerVel.y = 0;
      this.playerGrounded = true;
    }

    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    if (this.playerGrounded && horizSpeed > 0.6) {
      const stepDist = horizSpeed * dt;
      this.walkDistance += stepDist;
      this.stepAccum += stepDist;
      if (this.stepAccum >= 1.95) {
        this.stepAccum = 0;
        const inTrain = this.station.stage === 1 && this.playerPos.z > 4.2 && this.playerPos.z < 8.4;
        this.audio.playFootstep(inTrain);
      }
    }

    if (this.station.stage === 1 && this.playerPos.z > 4.0 && horizSpeed > 0.4) {
      for (const h of this.station.handles) {
        const dx = h.worldPos.x - this.playerPos.x;
        const dz = h.worldPos.z - this.playerPos.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < 1.15) {
          const factor = (1.15 - dSq) * 1.4 * dt;
          h.state.velZ += this.playerVel.x * factor;
          h.state.velX -= this.playerVel.z * factor;
        }
      }
    }
  }

  private getFloorHeightAt(x: number, z: number): number {
    if (this.station.stage === 1) {
      if (z <= 4.35) return 0;
      const trainX = this.station.trainState ? this.station.trainState.x : 0;
      if (Math.abs(x - trainX) <= 18.5 && z >= 4.35 && z <= 8.2) return 0.04;
      return -0.95;
    }
    if (this.station.stage === 2 && Math.abs(z) >= 8.95) {
      return 0.12; // Raised town sidewalk curb
    }
    return 0;
  }

  private attemptFire(): void {
    const spec = WEAPON_SPECS[this.activeWeapon];
    const state = this.weapons[this.activeWeapon];
    if (!spec.automatic && !this.justFired) return;

    const result = tryFireWeapon(state, spec);
    if (result === 'empty') {
      if (tryStartReload(state, spec)) {
        this.audio.playReloadClick();
        this.emitHudSnapshot();
      }
      return;
    }
    if (result !== 'fired') return;

    this.audio.playWeaponFire(this.activeWeapon);
    this.recoilPitch += spec.recoilKick * (this.isAds ? 0.28 : 1.0);
    this.weaponKickZ = Math.min(this.isAds ? 0.05 : 0.18, this.weaponKickZ + spec.recoilKick * (this.isAds ? 0.32 : 1.5));
    this.muzzleFlashTimer = 0.045;
    // Never obstruct ADS or sniper scope sightlines with muzzle flash glare
    this.viewmodel.muzzleFlash.visible = !this.isAds;
    this.viewmodel.muzzleFlash.rotation.z = Math.random() * Math.PI;
    this.muzzleLight.intensity = this.isAds ? 0.35 : (this.activeWeapon === 'rpg' ? 5.5 : 3.0);
    const traumaAdd = this.isAds
      ? 0.0
      : (this.activeWeapon === 'rpg' || this.activeWeapon === 'sniper' ? 0.34 : 0.11);
    this.trauma = Math.min(1, this.trauma + traumaAdd);

    if (this.activeWeapon === 'rpg') {
      this.viewmodel.rpgWarhead.visible = false;
      this.launchRocket();
      this.applyHandleShockwave(this.playerPos, 4.5, 6.0);
    } else {
      if (this.activeWeapon === 'shotgun') {
        this.shotgunPumpTimer = 0.36;
      }
      this.ejectShellCasing(this.activeWeapon);
      const isMoving = Math.hypot(this.playerVel.x, this.playerVel.z) > 1.2;
      const effectiveSpread = getEffectiveSpread(spec.spreadRad, this.isAds, isMoving);
      this.fireHitscan(spec.pellets, effectiveSpread, spec.damage);
      this.applyHandleShockwave(this.playerPos, 3.0, 2.5);
    }

    if (state.mag === 0 && state.reserve > 0 && this.activeWeapon === 'rpg') {
      tryStartReload(state, spec);
    }

    this.emitHudSnapshot();
  }

  private throwGrenade(): void {
    if (this.grenades <= 0 || this.grenadeCooldown > 0) return;
    this.grenades -= 1;
    this.grenadeCooldown = 0.72;
    this.audio.playGrenadeThrow();

    const gGroup = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x3f4f36, roughness: 0.55, metalness: 0.4 }),
    );
    const spoon = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.07, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.7, roughness: 0.35 }),
    );
    spoon.position.y = 0.09;
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), ledMat);
    led.position.y = 0.13;
    gGroup.add(body, spoon, led);

    _v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    const startPos = this.camera.position.clone().addScaledVector(_v1, 0.65);
    gGroup.position.copy(startPos);
    this.scene.add(gGroup);

    const throwVel = _v1.clone().multiplyScalar(17.5);
    throwVel.y += 3.8;

    this.activeGrenades.push({
      mesh: gGroup,
      ledMat,
      pos: startPos,
      vel: throwVel,
      fuseTimer: 1.85,
      bounces: 0,
    });
    this.emitHudSnapshot();
  }

  private updateGrenades(dt: number): void {
    for (let i = this.activeGrenades.length - 1; i >= 0; i--) {
      const g = this.activeGrenades[i];
      g.fuseTimer -= dt;
      g.vel.y -= 19.5 * dt;

      const nextX = g.pos.x + g.vel.x * dt;
      const nextY = g.pos.y + g.vel.y * dt;
      const nextZ = g.pos.z + g.vel.z * dt;

      // Wall deflection via AABB check
      const resolved = resolveCircleAabbCollisions(nextX, nextZ, 0.14, this.station.colliders);
      if (Math.abs(resolved.x - nextX) > 0.01) g.vel.x *= -0.5;
      if (Math.abs(resolved.z - nextZ) > 0.01) g.vel.z *= -0.5;
      g.pos.x = resolved.x;
      g.pos.z = resolved.z;
      g.pos.y = nextY;

      const floorY = this.getFloorHeightAt(g.pos.x, g.pos.z) + 0.09;
      if (g.pos.y <= floorY && g.vel.y < 0) {
        g.pos.y = floorY;
        if (Math.abs(g.vel.y) > 1.8) {
          this.audio.playGrenadeBounce();
        }
        g.vel.y *= -0.42;
        g.vel.x *= 0.72;
        g.vel.z *= 0.72;
        g.bounces += 1;
      }

      g.mesh.position.copy(g.pos);
      g.mesh.rotation.x += dt * 7;
      g.mesh.rotation.z += dt * 5;
      // Blinking fuse indicator
      const blink = Math.sin(g.fuseTimer * 28) > 0;
      g.ledMat.color.setHex(blink ? 0xef4444 : 0x450a0a);

      // Explode early on direct zombie contact after first frame or when fuse expires
      let hitZombie = false;
      for (const z of this.zombies) {
        if (z.attackState === 'ko') continue;
        if (Math.hypot(z.root.position.x - g.pos.x, z.root.position.z - g.pos.z) < 0.75 && g.pos.y < 1.8) {
          hitZombie = true;
          break;
        }
      }

      if (g.fuseTimer <= 0 || hitZombie) {
        this.detonateExplosion(g.pos.clone(), new THREE.Vector3(0, 1, 0), 5.8, 225, 'grenade');
        this.scene.remove(g.mesh);
        this.activeGrenades.splice(i, 1);
      }
    }
  }

  private ejectShellCasing(weapon: WeaponId): void {
    _forward.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    _right.set(1, 0, 0).applyQuaternion(this.camera.quaternion).normalize();
    _v3.copy(this.camera.position)
      .addScaledVector(_forward, 0.36)
      .addScaledVector(_right, this.isAds ? 0.08 : 0.24);
    _v3.y -= 0.12;

    this.spawnSingleParticle(
      _v3,
      _right.x * 2.5 + (Math.random() - 0.5) * 0.6,
      1.9 + Math.random() * 0.7,
      _right.z * 2.5 + (Math.random() - 0.5) * 0.6,
      weapon === 'shotgun' ? 0xb91c1c : 0xd4af37,
      0.065,
      0.75,
      15,
    );
  }

  private spawnTracer(start: THREE.Vector3, end: THREE.Vector3): void {
    const tracer = this.tracers[this.tracerCursor];
    this.tracerCursor = (this.tracerCursor + 1) % this.tracers.length;
    const dist = start.distanceTo(end);
    if (dist < 0.2) return;

    tracer.mesh.position.copy(start).lerp(end, 0.5);
    tracer.mesh.lookAt(end);
    tracer.mesh.scale.set(1, 1, Math.min(dist, 4.5));
    tracer.mat.opacity = 0.85;
    tracer.life = tracer.maxLife;
    tracer.mesh.visible = true;
  }

  private fireHitscan(pellets: number, spreadRad: number, damage: number): void {
    const targets: THREE.Object3D[] = [...this.station.interactables];
    for (const z of this.zombies) {
      if (z.attackState !== 'ko') {
        targets.push(...z.hitMeshes);
      }
    }

    const muzzleWorld = new THREE.Vector3();
    if (this.viewmodel.root.visible) {
      this.viewmodel.muzzlePoint.getWorldPosition(muzzleWorld);
    } else {
      muzzleWorld.copy(this.camera.position).add(new THREE.Vector3(0, -0.06, 0));
    }

    for (let p = 0; p < pellets; p++) {
      _centerNdc.set(
        (Math.random() - 0.5) * spreadRad * 2.0,
        (Math.random() - 0.5) * spreadRad * 2.0,
      );
      _raycaster.setFromCamera(_centerNdc, this.camera);
      _raycaster.far = 75;

      const hits = _raycaster.intersectObjects(targets, false);
      if (hits.length === 0) {
        if (p === 0 && !this.isAds) {
          _v2.copy(_raycaster.ray.origin).addScaledVector(_raycaster.ray.direction, 36);
          this.spawnTracer(muzzleWorld, _v2);
        }
        continue;
      }

      const hit = hits[0];
      if (p < 2 && !this.isAds) {
        this.spawnTracer(muzzleWorld, hit.point);
      }
      const obj = hit.object as THREE.Mesh;
      const matType = (obj.userData.material as SurfaceMaterial) || 'concrete';

      if (p === 0 || matType === 'flesh') {
        this.audio.playMaterialImpact(matType);
      }

      const zombieId = obj.userData.zombieId as string | undefined;
      if (zombieId) {
        const z = this.zombies.find((item) => item.id === zombieId);
        if (z && z.attackState !== 'ko') {
          const isHead = Boolean(obj.userData.isHead);
          const isCore = Boolean(obj.userData.isCriticalCore);
          const finalDmg = isHead ? damage * 2.0 : isCore ? damage * 1.55 : damage;
          this.damageZombie(z, finalDmg, _raycaster.ray.direction, isHead, this.activeWeapon, isCore);
          this.spawnParticleBurst(hit.point, z.archetype === 'titan' ? 0xd946ef : 0x8a1c1c, 7, 4.5);
          continue;
        }
      }

      const hitHandle = this.station.handles.find((h) => h.hitMesh === obj);
      if (hitHandle) {
        hitHandle.state.velX += _raycaster.ray.direction.z * 9.5;
        hitHandle.state.velZ -= _raycaster.ray.direction.x * 9.5;
        this.spawnParticleBurst(hit.point, 0xfbbf24, 5, 4.0);
        continue;
      }

      if (hit.face && matType !== 'flesh') {
        _normalMatrix.getNormalMatrix(obj.matrixWorld);
        _v1.copy(hit.face.normal).applyMatrix3(_normalMatrix).normalize();
        this.placeBulletDecal(hit.point, _v1, matType);

        const burstColor =
          matType === 'metal'
            ? 0xfcd34d
            : matType === 'glass'
              ? 0xbae6fd
              : matType === 'wood'
                ? 0xa16207
                : 0xd1d5db;
        this.spawnParticleBurst(hit.point, burstColor, 5, 4.2);
      }

      const destId = obj.userData.destructibleId as string | undefined;
      if (destId) {
        this.damageDestructibleById(destId, damage * 0.8);
      }
    }
  }

  private launchRocket(): void {
    const rocketGroup = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.36, 10),
      new THREE.MeshStandardMaterial({ color: 0x3b4d36, roughness: 0.5, metalness: 0.5 }),
    );
    body.rotation.x = Math.PI / 2;
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.055, 0.14, 10),
      new THREE.MeshStandardMaterial({ color: 0xe69f19, roughness: 0.3 }),
    );
    tip.rotation.x = -Math.PI / 2;
    tip.position.z = -0.24;
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff9f1c }),
    );
    flame.position.z = 0.2;
    rocketGroup.add(body, tip, flame);

    _v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    const startPos = this.camera.position.clone().addScaledVector(_v1, 0.75);
    rocketGroup.position.copy(startPos);
    rocketGroup.quaternion.copy(this.camera.quaternion);
    this.scene.add(rocketGroup);

    this.rockets.push({
      mesh: rocketGroup,
      pos: startPos,
      vel: _v1.clone().multiplyScalar(38),
      life: 3.5,
    });
  }

  private updateRockets(dt: number): void {
    const targets: THREE.Object3D[] = [...this.station.interactables];
    for (const z of this.zombies) {
      if (z.attackState !== 'ko') targets.push(...z.hitMeshes);
    }

    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.life -= dt;
      const stepDist = r.vel.length() * dt;
      _v1.copy(r.vel).normalize();
      _raycaster.set(r.pos, _v1);
      _raycaster.far = stepDist + 0.25;

      const hits = _raycaster.intersectObjects(targets, false);
      if (hits.length > 0 || r.life <= 0) {
        const impactPoint = hits.length > 0 ? hits[0].point.clone() : r.pos.clone();
        const hitNormal =
          hits.length > 0 && hits[0].face
            ? hits[0].face.normal.clone().transformDirection(hits[0].object.matrixWorld)
            : new THREE.Vector3(0, 1, 0);
        this.detonateExplosion(impactPoint, hitNormal, WEAPON_SPECS.rpg.splashRadius, WEAPON_SPECS.rpg.splashDamage, 'rpg');
        this.scene.remove(r.mesh);
        this.rockets.splice(i, 1);
      } else {
        r.pos.addScaledVector(r.vel, dt);
        r.mesh.position.copy(r.pos);
        this.spawnSingleParticle(
          r.pos,
          (Math.random() - 0.5) * 0.8,
          0.5 + Math.random() * 0.8,
          (Math.random() - 0.5) * 0.8,
          0x9ca3af,
          0.22,
          0.42,
          -1.5,
        );
      }
    }
  }

  private detonateExplosion(
    center: THREE.Vector3,
    normal: THREE.Vector3,
    radius: number,
    maxDamage: number,
    sourceWeapon: WeaponId | 'grenade' = 'rpg',
  ): void {
    this.audio.playExplosion();
    this.hitstopTimer = 0.05;
    this.trauma = Math.min(1, this.trauma + 0.85);

    this.placeScorchDecal(center, normal);
    this.spawnParticleBurst(center, 0xff7b00, 20, 11.5);
    this.spawnParticleBurst(center, 0x374151, 16, 9.5);
    this.applyHandleShockwave(center, radius * 1.8, 18.0);

    for (const z of this.zombies) {
      if (z.attackState === 'ko') continue;
      const dist = z.root.position.distanceTo(center);
      const dmg = computeBlastFalloff(dist, radius, maxDamage);
      if (dmg > 0) {
        _v2.subVectors(z.root.position, center).setY(0.4).normalize();
        this.damageZombie(z, dmg, _v2, false, sourceWeapon);
      }
    }

    const chainBarrels: DestructibleBinding[] = [];
    for (const binding of this.station.destructibles) {
      if (binding.state.destroyed) continue;
      _v2.set(
        binding.state.position.x,
        binding.state.position.y,
        binding.state.position.z,
      );
      const dist = _v2.distanceTo(center);
      const dmg = computeBlastFalloff(dist, radius, maxDamage);
      if (dmg > 0) {
        const broke = applyDestructibleDamage(
          binding.state,
          dmg,
          this.station.colliders,
        );
        if (broke) {
          this.handleDestructibleBroken(binding, center);
          if (binding.state.explosive) {
            chainBarrels.push(binding);
          }
        }
      }
    }

    const playerDist = this.playerPos.distanceTo(center);
    if (playerDist < radius * 0.65) {
      const selfDmg = Math.round(computeBlastFalloff(playerDist, radius * 0.65, 28));
      if (selfDmg > 0) {
        this.applyPlayerDamage(selfDmg);
      }
    }

    for (const barrel of chainBarrels) {
      _v3.set(
        barrel.state.position.x,
        barrel.state.position.y,
        barrel.state.position.z,
      );
      this.detonateExplosion(_v3, new THREE.Vector3(0, 1, 0), 5.2, 180, sourceWeapon);
    }
  }

  private damageDestructibleById(id: string, damage: number): void {
    const binding = this.station.destructibles.find((d) => d.state.id === id);
    if (!binding || binding.state.destroyed) return;
    const broke = applyDestructibleDamage(
      binding.state,
      damage,
      this.station.colliders,
    );
    if (broke) {
      _v2.set(
        binding.state.position.x,
        binding.state.position.y,
        binding.state.position.z,
      );
      this.handleDestructibleBroken(binding, _v2);
      if (binding.state.explosive) {
        this.detonateExplosion(_v2, new THREE.Vector3(0, 1, 0), 5.2, 180, this.activeWeapon);
      }
    }
  }

  private handleDestructibleBroken(
    binding: DestructibleBinding,
    blastCenter: THREE.Vector3,
  ): void {
    binding.mesh.visible = false;
    for (const hm of binding.hitMeshes) {
      const idx = this.station.interactables.indexOf(hm);
      if (idx !== -1) this.station.interactables.splice(idx, 1);
    }

    const pos = _v1.set(
      binding.state.position.x,
      binding.state.position.y,
      binding.state.position.z,
    );
    const debrisColor =
      binding.state.category === 'train_panel' || binding.state.category === 'vehicle'
        ? 0x94a3b8
        : binding.state.material === 'wood' || binding.state.category === 'bench'
          ? 0x92400e
          : binding.state.category === 'barrel'
            ? 0xdc2626
            : 0x6b7280;

    for (let i = 0; i < 14; i++) {
      _v2.subVectors(pos, blastCenter).normalize();
      this.spawnSingleParticle(
        pos,
        _v2.x * 5 + (Math.random() - 0.5) * 8,
        3.5 + Math.random() * 6.5,
        _v2.z * 5 + (Math.random() - 0.5) * 8,
        i % 3 === 0 ? 0xbae6fd : debrisColor,
        0.24 + Math.random() * 0.16,
        1.1,
        18,
      );
    }
    const mv = this.station.movingVehicles.find((v) => v.destructible === binding);
    if (mv) {
      mv.state.destroyed = true;
      mv.state.respawnTimer = 7.5;
    }
    this.score += 35;
  }

  private updateMovingTrain(dt: number, affectActors: boolean): void {
    if (!this.station.trainState) {
      this.trainAccelForce = 0;
      return;
    }
    const res = stepMovingTrain(this.station.trainState, dt);
    this.station.trainState = res.state;
    const tx = res.state.x;
    this.station.trainGroup.position.x = tx;
    this.trainAccelForce = THREE.MathUtils.clamp(-res.accel * 0.55, -6.0, 6.0);

    const wheelSpin = -res.dx / 0.42;
    for (const w of this.station.trainWheels) {
      w.rotation.z += wheelSpin;
    }

    for (const b of this.station.trainBindings) {
      b.collider.minX = b.baseMinX + tx;
      b.collider.maxX = b.baseMaxX + tx;
      if (b.destructible && b.basePosX !== undefined) {
        b.destructible.position.x = b.basePosX + tx;
      }
    }

    for (const h of this.station.handles) {
      h.worldPos.x = h.baseLocalX + tx;
    }

    if (affectActors && !res.wrapped) {
      const onTrainDeck =
        this.playerPos.z >= 4.35 &&
        this.playerPos.z <= 8.2 &&
        Math.abs(this.playerPos.x - tx) <= 18.4;
      if (onTrainDeck) {
        this.playerPos.x = THREE.MathUtils.clamp(
          this.playerPos.x + res.dx,
          this.station.floorBounds.minX,
          this.station.floorBounds.maxX,
        );
      } else if (
        this.playerPos.z >= 4.3 &&
        this.playerPos.z <= 8.5 &&
        Math.abs(this.playerPos.x - tx) <= 19.3
      ) {
        // Push player safely back onto the platform edge if clipped by the train nose
        this.playerPos.z = 3.65;
        this.playerPos.y = 0;
        if (this.trafficBumperCooldown <= 0) {
          this.trafficBumperCooldown = 0.85;
          this.applyPlayerDamage(12);
        }
      }
    }
  }

  private updateMovingVehicles(dt: number): void {
    for (const v of this.station.movingVehicles) {
      const res = stepMovingVehicle(v.state, dt);
      v.state = res.state;

      if (res.respawned) {
        v.destructible.state.destroyed = false;
        v.destructible.state.hp = v.initialHp;
        v.collider.active = false;
        v.group.visible = true;
        for (const hm of v.destructible.hitMeshes) {
          if (!this.station.interactables.includes(hm)) {
            this.station.interactables.push(hm);
          }
        }
      }

      if (v.state.destroyed) continue;

      v.group.position.x = v.state.x;
      const wheelSpin = v.state.direction === 1 ? res.wheelDeltaAngle : -res.wheelDeltaAngle;
      for (const w of v.wheels) {
        w.rotation.z += wheelSpin;
      }
      v.collider.minX = v.state.x - v.halfLen;
      v.collider.maxX = v.state.x + v.halfLen;
      v.destructible.state.position.x = v.state.x;
    }
  }

  private updateRooftopHelicopter(dt: number): void {
    const heli = this.station.helicopter;
    if (!heli) return;

    heli.state = stepHelicopterLanding(heli.state, dt);
    const s = heli.state;

    heli.group.position.set(
      heli.anchorPos.x + s.offsetX,
      s.altitude,
      heli.anchorPos.z + s.offsetZ,
    );
    heli.group.rotation.order = 'YXZ';
    heli.group.rotation.y = heli.baseYaw;
    heli.group.rotation.z = s.pitch;
    heli.group.rotation.x = s.roll;

    heli.mainRotor.rotation.y = s.mainRotorAngle;
    heli.tailRotor.rotation.z = s.tailRotorAngle;

    const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.008);
    heli.beaconMat.emissiveIntensity = 0.8 + pulse * 2.8;
    heli.searchLight.intensity = s.landed ? 6.0 : 14.0;
    const beamMat = heli.searchBeam.material as THREE.MeshBasicMaterial;
    beamMat.opacity = s.landed ? 0.04 : 0.14;
  }

  private applyHandleShockwave(
    origin: THREE.Vector3,
    radius: number,
    strength: number,
  ): void {
    for (const h of this.station.handles) {
      const dist = h.worldPos.distanceTo(origin);
      if (dist < radius) {
        const factor = (1 - dist / radius) * strength;
        const dx = h.worldPos.x - origin.x;
        const dz = h.worldPos.z - origin.z;
        const len = Math.hypot(dx, dz) || 1;
        h.state.velZ += (dx / len) * factor;
        h.state.velX -= (dz / len) * factor;
      }
    }
  }

  private updatePendulumHandles(dt: number, tremor: number): void {
    const t = performance.now() * 0.001;
    for (let i = 0; i < this.station.handles.length; i++) {
      const h = this.station.handles[i];
      const ambientX = Math.sin(t * 2.8 + i * 0.9) * tremor * 3.5;
      const ambientZ = Math.cos(t * 3.4 + i * 1.3) * tremor * 4.5 + this.trainAccelForce;
      h.state = stepPendulumHandle(h.state, dt, 0, 0, ambientX, ambientZ);
      h.pivot.rotation.x = h.state.angleX;
      h.pivot.rotation.z = h.state.angleZ;
    }
  }

  private updateCeilingLights(dt: number, flickerIntensity: number): void {
    const t = performance.now() * 0.001;
    for (let i = 0; i < this.station.ceilingLights.length; i++) {
      const cl = this.station.ceilingLights[i];
      let lum = 1.0;
      if (flickerIntensity > 0.25 && i % 2 === 1) {
        const wave = Math.sin(t * 19 + i * 3.1) * Math.sin(t * 7.3 + i);
        if (wave > 0.65 - flickerIntensity * 0.4) {
          lum = 0.2;
        }
      }
      cl.mat.emissiveIntensity = THREE.MathUtils.damp(cl.mat.emissiveIntensity, 1.45 * lum, 18, dt);
      if (cl.beamMat) {
        cl.beamMat.opacity = THREE.MathUtils.damp(cl.beamMat.opacity, 0.024 * lum, 18, dt);
      }
      if (cl.light) {
        cl.light.intensity = THREE.MathUtils.damp(cl.light.intensity, 8.5 * lum, 18, dt);
      }
    }

    for (let i = 0; i < this.station.emergencyBeacons.length; i++) {
      const b = this.station.emergencyBeacons[i];
      if ((this.round >= 2 || this.stageClearReady) && this.phase === 'playing') {
        const pulse = 0.5 + 0.5 * Math.sin(t * 7.2 + i * Math.PI);
        b.mat.emissiveIntensity = 0.4 + pulse * 2.4;
        b.light.intensity = 1.5 + pulse * 9.0;
      } else {
        b.mat.emissiveIntensity = 0.15;
        b.light.intensity = 0;
      }
    }
  }

  private damageZombie(
    z: ZombieRig,
    dmg: number,
    dir: THREE.Vector3,
    isHeadshot: boolean,
    sourceWeapon: WeaponId | 'grenade',
    isCore = false,
    showHitFeedback = true,
  ): void {
    z.hp -= dmg;
    z.hitFlashTimer = 0.06;
    if (showHitFeedback) {
      this.hitmarkerTimer = 0.22;
      this.hitmarkerKill = z.hp <= 0;
      this.targetHitTimer = 0.85;
      this.targetHitLabel =
        z.hp <= 0
          ? z.archetype === 'titan'
            ? 'APEX TITAN DEFEATED'
            : isHeadshot
              ? 'HEADSHOT KILL'
              : 'TARGET ELIMINATED'
          : isHeadshot
            ? `HEADSHOT -${Math.round(dmg)}`
            : isCore
              ? `CORE CRIT -${Math.round(dmg)}`
              : `TARGET HIT -${Math.round(dmg)}`;
    }

    z.hitMeshes.forEach((m) => {
      const mat = m.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
      if ('emissive' in mat && mat.emissive) {
        if (m.userData.baseEmissiveHex === undefined) {
          m.userData.baseEmissiveHex = mat.emissive.getHex();
          m.userData.baseEmissiveInt = mat.emissiveIntensity;
        }
        mat.emissive.setHex(0xffffff);
        mat.emissiveIntensity = 0.85;
      }
    });

    const kb = z.archetype === 'titan' ? 0.08 : 0.28;
    z.root.position.x += dir.x * kb;
    z.root.position.z += dir.z * kb;

    if (z.hp <= 0 && z.attackState !== 'ko') {
      z.attackState = 'ko';
      z.stateTimer = 0.45;
      z.hasToken = false;
      z.telegraphRing.visible = false;
      z.koVelocity.set(dir.x * 4.5, 2.2, dir.z * 4.5);
      if (z.archetype === 'titan') {
        this.bossPowerText = '';
        this.bossPowerTimer = 0;
      }

      this.kills += 1;
      this.roundKilled += 1;
      if (isHeadshot) this.headshots += 1;
      const pts =
        (z.archetype === 'titan'
          ? 900
          : z.archetype === 'brute'
            ? 250
            : z.archetype === 'spitter'
              ? 160
              : z.archetype === 'sprinter'
                ? 130
                : 100) + (isHeadshot ? 50 : 0);
      this.score += pts;
      const label =
        z.archetype === 'titan'
          ? 'APEX TITAN'
          : z.archetype === 'brute'
            ? 'Brute'
            : z.archetype === 'spitter'
              ? 'Spitter'
              : z.archetype === 'sprinter'
                ? 'Sprinter'
                : 'Infected';
      const wTag = sourceWeapon === 'grenade' ? 'FRAG' : WEAPON_SPECS[sourceWeapon].shortName;
      this.killFeed.unshift({
        id: ++this.killFeedSeq,
        label: isHeadshot ? `${wTag} · ${label} HEADSHOT` : `${wTag} · ${label}`,
        headshot: isHeadshot || z.archetype === 'titan',
        weapon: sourceWeapon,
        ttl: 3.4,
      });
      if (this.killFeed.length > 4) this.killFeed.length = 4;

      if (this.score > this.bestScore) {
        this.bestScore = this.score;
        try {
          localStorage.setItem(BEST_SCORE_KEY, String(this.bestScore));
        } catch {
          // Ignore
        }
      }
      this.hitstopTimer = Math.max(this.hitstopTimer, 0.032);
    }
  }

  private updateZombies(dt: number, roundCfg: ReturnType<typeof getRoundConfig>): void {
    let activeTokens = 0;
    for (const z of this.zombies) {
      if (z.hasToken && z.attackState !== 'ko') activeTokens++;
    }
    const maxTokens = this.round >= 2 ? 4 : 2;

    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];

      if (z.hitFlashTimer > 0) {
        z.hitFlashTimer -= dt;
        if (z.hitFlashTimer <= 0) {
          z.hitMeshes.forEach((m) => {
            const mat = m.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
            if ('emissive' in mat && mat.emissive && mat.emissive.getHex() === 0xffffff) {
              mat.emissive.setHex((m.userData.baseEmissiveHex as number) ?? 0x000000);
              mat.emissiveIntensity = (m.userData.baseEmissiveInt as number) ?? 0;
            }
          });
        }
      }

      if (z.attackState === 'ko') {
        z.stateTimer -= dt;
        z.root.rotation.x = THREE.MathUtils.lerp(z.root.rotation.x, -Math.PI * 0.48, dt * 9);
        z.root.position.x += z.koVelocity.x * dt;
        z.root.position.z += z.koVelocity.z * dt;
        z.koVelocity.multiplyScalar(0.9);
        z.contactShadow.scale.setScalar(Math.max(0.01, z.stateTimer / 0.45));
        if (z.stateTimer <= 0) {
          this.scene.remove(z.root);
          this.zombies.splice(i, 1);
        }
        continue;
      }

      _v1.subVectors(this.playerPos, z.root.position);
      _v1.y = 0;
      const dist = _v1.length();
      if (dist > 0.001) _v1.divideScalar(dist);

      z.root.rotation.y = Math.atan2(_v1.x, _v1.z);

      // Titan Boss Superpower State Machine
      if (z.archetype === 'titan') {
        if (z.bossDashTimer > 0) {
          z.bossDashTimer -= dt;
          const dashStep = 12.5 * dt;
          const nx = z.root.position.x + z.bossDashDir.x * dashStep;
          const nz = z.root.position.z + z.bossDashDir.z * dashStep;
          const resolved = resolveCircleAabbCollisions(nx, nz, z.radius, this.station.colliders);
          z.root.position.x = resolved.x;
          z.root.position.z = resolved.z;
          z.root.position.y = this.getFloorHeightAt(resolved.x, resolved.z);
          if (dist < 2.2) {
            this.applyPlayerDamage(Math.round(z.damage * 0.75));
            z.bossDashTimer = 0;
          }
          continue;
        }

        if (z.attackState === 'chase') {
          z.bossAbilityCooldown -= dt;
          if (z.bossAbilityCooldown <= 0 && dist < 28.0) {
            const power: 'slam' | 'plasma' | 'dash' =
              dist < 6.8 ? 'slam' : dist > 11.5 ? (Math.random() < 0.6 ? 'plasma' : 'dash') : 'plasma';
            z.bossPowerType = power;
            z.attackState = 'windup';
            z.stateTimer = power === 'slam' ? 0.85 : power === 'plasma' ? 0.65 : 0.55;
            this.bossPowerText =
              power === 'slam'
                ? 'TITAN SUPERPOWER · SEISMIC SLAM'
                : power === 'plasma'
                  ? 'TITAN SUPERPOWER · VOID PLASMA'
                  : 'TITAN SUPERPOWER · HYPER SURGE';
            this.bossPowerTimer = 2.0;
            this.audio.playBossPower(power);
          }
        }
      }

      if (z.archetype === 'spitter' && dist > 5.0 && dist < 22.0) {
        z.rangedCooldown -= dt;
        if (z.attackState === 'chase' && z.rangedCooldown <= 0) {
          z.attackState = 'windup';
          z.stateTimer = 0.55;
          this.audio.playZombieTelegraph(false);
        }
      }

      if (z.attackState === 'windup') {
        z.stateTimer -= dt;
        const ringMat = z.telegraphRing.material as THREE.MeshBasicMaterial;
        ringMat.opacity = 0.88;
        z.telegraphRing.scale.setScalar(
          z.archetype === 'titan' && z.bossPowerType === 'slam'
            ? 1.5 + Math.sin(performance.now() * 0.03) * 0.25
            : 1.0 + Math.sin(performance.now() * 0.025) * 0.14,
        );
        z.leftArm.rotation.x = -2.45;
        z.rightArm.rotation.x = -2.45;
        z.jaw.rotation.x = 0.42;

        if (z.stateTimer <= 0) {
          z.attackState = 'active';
          z.stateTimer = 0.2;
          ringMat.opacity = z.archetype === 'titan' ? 0.35 : 0;

          if (z.archetype === 'titan' && z.bossPowerType !== 'none') {
            if (z.bossPowerType === 'slam') {
              this.spawnShockwave(z.root.position.clone().setY(0.06), 8.8);
              this.trauma = Math.min(1, this.trauma + 0.45);
              this.applyHandleShockwave(z.root.position, 9.0, 14.0);
              if (dist < 8.4 && this.playerPos.y < 0.45) {
                this.applyPlayerDamage(24);
              }
            } else if (z.bossPowerType === 'plasma') {
              this.spawnTitanPlasmaBarrage(z);
            } else if (z.bossPowerType === 'dash') {
              z.bossDashDir.copy(_v1);
              z.bossDashTimer = 0.62;
            }
            z.bossPowerType = 'none';
            z.bossAbilityCooldown = Math.max(2.6, 4.4 - this.round * 0.35);
          } else if (z.archetype === 'spitter' && dist > 3.2) {
            this.spawnAcidProjectile(z);
            z.rangedCooldown = Math.max(2.0, 3.6 - this.round * 0.4);
          } else if (dist < (z.archetype === 'titan' ? 2.9 : 2.25)) {
            this.applyPlayerDamage(z.damage);
          }
        }
      } else if (z.attackState === 'active') {
        z.stateTimer -= dt;
        z.leftArm.rotation.x = -0.3;
        z.rightArm.rotation.x = -0.3;
        z.jaw.rotation.x = 0.35;
        if (z.stateTimer <= 0) {
          z.attackState = 'recover';
          z.stateTimer = 0.45;
          z.hasToken = false;
        }
      } else if (z.attackState === 'recover') {
        z.stateTimer -= dt;
        if (z.stateTimer <= 0) {
          z.attackState = 'chase';
        }
      } else {
        const desiredRange = z.archetype === 'spitter' ? 7.5 : z.archetype === 'titan' ? 2.3 : 1.55;
        if (dist <= (z.archetype === 'titan' ? 2.6 : 1.75) && activeTokens < maxTokens) {
          z.hasToken = true;
          activeTokens++;
          z.attackState = 'windup';
          z.stateTimer = z.archetype === 'brute' || z.archetype === 'titan' ? 0.55 : 0.36;
          this.audio.playZombieTelegraph(z.archetype === 'brute' || z.archetype === 'titan');
        } else if (dist > desiredRange || z.archetype !== 'spitter') {
          let moveX = _v1.x;
          let moveZ = _v1.z;

          if (z.archetype === 'sprinter' && dist > 3.2) {
            const strafe = Math.sin(this.elapsedSeconds * 3.8 + z.walkPhase) * 0.55 * z.flankSign;
            moveX += -_v1.z * strafe;
            moveZ += _v1.x * strafe;
          } else if (z.archetype === 'spitter' && dist < 5.5) {
            moveX = -_v1.x * 0.8;
            moveZ = -_v1.z * 0.8;
          }

          const len = Math.hypot(moveX, moveZ) || 1;
          const step = z.speed * dt;
          const nx = z.root.position.x + (moveX / len) * step;
          const nz = z.root.position.z + (moveZ / len) * step;
          const resolved = resolveCircleAabbCollisions(nx, nz, z.radius, this.station.colliders);
          z.root.position.x = resolved.x;
          z.root.position.z = resolved.z;
          z.root.position.y = this.getFloorHeightAt(resolved.x, resolved.z);

          z.walkPhase += step * 3.4;
          const swing = Math.sin(z.walkPhase) * 0.65;
          z.leftLeg.rotation.x = swing;
          z.rightLeg.rotation.x = -swing;
          z.leftArm.rotation.x = -1.25 + swing * 0.25;
          z.rightArm.rotation.x = -1.25 - swing * 0.25;
          z.torso.rotation.z = Math.sin(z.walkPhase) * 0.06;
          z.head.rotation.z = -Math.sin(z.walkPhase) * 0.09;
          z.jaw.rotation.x = 0.12 + Math.sin(z.walkPhase * 0.85) * 0.09;
        }
      }

      for (let j = i - 1; j >= 0; j--) {
        const o = this.zombies[j];
        if (o.attackState === 'ko') continue;
        const dx = z.root.position.x - o.root.position.x;
        const dz = z.root.position.z - o.root.position.z;
        const minD = z.radius + o.radius;
        const dSq = dx * dx + dz * dz;
        if (dSq > 1e-5 && dSq < minD * minD) {
          const d = Math.sqrt(dSq);
          const push = (minD - d) * 0.5;
          z.root.position.x += (dx / d) * push;
          z.root.position.z += (dz / d) * push;
          o.root.position.x -= (dx / d) * push;
          o.root.position.z -= (dz / d) * push;
        }
      }
      void roundCfg;
    }
  }

  private spawnTitanPlasmaBarrage(z: ZombieRig): void {
    const start = z.root.position.clone().add(new THREE.Vector3(0, 2.35, 0));
    const baseDir = this.playerPos.clone().add(new THREE.Vector3(0, 1.1, 0)).sub(start).normalize();
    [-0.14, 0, 0.14].forEach((yawOffset) => {
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xe879f9 }),
      );
      orb.position.copy(start);
      this.scene.add(orb);
      const dir = baseDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yawOffset);
      this.acidOrbs.push({
        mesh: orb,
        pos: start.clone(),
        vel: dir.multiplyScalar(17.5),
        life: 3.0,
        damage: 20,
        isPlasma: true,
      });
    });
  }

  private spawnShockwave(center: THREE.Vector3, maxRadius: number): void {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xd946ef,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.95, 36), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(center);
    this.scene.add(mesh);
    this.shockwaves.push({
      mesh,
      mat,
      radius: 0.8,
      maxRadius,
      life: 0.55,
      maxLife: 0.55,
    });
  }

  private updateShockwaves(dt: number): void {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        s.mat.dispose();
        this.shockwaves.splice(i, 1);
      } else {
        const progress = 1 - s.life / s.maxLife;
        const scale = 1 + progress * s.maxRadius;
        s.mesh.scale.setScalar(scale);
        s.mat.opacity = (1 - progress) * 0.85;
      }
    }
  }

  private spawnAcidProjectile(z: ZombieRig): void {
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x84cc16 }),
    );
    const start = z.root.position.clone().add(new THREE.Vector3(0, 1.45, 0));
    orb.position.copy(start);
    this.scene.add(orb);

    _v1.subVectors(this.playerPos.clone().add(new THREE.Vector3(0, 1.15, 0)), start).normalize();
    this.acidOrbs.push({
      mesh: orb,
      pos: start,
      vel: _v1.clone().multiplyScalar(14),
      life: 2.6,
      damage: z.damage,
    });
  }

  private updateAcidProjectiles(dt: number): void {
    for (let i = this.acidOrbs.length - 1; i >= 0; i--) {
      const o = this.acidOrbs[i];
      o.life -= dt;
      o.pos.addScaledVector(o.vel, dt);
      o.mesh.position.copy(o.pos);

      const distToPlayer = _v1.set(this.playerPos.x, this.playerPos.y + 1.1, this.playerPos.z).distanceTo(o.pos);
      if (distToPlayer < (o.isPlasma ? 0.88 : 0.72)) {
        this.applyPlayerDamage(o.damage);
        this.spawnParticleBurst(o.pos, o.isPlasma ? 0xd946ef : 0x84cc16, 10, 4.5);
        this.scene.remove(o.mesh);
        this.acidOrbs.splice(i, 1);
      } else if (o.life <= 0 || o.pos.y < -1.0) {
        this.scene.remove(o.mesh);
        this.acidOrbs.splice(i, 1);
      }
    }
  }

  private applyPlayerDamage(amount: number): void {
    if (this.phase !== 'playing') return;
    this.hp = Math.max(0, this.hp - amount);
    this.damageFlashTimer = 0.28;
    this.trauma = Math.min(1, this.trauma + 0.45);
    this.audio.playPlayerHurt();

    if (this.hp <= 0) {
      this.victory = false;
      this.audio.setAmbienceActive(false);
      this.exitPointerLockSafe();
      this.syncBodyState('gameover');
    }
    this.emitHudSnapshot();
  }

  private updatePickups(dt: number): void {
    const t = performance.now() * 0.002;
    for (const p of this.pickups) {
      if (!p.active) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.active = true;
          p.mesh.visible = true;
        }
        continue;
      }
      p.mesh.rotation.y = t;
      p.mesh.position.y = p.pos.y + Math.sin(t * 1.8) * 0.08;

      const dist = Math.hypot(this.playerPos.x - p.pos.x, this.playerPos.z - p.pos.z);
      if (dist < 1.35) {
        if (p.kind === 'health' && this.hp < this.maxHp) {
          this.hp = Math.min(this.maxHp, this.hp + 35);
          p.active = false;
          p.mesh.visible = false;
          p.respawnTimer = 18;
          this.audio.playPickup();
          this.emitHudSnapshot();
        } else if (p.kind === 'ammo') {
          this.replenishAllAmmo(0.35);
          this.grenades = Math.min(this.maxGrenades, this.grenades + 1);
          p.active = false;
          p.mesh.visible = false;
          p.respawnTimer = 18;
          this.audio.playPickup();
          this.emitHudSnapshot();
        }
      }
    }
  }

  private updateRoundProgression(dt: number, roundCfg: ReturnType<typeof getRoundConfig>): void {
    this.stageElapsed += dt;
    const targetDuration = this.stageDurationOverride ?? (roundCfg.durationSeconds || STAGE_DURATION_SECONDS);
    const nextWave = computeStageWave(this.stageElapsed);
    if (nextWave > this.stageWave) {
      this.stageWave = nextWave;
      if (!this.stageClearReady) {
        this.roundBannerTimer = 2.6;
        this.roundBannerText = `WAVE ${this.stageWave} · INFECTED REINFORCEMENTS INBOUND`;
        this.audio.playRoundAlert(true);
      }
    }

    if (shouldUnlockSectorExit(this.stageElapsed, targetDuration)) {
      if (this.round >= 4) {
        this.victory = true;
        this.audio.setAmbienceActive(false);
        this.exitPointerLockSafe();
        this.syncBodyState('gameover');
        this.emitHudSnapshot();
        return;
      }

      if (!this.stageClearReady) {
        this.stageClearReady = true;
        this.station.extractionRing.visible = true;
        this.station.extractionBeam.visible = true;
        this.station.extractionLight.intensity = 10;
        this.roundBannerTimer = 3.5;
        this.roundBannerText = `15:00 SECTOR COMPLETE · REACH ${roundCfg.extractionLabel.toUpperCase()} OR PRESS [E]`;
        this.audio.playRoundAlert(false);
        this.emitHudSnapshot();
      }

      const distToExit = Math.hypot(
        this.playerPos.x - this.station.extractionSpot.x,
        this.playerPos.z - this.station.extractionSpot.z,
      );
      if (distToExit < 2.6) {
        this.advanceToNextStage();
      }
      return;
    }

    const activeBoss = this.zombies.some(
      (z) => z.archetype === 'titan' && z.attackState !== 'ko',
    );
    const aliveCount = this.zombies.filter((z) => z.attackState !== 'ko').length;
    const waveCap = Math.min(12, roundCfg.maxConcurrent + Math.floor((this.stageWave - 1) / 2));

    if (aliveCount < waveCap) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        if (shouldSpawnTimedBoss(this.stageElapsed, this.lastBossElapsed, activeBoss, targetDuration)) {
          this.bossSpawnedThisStage = false;
          this.lastBossElapsed = this.stageElapsed;
          this.spawnStageBoss();
        } else {
          this.spawnZombie(roundCfg);
          this.roundSpawned += 1;
        }
        this.spawnTimer = Math.max(0.75, roundCfg.spawnInterval - (this.stageWave - 1) * 0.04);
      }
    }
  }

  public spawnStageBoss(): void {
    if (this.bossSpawnedThisStage) return;
    this.bossSpawnedThisStage = true;
    this.lastBossElapsed = this.stageElapsed;
    const roundCfg = getRoundConfig(this.round);
    const rig = buildZombieModel(
      `boss_${++this.zombieSeq}`,
      'titan',
      this.textures.contactShadowMap,
      roundCfg.hpMultiplier,
      roundCfg.speedMultiplier,
      roundCfg.damageMultiplier,
    );
    const candidates = this.station.spawnPoints.filter(
      (sp) => sp.distanceTo(this.playerPos) > 10.0,
    );
    const chosen =
      candidates[Math.floor(Math.random() * candidates.length)] ||
      this.station.spawnPoints[0];
    rig.root.position.copy(chosen);
    this.scene.add(rig.root);
    this.zombies.push(rig);
    this.roundSpawned += 1;
    this.roundBannerTimer = 3.2;
    this.roundBannerText = '⚠ APEX OVERLORD TITAN INBOUND — SUPERPOWER THREAT!';
    this.audio.playBossSpawn();
    this.emitHudSnapshot();
  }

  private spawnZombie(roundCfg: ReturnType<typeof getRoundConfig>): void {
    const archetype = pickArchetypeForRound(this.round, Math.random());
    const rig = buildZombieModel(
      `z_${++this.zombieSeq}`,
      archetype,
      this.textures.contactShadowMap,
      roundCfg.hpMultiplier,
      roundCfg.speedMultiplier,
      roundCfg.damageMultiplier,
    );

    const candidates = this.station.spawnPoints.filter(
      (sp) => sp.distanceTo(this.playerPos) > 9.0,
    );
    const chosen =
      candidates[Math.floor(Math.random() * candidates.length)] ||
      this.station.spawnPoints[0];

    rig.root.position.copy(chosen);
    this.scene.add(rig.root);
    this.zombies.push(rig);
  }

  private placeBulletDecal(
    point: THREE.Vector3,
    normal: THREE.Vector3,
    material: Exclude<SurfaceMaterial, 'flesh'>,
  ): void {
    const decal = this.decals[this.decalCursor];
    this.decalCursor = (this.decalCursor + 1) % this.decals.length;

    decal.mat.map = this.textures.bulletHoleMaps[material];
    decal.mat.needsUpdate = true;

    decal.mesh.position.copy(point).addScaledVector(normal, 0.014);
    _quat.setFromUnitVectors(_up, normal);
    decal.mesh.quaternion.copy(_quat);
    decal.mesh.rotateZ(Math.random() * Math.PI * 2);
    decal.mesh.scale.setScalar(material === 'glass' ? 1.45 : 1.0);
    decal.mesh.visible = true;
  }

  private placeScorchDecal(point: THREE.Vector3, normal: THREE.Vector3): void {
    const decal = this.decals[this.decalCursor];
    this.decalCursor = (this.decalCursor + 1) % this.decals.length;

    decal.mat.map = this.textures.scorchDecalMap;
    decal.mat.needsUpdate = true;

    decal.mesh.position.copy(point).addScaledVector(normal, 0.018);
    _quat.setFromUnitVectors(_up, normal);
    decal.mesh.quaternion.copy(_quat);
    decal.mesh.scale.setScalar(11.0);
    decal.mesh.visible = true;
  }

  private spawnParticleBurst(
    origin: THREE.Vector3,
    hexColor: number,
    count: number,
    speed: number,
  ): void {
    for (let i = 0; i < count; i++) {
      this.spawnSingleParticle(
        origin,
        (Math.random() - 0.5) * speed * 2,
        Math.random() * speed * 1.1 + 1.0,
        (Math.random() - 0.5) * speed * 2,
        hexColor,
        0.18 + Math.random() * 0.14,
        0.45 + Math.random() * 0.25,
        14,
      );
    }
  }

  private spawnSingleParticle(
    origin: THREE.Vector3,
    vx: number,
    vy: number,
    vz: number,
    hexColor: number,
    scale: number,
    maxLife: number,
    gravity: number,
  ): void {
    for (let i = 0; i < this.particleCount; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.pos.copy(origin);
        p.vel.set(vx, vy, vz);
        p.rot.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        p.rotVel.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
        p.scale = scale;
        p.life = maxLife;
        p.maxLife = maxLife;
        p.gravity = gravity;
        p.color.setHex(hexColor);
        return;
      }
    }
  }

  private updateParticles(dt: number): void {
    let anyUpdated = false;
    for (let i = 0; i < this.particleCount; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyUpdated = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _mat4.makeScale(0, 0, 0);
        this.particleMesh.setMatrixAt(i, _mat4);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < -0.9 && p.vel.y < 0) {
        p.pos.y = -0.9;
        p.vel.y *= -0.35;
        p.vel.x *= 0.6;
        p.vel.z *= 0.6;
      }
      p.rot.x += p.rotVel.x * dt;
      p.rot.y += p.rotVel.y * dt;

      const s = p.scale * Math.min(1, (p.life / p.maxLife) * 1.4);
      _quat.setFromEuler(p.rot);
      _v1.set(s, s, s);
      _mat4.compose(p.pos, _quat, _v1);
      this.particleMesh.setMatrixAt(i, _mat4);
      this.particleMesh.setColorAt(i, p.color);
    }

    if (anyUpdated) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) {
        this.particleMesh.instanceColor.needsUpdate = true;
      }
    }
  }

  private updateTracers(dt: number): void {
    for (let i = 0; i < this.tracers.length; i++) {
      const tr = this.tracers[i];
      if (tr.life <= 0) continue;
      tr.life -= dt;
      if (tr.life <= 0) {
        tr.mesh.visible = false;
      } else {
        tr.mat.opacity = (tr.life / tr.maxLife) * 0.85;
      }
    }
  }

  private updateDustMotes(dt: number): void {
    const posAttr = this.dustPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < this.dustCount; i++) {
      const idx = i * 3;
      arr[idx] += Math.sin(this.elapsedSeconds * 0.6 + i) * 0.08 * dt;
      arr[idx + 1] += 0.06 * dt;
      if (arr[idx + 1] > 4.6) arr[idx + 1] = 0.25;
    }
    posAttr.needsUpdate = true;
  }

  private updateCameraAndViewmodel(dt: number): void {
    this.recoilPitch = THREE.MathUtils.damp(this.recoilPitch, 0, 14, dt);
    this.weaponKickZ = THREE.MathUtils.damp(this.weaponKickZ, 0, 14, dt);
    this.swayX = THREE.MathUtils.damp(this.swayX, 0, 10, dt);
    this.swayY = THREE.MathUtils.damp(this.swayY, 0, 10, dt);

    this.flashlight.intensity = this.flashlightOn ? 22 : 0;

    const targetFov = getTargetFov(
      this.activeWeapon,
      this.isAds,
      this.aimSettings.baseFov,
      this.zoomTier,
    );
    const nextFov = THREE.MathUtils.damp(this.camera.fov, targetFov, 15, dt);
    if (Math.abs(nextFov - this.camera.fov) > 0.02) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }

    const bobAmp = this.isAds ? 0.2 : 1.0;
    const bobY = Math.sin(this.walkDistance * 2.1) * 0.03 * bobAmp;
    const bobX = Math.cos(this.walkDistance * 1.05) * 0.02 * bobAmp;

    const shake = this.isAds ? 0 : this.trauma * this.trauma;
    const shakeYaw = (Math.random() - 0.5) * shake * 0.05;
    const shakePitch = (Math.random() - 0.5) * shake * 0.05;

    this.camera.position.set(
      this.playerPos.x,
      this.playerPos.y + this.eyeHeight + bobY,
      this.playerPos.z,
    );
    this.camera.rotation.y = this.playerYaw + shakeYaw;
    this.camera.rotation.x = THREE.MathUtils.clamp(
      this.playerPitch + this.recoilPitch + shakePitch,
      -1.35,
      1.35,
    );

    const activeState = this.weapons[this.activeWeapon];
    const reloadDip = activeState.isReloading ? -0.14 : 0;
    const reloadRot = activeState.isReloading ? -0.45 : 0;

    let targetX = 0.24 + bobX * 0.6 + this.swayX;
    let targetY = -0.22 + bobY * 0.5 + reloadDip + this.swayY;
    let targetZ = -0.44 + this.weaponKickZ;

    if (this.isAds) {
      if (this.activeWeapon === 'pistol') {
        targetX = 0.0;
        targetY = -0.042 + bobY * 0.12 + this.swayY * 0.2;
        targetZ = -0.24 + this.weaponKickZ * 0.35;
      } else if (this.activeWeapon === 'smg') {
        targetX = 0.0;
        targetY = -0.075 + bobY * 0.14 + this.swayY * 0.2;
        targetZ = -0.2 + this.weaponKickZ * 0.35;
      } else if (this.activeWeapon === 'carbine') {
        targetX = 0.0;
        targetY = -0.079 + bobY * 0.14 + this.swayY * 0.2;
        targetZ = -0.19 + this.weaponKickZ * 0.35;
      } else if (this.activeWeapon === 'lmg') {
        targetX = 0.0;
        targetY = -0.079 + bobY * 0.14 + this.swayY * 0.2;
        targetZ = -0.22 + this.weaponKickZ * 0.35;
      } else if (this.activeWeapon === 'shotgun') {
        targetX = 0.0;
        targetY = -0.046 + bobY * 0.14 + this.swayY * 0.2;
        targetZ = -0.24 + this.weaponKickZ * 0.35;
      } else {
        targetX = 0.052;
        targetY = -0.115 + bobY * 0.2;
        targetZ = -0.3 + this.weaponKickZ * 0.35;
      }
    }

    this.viewmodel.root.position.set(
      THREE.MathUtils.damp(this.viewmodel.root.position.x, targetX, 15, dt),
      THREE.MathUtils.damp(this.viewmodel.root.position.y, targetY, 15, dt),
      THREE.MathUtils.damp(this.viewmodel.root.position.z, targetZ, 15, dt),
    );

    this.viewmodel.root.rotation.x = THREE.MathUtils.damp(
      this.viewmodel.root.rotation.x,
      this.recoilPitch * 0.85 + reloadRot,
      13,
      dt,
    );
    this.viewmodel.root.rotation.y = THREE.MathUtils.damp(
      this.viewmodel.root.rotation.y,
      this.isSprinting ? 0.52 : 0,
      11,
      dt,
    );
    this.viewmodel.root.rotation.z = THREE.MathUtils.damp(
      this.viewmodel.root.rotation.z,
      (this.isSprinting ? 0.16 : 0) - this.moveRightInput * 0.03,
      11,
      dt,
    );

    if (this.shotgunPumpTimer > 0) {
      const progress = 1 - this.shotgunPumpTimer / 0.36;
      const rackOffset = Math.sin(progress * Math.PI) * 0.095;
      this.viewmodel.shotgunPump.position.z = -0.27 + rackOffset;
    } else {
      this.viewmodel.shotgunPump.position.z = -0.27;
    }
  }

  private emitHudSnapshot(): void {
    const cfg = getRoundConfig(this.round);
    const destroyedCount = this.station.destructibles.filter((d) => d.state.destroyed).length;
    const totalDest = this.station.destructibles.length;
    const weaponsClone = {} as Record<WeaponId, WeaponRuntimeState>;
    for (const wid of WEAPON_ORDER) {
      weaponsClone[wid] = { ...this.weapons[wid] };
    }
    const extDist = Math.round(
      Math.hypot(
        this.playerPos.x - this.station.extractionSpot.x,
        this.playerPos.z - this.station.extractionSpot.z,
      ),
    );

    const activeBoss = this.zombies.find(
      (z) => z.archetype === 'titan' && z.attackState !== 'ko',
    );

    const targetDuration = this.stageDurationOverride ?? (cfg.durationSeconds || STAGE_DURATION_SECONDS);
    const timeRemaining = Math.max(0, targetDuration - this.stageElapsed);

    this.onHudUpdate({
      phase: this.phase,
      victory: this.victory,
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      ghostHp: Math.round(this.ghostHp),
      score: Math.round(this.score),
      bestScore: Math.round(this.bestScore),
      kills: this.kills,
      headshots: this.headshots,
      round: this.round,
      totalRounds: 4,
      stageName: cfg.stageName,
      roundTitle: cfg.title,
      roundEnemiesRemaining: Math.max(0, cfg.totalEnemies - this.roundKilled),
      stageTimeRemaining: timeRemaining,
      stageDurationSeconds: targetDuration,
      stageWave: this.stageWave,
      stageClearReady: this.stageClearReady,
      extractionPrompt: this.stageClearReady ? `Reach ${cfg.extractionLabel} [E]` : '',
      extractionDistance: extDist,
      roundBannerTimer: this.roundBannerTimer,
      roundBannerText: this.roundBannerText,
      destructionPercent: totalDest > 0 ? Math.round((destroyedCount / totalDest) * 100) : 0,
      destroyedCount,
      totalDestructibleCount: totalDest,
      activeWeapon: this.activeWeapon,
      weapons: weaponsClone,
      grenades: this.grenades,
      maxGrenades: this.maxGrenades,
      hitmarkerTimer: this.hitmarkerTimer,
      hitmarkerKill: this.hitmarkerKill,
      targetHitTimer: this.targetHitTimer,
      targetHitLabel: this.targetHitLabel,
      damageFlashTimer: this.damageFlashTimer,
      pointerLocked: this.pointerLocked,
      muted: this.audio.isMuted(),
      elapsedSeconds: Math.round(this.elapsedSeconds),
      isAds: this.isAds,
      isScoped: this.activeWeapon === 'sniper' && this.isAds,
      zoomTier: this.zoomTier,
      flashlightOn: this.flashlightOn,
      isSprinting: this.isSprinting,
      killFeed: this.killFeed.map(({ id, label, headshot, weapon }) => ({
        id,
        label,
        headshot,
        weapon,
      })),
      aimSettings: { ...this.aimSettings },
      startStage: this.startStage,
      bossActive: Boolean(activeBoss),
      bossName: activeBoss ? 'APEX OVERLORD TITAN' : '',
      bossHp: activeBoss ? Math.max(0, Math.round(activeBoss.hp)) : 0,
      bossMaxHp: activeBoss ? Math.round(activeBoss.maxHp) : 1,
      bossPowerText: activeBoss ? this.bossPowerText : '',
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResizeBound);
    window.removeEventListener('keydown', this.handleKeyDownBound);
    window.removeEventListener('keyup', this.handleKeyUpBound);
    window.removeEventListener('blur', this.handleBlurBound);
    document.removeEventListener('visibilitychange', this.handleVisibilityChangeBound);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChangeBound);

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('mousedown', this.handleMouseDownBound);
    canvas.removeEventListener('contextmenu', this.handleContextMenuBound);
    window.removeEventListener('mouseup', this.handleMouseUpBound);
    window.removeEventListener('mousemove', this.handleMouseMoveBound);
    canvas.removeEventListener('wheel', this.handleWheelBound);

    this.exitPointerLockSafe();
    this.audio.dispose();
    this.textures.dispose();
    this.decalGeo.dispose();
    this.tracerGeo.dispose();
    this.dustPoints.geometry.dispose();
    (this.dustPoints.material as THREE.Material).dispose();
    this.composer?.dispose();
    this.renderer.dispose();
    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
