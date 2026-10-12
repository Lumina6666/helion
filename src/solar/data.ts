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
  | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto'
  | 'ceres' | 'vesta'
  | 'io' | 'europa' | 'ganymede' | 'callisto' | 'titan' | 'enceladus'
  | 'eris' | 'haumea' | 'makemake'
  | 'phobos' | 'deimos' | 'ariel' | 'titania' | 'oberon' | 'triton' | 'charon'
  | 'apophis';

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
  galaxy?: boolean; // entry point: switches to the Milky Way mode instead of a camera preset
}

export const VIEWS: ViewSpec[] = [
  { name: 'OVERVIEW 38°', nameCn: '俯瞰 38°',  distance: 118, elevation: 38, azimuth: -35 },
  { name: 'EDGE-ON',      nameCn: '侧视平面',  distance: 130, elevation: 2.5, azimuth: 90 },
  { name: 'POLAR',        nameCn: '极地俯视',  distance: 128, elevation: 89, azimuth: 0 },
  { name: 'INNER SYSTEM', nameCn: '内太阳系',  distance: 52,  elevation: 26, azimuth: 160 },
  { name: '◌ MILKY WAY',   nameCn: '◌ 银河视图', distance: 0, elevation: 0, azimuth: 0, galaxy: true },
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

// ------------------------------------------------------------ the Moon
// Lunar constants — real sidereal period & inclination; phases anchor to the
// new moon of 2026-07-14 17:44 UTC.
export const MOON_SPEC: PlanetSpec = {
  id: 'moon', name: 'MOON', cn: '月球',
  radius: 0.27, distance: 2.1, inclination: 5.14, tiltDeg: 6.68, spin: 0,
  tex: 'mercury', color: '#a8b2c0',
  fact: 'TIDALLY LOCKED · ORBITS EARTH EVERY 27.3 DAYS',
  factCn: '潮汐锁定 · 每 27.3 天绕地球一圈',
};
// ------------------------------------------------------------ belt asteroids
// Ceres & Vesta — real JPL-approximate elements live in ephem.ts (ELEMENTS);
// distances here are the compressed display radii (auToSceneRadius of 2.77/2.36 AU).
export const ASTEROID_SPECS: PlanetSpec[] = [
  {
    id: 'ceres', name: 'CERES', cn: '谷神星',
    radius: 0.14, distance: 35.7, inclination: 0, tiltDeg: 4, spin: 1.6,
    tex: 'ceres', color: '#b9b2a6',
    fact: 'DWARF PLANET · 2.77 AU · LARGEST BODY IN THE BELT',
    factCn: '矮行星 · 2.77 AU · 小行星带中最大的天体',
  },
  {
    id: 'vesta', name: 'VESTA', cn: '灶神星',
    radius: 0.11, distance: 34.1, inclination: 0, tiltDeg: 27, spin: 2.2,
    tex: 'vesta', color: '#c8b9a0',
    fact: '2.36 AU · BRIGHTEST ASTEROID · VISIBLE TO NAKED EYE',
    factCn: '2.36 AU · 最亮的小行星 · 肉眼可见',
  },
  {
    // Real JPL #218 elements in ephem.ts — with ephemeris on, Apophis meets
    // Earth right on 2029-04-13. Display radius is the compressed 0.922 AU ring.
    id: 'apophis', name: 'APOPHIS', cn: '阿波菲斯',
    radius: 0.05, distance: 23, inclination: 0, tiltDeg: 0, spin: 3.0,
    tex: 'apophis', color: '#a89684',
    fact: '370 M · ATEN ASTEROID · SKIMS EARTH 2029-04-13 — CLOSER THAN GEO SATELLITES',
    factCn: '370 米 · 阿登型小行星 · 2029-04-13 飞掠地球——比同步卫星还近',
  },
];

// ------------------------------------------------------------ outer dwarfs
// Eris / Haumea / Makemake — scene radii extend Pluto's compressed scale;
// inclinations are REAL (44°/28°/29°) which is what makes them look alien.
export const DWARF_SPECS: PlanetSpec[] = [
  {
    id: 'eris', name: 'ERIS', cn: '阋神星',
    radius: 0.16, distance: 100, inclination: 44.04, tiltDeg: 78, spin: 1.2,
    tex: 'eris', color: '#dfe6ee',
    fact: '67.7 AU · 559 YR · THE DWARF THAT DEMOTED PLUTO',
    factCn: '67.7 AU · 559 年 · 让冥王星"降级"的矮行星',
  },
  {
    id: 'haumea', name: 'HAUMEA', cn: '妊神星',
    radius: 0.13, distance: 92, inclination: 28.21, tiltDeg: 115, spin: 4.0,
    tex: 'haumea', color: '#e8ded6',
    fact: '43.0 AU · 284 YR · 3.9-HOUR SPIN · HAS RINGS',
    factCn: '43.0 AU · 284 年 · 3.9 小时自转 · 拥有星环',
  },
  {
    id: 'makemake', name: 'MAKEMAKE', cn: '鸟神星',
    radius: 0.14, distance: 96, inclination: 29.0, tiltDeg: 0, spin: 1.6,
    tex: 'makemake', color: '#d8a37e',
    fact: '45.6 AU · 306 YR · METHANE-ICE RED',
    factCn: '45.6 AU · 306 年 · 甲烷冰的红色世界',
  },
];

// ------------------------------------------------------------ ISS (showcase)
// Real-time display orbit — NOT synced to the simulation clock (92.9 min at
// 1× would be a blur). Radius adapts to the visual Earth size at runtime.
export const ISS_SPEC: PlanetSpec = {
  id: 'iss', name: 'ISS', cn: '国际空间站',
  radius: 0.07, distance: 1.7, inclination: 51.6, tiltDeg: 0, spin: 0,
  tex: 'mercury', color: '#c0d8e8',
  fact: '420 KM ALT · 51.6° INCLINATION · 92.9 MIN PER ORBIT',
  factCn: '420 千米高度 · 倾角 51.6° · 每圈 92.9 分钟',
};
export const ISS_SCENE_R = 1.7;

// ------------------------------------------------------------- landmarks
// Surface-fixed markers for globe view. Lon/lat in the texture's equirectangular
// frame (lon: -180..180 east-positive); positions are approximate.
export interface Landmark {
  name: string; nameCn: string;
  lat: number; lon: number;
  desc: string; descCn: string;
}
export const LANDMARKS: Record<string, Landmark[]> = {
  mercury: [
    { name: 'CALORIS BASIN', nameCn: '卡路里盆地', lat: 30.5, lon: -170,
      desc: 'One of the largest impact basins in the solar system — about 1,550 km across.',
      descCn: '太阳系最大的撞击盆地之一，直径约 1,550 千米。' },
  ],
  venus: [
    { name: 'MAXWELL MONTES', nameCn: '麦克斯韦山脉', lat: 65.2, lon: 3.3,
      desc: 'The highest peak on Venus — about 11 km above the mean radius.',
      descCn: '金星最高峰，高出平均半径约 11 千米。' },
  ],
  earth: [
    { name: 'HIMALAYAS', nameCn: '喜马拉雅山脉', lat: 28.0, lon: 84.0,
      desc: 'The highest mountain range on Earth — Everest rises 8.85 km above sea level.',
      descCn: '地球最高山脉——珠穆朗玛峰海拔 8.85 千米。' },
    { name: 'MARIANA TRENCH', nameCn: '马里亚纳海沟', lat: 11.3, lon: 142.2,
      desc: 'The deepest point in the oceans — Challenger Deep lies ~10.9 km down.',
      descCn: '海洋最深处——挑战者深渊深约 10.9 千米。' },
  ],
  moon: [
    { name: 'TRANQUILITY BASE', nameCn: '静海基地', lat: 8.5, lon: 31.4,
      desc: 'Apollo 11 landing site — humans first set foot here in July 1969.',
      descCn: '阿波罗 11 号登月点——1969 年 7 月人类首次踏上月球之处。' },
    { name: 'TYCHO', nameCn: '第谷环形山', lat: -43.3, lon: -11.4,
      desc: 'A young crater (~108 Myr) whose bright rays span thousands of km.',
      descCn: '年轻的撞击坑（约 1.08 亿年），明亮辐射纹绵延数千千米。' },
  ],
  mars: [
    { name: 'OLYMPUS MONS', nameCn: '奥林匹斯山', lat: 18.65, lon: -133.8,
      desc: 'The tallest volcano in the solar system — about 22 km high.',
      descCn: '太阳系最高的火山，高约 22 千米。' },
    { name: 'VALLES MARINERIS', nameCn: '水手谷', lat: -14.0, lon: -59.0,
      desc: 'The grand canyon of Mars — over 4,000 km long and up to 7 km deep.',
      descCn: '火星大峡谷——长逾 4,000 千米，最深约 7 千米。' },
  ],
  jupiter: [
    { name: 'GREAT RED SPOT', nameCn: '大红斑', lat: -20.0, lon: 15.0,
      desc: 'An anticyclonic storm larger than Earth, raging for centuries. (It drifts in longitude.)',
      descCn: '比地球还大的反气旋风暴，已持续数百年。（经度会漂移，位置为近似值）' },
  ],
};

// ------------------------------------------------------------- galaxy view
// Milky Way mode constants. Scene scale: 1 unit = 1,000 light-years
// (galaxy radius 50 units ≈ 50,000 ly; Sun at 26 units ≈ 26,000 ly).
export interface GalaxyPoi {
  id: string; name: string; nameCn: string;
  pos: [number, number, number];
  desc: string; descCn: string;
  color: string;
  focusDist?: number; // if set, clicking the label flies the camera in (orbit-the-cloud focus mode)
  focusAt?: [number, number, number]; // the actual cloud center (label anchor floats above/below it)
}
export const GALAXY_SUN_POS: [number, number, number] = [-20.8, 0.5, 15.6];
export const GALAXY_SUN_LABEL = { name: 'SUN — YOU ARE HERE', nameCn: '太阳 · 你在这里' };
export const GALAXY_POIS: GalaxyPoi[] = [
  { id: 'sgra', name: 'SAGITTARIUS A*', nameCn: '银心 · 人马座 A*', pos: [0, 0, 0],
    desc: 'The supermassive black hole at the galaxy\'s heart — about 4.3 million solar masses.',
    descCn: '银河系中心的超大质量黑洞——约 430 万倍太阳质量。', color: 'rgba(255,232,176,1)' },
  { id: 'm13', name: 'M13 · HERCULES CLUSTER', nameCn: 'M13 武仙座球状星团', pos: [12, 16, -10],
    desc: 'A globular cluster of ~300,000 stars, 22,000 light-years away in the galactic halo.',
    descCn: '约 30 万颗恒星组成的球状星团，位于银晕中，距离约 2.2 万光年。', color: 'rgba(207,224,255,1)' },
  { id: 'm1', name: 'M1 · CRAB NEBULA', nameCn: 'M1 蟹状星云', pos: [-26, 0.6, 19.5],
    desc: 'Remnant of a supernova recorded in 1054 AD — a pulsar beats at its core.',
    descCn: '公元 1054 年超新星爆发的遗迹——核心是一颗脉冲星。', color: 'rgba(159,212,228,1)' },
];
export const GALAXY_ARMS = [
  { name: 'SAGITTARIUS ARM', nameCn: '人马臂' },
  { name: 'PERSEUS ARM', nameCn: '英仙臂' },
  { name: 'NORMA ARM', nameCn: '矩尺臂' },
  { name: 'ORION ARM', nameCn: '猎户臂' },
];

export const ORBITER_SPEC: PlanetSpec = {
  id: 'orbiter', name: 'LUNAR ORBITER', cn: '月球轨道器',
  radius: 0.05, distance: 0.35, inclination: 90, tiltDeg: 0, spin: 0,
  tex: 'mercury', color: '#d8c9a0',
  fact: 'POLAR MAPPING ORBIT · REAL-TIME SHOWCASE · LRO-CLASS',
  factCn: '极地测绘轨道 · 真实时间展示 · LRO 级',
};

export const MOON_PERIOD_DAYS = 27.3217;
export const MOON_SCENE_R = 2.1;
export const NEW_MOON_JD = 2440587.5 + Date.UTC(2026, 6, 14, 17, 44) / 86400000;

// ------------------------------------------------------------ moon systems
// First-class mini-worlds: Jupiter's four Galilean moons + Saturn's Titan and
// Enceladus. All dossier numbers are real (JPL); scene sizes keep true relative
// proportions (x2 readability boost, floor 0.07) while orbit radii are
// sqrt-compressed around the host (real ratio in host radii kept in comments).
// Positions run on a real-time showcase clock (same precedent as the ISS),
// proportional to the true period ratios — so sim time-warp never blurs them.
export type MoonHost = 'jupiter' | 'saturn' | 'mars' | 'uranus' | 'neptune' | 'pluto';
export interface MoonSysSpec extends PlanetSpec {
  host: MoonHost;
  showSecs: number;   // seconds per revolution on the showcase clock (negative = retrograde)
  phase: number;      // initial orbital phase (radians)
}

export const MOON_SYS: Record<MoonHost, MoonSysSpec[]> = {
  jupiter: [
    {
      id: 'io', name: 'IO', cn: '木卫一', host: 'jupiter',
      radius: 0.15, distance: 5.1 /* 6.0 Rj */, inclination: 0.2, tiltDeg: 0, spin: 0,
      tex: 'io', color: '#d9c25a', showSecs: 10, phase: 0.4,
      fact: 'MOST VOLCANIC WORLD · 400+ ACTIVE VOLCANOES',
      factCn: '火山活动最剧烈的天体 · 400+ 活火山',
    },
    {
      id: 'europa', name: 'EUROPA', cn: '木卫二', host: 'jupiter',
      radius: 0.13, distance: 6.5 /* 9.6 Rj */, inclination: 1.9, tiltDeg: 0, spin: 0,
      tex: 'europa', color: '#cfd8dc', showSecs: 20, phase: 1.9,
      fact: 'CRACKED ICE SHELL · OCEAN BENEATH',
      factCn: '冰壳裂纹纵横 · 冰下藏有海洋',
    },
    {
      id: 'ganymede', name: 'GANYMEDE', cn: '木卫三', host: 'jupiter',
      radius: 0.22, distance: 8.2 /* 15.3 Rj */, inclination: 0.8, tiltDeg: 0, spin: 0,
      tex: 'ganymede', color: '#9a8f7d', showSecs: 40, phase: 3.5,
      fact: 'LARGEST MOON IN THE SOLAR SYSTEM · OWN MAGNETIC FIELD',
      factCn: '太阳系最大的卫星 · 拥有自己的磁场',
    },
    {
      id: 'callisto', name: 'CALLISTO', cn: '木卫四', host: 'jupiter',
      radius: 0.2, distance: 10.8 /* 26.9 Rj */, inclination: 2.0, tiltDeg: 0, spin: 0,
      tex: 'callisto', color: '#6f6a60', showSecs: 94, phase: 5.2,
      fact: 'MOST CRATERED SURFACE · 4 BILLION YEARS OLD',
      factCn: '陨击最密集的表面 · 40 亿年的古老世界',
    },
  ],
  saturn: [
    {
      id: 'titan', name: 'TITAN', cn: '土卫六', host: 'saturn',
      radius: 0.22, distance: 14.0 /* 21.0 Rs */, inclination: 1.4, tiltDeg: 0, spin: 0,
      tex: 'titan', color: '#d89a4a', showSecs: 90, phase: 0.9,
      fact: 'THICK NITROGEN AIR · LAKES OF LIQUID METHANE',
      factCn: '浓厚的氮大气 · 液态甲烷湖泊',
    },
    {
      id: 'enceladus', name: 'ENCELADUS', cn: '土卫二', host: 'saturn',
      radius: 0.07, distance: 6.2 /* 4.1 Rs */, inclination: 0.1, tiltDeg: 0, spin: 0,
      tex: 'enceladus', color: '#cfe8ff', showSecs: 7.7, phase: 4.1,
      fact: 'ICE GEYSERS · TIGER STRIPES · FEEDS THE E RING',
      factCn: '冰羽喷泉 · 南极虎纹 · 哺育 E 环',
    },
  ],
  // Same compression convention: display distance = sqrt(real host-radii ratio) × k
  // (mars k≈2.2, uranus/neptune/pluto k≈2.6); showSecs = real period days × 5.65,
  // negative = retrograde; radii are true size ratios ×2 gain, floor ~0.07 —
  // except Charon, shown at its honest 0.51× Pluto ratio (the binary-world point).
  mars: [
    {
      id: 'phobos', name: 'PHOBOS', cn: '火卫一', host: 'mars',
      radius: 0.055, distance: 3.65 /* 2.76 Rm */, inclination: 1.1, tiltDeg: 0, spin: 0,
      tex: 'phobos', color: '#8a7a6a', showSecs: 1.8, phase: 0.7,
      fact: 'OUTRACES MARS’S SPIN · RISES IN THE WEST · DOOMED TO BECOME A RING',
      factCn: '比火星自转还快 · 西升东落 · 终将碎成火星环',
    },
    {
      id: 'deimos', name: 'DEIMOS', cn: '火卫二', host: 'mars',
      radius: 0.05, distance: 5.8 /* 6.9 Rm */, inclination: 1.8, tiltDeg: 0, spin: 0,
      tex: 'deimos', color: '#9a8d7c', showSecs: 7.1, phase: 2.9,
      fact: 'TINY & DUSTY · 30-HOUR LAP · LOOKS LIKE A STAR FROM MARS',
      factCn: '微小而多尘 · 30 小时一圈 · 从火星表面看像一颗亮星',
    },
  ],
  uranus: [
    {
      id: 'ariel', name: 'ARIEL', cn: '天卫一', host: 'uranus',
      radius: 0.10, distance: 7.1 /* 7.5 Ru */, inclination: 0.3, tiltDeg: 0, spin: 0,
      tex: 'ariel', color: '#bcc8cf', showSecs: 14, phase: 1.2,
      fact: 'BRIGHTEST URANIAN MOON · CANYON-CROSSED ICE PLAINS',
      factCn: '天王星最亮的卫星 · 峡谷纵横的冰原',
    },
    {
      id: 'titania', name: 'TITANIA', cn: '天卫三', host: 'uranus',
      radius: 0.13, distance: 10.8 /* 17.1 Ru */, inclination: 0.2, tiltDeg: 0, spin: 0,
      tex: 'titania', color: '#b8b2a8', showSecs: 49, phase: 3.8,
      fact: 'LARGEST URANIAN MOON · THE WHOLE SYSTEM RIDES SIDEWAYS (98° TILT)',
      factCn: '天王星最大的卫星 · 整个系统随天王星 98° 倾角侧躺公转',
    },
    {
      id: 'oberon', name: 'OBERON', cn: '天卫四', host: 'uranus',
      radius: 0.13, distance: 12.5 /* 22.9 Ru */, inclination: 0.2, tiltDeg: 0, spin: 0,
      tex: 'oberon', color: '#a89a8e', showSecs: 76, phase: 5.5,
      fact: 'OUTERMOST BIG MOON · ANCIENT RED-DUSTED CRATER FIELD',
      factCn: '最外侧的大卫星 · 古老的红化陨击荒原',
    },
  ],
  neptune: [
    {
      id: 'triton', name: 'TRITON', cn: '海卫一', host: 'neptune',
      radius: 0.20, distance: 9.9 /* 14.4 Rn */, inclination: 23, tiltDeg: 0, spin: 0,
      tex: 'triton', color: '#e8c9c4', showSecs: -33 /* RETROGRADE −5.877 d */, phase: 2.2,
      fact: 'ORBITS BACKWARD — A CAPTURED KUIPER-BELT WORLD · NITROGEN GEYSERS',
      factCn: '逆行公转——被俘获的柯伊伯带天体 · 表面有氮喷泉',
    },
  ],
  pluto: [
    {
      id: 'charon', name: 'CHARON', cn: '冥卫一', host: 'pluto',
      radius: 0.19 /* honest 0.51× Pluto — no gain */, distance: 10.6 /* 16.5 Rp */,
      inclination: 0.4, tiltDeg: 0, spin: 0,
      tex: 'charon', color: '#9a938c', showSecs: 36, phase: 4.4,
      fact: 'HALF OF PLUTO’S SIZE · THE BARYCENTER FLOATS IN EMPTY SPACE — A BINARY WORLD',
      factCn: '有冥王星一半大 · 质心悬在两星之间的虚空里——一对双行星',
    },
  ],
};

export const MOON_HOST: Record<string, MoonHost> = {
  io: 'jupiter', europa: 'jupiter', ganymede: 'jupiter', callisto: 'jupiter',
  titan: 'saturn', enceladus: 'saturn',
  phobos: 'mars', deimos: 'mars',
  ariel: 'uranus', titania: 'uranus', oberon: 'uranus',
  triton: 'neptune', charon: 'pluto',
};

// heliocentric distances (AU) for the true-scale HUD readout
export const DIST_AU: Record<string, number> = {
  mercury: 0.387, venus: 0.723, earth: 1.0, mars: 1.524,
  jupiter: 5.203, saturn: 9.583, uranus: 19.19, neptune: 30.07,
  pluto: 39.48, moon: 1.0, halley: 17.8, ceres: 2.767, vesta: 2.362,
  io: 5.203, europa: 5.203, ganymede: 5.203, callisto: 5.203,
  titan: 9.583, enceladus: 9.583,
  phobos: 1.524, deimos: 1.524, ariel: 19.19, titania: 19.19, oberon: 19.19,
  triton: 30.07, charon: 39.48,
  eris: 67.7, haumea: 43.0, makemake: 45.6,
  apophis: 0.922,
};

// ------------------------------------------------------------ mission replay
// Voyager grand-tour keyframes. yr = decimal year; target = scene body id or
// 'out' (interstellar direction); distAU = real range from Earth at the event.
export interface MissionKey {
  yr: number;
  target: string;      // planet id | 'out' | 'today'
  label: string; labelCn: string;
  distAU: number;
}
export interface MissionSpec { craft: string; name: string; nameCn: string; launchYr: number; keys: MissionKey[] }

export const MISSIONS: Record<string, MissionSpec> = {
  voyager1: {
    craft: 'voyager1', name: 'VOYAGER 1', nameCn: '旅行者 1 号', launchYr: 1977.68,
    keys: [
      { yr: 1977.68, target: 'earth', label: 'LAUNCH — CAPE CANAVERAL, TITAN IIIE', labelCn: '发射 — 卡纳维拉尔角，泰坦 IIIE 火箭', distAU: 0.0 },
      { yr: 1979.16, target: 'jupiter', label: 'JUPITER FLYBY — 349,000 KM · GREAT RED SPOT UP CLOSE', labelCn: '木星飞掠 — 最近 34.9 万千米 · 大红斑特写', distAU: 4.7 },
      { yr: 1980.87, target: 'saturn', label: 'SATURN FLYBY — 124,000 KM · TITAN DETOUR', labelCn: '土星飞掠 — 最近 12.4 万千米 · 转向土卫六', distAU: 9.5 },
      { yr: 2012.65, target: 'out', label: 'HELIOPAUSE CROSSED — 121.6 AU · INTERSTELLAR SPACE', labelCn: '越过日球层顶 — 121.6 AU · 进入星际空间', distAU: 121.6 },
      { yr: 0, target: 'today', label: 'TODAY — STILL WHISPERING HOME AT 17 KM/S', labelCn: '今天 — 仍以 17 千米/秒向地球传回信号', distAU: 0 },
    ],
  },
  voyager2: {
    craft: 'voyager2', name: 'VOYAGER 2', nameCn: '旅行者 2 号', launchYr: 1977.63,
    keys: [
      { yr: 1977.63, target: 'earth', label: 'LAUNCH — 16 DAYS BEFORE VOYAGER 1', labelCn: '发射 — 比旅行者 1 号早 16 天', distAU: 0.0 },
      { yr: 1979.50, target: 'jupiter', label: 'JUPITER FLYBY — 570,000 KM', labelCn: '木星飞掠 — 最近 57 万千米', distAU: 4.9 },
      { yr: 1981.64, target: 'saturn', label: 'SATURN FLYBY — 101,000 KM', labelCn: '土星飞掠 — 最近 10.1 万千米', distAU: 9.7 },
      { yr: 1986.06, target: 'uranus', label: 'URANUS FLYBY — 81,500 KM · FIRST & ONLY VISIT', labelCn: '天王星飞掠 — 最近 8.15 万千米 · 史上唯一造访', distAU: 19.3 },
      { yr: 1989.65, target: 'neptune', label: 'NEPTUNE FLYBY — 4,950 KM · CLOSEST OF THE TOUR', labelCn: '海王星飞掠 — 最近仅 4,950 千米 · 全程最近', distAU: 30.1 },
      { yr: 2018.85, target: 'out', label: 'HELIOPAUSE CROSSED — 119 AU', labelCn: '越过日球层顶 — 119 AU', distAU: 119.0 },
      { yr: 0, target: 'today', label: 'TODAY — THE LONGEST MISSION EVER FLOWN', labelCn: '今天 — 人类飞行最久的任务', distAU: 0 },
    ],
  },
};

// ------------------------------------------------------------ mini-worlds browser
export interface MiniGroup { cat: string; catCn: string; items: Array<{ id: string; name: string; cn: string }> }
export const MINI_GROUPS: MiniGroup[] = [
  { cat: 'DWARF PLANETS', catCn: '矮行星', items: [
    { id: 'pluto', name: 'PLUTO', cn: '冥王星' },
    { id: 'ceres', name: 'CERES', cn: '谷神星' },
    { id: 'eris', name: 'ERIS', cn: '阋神星' },
    { id: 'haumea', name: 'HAUMEA', cn: '妊神星' },
    { id: 'makemake', name: 'MAKEMAKE', cn: '鸟神星' },
  ] },
  { cat: 'ASTEROIDS', catCn: '小行星', items: [
    { id: 'vesta', name: 'VESTA', cn: '灶神星' },
    { id: 'apophis', name: 'APOPHIS', cn: '阿波菲斯' },
  ] },
  { cat: 'COMETS', catCn: '彗星', items: [
    { id: 'halley', name: 'HALLEY', cn: '哈雷彗星' },
  ] },
  { cat: 'PROBES', catCn: '探测器', items: [
    { id: 'voyager1', name: 'VOYAGER 1', cn: '旅行者 1 号' },
    { id: 'voyager2', name: 'VOYAGER 2', cn: '旅行者 2 号' },
    { id: 'iss', name: 'ISS', cn: '国际空间站' },
    { id: 'orbiter', name: 'ORBITER', cn: '轨道器' },
  ] },
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
  ceres: {
    type: 'DWARF PLANET', typeCn: '矮行星', diameterKm: 940,
    blurb: 'The largest body in the asteroid belt — a briny world with bright salt deposits in Occator crater.',
    blurbCn: '小行星带中最大的天体——欧卡托陨石坑里的亮斑是盐类沉积。',
    rows: [
      { k: 'CLASS', kCn: '分类', v: 'DWARF PLANET', vCn: '矮行星' },
      { k: 'SEMI-MAJOR AXIS', kCn: '半长轴', v: '2.77 AU', vCn: '2.77 AU' },
      { k: 'YEAR', kCn: '公转周期', v: '4.60 YEARS', vCn: '4.60 年' },
      { k: 'INCLINATION', kCn: '轨道倾角', v: '10.6°', vCn: '10.6°' },
      { k: 'VISITOR', kCn: '探测器', v: 'DAWN (2015–2018)', vCn: '黎明号（2015–2018）' },
    ],
  },
  vesta: {
    type: 'ASTEROID', typeCn: '小行星', diameterKm: 525,
    blurb: 'The brightest asteroid — a differentiated protoplanet with basaltic lava plains and a giant south-polar basin.',
    blurbCn: '最亮的小行星——已分化的原行星，拥有玄武岩熔岩平原和巨大的南极盆地。',
    rows: [
      { k: 'CLASS', kCn: '分类', v: 'V-TYPE ASTEROID', vCn: 'V 型小行星' },
      { k: 'SEMI-MAJOR AXIS', kCn: '半长轴', v: '2.36 AU', vCn: '2.36 AU' },
      { k: 'YEAR', kCn: '公转周期', v: '3.63 YEARS', vCn: '3.63 年' },
      { k: 'INCLINATION', kCn: '轨道倾角', v: '7.1°', vCn: '7.1°' },
      { k: 'VISITOR', kCn: '探测器', v: 'DAWN (2011–2012)', vCn: '黎明号（2011–2012）' },
    ],
  },
  iss: {
    type: 'SPACE STATION', typeCn: '空间站', diameterKm: 0.109,
    blurb: 'The largest human-made object in orbit — circling Earth every 92.9 minutes at 7.66 km/s. Display orbit runs in real time, not sim time.',
    blurbCn: '人类在轨建造的最大物体——以 7.66 千米/秒每 92.9 分钟绕地球一圈。展示轨道按真实时间运行，与模拟时钟无关。',
    rows: [
      { k: 'ALTITUDE', kCn: '轨道高度', v: '~420 KM', vCn: '约 420 千米' },
      { k: 'PERIOD', kCn: '绕地周期', v: '92.9 MIN', vCn: '92.9 分钟' },
      { k: 'INCLINATION', kCn: '轨道倾角', v: '51.6°', vCn: '51.6°' },
      { k: 'SPAN', kCn: '翼展', v: '109 M', vCn: '109 米' },
      { k: 'CREW SINCE', kCn: '常驻始于', v: '2000-11', vCn: '2000 年 11 月' },
    ],
  },
  orbiter: {
    type: 'LUNAR ORBITER', typeCn: '月球轨道器', diameterKm: 0.008,
    blurb: 'The Moon can barely keep a satellite of its own — Earth tides and lumpy lunar gravity (mascons) destabilize most low orbits within years. Human orbiters survive only with regular station-keeping. Display orbit runs in real time.',
    blurbCn: '月球很难留住自己的卫星——地球潮汐与月球质量瘤（重力异常区）会让多数低轨在几年内失稳坠毁，人造轨道器必须靠定期轨道维持才能长期工作。展示轨道按真实时间运行，与模拟时钟无关。',
    rows: [
      { k: 'ORBIT', kCn: '轨道类型', v: 'POLAR · ~50 KM ALT', vCn: '极地轨道 · 约 50 千米高度' },
      { k: 'PERIOD', kCn: '绕月周期', v: '~113 MIN', vCn: '约 113 分钟' },
      { k: 'INCLINATION', kCn: '轨道倾角', v: '90°', vCn: '90°' },
      { k: 'STABILITY', kCn: '轨道稳定性', v: 'NEEDS STATION-KEEPING', vCn: '需定期轨道维持' },
      { k: 'PROTOTYPE', kCn: '原型', v: 'LRO · 2009', vCn: '月球勘测轨道飞行器 · 2009' },
    ],
  },
  moon: {
    type: 'NATURAL SATELLITE', typeCn: '天然卫星', diameterKm: 3475,
    blurb: 'Tidally locked to Earth — the same face always looks at us. Its phases come from sunlight geometry, not shadows of Earth.',
    blurbCn: '被地球潮汐锁定——永远以同一面朝向地球。月相来自阳光照射的几何关系，而非地球的影子。',
    rows: [
      { k: 'MASS', kCn: '质量', v: '0.0123 M⊕', vCn: '0.0123 地球质量' },
      { k: 'ORBIT', kCn: '绕地周期', v: '27.3 DAYS', vCn: '27.3 天' },
      { k: 'DISTANCE', kCn: '距地球', v: '384,400 KM', vCn: '38.4 万千米' },
      { k: 'INCLINATION', kCn: '轨道倾角', v: '5.14°', vCn: '5.14°' },
      { k: 'SURFACE TEMP', kCn: '表面温度', v: '−173 ~ 127 °C', vCn: '−173 ~ 127 °C' },
    ],
  },
  io: {
    type: 'NATURAL SATELLITE', typeCn: '天然卫星', diameterKm: 3643,
    blurb: 'Tidal squeezing from Jupiter kneads its interior — hundreds of volcanoes constantly resurface this sulfur-yellow world.',
    blurbCn: '木星的潮汐挤压不断揉捏它的内部——数百座火山持续重塑地表，把它涂成硫磺般的黄色。',
    rows: [
      { k: 'MASS', kCn: '质量', v: '0.015 M⊕', vCn: '0.015 地球质量' },
      { k: 'ORBIT', kCn: '绕木周期', v: '1.77 DAYS', vCn: '1.77 天' },
      { k: 'DISTANCE', kCn: '距木星', v: '421,700 KM', vCn: '42.2 万千米' },
      { k: 'SURFACE', kCn: '表面特征', v: 'SULFUR PLAINS · VOLCANOES', vCn: '硫磺荒原 · 活火山' },
      { k: 'VISITOR', kCn: '探测器', v: 'GALILEO (1995–2003)', vCn: '伽利略号（1995–2003）' },
    ],
  },
  europa: {
    type: 'NATURAL SATELLITE', typeCn: '天然卫星', diameterKm: 3122,
    blurb: 'A web of brown cracks marks an ice shell hiding a global salty ocean — one of the best places to look for life.',
    blurbCn: '棕色裂纹交织的冰壳之下藏着全球性的咸水海洋——太阳系中寻找地外生命最热门的目的地之一。',
    rows: [
      { k: 'MASS', kCn: '质量', v: '0.008 M⊕', vCn: '0.008 地球质量' },
      { k: 'ORBIT', kCn: '绕木周期', v: '3.55 DAYS', vCn: '3.55 天' },
      { k: 'DISTANCE', kCn: '距木星', v: '671,000 KM', vCn: '67.1 万千米' },
      { k: 'SURFACE', kCn: '表面特征', v: 'LINEAE CRACKS · ICE SHELL', vCn: '冰壳裂纹 · 条痕纵横' },
      { k: 'VISITOR', kCn: '探测器', v: 'EUROPA CLIPPER EN ROUTE', vCn: '欧罗巴快船（在途，2030 抵达）' },
    ],
  },
  ganymede: {
    type: 'NATURAL SATELLITE', typeCn: '天然卫星', diameterKm: 5268,
    blurb: 'Bigger than Mercury, with its own magnetic field — dark ancient plains beside bright grooved ridges.',
    blurbCn: '比水星还大，拥有自己的磁场——古老的暗色平原与明亮的沟槽山脊交错并存。',
    rows: [
      { k: 'MASS', kCn: '质量', v: '0.025 M⊕', vCn: '0.025 地球质量' },
      { k: 'ORBIT', kCn: '绕木周期', v: '7.15 DAYS', vCn: '7.15 天' },
      { k: 'DISTANCE', kCn: '距木星', v: '1,070,000 KM', vCn: '107 万千米' },
      { k: 'SURFACE', kCn: '表面特征', v: 'GROOVED TERRAIN · TWO-TONE', vCn: '沟槽地形 · 双色地表' },
      { k: 'VISITOR', kCn: '探测器', v: 'JUICE EN ROUTE (2031)', vCn: 'JUICE 果汁号（在途，2031 抵达）' },
    ],
  },
  callisto: {
    type: 'NATURAL SATELLITE', typeCn: '天然卫星', diameterKm: 4821,
    blurb: 'The most cratered world known — a 4-billion-year-old ice-rock archive that never had the heat to renew itself.',
    blurbCn: '已知陨击最密集的天体——40 亿年来从未有过足够的热量更新自己，是一部完整的撞击编年史。',
    rows: [
      { k: 'MASS', kCn: '质量', v: '0.018 M⊕', vCn: '0.018 地球质量' },
      { k: 'ORBIT', kCn: '绕木周期', v: '16.7 DAYS', vCn: '16.7 天' },
      { k: 'DISTANCE', kCn: '距木星', v: '1,883,000 KM', vCn: '188 万千米' },
      { k: 'SURFACE', kCn: '表面特征', v: 'VALHALLA BASIN · DENSE CRATERS', vCn: '瓦尔哈拉撞击盆 · 密集陨坑' },
      { k: 'VISITOR', kCn: '探测器', v: 'GALILEO (1995–2003)', vCn: '伽利略号（1995–2003）' },
    ],
  },
  titan: {
    type: 'NATURAL SATELLITE', typeCn: '天然卫星', diameterKm: 5150,
    blurb: 'The only moon with a thick atmosphere — orange nitrogen haze hides rivers, rain and lakes of liquid methane.',
    blurbCn: '唯一拥有浓厚大气的卫星——橙色氮霾之下，藏着液态甲烷的河流、降雨与湖泊。',
    rows: [
      { k: 'MASS', kCn: '质量', v: '0.023 M⊕', vCn: '0.023 地球质量' },
      { k: 'ORBIT', kCn: '绕土周期', v: '15.9 DAYS', vCn: '15.9 天' },
      { k: 'DISTANCE', kCn: '距土星', v: '1,221,900 KM', vCn: '122 万千米' },
      { k: 'SURFACE', kCn: '表面特征', v: 'METHANE LAKES · ORANGE HAZE', vCn: '甲烷湖泊 · 橙色霾层' },
      { k: 'VISITOR', kCn: '探测器', v: 'CASSINI–HUYGENS (2004–2017)', vCn: '卡西尼–惠更斯号（2004–2017）' },
    ],
  },
  enceladus: {
    type: 'NATURAL SATELLITE', typeCn: '天然卫星', diameterKm: 504,
    blurb: "A tiny bright snowball spraying salty ice plumes from a south-polar ocean — Saturn's E ring is built from its spray.",
    blurbCn: '一颗明亮的冰雪小球，从南极冰下海洋向太空喷出含盐冰羽——土星的 E 环正是由它造就。',
    rows: [
      { k: 'MASS', kCn: '质量', v: '0.00002 M⊕', vCn: '0.00002 地球质量' },
      { k: 'ORBIT', kCn: '绕土周期', v: '1.37 DAYS', vCn: '1.37 天' },
      { k: 'DISTANCE', kCn: '距土星', v: '238,000 KM', vCn: '23.8 万千米' },
      { k: 'SURFACE', kCn: '表面特征', v: 'TIGER STRIPES · ICE PLUMES', vCn: '南极虎纹 · 冰羽喷泉' },
      { k: 'VISITOR', kCn: '探测器', v: 'CASSINI FLYBYS (2005–2015)', vCn: '卡西尼号飞掠（2005–2015）' },
    ],
  },
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
  eris: {
    type: 'DWARF PLANET', typeCn: '矮行星', diameterKm: 2326,
    blurb: 'The scattered-disc world whose 2005 discovery forced astronomers to demote Pluto. A moon, Dysnomia, orbits it.',
    blurbCn: '这颗离散盘天体 2005 年的发现直接促使冥王星降级。拥有一颗卫星"迪丝诺美亚"。',
    rows: [
      { k: 'ORBIT', kCn: '公转周期', v: '559 YR', vCn: '559 年' },
      { k: 'DISTANCE', kCn: '轨道半径', v: '67.7 AU', vCn: '67.7 AU' },
      { k: 'DISCOVERED', kCn: '发现年份', v: '2005', vCn: '2005 年' },
      { k: 'MOON', kCn: '卫星', v: 'DYSNOMIA', vCn: '迪丝诺美亚' },
      { k: 'LEGACY', kCn: '历史影响', v: 'PLUTO DEMOTED', vCn: '促成冥王星降级' },
    ],
  },
  haumea: {
    type: 'DWARF PLANET', typeCn: '矮行星', diameterKm: 1632,
    blurb: 'Spun into an egg by a 3.9-hour day — the fastest large body known — and wearing a ring discovered in 2017.',
    blurbCn: '3.9 小时的自转把它甩成了蛋形——已知自转最快的大天体——2017 年还发现它带着一圈星环。',
    rows: [
      { k: 'ORBIT', kCn: '公转周期', v: '284 YR', vCn: '284 年' },
      { k: 'DISTANCE', kCn: '轨道半径', v: '43.0 AU', vCn: '43.0 AU' },
      { k: 'SPIN', kCn: '自转周期', v: '3.9 H', vCn: '3.9 小时' },
      { k: 'SHAPE', kCn: '形状', v: 'ELLIPSOID 2100×1074 KM', vCn: '椭球 2100×1074 千米' },
      { k: 'RINGS + MOONS', kCn: '星环与卫星', v: '1 RING · 2 MOONS', vCn: '1 环 · 2 卫星' },
    ],
  },
  makemake: {
    type: 'DWARF PLANET', typeCn: '矮行星', diameterKm: 1430,
    blurb: 'A reddish methane-ice world named after the Rapa Nui creator god — the second-brightest Kuiper belt object after Pluto.',
    blurbCn: '以复活节岛创世神命名的红色甲烷冰世界——亮度仅次于冥王星的柯伊伯带天体。',
    rows: [
      { k: 'ORBIT', kCn: '公转周期', v: '306 YR', vCn: '306 年' },
      { k: 'DISTANCE', kCn: '轨道半径', v: '45.6 AU', vCn: '45.6 AU' },
      { k: 'DISCOVERED', kCn: '发现年份', v: '2005', vCn: '2005 年' },
      { k: 'SURFACE', kCn: '表面', v: 'METHANE ICE · −239°C', vCn: '甲烷冰 · −239°C' },
      { k: 'MOON', kCn: '卫星', v: 'MK 2', vCn: 'MK 2' },
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
  phobos: {
    type: 'MARTIAN MOON', typeCn: '火星卫星', diameterKm: 22.5,
    blurb: 'A rubble-pile potato orbiting faster than Mars spins — from the surface it rises in the WEST. Tides are pulling it down: within ~50 million years it will shred into a ring. Stickney crater nearly shattered it.',
    blurbCn: '一颗碎石堆“土豆”，公转比火星自转还快——在火星表面看它从西边升起。潮汐正把它往下拽：约 5000 万年内会碎成一圈火星环。斯蒂克尼陨石坑几乎把它撞碎。',
    rows: [
      { k: 'ORBIT', kCn: '轨道半径', v: '9,376 KM', vCn: '9,376 千米' },
      { k: 'PERIOD', kCn: '公转周期', v: '7H 39M', vCn: '7 小时 39 分' },
      { k: 'RISES', kCn: '升起方向', v: 'WEST (FAST ORBIT)', vCn: '西边（轨道快过自转）' },
      { k: 'FATE', kCn: '归宿', v: 'RING IN ~50 MYR', vCn: '约 5000 万年后成环' },
    ],
  },
  deimos: {
    type: 'MARTIAN MOON', typeCn: '火星卫星', diameterKm: 12.4,
    blurb: 'The outer and smaller Martian moon — a dusty, smoothed-over rock taking 30 hours per lap. From Mars it looks like a bright slow-moving star.',
    blurbCn: '火星外侧较小的卫星——一颗被尘土抹平的小岩块，30 小时绕一圈。从火星上看，它像一颗缓慢移动的亮星。',
    rows: [
      { k: 'ORBIT', kCn: '轨道半径', v: '23,460 KM', vCn: '23,460 千米' },
      { k: 'PERIOD', kCn: '公转周期', v: '30.3 H', vCn: '30.3 小时' },
      { k: 'SURFACE', kCn: '表面', v: 'DUST-BLANKETED', vCn: '厚尘覆盖' },
    ],
  },
  ariel: {
    type: 'URANIAN MOON', typeCn: '天王星卫星', diameterKm: 1158,
    blurb: 'The brightest Uranian moon — young icy plains cut by canyon grabens, signs the interior once flexed and thawed.',
    blurbCn: '天王星最亮的卫星——年轻的冰原上切出一道道地堑峡谷，说明它的内部曾经受热变形。',
    rows: [
      { k: 'ORBIT', kCn: '轨道半径', v: '190,900 KM', vCn: '190,900 千米' },
      { k: 'PERIOD', kCn: '公转周期', v: '2.52 DAYS', vCn: '2.52 天' },
      { k: 'SURFACE', kCn: '表面', v: 'YOUNGEST OF URANIAN MOONS', vCn: '天王星卫星中最年轻' },
    ],
  },
  titania: {
    type: 'URANIAN MOON', typeCn: '天王星卫星', diameterKm: 1578,
    blurb: 'The largest moon of Uranus, scarred by titanic canyons. The whole system rides sideways: Uranus is tipped 98°, so the moons orbit like a vertical Ferris wheel.',
    blurbCn: '天王星最大的卫星，遍布巨大峡谷。整个系统是侧躺的：天王星倾角 98°，卫星们像竖直的摩天轮一样公转。',
    rows: [
      { k: 'ORBIT', kCn: '轨道半径', v: '435,900 KM', vCn: '435,900 千米' },
      { k: 'PERIOD', kCn: '公转周期', v: '8.71 DAYS', vCn: '8.71 天' },
      { k: 'SYSTEM TILT', kCn: '系统倾角', v: '98° (SIDEWAYS)', vCn: '98°（侧躺）' },
    ],
  },
  oberon: {
    type: 'URANIAN MOON', typeCn: '天王星卫星', diameterKm: 1523,
    blurb: 'The outermost big Uranian moon — an ancient, heavily cratered ice world, reddened by billions of years of space weathering.',
    blurbCn: '最外侧的天王星大卫星——古老而陨击密集的冰世界，数十亿年的空间风化让它微微泛红。',
    rows: [
      { k: 'ORBIT', kCn: '轨道半径', v: '583,500 KM', vCn: '583,500 千米' },
      { k: 'PERIOD', kCn: '公转周期', v: '13.46 DAYS', vCn: '13.46 天' },
      { k: 'AGE', kCn: '表面年龄', v: '~4 BILLION YEARS', vCn: '约 40 亿年' },
    ],
  },
  triton: {
    type: 'NEPTUNIAN MOON', typeCn: '海王星卫星', diameterKm: 2707,
    blurb: 'A captured Kuiper-belt dwarf planet orbiting BACKWARD (retrograde) — impossible to form in place. Nitrogen geysers streak its pink cantaloupe skin, and in 3.6 billion years it will fall and become a ring. Display orbit is retrograde for real (negative showcase period).',
    blurbCn: '一颗被俘获的柯伊伯带矮行星，逆向公转——不可能原地形成。粉色哈密瓜纹表面上氮喷泉留下黑条纹，36 亿年后将坠落碎成海王星环。展示轨道按真实方向逆行（公转周期为负值）。',
    rows: [
      { k: 'ORBIT', kCn: '轨道半径', v: '354,800 KM', vCn: '354,800 千米' },
      { k: 'PERIOD', kCn: '公转周期', v: '−5.88 DAYS (RETROGRADE)', vCn: '−5.88 天（逆行）' },
      { k: 'SURFACE TEMP', kCn: '表面温度', v: '−235 °C', vCn: '−235 °C' },
      { k: 'ORIGIN', kCn: '来源', v: 'CAPTURED KUIPER-BELT WORLD', vCn: '被俘获的柯伊伯带天体' },
    ],
  },
  charon: {
    type: 'PLUTONIAN MOON', typeCn: '冥王星卫星', diameterKm: 1212,
    blurb: 'Half the size of Pluto — so massive the pair orbit a point in empty space BETWEEN them. A true binary world, locked face-to-face forever. (Shown at honest size ratio.)',
    blurbCn: '有冥王星的一半大——重到两者绕着悬空于它们之间的质心旋转。一对真正的双行星，永远面对面锁定。（按真实大小比例展示。）',
    rows: [
      { k: 'ORBIT', kCn: '轨道半径', v: '19,640 KM', vCn: '19,640 千米' },
      { k: 'PERIOD', kCn: '公转周期', v: '6.39 DAYS', vCn: '6.39 天' },
      { k: 'BARYCENTER', kCn: '质心', v: 'ABOVE PLUTO’S SURFACE', vCn: '位于冥王星表面之外' },
    ],
  },
  apophis: {
    type: 'NEAR-EARTH ASTEROID', typeCn: '近地小行星', diameterKm: 0.37,
    blurb: 'On 13 April 2029 Apophis skims just 31,600 km above Earth — closer than geostationary satellites, bright enough (+3.1 mag) for two billion people to watch it crawl across the evening sky with the naked eye. Earth’s tide will stretch it and flip it from an Aten-class to an Apollo-class orbit. Scene orbit uses JPL solution #218; two-body display only, so the 2029 encounter geometry is approximate.',
    blurbCn: '2029 年 4 月 13 日，阿波菲斯将以仅 31,600 千米的高度掠过地球——比地球同步卫星还近，最亮 +3.1 等，约二十亿人能用肉眼看着它爬过夜空。地球潮汐会拉扯它，把它从阿登型轨道甩成阿波罗型。场景轨道采用 JPL #218 根数；纯二体展示，2029 相遇几何为近似。',
    rows: [
      { k: 'CLASS', kCn: '分类', v: 'ATEN → APOLLO (2029)', vCn: '阿登型 → 阿波罗型（2029）' },
      { k: 'SEMI-MAJOR AXIS', kCn: '半长轴', v: '0.922 AU', vCn: '0.922 AU' },
      { k: 'YEAR', kCn: '公转周期', v: '323.6 DAYS', vCn: '323.6 天' },
      { k: 'CLOSEST APPROACH', kCn: '最近飞掠', v: '2029-04-13 · 31,600 KM', vCn: '2029-04-13 · 31,600 千米' },
      { k: 'IMPACT RISK', kCn: '撞击风险', v: 'RULED OUT FOR 100+ YEARS', vCn: '百年内已排除' },
    ],
  },
};
