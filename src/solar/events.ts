// Analytic sky-event engine — finds oppositions, conjunctions and perihelion
// passages directly from the ephemeris, independent of the running simulation.
import { ELEMENTS, helioLonLat, HALLEY, BASE_JD } from './ephem';

export type EventType = 'opposition' | 'conjunction' | 'perihelion';

export interface AstroEvent {
  jd: number;
  type: EventType;
  a: string;          // primary body id ('earth' for opposition events)
  b: string;          // second body id ('halley' for perihelion)
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
  out.sort((x, y) => x.jd - y.jd);
  // drop near-duplicates (same bodies within 3 days — shouldn't happen, safety net)
  const seen = new Set<string>();
  return out.filter(e => {
    const k = `${e.type}:${e.a}:${e.b}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, count);
}
