// HELION — bilingual UI strings (EN / 中文)
export type Lang = 'en' | 'zh';

export interface Strings {
  subtitle: string;
  subtitle2: string;
  missionElapsed: string;
  simDate: string;
  observerDistance: string;
  focusTarget: string;
  orbitalFlow: string;
  timeDilation: string;
  frameRate: string;
  daysPerSec: string;
  flightDeck: string;
  cinePrefix: string;
  cinePlay: string;
  cineStop: string;
  orbit: string;
  labels: string;
  params: string;
  hud: string;
  soundOn: string;
  soundOff: string;
  deckHint: string;
  bottomHint: string;
  parameters: string;
  reset: string;
  timeFlow: string;
  orbitLines: string;
  planetScale: string;
  starfield: string;
  introTag: string;
  introQuote: string;
  langButton: string;
  sun: string;
  toast: {
    cineOn: string;
    cineOff: string;
    vectorLock: string;   // + view name
    orbitOn: string;
    orbitOff: string;
    labelsOn: string;
    labelsOff: string;
    soundOn: string;
    soundOff: string;
    acquiring: string;    // + planet name
    released: string;
    reset: string;
  };
}

export const STR: Record<Lang, Strings> = {
  en: {
    subtitle: 'SOLAR SYSTEM · 8 PLANETS · 1 STAR · 1 BELT',
    subtitle2: 'KEPLERIAN ORBITAL MECHANICS // REAL-TIME SIMULATION',
    missionElapsed: 'MISSION ELAPSED',
    simDate: 'SIM',
    observerDistance: 'OBSERVER DISTANCE',
    focusTarget: 'FOCUS TARGET',
    orbitalFlow: 'ORBITAL FLOW',
    timeDilation: 'TIME DILATION',
    frameRate: 'FRAME RATE',
    daysPerSec: 'DAYS/S',
    flightDeck: 'FLIGHT DECK',
    cinePrefix: 'CINE',
    cinePlay: '▶ CINEMATIC SEQUENCE',
    cineStop: '■ CINEMATIC SEQUENCE',
    orbit: 'ORBIT',
    labels: 'LABELS',
    params: 'PARAMS',
    hud: 'HUD',
    soundOn: '🔊 SOUND: ON',
    soundOff: '🔇 SOUND: OFF',
    deckHint: '1-4 VIEWS · C CINE · R ORBIT · L LABELS · P PARAMS · M SOUND · H HUD · ESC RELEASE',
    bottomHint: 'DRAG ORBIT · SCROLL ZOOM · CLICK PLANET TO FOCUS · C CINEMATIC · M SOUND · H HUD',
    parameters: 'PARAMETERS',
    reset: 'RESET',
    timeFlow: 'TIME FLOW',
    orbitLines: 'ORBIT LINES',
    planetScale: 'PLANET SCALE',
    starfield: 'STARFIELD',
    introTag: 'REAL-TIME ORBITAL SIMULATION',
    introQuote: '“The cosmos is within us. We are made of star-stuff.” — Carl Sagan',
    langButton: '🌐 界面语言: EN',
    sun: 'SUN',
    toast: {
      cineOn: 'CINEMATIC SEQUENCE — ENGAGED',
      cineOff: 'MANUAL CONTROL',
      vectorLock: 'VECTOR LOCK — ',
      orbitOn: 'AUTO-ORBIT ON',
      orbitOff: 'AUTO-ORBIT OFF',
      labelsOn: 'LABELS ON',
      labelsOff: 'LABELS OFF',
      soundOn: 'AMBIENCE CHANNEL OPEN',
      soundOff: 'AMBIENCE MUTED',
      acquiring: 'ACQUIRING TARGET — ',
      released: 'TARGET RELEASED — RETURN TO SOL',
      reset: 'PARAMETERS RESET',
    },
  },
  zh: {
    subtitle: '太阳系 · 八大行星 · 一颗恒星 · 一条小行星带',
    subtitle2: '开普勒轨道力学 // 实时模拟',
    missionElapsed: '任务时长',
    simDate: '模拟日期',
    observerDistance: '观测距离',
    focusTarget: '聚焦目标',
    orbitalFlow: '轨道流速',
    timeDilation: '时间倍率',
    frameRate: '帧率',
    daysPerSec: '天/秒',
    flightDeck: '飞行控制台',
    cinePrefix: '运镜',
    cinePlay: '▶ 电影运镜序列',
    cineStop: '■ 电影运镜序列',
    orbit: '环绕',
    labels: '标签',
    params: '参数',
    hud: '界面',
    soundOn: '🔊 音效: 开',
    soundOff: '🔇 音效: 关',
    deckHint: '1-4 视角 · C 运镜 · R 环绕 · L 标签 · P 参数 · M 音效 · H 界面 · ESC 释放',
    bottomHint: '拖拽旋转 · 滚轮缩放 · 点击行星聚焦 · C 电影运镜 · M 音效 · H 界面',
    parameters: '参数设置',
    reset: '重置',
    timeFlow: '时间流速',
    orbitLines: '轨道线',
    planetScale: '行星缩放',
    starfield: '星空密度',
    introTag: '实时轨道模拟',
    introQuote: '“宇宙就在我们之中，我们由星尘构成。” — 卡尔·萨根',
    langButton: '🌐 界面语言: 中文',
    sun: '太阳',
    toast: {
      cineOn: '电影运镜 — 已启动',
      cineOff: '手动控制',
      vectorLock: '视角锁定 — ',
      orbitOn: '自动环绕 开',
      orbitOff: '自动环绕 关',
      labelsOn: '标签 开',
      labelsOff: '标签 关',
      soundOn: '氛围音效已开启',
      soundOff: '音效已静音',
      acquiring: '目标锁定 — ',
      released: '目标已释放 — 返回太阳',
      reset: '参数已重置',
    },
  },
};
