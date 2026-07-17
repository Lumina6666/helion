// HELION — Solar system data
// Visual units: Sun radius = 5. Earth orbit = 24 units = 1 AU.
// Orbital periods derive from Kepler's third law: T ∝ a^1.5 (Earth = 24 s at 1×).

export interface PlanetSpec {
  id: string;
  name: string;        // HUD display name
  cn: string;          // Chinese name
  radius: number;      // visual radius (units)
  distance: number;    // semi-major axis (units)
  inclination: number; // orbital inclination (deg, vs ecliptic)
  tiltDeg: number;     // axial tilt (deg)
  spin: number;        // relative rotation speed
  tex: TexKind;
  color: string;       // accent color for orbit / label
  ring?: { inner: number; outer: number; color: string; opacity: number };
  fact: string;        // telemetry fact line (EN)
  factCn: string;      // telemetry fact line (ZH)
}

export type TexKind =
  | 'mercury' | 'venus' | 'earth' | 'mars'
  | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';

export const SUN_RADIUS = 5;
export const AU_UNITS = 24;          // units per AU
export const EARTH_PERIOD = 24;      // seconds per Earth year at 1×
export const DAYS_PER_SECOND = 365.25 / EARTH_PERIOD;

export const PLANETS: PlanetSpec[] = [
  {
    id: 'mercury', name: 'MERCURY', cn: '水星',
    radius: 0.55, distance: 13.5, inclination: 7.0, tiltDeg: 0.03, spin: 0.6,
    tex: 'mercury', color: '#b8a99a',
    fact: '0.39 AU · 88 D ORBIT · −173/427 °C',
    factCn: '0.39 AU · 88 天公转 · −173/427 °C',
  },
  {
    id: 'venus', name: 'VENUS', cn: '金星',
    radius: 0.95, distance: 18.5, inclination: 3.39, tiltDeg: 177.4, spin: -0.35,
    tex: 'venus', color: '#e8c87a',
    fact: '0.72 AU · 225 D ORBIT · 464 °C MEAN',
    factCn: '0.72 AU · 225 天公转 · 平均 464 °C',
  },
  {
    id: 'earth', name: 'EARTH', cn: '地球',
    radius: 1.0, distance: 24, inclination: 0.0, tiltDeg: 23.44, spin: 1.0,
    tex: 'earth', color: '#6fb7ff',
    fact: '1.00 AU · 365.25 D · 1 MOON · 5.97×10²⁴ KG',
    factCn: '1.00 AU · 365.25 天 · 1 颗卫星 · 5.97×10²⁴ 千克',
  },
  {
    id: 'mars', name: 'MARS', cn: '火星',
    radius: 0.72, distance: 30, inclination: 1.85, tiltDeg: 25.19, spin: 0.97,
    tex: 'mars', color: '#e07a4f',
    fact: '1.52 AU · 687 D · OLYMPUS MONS 21.9 KM',
    factCn: '1.52 AU · 687 天 · 奥林帕斯山高 21.9 千米',
  },
  {
    id: 'jupiter', name: 'JUPITER', cn: '木星',
    radius: 2.9, distance: 43, inclination: 1.3, tiltDeg: 3.13, spin: 2.4,
    tex: 'jupiter', color: '#d8b28c',
    fact: '5.20 AU · 11.86 YR · GREAT RED SPOT',
    factCn: '5.20 AU · 11.86 年 · 大红斑',
  },
  {
    id: 'saturn', name: 'SATURN', cn: '土星',
    radius: 2.45, distance: 57, inclination: 2.49, tiltDeg: 26.73, spin: 2.2,
    tex: 'saturn', color: '#e3cf9e',
    ring: { inner: 1.25, outer: 2.3, color: '#d9c298', opacity: 0.9 },
    fact: '9.58 AU · 29.45 YR · 274 CONFIRMED MOONS',
    factCn: '9.58 AU · 29.45 年 · 274 颗已确认卫星',
  },
  {
    id: 'uranus', name: 'URANUS', cn: '天王星',
    radius: 1.7, distance: 70, inclination: 0.77, tiltDeg: 97.77, spin: -1.4,
    tex: 'uranus', color: '#9fdfe3',
    ring: { inner: 1.6, outer: 1.95, color: '#bfe8ea', opacity: 0.35 },
    fact: '19.2 AU · 84 YR · 98° AXIAL TILT',
    factCn: '19.2 AU · 84 年 · 自转轴倾角 98°',
  },
  {
    id: 'neptune', name: 'NEPTUNE', cn: '海王星',
    radius: 1.65, distance: 82, inclination: 1.77, tiltDeg: 28.32, spin: 1.5,
    tex: 'neptune', color: '#5f83e8',
    fact: '30.1 AU · 164.8 YR · 2,100 KM/H WINDS',
    factCn: '30.1 AU · 164.8 年 · 风速 2,100 千米/时',
  },
  {
    id: 'pluto', name: 'PLUTO', cn: '冥王星',
    radius: 0.38, distance: 90, inclination: 17.16, tiltDeg: 122.5, spin: 0.8,
    tex: 'pluto', color: '#c9b8a8',
    fact: '39.5 AU · 248 YR · DWARF PLANET',
    factCn: '39.5 AU · 248 年 · 矮行星',
  },
];

export const keplerPeriod = (distance: number) =>
  EARTH_PERIOD * Math.pow(distance / AU_UNITS, 1.5);

export const WARP_LEVELS = [1, 4, 16, 64, 256];

export interface ShotSpec {
  name: string;
  nameCn: string;
  targetId: string;    // 'sun' or planet id
  radius: number;      // orbit radius around target (units)
  inclination: number; // camera elevation (deg)
  azimuth: number;     // start azimuth (deg)
  drift: number;       // azimuth drift (deg/s)
  duration: number;    // seconds
}

export const CINE_SHOTS: ShotSpec[] = [
  { name: 'SOL CORONA',   nameCn: '日冕巡航',   targetId: 'sun',     radius: 21,  inclination: 11, azimuth: 20,  drift: 3.2, duration: 11 },
  { name: 'HOME WORLD',   nameCn: '蓝色家园',   targetId: 'earth',   radius: 5.2, inclination: 18, azimuth: 140, drift: 4.5, duration: 12 },
  { name: 'RED PLANET',   nameCn: '红色星球',   targetId: 'mars',    radius: 4.6, inclination: 12, azimuth: 260, drift: 5.0, duration: 11 },
  { name: 'THE GIANT',    nameCn: '巨行星',     targetId: 'jupiter', radius: 11,  inclination: 16, azimuth: 60,  drift: 3.4, duration: 12 },
  { name: 'RINGWORLD',    nameCn: '光环世界',   targetId: 'saturn',  radius: 12,  inclination: 24, azimuth: 300, drift: 3.0, duration: 13 },
  { name: 'ICE GIANTS',   nameCn: '冰巨星',     targetId: 'neptune', radius: 9,   inclination: 20, azimuth: 200, drift: 4.0, duration: 11 },
  { name: 'THE SYSTEM',   nameCn: '全星系',     targetId: 'sun',     radius: 105, inclination: 38, azimuth: 0,   drift: 2.2, duration: 14 },
];

export interface ViewSpec {
  name: string;
  nameCn: string;
  distance: number;
  elevation: number; // deg above ecliptic
  azimuth: number;   // deg
}

export const VIEWS: ViewSpec[] = [
  { name: 'OVERVIEW 38°', nameCn: '俯瞰 38°',  distance: 118, elevation: 38, azimuth: -35 },
  { name: 'EDGE-ON',      nameCn: '侧视平面',  distance: 130, elevation: 2.5, azimuth: 90 },
  { name: 'POLAR',        nameCn: '极地俯视',  distance: 128, elevation: 89, azimuth: 0 },
  { name: 'INNER SYSTEM', nameCn: '内太阳系',  distance: 52,  elevation: 26, azimuth: 160 },
];

export const INTRO_QUOTE = '“The cosmos is within us. We are made of star-stuff.” — Carl Sagan';
