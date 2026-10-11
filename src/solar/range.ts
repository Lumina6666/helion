// HELION — live range & one-way light time from Earth.
// Pure functions of (body id, Julian date): the dossier panel samples these
// against the simulation clock, so scrubbing time scrubs the range too.
import { BASE_JD, ELEMENTS, HALLEY, VOYAGERS, helioState, solveKepler, voyagerAU } from './ephem';
import { MOON_HOST } from './data';

export const AU_KM = 149597870.7;
export const LIGHT_SEC_PER_AU = 499.004784; // IAU defining constant c·τA

// Real semi-major axes (km) of the six giant-planet moons (JPL).
const MOON_ORBIT_KM: Record<string, number> = {
  io: 421700, europa: 671034, ganymede: 1070412, callisto: 1882709,
  titan: 1221870, enceladus: 237948,
};

export interface RangeInfo {
  au: number;          // geocentric range in AU
  hostKm?: number;     // for moons: orbital radius around the host planet
}

function d3(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

// Halley's REAL orbit (a = 17.834 AU, e = 0.96714) — the scene compresses the
// semi-major axis, so the range figure re-derives the true heliocentric state
// with the same mean-anomaly anchor used by the scene model.
function halleyRealHelio(jd: number): { x: number; y: number; z: number } {
  const simDays = jd - BASE_JD;
  const e = 0.96714, a = 17.834, inc = 162.26 * (Math.PI / 180);
  const n = (Math.PI * 2) / HALLEY.periodDays;
  const M = HALLEY.M0 + n * simDays;
  const E = solveKepler(M, e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = a * (1 - e * Math.cos(E));
  const xo = r * Math.cos(nu), yo = r * Math.sin(nu);
  return { x: xo, y: -yo * Math.sin(inc), z: yo * Math.cos(inc) };
}

export function rangeFromEarth(id: string, jd: number): RangeInfo | null {
  if (id === 'sun' || id === 'earth') return null;
  if (id === 'moon') {
    // anomalistic month 27.55 d; perigee 363,300 / apogee 405,500 km
    const km = 384400 + 21000 * Math.sin((2 * Math.PI * (jd - BASE_JD)) / 27.55);
    return { au: km / AU_KM };
  }
  if (id === 'iss' || id === 'orbiter') return { au: 420 / AU_KM };
  const voy = VOYAGERS.find((v) => v.id === id);
  if (voy) return { au: voyagerAU(voy, jd - BASE_JD) };
  if (id === 'halley') return { au: d3(halleyRealHelio(jd), helioState('earth', jd)) };
  const host = MOON_HOST[id];
  if (host) {
    return { au: d3(helioState(host, jd), helioState('earth', jd)), hostKm: MOON_ORBIT_KM[id] };
  }
  if (!ELEMENTS[id]) return null;
  return { au: d3(helioState(id, jd), helioState('earth', jd)) };
}

// Trend window: ±halfSpanDays around jd, n samples.
export function rangeSeries(id: string, jd: number, n = 121): number[] | null {
  const half = id === 'moon' ? 30 : id.startsWith('voyager') ? 365 : 183;
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const r = rangeFromEarth(id, jd - half + (2 * half * k) / (n - 1));
    if (!r) return null;
    out.push(r.au);
  }
  return out;
}

export function fmtLightTime(au: number, zh: boolean): string {
  const s = au * LIGHT_SEC_PER_AU;
  if (s >= 3600) {
    const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
    return zh ? `${h} 小时 ${m} 分` : `${h} H ${m} MIN`;
  }
  if (s >= 60) {
    const m = Math.floor(s / 60), ss = Math.round(s % 60);
    return zh ? `${m} 分 ${String(ss).padStart(2, '0')} 秒` : `${m} MIN ${String(ss).padStart(2, '0')} S`;
  }
  return zh ? `${s.toFixed(1)} 秒` : `${s.toFixed(1)} S`;
}
