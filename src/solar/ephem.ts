// Real-ephemeris support — JPL approximate Keplerian elements (valid ~1800–2050)
// plus stylized Halley's comet orbit and Voyager escape vectors.

const DEG = Math.PI / 180;
export const J2000 = 2451545.0;
export const BASE_JD = Date.UTC(2026, 6, 17) / 86400000 + 2440587.5; // 2026-07-17 UTC

// a[AU], e, I[deg], L[deg], ϖ[deg], Ω[deg] + rates per Julian century
interface Elements { a: number; e: number; i: number; L: number; p: number; O: number;
  da: number; de: number; di: number; dL: number; dp: number; dO: number }

export const ELEMENTS: Record<string, Elements> = {
  mercury: { a: 0.38709927, e: 0.20563593, i: 7.00497902, L: 252.25032350, p: 77.45779628, O: 48.33076593, da: 0.00000037, de: 0.00001906, di: -0.00594749, dL: 149472.67411175, dp: 0.16047689, dO: -0.12534081 },
  venus:   { a: 0.72333566, e: 0.00677672, i: 3.39467605, L: 181.97909950, p: 131.60246718, O: 76.67984255, da: 0.00000390, de: -0.00004107, di: -0.00078890, dL: 58517.81538729, dp: 0.00268329, dO: -0.27769418 },
  earth:   { a: 1.00000261, e: 0.01671123, i: -0.00001531, L: 100.46457166, p: 102.93768193, O: 0.0, da: 0.00000562, de: -0.00004392, di: -0.01294668, dL: 35999.37244981, dp: 0.32327364, dO: 0.0 },
  mars:    { a: 1.52371034, e: 0.09339410, i: 1.84969142, L: -4.55343205, p: -23.94362959, O: 49.55953891, da: 0.00001847, de: 0.00007882, di: -0.00813131, dL: 19140.30268499, dp: 0.44441088, dO: -0.29257343 },
  jupiter: { a: 5.20288700, e: 0.04838624, i: 1.30439695, L: 34.39644051, p: 14.72847983, O: 100.47390909, da: -0.00011607, de: -0.00013253, di: -0.00183714, dL: 3034.74612775, dp: 0.21252668, dO: 0.20469106 },
  saturn:  { a: 9.53667594, e: 0.05386179, i: 2.48599187, L: 49.95424423, p: 92.59887831, O: 113.66242448, da: -0.00125060, de: -0.00050991, di: 0.00193609, dL: 1222.49362201, dp: -0.41897216, dO: -0.28867794 },
  uranus:  { a: 19.18916464, e: 0.04725744, i: 0.77263783, L: 313.23810451, p: 170.95427630, O: 74.01692503, da: -0.00196176, de: -0.00004397, di: -0.00242939, dL: 428.48202785, dp: 0.40805281, dO: 0.04240589 },
  neptune: { a: 30.06992276, e: 0.00859048, i: 1.77004347, L: -55.12002969, p: 44.96476227, O: 131.78422574, da: 0.00026291, de: 0.00005105, di: 0.00035372, dL: 218.45945325, dp: -0.32241464, dO: -0.00508664 },
  pluto:   { a: 39.48211675, e: 0.24882730, i: 17.14001206, L: 238.92903833, p: 224.06891629, O: 110.30393684, da: -0.00031596, de: 0.00005170, di: 0.00004818, dL: 145.20780515, dp: -0.04062942, dO: -0.01183482 },
};

export function solveKepler(M: number, e: number): number {
  let E = M + e * Math.sin(M);
  for (let k = 0; k < 8; k++) {
    E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  return E;
}

// Heliocentric ecliptic longitude & latitude (radians) for a planet at Julian date jd.
export function helioLonLat(id: string, jd: number): { lon: number; lat: number } {
  const el = ELEMENTS[id];
  if (!el) return { lon: 0, lat: 0 };
  const T = (jd - J2000) / 36525;
  const a = el.a + el.da * T;
  const e = el.e + el.de * T;
  const I = (el.i + el.di * T) * DEG;
  const L = (el.L + el.dL * T) * DEG;
  const p = (el.p + el.dp * T) * DEG;
  const O = (el.O + el.dO * T) * DEG;
  const w = p - O;                    // argument of perihelion
  let M = L - p;
  M = Math.atan2(Math.sin(M), Math.cos(M));
  const E = solveKepler(M, e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = a * (1 - e * Math.cos(E));
  const x = r * (Math.cos(O) * Math.cos(w + nu) - Math.sin(O) * Math.sin(w + nu) * Math.cos(I));
  const y = r * (Math.sin(O) * Math.cos(w + nu) + Math.cos(O) * Math.sin(w + nu) * Math.cos(I));
  const z = r * (Math.sin(w + nu) * Math.sin(I));
  return { lon: Math.atan2(y, x), lat: Math.asin(z / r) };
}

// ------------------------------------------------------------- Halley's comet
// Stylized orbit fitted to the scene's compressed scale: perihelion just
// outside the Sun, aphelion beyond Pluto; real 75.3 yr period, retrograde.
export const HALLEY = {
  a: 51.5,            // scene units — semi-major axis
  e: 0.845,
  inc: 162 * DEG,
  periodDays: 75.3 * 365.25,
  // mean anomaly at BASE_JD chosen so Halley is mid-outbound in 2026
  M0: 3.36,
};

export function halleyScenePos(simDays: number): { x: number; y: number; z: number } {
  const n = (Math.PI * 2) / HALLEY.periodDays;
  const M = HALLEY.M0 + n * simDays;
  const E = solveKepler(M, HALLEY.e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + HALLEY.e) * Math.sin(E / 2), Math.sqrt(1 - HALLEY.e) * Math.cos(E / 2));
  const r = HALLEY.a * (1 - HALLEY.e * Math.cos(E));
  // orbital plane → apply inclination (retrograde)
  const xo = r * Math.cos(nu), yo = r * Math.sin(nu);
  return {
    x: xo,
    y: -yo * Math.sin(HALLEY.inc),
    z: yo * Math.cos(HALLEY.inc),
  };
}

// ------------------------------------------------------------- Voyager probes
// Approximate 2026 state: direction on the celestial sphere + range rate.
export interface VoyagerSpec {
  id: string;
  lon: number;    // ecliptic longitude (rad)
  lat: number;    // ecliptic latitude (rad)
  au0: number;    // range at BASE_JD (AU)
  auPerYear: number;
}

export const VOYAGERS: VoyagerSpec[] = [
  { id: 'voyager1', lon: 262 * DEG, lat: 35 * DEG, au0: 166.5, auPerYear: 3.58 },
  { id: 'voyager2', lon: 290 * DEG, lat: -32 * DEG, au0: 139.2, auPerYear: 3.21 },
];

export function voyagerAU(v: VoyagerSpec, simDays: number): number {
  return v.au0 + v.auPerYear * (simDays / 365.25);
}

// Compressed scene range so probes sit just outside Pluto's orbit ring.
export function voyagerScenePos(v: VoyagerSpec, simDays: number): { x: number; y: number; z: number } {
  const au = voyagerAU(v, simDays);
  const R = 95 + (au - 40) * 0.12;
  return {
    x: R * Math.cos(v.lat) * Math.cos(v.lon),
    y: R * Math.sin(v.lat),
    z: R * Math.cos(v.lat) * Math.sin(v.lon),
  };
}
