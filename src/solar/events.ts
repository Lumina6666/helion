// Analytic sky-event engine — finds oppositions, conjunctions and perihelion
// passages directly from the ephemeris, independent of the running simulation.
import { ELEMENTS, helioLonLat, HALLEY, BASE_JD } from './ephem';

export type EventType = 'opposition' | 'conjunction' | 'perihelion' | 'solarEclipse' | 'lunarEclipse' | 'transit';

export interface AstroEvent {
  jd: number;
  type: EventType;
  a: string;          // primary body id ('earth' for opposition events)
  b: string;          // second body id ('halley' for perihelion)
  info?: string;      // eclipses/transits: pre-baked bilingual caption
  infoCn?: string;
}

// ------------------------------------------------------------ eclipses & transits
// Hardcoded from NASA/GSFC eclipse canon (eclipse.gsfc.nasa.gov) — eclipse
// prediction needs the lunar node cycle which the scene does not model, and
// a serious forecast that is ±1 day wrong is worthless. The TABLE is exact;
// the scene then demonstrates the real shadow geometry for that date.
export interface EclipseEvent {
  jd: number;
  kind: 'solar' | 'lunar' | 'transit';
  subtype: string; subtypeCn: string;       // TOTAL / ANNULAR / PARTIAL / PENUMBRAL
  region: string; regionCn: string;
  umbraKm?: number;  // umbral cone length — the total/annular discriminator
  note?: string; noteCn?: string;
}
const JD_OF = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d, 12) / 86400000 + 2440587.5;
export const ECLIPSES: EclipseEvent[] = [
  { jd: JD_OF(2026, 2, 17), kind: 'solar', subtype: 'ANNULAR', subtypeCn: '日环食',
    region: 'Antarctica · partial S. America & S. Africa', regionCn: '南极洲 · 南美洲/非洲南部偏食',
    umbraKm: 372000, note: 'Umbra falls short — a ring of fire', noteCn: '本影锥未及地表 — 火环' },
  { jd: JD_OF(2026, 3, 3), kind: 'lunar', subtype: 'TOTAL', subtypeCn: '月全食',
    region: 'Asia · Australia · Americas', regionCn: '亚洲 · 澳洲 · 美洲', umbraKm: 1380000 },
  { jd: JD_OF(2026, 8, 12), kind: 'solar', subtype: 'TOTAL', subtypeCn: '日全食',
    region: 'Greenland · Iceland · Spain — 2m18s', regionCn: '格陵兰 · 冰岛 · 西班牙 — 2分18秒',
    umbraKm: 376000, note: 'First mainland-Europe totality since 1999', noteCn: '1999 年以来欧洲大陆首次全食' },
  { jd: JD_OF(2026, 8, 28), kind: 'lunar', subtype: 'PARTIAL 0.93', subtypeCn: '月偏食 0.93',
    region: 'Americas · Europe · Africa', regionCn: '美洲 · 欧洲 · 非洲', umbraKm: 1380000 },
  { jd: JD_OF(2027, 2, 6), kind: 'solar', subtype: 'ANNULAR', subtypeCn: '日环食',
    region: 'S. Chile · Argentina', regionCn: '智利南部 · 阿根廷', umbraKm: 372000 },
  { jd: JD_OF(2027, 2, 20), kind: 'lunar', subtype: 'PENUMBRAL', subtypeCn: '半影月食',
    region: 'Americas · Europe · Africa · Asia', regionCn: '美洲 · 欧洲 · 非洲 · 亚洲' },
  { jd: JD_OF(2027, 7, 18), kind: 'lunar', subtype: 'PENUMBRAL', subtypeCn: '半影月食',
    region: 'E. Africa · Asia · Australia', regionCn: '东非 · 亚洲 · 澳洲' },
  { jd: JD_OF(2027, 8, 2), kind: 'solar', subtype: 'TOTAL', subtypeCn: '日全食',
    region: 'Spain · N. Africa · Egypt · Saudi — 6m23s', regionCn: '西班牙 · 北非 · 埃及 · 沙特 — 6分23秒',
    umbraKm: 378500, note: 'Longest land totality of the century', noteCn: '本世纪最长陆地全食' },
  { jd: JD_OF(2027, 8, 17), kind: 'lunar', subtype: 'PENUMBRAL', subtypeCn: '半影月食',
    region: 'Americas · W. Africa · E. Australia', regionCn: '美洲 · 西非 · 澳洲东部' },
  { jd: JD_OF(2028, 1, 12), kind: 'lunar', subtype: 'PARTIAL 0.07', subtypeCn: '月偏食 0.07',
    region: 'Americas · Europe · Africa · W. Asia', regionCn: '美洲 · 欧洲 · 非洲 · 西亚', umbraKm: 1380000 },
  { jd: JD_OF(2028, 1, 26), kind: 'solar', subtype: 'ANNULAR', subtypeCn: '日环食',
    region: 'Ecuador · Peru · Brazil · Spain — up to 10m27s', regionCn: '厄瓜多尔 · 秘鲁 · 巴西 · 西班牙 — 最长达 10分27秒',
    umbraKm: 370000, note: 'Moon near apogee — umbra falls short', noteCn: '月球近远地点 — 本影锥未及地表' },
  { jd: JD_OF(2028, 7, 6), kind: 'lunar', subtype: 'PARTIAL 0.40', subtypeCn: '月偏食 0.40',
    region: 'Europe · Africa · Asia · Australia', regionCn: '欧洲 · 非洲 · 亚洲 · 澳洲', umbraKm: 1380000 },
  { jd: JD_OF(2028, 7, 22), kind: 'solar', subtype: 'TOTAL', subtypeCn: '日全食',
    region: 'Australia (Sydney!) · New Zealand — 5m10s', regionCn: '澳大利亚（悉尼在带内！）· 新西兰 — 5分10秒',
    umbraKm: 375000 },
  { jd: JD_OF(2028, 12, 31), kind: 'lunar', subtype: 'TOTAL', subtypeCn: '月全食',
    region: 'Europe · Africa · Asia · Australia — New Year\'s Eve', regionCn: '欧洲 · 非洲 · 亚洲 · 澳洲 — 跨年夜', umbraKm: 1380000 },
  { jd: JD_OF(2032, 11, 13), kind: 'transit', subtype: 'MERCURY', subtypeCn: '水星凌日',
    region: 'Worldwide (telescope)', regionCn: '全球（需望远镜）' },
  { jd: JD_OF(2117, 12, 11), kind: 'transit', subtype: 'VENUS', subtypeCn: '金星凌日',
    region: 'Worldwide (telescope)', regionCn: '全球（需望远镜）',
    note: 'Next century — mark your calendar', noteCn: '下个世纪见 — 先记在日历上' },
];

// eclipse live within ±0.75 d of sim date (transits excluded from the demo rig)
export function activeEclipse(jd: number): EclipseEvent | null {
  return ECLIPSES.find(e => e.kind !== 'transit' && Math.abs(e.jd - jd) < 0.75) ?? null;
}

const TWO_PI = Math.PI * 2;

// signed smallest angular difference a-b in (-π, π]
function angDiff(a: number, b: number): number {
  let d = (a - b) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}

function lonOf(id: string, jd: number): number {
  return helioLonLat(id, jd).lon;
}

// mean synodic-ish step so we never skip an event window
function scanStep(a: string, b: string): number {
  const pa = Math.pow(ELEMENTS[a].a, 1.5) * 365.25;
  const pb = Math.pow(ELEMENTS[b].a, 1.5) * 365.25;
  const synodic = Math.abs(1 / (1 / Math.min(pa, pb) - 1 / Math.max(pa, pb)));
  return Math.min(Math.max(synodic / 120, 0.5), 12);
}

// Find the next moment after `afterJd` where lon(a)-lon(b) crosses `target`
// (0 for conjunction, π for opposition). Bisection down to ~0.05 day.
export function findNextAlignment(a: string, b: string, type: 'opposition' | 'conjunction', afterJd: number, maxDays = 366 * 30): number | null {
  const target = type === 'opposition' ? Math.PI : 0;
  const f = (jd: number) => angDiff(lonOf(a, jd), lonOf(b, jd) + target);
  const step = scanStep(a, b);
  let t0 = afterJd;
  let f0 = f(t0);
  for (let t = afterJd + step; t <= afterJd + maxDays; t += step) {
    const f1 = f(t);
    // a genuine zero crossing is a *small* sign flip; the wrap discontinuity
    // at ±π also flips the sign but with a ~2π jump — reject those.
    if (f0 * f1 < 0 && Math.abs(f0 - f1) < Math.PI) {
      let lo = t0, hi = t, flo = f0;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        const fm = f(mid);
        if (Math.abs(fm) > Math.PI / 2) { lo = mid; flo = fm; continue; } // guard wrap inside bisection
        if (flo * fm <= 0) hi = mid;
        else { lo = mid; flo = fm; }
      }
      return (lo + hi) / 2;
    }
    t0 = t; f0 = f1;
  }
  return null;
}

// Next Halley perihelion passage after `afterJd` — closed form from mean anomaly.
export function nextHalleyPerihelion(afterJd: number): number {
  const n = TWO_PI / HALLEY.periodDays;
  const M = (HALLEY.M0 + n * (afterJd - BASE_JD)) % TWO_PI;
  const wait = ((TWO_PI - M) % TWO_PI) / n;
  return afterJd + wait;
}

// Pairs offered to the prediction game & the auto-scanner.
// (outer-planet opposition = heliocentric Δλ=0 with Earth, so Earth pairs are
// excluded here to avoid duplicates with the opposition scanner)
export const CONJ_PAIRS: Array<[string, string]> = [
  ['mercury', 'venus'], ['venus', 'earth'], ['venus', 'mars'],
  ['mars', 'jupiter'], ['venus', 'jupiter'],
  ['jupiter', 'saturn'], ['mars', 'saturn'], ['jupiter', 'uranus'],
];
export const OPP_PLANETS = ['mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

// The next occurrence of a user-chosen event (for the prediction game).
export function solveEvent(type: EventType, a: string, b: string, afterJd: number): number | null {
  if (type === 'perihelion') return nextHalleyPerihelion(afterJd);
  if (type === 'solarEclipse' || type === 'lunarEclipse' || type === 'transit') {
    const hit = ECLIPSES.find(e => e.jd > afterJd &&
      (type === 'transit' ? e.kind === 'transit' : e.kind === (type === 'solarEclipse' ? 'solar' : 'lunar')));
    return hit ? hit.jd : null;
  }
  // opposition of an outer planet ⇔ heliocentric Δλ = 0 with Earth
  if (type === 'opposition') return findNextAlignment(a, b, 'conjunction', afterJd);
  return findNextAlignment(a, b, type, afterJd);
}

// Scan the upcoming sky: one entry per tracked pair, merged & sorted.
export function listUpcoming(afterJd: number, count = 8): AstroEvent[] {
  const out: AstroEvent[] = [];
  for (const [a, b] of CONJ_PAIRS) {
    const jd = findNextAlignment(a, b, 'conjunction', afterJd, 366 * 25);
    if (jd) out.push({ jd, type: 'conjunction', a, b });
  }
  for (const p of OPP_PLANETS) {
    // opposition of an outer planet ⇔ heliocentric Δλ(earth, planet) = 0
    const jd = findNextAlignment('earth', p, 'conjunction', afterJd, 366 * 25);
    if (jd) out.push({ jd, type: 'opposition', a: 'earth', b: p });
  }
  out.push({ jd: nextHalleyPerihelion(afterJd), type: 'perihelion', a: 'sun', b: 'halley' });
  // merge the exact-date eclipse & transit canon
  for (const e of ECLIPSES) {
    if (e.jd <= afterJd) continue;
    const type: EventType = e.kind === 'solar' ? 'solarEclipse' : e.kind === 'lunar' ? 'lunarEclipse' : 'transit';
    out.push({ jd: e.jd, type, a: e.kind === 'lunar' ? 'earth' : 'moon', b: e.kind === 'lunar' ? 'moon' : 'earth',
      info: `${e.subtype} ${e.kind.toUpperCase()}${e.kind === 'transit' ? ' TRANSIT' : ' ECLIPSE'} · ${e.region}`,
      infoCn: `${e.subtypeCn} · ${e.regionCn}` });
  }
  out.sort((x, y) => x.jd - y.jd);
  // drop near-duplicates (same bodies within 3 days — shouldn't happen, safety net)
  const seen = new Set<string>();
  return out.filter(e => {
    const k = e.info ? `${e.type}:${e.jd}` : `${e.type}:${e.a}:${e.b}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, count);
}
