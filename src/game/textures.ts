// Created by Md Shabbir Mia
import * as THREE from 'three';
import { SurfaceMaterial } from './types';

export interface SubwayTextureBundle {
  tileMap: THREE.CanvasTexture;
  tileNormal: THREE.CanvasTexture;
  tileRoughness: THREE.CanvasTexture;
  concreteMap: THREE.CanvasTexture;
  concreteNormal: THREE.CanvasTexture;
  concreteRoughness: THREE.CanvasTexture;
  trainMetalMap: THREE.CanvasTexture;
  trainMetalNormal: THREE.CanvasTexture;
  trainMetalRoughness: THREE.CanvasTexture;
  asphaltRoadMap: THREE.CanvasTexture;
  marbleLobbyMap: THREE.CanvasTexture;
  rooftopMap: THREE.CanvasTexture;
  skyscraperFacadeMap: THREE.CanvasTexture;
  platformEdgeMap: THREE.CanvasTexture;
  ballastMap: THREE.CanvasTexture;
  stationSignMap: THREE.CanvasTexture;
  bulletHoleMaps: Record<Exclude<SurfaceMaterial, 'flesh'>, THREE.CanvasTexture>;
  scorchDecalMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function heightCanvasToNormalCanvas(
  heightCanvas: HTMLCanvasElement,
  strength = 2.4,
): HTMLCanvasElement {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const srcCtx = heightCanvas.getContext('2d')!;
  const src = srcCtx.getImageData(0, 0, w, h).data;

  const [outCanvas, outCtx] = makeCanvas(w, h);
  const outImg = outCtx.createImageData(w, h);
  const dst = outImg.data;

  const sample = (x: number, y: number): number => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return src[(wy * w + wx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const hL = sample(x - 1, y);
      const hR = sample(x + 1, y);
      const hU = sample(x, y - 1);
      const hD = sample(x, y + 1);

      const dx = (hL - hR) * strength;
      const dy = (hU - hD) * strength;
      const dz = 1.0;
      const len = Math.hypot(dx, dy, dz);

      const idx = (y * w + x) * 4;
      dst[idx] = Math.round(((dx / len) * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round(((dz / len) * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }

  outCtx.putImageData(outImg, 0, 0);
  return outCanvas;
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  isColor: boolean,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function buildBulletHoleTexture(
  kind: Exclude<SurfaceMaterial, 'flesh'>,
  anisotropy: number,
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128, 128);
  ctx.clearRect(0, 0, 128, 128);
  const cx = 64;
  const cy = 64;

  if (kind === 'glass') {
    ctx.strokeStyle = 'rgba(206, 232, 248, 0.9)';
    ctx.lineWidth = 2.2;
    for (let i = 0; i < 13; i++) {
      const ang = (i / 13) * Math.PI * 2 + (i % 2) * 0.14;
      const len = 28 + (i % 3) * 14;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(8, 14, 22, 0.94)';
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const ringColor =
      kind === 'metal'
        ? 'rgba(32, 40, 52, 0.9)'
        : kind === 'wood'
          ? 'rgba(54, 34, 18, 0.88)'
          : 'rgba(42, 45, 50, 0.88)';
    const grad = ctx.createRadialGradient(cx, cy, 6, cx, cy, 46);
    grad.addColorStop(0, ringColor);
    grad.addColorStop(0.5, 'rgba(18, 18, 22, 0.42)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 46, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = kind === 'metal' ? 'rgba(180, 192, 210, 0.75)' : 'rgba(18, 18, 20, 0.8)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.25;
      const r = 18 + (i % 3) * 11;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(6, 7, 10, 0.98)';
    ctx.beginPath();
    ctx.arc(cx, cy, 8.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createSubwayTextures(anisotropy: number): SubwayTextureBundle {
  // 1. Slate-Ceramic Subway Tiles (Balanced dark contrast, never blown-out white)
  const [tileCanvas, tCtx] = makeCanvas(512, 512);
  const [tileHeightCanvas, thCtx] = makeCanvas(512, 512);
  const [tileRoughCanvas, trCtx] = makeCanvas(512, 512);

  tCtx.fillStyle = '#5c636a';
  tCtx.fillRect(0, 0, 512, 512);
  thCtx.fillStyle = '#ffffff';
  thCtx.fillRect(0, 0, 512, 512);
  trCtx.fillStyle = '#606060'; // Satin glazed ceramic (~0.38 roughness, controlled glare)
  trCtx.fillRect(0, 0, 512, 512);

  const cols = 4;
  const rows = 8;
  const tw = 512 / cols;
  const th = 512 / rows;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (tw * 0.5);
    const isBand = r === 1;
    for (let c = -1; c <= cols; c++) {
      const x = c * tw + offset;
      const y = r * th;
      const jitter = ((r * 11 + c * 17) % 13) - 6;
      if (isBand) {
        tCtx.fillStyle = `rgb(${20 + jitter}, ${54 + jitter}, ${98 + jitter})`;
      } else {
        const base = 112 + jitter * 2;
        tCtx.fillStyle = `rgb(${base}, ${base + 4}, ${base + 8})`;
      }
      tCtx.fillRect(x + 3, y + 3, tw - 6, th - 6);

      thCtx.fillStyle = '#d4d4d4';
      thCtx.fillRect(x + 3, y + 3, tw - 6, th - 6);
      thCtx.fillStyle = '#f8f8f8';
      thCtx.fillRect(x + 6, y + 6, tw - 12, th - 12);

      // Dark mortar grout
      tCtx.fillStyle = '#25292e';
      tCtx.fillRect(x, y, tw, 3);
      tCtx.fillRect(x, y, 3, th);

      thCtx.fillStyle = '#242424';
      thCtx.fillRect(x, y, tw, 4);
      thCtx.fillRect(x, y, 4, th);

      trCtx.fillStyle = '#e5e5e5';
      trCtx.fillRect(x, y, tw, 4);
      trCtx.fillRect(x, y, 4, th);
    }
  }
  for (let i = 0; i < 36; i++) {
    const gx = (i * 47) % 512;
    const gy = (i * 89) % 380;
    const g = tCtx.createLinearGradient(gx, gy, gx, gy + 110);
    g.addColorStop(0, 'rgba(14, 18, 22, 0.34)');
    g.addColorStop(1, 'rgba(14, 18, 22, 0)');
    tCtx.fillStyle = g;
    tCtx.fillRect(gx, gy, 16, 110);
  }

  const tileMap = finalizeTexture(tileCanvas, anisotropy, true, 6, 2);
  const tileNormal = finalizeTexture(
    heightCanvasToNormalCanvas(tileHeightCanvas, 3.0),
    anisotropy,
    false,
    6,
    2,
  );
  const tileRoughness = finalizeTexture(tileRoughCanvas, anisotropy, false, 6, 2);

  // 2. Dark Charcoal Concrete Platform Floor (Crisp ground contrast for crosshair & enemies)
  const [concCanvas, cCtx] = makeCanvas(512, 512);
  const [concHeightCanvas, chCtx] = makeCanvas(512, 512);
  const [concRoughCanvas, crCtx] = makeCanvas(512, 512);

  cCtx.fillStyle = '#2c3139';
  cCtx.fillRect(0, 0, 512, 512);
  chCtx.fillStyle = '#888888';
  chCtx.fillRect(0, 0, 512, 512);
  crCtx.fillStyle = '#dcdcdc';
  crCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 4200; i++) {
    const x = (i * 73) % 512;
    const y = (i * 139) % 512;
    const v = 34 + (i % 24);
    cCtx.fillStyle = `rgba(${v}, ${v + 3}, ${v + 7}, 0.45)`;
    cCtx.fillRect(x, y, 3, 3);
    const hv = 110 + (i % 65);
    chCtx.fillStyle = `rgb(${hv}, ${hv}, ${hv})`;
    chCtx.fillRect(x, y, 2, 2);
  }

  for (let i = 0; i < 18; i++) {
    const px = ((i * 97) % 440) + 36;
    const py = ((i * 151) % 440) + 36;
    const rad = 28 + (i % 5) * 14;
    const darkGrad = cCtx.createRadialGradient(px, py, 4, px, py, rad);
    darkGrad.addColorStop(0, 'rgba(16, 20, 26, 0.4)');
    darkGrad.addColorStop(0.65, 'rgba(20, 24, 30, 0.18)');
    darkGrad.addColorStop(1, 'rgba(20, 24, 30, 0)');
    cCtx.fillStyle = darkGrad;
    cCtx.beginPath();
    cCtx.arc(px, py, rad, 0, Math.PI * 2);
    cCtx.fill();

    const roughGrad = crCtx.createRadialGradient(px, py, 4, px, py, rad);
    roughGrad.addColorStop(0, 'rgba(135, 135, 135, 0.85)');
    roughGrad.addColorStop(0.7, 'rgba(175, 175, 175, 0.45)');
    roughGrad.addColorStop(1, 'rgba(220, 220, 220, 0)');
    crCtx.fillStyle = roughGrad;
    crCtx.beginPath();
    crCtx.arc(px, py, rad, 0, Math.PI * 2);
    crCtx.fill();
  }

  cCtx.strokeStyle = '#181b20';
  cCtx.lineWidth = 4;
  cCtx.strokeRect(2, 2, 252, 252);
  cCtx.strokeRect(256, 2, 254, 252);
  cCtx.strokeRect(2, 256, 252, 254);
  cCtx.strokeRect(256, 256, 254, 254);

  chCtx.strokeStyle = '#202020';
  chCtx.lineWidth = 5;
  chCtx.strokeRect(2, 2, 252, 252);
  chCtx.strokeRect(256, 2, 254, 252);
  chCtx.strokeRect(2, 256, 252, 254);
  chCtx.strokeRect(256, 256, 254, 254);

  const concreteMap = finalizeTexture(concCanvas, anisotropy, true, 8, 4);
  const concreteNormal = finalizeTexture(
    heightCanvasToNormalCanvas(concHeightCanvas, 2.2),
    anisotropy,
    false,
    8,
    4,
  );
  const concreteRoughness = finalizeTexture(concRoughCanvas, anisotropy, false, 8, 4);

  // 3. Yellow Tactile Platform Safety Strip
  const [edgeCanvas, eCtx] = makeCanvas(256, 256);
  eCtx.fillStyle = '#bd8410';
  eCtx.fillRect(0, 0, 256, 256);
  for (let y = 16; y < 256; y += 32) {
    for (let x = 16; x < 256; x += 32) {
      eCtx.fillStyle = '#e0a522';
      eCtx.beginPath();
      eCtx.arc(x, y, 7, 0, Math.PI * 2);
      eCtx.fill();
      eCtx.fillStyle = '#704b04';
      eCtx.beginPath();
      eCtx.arc(x + 2, y + 2, 5, 0, Math.PI * 2);
      eCtx.fill();
    }
  }
  const platformEdgeMap = finalizeTexture(edgeCanvas, anisotropy, true, 24, 1);

  // 4. Gunmetal Brushed Stainless Steel Train Paneling (Rich dark metallic tone)
  const [trainCanvas, sCtx] = makeCanvas(512, 512);
  const [trainHeightCanvas, shCtx] = makeCanvas(512, 512);
  const [trainRoughCanvas, srCtx] = makeCanvas(512, 512);

  sCtx.fillStyle = '#626c78';
  sCtx.fillRect(0, 0, 512, 512);
  shCtx.fillStyle = '#888888';
  shCtx.fillRect(0, 0, 512, 512);
  srCtx.fillStyle = '#6e6e6e';
  srCtx.fillRect(0, 0, 512, 512);

  for (let y = 0; y < 512; y += 2) {
    const shade = 88 + ((y * 17) % 24);
    sCtx.fillStyle = `rgb(${shade}, ${shade + 5}, ${shade + 11})`;
    sCtx.fillRect(0, y, 512, 1);
    const rShade = 84 + ((y * 13) % 42);
    srCtx.fillStyle = `rgb(${rShade}, ${rShade}, ${rShade})`;
    srCtx.fillRect(0, y, 512, 1);
  }
  sCtx.fillStyle = '#333a42';
  sCtx.fillRect(254, 0, 4, 512);
  shCtx.fillStyle = '#252525';
  shCtx.fillRect(254, 0, 4, 512);
  for (let ry = 24; ry < 512; ry += 42) {
    sCtx.fillStyle = '#9aa4b0';
    sCtx.beginPath();
    sCtx.arc(244, ry, 3, 0, Math.PI * 2);
    sCtx.arc(268, ry, 3, 0, Math.PI * 2);
    sCtx.fill();
    shCtx.fillStyle = '#eaeaea';
    shCtx.beginPath();
    shCtx.arc(244, ry, 3, 0, Math.PI * 2);
    shCtx.arc(268, ry, 3, 0, Math.PI * 2);
    shCtx.fill();
  }

  sCtx.fillStyle = '#153a66';
  sCtx.fillRect(0, 340, 512, 48);
  sCtx.fillStyle = '#d19219';
  sCtx.fillRect(0, 388, 512, 12);

  const grimeGrad = sCtx.createLinearGradient(0, 410, 0, 512);
  grimeGrad.addColorStop(0, 'rgba(20, 18, 16, 0)');
  grimeGrad.addColorStop(1, 'rgba(14, 13, 12, 0.65)');
  sCtx.fillStyle = grimeGrad;
  sCtx.fillRect(0, 410, 512, 102);

  const trainMetalMap = finalizeTexture(trainCanvas, anisotropy, true, 1, 1);
  const trainMetalNormal = finalizeTexture(
    heightCanvasToNormalCanvas(trainHeightCanvas, 2.4),
    anisotropy,
    false,
    1,
    1,
  );
  const trainMetalRoughness = finalizeTexture(trainRoughCanvas, anisotropy, false, 1, 1);

  // 5. Stage 2 Outside Road Wet Asphalt + Center Lane Markings
  const [roadCanvas, rCtx] = makeCanvas(512, 512);
  rCtx.fillStyle = '#1a1e24';
  rCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4500; i++) {
    const x = (i * 61) % 512;
    const y = (i * 113) % 512;
    const v = 20 + (i % 22);
    rCtx.fillStyle = `rgb(${v}, ${v + 2}, ${v + 5})`;
    rCtx.fillRect(x, y, 2, 2);
  }
  // Dashed yellow double center lines
  rCtx.fillStyle = '#d49a1a';
  rCtx.fillRect(0, 246, 512, 6);
  rCtx.fillRect(0, 260, 512, 6);
  const asphaltRoadMap = finalizeTexture(roadCanvas, anisotropy, true, 6, 1);

  // 6. Stage 3 Dark Marble Building Lobby Floor
  const [marbleCanvas, mCtx] = makeCanvas(512, 512);
  mCtx.fillStyle = '#1e232b';
  mCtx.fillRect(0, 0, 512, 512);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const shade = 28 + ((r * 7 + c * 11) % 14);
      mCtx.fillStyle = `rgb(${shade}, ${shade + 4}, ${shade + 10})`;
      mCtx.fillRect(c * 128 + 2, r * 128 + 2, 124, 124);
    }
  }
  mCtx.strokeStyle = 'rgba(180, 145, 80, 0.28)';
  mCtx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 128) {
    mCtx.beginPath();
    mCtx.moveTo(i, 0);
    mCtx.lineTo(i, 512);
    mCtx.stroke();
    mCtx.beginPath();
    mCtx.moveTo(0, i);
    mCtx.lineTo(512, i);
    mCtx.stroke();
  }
  const marbleLobbyMap = finalizeTexture(marbleCanvas, anisotropy, true, 5, 3);

  // 7. Stage 4 Rooftop Membrane + Subtle Concrete Grid
  const [roofCanvas, rfCtx] = makeCanvas(512, 512);
  rfCtx.fillStyle = '#23272e';
  rfCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 3600; i++) {
    const x = (i * 89) % 512;
    const y = (i * 149) % 512;
    const v = 28 + (i % 18);
    rfCtx.fillStyle = `rgb(${v}, ${v + 2}, ${v + 4})`;
    rfCtx.fillRect(x, y, 3, 3);
  }
  rfCtx.strokeStyle = '#16191e';
  rfCtx.lineWidth = 3;
  rfCtx.strokeRect(2, 2, 508, 508);
  const rooftopMap = finalizeTexture(roofCanvas, anisotropy, true, 7, 4);

  // 8. Surrounding City Skyscraper Facade (Dark glass + lit office windows)
  const [skyCanvas, skCtx] = makeCanvas(256, 512);
  skCtx.fillStyle = '#0c111a';
  skCtx.fillRect(0, 0, 256, 512);
  for (let y = 14; y < 500; y += 22) {
    for (let x = 12; x < 244; x += 26) {
      const lit = ((x * 13 + y * 29) % 11) < 4;
      skCtx.fillStyle = lit
        ? ((x + y) % 3 === 0 ? 'rgba(251, 191, 36, 0.55)' : 'rgba(148, 197, 240, 0.45)')
        : 'rgba(24, 34, 48, 0.85)';
      skCtx.fillRect(x, y, 16, 12);
    }
  }
  const skyscraperFacadeMap = finalizeTexture(skyCanvas, anisotropy, true, 1, 2);

  // 9. Track Ballast Gravel
  const [balCanvas, bCtx] = makeCanvas(256, 256);
  bCtx.fillStyle = '#191918';
  bCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2200; i++) {
    const x = (i * 47) % 256;
    const y = (i * 83) % 256;
    const v = 18 + (i % 30);
    bCtx.fillStyle = `rgb(${v + 4}, ${v + 2}, ${v})`;
    bCtx.fillRect(x, y, 4, 3);
  }
  const ballastMap = finalizeTexture(balCanvas, anisotropy, true, 16, 4);

  // 10. Station Nameplate ("14TH ST · METRO")
  const [signCanvas, sgCtx] = makeCanvas(512, 128);
  sgCtx.fillStyle = '#0c1016';
  sgCtx.fillRect(0, 0, 512, 128);
  sgCtx.strokeStyle = '#9aa8b8';
  sgCtx.lineWidth = 4;
  sgCtx.strokeRect(8, 8, 496, 112);
  sgCtx.fillStyle = '#d8e0ea';
  sgCtx.fillRect(8, 10, 496, 10);
  sgCtx.font = 'bold 48px "Plus Jakarta Sans", Arial, sans-serif';
  sgCtx.textAlign = 'center';
  sgCtx.textBaseline = 'middle';
  sgCtx.fillText('14TH ST · METRO', 256, 72);
  const stationSignMap = finalizeTexture(signCanvas, anisotropy, true, 1, 1);

  const bulletHoleMaps: Record<Exclude<SurfaceMaterial, 'flesh'>, THREE.CanvasTexture> = {
    concrete: buildBulletHoleTexture('concrete', anisotropy),
    tile: buildBulletHoleTexture('tile', anisotropy),
    metal: buildBulletHoleTexture('metal', anisotropy),
    glass: buildBulletHoleTexture('glass', anisotropy),
    wood: buildBulletHoleTexture('wood', anisotropy),
  };

  const [scorchCanvas, scCtx] = makeCanvas(128, 128);
  const scGrad = scCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
  scGrad.addColorStop(0, 'rgba(6, 6, 8, 0.94)');
  scGrad.addColorStop(0.45, 'rgba(18, 16, 14, 0.68)');
  scGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  scCtx.fillStyle = scGrad;
  scCtx.fillRect(0, 0, 128, 128);
  const scorchDecalMap = new THREE.CanvasTexture(scorchCanvas);
  scorchDecalMap.colorSpace = THREE.SRGBColorSpace;
  scorchDecalMap.anisotropy = anisotropy;

  const [csCanvas, csCtx] = makeCanvas(128, 128);
  const csGrad = csCtx.createRadialGradient(64, 64, 8, 64, 64, 60);
  csGrad.addColorStop(0, 'rgba(0, 0, 0, 0.78)');
  csGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.34)');
  csGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  csCtx.fillStyle = csGrad;
  csCtx.fillRect(0, 0, 128, 128);
  const contactShadowMap = new THREE.CanvasTexture(csCanvas);
  contactShadowMap.colorSpace = THREE.SRGBColorSpace;

  return {
    tileMap,
    tileNormal,
    tileRoughness,
    concreteMap,
    concreteNormal,
    concreteRoughness,
    trainMetalMap,
    trainMetalNormal,
    trainMetalRoughness,
    asphaltRoadMap,
    marbleLobbyMap,
    rooftopMap,
    skyscraperFacadeMap,
    platformEdgeMap,
    ballastMap,
    stationSignMap,
    bulletHoleMaps,
    scorchDecalMap,
    contactShadowMap,
    dispose: () => {
      tileMap.dispose();
      tileNormal.dispose();
      tileRoughness.dispose();
      concreteMap.dispose();
      concreteNormal.dispose();
      concreteRoughness.dispose();
      trainMetalMap.dispose();
      trainMetalNormal.dispose();
      trainMetalRoughness.dispose();
      asphaltRoadMap.dispose();
      marbleLobbyMap.dispose();
      rooftopMap.dispose();
      skyscraperFacadeMap.dispose();
      platformEdgeMap.dispose();
      ballastMap.dispose();
      stationSignMap.dispose();
      Object.values(bulletHoleMaps).forEach((t) => t.dispose());
      scorchDecalMap.dispose();
      contactShadowMap.dispose();
    },
  };
}
