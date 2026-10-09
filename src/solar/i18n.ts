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
  deckHide: string;
  deckShow: string;
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
  bloomLabel: string;
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
  exitImmersive: string;
  globeBtn: string;
  globeTitle: string;
  globeReset: string;
  globeGrid: string;
  globeFill: string;
  globeLabels: string;
  globeExit: string;
  globeSpin: string;
  galaxyTitle: string;
  galaxyCap: string;
  galaxyLabels: string;
  galaxyExit: string;
  galaxyObserve: string;
  galaxyObserveExit: string;
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
  layerTitle: string;
  layerWell: string;
  layerLagrange: string;
  layerHill: string;
  expTitle: string;
  expInject: string;
  expReset: string;
  expHint: string;
  logExpInject: string;
  logExpReset: string;
  logExpResetJump: string;
  scaleTitle: string;
  scaleSunDist: string;   // {d} = scaled distance
  scaleMoon: string;
  surfaceBtn: string;
  surfaceInfoTitle: string;
  surfaceSunAng: string;
  surfaceSunDist: string;
  surfaceHint: string;
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
    surfaceOn: string;
    surfaceOff: string;
    wellOn: string;
    wellOff: string;
    hillOn: string;
    hillOff: string;
    globeOn: string;
    globeOff: string;
    globeNoBody: string;
    globeNoExp: string;
    globeNoProbe: string;
    galaxyOn: string;
    galaxyOff: string;
    galNoExp: string;
    galNoProbe: string;
    galReturning: string;
    lagrangeOn: string;
    lagrangeOff: string;
    expInjected: string;
    expReset: string;
    expResetJump: string;
    expNoProbe: string;
    bloomOn: string;
    bloomOff: string;
    bloomAutoOff: string;
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
    deckHide: 'HIDE PANEL · X',
    deckShow: 'SHOW PANEL · X',
    soundOn: '🔊 SOUND: ON',
    soundOff: '🔇 SOUND: OFF',
    deckHint: '1-4 VIEWS · C CINE · R ORBIT · L LABELS · P PARAMS · M SOUND · E EPHEM · D DOSSIER · H HUD · X PANEL',
    bottomHint: 'DRAG ORBIT · SCROLL ZOOM · CLICK PLANET TO FOCUS · C CINEMATIC · M SOUND · H HUD · X PANEL',
    parameters: 'PARAMETERS',
    reset: 'RESET',
    timeFlow: 'TIME FLOW',
    orbitLines: 'ORBIT LINES',
    planetScale: 'PLANET SCALE',
    starfield: 'STARFIELD',
    bloomLabel: '✦ BLOOM',
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
    exitImmersive: 'EXIT IMMERSIVE · H',
    globeBtn: '◉ GLOBE VIEW',
    globeTitle: 'GLOBE VIEW',
    globeReset: 'RESET VIEW',
    globeGrid: 'GRATICULE',
    globeFill: 'FILL LIGHT',
    globeLabels: 'LANDMARKS',
    globeExit: 'EXIT GLOBE VIEW',
    globeSpin: 'SPIN',
    galaxyTitle: 'GALAXY VIEW',
    galaxyCap: 'THE MILKY WAY · ~100,000 LIGHT-YEARS ACROSS',
    galaxyLabels: 'LABELS',
    galaxyExit: 'EXIT GALAXY VIEW',
    galaxyObserve: 'OBSERVE',
    galaxyObserveExit: 'EXIT OBSERVE · ESC',
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
    layerTitle: 'OVERLAYS',
    layerWell: 'GRAVITY WELL',
    layerLagrange: 'LAGRANGE POINTS',
    layerHill: 'MOON HILL SPHERE',
    expTitle: 'N-BODY EXPERIMENT',
    expInject: '☄ INJECT ROGUE OBJECT',
    expReset: 'RESET SOLAR SYSTEM',
    expHint: '13 Mᴊ BROWN DWARF · 42 AU · FULL MUTUAL GRAVITY',
    logExpInject: 'Rogue brown dwarf (13 Mᴊ) injected at 42 AU — N-body experiment live',
    logExpReset: 'Solar system restored to analytic ephemeris',
    logExpResetJump: 'Time jump — experiment reset to analytic ephemeris',
    scaleTitle: 'TRUE SCALE',
    scaleSunDist: 'AS A 1 CM BALL — THE SUN WOULD BE {d} AWAY',
    scaleMoon: 'AND THE MOON JUST 30 CM FROM EARTH',
    surfaceBtn: '🌅 SURFACE VIEW',
    surfaceInfoTitle: 'GROUND OBSERVATION',
    surfaceSunAng: 'SUN ANGULAR SIZE (TRUE)',
    surfaceSunDist: 'TRUE SUN DISTANCE',
    surfaceHint: 'DRAG TO LOOK AROUND · B / ESC TO LEAVE',
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
      surfaceOn: 'SURFACE VIEW — LANDED ON ',
      surfaceOff: 'SURFACE VIEW OFF',
      wellOn: 'GRAVITY WELL OVERLAY ON',
      wellOff: 'GRAVITY WELL OVERLAY OFF',
      hillOn: 'MOON HILL SPHERE ON',
      hillOff: 'MOON HILL SPHERE OFF',
      globeOn: 'GLOBE VIEW — SIM TIME FROZEN',
      globeOff: 'GLOBE VIEW OFF — TIME RESUMED',
      globeNoBody: 'GLOBE VIEW NOT AVAILABLE FOR THIS TARGET',
      globeNoExp: 'N-BODY EXPERIMENT RUNNING — GLOBE VIEW BLOCKED',
      globeNoProbe: 'GLOBE VIEW AND PROBE MODE ARE MUTUALLY EXCLUSIVE',
      galaxyOn: 'GALAXY VIEW — SIM TIME FROZEN',
      galaxyOff: 'BACK TO THE SOLAR SYSTEM — TIME RESUMED',
      galNoExp: 'N-BODY EXPERIMENT BLOCKED IN GALAXY VIEW',
      galNoProbe: 'GALAXY VIEW AND PROBE MODE ARE MUTUALLY EXCLUSIVE',
      galReturning: 'RETURNING TO THE SOLAR SYSTEM…',
      lagrangeOn: 'LAGRANGE POINTS ON',
      lagrangeOff: 'LAGRANGE POINTS OFF',
      expInjected: 'ROGUE OBJECT INJECTED — N-BODY MODE',
      expReset: 'SOLAR SYSTEM RESET',
      expResetJump: 'TIME JUMP — EXPERIMENT RESET',
      expNoProbe: 'PROBE UNAVAILABLE DURING N-BODY EXPERIMENT',
      bloomOn: 'BLOOM ON',
      bloomOff: 'BLOOM OFF',
      bloomAutoOff: 'LOW FPS — BLOOM AUTO-DISABLED',
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
    deckHide: '收起面板 · X',
    deckShow: '展开面板 · X',
    soundOn: '🔊 音效: 开',
    soundOff: '🔇 音效: 关',
    deckHint: '1-4 视角 · C 运镜 · R 环绕 · L 标签 · P 参数 · M 音效 · E 星历 · D 档案 · H 界面 · X 面板',
    bottomHint: '拖拽旋转 · 滚轮缩放 · 点击行星聚焦 · C 电影运镜 · M 音效 · H 界面 · X 面板',
    parameters: '参数设置',
    reset: '重置',
    timeFlow: '时间流速',
    orbitLines: '轨道线',
    planetScale: '行星缩放',
    starfield: '星空密度',
    bloomLabel: '✦ 泛光',
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
    exitImmersive: '退出沉浸 · H',
    globeBtn: '◉ 球体视图',
    globeTitle: '球体视图',
    globeReset: '复位视角',
    globeGrid: '经纬网格',
    globeFill: '暗面补光',
    globeLabels: '地标标注',
    globeExit: '退出球体视图',
    globeSpin: '自转',
    galaxyTitle: '银河视图',
    galaxyCap: '银河系 · 直径约 100,000 光年',
    galaxyLabels: '标注',
    galaxyExit: '退出银河视图',
    galaxyObserve: '观赏',
    galaxyObserveExit: '退出观赏 · Esc',
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
    layerTitle: '叠加图层',
    layerWell: '引力势阱',
    layerLagrange: '拉格朗日点',
    layerHill: '月球希尔球',
    expTitle: 'N 体实验',
    expInject: '☄ 注入流浪天体',
    expReset: '重置太阳系',
    expHint: '13 倍木星质量褐矮星 · 42 AU · 全引力互扰',
    logExpInject: '流浪褐矮星（13 倍木星质量）已于 42 AU 处注入 — N 体实验运行中',
    logExpReset: '太阳系已还原为解析星历',
    logExpResetJump: '时间跳跃 — 实验已重置为解析星历',
    scaleTitle: '真实尺度',
    scaleSunDist: '若缩小为 1 cm 小球 — 太阳在 {d} 之外',
    scaleMoon: '而月球距地球仅 30 cm',
    surfaceBtn: '🌅 表面视角',
    surfaceInfoTitle: '地面观测',
    surfaceSunAng: '太阳视角直径（真实值）',
    surfaceSunDist: '真实日距',
    surfaceHint: '拖动环视 · B / ESC 返回太空',
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
      surfaceOn: '表面视角 — 已登陆',
      surfaceOff: '已离开表面视角',
      wellOn: '引力势阱叠加层已开启',
      wellOff: '引力势阱叠加层已关闭',
      hillOn: '月球希尔球已开启',
      hillOff: '月球希尔球已关闭',
      globeOn: '已进入球体视图 — 时间已冻结',
      globeOff: '已退出球体视图，时间恢复流动',
      globeNoBody: '该目标不支持球体视图',
      globeNoExp: 'N 体实验进行中，无法进入球体视图',
      globeNoProbe: '球体视图与探测器模式互斥',
      galaxyOn: '已进入银河视图 — 时间已冻结',
      galaxyOff: '已返回太阳系，时间恢复流动',
      galNoExp: '银河视图中无法启动 N 体实验',
      galNoProbe: '银河视图与探测器模式互斥',
      galReturning: '正在返回太阳系…',
      lagrangeOn: '拉格朗日点已开启',
      lagrangeOff: '拉格朗日点已关闭',
      expInjected: '流浪天体已注入 — N 体模式',
      expReset: '太阳系已重置',
      expResetJump: '时间跳跃 — 实验已重置',
      expNoProbe: 'N 体实验运行中，探测器模式不可用',
      bloomOn: '泛光已开启',
      bloomOff: '泛光已关闭',
      bloomAutoOff: '帧率过低 — 泛光已自动关闭',
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