// Created by Md Shabbir Mia
import * as THREE from 'three';
import {
  createInitialHelicopterState,
  HelicopterLandingState,
  MovingTrainState,
  MovingVehicleState,
} from './rules';
import { SubwayTextureBundle } from './textures';
import {
  Aabb2D,
  DestructibleState,
  PendulumState,
  StageId,
  SurfaceMaterial,
  WeaponId,
  ZombieArchetype,
} from './types';

export interface ZombieRig {
  id: string;
  archetype: ZombieArchetype;
  root: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  telegraphRing: THREE.Mesh;
  contactShadow: THREE.Mesh;
  hitMeshes: THREE.Mesh[];
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  walkPhase: number;
  hitFlashTimer: number;
  attackState: 'chase' | 'windup' | 'active' | 'recover' | 'ko';
  stateTimer: number;
  koVelocity: THREE.Vector3;
  hasToken: boolean;
  flankSign: number;
  rangedCooldown: number;
  bossAbilityCooldown: number;
  bossPowerType: 'none' | 'slam' | 'plasma' | 'dash';
  bossDashTimer: number;
  bossDashDir: THREE.Vector3;
}

export interface HandleRig {
  id: string;
  pivot: THREE.Group;
  hitMesh: THREE.Mesh;
  baseLocalX: number;
  worldPos: THREE.Vector3;
  state: PendulumState;
}

export interface DestructibleBinding {
  state: DestructibleState;
  mesh: THREE.Object3D;
  damagedCore?: THREE.Object3D;
  hitMeshes: THREE.Mesh[];
}

export interface MovingTrainColliderBinding {
  collider: Aabb2D;
  baseMinX: number;
  baseMaxX: number;
  destructible?: DestructibleState;
  basePosX?: number;
}

export interface MovingVehicleRig {
  id: string;
  group: THREE.Group;
  wheels: THREE.Object3D[];
  state: MovingVehicleState;
  halfLen: number;
  halfDepth: number;
  collider: Aabb2D;
  destructible: DestructibleBinding;
  initialHp: number;
  hasCountedBreach: boolean;
}

export interface HelicopterRig {
  group: THREE.Group;
  anchorPos: THREE.Vector3;
  baseYaw: number;
  mainRotor: THREE.Group;
  tailRotor: THREE.Group;
  beaconMat: THREE.MeshStandardMaterial;
  searchLight: THREE.PointLight;
  searchBeam: THREE.Mesh;
  state: HelicopterLandingState;
}

export interface StationBuildResult {
  stage: StageId;
  worldGroup: THREE.Group;
  interactables: THREE.Object3D[];
  colliders: Aabb2D[];
  destructibles: DestructibleBinding[];
  handles: HandleRig[];
  ceilingLights: {
    mesh: THREE.Mesh;
    mat: THREE.MeshStandardMaterial;
    beamMat?: THREE.MeshBasicMaterial;
    light?: THREE.PointLight;
  }[];
  emergencyBeacons: {
    mat: THREE.MeshStandardMaterial;
    light: THREE.PointLight;
  }[];
  trainGroup: THREE.Group;
  trainState?: MovingTrainState;
  trainWheels: THREE.Mesh[];
  trainBindings: MovingTrainColliderBinding[];
  movingVehicles: MovingVehicleRig[];
  helicopter?: HelicopterRig;
  spawnPoints: THREE.Vector3[];
  pickupSpots: THREE.Vector3[];
  playerSpawn: THREE.Vector3;
  playerSpawnYaw: number;
  extractionSpot: THREE.Vector3;
  extractionRing: THREE.Mesh;
  extractionBeam: THREE.Mesh;
  extractionLight: THREE.PointLight;
  skyColor: number;
  fogColor: number;
  fogDensity: number;
  ambientIntensity: number;
  keyLightIntensity: number;
  floorBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export function tagSurface(
  obj: THREE.Object3D,
  material: SurfaceMaterial,
  destructibleId?: string,
): void {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.userData.material = material;
      if (destructibleId) {
        child.userData.destructibleId = destructibleId;
      }
    }
  });
}

function addExtractionZone(
  worldGroup: THREE.Group,
  pos: THREE.Vector3,
): {
  extractionRing: THREE.Mesh;
  extractionBeam: THREE.Mesh;
  extractionLight: THREE.PointLight;
} {
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const extractionRing = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.45, 32), ringMat);
  extractionRing.rotation.x = -Math.PI / 2;
  extractionRing.position.set(pos.x, pos.y + 0.04, pos.z);
  extractionRing.visible = false;

  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const extractionBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.15, 3.6, 20, 1, true),
    beamMat,
  );
  extractionBeam.position.set(pos.x, pos.y + 1.8, pos.z);
  extractionBeam.visible = false;

  const extractionLight = new THREE.PointLight(0x10b981, 0, 14, 1.6);
  extractionLight.position.set(pos.x, pos.y + 1.5, pos.z);

  worldGroup.add(extractionRing, extractionBeam, extractionLight);
  return { extractionRing, extractionBeam, extractionLight };
}

function addBarrelProp(
  worldGroup: THREE.Group,
  interactables: THREE.Object3D[],
  colliders: Aabb2D[],
  destructibles: DestructibleBinding[],
  idx: number,
  x: number,
  z: number,
  barrelRedMat: THREE.Material,
  hazardYellowMat: THREE.Material,
  darkSteelMat: THREE.Material,
): void {
  const id = `barrel_${idx}`;
  const colId = `col_barrel_${idx}`;
  const barGroup = new THREE.Group();
  barGroup.position.set(x, 0, z);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.18, 16), barrelRedMat);
  body.position.y = 0.59;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.435, 0.435, 0.26, 16), hazardYellowMat);
  band.position.y = 0.62;
  const rimTop = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.035, 8, 16), darkSteelMat);
  rimTop.rotation.x = Math.PI / 2;
  rimTop.position.y = 1.18;
  barGroup.add(body, band, rimTop);
  tagSurface(barGroup, 'metal', id);
  worldGroup.add(barGroup);
  interactables.push(body, band, rimTop);

  colliders.push({
    id: colId,
    minX: x - 0.48,
    maxX: x + 0.48,
    minZ: z - 0.48,
    maxZ: z + 0.48,
    active: true,
  });

  destructibles.push({
    state: {
      id,
      category: 'barrel',
      material: 'metal',
      hp: 45,
      maxHp: 45,
      destroyed: false,
      explosive: true,
      position: { x, y: 0.6, z },
      colliderId: colId,
    },
    mesh: barGroup,
    hitMeshes: [body, band, rimTop],
  });
}

function addCrateProp(
  worldGroup: THREE.Group,
  interactables: THREE.Object3D[],
  colliders: Aabb2D[],
  destructibles: DestructibleBinding[],
  idx: number,
  x: number,
  z: number,
  woodMat: THREE.Material,
  darkSteelMat: THREE.Material,
): void {
  const id = `crate_${idx}`;
  const colId = `col_crate_${idx}`;
  const cGroup = new THREE.Group();
  cGroup.position.set(x, 0, z);

  const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.05, 1.1), woodMat);
  box.position.y = 0.525;
  const strap = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.14, 1.14), darkSteelMat);
  strap.position.y = 0.525;
  cGroup.add(box, strap);
  tagSurface(box, 'wood', id);
  tagSurface(strap, 'metal', id);
  worldGroup.add(cGroup);
  interactables.push(box, strap);

  colliders.push({
    id: colId,
    minX: x - 0.6,
    maxX: x + 0.6,
    minZ: z - 0.6,
    maxZ: z + 0.6,
    active: true,
  });

  destructibles.push({
    state: {
      id,
      category: 'crate',
      material: 'wood',
      hp: 65,
      maxHp: 65,
      destroyed: false,
      explosive: false,
      position: { x, y: 0.52, z },
      colliderId: colId,
    },
    mesh: cGroup,
    hitMeshes: [box, strap],
  });
}

export function buildStageEnvironment(
  stage: StageId,
  textures: SubwayTextureBundle,
  isSoftwareGl: boolean,
): StationBuildResult {
  const worldGroup = new THREE.Group();
  const interactables: THREE.Object3D[] = [];
  const colliders: Aabb2D[] = [];
  const destructibles: DestructibleBinding[] = [];
  const handles: HandleRig[] = [];
  const ceilingLights: StationBuildResult['ceilingLights'] = [];
  const emergencyBeacons: StationBuildResult['emergencyBeacons'] = [];
  const trainGroup = new THREE.Group();
  const trainWheels: THREE.Mesh[] = [];
  const trainBindings: MovingTrainColliderBinding[] = [];
  const movingVehicles: MovingVehicleRig[] = [];

  // Shared Calibrated Materials (dark rich contrast, zero washed-out glare)
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.concreteMap,
    normalMap: textures.concreteNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: textures.concreteRoughness,
    roughness: 1.0,
    metalness: 0.05,
  });

  const tileMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.tileMap,
    normalMap: textures.tileNormal,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughnessMap: textures.tileRoughness,
    roughness: 1.0,
    metalness: 0.05,
  });

  const darkConcreteMat = new THREE.MeshStandardMaterial({
    color: 0x20242a,
    normalMap: textures.concreteNormal,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.9,
    metalness: 0.05,
  });

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x4b5360,
    roughness: 0.42,
    metalness: 0.78,
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x1b1f26,
    roughness: 0.52,
    metalness: 0.76,
  });

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x613d24,
    roughness: 0.78,
    metalness: 0.04,
  });

  const barrelRedMat = new THREE.MeshPhysicalMaterial({
    color: 0xa32320,
    roughness: 0.42,
    metalness: 0.42,
    clearcoat: 0.2,
  });

  const hazardYellowMat = new THREE.MeshStandardMaterial({
    color: 0xd19819,
    roughness: 0.48,
    metalness: 0.24,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x7aa8c4,
    roughness: 0.08,
    metalness: 0.12,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
    clearcoat: 0.7,
  });

  // =========================================================================
  // STAGE 1: 14TH ST. SUBWAY STATION
  // =========================================================================
  if (stage === 1) {
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.platformEdgeMap,
      roughness: 0.68,
      metalness: 0.05,
    });
    const ballastMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.ballastMap,
      roughness: 0.96,
      metalness: 0.02,
    });

    const platformMesh = new THREE.Mesh(new THREE.BoxGeometry(48, 0.8, 12.7), floorMat);
    platformMesh.position.set(0, -0.4, -2.15);
    platformMesh.receiveShadow = !isSoftwareGl;
    tagSurface(platformMesh, 'concrete');
    worldGroup.add(platformMesh);
    interactables.push(platformMesh);

    const edgeStrip = new THREE.Mesh(new THREE.BoxGeometry(48, 0.04, 0.55), edgeMat);
    edgeStrip.position.set(0, 0.015, 3.92);
    tagSurface(edgeStrip, 'concrete');
    worldGroup.add(edgeStrip);
    interactables.push(edgeStrip);

    const trackBed = new THREE.Mesh(new THREE.BoxGeometry(148, 0.5, 6.2), ballastMat);
    trackBed.position.set(0, -1.25, 7.1);
    tagSurface(trackBed, 'concrete');
    worldGroup.add(trackBed);
    interactables.push(trackBed);

    const tieGeo = new THREE.BoxGeometry(0.28, 0.14, 2.3);
    const tieInst = new THREE.InstancedMesh(tieGeo, woodMat, 76);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 76; i++) {
      dummy.position.set(-60 + i * 1.6, -0.96, 6.45);
      dummy.updateMatrix();
      tieInst.setMatrixAt(i, dummy.matrix);
    }
    tieInst.instanceMatrix.needsUpdate = true;
    tagSurface(tieInst, 'wood');
    worldGroup.add(tieInst);

    const railGeo = new THREE.BoxGeometry(148, 0.12, 0.1);
    const rail1 = new THREE.Mesh(railGeo, steelMat);
    rail1.position.set(0, -0.84, 5.65);
    const rail2 = new THREE.Mesh(railGeo, steelMat);
    rail2.position.set(0, -0.84, 7.25);
    const thirdRail = new THREE.Mesh(new THREE.BoxGeometry(148, 0.14, 0.14), hazardYellowMat);
    thirdRail.position.set(0, -0.82, 8.65);
    tagSurface(rail1, 'metal');
    tagSurface(rail2, 'metal');
    tagSurface(thirdRail, 'metal');
    worldGroup.add(rail1, rail2, thirdRail);

    const platformSkirt = new THREE.Mesh(new THREE.BoxGeometry(48, 1.0, 0.25), darkConcreteMat);
    platformSkirt.position.set(0, -0.5, 4.1);
    tagSurface(platformSkirt, 'concrete');
    worldGroup.add(platformSkirt);

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(48, 5.2, 0.5), tileMat);
    backWall.position.set(0, 2.6, -8.75);
    tagSurface(backWall, 'tile');
    worldGroup.add(backWall);
    interactables.push(backWall);
    colliders.push({ id: 'back_wall', minX: -24.5, maxX: 24.5, minZ: -9.2, maxZ: -8.35, active: true });

    [3.95, 4.2].forEach((py) => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 48, 10), darkSteelMat);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, py, -8.42);
      tagSurface(pipe, 'metal');
      worldGroup.add(pipe);
    });

    const farWall = new THREE.Mesh(new THREE.BoxGeometry(148, 6.2, 0.6), tileMat);
    farWall.position.set(0, 2.1, 10.1);
    tagSurface(farWall, 'tile');
    worldGroup.add(farWall);
    interactables.push(farWall);
    colliders.push({ id: 'far_wall', minX: -72, maxX: 72, minZ: 9.6, maxZ: 10.6, active: true });

    // Platform end walls end at z=4.35 so the track tunnel mouths (z=4.35..10.1) stay open for the moving train
    const leftEndWall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6.2, 13.4), tileMat);
    leftEndWall.position.set(-24.3, 2.2, -2.35);
    tagSurface(leftEndWall, 'tile');
    worldGroup.add(leftEndWall);
    interactables.push(leftEndWall);
    colliders.push({ id: 'left_end', minX: -24.8, maxX: -23.8, minZ: -9.0, maxZ: 4.35, active: true });

    const rightEndWall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6.2, 13.4), tileMat);
    rightEndWall.position.set(24.3, 2.2, -2.35);
    tagSurface(rightEndWall, 'tile');
    worldGroup.add(rightEndWall);
    interactables.push(rightEndWall);
    colliders.push({ id: 'right_end', minX: 23.8, maxX: 24.8, minZ: -9.0, maxZ: 4.35, active: true });

    // Overhead Tunnel Arch Portals + Inner Tunnel Extensions at West & East Track Ends
    [-24.2, 24.2].forEach((px) => {
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.85, 6.4), darkConcreteMat);
      lintel.position.set(px, 4.35, 7.1);
      const pillarSide = new THREE.Mesh(new THREE.BoxGeometry(0.55, 4.6, 0.5), darkSteelMat);
      pillarSide.position.set(px, 1.35, 4.25);
      const signalMat = new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.7,
      });
      const portalLight = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 4.6), signalMat);
      portalLight.position.set(px + (px < 0 ? 0.25 : -0.25), 3.35, 7.1);
      const tunnelRoof = new THREE.Mesh(new THREE.BoxGeometry(46, 0.5, 6.8), darkConcreteMat);
      tunnelRoof.position.set(px + (px < 0 ? -23.5 : 23.5), 4.6, 7.1);
      const tunnelInner = new THREE.Mesh(new THREE.BoxGeometry(46, 5.4, 0.5), darkConcreteMat);
      tunnelInner.position.set(px + (px < 0 ? -23.5 : 23.5), 1.8, 3.85);
      worldGroup.add(lintel, pillarSide, portalLight, tunnelRoof, tunnelInner);
    });

    // Street Exit Stairwell Framing at East End
    const stairFrame = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.4, 0.4), darkSteelMat);
    stairFrame.position.set(20.5, 1.7, -8.3);
    const stairLabelMat = new THREE.MeshStandardMaterial({
      color: 0x064e3b,
      emissive: 0x10b981,
      emissiveIntensity: 1.6,
    });
    const stairSign = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.44, 0.14), stairLabelMat);
    stairSign.position.set(20.5, 3.15, -8.12);
    const stairGlow = new THREE.PointLight(0x34d399, 5.5, 11, 1.6);
    stairGlow.position.set(20.5, 2.8, -7.2);
    worldGroup.add(stairFrame, stairSign, stairGlow);

    const signMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.stationSignMap,
      roughness: 0.28,
      metalness: 0.2,
      emissive: 0x182a3d,
      emissiveIntensity: 0.65,
    });
    [-13, 0, 13].forEach((sx) => {
      const signGroup = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.05, 0.14), darkSteelMat);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 0.92), signMat);
      face.position.z = 0.08;
      signGroup.add(frame, face);
      signGroup.position.set(sx, 2.85, -8.45);
      tagSurface(signGroup, 'metal');
      worldGroup.add(signGroup);
      interactables.push(frame);
    });

    [-8, 8].forEach((bx) => {
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.22), darkSteelMat);
      housing.position.set(bx, 3.65, -8.38);
      const beaconMat = new THREE.MeshStandardMaterial({
        color: 0x450a0a,
        emissive: 0xef4444,
        emissiveIntensity: 0.2,
        roughness: 0.2,
      });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), beaconMat);
      bulb.position.set(bx, 3.65, -8.25);
      const pt = new THREE.PointLight(0xef4444, 0, 12, 1.8);
      pt.position.set(bx, 3.65, -7.8);
      worldGroup.add(housing, bulb, pt);
      emergencyBeacons.push({ mat: beaconMat, light: pt });
    });

    const ceilingSlab = new THREE.Mesh(new THREE.BoxGeometry(52, 0.5, 20.2), darkConcreteMat);
    ceilingSlab.position.set(0, 5.25, 0.8);
    tagSurface(ceilingSlab, 'concrete');
    worldGroup.add(ceilingSlab);

    for (let gx = -20; gx <= 20; gx += 8) {
      const girder = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 19.6), darkSteelMat);
      girder.position.set(gx, 4.78, 0.8);
      tagSurface(girder, 'metal');
      worldGroup.add(girder);
    }

    const lightPositions = [
      { x: -17, z: -2.6, hasPt: true, beam: true },
      { x: -8.5, z: -2.6, hasPt: true, beam: true },
      { x: 0, z: -2.6, hasPt: true, beam: true },
      { x: 8.5, z: -2.6, hasPt: true, beam: true },
      { x: 17, z: -2.6, hasPt: true, beam: true },
      { x: -12, z: 6.4, hasPt: true, beam: false },
      { x: 0, z: 6.4, hasPt: true, beam: false },
      { x: 12, z: 6.4, hasPt: true, beam: false },
    ];
    const beamGeo = new THREE.CylinderGeometry(0.65, 2.0, 4.6, 14, 1, true);
    lightPositions.forEach((lp) => {
      const housing = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 0.55), darkSteelMat);
      housing.position.set(lp.x, 4.92, lp.z);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: 0xdbeafe,
        emissive: 0xbfdbfe,
        emissiveIntensity: 1.5,
        roughness: 0.2,
      });
      const tube = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.08, 0.36), tubeMat);
      tube.position.set(lp.x, 4.82, lp.z);
      worldGroup.add(housing, tube);

      let beamMat: THREE.MeshBasicMaterial | undefined;
      if (lp.beam) {
        beamMat = new THREE.MeshBasicMaterial({
          color: 0x93c5fd,
          transparent: true,
          opacity: 0.025,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
        });
        const cone = new THREE.Mesh(beamGeo, beamMat);
        cone.position.set(lp.x, 2.5, lp.z);
        worldGroup.add(cone);
      }

      let pt: THREE.PointLight | undefined;
      if (lp.hasPt) {
        pt = new THREE.PointLight(0xc7dcf5, 7.5, 18, 1.7);
        pt.position.set(lp.x, 4.4, lp.z);
        worldGroup.add(pt);
      }
      ceilingLights.push({ mesh: tube, mat: tubeMat, beamMat, light: pt });
    });

    // Destructible Structural Pillars
    [-16, -8, 0, 8, 16].forEach((px, idx) => {
      const id = `pillar_${idx}`;
      const colliderId = `col_pillar_${idx}`;
      const pGroup = new THREE.Group();
      pGroup.position.set(px, 0, -2.0);

      const coreGroup = new THREE.Group();
      const web = new THREE.Mesh(new THREE.BoxGeometry(0.22, 5.0, 0.46), steelMat);
      web.position.y = 2.5;
      const flange1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.0, 0.12), darkSteelMat);
      flange1.position.set(0, 2.5, 0.22);
      const flange2 = flange1.clone();
      flange2.position.z = -0.22;
      coreGroup.add(web, flange1, flange2);
      tagSurface(coreGroup, 'metal');
      pGroup.add(coreGroup);

      const shellGroup = new THREE.Group();
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.65, 0.92), darkConcreteMat);
      plinth.position.y = 0.325;
      const column = new THREE.Mesh(new THREE.BoxGeometry(0.76, 4.2, 0.76), floorMat);
      column.position.y = 2.55;
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.35, 0.82), hazardYellowMat);
      collar.position.y = 1.65;
      shellGroup.add(plinth, column, collar);
      tagSurface(shellGroup, 'concrete', id);
      pGroup.add(shellGroup);

      worldGroup.add(pGroup);
      interactables.push(plinth, column, collar, web);

      colliders.push({ id: colliderId, minX: px - 0.5, maxX: px + 0.5, minZ: -2.5, maxZ: -1.5, active: true });
      colliders.push({ id: `${colliderId}_core`, minX: px - 0.28, maxX: px + 0.28, minZ: -2.28, maxZ: -1.72, active: true });

      destructibles.push({
        state: {
          id,
          category: 'pillar',
          material: 'concrete',
          hp: 150,
          maxHp: 150,
          destroyed: false,
          explosive: false,
          position: { x: px, y: 1.5, z: -2.0 },
          colliderId,
        },
        mesh: shellGroup,
        damagedCore: coreGroup,
        hitMeshes: [plinth, column, collar],
      });
    });

    // Platform Benches
    [-12, -4, 4, 12].forEach((bx, idx) => {
      const id = `bench_${idx}`;
      const colId = `col_bench_${idx}`;
      const bGroup = new THREE.Group();
      bGroup.position.set(bx, 0, -5.2);

      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.65), darkSteelMat);
      legL.position.set(-1.1, 0.225, 0);
      const legR = legL.clone();
      legR.position.x = 1.1;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.68), woodMat);
      seat.position.set(0, 0.48, 0);
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.52, 0.09), woodMat);
      back.position.set(0, 0.78, -0.3);
      bGroup.add(legL, legR, seat, back);
      tagSurface(bGroup, 'wood', id);
      tagSurface(legL, 'metal', id);
      tagSurface(legR, 'metal', id);
      worldGroup.add(bGroup);
      interactables.push(legL, legR, seat, back);

      colliders.push({ id: colId, minX: bx - 1.35, maxX: bx + 1.35, minZ: -5.6, maxZ: -4.8, active: true });
      destructibles.push({
        state: {
          id,
          category: 'bench',
          material: 'wood',
          hp: 75,
          maxHp: 75,
          destroyed: false,
          explosive: false,
          position: { x: bx, y: 0.5, z: -5.2 },
          colliderId: colId,
        },
        mesh: bGroup,
        hitMeshes: [legL, legR, seat, back],
      });
    });

    // Explosive Barrels
    [
      { x: -10.5, z: 2.1 },
      { x: -3.2, z: 2.4 },
      { x: 5.5, z: 2.1 },
      { x: 13.8, z: 2.3 },
    ].forEach((b, idx) =>
      addBarrelProp(worldGroup, interactables, colliders, destructibles, idx, b.x, b.z, barrelRedMat, hazardYellowMat, darkSteelMat),
    );

    // 2-Car Moving Destructible Subway Train
    const initialTrainX = -6;
    trainGroup.position.set(initialTrainX, 0, 0);
    worldGroup.add(trainGroup);
    const trainMetalMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: textures.trainMetalMap,
      normalMap: textures.trainMetalNormal,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughnessMap: textures.trainMetalRoughness,
      roughness: 1.0,
      metalness: 0.72,
      clearcoat: 0.25,
    });
    const seatBlueMat = new THREE.MeshStandardMaterial({ color: 0x163961, roughness: 0.65, metalness: 0.14 });
    const handleStrapMat = new THREE.MeshStandardMaterial({ color: 0x16191e, roughness: 0.8 });
    const handleGripMat = new THREE.MeshStandardMaterial({ color: 0xd99616, roughness: 0.35 });
    const trainHeadlightMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfde68a,
      emissiveIntensity: 3.0,
    });
    const trainTaillightMat = new THREE.MeshStandardMaterial({
      color: 0xfca5a5,
      emissive: 0xef4444,
      emissiveIntensity: 2.8,
    });

    const carCenters = [-9.5, 9.5];
    const carLength = 18.0;
    const trainZMin = 4.45;
    const trainZMax = 8.15;
    const trainZCenter = (trainZMin + trainZMax) * 0.5;
    const trainWidth = trainZMax - trainZMin;

    carCenters.forEach((cx, carIdx) => {
      const carGroup = new THREE.Group();
      carGroup.position.set(cx, 0, 0);
      trainGroup.add(carGroup);

      const carFloor = new THREE.Mesh(new THREE.BoxGeometry(carLength, 0.18, trainWidth), darkSteelMat);
      carFloor.position.set(0, -0.05, trainZCenter);
      tagSurface(carFloor, 'metal');
      carGroup.add(carFloor);
      interactables.push(carFloor);

      // Spinning Bogie Wheelsets beneath each train car
      [-6.5, -2.5, 2.5, 6.5].forEach((wx) => {
        [5.65, 7.25].forEach((wz) => {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.18, 14), steelMat);
          wheel.rotation.x = Math.PI / 2;
          wheel.position.set(wx, -0.44, wz);
          carGroup.add(wheel);
          trainWheels.push(wheel);
        });
      });

      // Train Front Headlights (+X nose of Lead Car 1) & Rear Taillights (-X tail of Car 0)
      if (carIdx === 1) {
        const noseCap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.8, trainWidth), trainMetalMat);
        noseCap.position.set(carLength * 0.5, 1.38, trainZCenter);
        carGroup.add(noseCap);
        [-1.05, 1.05].forEach((lz) => {
          const hl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.36), trainHeadlightMat);
          hl.position.set(carLength * 0.5 + 0.08, 0.85, trainZCenter + lz);
          carGroup.add(hl);
        });
      } else {
        const tailCap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.8, trainWidth), trainMetalMat);
        tailCap.position.set(-carLength * 0.5, 1.38, trainZCenter);
        carGroup.add(tailCap);
        [-1.05, 1.05].forEach((lz) => {
          const tl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.34), trainTaillightMat);
          tl.position.set(-carLength * 0.5 - 0.08, 0.85, trainZCenter + lz);
          carGroup.add(tl);
        });
      }

      const bridge = new THREE.Mesh(new THREE.BoxGeometry(carLength, 0.06, 0.35), steelMat);
      bridge.position.set(0, 0.01, 4.32);
      carGroup.add(bridge);

      const roof = new THREE.Mesh(new THREE.BoxGeometry(carLength, 0.22, trainWidth + 0.12), trainMetalMat);
      roof.position.set(0, 2.88, trainZCenter);
      tagSurface(roof, 'metal');
      carGroup.add(roof);
      interactables.push(roof);

      const cabinStripMat = new THREE.MeshStandardMaterial({
        color: 0xffefc8,
        emissive: 0xffd78a,
        emissiveIntensity: 1.25,
      });
      const cabinStrip = new THREE.Mesh(new THREE.BoxGeometry(carLength - 1.2, 0.06, 0.4), cabinStripMat);
      cabinStrip.position.set(0, 2.74, trainZCenter);
      carGroup.add(cabinStrip);
      ceilingLights.push({ mesh: cabinStrip, mat: cabinStripMat });

      [-0.72, 0.72].forEach((rzOffset, railIdx) => {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, carLength - 1.2, 10), steelMat);
        rail.rotation.z = Math.PI / 2;
        rail.position.set(0, 2.38, trainZCenter + rzOffset);
        carGroup.add(rail);

        for (let h = 0; h < 4; h++) {
          const localX = -6.0 + h * 4.0;
          const baseLocalX = cx + localX;
          const pivot = new THREE.Group();
          pivot.position.set(localX, 2.38, trainZCenter + rzOffset);

          const strap = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.34, 0.018), handleStrapMat);
          strap.position.y = -0.18;
          const loop = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 10, 18), handleGripMat);
          loop.position.y = -0.4;
          pivot.add(strap, loop);
          tagSurface(pivot, 'metal');
          carGroup.add(pivot);
          interactables.push(loop);

          handles.push({
            id: `handle_${carIdx}_${railIdx}_${h}`,
            pivot,
            hitMesh: loop,
            baseLocalX,
            worldPos: new THREE.Vector3(baseLocalX + initialTrainX, 2.0, trainZCenter + rzOffset),
            state: { angleX: 0, angleZ: 0, velX: 0, velZ: 0 },
          });
        }
      });

      [-5.5, 0, 5.5].forEach((sx) => {
        const bench = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.44, 0.56), seatBlueMat);
        bench.position.set(sx, 0.28, trainZMax - 0.38);
        tagSurface(bench, 'metal');
        carGroup.add(bench);
        interactables.push(bench);
      });

      const segmentSpecs = [
        { localX: -7.2, width: 3.6, isDoor: false },
        { localX: -3.6, width: 3.0, isDoor: true },
        { localX: 0.0, width: 4.2, isDoor: false },
        { localX: 3.6, width: 3.0, isDoor: true },
        { localX: 7.2, width: 3.6, isDoor: false },
      ];
      segmentSpecs.forEach((seg, segIdx) => {
        const basePosX = cx + seg.localX;
        const farSegId = `train_far_${carIdx}_${segIdx}`;
        const farColId = `col_train_far_${carIdx}_${segIdx}`;
        const farGroup = new THREE.Group();
        farGroup.position.set(seg.localX, 0, trainZMax);
        const lower = new THREE.Mesh(new THREE.BoxGeometry(seg.width, 1.05, 0.14), trainMetalMat);
        lower.position.y = 0.525;
        const win = new THREE.Mesh(new THREE.BoxGeometry(seg.width - 0.24, 1.15, 0.08), glassMat);
        win.position.y = 1.62;
        const top = new THREE.Mesh(new THREE.BoxGeometry(seg.width, 0.56, 0.14), trainMetalMat);
        top.position.y = 2.48;
        farGroup.add(lower, win, top);
        tagSurface(lower, 'metal', farSegId);
        tagSurface(top, 'metal', farSegId);
        tagSurface(win, 'glass', farSegId);
        carGroup.add(farGroup);
        interactables.push(lower, win, top);

        const farCol: Aabb2D = {
          id: farColId,
          minX: basePosX - seg.width * 0.5 + initialTrainX,
          maxX: basePosX + seg.width * 0.5 + initialTrainX,
          minZ: trainZMax - 0.18,
          maxZ: trainZMax + 0.18,
          active: true,
        };
        colliders.push(farCol);
        const farDest: DestructibleState = {
          id: farSegId,
          category: 'train_panel',
          material: 'metal',
          hp: 95,
          maxHp: 95,
          destroyed: false,
          explosive: false,
          position: { x: basePosX + initialTrainX, y: 1.4, z: trainZMax },
          colliderId: farColId,
        };
        destructibles.push({
          state: farDest,
          mesh: farGroup,
          hitMeshes: [lower, win, top],
        });
        trainBindings.push({
          collider: farCol,
          baseMinX: basePosX - seg.width * 0.5,
          baseMaxX: basePosX + seg.width * 0.5,
          destructible: farDest,
          basePosX,
        });

        if (seg.isDoor) {
          const doorHeader = new THREE.Mesh(new THREE.BoxGeometry(seg.width, 0.56, 0.14), trainMetalMat);
          doorHeader.position.set(seg.localX, 2.48, trainZMin);
          tagSurface(doorHeader, 'metal');
          carGroup.add(doorHeader);
        } else {
          const nearSegId = `train_near_${carIdx}_${segIdx}`;
          const nearColId = `col_train_near_${carIdx}_${segIdx}`;
          const nearGroup = new THREE.Group();
          nearGroup.position.set(seg.localX, 0, trainZMin);
          const nLower = new THREE.Mesh(new THREE.BoxGeometry(seg.width, 1.05, 0.14), trainMetalMat);
          nLower.position.y = 0.525;
          const nWin = new THREE.Mesh(new THREE.BoxGeometry(seg.width - 0.24, 1.15, 0.08), glassMat);
          nWin.position.y = 1.62;
          const nTop = new THREE.Mesh(new THREE.BoxGeometry(seg.width, 0.56, 0.14), trainMetalMat);
          nTop.position.y = 2.48;
          nearGroup.add(nLower, nWin, nTop);
          tagSurface(nLower, 'metal', nearSegId);
          tagSurface(nTop, 'metal', nearSegId);
          tagSurface(nWin, 'glass', nearSegId);
          carGroup.add(nearGroup);
          interactables.push(nLower, nWin, nTop);

          const nearCol: Aabb2D = {
            id: nearColId,
            minX: basePosX - seg.width * 0.5 + initialTrainX,
            maxX: basePosX + seg.width * 0.5 + initialTrainX,
            minZ: trainZMin - 0.18,
            maxZ: trainZMin + 0.18,
            active: true,
          };
          colliders.push(nearCol);
          const nearDest: DestructibleState = {
            id: nearSegId,
            category: 'train_panel',
            material: 'metal',
            hp: 95,
            maxHp: 95,
            destroyed: false,
            explosive: false,
            position: { x: basePosX + initialTrainX, y: 1.4, z: trainZMin },
            colliderId: nearColId,
          };
          destructibles.push({
            state: nearDest,
            mesh: nearGroup,
            hitMeshes: [nLower, nWin, nTop],
          });
          trainBindings.push({
            collider: nearCol,
            baseMinX: basePosX - seg.width * 0.5,
            baseMaxX: basePosX + seg.width * 0.5,
            destructible: nearDest,
            basePosX,
          });
        }
      });
    });

    const extractionSpot = new THREE.Vector3(20.5, 0, -6.5);
    const ext = addExtractionZone(worldGroup, extractionSpot);

    return {
      stage,
      worldGroup,
      interactables,
      colliders,
      destructibles,
      handles,
      ceilingLights,
      emergencyBeacons,
      trainGroup,
      trainState: { x: initialTrainX, speed: 4.2, direction: 1, minX: -58, maxX: 58 },
      trainWheels,
      trainBindings,
      movingVehicles,
      spawnPoints: [
        new THREE.Vector3(-21.5, 0, -6.5),
        new THREE.Vector3(-21.5, 0, 1.5),
        new THREE.Vector3(21.5, 0, -6.5),
        new THREE.Vector3(21.5, 0, 1.5),
        new THREE.Vector3(0, 0, -6.8),
        new THREE.Vector3(12, 0, 1.2),
      ],
      pickupSpots: [
        new THREE.Vector3(-12.5, 0, 0.5),
        new THREE.Vector3(0, 0, -4.0),
        new THREE.Vector3(14, 0, 0.5),
        new THREE.Vector3(-16.5, 0, 2.2),
      ],
      playerSpawn: new THREE.Vector3(-15.5, 0, -0.4),
      playerSpawnYaw: -Math.PI * 0.44,
      extractionSpot,
      ...ext,
      skyColor: 0x111a28,
      fogColor: 0x111a28,
      fogDensity: 0.011,
      ambientIntensity: 0.58,
      keyLightIntensity: 0.92,
      floorBounds: { minX: -23.4, maxX: 23.4, minZ: -8.0, maxZ: 9.2 },
    };
  }

  // =========================================================================
  // STAGE 2: EXPANDED OUTSIDE TOWN ROAD (Midtown Town Boulevard)
  // =========================================================================
  if (stage === 2) {
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.asphaltRoadMap,
      roughness: 0.58,
      metalness: 0.08,
    });
    const roadMesh = new THREE.Mesh(new THREE.BoxGeometry(78, 0.6, 18), roadMat);
    roadMesh.position.set(0, -0.3, 0);
    tagSurface(roadMesh, 'concrete');
    worldGroup.add(roadMesh);
    interactables.push(roadMesh);

    // 4-Lane White Dashed Lane Dividers + Pedestrian Crosswalks
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    [-5.1, 5.1].forEach((laneZ) => {
      for (let lx = -34; lx <= 34; lx += 5.5) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.18), stripeMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(lx, 0.018, laneZ);
        worldGroup.add(dash);
      }
    });
    [-22, 0, 22].forEach((cwX) => {
      for (let cz = -7.6; cz <= 7.6; cz += 1.55) {
        const bar = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.65), stripeMat);
        bar.rotation.x = -Math.PI / 2;
        bar.position.set(cwX, 0.02, cz);
        worldGroup.add(bar);
      }
    });

    // Wide Raised North & South Town Sidewalks (5.6m each)
    [-11.8, 11.8].forEach((sz) => {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(78, 0.78, 5.6), floorMat);
      sw.position.set(0, -0.24, sz);
      tagSurface(sw, 'concrete');
      worldGroup.add(sw);
      interactables.push(sw);
    });

    // Surrounding Night Skyscrapers + Town Building Storefronts
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.skyscraperFacadeMap,
      roughness: 0.45,
      metalness: 0.4,
      emissive: 0x101824,
      emissiveIntensity: 0.48,
    });
    const shopGlassWarm = new THREE.MeshStandardMaterial({
      color: 0x262018,
      emissive: 0xd97706,
      emissiveIntensity: 0.28,
      roughness: 0.22,
      metalness: 0.55,
    });
    const shopGlassCyan = new THREE.MeshStandardMaterial({
      color: 0x132230,
      emissive: 0x0284c7,
      emissiveIntensity: 0.26,
      roughness: 0.22,
      metalness: 0.55,
    });
    const signWarmMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.15,
      roughness: 0.3,
    });
    const signCyanMat = new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.1,
      roughness: 0.3,
    });
    const awningMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.75 });

    [-32, -19, -6, 7, 20, 32].forEach((tx, idx) => {
      const h = 24 + (idx % 3) * 10;
      const bNorth = new THREE.Mesh(new THREE.BoxGeometry(11.5, h, 8.5), towerMat);
      bNorth.position.set(tx, h * 0.5 - 1, -19.2);
      const bSouth = new THREE.Mesh(new THREE.BoxGeometry(11.5, h + 4, 8.5), towerMat);
      bSouth.position.set(tx + 2, (h + 4) * 0.5 - 1, 19.2);

      const addStorefront = (cx: number, zFace: number, dirSign: 1 | -1, warm: boolean) => {
        const glass = new THREE.Mesh(
          new THREE.PlaneGeometry(7.2, 2.6),
          warm ? shopGlassWarm : shopGlassCyan,
        );
        glass.rotation.y = dirSign === 1 ? 0 : Math.PI;
        glass.position.set(cx, 1.8, zFace);
        worldGroup.add(glass);

        // Dark architectural mullions + glowing storefront fascia strip
        [-3.5, -1.2, 1.2, 3.5].forEach((mx) => {
          const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.7, 0.12), darkSteelMat);
          mullion.position.set(cx + mx, 1.8, zFace + dirSign * 0.04);
          worldGroup.add(mullion);
        });
        const signStrip = new THREE.Mesh(
          new THREE.BoxGeometry(6.8, 0.24, 0.14),
          warm ? signWarmMat : signCyanMat,
        );
        signStrip.position.set(cx, 3.3, zFace + dirSign * 0.06);
        const awning = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.22, 1.35), awningMat);
        awning.position.set(cx, 3.68, zFace + dirSign * 0.62);
        worldGroup.add(signStrip, awning);
      };

      addStorefront(tx, -14.88, 1, idx % 2 === 0);
      addStorefront(tx + 2, 14.88, -1, idx % 2 === 1);

      worldGroup.add(bNorth, bSouth);
    });

    // Street Boundaries (Expanded 76m x 29m Playable Town Corridor)
    colliders.push({ id: 'road_n', minX: -39, maxX: 39, minZ: -15.0, maxZ: -14.2, active: true });
    colliders.push({ id: 'road_s', minX: -39, maxX: 39, minZ: 14.2, maxZ: 15.0, active: true });
    colliders.push({ id: 'road_w', minX: -38.5, maxX: -37.5, minZ: -15, maxZ: 15, active: true });
    colliders.push({ id: 'road_e', minX: 37.5, maxX: 38.5, minZ: -15, maxZ: 15, active: true });

    // Meridian Tower Facade & Roadway Traffic Underpass Portals at East & West Ends
    const towerHeader = new THREE.Mesh(new THREE.BoxGeometry(2.8, 20, 32), towerMat);
    towerHeader.position.set(39.6, 14.2, 0);
    const towerPillarN = new THREE.Mesh(new THREE.BoxGeometry(2.8, 4.4, 6.5), towerMat);
    towerPillarN.position.set(39.6, 2.2, -12.2);
    const towerPillarS = towerPillarN.clone();
    towerPillarS.position.z = 12.2;
    const eastUnderpassRoof = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 18), darkConcreteMat);
    eastUnderpassRoof.position.set(47, 4.45, 0);
    const eastRoadExt = new THREE.Mesh(new THREE.BoxGeometry(16, 0.6, 18), roadMat);
    eastRoadExt.position.set(47, -0.3, 0);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.45, 8.2), darkSteelMat);
    canopy.position.set(35.6, 4.2, 0);
    const doorGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.3, 5.2),
      new THREE.MeshBasicMaterial({ color: 0x34d399 }),
    );
    doorGlow.position.set(38.1, 4.05, 0);
    const entryLight = new THREE.PointLight(0x93c5fd, 12, 24, 1.5);
    entryLight.position.set(35.0, 3.4, 0);

    // West End Midtown Overpass Portal & Lit Underpass
    const westHeader = new THREE.Mesh(new THREE.BoxGeometry(4.0, 22, 34), towerMat);
    westHeader.position.set(-41.5, 15.2, 0);
    const westPillarN = new THREE.Mesh(new THREE.BoxGeometry(4.0, 4.4, 6.5), towerMat);
    westPillarN.position.set(-41.5, 2.2, -12.2);
    const westPillarS = westPillarN.clone();
    westPillarS.position.z = 12.2;
    const westUnderpassRoof = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 18), darkConcreteMat);
    westUnderpassRoof.position.set(-48.5, 4.45, 0);
    const westRoadExt = new THREE.Mesh(new THREE.BoxGeometry(16, 0.6, 18), roadMat);
    westRoadExt.position.set(-48.5, -0.3, 0);
    const metroSign = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.36, 5.2), signWarmMat);
    metroSign.position.set(-39.3, 4.0, 0);
    const metroLight = new THREE.PointLight(0xffb86c, 10, 22, 1.5);
    metroLight.position.set(-34.0, 3.2, 0);
    worldGroup.add(
      towerHeader,
      towerPillarN,
      towerPillarS,
      eastUnderpassRoof,
      eastRoadExt,
      canopy,
      doorGlow,
      entryLight,
      westHeader,
      westPillarN,
      westPillarS,
      westUnderpassRoof,
      westRoadExt,
      metroSign,
      metroLight,
    );

    // Warm Sodium Town Streetlamps along BOTH North & South Sidewalks
    [-28, -14, 0, 14, 28].forEach((lx, lIdx) => {
      [-9.3, 9.3].forEach((lz) => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 5.6, 8), darkSteelMat);
        pole.position.set(lx, 2.8, lz);
        const lampMat = new THREE.MeshStandardMaterial({
          color: 0xffedd5,
          emissive: 0xf59e0b,
          emissiveIntensity: 2.2,
        });
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.14, 0.4), lampMat);
        head.position.set(lx, 5.6, lz > 0 ? lz - 0.65 : lz + 0.65);
        worldGroup.add(pole, head);
        if (lz < 0 || lIdx % 2 === 1) {
          const pt = new THREE.PointLight(0xffcf96, 12, 24, 1.5);
          pt.position.set(lx, 5.0, lz < 0 ? lz + 2.2 : lz - 2.2);
          worldGroup.add(pt);
          ceilingLights.push({ mesh: head, mat: lampMat, light: pt });
        }
      });
    });

    // 8 Active Moving Boulevard Vehicles (Realistic Sculpted Taxis, Police Cruisers, Sports Sedans, City Buses)
    const taxiMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0a114,
      roughness: 0.26,
      metalness: 0.35,
      clearcoat: 0.88,
      clearcoatRoughness: 0.14,
    });
    const sedanBlueMat = new THREE.MeshPhysicalMaterial({
      color: 0x3b4d63,
      roughness: 0.24,
      metalness: 0.58,
      clearcoat: 0.92,
      clearcoatRoughness: 0.12,
    });
    const sedanBurgundyMat = new THREE.MeshPhysicalMaterial({
      color: 0x6b222e,
      roughness: 0.24,
      metalness: 0.52,
      clearcoat: 0.92,
      clearcoatRoughness: 0.12,
    });
    const policeBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x111827,
      roughness: 0.22,
      metalness: 0.62,
      clearcoat: 0.94,
      clearcoatRoughness: 0.1,
    });
    const policeWhiteMat = new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      roughness: 0.24,
      metalness: 0.28,
      clearcoat: 0.85,
      clearcoatRoughness: 0.14,
    });
    const busBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x1d4ed8,
      roughness: 0.34,
      metalness: 0.38,
      clearcoat: 0.65,
      clearcoatRoughness: 0.2,
    });
    const busRoofMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.45, metalness: 0.22 });
    const carGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0b1624,
      roughness: 0.06,
      metalness: 0.25,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      transparent: true,
      opacity: 0.86,
    });
    const bumperMat = new THREE.MeshStandardMaterial({ color: 0x181c22, roughness: 0.72, metalness: 0.14 });
    const tireRubberMat = new THREE.MeshStandardMaterial({ color: 0x121417, roughness: 0.9, metalness: 0.04 });
    const alloyRimMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.2, metalness: 0.86 });
    const chromeTrimMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.14, metalness: 0.92 });
    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xfef9c3,
      emissive: 0xfde047,
      emissiveIntensity: 3.1,
      roughness: 0.12,
    });
    const taillightMat = new THREE.MeshStandardMaterial({
      color: 0xfca5a5,
      emissive: 0xef4444,
      emissiveIntensity: 2.8,
      roughness: 0.15,
    });
    const amberBeaconMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.5,
    });
    const policeBlueMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      emissive: 0x3b82f6,
      emissiveIntensity: 3.0,
    });

    // Shared Smooth Curved Fastback Sedan Body Geometry (quadratic curves + sculpted wheel arches)
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4, metalness: 0.1 });
    const drlMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xe0f2fe,
      emissiveIntensity: 2.6,
    });
    const goldBadgeMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25, metalness: 0.78 });

    const sedanShape = new THREE.Shape();
    sedanShape.moveTo(-2.08, 0.26);
    sedanShape.lineTo(-1.74, 0.26);
    sedanShape.absarc(-1.3, 0.34, 0.44, Math.PI * 1.04, -0.04, true);
    sedanShape.lineTo(0.86, 0.26);
    sedanShape.absarc(1.3, 0.34, 0.44, Math.PI * 1.04, -0.04, true);
    sedanShape.lineTo(2.04, 0.26);
    sedanShape.quadraticCurveTo(2.15, 0.56, 2.04, 0.78);
    sedanShape.quadraticCurveTo(1.58, 0.9, 1.06, 0.94);
    sedanShape.quadraticCurveTo(0.74, 1.24, 0.42, 1.42);
    sedanShape.quadraticCurveTo(-0.18, 1.49, -0.82, 1.42);
    sedanShape.quadraticCurveTo(-1.2, 1.18, -1.52, 0.98);
    sedanShape.quadraticCurveTo(-1.86, 0.96, -2.04, 0.9);
    sedanShape.quadraticCurveTo(-2.14, 0.62, -2.08, 0.26);
    sedanShape.closePath();

    const sedanBodyGeo = new THREE.ExtrudeGeometry(sedanShape, {
      steps: 1,
      depth: 1.56,
      bevelEnabled: true,
      bevelThickness: 0.09,
      bevelSize: 0.055,
      bevelSegments: 3,
      curveSegments: 14,
    });
    sedanBodyGeo.translate(0, 0, -0.78);

    // Tinted Curved Wraparound Glass Greenhouse Geometry
    const glassShape = new THREE.Shape();
    glassShape.moveTo(-1.46, 0.94);
    glassShape.lineTo(1.02, 0.94);
    glassShape.quadraticCurveTo(0.72, 1.22, 0.4, 1.38);
    glassShape.quadraticCurveTo(-0.18, 1.43, -0.78, 1.38);
    glassShape.quadraticCurveTo(-1.14, 1.16, -1.46, 0.94);
    glassShape.closePath();
    const sedanGlassGeo = new THREE.ExtrudeGeometry(glassShape, {
      steps: 1,
      depth: 1.72,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.02,
      bevelSegments: 2,
      curveSegments: 12,
    });
    sedanGlassGeo.translate(0, 0, -0.86);

    // Shared Extruded Sculpted Transit Bus Geometry (with wheel arches & sloped front windshield)
    const busShape = new THREE.Shape();
    busShape.moveTo(-3.16, 0.28);
    busShape.lineTo(-2.54, 0.28);
    busShape.absarc(-2.0, 0.42, 0.54, Math.PI * 1.06, -0.06, true);
    busShape.lineTo(1.46, 0.28);
    busShape.absarc(2.0, 0.42, 0.54, Math.PI * 1.06, -0.06, true);
    busShape.lineTo(3.14, 0.28);
    busShape.lineTo(3.2, 0.95);
    busShape.lineTo(3.04, 2.52);
    busShape.lineTo(2.74, 2.74);
    busShape.lineTo(-2.96, 2.74);
    busShape.lineTo(-3.16, 2.54);
    busShape.closePath();

    const busBodyGeo = new THREE.ExtrudeGeometry(busShape, {
      steps: 1,
      depth: 1.98,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.06,
      bevelSegments: 2,
    });
    busBodyGeo.translate(0, 0, -0.99);

    const makeAlloyWheel = (radius: number, width: number): THREE.Group => {
      const wg = new THREE.Group();
      const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, width, 18),
        tireRubberMat,
      );
      tire.rotation.x = Math.PI / 2;
      const sidewall = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 0.78, radius * 0.16, 8, 18),
        tireRubberMat,
      );
      sidewall.position.z = width * 0.42;
      const sidewallIn = sidewall.clone();
      sidewallIn.position.z = -width * 0.42;
      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width + 0.02, 16),
        alloyRimMat,
      );
      rim.rotation.x = Math.PI / 2;
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.18, radius * 0.18, width + 0.05, 10),
        bumperMat,
      );
      hub.rotation.x = Math.PI / 2;
      wg.add(tire, sidewall, sidewallIn, rim, hub);

      // 5 metallic alloy spokes on outer & inner rim faces
      for (let s = 0; s < 5; s++) {
        const angle = (s * Math.PI * 2) / 5;
        const spoke = new THREE.Mesh(
          new THREE.BoxGeometry(radius * 0.96, radius * 0.14, width + 0.04),
          chromeTrimMat,
        );
        spoke.rotation.z = angle;
        wg.add(spoke);
      }
      return wg;
    };

    const vehicleSpecs: {
      x: number;
      z: number;
      dir: 1 | -1;
      speed: number;
      kind: 'taxi' | 'sedan' | 'police' | 'bus';
    }[] = [
      { x: -16, z: -6.8, dir: -1, speed: 8.6, kind: 'taxi' },
      { x: 18, z: -6.8, dir: -1, speed: 8.6, kind: 'bus' },
      { x: 4, z: -3.4, dir: -1, speed: 10.4, kind: 'police' },
      { x: 30, z: -3.4, dir: -1, speed: 10.4, kind: 'sedan' },
      { x: -20, z: 3.4, dir: 1, speed: 10.2, kind: 'taxi' },
      { x: 12, z: 3.4, dir: 1, speed: 10.2, kind: 'police' },
      { x: -10, z: 6.8, dir: 1, speed: 8.2, kind: 'bus' },
      { x: 22, z: 6.8, dir: 1, speed: 8.2, kind: 'sedan' },
    ];

    vehicleSpecs.forEach((car, idx) => {
      const id = `vehicle_${idx}`;
      const colId = `col_vehicle_${idx}`;
      const cGroup = new THREE.Group();
      cGroup.position.set(car.x, 0, car.z);
      cGroup.rotation.y = car.dir === 1 ? 0 : Math.PI;

      const isBus = car.kind === 'bus';
      const isPolice = car.kind === 'police';
      const isTaxi = car.kind === 'taxi';
      const sedanPaint = idx % 2 === 0 ? sedanBlueMat : sedanBurgundyMat;
      const vMat = isBus ? busBodyMat : isTaxi ? taxiMat : isPolice ? policeBodyMat : sedanPaint;

      const halfLen = isBus ? 3.25 : 2.15;
      const halfDepth = isBus ? 1.15 : 0.94;
      const hitMeshes: THREE.Mesh[] = [];
      const wheels: THREE.Object3D[] = [];

      if (isBus) {
        const body = new THREE.Mesh(busBodyGeo, vMat);
        const roofCap = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.14, 1.94), busRoofMat);
        roofCap.position.set(-0.08, 2.78, 0);

        // Panoramic Bus Windshield + Side Passenger Window Ribbon + Mullions
        const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.15, 1.9), carGlassMat);
        frontGlass.position.set(3.08, 1.76, 0);
        frontGlass.rotation.z = 0.08;
        const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(5.35, 0.95, 2.12), carGlassMat);
        sideGlass.position.set(-0.05, 1.82, 0);
        const destSign = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 1.48), amberBeaconMat);
        destSign.position.set(3.04, 2.52, 0);

        // Twin Rooftop HVAC Pods + Molded Bumpers + Side Mirrors
        [-1.3, 1.1].forEach((ax) => {
          const hvac = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.22, 1.32), busRoofMat);
          hvac.position.set(ax, 2.94, 0);
          cGroup.add(hvac);
        });
        for (let mx = -2.2; mx <= 2.2; mx += 1.1) {
          const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.98, 2.14), bumperMat);
          mullion.position.set(mx, 1.82, 0);
          cGroup.add(mullion);
        }
        const fBumper = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 2.14), bumperMat);
        fBumper.position.set(3.18, 0.42, 0);
        const rBumper = fBumper.clone();
        rBumper.position.x = -3.16;
        const grille = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, 1.0), bumperMat);
        grille.position.set(3.2, 0.72, 0);

        [-1.08, 1.08].forEach((mz) => {
          const arm = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.16), bumperMat);
          arm.position.set(3.1, 1.65, mz);
          const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.12), bumperMat);
          mirror.position.set(3.22, 1.56, mz + (mz > 0 ? 0.05 : -0.05));
          cGroup.add(arm, mirror);
        });

        [-0.78, 0.78].forEach((lz) => {
          const hl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.34), headlightMat);
          hl.position.set(3.22, 0.72, lz);
          const tl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.28), taillightMat);
          tl.position.set(-3.18, 0.92, lz);
          cGroup.add(hl, tl);
        });

        [-2.0, 2.0].forEach((wx) => {
          [-1.02, 1.02].forEach((wz) => {
            const wg = makeAlloyWheel(0.42, 0.28);
            wg.position.set(wx, 0.42, wz);
            cGroup.add(wg);
            wheels.push(wg);
          });
        });

        cGroup.add(body, roofCap, frontGlass, sideGlass, destSign, fBumper, rBumper, grille);
        tagSurface(body, 'metal', id);
        tagSurface(roofCap, 'metal', id);
        tagSurface(frontGlass, 'glass', id);
        tagSurface(sideGlass, 'glass', id);
        hitMeshes.push(body, roofCap, frontGlass, sideGlass);
      } else {
        const body = new THREE.Mesh(sedanBodyGeo, vMat);
        const glass = new THREE.Mesh(sedanGlassGeo, carGlassMat);

        // Front & Rear Molded Bumpers, Chrome Grille & Lower Air Dam
        const fBumper = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 1.72), bumperMat);
        fBumper.position.set(2.08, 0.34, 0);
        const rBumper = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 1.72), bumperMat);
        rBumper.position.set(-2.06, 0.36, 0);
        const grille = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.78), bumperMat);
        grille.position.set(2.12, 0.56, 0);
        const grilleChrome = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.04, 0.82), chromeTrimMat);
        grilleChrome.position.set(2.12, 0.68, 0);
        const rockerL = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.1, 1.72), bumperMat);
        rockerL.position.set(-0.02, 0.24, 0);

        // Side Mirrors, Door Handles & Dual Chrome Exhaust Pipes
        [-0.9, 0.9].forEach((mz) => {
          const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.18), vMat);
          mirror.position.set(0.76, 0.98, mz);
          const handleF = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.04), chromeTrimMat);
          handleF.position.set(0.24, 0.82, mz > 0 ? 0.85 : -0.85);
          const handleR = handleF.clone();
          handleR.position.x = -0.56;
          cGroup.add(mirror, handleF, handleR);
        });
        [-0.48, 0.48].forEach((ez) => {
          const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.18, 8), chromeTrimMat);
          exhaust.rotation.z = Math.PI / 2;
          exhaust.position.set(-2.12, 0.25, ez);
          cGroup.add(exhaust);
        });

        // Dual Headlight Projector Clusters + DRL Eyebrows (+X front) & Wrap-around Taillights (-X rear)
        [-0.6, 0.6].forEach((lz) => {
          const hlHousing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.17, 0.38), bumperMat);
          hlHousing.position.set(2.05, 0.63, lz);
          const hlBulb = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.28), headlightMat);
          hlBulb.position.set(2.08, 0.62, lz);
          const drl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.36), drlMat);
          drl.position.set(2.08, 0.7, lz);
          const marker = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.06), amberBeaconMat);
          marker.position.set(1.94, 0.62, lz > 0 ? 0.88 : -0.88);

          const tlHousing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.4), taillightMat);
          tlHousing.position.set(-2.07, 0.73, lz);
          const revStrip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.045, 0.16), drlMat);
          revStrip.position.set(-2.08, 0.72, lz * 0.85);
          cGroup.add(hlHousing, hlBulb, drl, marker, tlHousing, revStrip);
        });

        // Front & Rear License Plates + Chrome Grille Emblem + Windshield Wipers + Sunroof
        const fPlate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 0.34), plateMat);
        fPlate.position.set(2.19, 0.38, 0);
        const rPlate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 0.34), plateMat);
        rPlate.position.set(-2.16, 0.56, 0);
        const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), chromeTrimMat);
        badge.rotation.z = Math.PI / 2;
        badge.position.set(2.16, 0.58, 0);
        const beltTrim = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.035, 1.76), chromeTrimMat);
        beltTrim.position.set(-0.2, 0.93, 0);
        const sunroof = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.03, 0.88), carGlassMat);
        sunroof.position.set(-0.08, 1.46, 0);
        [-0.25, 0.25].forEach((wz) => {
          const wiper = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.02, 0.03), bumperMat);
          wiper.position.set(0.95, 0.97, wz);
          wiper.rotation.z = 0.42;
          cGroup.add(wiper);
        });
        cGroup.add(fPlate, rPlate, badge, beltTrim, sunroof);

        // Dark Inner Wheel-Well Liners (prevents hollow gaps inside arches) + 5-Spoke Alloy Wheels
        [-1.3, 1.3].forEach((wx) => {
          const well = new THREE.Mesh(
            new THREE.CylinderGeometry(0.42, 0.42, 1.56, 14, 1, false, 0, Math.PI),
            bumperMat,
          );
          well.rotation.x = Math.PI / 2;
          well.position.set(wx, 0.34, 0);
          cGroup.add(well);

          [-0.82, 0.82].forEach((wz) => {
            const wg = makeAlloyWheel(0.35, 0.24);
            wg.position.set(wx, 0.35, wz);
            cGroup.add(wg);
            wheels.push(wg);
          });
        });

        // Distinct Livery Accents (Taxi Checker Belt & Beacon / Police White Doors, Badges & Pushbar / Sports Lip Spoiler)
        if (isTaxi) {
          const taxiSign = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.17, 0.62), amberBeaconMat);
          taxiSign.position.set(-0.14, 1.56, 0);
          const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.1, 1.75), bumperMat);
          stripe.position.set(-0.1, 0.62, 0);
          for (let cx = -0.75; cx <= 0.65; cx += 0.28) {
            const chk = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 1.77), plateMat);
            chk.position.set(cx, 0.62, 0);
            cGroup.add(chk);
          }
          cGroup.add(taxiSign, stripe);
        } else if (isPolice) {
          const whiteRoof = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.06, 1.54), policeWhiteMat);
          whiteRoof.position.set(-0.16, 1.47, 0);
          const whiteDoors = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.54, 1.73), policeWhiteMat);
          whiteDoors.position.set(-0.12, 0.64, 0);
          const starL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 1.76), goldBadgeMat);
          starL.position.set(-0.12, 0.66, 0);
          const pushBar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.36, 0.88), bumperMat);
          pushBar.position.set(2.22, 0.48, 0);
          [-0.24, 0.24].forEach((sz) => {
            const spot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 10), drlMat);
            spot.rotation.z = Math.PI / 2;
            spot.position.set(2.24, 0.64, sz);
            cGroup.add(spot);
          });
          const barRed = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.48), taillightMat);
          barRed.position.set(-0.14, 1.56, -0.26);
          const barBlue = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.48), policeBlueMat);
          barBlue.position.set(-0.14, 1.56, 0.26);
          cGroup.add(whiteRoof, whiteDoors, starL, pushBar, barRed, barBlue);
          tagSurface(whiteDoors, 'metal', id);
          hitMeshes.push(whiteDoors);
        } else {
          // Sports Sedan Rear Decklid Lip Spoiler
          const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 1.56), vMat);
          spoiler.position.set(-1.98, 0.98, 0);
          spoiler.rotation.z = 0.16;
          cGroup.add(spoiler);
        }

        cGroup.add(body, glass, fBumper, rBumper, grille, grilleChrome, rockerL);
        const bPillar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.5, 1.8), bumperMat);
        bPillar.position.set(-0.18, 1.18, 0);
        const cPillar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.44, 1.78), vMat);
        cPillar.position.set(-1.05, 1.14, 0);
        cPillar.rotation.z = 0.68;
        cGroup.add(bPillar, cPillar);
        tagSurface(body, 'metal', id);
        tagSurface(glass, 'glass', id);
        hitMeshes.push(body, glass);
      }

      worldGroup.add(cGroup);
      interactables.push(...hitMeshes);

      // Keep moving vehicle AABB inactive so traffic flows smoothly through lanes without hitting/blocking anyone
      const collider: Aabb2D = {
        id: colId,
        minX: car.x - halfLen,
        maxX: car.x + halfLen,
        minZ: car.z - halfDepth,
        maxZ: car.z + halfDepth,
        active: false,
      };
      const initialHp = isBus ? 210 : 120;
      const destBinding: DestructibleBinding = {
        state: {
          id,
          category: 'vehicle',
          material: 'metal',
          hp: initialHp,
          maxHp: initialHp,
          destroyed: false,
          explosive: true,
          position: { x: car.x, y: 0.9, z: car.z },
          colliderId: colId,
        },
        mesh: cGroup,
        hitMeshes,
      };
      destructibles.push(destBinding);

      movingVehicles.push({
        id,
        group: cGroup,
        wheels,
        state: {
          x: car.x,
          z: car.z,
          speed: car.speed,
          direction: car.dir,
          minX: -46,
          maxX: 46,
          destroyed: false,
          respawnTimer: 0,
        },
        halfLen,
        halfDepth,
        collider,
        destructible: destBinding,
        initialHp,
        hasCountedBreach: false,
      });
    });

    // Barrels & Supply Crates on Sidewalks & Median
    [
      { x: -24, z: 9.2 },
      { x: -5, z: -9.2 },
      { x: 6.5, z: 9.2 },
      { x: 16.5, z: -9.2 },
      { x: 28, z: -9.2 },
    ].forEach((b, idx) =>
      addBarrelProp(worldGroup, interactables, colliders, destructibles, idx, b.x, b.z, barrelRedMat, hazardYellowMat, darkSteelMat),
    );
    [
      { x: -16, z: -10.8 },
      { x: -3, z: 10.8 },
      { x: 9, z: -10.8 },
      { x: 21, z: 10.8 },
      { x: 30, z: -10.8 },
    ].forEach((c, idx) =>
      addCrateProp(worldGroup, interactables, colliders, destructibles, idx, c.x, c.z, woodMat, darkSteelMat),
    );

    const extractionSpot = new THREE.Vector3(34.5, 0, 0);
    const ext = addExtractionZone(worldGroup, extractionSpot);

    return {
      stage,
      worldGroup,
      interactables,
      colliders,
      destructibles,
      handles,
      ceilingLights,
      emergencyBeacons,
      trainGroup,
      trainWheels,
      trainBindings,
      movingVehicles,
      spawnPoints: [
        new THREE.Vector3(31, 0, -10.5),
        new THREE.Vector3(31, 0, 10.5),
        new THREE.Vector3(14, 0, -11.5),
        new THREE.Vector3(14, 0, 11.5),
        new THREE.Vector3(-5, 0, -11.5),
        new THREE.Vector3(-5, 0, 11.5),
      ],
      pickupSpots: [
        new THREE.Vector3(-23, 0, -10.5),
        new THREE.Vector3(-2, 0, 0.0),
        new THREE.Vector3(16, 0, 10.5),
        new THREE.Vector3(27, 0, -10.5),
      ],
      playerSpawn: new THREE.Vector3(-33.5, 0, 0),
      playerSpawnYaw: -Math.PI / 2,
      extractionSpot,
      ...ext,
      skyColor: 0x16243a,
      fogColor: 0x16243a,
      fogDensity: 0.008,
      ambientIntensity: 0.64,
      keyLightIntensity: 1.05,
      floorBounds: { minX: -36.5, maxX: 36.5, minZ: -13.5, maxZ: 13.5 },
    };
  }

  // =========================================================================
  // STAGE 3: INSIDE BUILDING (Meridian Corporate Lobby)
  // =========================================================================
  if (stage === 3) {
    const marbleMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.marbleLobbyMap,
      roughness: 0.42,
      metalness: 0.14,
    });
    const lobbyWallMat = new THREE.MeshStandardMaterial({
      color: 0x262d38,
      normalMap: textures.concreteNormal,
      roughness: 0.68,
      metalness: 0.12,
    });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(46, 0.8, 20), marbleMat);
    floor.position.set(0, -0.4, 0);
    tagSurface(floor, 'tile');
    worldGroup.add(floor);
    interactables.push(floor);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(46, 0.5, 20), darkConcreteMat);
    roof.position.set(0, 5.4, 0);
    worldGroup.add(roof);

    // Perimeter Walls
    const nWall = new THREE.Mesh(new THREE.BoxGeometry(46, 5.6, 0.5), lobbyWallMat);
    nWall.position.set(0, 2.8, -9.8);
    const sWall = nWall.clone();
    sWall.position.z = 9.8;
    const wWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.6, 20), lobbyWallMat);
    wWall.position.set(-22.8, 2.8, 0);
    const eWall = wWall.clone();
    eWall.position.x = 22.8;
    tagSurface(nWall, 'concrete');
    tagSurface(sWall, 'concrete');
    tagSurface(wWall, 'concrete');
    tagSurface(eWall, 'concrete');
    worldGroup.add(nWall, sWall, wWall, eWall);
    interactables.push(nWall, sWall, wWall, eWall);

    colliders.push({ id: 'lob_n', minX: -23.5, maxX: 23.5, minZ: -10.3, maxZ: -9.4, active: true });
    colliders.push({ id: 'lob_s', minX: -23.5, maxX: 23.5, minZ: 9.4, maxZ: 10.3, active: true });
    colliders.push({ id: 'lob_w', minX: -23.3, maxX: -22.3, minZ: -10, maxZ: 10, active: true });
    colliders.push({ id: 'lob_e', minX: 22.3, maxX: 23.3, minZ: -10, maxZ: 10, active: true });

    // Architectural Ceiling Chandelier Strips + North & South Aisle Lights
    [-16, -6, 4, 15].forEach((lx) => {
      const stripMat = new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        emissive: 0xfde68a,
        emissiveIntensity: 1.55,
      });
      const strip = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 0.65), stripMat);
      strip.position.set(lx, 5.08, 0);
      const pt = new THREE.PointLight(0xffe7ba, 11, 22, 1.45);
      pt.position.set(lx, 4.7, 0);
      worldGroup.add(strip, pt);
      ceilingLights.push({ mesh: strip, mat: stripMat, light: pt });

      [-5.6, 5.6].forEach((aisleZ) => {
        const sStrip = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.35), stripMat);
        sStrip.position.set(lx, 5.08, aisleZ);
        worldGroup.add(sStrip);
      });
    });

    // Illuminated Side-Aisle Fill Lights & Meridian Corporate Lobby Features
    [-10, 8].forEach((lx) => {
      const fillN = new THREE.PointLight(0xdbeafe, 6.5, 18, 1.55);
      fillN.position.set(lx, 4.4, -6.2);
      const fillS = new THREE.PointLight(0xdbeafe, 6.5, 18, 1.55);
      fillS.position.set(lx, 4.4, 6.2);
      worldGroup.add(fillN, fillS);
    });

    // 3-Door Illuminated Elevator Bank on North Wall
    const elevTrimMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.75,
    });
    [-12, -6, 0].forEach((ex) => {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.4, 0.2), darkSteelMat);
      frame.position.set(ex, 1.7, -9.45);
      const door = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.0, 0.12), steelMat);
      door.position.set(ex, 1.5, -9.36);
      const header = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, 0.16), elevTrimMat);
      header.position.set(ex, 3.55, -9.35);
      worldGroup.add(frame, door, header);
    });

    // West Street Entry Glass Curtain + East Roof Stairwell Portal
    const entryPortal = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.6, 6.4), glassMat);
    entryPortal.position.set(-22.45, 1.8, 0);
    const roofDoorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.32, 3.4, 3.4), darkSteelMat);
    roofDoorFrame.position.set(22.4, 1.7, -6.2);
    const roofExitSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.42, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x064e3b, emissive: 0x10b981, emissiveIntensity: 1.5 }),
    );
    roofExitSign.position.set(22.3, 3.2, -6.2);
    worldGroup.add(entryPortal, roofDoorFrame, roofExitSign);

    // Lobby Security Reception Desk at Center-West
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.08, 4.6), darkSteelMat);
    desk.position.set(-14.5, 0.54, 0);
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.12, 4.8), marbleMat);
    deskTop.position.set(-14.5, 1.12, 0);
    const monitor = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.46, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xbae6fd, emissive: 0x38bdf8, emissiveIntensity: 1.1 }),
    );
    monitor.position.set(-14.4, 1.45, 0.6);
    worldGroup.add(desk, deskTop, monitor);
    interactables.push(desk, deskTop);
    colliders.push({ id: 'lob_desk', minX: -15.3, maxX: -13.7, minZ: -2.4, maxZ: 2.4, active: true });

    // Destructible Marble Columns
    [
      { x: -10, z: -4.2 },
      { x: -10, z: 4.2 },
      { x: 2, z: -4.2 },
      { x: 2, z: 4.2 },
      { x: 13, z: -4.2 },
      { x: 13, z: 4.2 },
    ].forEach((p, idx) => {
      const id = `lobby_pillar_${idx}`;
      const colId = `col_lobby_pillar_${idx}`;
      const pGroup = new THREE.Group();
      pGroup.position.set(p.x, 0, p.z);

      const core = new THREE.Mesh(new THREE.BoxGeometry(0.32, 5.2, 0.32), steelMat);
      core.position.y = 2.6;
      const shell = new THREE.Mesh(new THREE.BoxGeometry(0.95, 5.1, 0.95), lobbyWallMat);
      shell.position.y = 2.55;
      pGroup.add(core, shell);
      tagSurface(core, 'metal');
      tagSurface(shell, 'tile', id);
      worldGroup.add(pGroup);
      interactables.push(core, shell);

      colliders.push({ id: colId, minX: p.x - 0.55, maxX: p.x + 0.55, minZ: p.z - 0.55, maxZ: p.z + 0.55, active: true });
      destructibles.push({
        state: {
          id,
          category: 'pillar',
          material: 'tile',
          hp: 135,
          maxHp: 135,
          destroyed: false,
          explosive: false,
          position: { x: p.x, y: 1.5, z: p.z },
          colliderId: colId,
        },
        mesh: shell,
        damagedCore: core,
        hitMeshes: [shell],
      });
    });

    // Destructible Glass Office Partitions & Reception Desk
    [
      { x: -4.5, z: 0 },
      { x: 7.5, z: -2.0 },
      { x: 7.5, z: 2.0 },
    ].forEach((gp, idx) => {
      const id = `glass_part_${idx}`;
      const colId = `col_glass_${idx}`;
      const gGroup = new THREE.Group();
      gGroup.position.set(gp.x, 0, gp.z);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 3.4), darkSteelMat);
      base.position.y = 0.45;
      const pane = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 3.2), glassMat);
      pane.position.y = 1.8;
      gGroup.add(base, pane);
      tagSurface(base, 'metal', id);
      tagSurface(pane, 'glass', id);
      worldGroup.add(gGroup);
      interactables.push(base, pane);

      colliders.push({ id: colId, minX: gp.x - 0.25, maxX: gp.x + 0.25, minZ: gp.z - 1.75, maxZ: gp.z + 1.75, active: true });
      destructibles.push({
        state: {
          id,
          category: 'glass_partition',
          material: 'glass',
          hp: 55,
          maxHp: 55,
          destroyed: false,
          explosive: false,
          position: { x: gp.x, y: 1.2, z: gp.z },
          colliderId: colId,
        },
        mesh: gGroup,
        hitMeshes: [base, pane],
      });
    });

    // Crates & Barrels
    [
      { x: -7, z: 0 },
      { x: 10.5, z: 0 },
      { x: 16.5, z: 5.5 },
    ].forEach((b, idx) =>
      addBarrelProp(worldGroup, interactables, colliders, destructibles, idx, b.x, b.z, barrelRedMat, hazardYellowMat, darkSteelMat),
    );
    [
      { x: -13, z: -6.5 },
      { x: 4, z: 6.5 },
    ].forEach((c, idx) =>
      addCrateProp(worldGroup, interactables, colliders, destructibles, idx, c.x, c.z, woodMat, darkSteelMat),
    );

    const extractionSpot = new THREE.Vector3(20.0, 0, -6.2);
    const ext = addExtractionZone(worldGroup, extractionSpot);

    return {
      stage,
      worldGroup,
      interactables,
      colliders,
      destructibles,
      handles,
      ceilingLights,
      emergencyBeacons,
      trainGroup,
      trainWheels,
      trainBindings,
      movingVehicles,
      spawnPoints: [
        new THREE.Vector3(19.5, 0, -6.5),
        new THREE.Vector3(19.5, 0, 6.5),
        new THREE.Vector3(6.0, 0, -8.0),
        new THREE.Vector3(6.0, 0, 8.0),
        new THREE.Vector3(-4.0, 0, -8.0),
        new THREE.Vector3(-4.0, 0, 8.0),
      ],
      pickupSpots: [
        new THREE.Vector3(-14, 0, 3.5),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(14, 0, -3.5),
      ],
      playerSpawn: new THREE.Vector3(-19.0, 0, 0),
      playerSpawnYaw: -Math.PI / 2,
      extractionSpot,
      ...ext,
      skyColor: 0x182130,
      fogColor: 0x182130,
      fogDensity: 0.009,
      ambientIntensity: 0.66,
      keyLightIntensity: 0.95,
      floorBounds: { minX: -22.0, maxX: 22.0, minZ: -9.0, maxZ: 9.0 },
    };
  }

  // =========================================================================
  // STAGE 4: BUILDING ROOF (Skyline Helipad Extraction)
  // =========================================================================
  const roofFloorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.rooftopMap,
    roughness: 0.85,
    metalness: 0.06,
  });
  const roofDeck = new THREE.Mesh(new THREE.BoxGeometry(46, 0.8, 22), roofFloorMat);
  roofDeck.position.set(0, -0.4, 0);
  tagSurface(roofDeck, 'concrete');
  worldGroup.add(roofDeck);
  interactables.push(roofDeck);

  // Concrete Parapet Walls around Rooftop Perimeter
  const parapetN = new THREE.Mesh(new THREE.BoxGeometry(46, 1.35, 0.55), darkConcreteMat);
  parapetN.position.set(0, 0.675, -10.8);
  const parapetS = parapetN.clone();
  parapetS.position.z = 10.8;
  const parapetW = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.35, 22), darkConcreteMat);
  parapetW.position.set(-22.8, 0.675, 0);
  const parapetE = parapetW.clone();
  parapetE.position.x = 22.8;
  tagSurface(parapetN, 'concrete');
  tagSurface(parapetS, 'concrete');
  tagSurface(parapetW, 'concrete');
  tagSurface(parapetE, 'concrete');
  worldGroup.add(parapetN, parapetS, parapetW, parapetE);
  interactables.push(parapetN, parapetS, parapetW, parapetE);

  colliders.push({ id: 'rf_n', minX: -23.4, maxX: 23.4, minZ: -11.3, maxZ: -10.4, active: true });
  colliders.push({ id: 'rf_s', minX: -23.4, maxX: 23.4, minZ: 10.4, maxZ: 11.3, active: true });
  colliders.push({ id: 'rf_w', minX: -23.3, maxX: -22.4, minZ: -11, maxZ: 11, active: true });
  colliders.push({ id: 'rf_e', minX: 22.4, maxX: 23.3, minZ: -11, maxZ: 11, active: true });

  // Helipad Landing Circle + 'H' Markings + 8 Perimeter LED Approach Pucks at (8, 0)
  const helipadRing = new THREE.Mesh(
    new THREE.RingGeometry(4.1, 4.45, 40),
    new THREE.MeshBasicMaterial({ color: 0xeab308, side: THREE.DoubleSide }),
  );
  helipadRing.rotation.x = -Math.PI / 2;
  helipadRing.position.set(8, 0.02, 0);
  const hLeft = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 3.6), new THREE.MeshBasicMaterial({ color: 0xeab308 }));
  hLeft.rotation.x = -Math.PI / 2;
  hLeft.position.set(6.7, 0.025, 0);
  const hRight = hLeft.clone();
  hRight.position.x = 9.3;
  const hBar = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.55), new THREE.MeshBasicMaterial({ color: 0xeab308 }));
  hBar.rotation.x = -Math.PI / 2;
  hBar.position.set(8, 0.025, 0);
  worldGroup.add(helipadRing, hLeft, hRight, hBar);

  const padLedMat = new THREE.MeshStandardMaterial({
    color: 0xa7f3d0,
    emissive: 0x10b981,
    emissiveIntensity: 2.5,
  });
  for (let p = 0; p < 8; p++) {
    const a = (p * Math.PI * 2) / 8;
    const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.09, 10), padLedMat);
    puck.position.set(8 + Math.cos(a) * 4.55, 0.045, Math.sin(a) * 4.55);
    worldGroup.add(puck);
  }

  // Twin-Turbine Tactical Rescue Helicopter Landing on the Rooftop Helipad
  const heliAnchor = new THREE.Vector3(8.0, 0, 0);
  const heliBaseYaw = Math.PI + 0.34;
  const heliState = createInitialHelicopterState();
  const heliGroup = new THREE.Group();
  heliGroup.position.set(
    heliAnchor.x + heliState.offsetX,
    heliState.altitude,
    heliAnchor.z + heliState.offsetZ,
  );
  heliGroup.rotation.y = heliBaseYaw;

  const heliHullMat = new THREE.MeshPhysicalMaterial({
    color: 0x263140,
    roughness: 0.42,
    metalness: 0.52,
    clearcoat: 0.45,
    clearcoatRoughness: 0.25,
  });
  const heliStripeMat = new THREE.MeshStandardMaterial({
    color: 0xea580c,
    roughness: 0.35,
    metalness: 0.25,
  });
  const heliCanopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x0c1e32,
    roughness: 0.06,
    metalness: 0.25,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.78,
  });
  const heliRotorMat = new THREE.MeshStandardMaterial({ color: 0x161a21, roughness: 0.5, metalness: 0.45 });
  const heliTipMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xca8a04,
    emissiveIntensity: 0.4,
    roughness: 0.35,
  });
  const heliBeaconMat = new THREE.MeshStandardMaterial({
    color: 0xfca5a5,
    emissive: 0xef4444,
    emissiveIntensity: 3.0,
  });
  const heliGreenNav = new THREE.MeshStandardMaterial({
    color: 0x86efac,
    emissive: 0x22c55e,
    emissiveIntensity: 2.8,
  });
  const heliAvionicsMat = new THREE.MeshStandardMaterial({
    color: 0x67e8f9,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.9,
  });

  // 1. Sculpted Aerodynamic Fuselage (ExtrudeGeometry with curved nose, belly & engine fairing)
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-2.7, 0.85);
  hullShape.lineTo(1.75, 0.72);
  hullShape.quadraticCurveTo(2.95, 0.78, 3.55, 1.05);
  hullShape.quadraticCurveTo(3.82, 1.32, 3.45, 1.65);
  hullShape.quadraticCurveTo(2.75, 2.25, 1.75, 2.68);
  hullShape.quadraticCurveTo(0.4, 2.88, -1.65, 2.75);
  hullShape.quadraticCurveTo(-2.5, 2.55, -2.95, 1.85);
  hullShape.lineTo(-2.7, 0.85);
  hullShape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    steps: 1,
    depth: 1.78,
    bevelEnabled: true,
    bevelThickness: 0.18,
    bevelSize: 0.14,
    bevelSegments: 3,
    curveSegments: 14,
  });
  hullGeo.translate(0, 0, -0.89);
  const heliFuselage = new THREE.Mesh(hullGeo, heliHullMat);

  // Nose Radome + Sloped Cockpit Glass Canopy + Internal Avionics Console
  const noseCone = new THREE.Mesh(new THREE.SphereGeometry(0.76, 14, 12), heliHullMat);
  noseCone.scale.set(1.35, 0.76, 0.92);
  noseCone.position.set(3.25, 1.24, 0);

  const canopyShape = new THREE.Shape();
  canopyShape.moveTo(1.55, 1.55);
  canopyShape.lineTo(3.38, 1.36);
  canopyShape.quadraticCurveTo(2.8, 2.18, 1.82, 2.62);
  canopyShape.lineTo(1.5, 2.56);
  canopyShape.closePath();
  const canopyGeo = new THREE.ExtrudeGeometry(canopyShape, {
    steps: 1,
    depth: 1.66,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.04,
    bevelSegments: 2,
    curveSegments: 10,
  });
  canopyGeo.translate(0, 0, -0.83);
  const canopyGlass = new THREE.Mesh(canopyGeo, heliCanopyMat);
  const windshieldDivider = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.08), darkSteelMat);
  windshieldDivider.position.set(2.45, 2.02, 0);
  windshieldDivider.rotation.z = -0.58;
  const avionicsDash = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.24, 1.15), heliAvionicsMat);
  avionicsDash.position.set(2.35, 1.56, 0);

  // Orange Rescue Livery Stripes + Open Side Rescue Cabin Doors + Winch Hoist
  const stripeSide = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.24, 2.12), heliStripeMat);
  stripeSide.position.set(-0.25, 1.28, 0);
  const cabinDoorOpening = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.15, 2.1), darkSteelMat);
  cabinDoorOpening.position.set(0.15, 1.68, 0);
  const winchArm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.58), steelMat);
  winchArm.position.set(0.55, 2.48, 1.15);
  const winchDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.26, 10), heliStripeMat);
  winchDrum.rotation.z = Math.PI / 2;
  winchDrum.position.set(0.55, 2.48, 1.38);

  // Twin Turboshaft Engine Nacelles & Angled Exhaust Pipes
  [-0.48, 0.48].forEach((ez) => {
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 2.15, 12), heliHullMat);
    nacelle.rotation.z = Math.PI / 2;
    nacelle.position.set(-0.55, 2.86, ez);
    const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.14, 12), darkSteelMat);
    intake.rotation.z = Math.PI / 2;
    intake.position.set(0.55, 2.86, ez);
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.27, 0.45, 12), steelMat);
    exhaust.rotation.z = Math.PI / 2 - 0.18;
    exhaust.position.set(-1.78, 2.84, ez);
    heliGroup.add(nacelle, intake, exhaust);
  });

  // Swept Tapered Tail Boom + Vertical Fin + Horizontal Stabilizers + Tail Skid
  const tailBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.46, 5.2, 12), heliHullMat);
  tailBoom.rotation.z = Math.PI / 2 - 0.07;
  tailBoom.position.set(-4.85, 2.02, 0);

  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(1.25, 0);
  finShape.lineTo(0.45, 1.85);
  finShape.lineTo(-0.35, 1.85);
  finShape.closePath();
  const tailFinGeo = new THREE.ExtrudeGeometry(finShape, {
    steps: 1,
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 1,
  });
  tailFinGeo.translate(0, 0, -0.08);
  const tailFin = new THREE.Mesh(tailFinGeo, heliHullMat);
  tailFin.position.set(-7.55, 2.05, 0);

  const hStab = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.09, 2.7), heliHullMat);
  hStab.position.set(-6.35, 1.98, 0);
  [-1.35, 1.35].forEach((sz) => {
    const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.46, 0.08), heliStripeMat);
    endplate.position.set(-6.35, 2.05, sz);
    heliGroup.add(endplate);
  });
  const tailBeaconBulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), heliBeaconMat);
  tailBeaconBulb.position.set(-7.3, 4.0, 0);

  // Stub Wings with Red (Port) / Green (Starboard) Aviation Nav Lights
  const stubWing = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.14, 3.2), heliHullMat);
  stubWing.position.set(0.2, 1.15, 0);
  const navRed = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), heliBeaconMat);
  navRed.position.set(0.25, 1.16, -1.62);
  const navGreen = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), heliGreenNav);
  navGreen.position.set(0.25, 1.16, 1.62);

  // Tubular Heavy-Duty Steel Landing Skids (resting cleanly at y=0.06)
  [-1.08, 1.08].forEach((sz) => {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.6, 10), steelMat);
    skid.rotation.x = Math.PI / 2;
    skid.rotation.z = Math.PI / 2;
    skid.position.set(0.45, 0.07, sz);
    const tipUp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.48, 8), steelMat);
    tipUp.rotation.z = -0.82;
    tipUp.position.set(2.9, 0.22, sz);
    heliGroup.add(skid, tipUp);

    [1.65, -0.85].forEach((sx) => {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.96, 8), darkSteelMat);
      strut.position.set(sx, 0.46, sz * 0.85);
      strut.rotation.x = sz > 0 ? 0.34 : -0.34;
      heliGroup.add(strut);
    });
  });

  // Nose FLIR Sensor Turret & Gimballed Landing Searchlight + Volumetric Beam
  const flirBall = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), darkSteelMat);
  flirBall.position.set(3.45, 0.84, 0);
  const searchLens = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfef3c7, emissiveIntensity: 3.5 }),
  );
  searchLens.position.set(2.85, 0.72, 0.45);
  const searchLight = new THREE.PointLight(0xfef3c7, 14, 28, 1.35);
  searchLight.position.set(3.4, 0.4, 0.5);
  const beamCanvas = document.createElement('canvas');
  beamCanvas.width = 16;
  beamCanvas.height = 128;
  const bctx = beamCanvas.getContext('2d');
  if (bctx) {
    const grad = bctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#fef3c7');
    grad.addColorStop(0.45, '#786e4a');
    grad.addColorStop(1, '#000000');
    bctx.fillStyle = grad;
    bctx.fillRect(0, 0, 16, 128);
  }
  const beamTex = new THREE.CanvasTexture(beamCanvas);
  const searchBeamMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: beamTex,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const searchBeam = new THREE.Mesh(new THREE.ConeGeometry(2.3, 7.2, 20, 1, true), searchBeamMat);
  searchBeam.position.set(4.8, -2.5, 0.45);
  searchBeam.rotation.z = 0.55;

  // Articulated 4-Blade Main Rotor Assembly
  const mainRotor = new THREE.Group();
  mainRotor.position.set(0.25, 3.36, 0);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.56, 12), darkSteelMat);
  mast.position.y = -0.22;
  const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.24, 12), steelMat);
  mainRotor.add(mast, hubCap);
  for (let b = 0; b < 4; b++) {
    const bladePivot = new THREE.Group();
    bladePivot.rotation.y = (b * Math.PI) / 2;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(4.75, 0.045, 0.3), heliRotorMat);
    blade.position.set(2.55, 0.02, 0);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.048, 0.31), heliTipMat);
    tip.position.set(4.7, 0.02, 0);
    bladePivot.add(blade, tip);
    mainRotor.add(bladePivot);
  }

  // Spinning 4-Blade Tail Rotor Assembly
  const tailRotor = new THREE.Group();
  tailRotor.position.set(-7.15, 3.15, 0.22);
  const tHub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.18, 10), steelMat);
  tHub.rotation.x = Math.PI / 2;
  tailRotor.add(tHub);
  for (let b = 0; b < 4; b++) {
    const tBladePivot = new THREE.Group();
    tBladePivot.rotation.z = (b * Math.PI) / 2;
    const tBlade = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.14, 0.03), heliRotorMat);
    tBlade.position.set(0.52, 0, 0);
    const tTip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.145, 0.032), heliTipMat);
    tTip.position.set(0.95, 0, 0);
    tBladePivot.add(tBlade, tTip);
    tailRotor.add(tBladePivot);
  }

  heliGroup.add(
    heliFuselage,
    noseCone,
    canopyGlass,
    windshieldDivider,
    avionicsDash,
    stripeSide,
    cabinDoorOpening,
    winchArm,
    winchDrum,
    tailBoom,
    tailFin,
    hStab,
    tailBeaconBulb,
    stubWing,
    navRed,
    navGreen,
    flirBall,
    searchLens,
    searchLight,
    searchBeam,
    mainRotor,
    tailRotor,
  );
  tagSurface(heliFuselage, 'metal');
  tagSurface(canopyGlass, 'glass');
  worldGroup.add(heliGroup);
  interactables.push(heliFuselage, canopyGlass);

  // Soft collider around landed helicopter cabin core so player & enemies walk cleanly alongside open rescue doors
  colliders.push({ id: 'rf_heli_core', minX: 6.1, maxX: 9.9, minZ: -1.15, maxZ: 1.15, active: true });

  const helicopter: HelicopterRig = {
    group: heliGroup,
    anchorPos: heliAnchor,
    baseYaw: heliBaseYaw,
    mainRotor,
    tailRotor,
    beaconMat: heliBeaconMat,
    searchLight,
    searchBeam,
    state: heliState,
  };

  // Surrounding Illuminated 360° City Skyline Towers
  const cityMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.skyscraperFacadeMap,
    roughness: 0.45,
    metalness: 0.4,
    emissive: 0x162238,
    emissiveIntensity: 0.72,
  });
  [
    { x: -34, z: -26, w: 14, d: 14, h: 48 },
    { x: -12, z: -30, w: 16, d: 14, h: 60 },
    { x: 14, z: -28, w: 15, d: 15, h: 52 },
    { x: 36, z: -22, w: 14, d: 14, h: 50 },
    { x: 39, z: 0, w: 14, d: 18, h: 58 },
    { x: 36, z: 22, w: 16, d: 14, h: 46 },
    { x: 14, z: 30, w: 16, d: 14, h: 54 },
    { x: -10, z: 30, w: 16, d: 14, h: 48 },
    { x: -34, z: 26, w: 14, d: 14, h: 44 },
    { x: -39, z: 0, w: 14, d: 18, h: 52 },
  ].forEach((t) => {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(t.w, t.h, t.d), cityMat);
    tower.position.set(t.x, t.h * 0.5 - 30, t.z);
    worldGroup.add(tower);
  });

  // Rooftop Stairwell Penthouse Access Bulkhead at West End
  const stairHouse = new THREE.Mesh(new THREE.BoxGeometry(3.8, 3.2, 4.6), darkConcreteMat);
  stairHouse.position.set(-20.4, 1.6, -6.4);
  const stairDoor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.4, 2.2), darkSteelMat);
  stairDoor.position.set(-18.45, 1.2, -6.4);
  const roofAccessBadge = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.36, 1.8),
    new THREE.MeshStandardMaterial({ color: 0x064e3b, emissive: 0x34d399, emissiveIntensity: 1.5 }),
  );
  roofAccessBadge.position.set(-18.4, 2.7, -6.4);
  worldGroup.add(stairHouse, stairDoor, roofAccessBadge);
  interactables.push(stairHouse);
  colliders.push({ id: 'rf_stairhouse', minX: -22.4, maxX: -18.4, minZ: -8.8, maxZ: -4.0, active: true });

  // Aviation Red Beacons at 4 Rooftop Corners
  [
    { x: -22.2, z: -10.2 },
    { x: 22.2, z: -10.2 },
    { x: -22.2, z: 10.2 },
    { x: 22.2, z: 10.2 },
  ].forEach((c) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 8), darkSteelMat);
    post.position.set(c.x, 1.7, c.z);
    const bMat = new THREE.MeshStandardMaterial({
      color: 0x7f1d1d,
      emissive: 0xef4444,
      emissiveIntensity: 2.2,
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), bMat);
    bulb.position.set(c.x, 2.2, c.z);
    const pt = new THREE.PointLight(0xef4444, 6.0, 14, 1.8);
    pt.position.set(c.x, 2.35, c.z);
    worldGroup.add(post, bulb, pt);
    emergencyBeacons.push({ mat: bMat, light: pt });
  });

  // Floodlight Poles Illuminating BOTH North & South Sides of Helipad
  [-12, 2, 15].forEach((lx) => {
    [-10.2, 10.2].forEach((lz) => {
      const floodMat = new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        emissive: 0xbae6fd,
        emissiveIntensity: 1.65,
      });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.2, 8), darkSteelMat);
      pole.position.set(lx, 2.1, lz);
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.25, 0.22), floodMat);
      bulb.position.set(lx, 4.2, lz < 0 ? lz + 0.2 : lz - 0.2);
      const pt = new THREE.PointLight(0xe0f2fe, 10.5, 24, 1.45);
      pt.position.set(lx, 4.0, lz < 0 ? lz + 2.0 : lz - 2.0);
      worldGroup.add(pole, bulb, pt);
      ceilingLights.push({ mesh: bulb, mat: floodMat, light: pt });
    });
  });

  // Destructible HVAC Units & Rooftop Structures
  [
    { x: -11, z: -5.5 },
    { x: -11, z: 5.5 },
    { x: -2, z: -6.5 },
    { x: 18, z: 6.2 },
  ].forEach((hv, idx) => {
    const id = `hvac_${idx}`;
    const colId = `col_hvac_${idx}`;
    const hGroup = new THREE.Group();
    hGroup.position.set(hv.x, 0, hv.z);
    const unit = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.5, 1.8), steelMat);
    unit.position.y = 0.75;
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.16, 14), darkSteelMat);
    fan.position.y = 1.56;
    hGroup.add(unit, fan);
    tagSurface(hGroup, 'metal', id);
    worldGroup.add(hGroup);
    interactables.push(unit, fan);

    colliders.push({ id: colId, minX: hv.x - 1.4, maxX: hv.x + 1.4, minZ: hv.z - 1.0, maxZ: hv.z + 1.0, active: true });
    destructibles.push({
      state: {
        id,
        category: 'hvac',
        material: 'metal',
        hp: 120,
        maxHp: 120,
        destroyed: false,
        explosive: false,
        position: { x: hv.x, y: 0.75, z: hv.z },
        colliderId: colId,
      },
      mesh: hGroup,
      hitMeshes: [unit, fan],
    });
  });

  [
    { x: -6, z: 0 },
    { x: 2, z: 6.5 },
    { x: 16, z: -6.2 },
  ].forEach((b, idx) =>
    addBarrelProp(worldGroup, interactables, colliders, destructibles, idx, b.x, b.z, barrelRedMat, hazardYellowMat, darkSteelMat),
  );
  [
    { x: -15, z: 0 },
    { x: -4, z: 4.5 },
  ].forEach((c, idx) =>
    addCrateProp(worldGroup, interactables, colliders, destructibles, idx, c.x, c.z, woodMat, darkSteelMat),
  );

  const extractionSpot = new THREE.Vector3(8.0, 0, 0);
  const ext = addExtractionZone(worldGroup, extractionSpot);

  return {
    stage,
    worldGroup,
    interactables,
    colliders,
    destructibles,
    handles,
    ceilingLights,
    emergencyBeacons,
    trainGroup,
    trainWheels,
    trainBindings,
    movingVehicles,
    helicopter,
    spawnPoints: [
      new THREE.Vector3(-19, 0, -8.5),
      new THREE.Vector3(-19, 0, 8.5),
      new THREE.Vector3(19, 0, -8.5),
      new THREE.Vector3(19, 0, 8.5),
      new THREE.Vector3(4, 0, -9.0),
      new THREE.Vector3(4, 0, 9.0),
    ],
    pickupSpots: [
      new THREE.Vector3(-14, 0, -2.5),
      new THREE.Vector3(1.5, 0, 0),
      new THREE.Vector3(16.5, 0, 0),
    ],
    playerSpawn: new THREE.Vector3(-18.5, 0, 0),
    playerSpawnYaw: -Math.PI / 2,
    extractionSpot,
    ...ext,
    skyColor: 0x1a2942,
    fogColor: 0x1a2942,
    fogDensity: 0.007,
    ambientIntensity: 0.68,
    keyLightIntensity: 1.08,
    floorBounds: { minX: -22.0, maxX: 22.0, minZ: -10.0, maxZ: 10.0 },
  };
}

export function buildSubwayStation(
  textures: SubwayTextureBundle,
  isSoftwareGl: boolean,
): StationBuildResult {
  return buildStageEnvironment(1, textures, isSoftwareGl);
}

export function buildZombieModel(
  id: string,
  archetype: ZombieArchetype,
  contactShadowTex: THREE.CanvasTexture,
  hpMult: number,
  speedMult: number,
  dmgMult: number,
): ZombieRig {
  const root = new THREE.Group();
  const hitMeshes: THREE.Mesh[] = [];

  const isSprinter = archetype === 'sprinter';
  const isBrute = archetype === 'brute';
  const isSpitter = archetype === 'spitter';
  const isTitan = archetype === 'titan';

  const scale = isTitan ? 1.95 : isBrute ? 1.34 : isSprinter ? 0.96 : 1.0;

  const skinColor = isTitan ? 0x5c242c : isBrute ? 0x67755d : isSprinter ? 0x7a5959 : isSpitter ? 0x577859 : 0x6e7f67;
  const clothColor = isTitan ? 0x161922 : isBrute ? 0x383129 : isSprinter ? 0x6e1b1b : isSpitter ? 0x243e32 : 0x2a3442;
  const accentColor = isTitan ? 0xd946ef : isBrute ? 0xf97316 : isSprinter ? 0xef4444 : isSpitter ? 0x84cc16 : 0xf59e0b;

  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.65, metalness: 0.04 });
  const clothMat = new THREE.MeshStandardMaterial({ color: clothColor, roughness: 0.9, metalness: 0.04 });
  const bloodMat = new THREE.MeshStandardMaterial({ color: 0x6e1414, roughness: 0.25, metalness: 0.08 });
  const armorMat = new THREE.MeshStandardMaterial({
    color: isTitan ? 0x1e2430 : 0x3b424c,
    roughness: 0.3,
    metalness: 0.85,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: isTitan ? 3.2 : 2.6,
    roughness: 0.2,
  });

  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(new THREE.CircleGeometry(0.64 * scale, 18), shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.018;
  root.add(contactShadow);

  const ringMat = new THREE.MeshBasicMaterial({
    color: accentColor,
    transparent: true,
    opacity: isTitan ? 0.35 : 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const telegraphRing = new THREE.Mesh(new THREE.RingGeometry(0.68 * scale, 0.92 * scale, 28), ringMat);
  telegraphRing.rotation.x = -Math.PI / 2;
  telegraphRing.position.y = 0.03;
  root.add(telegraphRing);

  const makeLeg = (side: -1 | 1): THREE.Group => {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.16 * scale, 0.86 * scale, 0);
    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095 * scale, 0.075 * scale, 0.44 * scale, 10),
      clothMat,
    );
    thigh.position.y = -0.22 * scale;
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.078 * scale, 8, 8), skinMat);
    knee.position.y = -0.44 * scale;
    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.072 * scale, 0.056 * scale, 0.4 * scale, 10),
      skinMat,
    );
    shin.position.y = -0.64 * scale;
    const boot = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.065 * scale, 0.12 * scale, 6, 8),
      armorMat,
    );
    boot.rotation.x = Math.PI / 2;
    boot.position.set(0, -0.82 * scale, 0.05 * scale);
    legPivot.add(thigh, knee, shin, boot);
    hitMeshes.push(thigh, knee, shin, boot);
    return legPivot;
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);
  root.add(leftLeg, rightLeg);

  const torso = new THREE.Group();
  torso.position.set(0, 0.88 * scale, 0);
  if (isSprinter) torso.rotation.x = 0.24;

  const pelvis = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18 * scale, 0.16 * scale, 0.18 * scale, 10),
    clothMat,
  );
  pelvis.position.y = 0.06 * scale;
  const ribcage = new THREE.Mesh(
    new THREE.CylinderGeometry(((isBrute || isTitan) ? 0.3 : 0.22) * scale, 0.17 * scale, 0.56 * scale, 12),
    isTitan ? armorMat : clothMat,
  );
  ribcage.position.y = 0.4 * scale;
  const bloodPatch = new THREE.Mesh(
    new THREE.SphereGeometry((isTitan ? 0.2 : isBrute ? 0.18 : 0.14) * scale, 10, 10),
    isTitan || isBrute || isSpitter ? glowMat : bloodMat,
  );
  bloodPatch.scale.set(1.1, 1.3, 0.55);
  bloodPatch.position.set(0, 0.42 * scale, (isTitan ? 0.16 : 0.12) * scale);
  if (isTitan) {
    bloodPatch.userData.isCriticalCore = true;
  }

  const collarShoulder = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.11 * scale, ((isBrute || isTitan) ? 0.56 : 0.36) * scale, 6, 10),
    isTitan ? armorMat : clothMat,
  );
  collarShoulder.rotation.z = Math.PI / 2;
  collarShoulder.position.y = 0.62 * scale;
  torso.add(pelvis, ribcage, bloodPatch, collarShoulder);
  hitMeshes.push(pelvis, ribcage, bloodPatch, collarShoulder);

  if (isBrute || isTitan) {
    [-1, 1].forEach((side) => {
      const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.17 * scale, 10, 10), armorMat);
      pauldron.position.set(side * 0.36 * scale, 0.64 * scale, 0);
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 0.36 * scale, 10), glowMat);
      tank.position.set(side * 0.19 * scale, 0.56 * scale, -0.22 * scale);
      torso.add(pauldron, tank);
      hitMeshes.push(pauldron, tank);
      if (isTitan) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09 * scale, 0.28 * scale, 8), glowMat);
        spike.position.set(side * 0.38 * scale, 0.84 * scale, 0);
        spike.rotation.z = -side * 0.35;
        torso.add(spike);
        hitMeshes.push(spike);
      }
    });
  }
  if (isSpitter) {
    const sac1 = new THREE.Mesh(new THREE.SphereGeometry(0.18 * scale, 10, 10), glowMat);
    sac1.position.set(0.12 * scale, 0.54 * scale, -0.18 * scale);
    const sac2 = new THREE.Mesh(new THREE.SphereGeometry(0.13 * scale, 10, 10), glowMat);
    sac2.position.set(-0.14 * scale, 0.42 * scale, -0.16 * scale);
    torso.add(sac1, sac2);
    hitMeshes.push(sac1, sac2);
  }

  const head = new THREE.Group();
  head.position.set(0, 0.72 * scale, isSprinter ? 0.1 * scale : 0.04 * scale);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.065 * scale, 0.08 * scale, 0.12 * scale, 8), skinMat);
  neck.position.y = 0.04 * scale;
  neck.userData.isHead = true;

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.175 * scale, 12, 12), isTitan ? armorMat : skinMat);
  cranium.scale.set(0.96, 1.08, 1.02);
  cranium.position.y = 0.2 * scale;
  cranium.userData.isHead = true;

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.175 * scale, 0.1 * scale, 0.19 * scale), isTitan ? armorMat : skinMat);
  jaw.position.set(0, 0.075 * scale, 0.055 * scale);
  jaw.userData.isHead = true;

  // Scary Sinister Maniacal Grin (wide dark mouth gash, crimson cheek slashes, jagged glowing ivory fangs)
  const mouthVoidMat = new THREE.MeshStandardMaterial({ color: 0x050103, roughness: 0.96 });
  const teethMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: isTitan ? 0xf0abfc : 0xfef08a,
    emissiveIntensity: 0.72,
    roughness: 0.2,
  });
  const scarMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: 0x7f1d1d,
    emissiveIntensity: 0.35,
    roughness: 0.35,
  });

  const smileCenter = new THREE.Mesh(new THREE.BoxGeometry(0.19 * scale, 0.072 * scale, 0.045 * scale), mouthVoidMat);
  smileCenter.position.set(0, 0.104 * scale, 0.148 * scale);
  smileCenter.userData.isHead = true;

  const smileCornerL = new THREE.Mesh(new THREE.BoxGeometry(0.088 * scale, 0.046 * scale, 0.044 * scale), mouthVoidMat);
  smileCornerL.position.set(-0.096 * scale, 0.134 * scale, 0.128 * scale);
  smileCornerL.rotation.z = -0.62;
  smileCornerL.rotation.y = -0.44;
  smileCornerL.userData.isHead = true;

  const smileCornerR = new THREE.Mesh(new THREE.BoxGeometry(0.088 * scale, 0.046 * scale, 0.044 * scale), mouthVoidMat);
  smileCornerR.position.set(0.096 * scale, 0.134 * scale, 0.128 * scale);
  smileCornerR.rotation.z = 0.62;
  smileCornerR.rotation.y = 0.44;
  smileCornerR.userData.isHead = true;

  const cheekSlashL = new THREE.Mesh(new THREE.BoxGeometry(0.078 * scale, 0.02 * scale, 0.03 * scale), scarMat);
  cheekSlashL.position.set(-0.112 * scale, 0.15 * scale, 0.115 * scale);
  cheekSlashL.rotation.z = -0.68;
  cheekSlashL.rotation.y = -0.5;
  cheekSlashL.userData.isHead = true;

  const cheekSlashR = new THREE.Mesh(new THREE.BoxGeometry(0.078 * scale, 0.02 * scale, 0.03 * scale), scarMat);
  cheekSlashR.position.set(0.112 * scale, 0.15 * scale, 0.115 * scale);
  cheekSlashR.rotation.z = 0.68;
  cheekSlashR.rotation.y = 0.5;
  cheekSlashR.userData.isHead = true;

  const gumLip = new THREE.Mesh(new THREE.BoxGeometry(0.195 * scale, 0.018 * scale, 0.046 * scale), scarMat);
  gumLip.position.set(0, 0.142 * scale, 0.15 * scale);
  gumLip.userData.isHead = true;

  const chinDrip = new THREE.Mesh(new THREE.BoxGeometry(0.045 * scale, 0.042 * scale, 0.026 * scale), scarMat);
  chinDrip.position.set(0.015 * scale, 0.046 * scale, 0.146 * scale);
  chinDrip.userData.isHead = true;

  head.add(neck, cranium, jaw, smileCenter, smileCornerL, smileCornerR, cheekSlashL, cheekSlashR, gumLip, chinDrip);
  hitMeshes.push(neck, cranium, jaw, smileCenter, smileCornerL, smileCornerR, cheekSlashL, cheekSlashR, gumLip, chinDrip);

  // Sharp Serrated Upper (9) & Lower (7) Grinning Fangs
  for (let tIdx = -4; tIdx <= 4; tIdx++) {
    const toothX = tIdx * 0.021 * scale;
    const curveLift = Math.abs(tIdx) * 0.0068 * scale;
    const isCanine = Math.abs(tIdx) === 3;
    const upperTooth = new THREE.Mesh(
      new THREE.ConeGeometry((isCanine ? 0.011 : 0.009) * scale, (isCanine ? 0.034 : 0.026) * scale, 4),
      teethMat,
    );
    upperTooth.rotation.x = Math.PI;
    upperTooth.position.set(toothX, (0.125 + curveLift) * scale, 0.162 * scale);
    upperTooth.userData.isHead = true;
    head.add(upperTooth);
    hitMeshes.push(upperTooth);

    if (Math.abs(tIdx) <= 3) {
      const lowerTooth = new THREE.Mesh(
        new THREE.ConeGeometry(0.0088 * scale, (isCanine ? 0.03 : 0.024) * scale, 4),
        teethMat,
      );
      lowerTooth.position.set(toothX, (0.08 + curveLift * 0.85) * scale, 0.16 * scale);
      lowerTooth.userData.isHead = true;
      head.add(lowerTooth);
      hitMeshes.push(lowerTooth);
    }
  }

  // Deep Scowling Brows + Hollow Eye Sockets + Glowing Eyes + Piercing Slit Pupils
  const eyeSocketMat = new THREE.MeshStandardMaterial({ color: 0x09070b, roughness: 0.92 });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x040406 });
  const browMat = isTitan ? armorMat : clothMat;
  [-1, 1].forEach((side) => {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.082 * scale, 0.024 * scale, 0.048 * scale), browMat);
    brow.position.set(side * 0.064 * scale, 0.262 * scale, 0.155 * scale);
    brow.rotation.z = -side * 0.42;
    brow.userData.isHead = true;

    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.048 * scale, 8, 8), eyeSocketMat);
    socket.scale.set(1.15, 0.95, 0.65);
    socket.position.set(side * 0.064 * scale, 0.224 * scale, 0.146 * scale);
    socket.userData.isHead = true;

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.029 * scale, 8, 8), glowMat);
    eye.position.set(side * 0.064 * scale, 0.224 * scale, 0.164 * scale);
    eye.userData.isHead = true;

    const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.008 * scale, 0.032 * scale, 0.012 * scale), pupilMat);
    pupil.position.set(side * 0.064 * scale, 0.224 * scale, 0.188 * scale);
    pupil.userData.isHead = true;

    head.add(brow, socket, eye, pupil);
    hitMeshes.push(brow, socket, eye, pupil);
  });

  if (isTitan) {
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26 * scale, 0.036 * scale, 0.075 * scale), glowMat);
    visor.position.set(0, 0.228 * scale, 0.154 * scale);
    visor.userData.isHead = true;
    head.add(visor);
    hitMeshes.push(visor);
  }
  torso.add(head);

  const makeArm = (side: -1 | 1): THREE.Group => {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * ((isBrute || isTitan) ? 0.4 : 0.28) * scale, 0.61 * scale, 0);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * scale, 0.058 * scale, 0.34 * scale, 8), isTitan ? armorMat : clothMat);
    upper.position.y = -0.15 * scale;
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.06 * scale, 8, 8), skinMat);
    elbow.position.y = -0.32 * scale;
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.058 * scale, 0.045 * scale, 0.34 * scale, 8), isTitan ? armorMat : skinMat);
    forearm.position.set(0, -0.36 * scale, 0.15 * scale);
    forearm.rotation.x = -Math.PI * 0.36;
    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(((isBrute || isTitan) ? 0.105 : 0.065) * scale, 8, 8),
      isTitan ? glowMat : isSprinter ? bloodMat : skinMat,
    );
    hand.position.set(0, -0.46 * scale, 0.32 * scale);
    armPivot.add(upper, elbow, forearm, hand);
    hitMeshes.push(upper, elbow, forearm, hand);
    return armPivot;
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  leftArm.rotation.x = -1.18;
  rightArm.rotation.x = -1.18;
  torso.add(leftArm, rightArm);
  root.add(torso);

  hitMeshes.forEach((m) => {
    m.userData.zombieId = id;
    m.userData.material = 'flesh';
    m.castShadow = false;
  });

  const baseHp = isTitan ? 920 : isBrute ? 260 : isSpitter ? 95 : isSprinter ? 75 : 105;
  const baseSpeed = isTitan ? 3.15 : isSprinter ? 5.6 : isBrute ? 2.55 : isSpitter ? 2.9 : 3.2;
  const baseDmg = isTitan ? 32 : isBrute ? 28 : isSpitter ? 14 : isSprinter ? 16 : 18;

  return {
    id,
    archetype,
    root,
    torso,
    head,
    jaw,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    telegraphRing,
    contactShadow,
    hitMeshes,
    hp: Math.round(baseHp * hpMult),
    maxHp: Math.round(baseHp * hpMult),
    speed: baseSpeed * speedMult,
    damage: Math.round(baseDmg * dmgMult),
    radius: isTitan ? 0.85 : isBrute ? 0.56 : 0.42,
    walkPhase: Math.random() * Math.PI * 2,
    hitFlashTimer: 0,
    attackState: 'chase',
    stateTimer: 0,
    koVelocity: new THREE.Vector3(),
    hasToken: false,
    flankSign: Math.random() < 0.5 ? -1 : 1,
    rangedCooldown: 2.0 + Math.random() * 1.5,
    bossAbilityCooldown: 3.2,
    bossPowerType: 'none',
    bossDashTimer: 0,
    bossDashDir: new THREE.Vector3(),
  };
}

export interface ViewmodelRig {
  root: THREE.Group;
  groups: Record<WeaponId, THREE.Group>;
  muzzlePoint: THREE.Object3D;
  muzzleFlash: THREE.Mesh;
  rpgWarhead: THREE.Mesh;
  shotgunPump: THREE.Mesh;
  holoDot: THREE.Mesh;
}

export function buildWeaponViewmodels(): ViewmodelRig {
  const root = new THREE.Group();

  const gunSteel = new THREE.MeshStandardMaterial({ color: 0x1e242d, roughness: 0.4, metalness: 0.72 });
  const gunDark = new THREE.MeshStandardMaterial({ color: 0x101318, roughness: 0.7, metalness: 0.25 });
  const gunWood = new THREE.MeshStandardMaterial({ color: 0x6b3e23, roughness: 0.68, metalness: 0.08 });
  const rpgGreen = new THREE.MeshStandardMaterial({ color: 0x3b4d34, roughness: 0.52, metalness: 0.48 });
  const accentAmber = new THREE.MeshStandardMaterial({ color: 0xe69f19, roughness: 0.28, metalness: 0.55 });
  const accentCyan = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
  const shellRedMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.35, metalness: 0.25 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0x191c22, roughness: 0.84, metalness: 0.08 });
  const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x252e38, roughness: 0.88, metalness: 0.04 });

  const makeArmPair = (rightZ: number, leftX: number, leftY: number, leftZ: number): THREE.Group => {
    const arms = new THREE.Group();
    const rForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.042, 0.34, 10), sleeveMat);
    rForearm.rotation.x = Math.PI / 2 - 0.18;
    rForearm.position.set(0.025, -0.1, rightZ + 0.16);
    const rGlove = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.064, 0.082), gloveMat);
    rGlove.position.set(0.0, -0.05, rightZ);

    const lForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.04, 0.35, 10), sleeveMat);
    lForearm.rotation.x = Math.PI / 2 - 0.24;
    lForearm.rotation.z = -0.38;
    lForearm.position.set(leftX - 0.09, leftY - 0.09, leftZ + 0.16);
    const lGlove = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.052, 0.086), gloveMat);
    lGlove.position.set(leftX, leftY, leftZ);

    arms.add(rForearm, rGlove, lForearm, lGlove);
    return arms;
  };

  // Helper: Glassless Crystal-Clear Open Holographic Sight Frame (zero tint, zero center dot clutter)
  const makeOpenHolo = (yBase: number, zPos: number): { group: THREE.Group; dot: THREE.Mesh } => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.008, 0.052), gunDark);
    base.position.set(0, yBase + 0.004, zPos);
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.044, 0.046), gunDark);
    left.position.set(-0.027, yBase + 0.029, zPos);
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.044, 0.046), gunDark);
    right.position.set(0.027, yBase + 0.029, zPos);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.003, 0.046), gunDark);
    hood.position.set(0, yBase + 0.052, zPos);

    // Subtle bezel alignment ticks on sides only (leaves center 100% open & crisp for HUD reticle)
    const tickL = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.0014, 0.002), accentCyan);
    tickL.position.set(-0.021, yBase + 0.029, zPos + 0.002);
    const tickR = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.0014, 0.002), accentCyan);
    tickR.position.set(0.021, yBase + 0.029, zPos + 0.002);

    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0005, 6), accentCyan);
    dot.visible = false;
    g.add(base, left, right, hood, tickL, tickR, dot);
    return { group: g, dot };
  };

  // 1. USP-45 Tactical Pistol
  const pistol = new THREE.Group();
  const pSlide = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.034, 0.24), gunSteel);
  pSlide.position.set(0, 0.016, -0.14);
  const pFrame = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.028, 0.22), gunDark);
  pFrame.position.set(0, -0.012, -0.13);
  const pGrip = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.095, 0.046), gunDark);
  pGrip.position.set(0, -0.065, -0.04);
  pGrip.rotation.x = -0.22;
  const pSupp = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 10), gunDark);
  pSupp.rotation.x = Math.PI / 2;
  pSupp.position.set(0, 0.006, -0.32);
  const pSight = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.006, 0.006), accentCyan);
  pSight.position.set(0, 0.035, -0.24);
  pistol.add(pSlide, pFrame, pGrip, pSupp, pSight, makeArmPair(-0.04, -0.01, -0.07, -0.06));

  // 2. MP7 Vector SMG
  const smg = new THREE.Group();
  const mBody = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.056, 0.26), gunDark);
  mBody.position.set(0, -0.008, -0.1);
  const mBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.18, 10), gunSteel);
  mBarrel.rotation.x = Math.PI / 2;
  mBarrel.position.set(0, -0.008, -0.3);
  const mMag = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.16, 0.042), gunSteel);
  mMag.position.set(0, -0.1, -0.06);
  mMag.rotation.x = 0.14;
  const mHolo = makeOpenHolo(0.046, -0.06);
  smg.add(mBody, mBarrel, mMag, mHolo.group, makeArmPair(0.02, -0.01, -0.06, -0.18));

  // 3. M4A1 Phantom Rifle
  const carbine = new THREE.Group();
  const cUpper = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.056, 0.28), gunSteel);
  cUpper.position.set(0, -0.008, 0);
  const cRail = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.036, 0.24), gunDark);
  cRail.position.set(0, -0.01, -0.26);
  const cBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.22, 10), gunSteel);
  cBarrel.rotation.x = Math.PI / 2;
  cBarrel.position.set(0, -0.008, -0.44);
  const cSuppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.16, 12), gunDark);
  cSuppressor.rotation.x = Math.PI / 2;
  cSuppressor.position.set(0, -0.008, -0.58);
  const cMag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.145, 0.062), gunSteel);
  cMag.position.set(0, -0.1, -0.07);
  cMag.rotation.x = 0.18;
  const cGrip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.088, 0.044), gunDark);
  cGrip.position.set(0, -0.07, 0.06);
  cGrip.rotation.x = -0.25;
  const cForegrip = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.082, 8), gunDark);
  cForegrip.position.set(0, -0.062, -0.24);
  const cTacLight = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.085, 8), gunSteel);
  cTacLight.rotation.x = Math.PI / 2;
  cTacLight.position.set(0.032, -0.01, -0.32);
  const cHolo = makeOpenHolo(0.05, -0.02);
  carbine.add(
    cUpper,
    cRail,
    cBarrel,
    cSuppressor,
    cMag,
    cGrip,
    cForegrip,
    cTacLight,
    cHolo.group,
    makeArmPair(0.06, -0.01, -0.06, -0.24),
  );

  // 4. Operator .50 Sniper Rifle
  const sniper = new THREE.Group();
  const snChassis = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.068, 0.42), rpgGreen);
  snChassis.position.set(0, -0.005, -0.08);
  const snBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.56, 10), gunSteel);
  snBarrel.rotation.x = Math.PI / 2;
  snBarrel.position.set(0, 0.018, -0.52);
  const snBrake = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.03, 0.07), gunDark);
  snBrake.position.set(0, 0.018, -0.82);
  const snScopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.28, 12), gunDark);
  snScopeBody.rotation.x = Math.PI / 2;
  snScopeBody.position.set(0, 0.062, -0.1);
  const snBolt = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), gunSteel);
  snBolt.position.set(0.04, 0.02, -0.02);
  sniper.add(
    snChassis,
    snBarrel,
    snBrake,
    snScopeBody,
    snBolt,
    makeArmPair(0.08, -0.01, -0.05, -0.26),
  );

  // 5. M870 Breacher Shotgun
  const shotgun = new THREE.Group();
  const sRec = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.076, 0.26), gunSteel);
  const sBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.5, 12), gunSteel);
  sBarrel.rotation.x = Math.PI / 2;
  sBarrel.position.set(0, 0.022, -0.35);
  const sTube = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.44, 10), gunDark);
  sTube.rotation.x = Math.PI / 2;
  sTube.position.set(0, -0.008, -0.32);
  const shotgunPump = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.18, 10), gunWood);
  shotgunPump.rotation.x = Math.PI / 2;
  shotgunPump.position.set(0, -0.008, -0.27);
  const sStock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.078, 0.22), gunWood);
  sStock.position.set(0, -0.022, 0.2);
  for (let i = 0; i < 4; i++) {
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.042, 8), shellRedMat);
    shell.position.set(-0.036, 0.01, -0.05 + i * 0.028);
    shotgun.add(shell);
  }
  const sFrontSight = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 8), accentAmber);
  sFrontSight.position.set(0, 0.04, -0.58);
  shotgun.add(
    sRec,
    sBarrel,
    sTube,
    shotgunPump,
    sStock,
    sFrontSight,
    makeArmPair(0.08, -0.01, -0.03, -0.27),
  );

  // 6. M249 Heavy LMG
  const lmg = new THREE.Group();
  const lRec = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.07, 0.34), gunSteel);
  lRec.position.set(0, -0.008, -0.04);
  const lShroud = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.04, 0.32), gunDark);
  lShroud.position.set(0, -0.006, -0.34);
  const lBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.28, 10), gunSteel);
  lBarrel.rotation.x = Math.PI / 2;
  lBarrel.position.set(0, -0.004, -0.56);
  const lDrum = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.13), rpgGreen);
  lDrum.position.set(-0.02, -0.08, -0.1);
  const lHolo = makeOpenHolo(0.05, -0.02);
  lmg.add(lRec, lShroud, lBarrel, lDrum, lHolo.group, makeArmPair(0.08, -0.02, -0.06, -0.28));

  // 7. RPG-7V2 Rocket Launcher
  const rpg = new THREE.Group();
  const rTube = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.78, 14), rpgGreen);
  rTube.rotation.x = Math.PI / 2;
  rTube.position.set(0, 0.01, -0.08);
  const rBell = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.04, 0.16, 14), gunSteel);
  rBell.rotation.x = Math.PI / 2;
  rBell.position.set(0, 0.01, 0.35);
  const rHeatShield = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.28, 14), gunWood);
  rHeatShield.rotation.x = Math.PI / 2;
  rHeatShield.position.set(0, 0.01, -0.04);
  const rGrip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.11, 0.052), gunDark);
  rGrip.position.set(0, -0.08, -0.18);
  const rSight = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.11, 10), gunDark);
  rSight.rotation.x = Math.PI / 2;
  rSight.position.set(-0.052, 0.062, -0.22);
  const rFrontPost = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.05, 0.014), accentAmber);
  rFrontPost.position.set(0, 0.065, -0.44);

  const rpgWarhead = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.24, 14), rpgGreen);
  rpgWarhead.rotation.x = -Math.PI / 2;
  rpgWarhead.position.set(0, 0.01, -0.56);
  const warheadTip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.036, 0.08, 10), accentAmber);
  warheadTip.rotation.x = Math.PI / 2;
  warheadTip.position.set(0, -0.12, 0);
  rpgWarhead.add(warheadTip);

  rpg.add(
    rTube,
    rBell,
    rHeatShield,
    rGrip,
    rSight,
    rFrontPost,
    rpgWarhead,
    makeArmPair(-0.18, -0.01, -0.07, -0.02),
  );
  rpg.position.set(0, 0.055, 0.08);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, 0.015, -0.64);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffd269,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  const muzzleFlash = new THREE.Mesh(new THREE.OctahedronGeometry(0.048, 0), flashMat);
  muzzleFlash.position.copy(muzzlePoint.position);
  muzzleFlash.visible = false;

  root.add(pistol, smg, carbine, sniper, shotgun, lmg, rpg, muzzlePoint, muzzleFlash);
  root.position.set(0.24, -0.22, -0.44);

  return {
    root,
    groups: { pistol, smg, carbine, sniper, shotgun, lmg, rpg },
    muzzlePoint,
    muzzleFlash,
    rpgWarhead,
    shotgunPump,
    holoDot: cHolo.dot,
  };
}
