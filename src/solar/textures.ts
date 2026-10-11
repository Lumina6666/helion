// Procedural canvas textures — no external assets.
import * as THREE from 'three';
import type { TexKind } from './data';

// ------------------------------------------------------------- value noise
function hash2(x: number, y: number, seed: number): number {
  let h = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

// period > 0 makes the lattice wrap in x (period in integer lattice cells),
// so textures are seamless when wrapped around a sphere.
function valueNoise(x: number, y: number, seed: number, period = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  let x0 = xi, x1 = xi + 1;
  if (period > 0) {
    x0 = ((xi % period) + period) % period;
    x1 = (x0 + 1) % period;
  }
  const a = hash2(x0, yi, seed), b = hash2(x1, yi, seed);
  const c = hash2(x0, yi + 1, seed), d = hash2(x1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, seed: number, octaves = 5, period = 0): number {
  let sum = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 13.7, period > 0 ? period * freq : 0);
    amp *= 0.5; freq *= 2;
  }
  return sum;
}

// ------------------------------------------------------------- helpers
type RGB = [number, number, number];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (c1: RGB, c2: RGB, t: number): RGB => [
  lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t),
];

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c, ctx: c.getContext('2d')! };
}

function toTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// ------------------------------------------------------------- painters
function paintRocky(palette: RGB[], seed: number, craters: number): HTMLCanvasElement {
  const W = 512, H = 256;
  const { c, ctx } = canvas(W, H);
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x / W * 6, ny = y / H * 3;
      const n = fbm(nx, ny, seed, 5, 6);
      const m = fbm(nx * 2 + 9, ny * 2, seed + 40, 4, 12);
      let col = mix(palette[0], palette[1], Math.min(1, Math.max(0, n * 1.6 - 0.2)));
      col = mix(col, palette[2], Math.min(1, Math.max(0, m * 1.9 - 0.75)));
      const i = (y * W + x) * 4;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // craters (drawn wrapped so none clips at the texture seam)
  if (craters > 0) {
    for (let i = 0; i < craters; i++) {
      const cx = hash2(i, 3, seed) * W, cy = hash2(i, 7, seed) * H;
      const r = 1.5 + hash2(i, 11, seed) * 7;
      for (const ox of [-W, 0, W]) {
        const g = ctx.createRadialGradient(cx + ox, cy, r * 0.2, cx + ox, cy, r);
        g.addColorStop(0, 'rgba(0,0,0,0.34)');
        g.addColorStop(0.75, 'rgba(0,0,0,0.10)');
        g.addColorStop(1, 'rgba(255,255,255,0.06)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx + ox, cy, r, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  return c;
}

function paintGasGiant(bands: RGB[], seed: number, turb: number, spot?: { x: number; y: number; r: number; col: RGB }): HTMLCanvasElement {
  const W = 1024, H = 512;
  const { c, ctx } = canvas(W, H);
  const img = ctx.createImageData(W, H);
  const nb = bands.length;
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const wobble = fbm(u * 8, v * 16, seed, 4, 8) * turb;
      const band = v * nb + wobble;
      const i0 = ((Math.floor(band) % nb) + nb) % nb;
      const i1 = (i0 + 1) % nb;
      const t = band - Math.floor(band);
      const smooth = t * t * (3 - 2 * t);
      let col = mix(bands[i0], bands[i1], smooth);
      const streak = fbm(u * 24 + v * 4, v * 40, seed + 5, 3, 24);
      col = mix(col, [col[0] * 1.08, col[1] * 1.08, col[2] * 1.08], streak * 0.5);
      const i = (y * W + x) * 4;
      img.data[i] = Math.min(255, col[0]); img.data[i + 1] = Math.min(255, col[1]); img.data[i + 2] = Math.min(255, col[2]); img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  if (spot) {
    const sx = spot.x * W, sy = spot.y * H, sr = spot.r * H;
    const g = ctx.createRadialGradient(sx, sy, sr * 0.1, sx, sy, sr);
    g.addColorStop(0, `rgba(${spot.col[0]},${spot.col[1]},${spot.col[2]},0.95)`);
    g.addColorStop(0.7, `rgba(${spot.col[0]},${spot.col[1]},${spot.col[2]},0.55)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.save(); ctx.translate(sx, sy); ctx.scale(1.6, 1); ctx.translate(-sx, -sy);
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  return c;
}

function paintEarth(): HTMLCanvasElement {
  const W = 1024, H = 512;
  const { c, ctx } = canvas(W, H);
  const img = ctx.createImageData(W, H);
  const ocean: RGB = [18, 62, 128];
  const shelf: RGB = [34, 96, 158];
  const land: RGB = [74, 116, 62];
  const dry: RGB = [148, 128, 82];
  const ice: RGB = [228, 238, 244];
  for (let y = 0; y < H; y++) {
    const v = y / H;
    const polar = Math.pow(Math.abs(v - 0.5) * 2, 6);
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const n = fbm(u * 5, v * 2.5, 7.3, 6, 5);
      const detail = fbm(u * 14, v * 7, 19.1, 4, 14);
      let col: RGB;
      if (n > 0.52) {
        col = mix(land, dry, Math.min(1, (detail - 0.35) * 2.4));
      } else if (n > 0.47) {
        col = shelf;
      } else {
        col = mix(ocean, [10, 40, 96], detail * 0.7);
      }
      // polar caps
      const cap = Math.min(1, polar * (1.6 + detail));
      col = mix(col, ice, cap);
      // clouds
      const cl = fbm(u * 7 + 31, v * 3.5, 55.5, 4, 7);
      if (cl > 0.58) col = mix(col, [245, 248, 250], Math.min(0.75, (cl - 0.58) * 3.2));
      const i = (y * W + x) * 4;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function paintSun(): HTMLCanvasElement {
  const W = 1024, H = 512;
  const { c, ctx } = canvas(W, H);
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H;
      const n = fbm(u * 9, v * 4.5, 3.1, 5, 9);
      const g = fbm(u * 22, v * 11, 8.8, 3, 22);
      let col = mix([255, 140, 30], [255, 214, 120], n);
      col = mix(col, [255, 244, 200], Math.pow(g, 3) * 1.4);
      const i = (y * W + x) * 4;
      img.data[i] = Math.min(255, col[0]); img.data[i + 1] = Math.min(255, col[1]); img.data[i + 2] = Math.min(255, col[2]); img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ------------------------------------------------------------- public API
// ------------------------------------------------------------- moon-system painters
// Each moon gets a bespoke look drawn with the same seamless-noise toolkit.

// Io — sulfur-yellow plains pocked with dark volcanic vents ringed in orange
function paintIo(): HTMLCanvasElement {
  const W = 512, H = 256;
  const { c, ctx } = canvas(W, H);
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x / W * 6, ny = y / H * 3;
      const n = fbm(nx, ny, 61.3, 5, 6);
      const m = fbm(nx * 2 + 9, ny * 2, 101.3, 4, 12);
      let col = mix([226, 200, 110], [198, 164, 74], Math.min(1, Math.max(0, n * 1.7 - 0.25)));
      col = mix(col, [240, 226, 160], Math.min(1, Math.max(0, m * 2.0 - 0.9)));
      const i = (y * W + x) * 4;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  for (let i = 0; i < 22; i++) {
    const cx = hash2(i, 3, 61.3) * W, cy = hash2(i, 7, 61.3) * H;
    const r = 2 + hash2(i, 11, 61.3) * 6;
    for (const ox of [-W, 0, W]) {
      const g = ctx.createRadialGradient(cx + ox, cy, r * 0.15, cx + ox, cy, r);
      g.addColorStop(0, 'rgba(52,36,22,0.75)');
      g.addColorStop(0.55, 'rgba(206,96,38,0.38)');
      g.addColorStop(1, 'rgba(206,96,38,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx + ox, cy, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  return c;
}

// Europa — pale ice shell crazed with brown lineae
function paintEuropa(): HTMLCanvasElement {
  const W = 512, H = 256;
  const { c, ctx } = canvas(W, H);
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x / W * 6, ny = y / H * 3;
      const n = fbm(nx, ny, 77.9, 5, 6);
      let col = mix([222, 216, 204], [204, 194, 180], Math.min(1, Math.max(0, n * 1.5 - 0.2)));
      col = mix(col, [234, 230, 220], Math.min(1, Math.max(0, fbm(nx * 3, ny * 3, 88.1, 4, 12) * 2.2 - 1.0)));
      const i = (y * W + x) * 4;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // lineae: long wandering brown cracks, wrapped at the seam
  for (let i = 0; i < 64; i++) {
    let x = hash2(i, 5, 77.9) * W, y = hash2(i, 9, 77.9) * H;
    let ang = hash2(i, 13, 77.9) * Math.PI * 2;
    ctx.strokeStyle = `rgba(150,92,58,${(0.16 + hash2(i, 17, 77.9) * 0.22).toFixed(2)})`;
    ctx.lineWidth = 0.7 + hash2(i, 21, 77.9) * 1.6;
    for (const ox of [-W, 0, W]) {
      ctx.beginPath();
      let px = x + ox, py = y, a = ang;
      ctx.moveTo(px, py);
      const segs = 4 + Math.floor(hash2(i, 25, 77.9) * 5);
      for (let k = 0; k < segs; k++) {
        a += (hash2(i, 29 + k, 77.9) - 0.5) * 1.2;
        px += Math.cos(a) * (14 + hash2(i, 33 + k, 77.9) * 30);
        py += Math.sin(a) * (8 + hash2(i, 37 + k, 77.9) * 16);
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  return c;
}

// Ganymede — two-tone: dark ancient terrain against bright grooved lanes
function paintGanymede(): HTMLCanvasElement {
  const W = 512, H = 256;
  const { c, ctx } = canvas(W, H);
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x / W * 6, ny = y / H * 3;
      const dark = fbm(nx, ny, 43.7, 5, 6) > 0.52;
      const n = fbm(nx * 2 + 5, ny * 2, 48.7, 4, 12);
      const base: RGB = dark ? [116, 104, 88] : [172, 162, 142];
      const alt: RGB = dark ? [138, 126, 108] : [188, 178, 158];
      const col = mix(base, alt, Math.min(1, Math.max(0, n * 1.8 - 0.3)));
      const i = (y * W + x) * 4;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // fine groove strokes on the bright lanes
  ctx.strokeStyle = 'rgba(96,86,70,0.28)';
  for (let i = 0; i < 46; i++) {
    const x = hash2(i, 5, 43.7) * W, y = hash2(i, 9, 43.7) * H;
    const len = 20 + hash2(i, 13, 43.7) * 46;
    const a = hash2(i, 17, 43.7) * Math.PI;
    ctx.lineWidth = 0.6 + hash2(i, 21, 43.7);
    for (const ox of [-W, 0, W]) {
      ctx.beginPath();
      ctx.moveTo(x + ox, y);
      ctx.lineTo(x + ox + Math.cos(a) * len, y + Math.sin(a) * len * 0.35);
      ctx.stroke();
    }
  }
  return c;
}

// Callisto — dark, densely cratered; bright rim flecks
function paintCallisto(): HTMLCanvasElement {
  const c = paintRocky([[96, 88, 78], [70, 64, 58], [120, 110, 98]], 29.4, 60);
  const ctx = c.getContext('2d')!;
  const W = c.width, H = c.height;
  for (let i = 0; i < 210; i++) {
    const cx = hash2(i, 3, 29.4) * W, cy = hash2(i, 7, 29.4) * H;
    const r = 0.8 + hash2(i, 11, 29.4) * 3.4;
    for (const ox of [-W, 0, W]) {
      const g = ctx.createRadialGradient(cx + ox, cy, r * 0.2, cx + ox, cy, r);
      g.addColorStop(0, 'rgba(232,226,214,0.30)');
      g.addColorStop(0.7, 'rgba(30,26,22,0.22)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx + ox, cy, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  return c;
}

// Eris — bright methane-frost white with subtle icy mottling
function paintEris(): HTMLCanvasElement {
  const W = 512, H = 256;
  const { c, ctx } = canvas(W, H);
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x / W * 6, ny = y / H * 3;
      const n = fbm(nx, ny, 53.1, 5, 6);
      const m = fbm(nx * 3 + 7, ny * 3, 53.7, 4, 10);
      let col = mix([222, 228, 236], [196, 205, 218], Math.min(1, Math.max(0, n * 1.5 - 0.15)));
      col = mix(col, [236, 240, 246], Math.min(1, Math.max(0, m * 2.0 - 0.85))); // frost patches
      const i = (y * W + x) * 4;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Haumea — pale icy body with the legendary dark red spot
function paintHaumea(): HTMLCanvasElement {
  const c = paintRocky([[214, 208, 198], [188, 182, 172], [228, 224, 216]], 61.3, 40);
  const ctx = c.getContext('2d')!;
  const W = c.width, H = c.height;
  const cx = hash2(1, 5, 61.3) * W, cy = H * (0.35 + hash2(1, 9, 61.3) * 0.3);
  const r = 14 + hash2(1, 13, 61.3) * 8;
  for (const ox of [-W, 0, W]) {
    const g = ctx.createRadialGradient(cx + ox, cy, r * 0.1, cx + ox, cy, r);
    g.addColorStop(0, 'rgba(146,64,44,0.85)');
    g.addColorStop(0.6, 'rgba(150,74,52,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(cx + ox, cy, r, r * 0.62, 0.5, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}

// Makemake — rusty red-brown methane ice, lightly cratered
function paintMakemake(): HTMLCanvasElement {
  return paintRocky([[188, 122, 84], [150, 92, 62], [210, 148, 106]], 71.9, 55);
}

// Titan — soft orange nitrogen haze, nearly featureless
function paintTitan(): HTMLCanvasElement {
  const W = 512, H = 256;
  const { c, ctx } = canvas(W, H);
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const nx = x / W * 6, ny = y / H * 3;
      const n = fbm(nx, ny, 17.6, 4, 6);
      let col = mix([214, 148, 72], [232, 176, 108], Math.min(1, Math.max(0, n * 1.3 - 0.1)));
      // darker polar hood, faint equatorial band — Titan's haze caps
      const polar = Math.abs(v - 0.5) * 2;
      col = mix(col, [188, 122, 54], Math.min(1, Math.max(0, polar - 0.55) * 0.9));
      const i = (y * W + x) * 4;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Enceladus — bright ice, blue-green tiger stripes near the south pole
function paintEnceladus(): HTMLCanvasElement {
  const W = 512, H = 256;
  const { c, ctx } = canvas(W, H);
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x / W * 6, ny = y / H * 3;
      const n = fbm(nx, ny, 55.2, 5, 6);
      let col = mix([234, 242, 248], [246, 250, 253], Math.min(1, Math.max(0, n * 1.4 - 0.15)));
      col = mix(col, [214, 226, 234], Math.min(1, Math.max(0, fbm(nx * 2, ny * 2, 59.2, 4, 12) * 2.0 - 1.1)));
      const i = (y * W + x) * 4;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // four tiger stripes crossing the south-polar band (bottom of the equirect)
  for (let k = 0; k < 4; k++) {
    const yBase = H * (0.82 + k * 0.045);
    ctx.strokeStyle = 'rgba(88,140,162,0.5)';
    ctx.lineWidth = 2.6 + hash2(k, 3, 55.2) * 1.6;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 8) {
      const y = yBase + Math.sin((x / W) * Math.PI * 4 + k * 1.7) * 4.5;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return c;
}

export function planetTexture(kind: TexKind): THREE.CanvasTexture {
  let c: HTMLCanvasElement;
  switch (kind) {
    case 'mercury': c = paintRocky([[120, 112, 104], [88, 82, 78], [150, 140, 128]], 11.2, 90); break;
    case 'venus':   c = paintGasGiant([[226, 196, 130], [238, 216, 160], [214, 178, 112], [240, 222, 176]], 4.4, 1.6); break;
    case 'earth':   c = paintEarth(); break;
    case 'mars':    c = paintRocky([[176, 92, 54], [140, 64, 40], [214, 138, 92]], 23.7, 40); break;
    case 'jupiter': c = paintGasGiant([[216, 192, 158], [180, 138, 100], [232, 216, 186], [158, 108, 78], [224, 200, 168], [196, 160, 122]], 9.3, 0.85, { x: 0.68, y: 0.62, r: 0.085, col: [196, 84, 52] }); break;
    case 'saturn':  c = paintGasGiant([[228, 210, 168], [212, 190, 148], [238, 224, 188], [204, 180, 138], [234, 218, 178]], 14.1, 0.55); break;
    case 'uranus':  c = paintGasGiant([[168, 218, 224], [148, 204, 214], [188, 230, 234]], 21.9, 0.35); break;
    case 'neptune': c = paintGasGiant([[64, 96, 200], [48, 76, 176], [92, 128, 224], [56, 88, 190]], 27.4, 0.7, { x: 0.4, y: 0.42, r: 0.05, col: [30, 48, 130] }); break;
    case 'pluto':   c = paintRocky([[196, 178, 158], [150, 128, 110], [222, 206, 188]], 31.6, 24); break;
    case 'ceres':   c = paintRocky([[142, 132, 118], [104, 96, 88], [170, 160, 146]], 47.3, 60); break;
    case 'vesta':   c = paintRocky([[168, 150, 132], [128, 110, 96], [196, 178, 158]], 91.7, 45); break;
    case 'io':        c = paintIo(); break;
    case 'europa':    c = paintEuropa(); break;
    case 'ganymede':  c = paintGanymede(); break;
    case 'callisto':  c = paintCallisto(); break;
    case 'titan':     c = paintTitan(); break;
    case 'enceladus': c = paintEnceladus(); break;
    case 'eris':      c = paintEris(); break;
    case 'haumea':    c = paintHaumea(); break;
    case 'makemake':  c = paintMakemake(); break;
  }
  return toTexture(c);
}

export function sunTexture(): THREE.CanvasTexture {
  return toTexture(paintSun());
}

export function ringTexture(): THREE.CanvasTexture {
  // radial strip used on RingGeometry with custom UVs
  const W = 256, H = 8;
  const { c, ctx } = canvas(W, H);
  for (let x = 0; x < W; x++) {
    const t = x / W;
    const n = fbm(t * 18, 0.5, 17.7, 4);
    const alpha = Math.max(0, Math.min(1, (n - 0.28) * 1.8)) * (0.35 + 0.65 * Math.sin(Math.min(1, t * 1.15) * Math.PI));
    const bright = 190 + Math.floor(n * 60);
    ctx.fillStyle = `rgba(${bright},${bright - 14},${bright - 44},${alpha.toFixed(3)})`;
    ctx.fillRect(x, 0, 1, H);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function glowSprite(inner: string, outer: string, size = 256): THREE.CanvasTexture {
  const { c, ctx } = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.25, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ------------------------------------------------------------- real maps
// Downloaded equirectangular maps (see ATTRIBUTION). Procedural painters
// above remain as fallback when a file fails to load.
export const TEXTURE_ATTRIBUTION = 'PLANET MAPS: SOLAR SYSTEM SCOPE (CC BY 4.0) · NASA/JPL · THREE.JS EXAMPLES';

const FILES: Record<string, string> = {
  mercury: '2k_mercury.jpg',
  venus: '2k_venus_surface.jpg',
  earth: '2k_earth_daymap.jpg',
  earthNight: 'earth_night.jpg',
  earthClouds: '2k_earth_clouds.jpg',
  earthNormal: 'earth_normal.jpg',
  earthSpecular: 'earth_specular.jpg',
  mars: '2k_mars.jpg',
  moon: '2k_moon.jpg',
  jupiter: 'jupiter.jpg',
  saturn: '2k_saturn.jpg',
  saturnRing: 'saturn_ring.jpg',
  uranus: 'uranus.jpg',
  neptune: 'neptune.jpg',
  pluto: 'pluto.jpg',
  sun: 'sun.jpg',
  milkyway: 'milkyway.png',
};

// data maps (normal/specular) stay in linear space
const LINEAR = new Set(['earthNormal', 'earthSpecular', 'earthClouds']);

export type TextureSet = Record<string, THREE.Texture | null>;

export function loadRealTextures(base: string, onProgress: (pct: number) => void): Promise<TextureSet> {
  const keys = Object.keys(FILES);
  const out: TextureSet = {};
  let done = 0;
  const tick = () => { done++; onProgress(done / keys.length); };
  return Promise.all(keys.map(k => new Promise<void>((resolve) => {
    new THREE.TextureLoader().load(
      base + FILES[k],
      (t) => {
        if (!LINEAR.has(k)) t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        out[k] = t; tick(); resolve();
      },
      undefined,
      () => { out[k] = null; tick(); resolve(); },
    );
  }))).then(() => out);
}
