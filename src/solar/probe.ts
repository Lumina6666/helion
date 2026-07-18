// Probe flight core — heliocentric N-body propagation in AU/day units.
// The Sun is integrated as a point mass; planets contribute third-body
// perturbations from their analytic ephemeris (helioState), so no coupled
// integration is needed and gravity assists emerge naturally.
import { helioState } from './ephem';

export const MU_SUN = 2.959122082855911e-4; // AU^3/day^2 (Gaussian k^2)
export const KMS_TO_AUDAY = 86400 / 149597870.7; // km/s → AU/day
export const AUDAY_TO_KMS = 149597870.7 / 86400;

// planet μ = μ_sun / mass-ratio
export const PLANET_MU: Record<string, number> = {
  mercury: MU_SUN / 6023657,
  venus: MU_SUN / 408523.71,
  earth: MU_SUN / 332946.048,
  mars: MU_SUN / 3098703.59,
  jupiter: MU_SUN / 1047.348644,
  saturn: MU_SUN / 3497.9018,
  uranus: MU_SUN / 22902.98161303,
  neptune: MU_SUN / 19412.26,
};

// physical radii (AU) for impact checks
export const PLANET_RADIUS_AU: Record<string, number> = {
  mercury: 1.630e-5, venus: 4.045e-5, earth: 4.263e-5, mars: 2.266e-5,
  jupiter: 4.778e-4, saturn: 4.027e-4, uranus: 1.702e-4, neptune: 1.652e-4,
};

// mission flyby success thresholds (AU) — generous for playability
export const FLYBY_THRESHOLD_AU: Record<string, number> = {
  mars: 0.012, jupiter: 0.08, saturn: 0.06, uranus: 0.05, neptune: 0.05,
  venus: 0.01, mercury: 0.008,
};

export interface ProbeState {
  x: number; y: number; z: number;     // AU, heliocentric ecliptic
  vx: number; vy: number; vz: number;  // AU/day
  jd: number;
}

export function accel(s: ProbeState, out: [number, number, number]): void {
  const r2 = s.x * s.x + s.y * s.y + s.z * s.z;
  const r = Math.sqrt(r2);
  const f = -MU_SUN / (r2 * r);
  let ax = s.x * f, ay = s.y * f, az = s.z * f;
  for (const id in PLANET_MU) {
    const p = helioState(id, s.jd);
    const dx = p.x - s.x, dy = p.y - s.y, dz = p.z - s.z;
    // softened distance — avoids the singularity when co-located with a body
    const d2 = Math.max(dx * dx + dy * dy + dz * dz, 1e-12);
    const d = Math.sqrt(d2);
    const mu = PLANET_MU[id];
    // direct pull toward the planet
    let g = mu / (d2 * d);
    ax += dx * g; ay += dy * g; az += dz * g;
    // indirect term — heliocentric frame is non-inertial
    const pr2 = p.x * p.x + p.y * p.y + p.z * p.z;
    const pr = Math.sqrt(pr2);
    g = mu / (pr2 * pr);
    ax -= p.x * g; ay -= p.y * g; az -= p.z * g;
  }
  out[0] = ax; out[1] = ay; out[2] = az;
}

const a1: [number, number, number] = [0, 0, 0];
const a2: [number, number, number] = [0, 0, 0];

// one velocity-Verlet step
export function stepProbe(s: ProbeState, dt: number): void {
  accel(s, a1);
  s.x += s.vx * dt + 0.5 * a1[0] * dt * dt;
  s.y += s.vy * dt + 0.5 * a1[1] * dt * dt;
  s.z += s.vz * dt + 0.5 * a1[2] * dt * dt;
  s.jd += dt;
  accel(s, a2);
  s.vx += 0.5 * (a1[0] + a2[0]) * dt;
  s.vy += 0.5 * (a1[1] + a2[1]) * dt;
  s.vz += 0.5 * (a1[2] + a2[2]) * dt;
}

// adaptive step size: finer near the Sun / any planet
export function adaptiveDt(s: ProbeState): number {
  const r = Math.hypot(s.x, s.y, s.z);
  let dt = r < 0.6 ? 0.02 : r < 2.5 ? 0.05 : 0.2;
  for (const id in PLANET_MU) {
    const p = helioState(id, s.jd);
    const d = Math.hypot(p.x - s.x, p.y - s.y, p.z - s.z);
    if (d < 0.05) { dt = Math.min(dt, 0.01); break; }
    if (d < 0.3) dt = Math.min(dt, 0.02);
  }
  return dt;
}

export function distToBody(s: ProbeState, id: string): number {
  const p = helioState(id, s.jd);
  return Math.hypot(p.x - s.x, p.y - s.y, p.z - s.z);
}

export function relSpeedKms(s: ProbeState, id: string): number {
  const p1 = helioState(id, s.jd - 0.25);
  const p2 = helioState(id, s.jd + 0.25);
  const bvx = (p2.x - p1.x) / 0.5, bvy = (p2.y - p1.y) / 0.5, bvz = (p2.z - p1.z) / 0.5;
  return Math.hypot(s.vx - bvx, s.vy - bvy, s.vz - bvz) * AUDAY_TO_KMS;
}

// analytic heliocentric velocity of a planet (finite difference), AU/day
export function bodyVelocity(id: string, jd: number): [number, number, number] {
  const p1 = helioState(id, jd - 0.25);
  const p2 = helioState(id, jd + 0.25);
  return [(p2.x - p1.x) / 0.5, (p2.y - p1.y) / 0.5, (p2.z - p1.z) / 0.5];
}

// ----------------------------------------------------------- scene mapping
// log-log interpolation through the scene's compressed display radii
const ANCHORS: Array<[number, number]> = [
  [0.387, 13.5], [0.723, 18.5], [1.0, 24], [1.524, 30],
  [5.203, 43], [9.583, 57], [19.19, 70], [30.07, 82], [39.48, 90],
];

export function auToSceneRadius(au: number): number {
  if (au <= 0) return 0;
  if (au > 39.48) return 90 + (au - 39.48) * 0.12;
  const la = Math.log(au);
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const [a0, r0] = ANCHORS[i];
    const [a1n, r1] = ANCHORS[i + 1];
    if (au <= a1n || i === ANCHORS.length - 2) {
      const t = (la - Math.log(a0)) / (Math.log(a1n) - Math.log(a0));
      return Math.exp(Math.log(r0) + t * (Math.log(r1) - Math.log(r0)));
    }
  }
  return 90;
}

// heliocentric ecliptic AU → scene position (matches engine's ephem mapping)
export function auToScenePos(x: number, y: number, z: number): { x: number; y: number; z: number } {
  const r = Math.hypot(x, y, z);
  const R = auToSceneRadius(r);
  if (r === 0) return { x: 0, y: 0, z: 0 };
  const k = R / r;
  return { x: x * k, y: z * k, z: y * k }; // ecliptic (x,y,z) → scene (x, z-up→y, y→z)
}

// ----------------------------------------------------------- propagation
export interface PredictResult {
  points: Float32Array;  // scene-space xyz triplets
  count: number;
  outcome: 'flying' | 'impact' | 'escaped';
  bodyId: string | null;
}

// Forward-propagate for the prediction line. Cheap coarse integration.
export function predictOrbit(s0: ProbeState, maxDays = 10 * 365.25, maxPts = 900): PredictResult {
  const s: ProbeState = { ...s0 };
  const pts = new Float32Array(maxPts * 3);
  let count = 0;
  let sinceEmit = 0;
  const emitEvery = maxDays / maxPts;
  let outcome: PredictResult['outcome'] = 'flying';
  let bodyId: string | null = null;

  const push = () => {
    const p = auToScenePos(s.x, s.y, s.z);
    pts[count * 3] = p.x; pts[count * 3 + 1] = p.y; pts[count * 3 + 2] = p.z;
    count++;
  };
  push();

  while (s.jd - s0.jd < maxDays && count < maxPts) {
    const dt = Math.max(adaptiveDt(s), 0.25);
    stepProbe(s, dt);
    sinceEmit += dt;
    const r = Math.hypot(s.x, s.y, s.z);
    if (r < 0.02) { outcome = 'impact'; bodyId = 'sun'; push(); break; }
    if (r > 80) { outcome = 'escaped'; push(); break; }
    for (const id in PLANET_RADIUS_AU) {
      if (distToBody(s, id) < PLANET_RADIUS_AU[id] * 5) { outcome = 'impact'; bodyId = id; push(); break; }
    }
    if (outcome !== 'flying') break;
    if (sinceEmit >= emitEvery) { push(); sinceEmit = 0; }
  }
  return { points: pts, count, outcome, bodyId };
}
