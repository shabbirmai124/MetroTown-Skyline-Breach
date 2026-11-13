// Created by Md Shabbir Mia
export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type WeaponId =
  | 'pistol'
  | 'smg'
  | 'carbine'
  | 'sniper'
  | 'shotgun'
  | 'lmg'
  | 'rpg';

export type StageId = 1 | 2 | 3 | 4;

export type CrosshairColor = 'cyan' | 'green' | 'amber' | 'white';

export type SurfaceMaterial =
  | 'concrete'
  | 'tile'
  | 'metal'
  | 'glass'
  | 'wood'
  | 'flesh';

export type ZombieArchetype = 'shambler' | 'sprinter' | 'brute' | 'spitter' | 'titan';

export interface AimSettings {
  sensitivity: number; // 0.2 to 2.0 (1.0 = default tactical baseline)
  adsMultiplier: number; // 0.35 to 1.15
  baseFov: number; // 65 to 95
  crosshairColor: CrosshairColor;
  smoothAimAssist: boolean;
}

export interface WeaponSpec {
  id: WeaponId;
  slot: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  shortName: string;
  name: string;
  role: string;
  damage: number;
  pellets: number;
  spreadRad: number;
  fireCooldown: number;
  reloadDuration: number;
  magSize: number;
  maxReserve: number;
  isProjectile: boolean;
  splashRadius: number;
  splashDamage: number;
  automatic: boolean;
  recoilKick: number;
  adsFov: number;
  zoomFov?: number;
}

export interface WeaponRuntimeState {
  id: WeaponId;
  mag: number;
  reserve: number;
  cooldownTimer: number;
  reloadTimer: number;
  isReloading: boolean;
}

export interface RoundConfig {
  round: StageId;
  stageName: string;
  title: string;
  subtitle: string;
  extractionLabel: string;
  durationSeconds: number;
  totalEnemies: number;
  maxConcurrent: number;
  spawnInterval: number;
  speedMultiplier: number;
  damageMultiplier: number;
  hpMultiplier: number;
  flickerIntensity: number;
  trainTremor: number;
  weights: Record<ZombieArchetype, number>;
}

export interface Aabb2D {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  active: boolean;
}

export interface DestructibleState {
  id: string;
  category:
    | 'train_panel'
    | 'train_window'
    | 'train_door'
    | 'pillar'
    | 'kiosk'
    | 'bench'
    | 'barrel'
    | 'vehicle'
    | 'crate'
    | 'glass_partition'
    | 'hvac';
  material: SurfaceMaterial;
  hp: number;
  maxHp: number;
  destroyed: boolean;
  explosive: boolean;
  position: { x: number; y: number; z: number };
  colliderId?: string;
}

export interface PendulumState {
  angleX: number;
  angleZ: number;
  velX: number;
  velZ: number;
}

export interface KillFeedEntry {
  id: number;
  label: string;
  headshot: boolean;
  weapon: WeaponId | 'grenade';
}

export interface HudSnapshot {
  phase: GamePhase;
  victory: boolean;
  hp: number;
  maxHp: number;
  ghostHp: number;
  score: number;
  bestScore: number;
  kills: number;
  headshots: number;
  round: StageId;
  totalRounds: number;
  stageName: string;
  roundTitle: string;
  roundEnemiesRemaining: number;
  stageTimeRemaining: number;
  stageDurationSeconds: number;
  stageWave: number;
  stageClearReady: boolean;
  extractionPrompt: string;
  extractionDistance: number;
  roundBannerTimer: number;
  roundBannerText: string;
  destructionPercent: number;
  destroyedCount: number;
  totalDestructibleCount: number;
  activeWeapon: WeaponId;
  weapons: Record<WeaponId, WeaponRuntimeState>;
  grenades: number;
  maxGrenades: number;
  hitmarkerTimer: number;
  hitmarkerKill: boolean;
  targetHitTimer: number;
  targetHitLabel: string;
  damageFlashTimer: number;
  pointerLocked: boolean;
  muted: boolean;
  elapsedSeconds: number;
  isAds: boolean;
  isScoped: boolean;
  zoomTier: 1 | 2;
  flashlightOn: boolean;
  isSprinting: boolean;
  killFeed: KillFeedEntry[];
  aimSettings: AimSettings;
  startStage: StageId;
  bossActive: boolean;
  bossName: string;
  bossHp: number;
  bossMaxHp: number;
  bossPowerText: string;
}
