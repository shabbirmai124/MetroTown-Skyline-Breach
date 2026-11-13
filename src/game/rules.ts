// Created by Md Shabbir Mia
import {
  Aabb2D,
  AimSettings,
  DestructibleState,
  PendulumState,
  RoundConfig,
  StageId,
  WeaponId,
  WeaponRuntimeState,
  WeaponSpec,
  ZombieArchetype,
} from './types';

export const WEAPON_ORDER: WeaponId[] = [
  'pistol',
  'smg',
  'carbine',
  'sniper',
  'shotgun',
  'lmg',
  'rpg',
];

export const DEFAULT_AIM_SETTINGS: AimSettings = {
  sensitivity: 0.78,
  adsMultiplier: 0.72,
  baseFov: 74,
  crosshairColor: 'cyan',
  smoothAimAssist: true,
};

export const WEAPON_SPECS: Record<WeaponId, WeaponSpec> = {
  pistol: {
    id: 'pistol',
    slot: 1,
    shortName: 'USP-45',
    name: 'USP-45 Tactical',
    role: 'Precision Sidearm',
    damage: 34,
    pellets: 1,
    spreadRad: 0.007,
    fireCooldown: 0.16,
    reloadDuration: 1.0,
    magSize: 12,
    maxReserve: 96,
    isProjectile: false,
    splashRadius: 0,
    splashDamage: 0,
    automatic: false,
    recoilKick: 0.018,
    adsFov: 56,
  },
  smg: {
    id: 'smg',
    slot: 2,
    shortName: 'MP7',
    name: 'MP7 Vector SMG',
    role: 'Rapid CQB',
    damage: 21,
    pellets: 1,
    spreadRad: 0.017,
    fireCooldown: 0.075,
    reloadDuration: 1.25,
    magSize: 32,
    maxReserve: 224,
    isProjectile: false,
    splashRadius: 0,
    splashDamage: 0,
    automatic: true,
    recoilKick: 0.015,
    adsFov: 54,
  },
  carbine: {
    id: 'carbine',
    slot: 3,
    shortName: 'M4A1',
    name: 'M4A1 Phantom Rifle',
    role: 'Tactical Rifle',
    damage: 30,
    pellets: 1,
    spreadRad: 0.009,
    fireCooldown: 0.105,
    reloadDuration: 1.35,
    magSize: 30,
    maxReserve: 180,
    isProjectile: false,
    splashRadius: 0,
    splashDamage: 0,
    automatic: true,
    recoilKick: 0.022,
    adsFov: 50,
  },
  sniper: {
    id: 'sniper',
    slot: 4,
    shortName: 'Operator',
    name: 'Operator .50 Sniper',
    role: 'Dual-Zoom Scope',
    damage: 145,
    pellets: 1,
    spreadRad: 0.001,
    fireCooldown: 0.92,
    reloadDuration: 1.85,
    magSize: 5,
    maxReserve: 25,
    isProjectile: false,
    splashRadius: 0,
    splashDamage: 0,
    automatic: false,
    recoilKick: 0.095,
    adsFov: 38,
    zoomFov: 22,
  },
  shotgun: {
    id: 'shotgun',
    slot: 5,
    shortName: 'M870',
    name: 'M870 Breacher',
    role: 'Close Spread',
    damage: 20,
    pellets: 7,
    spreadRad: 0.062,
    fireCooldown: 0.72,
    reloadDuration: 1.65,
    magSize: 8,
    maxReserve: 48,
    isProjectile: false,
    splashRadius: 0,
    splashDamage: 0,
    automatic: false,
    recoilKick: 0.07,
    adsFov: 56,
  },
  lmg: {
    id: 'lmg',
    slot: 6,
    shortName: 'M249',
    name: 'M249 Heavy LMG',
    role: 'Squad Suppression',
    damage: 26,
    pellets: 1,
    spreadRad: 0.015,
    fireCooldown: 0.088,
    reloadDuration: 2.2,
    magSize: 75,
    maxReserve: 225,
    isProjectile: false,
    splashRadius: 0,
    splashDamage: 0,
    automatic: true,
    recoilKick: 0.021,
    adsFov: 52,
  },
  rpg: {
    id: 'rpg',
    slot: 7,
    shortName: 'RPG-7',
    name: 'RPG-7V2 Launcher',
    role: 'Heavy Demolition',
    damage: 280,
    pellets: 1,
    spreadRad: 0.003,
    fireCooldown: 1.15,
    reloadDuration: 1.9,
    magSize: 1,
    maxReserve: 12,
    isProjectile: true,
    splashRadius: 6.4,
    splashDamage: 255,
    automatic: false,
    recoilKick: 0.135,
    adsFov: 58,
  },
};

export const STAGE_DURATION_SECONDS = 900; // 15 minutes per scenario

export const ROUND_CONFIGS: RoundConfig[] = [
  {
    round: 1,
    stageName: 'Subway Station',
    title: '14th St. Metro',
    subtitle: 'Hold the metro platform for 15:00 & reach the street stairwell',
    extractionLabel: 'Stairwell Exit to Town Boulevard',
    durationSeconds: STAGE_DURATION_SECONDS,
    totalEnemies: 10,
    maxConcurrent: 5,
    spawnInterval: 1.9,
    speedMultiplier: 1.0,
    damageMultiplier: 1.0,
    hpMultiplier: 1.0,
    flickerIntensity: 0.2,
    trainTremor: 0.1,
    weights: {
      shambler: 0.65,
      sprinter: 0.3,
      brute: 0.05,
      spitter: 0,
      titan: 0,
    },
  },
  {
    round: 2,
    stageName: 'Outside Road',
    title: 'Midtown Town Boulevard',
    subtitle: 'Hold the 4-lane town avenue for 15:00 toward Meridian Tower',
    extractionLabel: 'Tower Lobby Entrance',
    durationSeconds: STAGE_DURATION_SECONDS,
    totalEnemies: 14,
    maxConcurrent: 7,
    spawnInterval: 1.4,
    speedMultiplier: 1.22,
    damageMultiplier: 1.15,
    hpMultiplier: 1.15,
    flickerIntensity: 0.35,
    trainTremor: 0.25,
    weights: {
      shambler: 0.35,
      sprinter: 0.42,
      brute: 0.11,
      spitter: 0.12,
      titan: 0,
    },
  },
  {
    round: 3,
    stageName: 'Inside Building',
    title: 'Meridian Tower Lobby',
    subtitle: 'Defend Meridian Tower lobby for 15:00 to unlock roof access',
    extractionLabel: 'Roof Access Stairwell',
    durationSeconds: STAGE_DURATION_SECONDS,
    totalEnemies: 16,
    maxConcurrent: 8,
    spawnInterval: 1.25,
    speedMultiplier: 1.32,
    damageMultiplier: 1.22,
    hpMultiplier: 1.24,
    flickerIntensity: 0.45,
    trainTremor: 0.3,
    weights: {
      shambler: 0.25,
      sprinter: 0.42,
      brute: 0.17,
      spitter: 0.16,
      titan: 0,
    },
  },
  {
    round: 4,
    stageName: 'Building Roof',
    title: 'Skyline Helipad',
    subtitle: 'Survive 15:00 atop Skyline Helipad until final extraction',
    extractionLabel: 'Helipad Extraction Zone',
    durationSeconds: STAGE_DURATION_SECONDS,
    totalEnemies: 18,
    maxConcurrent: 9,
    spawnInterval: 1.1,
    speedMultiplier: 1.42,
    damageMultiplier: 1.3,
    hpMultiplier: 1.32,
    flickerIntensity: 0.5,
    trainTremor: 0.4,
    weights: {
      shambler: 0.2,
      sprinter: 0.4,
      brute: 0.22,
      spitter: 0.18,
      titan: 0,
    },
  },
];

export function shouldUnlockSectorExit(
  stageElapsed: number,
  stageDuration: number,
): boolean {
  return stageElapsed >= stageDuration;
}

export function computeStageWave(stageElapsed: number): number {
  return Math.max(1, Math.floor(Math.max(0, stageElapsed) / 60) + 1);
}

export function shouldSpawnTimedBoss(
  stageElapsed: number,
  lastBossElapsed: number,
  hasActiveBoss: boolean,
  stageDuration: number,
): boolean {
  if (hasActiveBoss) return false;
  if (stageDuration - stageElapsed < 15 && stageDuration >= 60) return false;
  const firstTrigger = Math.min(40, stageDuration * 0.35);
  if (lastBossElapsed < 0) {
    return stageElapsed >= firstTrigger;
  }
  return stageElapsed - lastBossElapsed >= 180;
}

export function formatSectorTimer(secondsRemaining: number): string {
  const clamped = Math.max(0, Math.ceil(secondsRemaining));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function shouldSpawnStageBoss(
  round: StageId | number,
  roundKilled: number,
  roundSpawned: number,
  bossSpawnedThisStage: boolean,
): boolean {
  if (bossSpawnedThisStage) return false;
  const cfg = getRoundConfig(round);
  if (roundSpawned >= cfg.totalEnemies) return false;
  const triggerKills = Math.max(3, Math.floor(cfg.totalEnemies * 0.45));
  return roundKilled >= triggerKills || roundSpawned === cfg.totalEnemies - 1;
}

export function getRoundConfig(round: number): RoundConfig {
  const index = Math.max(0, Math.min(ROUND_CONFIGS.length - 1, round - 1));
  return ROUND_CONFIGS[index];
}

export function createInitialWeapons(): Record<WeaponId, WeaponRuntimeState> {
  return {
    pistol: {
      id: 'pistol',
      mag: WEAPON_SPECS.pistol.magSize,
      reserve: 72,
      cooldownTimer: 0,
      reloadTimer: 0,
      isReloading: false,
    },
    smg: {
      id: 'smg',
      mag: WEAPON_SPECS.smg.magSize,
      reserve: 160,
      cooldownTimer: 0,
      reloadTimer: 0,
      isReloading: false,
    },
    carbine: {
      id: 'carbine',
      mag: WEAPON_SPECS.carbine.magSize,
      reserve: 120,
      cooldownTimer: 0,
      reloadTimer: 0,
      isReloading: false,
    },
    sniper: {
      id: 'sniper',
      mag: WEAPON_SPECS.sniper.magSize,
      reserve: 20,
      cooldownTimer: 0,
      reloadTimer: 0,
      isReloading: false,
    },
    shotgun: {
      id: 'shotgun',
      mag: WEAPON_SPECS.shotgun.magSize,
      reserve: 32,
      cooldownTimer: 0,
      reloadTimer: 0,
      isReloading: false,
    },
    lmg: {
      id: 'lmg',
      mag: WEAPON_SPECS.lmg.magSize,
      reserve: 150,
      cooldownTimer: 0,
      reloadTimer: 0,
      isReloading: false,
    },
    rpg: {
      id: 'rpg',
      mag: WEAPON_SPECS.rpg.magSize,
      reserve: 8,
      cooldownTimer: 0,
      reloadTimer: 0,
      isReloading: false,
    },
  };
}

export function stepWeaponTimers(
  weapon: WeaponRuntimeState,
  spec: WeaponSpec,
  dt: number,
): boolean {
  let completedReload = false;
  if (weapon.cooldownTimer > 0) {
    weapon.cooldownTimer = Math.max(0, weapon.cooldownTimer - dt);
  }
  if (weapon.isReloading) {
    weapon.reloadTimer -= dt;
    if (weapon.reloadTimer <= 0) {
      const needed = spec.magSize - weapon.mag;
      const transfer = Math.min(needed, weapon.reserve);
      weapon.mag += transfer;
      weapon.reserve -= transfer;
      weapon.isReloading = false;
      weapon.reloadTimer = 0;
      completedReload = true;
    }
  }
  return completedReload;
}

export function tryStartReload(
  weapon: WeaponRuntimeState,
  spec: WeaponSpec,
): boolean {
  if (weapon.isReloading) return false;
  if (weapon.mag >= spec.magSize) return false;
  if (weapon.reserve <= 0) return false;
  weapon.isReloading = true;
  weapon.reloadTimer = spec.reloadDuration;
  return true;
}

export function tryFireWeapon(
  weapon: WeaponRuntimeState,
  spec: WeaponSpec,
): 'fired' | 'empty' | 'busy' {
  if (weapon.isReloading || weapon.cooldownTimer > 0) {
    return 'busy';
  }
  if (weapon.mag <= 0) {
    return 'empty';
  }
  weapon.mag -= 1;
  weapon.cooldownTimer = spec.fireCooldown;
  return 'fired';
}

export function computeBlastFalloff(
  distance: number,
  radius: number,
  maxDamage: number,
): number {
  if (radius <= 0 || distance >= radius) return 0;
  if (distance <= 0.45) return maxDamage;
  const t = 1 - distance / radius;
  return Math.round(maxDamage * (0.2 + 0.8 * t * t));
}

export function applyDestructibleDamage(
  target: DestructibleState,
  damage: number,
  colliders: Aabb2D[],
): boolean {
  if (target.destroyed || damage <= 0) return false;
  target.hp = Math.max(0, target.hp - damage);
  if (target.hp === 0) {
    target.destroyed = true;
    if (target.colliderId) {
      const collider = colliders.find((c) => c.id === target.colliderId);
      if (collider) {
        collider.active = false;
      }
    }
    return true;
  }
  return false;
}

export function stepPendulumHandle(
  state: PendulumState,
  dt: number,
  impulseX = 0,
  impulseZ = 0,
  ambientForceX = 0,
  ambientForceZ = 0,
): PendulumState {
  const gravityK = 22.0;
  const damping = 3.2;

  let velX = state.velX + impulseX;
  let velZ = state.velZ + impulseZ;

  const accelX = -gravityK * Math.sin(state.angleX) - damping * velX + ambientForceX;
  const accelZ = -gravityK * Math.sin(state.angleZ) - damping * velZ + ambientForceZ;

  velX += accelX * dt;
  velZ += accelZ * dt;

  const maxAngle = 1.15;
  let angleX = state.angleX + velX * dt;
  let angleZ = state.angleZ + velZ * dt;

  if (angleX > maxAngle) {
    angleX = maxAngle;
    velX *= -0.35;
  } else if (angleX < -maxAngle) {
    angleX = -maxAngle;
    velX *= -0.35;
  }

  if (angleZ > maxAngle) {
    angleZ = maxAngle;
    velZ *= -0.35;
  } else if (angleZ < -maxAngle) {
    angleZ = -maxAngle;
    velZ *= -0.35;
  }

  return { angleX, angleZ, velX, velZ };
}

export function resolveCircleAabbCollisions(
  x: number,
  z: number,
  radius: number,
  colliders: readonly Aabb2D[],
): { x: number; z: number } {
  let outX = x;
  let outZ = z;

  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < colliders.length; i++) {
      const box = colliders[i];
      if (!box.active) continue;

      const closestX = Math.max(box.minX, Math.min(outX, box.maxX));
      const closestZ = Math.max(box.minZ, Math.min(outZ, box.maxZ));

      const dx = outX - closestX;
      const dz = outZ - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        if (distSq > 1e-8) {
          const dist = Math.sqrt(distSq);
          const overlap = radius - dist;
          outX += (dx / dist) * overlap;
          outZ += (dz / dist) * overlap;
        } else {
          const penLeft = Math.abs(outX - box.minX);
          const penRight = Math.abs(box.maxX - outX);
          const penTop = Math.abs(outZ - box.minZ);
          const penBottom = Math.abs(box.maxZ - outZ);
          const minPen = Math.min(penLeft, penRight, penTop, penBottom);

          if (minPen === penLeft) outX = box.minX - radius;
          else if (minPen === penRight) outX = box.maxX + radius;
          else if (minPen === penTop) outZ = box.minZ - radius;
          else outZ = box.maxZ + radius;
        }
      }
    }
  }

  return { x: outX, z: outZ };
}

export function pickArchetypeForRound(
  round: StageId | number,
  roll: number,
): ZombieArchetype {
  const cfg = getRoundConfig(round);
  const entries = Object.entries(cfg.weights) as [ZombieArchetype, number][];
  let acc = 0;
  for (const [archetype, weight] of entries) {
    acc += weight;
    if (roll <= acc) return archetype;
  }
  return 'shambler';
}

export function getEffectiveSpread(
  baseSpreadRad: number,
  isAds: boolean,
  isMoving = false,
): number {
  const adsScale = isAds ? 0.25 : 1.0;
  const moveScale = isMoving && !isAds ? 1.35 : 1.0;
  return baseSpreadRad * adsScale * moveScale;
}

export function getTargetFov(
  weapon: WeaponId,
  isAds: boolean,
  baseFov = DEFAULT_AIM_SETTINGS.baseFov,
  zoomTier: 1 | 2 = 1,
): number {
  if (!isAds) return baseFov;
  const spec = WEAPON_SPECS[weapon];
  if (weapon === 'sniper' && zoomTier === 2 && spec.zoomFov) {
    return spec.zoomFov;
  }
  return spec.adsFov;
}

export function computeLookSensitivity(
  baseSensitivity: number,
  adsMultiplier: number,
  isAds: boolean,
  currentFov: number,
  referenceFov = 74,
): number {
  const baseline = 0.0024 * baseSensitivity;
  if (!isAds) return baseline;
  // FOV-matched focal scaling for consistent aiming tracking
  const fovScale = Math.tan(THREE_DEG2RAD(currentFov * 0.5)) / Math.tan(THREE_DEG2RAD(referenceFov * 0.5));
  return baseline * adsMultiplier * Math.max(0.32, Math.min(1.0, fovScale));
}

function THREE_DEG2RAD(deg: number): number {
  return (deg * Math.PI) / 180;
}

export interface MovingTrainState {
  x: number;
  speed: number;
  direction: 1 | -1;
  minX: number;
  maxX: number;
}

export function stepMovingTrain(
  state: MovingTrainState,
  dt: number,
): { state: MovingTrainState; dx: number; accel: number; wrapped: boolean } {
  const inStationZone = Math.abs(state.x) < 12;
  const targetSpeed = inStationZone ? 3.2 : 9.2;
  const blend = 1 - Math.exp(-2.4 * dt);
  const nextSpeed = state.speed + (targetSpeed - state.speed) * blend;
  const accel = dt > 1e-4 ? (nextSpeed - state.speed) / dt : 0;

  let nextX = state.x + state.direction * nextSpeed * dt;
  let dx = nextX - state.x;
  let wrapped = false;

  if (state.direction === 1 && nextX > state.maxX) {
    nextX = state.minX;
    dx = 0;
    wrapped = true;
  } else if (state.direction === -1 && nextX < state.minX) {
    nextX = state.maxX;
    dx = 0;
    wrapped = true;
  }

  return {
    state: {
      ...state,
      x: nextX,
      speed: nextSpeed,
    },
    dx,
    accel,
    wrapped,
  };
}

export interface MovingVehicleState {
  x: number;
  z: number;
  speed: number;
  direction: 1 | -1;
  minX: number;
  maxX: number;
  destroyed: boolean;
  respawnTimer: number;
}

export function stepMovingVehicle(
  state: MovingVehicleState,
  dt: number,
): { state: MovingVehicleState; dx: number; wheelDeltaAngle: number; respawned: boolean } {
  if (state.destroyed) {
    const nextTimer = state.respawnTimer - dt;
    if (nextTimer <= 0) {
      const entryX = state.direction === 1 ? state.minX : state.maxX;
      return {
        state: {
          ...state,
          x: entryX,
          destroyed: false,
          respawnTimer: 0,
        },
        dx: 0,
        wheelDeltaAngle: 0,
        respawned: true,
      };
    }
    return {
      state: { ...state, respawnTimer: nextTimer },
      dx: 0,
      wheelDeltaAngle: 0,
      respawned: false,
    };
  }

  let nextX = state.x + state.direction * state.speed * dt;
  let dx = nextX - state.x;

  if (state.direction === 1 && nextX > state.maxX) {
    nextX = state.minX;
    dx = 0;
  } else if (state.direction === -1 && nextX < state.minX) {
    nextX = state.maxX;
    dx = 0;
  }

  return {
    state: {
      ...state,
      x: nextX,
    },
    dx,
    wheelDeltaAngle: -dx / 0.35,
    respawned: false,
  };
}

export interface HelicopterLandingState {
  elapsed: number;
  landingDuration: number;
  offsetX: number;
  offsetZ: number;
  altitude: number;
  pitch: number;
  roll: number;
  mainRotorAngle: number;
  tailRotorAngle: number;
  landed: boolean;
}

export function createInitialHelicopterState(): HelicopterLandingState {
  return {
    elapsed: 0,
    landingDuration: 6.5,
    offsetX: 14.5,
    offsetZ: -3.5,
    altitude: 15.0,
    pitch: 0.14,
    roll: -0.08,
    mainRotorAngle: 0,
    tailRotorAngle: 0,
    landed: false,
  };
}

export function stepHelicopterLanding(
  state: HelicopterLandingState,
  dt: number,
): HelicopterLandingState {
  const elapsed = state.elapsed + dt;
  const t = Math.min(1, elapsed / state.landingDuration);
  const landed = t >= 1;

  // Smooth S-curve horizontal approach & vertical touchdown flare
  const easeOut = 1 - Math.pow(1 - t, 3);
  const offsetX = landed ? 0 : 14.5 * (1 - easeOut);
  const offsetZ = landed ? 0 : -3.5 * (1 - easeOut);
  const altitude = landed ? 0 : 15.0 * Math.pow(1 - t, 2.25);

  // Nose dips slightly during approach, flares nose-up near touchdown, settles level on skids
  let pitch = 0;
  let roll = 0;
  if (!landed) {
    if (t < 0.55) {
      pitch = 0.14 * (1 - t / 0.55);
      roll = -0.09 * (1 - t / 0.55);
    } else if (t < 0.92) {
      const flareT = (t - 0.55) / 0.37;
      pitch = -0.15 * Math.sin(flareT * Math.PI);
      roll = 0.04 * Math.sin(flareT * Math.PI);
    }
  }

  const rotorSpeed = landed ? 14.5 : 22.0;
  const tailSpeed = landed ? 26.0 : 38.0;

  return {
    ...state,
    elapsed,
    offsetX,
    offsetZ,
    altitude,
    pitch,
    roll,
    mainRotorAngle: (state.mainRotorAngle + rotorSpeed * dt) % (Math.PI * 2),
    tailRotorAngle: (state.tailRotorAngle + tailSpeed * dt) % (Math.PI * 2),
    landed,
  };
}
