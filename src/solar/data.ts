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

// ------------------------------------------------------------ small bodies
// Pseudo-specs so comet & probes share focus / telemetry / dossier plumbing.
export const HALLEY_SPEC: PlanetSpec = {
  id: 'halley', name: 'HALLEY', cn: '哈雷彗星',
  radius: 0.45, distance: 51.5, inclination: 0, tiltDeg: 0, spin: 1,
  tex: 'pluto', color: '#9fd8ff',
  fact: '1P/HALLEY · 75.3 YR · NEXT PERIHELION 2061-07',
  factCn: '1P/哈雷彗星 · 周期 75.3 年 · 下次近日点 2061 年 7 月',
};

export const VOYAGER_SPECS: PlanetSpec[] = [
  {
    id: 'voyager1', name: 'VOYAGER 1', cn: '旅行者 1 号',
    radius: 0.4, distance: 110, inclination: 0, tiltDeg: 0, spin: 0.5,
    tex: 'mercury', color: '#ffd28a',
    fact: 'LAUNCHED 1977 · INTERSTELLAR SPACE · 17.0 KM/S',
    factCn: '1977 年发射 · 星际空间 · 速度 17.0 千米/秒',
  },
  {
    id: 'voyager2', name: 'VOYAGER 2', cn: '旅行者 2 号',
    radius: 0.4, distance: 106, inclination: 0, tiltDeg: 0, spin: 0.5,
    tex: 'mercury', color: '#ffd28a',
    fact: 'LAUNCHED 1977 · ONLY CRAFT TO VISIT URANUS & NEPTUNE',
    factCn: '1977 年发射 · 唯一造访天王星与海王星的探测器',
  },
];

// ------------------------------------------------------------ dossier data
export interface DossierRow { k: string; kCn: string; v: string; vCn: string }
export interface Dossier {
  type: string; typeCn: string;
  diameterKm: number | null;   // null → no size bar (probes)
  blurb: string; blurbCn: string;
  rows: DossierRow[];
}

export const DOSSIER: Record<string, Dossier> = {
  mercury: {
    type: 'ROCKY PLANET', typeCn: '岩质行星', diameterKm: 4879,
    blurb: 'The swift planet — a year lasts 88 days, but a single solar day lasts 176 Earth days.',
    blurbCn: '最靠近太阳的行星——公转一年只要 88 天，但一个昼夜却长达 176 个地球日。',
    rows: [
      { k: 'MASS', kCn: '质量', v: '0.055 M⊕', vCn: '0.055 地球质量' },
      { k: 'DAY LENGTH', kCn: '自转周期', v: '58.6 DAYS', vCn: '58.6 天' },
      { k: 'YEAR', kCn: '公转周期', v: '88 DAYS', vCn: '88 天' },
      { k: 'MOONS', kCn: '卫星', v: '0', vCn: '0' },
      { k: 'TEMP RANGE', kCn: '温度范围', v: '−173 ~ 427 °C', vCn: '−173 ~ 427 °C' },
    ],
  },
  venus: {
    type: 'ROCKY PLANET', typeCn: '岩质行星', diameterKm: 12104,
    blurb: 'Spins backwards and slower than its year — on Venus the Sun rises in the west.',
    blurbCn: '自转方向与公转相反且比一年还慢——在金星上，太阳从西边升起。',
    rows: [
      { k: 'MASS', kCn: '质量', v: '0.815 M⊕', vCn: '0.815 地球质量' },
      { k: 'DAY LENGTH', kCn: '自转周期', v: '243 DAYS ↺', vCn: '243 天（逆向）' },
      { k: 'YEAR', kCn: '公转周期', v: '225 DAYS', vCn: '225 天' },
      { k: 'MOONS', kCn: '卫星', v: '0', vCn: '0' },
      { k: 'MEAN TEMP', kCn: '平均温度', v: '464 °C', vCn: '464 °C' },
    ],
  },
  earth: {
    type: 'ROCKY PLANET', typeCn: '岩质行星', diameterKm: 12742,
    blurb: 'The only known world with liquid-water oceans — and life.',
    blurbCn: '已知唯一拥有液态水海洋——以及生命的行星。',
    rows: [
      { k: 'MASS', kCn: '质量', v: '5.97×10²⁴ KG', vCn: '5.97×10²⁴ 千克' },
      { k: 'DAY LENGTH', kCn: '自转周期', v: '23.9 HOURS', vCn: '23.9 小时' },
      { k: 'YEAR', kCn: '公转周期', v: '365.25 DAYS', vCn: '365.25 天' },
      { k: 'MOONS', kCn: '卫星', v: '1', vCn: '1' },
      { k: 'MEAN TEMP', kCn: '平均温度', v: '15 °C', vCn: '15 °C' },
    ],
  },
  mars: {
    type: 'ROCKY PLANET', typeCn: '岩质行星', diameterKm: 6779,
    blurb: 'Home of Olympus Mons, a volcano nearly three times the height of Everest.',
    blurbCn: '拥有奥林帕斯山——高度接近珠穆朗玛峰三倍的巨型火山。',
    rows: [
      { k: 'MASS', kCn: '质量', v: '0.107 M⊕', vCn: '0.107 地球质量' },
      { k: 'DAY LENGTH', kCn: '自转周期', v: '24.6 HOURS', vCn: '24.6 小时' },
      { k: 'YEAR', kCn: '公转周期', v: '687 DAYS', vCn: '687 天' },
      { k: 'MOONS', kCn: '卫星', v: '2', vCn: '2' },
      { k: 'MEAN TEMP', kCn: '平均温度', v: '−63 °C', vCn: '−63 °C' },
    ],
  },
  jupiter: {
    type: 'GAS GIANT', typeCn: '气态巨行星', diameterKm: 139820,
    blurb: 'More massive than all other planets combined; the Great Red Spot is a storm larger than Earth.',
    blurbCn: '质量超过其他行星总和；大红斑是一场比地球还大的风暴。',
    rows: [
      { k: 'MASS', kCn: '质量', v: '317.8 M⊕', vCn: '317.8 地球质量' },
      { k: 'DAY LENGTH', kCn: '自转周期', v: '9.9 HOURS', vCn: '9.9 小时' },
      { k: 'YEAR', kCn: '公转周期', v: '11.86 YEARS', vCn: '11.86 年' },
      { k: 'MOONS', kCn: '卫星', v: '95', vCn: '95' },
      { k: 'CLOUD TOP', kCn: '云顶温度', v: '−108 °C', vCn: '−108 °C' },
    ],
  },
  saturn: {
    type: 'GAS GIANT', typeCn: '气态巨行星', diameterKm: 116460,
    blurb: 'Its rings span 280,000 km yet are only about ten metres thick in places.',
    blurbCn: '光环宽达 28 万千米，局部厚度却只有十米左右。',
    rows: [
      { k: 'MASS', kCn: '质量', v: '95.2 M⊕', vCn: '95.2 地球质量' },
      { k: 'DAY LENGTH', kCn: '自转周期', v: '10.7 HOURS', vCn: '10.7 小时' },
      { k: 'YEAR', kCn: '公转周期', v: '29.45 YEARS', vCn: '29.45 年' },
      { k: 'MOONS', kCn: '卫星', v: '274', vCn: '274' },
      { k: 'CLOUD TOP', kCn: '云顶温度', v: '−139 °C', vCn: '−139 °C' },
    ],
  },
  uranus: {
    type: 'ICE GIANT', typeCn: '冰巨星', diameterKm: 50724,
    blurb: 'Rolls around the Sun on its side — its axis is tipped 98 degrees.',
    blurbCn: '躺在轨道上公转——自转轴倾角高达 98 度。',
    rows: [
      { k: 'MASS', kCn: '质量', v: '14.5 M⊕', vCn: '14.5 地球质量' },
      { k: 'DAY LENGTH', kCn: '自转周期', v: '17.2 HOURS ↺', vCn: '17.2 小时（逆向）' },
      { k: 'YEAR', kCn: '公转周期', v: '84 YEARS', vCn: '84 年' },
      { k: 'MOONS', kCn: '卫星', v: '28', vCn: '28' },
      { k: 'CLOUD TOP', kCn: '云顶温度', v: '−197 °C', vCn: '−197 °C' },
    ],
  },
  neptune: {
    type: 'ICE GIANT', typeCn: '冰巨星', diameterKm: 49244,
    blurb: 'Supersonic winds up to 2,100 km/h — the fastest in the solar system.',
    blurbCn: '超音速风暴可达 2,100 千米/时——太阳系最快的风。',
    rows: [
      { k: 'MASS', kCn: '质量', v: '17.1 M⊕', vCn: '17.1 地球质量' },
      { k: 'DAY LENGTH', kCn: '自转周期', v: '16.1 HOURS', vCn: '16.1 小时' },
      { k: 'YEAR', kCn: '公转周期', v: '164.8 YEARS', vCn: '164.8 年' },
      { k: 'MOONS', kCn: '卫星', v: '16', vCn: '16' },
      { k: 'CLOUD TOP', kCn: '云顶温度', v: '−201 °C', vCn: '−201 °C' },
    ],
  },
  pluto: {
    type: 'DWARF PLANET', typeCn: '矮行星', diameterKm: 2376,
    blurb: 'Has a heart-shaped glacier the size of Texas — Tombaugh Regio.',
    blurbCn: '拥有一块得克萨斯州大小的心形冰川——汤博区。',
    rows: [
      { k: 'MASS', kCn: '质量', v: '0.002 M⊕', vCn: '0.002 地球质量' },
      { k: 'DAY LENGTH', kCn: '自转周期', v: '6.4 DAYS', vCn: '6.4 天' },
      { k: 'YEAR', kCn: '公转周期', v: '248 YEARS', vCn: '248 年' },
      { k: 'MOONS', kCn: '卫星', v: '5', vCn: '5' },
      { k: 'MEAN TEMP', kCn: '平均温度', v: '−229 °C', vCn: '−229 °C' },
    ],
  },
  halley: {
    type: 'PERIODIC COMET', typeCn: '周期彗星', diameterKm: 15,
    blurb: 'Returns every ~75 years; last seen 1986, next perihelion July 2061. Mark Twain was born and died with its visits.',
    blurbCn: '每约 75 年回归一次；上次出现为 1986 年，下次近日点在 2061 年 7 月。马克·吐温生卒皆逢其回归。',
    rows: [
      { k: 'NUCLEUS', kCn: '彗核', v: '15 × 8 KM', vCn: '15 × 8 千米' },
      { k: 'PERIOD', kCn: '周期', v: '75.3 YEARS', vCn: '75.3 年' },
      { k: 'PERIHELION', kCn: '近日点', v: '0.586 AU', vCn: '0.586 AU' },
      { k: 'APHELION', kCn: '远日点', v: '35.1 AU', vCn: '35.1 AU' },
      { k: 'MOTION', kCn: '运动方向', v: 'RETROGRADE', vCn: '逆行' },
    ],
  },
  voyager1: {
    type: 'DEEP-SPACE PROBE', typeCn: '深空探测器', diameterKm: null,
    blurb: 'The most distant human-made object — crossed into interstellar space in 2012, still whispering home.',
    blurbCn: '飞得最远的人造物体——2012 年进入星际空间，至今仍在向地球传回信号。',
    rows: [
      { k: 'LAUNCHED', kCn: '发射时间', v: '1977-09-05', vCn: '1977 年 9 月 5 日' },
      { k: 'SPEED', kCn: '速度', v: '17.0 KM/S', vCn: '17.0 千米/秒' },
      { k: 'STATUS', kCn: '状态', v: 'INTERSTELLAR', vCn: '星际空间' },
      { k: 'POWER UNTIL', kCn: '供电至约', v: '~2032', vCn: '约 2032 年' },
    ],
  },
  voyager2: {
    type: 'DEEP-SPACE PROBE', typeCn: '深空探测器', diameterKm: null,
    blurb: 'The grand tour — the only spacecraft to have visited Jupiter, Saturn, Uranus and Neptune.',
    blurbCn: '伟大的旅程——唯一先后造访木星、土星、天王星和海王星的探测器。',
    rows: [
      { k: 'LAUNCHED', kCn: '发射时间', v: '1977-08-20', vCn: '1977 年 8 月 20 日' },
      { k: 'SPEED', kCn: '速度', v: '15.4 KM/S', vCn: '15.4 千米/秒' },
      { k: 'STATUS', kCn: '状态', v: 'INTERSTELLAR', vCn: '星际空间' },
      { k: 'GRAND TOUR', kCn: '造访行星', v: '4 GIANTS', vCn: '4 颗巨行星' },
    ],
  },
};
