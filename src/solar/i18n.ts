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
  probeBtn: string;
  probePanel: string;
  missionLabel: string;
  targetLabel: string;
  missionFlyby: string;
  missionImpact: string;
  missionOrbit: string;
  freeTarget: string;
  fuelLabel: string;
  burnLabel: string;
  burnPro: string;
  burnRetro: string;
  burnRadOut: string;
  burnRadIn: string;
  burnNorm: string;
  burnNormIn: string;
  resetProbe: string;
  exitProbe: string;
  followProbe: string;
  expertBtn: string;
  logTitle: string;
  logEmpty: string;
  scaleTitle: string;
  scaleSunDist: string;   // {d} = scaled distance
  scaleMoon: string;
  statusLabel: string;
  phaseAim: string;
  phaseFlying: string;
  phaseSuccess: string;
  phaseFail: string;
  aimHelp: string;
  closestLabel: string;
  probeSpeedLabel: string;
  elapsedLabel: string;
  scoreLabel: string;
  distLabel: string;
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
    probeAim: string;
    probeExit: string;
    probeReset: string;
    probeLaunched: string;  // + km/s
    probeMinSpeed: string;
    noFuel: string;
    burnDone: string;
    probeFollowOn: string;
    probeFollowOff: string;
    out_flyby: string;
    out_impact: string;
    out_captured: string;
    out_fail: string;
    out_fail_sun: string;
    out_fail_escaped: string;
    out_fail_wrongbody: string;
    out_fail_impact: string;
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
    probeBtn: '🚀 PROBE',
    probePanel: 'PROBE MISSION',
    missionLabel: 'MISSION TYPE',
    targetLabel: 'TARGET BODY',
    missionFlyby: 'FLYBY',
    missionImpact: 'IMPACT',
    missionOrbit: 'ORBIT CAPTURE',
    freeTarget: 'FREE FLIGHT',
    fuelLabel: 'FUEL Δv',
    burnLabel: 'CORRECTION BURN · 0.3 km/s',
    burnPro: 'PRO+',
    burnRetro: 'PRO−',
    burnRadOut: 'RAD+',
    burnRadIn: 'RAD−',
    burnNorm: 'NRM+',
    burnNormIn: 'NRM−',
    resetProbe: 'RE-ARM',
    exitProbe: 'EXIT',
    followProbe: '📡 TRACK',
    expertBtn: '📋 EXPERT',
    logTitle: 'EVENT LOG',
    logEmpty: 'AWAITING EVENTS…',
    scaleTitle: 'TRUE SCALE',
    scaleSunDist: 'AS A 1 CM BALL — THE SUN WOULD BE {d} AWAY',
    scaleMoon: 'AND THE MOON JUST 30 CM FROM EARTH',
    statusLabel: 'STATUS',
    phaseAim: 'AIMING',
    phaseFlying: 'IN FLIGHT',
    phaseSuccess: 'MISSION SUCCESS',
    phaseFail: 'MISSION FAILED',
    aimHelp: 'DRAG NEAR EARTH TO SET LAUNCH VECTOR (≥4 km/s), RELEASE TO FIRE',
    closestLabel: 'CLOSEST APPROACH',
    probeSpeedLabel: 'PROBE SPEED',
    elapsedLabel: 'FLIGHT TIME',
    scoreLabel: 'SCORE',
    distLabel: 'TARGET RANGE',
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
      probeAim: 'PROBE MODE — DRAG NEAR EARTH TO AIM',
      probeExit: 'PROBE MODE CLOSED',
      probeReset: 'PROBE RE-ARMED AT EARTH',
      probeLaunched: 'IGNITION — LAUNCH Δv ',
      probeMinSpeed: 'LAUNCH ABORTED — NEED ≥4 km/s',
      noFuel: 'PROPELLANT DEPLETED',
      burnDone: 'COURSE CORRECTION — Δv 0.3 km/s',
      probeFollowOn: 'CHASE CAM — TRACKING PROBE',
      probeFollowOff: 'CHASE CAM RELEASED',
      out_flyby: 'FLYBY SUCCESS — TARGET REACHED',
      out_impact: 'DIRECT HIT — IMPACT CONFIRMED',
      out_captured: 'ORBIT CAPTURE ACHIEVED',
      out_fail: 'MISSION FAILED',
      out_fail_sun: 'LOST IN THE SUN',
      out_fail_escaped: 'ESCAPED THE SOLAR SYSTEM',
      out_fail_wrongbody: 'IMPACTED A NON-TARGET BODY',
      out_fail_impact: 'CRASHED INTO TARGET — NO FLYBY',
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
    probeBtn: '🚀 探测器',
    probePanel: '探测器任务',
    missionLabel: '任务类型',
    targetLabel: '目标天体',
    missionFlyby: '飞掠',
    missionImpact: '撞击',
    missionOrbit: '环绕捕获',
    freeTarget: '自由飞行',
    fuelLabel: '燃料 Δv',
    burnLabel: '轨道修正 · 每次 0.3 km/s',
    burnPro: '顺行+',
    burnRetro: '顺行−',
    burnRadOut: '径向+',
    burnRadIn: '径向−',
    burnNorm: '法向+',
    burnNormIn: '法向−',
    resetProbe: '重新装填',
    exitProbe: '退出',
    followProbe: '📡 跟踪视角',
    expertBtn: '📋 专家',
    logTitle: '事件日志',
    logEmpty: '等待事件发生…',
    scaleTitle: '真实尺度',
    scaleSunDist: '若缩小为 1 cm 小球 — 太阳在 {d} 之外',
    scaleMoon: '而月球距地球仅 30 cm',
    statusLabel: '状态',
    phaseAim: '瞄准中',
    phaseFlying: '飞行中',
    phaseSuccess: '任务成功',
    phaseFail: '任务失败',
    aimHelp: '在地球附近拖拽设定发射方向与速度（≥4 km/s），松手点火',
    closestLabel: '最近距离',
    probeSpeedLabel: '探测器速度',
    elapsedLabel: '飞行时间',
    scoreLabel: '得分',
    distLabel: '目标距离',
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
      probeAim: '探测器模式 — 在地球附近拖拽瞄准',
      probeExit: '已退出探测器模式',
      probeReset: '探测器已重新装填于地球',
      probeLaunched: '点火 — 发射 Δv ',
      probeMinSpeed: '发射中止 — 需要 ≥4 km/s',
      noFuel: '燃料耗尽',
      burnDone: '轨道修正 — Δv 0.3 km/s',
      probeFollowOn: '跟踪视角 — 锁定探测器',
      probeFollowOff: '已解除跟踪视角',
      out_flyby: '飞掠成功 — 已抵达目标',
      out_impact: '直接命中 — 撞击确认',
      out_captured: '环绕捕获成功',
      out_fail: '任务失败',
      out_fail_sun: '坠入太阳',
      out_fail_escaped: '飞出太阳系',
      out_fail_wrongbody: '撞上非目标天体',
      out_fail_impact: '撞上目标 — 飞掠失败',
    },
  },
};