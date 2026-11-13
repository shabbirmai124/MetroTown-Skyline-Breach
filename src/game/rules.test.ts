// Created by Md Shabbir Mia
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_AIM_SETTINGS,
  ROUND_CONFIGS,
  STAGE_DURATION_SECONDS,
  WEAPON_ORDER,
  WEAPON_SPECS,
  applyDestructibleDamage,
  computeBlastFalloff,
  computeLookSensitivity,
  computeStageWave,
  createInitialHelicopterState,
  createInitialWeapons,
  formatSectorTimer,
  getEffectiveSpread,
  getRoundConfig,
  getTargetFov,
  pickArchetypeForRound,
  resolveCircleAabbCollisions,
  shouldSpawnStageBoss,
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
import { Aabb2D, DestructibleState } from './types';

test('blast falloff deals full damage at center and zero outside radius', () => {
  assert.equal(computeBlastFalloff(0.2, 6.0, 240), 240);
  assert.equal(computeBlastFalloff(6.0, 6.0, 240), 0);
  assert.equal(computeBlastFalloff(8.5, 6.0, 240), 0);
  const mid = computeBlastFalloff(3.0, 6.0, 240);
  assert.ok(mid > 50 && mid < 200);
});

test('all 7 weapons are configured and initialized properly', () => {
  assert.equal(WEAPON_ORDER.length, 7);
  const initial = createInitialWeapons();
  for (const wid of WEAPON_ORDER) {
    assert.ok(WEAPON_SPECS[wid], `Missing spec for ${wid}`);
    assert.ok(initial[wid], `Missing runtime state for ${wid}`);
    assert.equal(initial[wid].mag, WEAPON_SPECS[wid].magSize);
  }
});

test('all 4 campaign scenarios escalate from subway to outside road, building, and roof', () => {
  assert.equal(ROUND_CONFIGS.length, 4);
  const s1 = getRoundConfig(1);
  const s2 = getRoundConfig(2);
  const s3 = getRoundConfig(3);
  const s4 = getRoundConfig(4);
  assert.equal(s1.stageName, 'Subway Station');
  assert.equal(s2.stageName, 'Outside Road');
  assert.equal(s3.stageName, 'Inside Building');
  assert.equal(s4.stageName, 'Building Roof');
  assert.ok(s2.speedMultiplier > s1.speedMultiplier);
  assert.ok(s4.totalEnemies > s1.totalEnemies);
});

test('destructible train hull panel breaks and opens collider on lethal RPG damage', () => {
  const colliders: Aabb2D[] = [
    { id: 'train_wall_1', minX: -2, maxX: 2, minZ: 4.9, maxZ: 5.1, active: true },
  ];
  const panel: DestructibleState = {
    id: 'panel_1',
    category: 'train_panel',
    material: 'metal',
    hp: 140,
    maxHp: 140,
    destroyed: false,
    explosive: false,
    position: { x: 0, y: 1.5, z: 5 },
    colliderId: 'train_wall_1',
  };

  assert.equal(applyDestructibleDamage(panel, 40, colliders), false);
  assert.equal(panel.hp, 100);
  assert.equal(colliders[0].active, true);

  assert.equal(applyDestructibleDamage(panel, 200, colliders), true);
  assert.equal(panel.destroyed, true);
  assert.equal(panel.hp, 0);
  assert.equal(colliders[0].active, false);
});

test('pendulum handle swings on impulse and damps back toward rest', () => {
  let state = { angleX: 0, angleZ: 0, velX: 0, velZ: 0 };
  state = stepPendulumHandle(state, 0.016, 4.5, -2.0);
  assert.ok(state.angleX > 0);
  assert.ok(state.angleZ < 0);

  let peak = Math.abs(state.angleX);
  for (let i = 0; i < 180; i++) {
    state = stepPendulumHandle(state, 0.016);
    peak = Math.max(peak, Math.abs(state.angleX));
  }
  assert.ok(peak > 0.05);
  assert.ok(Math.abs(state.angleX) < 0.15);
});

test('weapon firing and reload cycle updates mag and reserve accurately', () => {
  const weapons = createInitialWeapons();
  const rpg = weapons.rpg;
  const spec = WEAPON_SPECS.rpg;

  assert.equal(tryFireWeapon(rpg, spec), 'fired');
  assert.equal(rpg.mag, 0);
  assert.equal(tryFireWeapon(rpg, spec), 'busy');

  stepWeaponTimers(rpg, spec, spec.fireCooldown + 0.05);
  assert.equal(tryFireWeapon(rpg, spec), 'empty');

  assert.equal(tryStartReload(rpg, spec), true);
  assert.equal(rpg.isReloading, true);

  const completed = stepWeaponTimers(rpg, spec, spec.reloadDuration + 0.05);
  assert.equal(completed, true);
  assert.equal(rpg.isReloading, false);
  assert.equal(rpg.mag, 1);
  assert.equal(rpg.reserve, 7);
});

test('circle vs AABB collision blocks intact wall and allows passage once breached', () => {
  const colliders: Aabb2D[] = [
    { id: 'wall', minX: -3, maxX: 3, minZ: 4.8, maxZ: 5.2, active: true },
  ];
  const blocked = resolveCircleAabbCollisions(0, 4.6, 0.5, colliders);
  assert.ok(blocked.z <= 4.3001);

  colliders[0].active = false;
  const through = resolveCircleAabbCollisions(0, 4.95, 0.5, colliders);
  assert.equal(through.z, 4.95);
});

test('archetype picker respects round weights', () => {
  assert.equal(pickArchetypeForRound(1, 0.1), 'shambler');
  assert.equal(pickArchetypeForRound(1, 0.95), 'sprinter');
  assert.equal(pickArchetypeForRound(2, 0.98), 'spitter');
});

test('ADS tightens spread, supports dual sniper zoom FOV, and scales tactical look sensitivity', () => {
  const hipSpread = getEffectiveSpread(WEAPON_SPECS.carbine.spreadRad, false, false);
  const adsSpread = getEffectiveSpread(WEAPON_SPECS.carbine.spreadRad, true, false);
  assert.ok(adsSpread < hipSpread * 0.4);

  assert.equal(getTargetFov('carbine', false, 74, 1), 74);
  assert.equal(getTargetFov('sniper', true, 74, 1), 38);
  assert.equal(getTargetFov('sniper', true, 74, 2), 22);

  const hipSens = computeLookSensitivity(
    DEFAULT_AIM_SETTINGS.sensitivity,
    DEFAULT_AIM_SETTINGS.adsMultiplier,
    false,
    74,
  );
  const scopedSens = computeLookSensitivity(
    DEFAULT_AIM_SETTINGS.sensitivity,
    DEFAULT_AIM_SETTINGS.adsMultiplier,
    true,
    22,
  );
  assert.ok(scopedSens < hipSens * 0.45);
});

test('Titan boss triggers mid-stage once per stage before wave cap is reached', () => {
  assert.equal(shouldSpawnStageBoss(1, 2, 3, false), false);
  assert.equal(shouldSpawnStageBoss(1, 4, 5, false), true);
  assert.equal(shouldSpawnStageBoss(1, 5, 6, true), false);
  assert.equal(shouldSpawnStageBoss(2, 6, 8, false), true);
  assert.equal(shouldSpawnStageBoss(2, 14, 14, false), false);
});

test('each scenario enforces a 15-minute (900s) run before sector exit and schedules recurring Titan bosses', () => {
  assert.equal(STAGE_DURATION_SECONDS, 900);
  for (const cfg of ROUND_CONFIGS) {
    assert.equal(cfg.durationSeconds, 900);
  }
  assert.equal(shouldUnlockSectorExit(300, 900), false);
  assert.equal(shouldUnlockSectorExit(899.5, 900), false);
  assert.equal(shouldUnlockSectorExit(900, 900), true);

  assert.equal(computeStageWave(0), 1);
  assert.equal(computeStageWave(125), 3);
  assert.equal(formatSectorTimer(900), '15:00');
  assert.equal(formatSectorTimer(65), '01:05');
  assert.equal(formatSectorTimer(0), '00:00');

  assert.equal(shouldSpawnTimedBoss(15, -1, false, 900), false);
  assert.equal(shouldSpawnTimedBoss(42, -1, false, 900), true);
  assert.equal(shouldSpawnTimedBoss(100, 42, true, 900), false);
  assert.equal(shouldSpawnTimedBoss(230, 42, false, 900), true);
});

test('moving subway train slows in platform zone, accelerates in tunnel, and wraps cleanly', () => {
  let train = { x: -4, speed: 7.0, direction: 1 as const, minX: -58, maxX: 58 };
  const inStation = stepMovingTrain(train, 0.25);
  assert.ok(inStation.dx > 0);
  assert.ok(inStation.state.speed < 7.0);
  assert.ok(inStation.accel < 0);

  train = { x: 57.8, speed: 9.0, direction: 1 as const, minX: -58, maxX: 58 };
  const wrapped = stepMovingTrain(train, 0.1);
  assert.equal(wrapped.wrapped, true);
  assert.equal(wrapped.state.x, -58);
  assert.equal(wrapped.dx, 0);
});

test('moving boulevard vehicles cruise along lanes, spin wheels, wrap, and respawn after destruction', () => {
  const lane = stepMovingVehicle(
    { x: 0, z: 2.8, speed: 10, direction: 1, minX: -46, maxX: 46, destroyed: false, respawnTimer: 0 },
    0.5,
  );
  assert.equal(lane.state.x, 5);
  assert.equal(lane.dx, 5);
  assert.ok(lane.wheelDeltaAngle < 0);

  const wrapped = stepMovingVehicle(
    { x: -45.5, z: -2.8, speed: 10, direction: -1, minX: -46, maxX: 46, destroyed: false, respawnTimer: 0 },
    0.1,
  );
  assert.equal(wrapped.state.x, 46);

  const waiting = stepMovingVehicle(
    { x: 10, z: 2.8, speed: 10, direction: 1, minX: -46, maxX: 46, destroyed: true, respawnTimer: 1.0 },
    0.4,
  );
  assert.equal(waiting.state.destroyed, true);
  assert.equal(waiting.respawned, false);

  const reborn = stepMovingVehicle(waiting.state, 0.7);
  assert.equal(reborn.state.destroyed, false);
  assert.equal(reborn.respawned, true);
  assert.equal(reborn.state.x, -46);
});

test('rooftop helicopter descends from skyline, flares nose-up, and touches down cleanly on helipad', () => {
  let heli = createInitialHelicopterState();
  assert.equal(heli.landed, false);
  assert.ok(heli.altitude > 10);

  heli = stepHelicopterLanding(heli, 2.0);
  assert.equal(heli.landed, false);
  assert.ok(heli.altitude < 10 && heli.altitude > 0);
  assert.ok(heli.mainRotorAngle > 0);
  assert.ok(heli.tailRotorAngle > 0);

  heli = stepHelicopterLanding(heli, 3.0);
  assert.ok(heli.pitch < 0); // nose-up landing flare

  heli = stepHelicopterLanding(heli, 2.0);
  assert.equal(heli.landed, true);
  assert.equal(heli.altitude, 0);
  assert.equal(heli.offsetX, 0);
  assert.equal(heli.offsetZ, 0);
  assert.equal(heli.pitch, 0);
});


