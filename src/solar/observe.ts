// HELION — "tonight's sky" observing assistant.
// All math is local & display-grade: JPL approximate elements (±1 day on
// oppositions, ±~1° on positions) → geocentric ecliptic → equatorial →
// alt/az for a given observer. Validated against known 2026/2027 oppositions.
import { helioState } from './ephem';

const DEG = Math.PI / 180;
const OBL = 23.4397 * DEG; // obliquity of the ecliptic

export interface City { id: string; name: string; cn: string; lat: number; lon: number; tz: number }
export const CITIES: City[] = [
  { id: 'beijing', name: 'BEIJING', cn: '北京', lat: 39.9, lon: 116.4, tz: 8 },
  { id: 'shanghai', name: 'SHANGHAI', cn: '上海', lat: 31.2, lon: 121.5, tz: 8 },
  { id: 'guangzhou', name: 'GUANGZHOU', cn: '广州', lat: 23.1, lon: 113.3, tz: 8 },
  { id: 'shenzhen', name: 'SHENZHEN', cn: '深圳', lat: 22.5, lon: 114.1, tz: 8 },
  { id: 'chengdu', name: 'CHENGDU', cn: '成都', lat: 30.6, lon: 104.1, tz: 8 },
  { id: 'xian', name: "XI'AN", cn: '西安', lat: 34.3, lon: 108.9, tz: 8 },
  { id: 'harbin', name: 'HARBIN', cn: '哈尔滨', lat: 45.8, lon: 126.5, tz: 8 },
  { id: 'urumqi', name: 'URUMQI', cn: '乌鲁木齐', lat: 43.8, lon: 87.6, tz: 8 },
  { id: 'lhasa', name: 'LHASA', cn: '拉萨', lat: 29.7, lon: 91.1, tz: 8 },
  { id: 'hongkong', name: 'HONG KONG', cn: '香港', lat: 22.3, lon: 114.2, tz: 8 },
  { id: 'taipei', name: 'TAIPEI', cn: '台北', lat: 25.0, lon: 121.6, tz: 8 },
  { id: 'singapore', name: 'SINGAPORE', cn: '新加坡', lat: 1.35, lon: 103.8, tz: 8 },
  { id: 'tokyo', name: 'TOKYO', cn: '东京', lat: 35.7, lon: 139.7, tz: 9 },
  { id: 'sydney', name: 'SYDNEY', cn: '悉尼', lat: -33.9, lon: 151.2, tz: 11 },
  { id: 'london', name: 'LONDON', cn: '伦敦', lat: 51.5, lon: -0.13, tz: 1 },
  { id: 'newyork', name: 'NEW YORK', cn: '纽约', lat: 40.7, lon: -74.0, tz: -4 },
  { id: 'losangeles', name: 'LOS ANGELES', cn: '洛杉矶', lat: 34.1, lon: -118.2, tz: -7 },
  { id: 'capetown', name: 'CAPE TOWN', cn: '开普敦', lat: -33.9, lon: 18.4, tz: 2 },
];

export interface RaDec { ra: number; dec: number; r: number; R: number } // ra hours, dec deg; r heliocentric AU, R geocentric AU

// Geocentric equatorial coordinates of a body (id in ELEMENTS) at jd.
export function equatorial(id: string, jd: number): RaDec {
  const p = helioState(id, jd);
  const e = helioState('earth', jd);
  const dx = p.x - e.x, dy = p.y - e.y, dz = p.z - e.z;
  const R = Math.hypot(dx, dy, dz);
  const lam = Math.atan2(dy, dx), beta = Math.asin(dz / R);
  const ra = Math.atan2(Math.sin(lam) * Math.cos(OBL) - Math.tan(beta) * Math.sin(OBL), Math.cos(lam));
  const dec = Math.asin(Math.sin(beta) * Math.cos(OBL) + Math.cos(beta) * Math.sin(OBL) * Math.sin(lam));
  const rp = Math.hypot(p.x, p.y, p.z);
  return { ra: ((ra / DEG / 15) % 24 + 24) % 24, dec: dec / DEG, r: rp, R };
}

// Geocentric equatorial coordinates of the Sun at jd.
export function sunEquatorial(jd: number): { ra: number; dec: number } {
  const e = helioState('earth', jd);
  const lam = Math.atan2(-e.y, -e.x);
  const ra = Math.atan2(Math.sin(lam) * Math.cos(OBL), Math.cos(lam));
  const dec = Math.asin(Math.sin(OBL) * Math.sin(lam));
  return { ra: ((ra / DEG / 15) % 24 + 24) % 24, dec: dec / DEG };
}

export function gmstHours(jd: number): number {
  return ((18.697374558 + 24.06570982441908 * (jd - 2451545.0)) % 24 + 24) % 24;
}

// Altitude/azimuth (deg) for ra/dec at observer lat/lon (deg) and jd.
// az measured FROM NORTH, eastward (0=N, 90=E, 180=S).
export function altAz(raH: number, decDeg: number, latDeg: number, lonDeg: number, jd: number): { alt: number; az: number } {
  const lst = gmstHours(jd) + lonDeg / 15;
  const H = (lst - raH) * 15 * DEG;
  const phi = latDeg * DEG, dec = decDeg * DEG;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const azS = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)); // from south
  return { alt: alt / DEG, az: ((azS / DEG + 180) % 360 + 360) % 360 };
}

const MAG_V0: Record<string, number> = {
  mercury: -0.60, venus: -4.47, mars: -1.52, jupiter: -9.40,
  saturn: -8.88, uranus: -7.19, neptune: -6.87,
};

// Approximate visual magnitude V ≈ 5·log10(r·R) + V0 (display-grade).
export function approxMag(id: string, rd: RaDec): number {
  const v0 = MAG_V0[id];
  if (v0 == null) return 99;
  let m = v0 + 5 * Math.log10(rd.r * rd.R);
  // clamp to realistic bounds (phase effects not modelled)
  const lo: Record<string, number> = { mercury: -2.8, venus: -4.9, mars: -3.0, jupiter: -2.9, saturn: -0.5, uranus: 5.3, neptune: 7.7 };
  if (lo[id] != null && m < lo[id]) m = lo[id];
  return m;
}

const WINDS_EN = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const WINDS_ZH = ['北', '北东北', '东北', '东东北', '东', '东东南', '东南', '南东南', '南', '南西南', '西南', '西西南', '西', '西西北', '西北', '北西北'];
export function compass(az: number, zh: boolean): string {
  const i = Math.round(az / 22.5) % 16;
  return zh ? WINDS_ZH[i] : WINDS_EN[i];
}

// ---- tonight's visibility ------------------------------------------------
export interface PlanetSight {
  id: string;
  visible: boolean;
  startH: number | null;   // local hours
  endH: number | null;
  bestH: number | null;    // local hour of max altitude
  maxAlt: number;
  azAtBest: number;
  mag: number;
}

export interface TonightReport {
  dateJd: number;
  duskH: number | null;    // local hours, sun alt < −12°
  dawnH: number | null;
  sights: PlanetSight[];
  moonAgeDays: number;     // 0..29.53
  moonIllum: number;       // 0..1
}

const NAKED = new Set(['mercury', 'venus', 'mars', 'jupiter', 'saturn']);
const OBS_IDS = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

// Scan the night that begins on the local evening of the date containing jdNoon.
export function tonightReport(jd0: number, city: City, newMoonJd: number): TonightReport {
  // start sampling at local noon of jd0's date
  const jdStart = Math.floor(jd0 - 0.5) + 0.5 - city.tz / 24 + 0.5; // ≈ local noon in UTC jd
  const step = 5 / 1440; // 5 minutes
  const sunAlt = (jd: number) => { const s = sunEquatorial(jd); return altAz(s.ra, s.dec, city.lat, city.lon, jd).alt; };

  let duskH: number | null = null, dawnH: number | null = null;
  const samples = 288; // 5-minute samples over 24 h
  let prevAbove: boolean | null = null;
  for (let k = 0; k <= samples; k++) {
    const jd = jdStart + k * step;
    const above = sunAlt(jd) > -12;
    if (prevAbove === true && !above && duskH === null) duskH = (jd - jdStart) * 24;
    if (prevAbove === false && above && duskH !== null && dawnH === null) dawnH = (jd - jdStart) * 24;
    prevAbove = above;
  }

  const sights: PlanetSight[] = OBS_IDS.map((id) => {
    let best = { alt: -90, az: 0, h: 0 };
    let winStart: number | null = null, winEnd: number | null = null;
    for (let k = 0; k <= samples; k++) {
      const jd = jdStart + k * step;
      if (sunAlt(jd) > -12) continue; // need darkness
      const rd = equatorial(id, jd);
      const { alt, az } = altAz(rd.ra, rd.dec, city.lat, city.lon, jd);
      const h = (jd - jdStart) * 24;
      if (alt > best.alt) best = { alt, az, h };
      if (alt > 10) {
        if (winStart === null) winStart = h;
        winEnd = h;
      }
    }
    const rd0 = equatorial(id, jd0);
    const mag = approxMag(id, rd0);
    const longEnough = winStart !== null && (winEnd! - winStart) * 60 >= 15;
    const visible = longEnough && best.alt > 10 && mag < 8;
    return {
      id, visible,
      startH: visible ? winStart : null, endH: visible ? winEnd : null,
      bestH: visible ? best.h : null,
      maxAlt: best.alt, azAtBest: best.az, mag,
    };
  });

  const syn = 29.530588853;
  const age = ((jd0 - newMoonJd) % syn + syn) % syn;
  const illum = (1 - Math.cos((2 * Math.PI * age) / syn)) / 2;

  return { dateJd: jd0, duskH, dawnH, sights, moonAgeDays: age, moonIllum: illum };
}

export function fmtLocalH(h: number): string {
  const hc = (h + 12) % 24; // h counts from local noon
  const hh = Math.floor(hc), mm = Math.round((hc % 1) * 60);
  const H = mm === 60 ? (hh + 1) % 24 : hh, M = mm === 60 ? 0 : mm;
  return `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`;
}

export function magClass(mag: number, id: string): 'naked' | 'binoc' | 'scope' {
  if (NAKED.has(id) && mag < 5.5) return 'naked';
  if (mag < 8) return 'binoc';
  return 'scope';
}
