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
  loading: string;
  attrib: string;
  langButton: string;
  sun: string;
  ephemeris: string;
  ephemOn: string;
  ephemOff: string;
  dossier: string;
  dossierClose: string;
  diameter: string;
  vsEarth: string;
  rangeNow: string;
  timeBtn: string;
  timePanel: string;
  pause: string;
  resume: string;
  reverse: string;
  speedLabel: string;
  dateLabel: string;
  jumpBtn: string;
  timelineLabel: string;
  nextEventBtn: string;
  upcoming: string;
  evOpposition: string;   // {b} = planet name
  evConjunction: string;  // {a} {b} = planet names
  evPerihelion: string;   // {b} = body name
  predictTitle: string;
  predictEvent: string;
  predictDate: string;
  predictGo: string;
  predictActual: string;
  predictError: string;
  predictDays: string;
  predictScore: string;
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
    ephemOn: string;
    ephemOff: string;
    paused: string;
    resumed: string;
    timeJump: string;     // + date
    eventJump: string;    // + event description
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
    deckHint: '1-4 VIEWS · C CINE · R ORBIT · L LABELS · P PARAMS · M SOUND · E EPHEM · D DOSSIER · H HUD',
    bottomHint: 'DRAG ORBIT · SCROLL ZOOM · CLICK PLANET TO FOCUS · C CINEMATIC · M SOUND · H HUD',
    parameters: 'PARAMETERS',
    reset: 'RESET',
    timeFlow: 'TIME FLOW',
    orbitLines: 'ORBIT LINES',
    planetScale: 'PLANET SCALE',
    starfield: 'STARFIELD',
    introTag: 'REAL-TIME ORBITAL SIMULATION',
    introQuote: '“The cosmos is within us. We are made of star-stuff.” — Carl Sagan',
    loading: 'LOADING MAPS',
    attrib: 'PLANET MAPS © SSS (CC BY 4.0) · NASA/JPL',
    langButton: '🌐 界面语言: EN',
    sun: 'SUN',
    ephemeris: 'EPHEMERIS: ',
    ephemOn: 'ON',
    ephemOff: 'OFF',
    dossier: 'DOSSIER',
    dossierClose: 'CLOSE',
    diameter: 'DIAMETER',
    vsEarth: 'VS EARTH · LOG SCALE',
    rangeNow: 'RANGE NOW',
    timeBtn: '⏱ TIME',
    timePanel: 'TIME CONTROL',
    pause: '⏸ PAUSE',
    resume: '▶ RESUME',
    reverse: '◀◀ REVERSE',
    speedLabel: 'SPEED PRESET',
    dateLabel: 'JUMP TO DATE (UTC)',
    jumpBtn: 'JUMP',
    timelineLabel: 'TIMELINE SCRUB · ±30 YR',
    nextEventBtn: '⏭ NEXT SKY EVENT',
    upcoming: 'UPCOMING EVENTS',
    evOpposition: '{b} AT OPPOSITION',
    evConjunction: '{a}–{b} CONJUNCTION',
    evPerihelion: '{b} PERIHELION',
    predictTitle: 'EVENT FORECAST GAME',
    predictEvent: 'EVENT',
    predictDate: 'YOUR PREDICTION',
    predictGo: 'VERIFY',
    predictActual: 'ACTUAL DATE',
    predictError: 'ERROR',
    predictDays: 'DAYS',
    predictScore: 'SCORE',
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
      ephemOn: 'REAL EPHEMERIS — TRUE LONGITUDES',
      ephemOff: 'SIMPLIFIED ORBITS',
      paused: 'TIME FROZEN',
      resumed: 'TIME FLOW RESUMED',
      timeJump: 'CLOCK SET — ',
      eventJump: 'SKY EVENT — ',
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
    deckHint: '1-4 视角 · C 运镜 · R 环绕 · L 标签 · P 参数 · M 音效 · E 星历 · D 档案 · H 界面',
    bottomHint: '拖拽旋转 · 滚轮缩放 · 点击行星聚焦 · C 电影运镜 · M 音效 · H 界面',
    parameters: '参数设置',
    reset: '重置',
    timeFlow: '时间流速',
    orbitLines: '轨道线',
    planetScale: '行星缩放',
    starfield: '星空密度',
    introTag: '实时轨道模拟',
    introQuote: '“宇宙就在我们之中，我们由星尘构成。” — 卡尔·萨根',
    loading: '加载贴图',
    attrib: '行星贴图 © SOLAR SYSTEM SCOPE (CC BY 4.0) · NASA/JPL',
    langButton: '🌐 界面语言: 中文',
    sun: '太阳',
    ephemeris: '星历: ',
    ephemOn: '开',
    ephemOff: '关',
    dossier: '档案',
    dossierClose: '关闭',
    diameter: '直径',
    vsEarth: '与地球对比 · 对数比例',
    rangeNow: '当前距离',
    timeBtn: '⏱ 时间',
    timePanel: '时间控制',
    pause: '⏸ 暂停',
    resume: '▶ 继续',
    reverse: '◀◀ 倒放',
    speedLabel: '倍率档位',
    dateLabel: '跳转到日期 (UTC)',
    jumpBtn: '跳转',
    timelineLabel: '时间轴拖动 · ±30 年',
    nextEventBtn: '⏭ 跳到下一事件',
    upcoming: '即将发生',
    evOpposition: '{b}冲日',
    evConjunction: '{a}与{b}会合',
    evPerihelion: '{b}过近日点',
    predictTitle: '事件预测挑战',
    predictEvent: '事件',
    predictDate: '你的预测日期',
    predictGo: '验证',
    predictActual: '实际日期',
    predictError: '误差',
    predictDays: '天',
    predictScore: '得分',
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
      ephemOn: '真实星历 — 行星切换到真实黄经位置',
      ephemOff: '简化轨道模式',
      paused: '时间已冻结',
      resumed: '时间恢复流动',
      timeJump: '时钟已设定 — ',
      eventJump: '天象 — ',
    },
  },
};