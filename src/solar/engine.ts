// HELION engine — Three.js solar system simulation.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  PLANETS, SUN_RADIUS, AU_UNITS, DAYS_PER_SECOND,
  keplerPeriod, CINE_SHOTS, VIEWS, HALLEY_SPEC, VOYAGER_SPECS,
  MOON_SPEC, MOON_PERIOD_DAYS, MOON_SCENE_R, NEW_MOON_JD, DIST_AU,
  ASTEROID_SPECS, DWARF_SPECS, ISS_SPEC, ISS_SCENE_R, ORBITER_SPEC, LANDMARKS, GALAXY_POIS, GALAXY_SUN_POS, GALAXY_SUN_LABEL, GALAXY_ARMS,
  MOON_SYS, MOON_HOST, MISSIONS } from './data';
import type { MoonSysSpec, MissionKey, MoonHost } from './data';
import type { Landmark, GalaxyPoi } from './data';
import type { PlanetSpec } from './data';
import { planetTexture, sunTexture, ringTexture, glowSprite, loadRealTextures } from './textures';
import type { TextureSet } from './textures';
import { Ambience } from './audio';
import { STR } from './i18n';
import type { Lang } from './i18n';
import { BASE_JD, helioLonLat, helioState, halleyScenePos, VOYAGERS, voyagerAU, voyagerScenePos, ELEMENTS } from './ephem';
import { listUpcoming, solveEvent, activeEclipse } from './events';
import type { AstroEvent, EclipseEvent, EventType } from './events';
import {
  MU_SUN, KMS_TO_AUDAY, AUDAY_TO_KMS, PLANET_MU, PLANET_RADIUS_AU, FLYBY_THRESHOLD_AU,
  stepProbe, adaptiveDt, distToBody, relSpeedKms, bodyVelocity, auToScenePos, predictOrbit,
} from './probe';
import type { ProbeState } from './probe';
import type { VoyagerSpec } from './ephem';

export interface HudSnapshot {
  cine: boolean;
  orbit: boolean;
  labels: boolean;
  sound: boolean;
  ephemeris: boolean;
  expert: boolean;
  surfaceId: string;
  well: boolean;
  lagrange: boolean;
  hill: boolean;
  globeId: string;
  globeGrid: boolean;
  globeFill: boolean;
  globeLabels: boolean;
  globeSpin: boolean;
  galaxy: boolean;
  galaxyLabels: boolean;
  galaxyObserve: boolean;
  gxTrans: boolean;
  gxFocus: { id: string; name: string; nameCn: string; desc: string; descCn: string } | null;
  experiment: boolean;
  bloom: boolean;
  shotName: string;
  focusId: string;
  focusName: string;
  focusFact: string;
  viewName: string;
  params: { speed: number; orbitOpacity: number; planetScale: number; starfield: number };
}

export interface LogEntry { date: string; text: string }

export type ProbePhase = 'aim' | 'flying' | 'success' | 'fail';
export type ProbeMission = 'flyby' | 'impact' | 'captured';

export interface ProbeTelemetry {
  active: boolean;
  phase: ProbePhase;
  outcome: string;          // '' | 'flyby' | 'impact' | 'captured' | 'sun' | 'escaped' | 'wrongbody'
  mission: ProbeMission;
  target: string;
  fuel: number;             // km/s remaining
  fuelMax: number;
  speedKms: number;         // heliocentric speed
  distTargetAU: number | null;
  closestAU: number | null;
  elapsedYr: number;
  aimKms: number;
  score: number | null;
  following: boolean;
}

export interface Telemetry {
  fps: number;
  distAU: number;
  flow: number;
  simDays: number;
  focusAU: number | null;
  probe: ProbeTelemetry | null;
  mission: MissionTelemetry | null;
}

export interface MissionTelemetry {
  craft: string;
  t: number;           // decimal year
  playing: boolean;
  eventIdx: number;    // -1 = none (milestone pause card)
}

const BASE_DATE = Date.UTC(2026, 6, 17);
const DEG = Math.PI / 180;
// scratch accel buffer for the rogue-object N-body experiment (max 10 bodies)
const expAcc = new Float64Array(30);

interface PlanetNode {
  spec: PlanetSpec;
  pivot: THREE.Group;      // orbit rotation group (inclined)
  mesh: THREE.Mesh;        // planet sphere (spins)
  body: THREE.Group;       // axial-tilt group holding mesh
  angle: number;           // current orbital angle
  period: number;          // seconds per orbit at 1×
  label?: HTMLElement;
  ring?: THREE.Mesh;
  atmo?: THREE.Mesh;         // atmosphere shell — hidden in surface view
  orbitRing?: THREE.Line;    // local orbit circle (moon) — hidden in surface view
}

interface Tween {
  t: number;
  dur: number;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTgt: THREE.Vector3;
  toTgt: THREE.Vector3;
  after?: () => void;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// anchor-relay transition constants
const GX_SUN_WIN: [number, number] = [0.26, 0.45]; // the Sun shrinks into the star you keep watching
const GX_ORIGIN = new THREE.Vector3();             // the anchor the gaze never leaves
const MOON_SYS_IDS = new Set(Object.keys(MOON_HOST)); // lazily-built moon-system bodies

// atmosphere rim settings per planet
const ATMO: Record<string, { color: number; k: number; scale: number }> = {
  earth:   { color: 0x6fb7ff, k: 0.62, scale: 1.16 },
  venus:   { color: 0xe8d9a0, k: 0.66, scale: 1.14 },
  mars:    { color: 0xe08a5f, k: 0.72, scale: 1.12 },
  jupiter: { color: 0xd8b28c, k: 0.74, scale: 1.10 },
  saturn:  { color: 0xe3cf9e, k: 0.74, scale: 1.10 },
  uranus:  { color: 0x9fdfe3, k: 0.70, scale: 1.12 },
  neptune: { color: 0x5f83e8, k: 0.70, scale: 1.12 },
};

export class SolarEngine {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private lastTime = 0;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private planets: PlanetNode[] = [];
  private pickMeshes: THREE.Object3D[] = [];
  private orbitLines: THREE.LineLoop[] = [];
  private stars!: THREE.Points;
  private belt!: THREE.Group;
  private kuiper!: THREE.Group;
  private heliopause: THREE.Mesh | null = null;
  private helioLabel: HTMLElement | null = null;
  private eclipseRig: THREE.Group | null = null;
  private eclipseKey = '';
  private sun!: THREE.Mesh;
  private moonNode: PlanetNode | null = null;
  private hillOn = false;
  private moonHill: THREE.Mesh | null = null;   // wireframe cage: gravitational domain
  private moonHalo: THREE.Mesh | null = null;   // fresnel shell: focus highlight
  private moonSysBuilt = new Set<string>();      // lazy: built on first host focus/globe
  private moonHalos = new Map<string, THREE.Mesh>();
  private sky: THREE.Mesh | null = null;
  // globe view ("specimen mode") state
  private globe: {
    node: PlanetNode; sys: Set<string>;
    savedSpeed: number; savedNear: number; savedMin: number; savedMax: number;
  } | null = null;
  private globeGrid: THREE.Mesh | null = null;
  private globeTerm: THREE.Mesh | null = null;
  private globeFillLight: THREE.HemisphereLight | null = null;
  private globeGridOn = true;
  private globeFillOn = false;
  private globeLabelsOn = true;
  private globeSpinOn = true;   // spin preserved in globe view; user can freeze it
  // galaxy view ("Milky Way mode") state
  private galaxy: {
    savedSpeed: number; savedNear: number; savedFar: number; savedMin: number; savedMax: number;
    savedBg: THREE.Color | THREE.Texture | THREE.CubeTexture | null;
    hidden: Array<{ o: THREE.Object3D; v: boolean }>;
  } | null = null;
  private galaxyObserve = false; // observe mode ("观赏"): labels + HUD hidden
  private gxVeil = 0;            // black veil alpha for the settle fade-in
  private galaxyGroup: THREE.Group | null = null;
  private galaxyLabels: Array<{ el: HTMLElement; obj: THREE.Object3D; name: string; nameCn: string; poi?: GalaxyPoi; isSun?: boolean }> = [];
  private galaxyLabelsOn = true;
  private galaxySun: THREE.Sprite | null = null;
  private gxTrans: {
    dir: 'toGalaxy' | 'toSolar'; t: number; dur: number;
    fromPos: THREE.Vector3; midPos: THREE.Vector3; arrPos: THREE.Vector3;
    fromTgt: THREE.Vector3;
    swapped: boolean; whooshed: boolean; boomed: boolean;
    inner?: boolean;  // toSolar variant: dive all the way into the inner system
  } | null = null;
  private warpCanvas: HTMLCanvasElement | null = null;
  private warpCtx: CanvasRenderingContext2D | null = null;
  private warpIntensity = 0;   // zoom bump: vignette + dust shell + light pulse
  private gxFlash = 0;         // exposure pulse at the crossing point
  private savedFov = 55;       // camera fov before the zoom kick
  private gxSunK = 1;          // sun shrink factor for the anchor handoff
  private gxPrep = false;      // first-visit compile gate: clock starts only after shaders are ready
  private gxFadeO: Array<{ mat: THREE.Material; base: number; win: [number, number] }> = [];
  private gxFadeS: Array<{ obj: THREE.Object3D; base: number; win: [number, number] }> = [];
  private gxLayers: Array<{ mat: THREE.Material; base: number; win: [number, number]; u: { value: number } | null }> = [];
  private gxPulse: Array<{ mat: THREE.Material; base: number; amp: number; speed: number; phase: number }> = [];
  private gxFocus: { poi: GalaxyPoi; anchor: THREE.Object3D; savedPos: THREE.Vector3; savedTgt: THREE.Vector3 } | null = null;
  private gxAnchors = new Map<string, THREE.Object3D>(); // live local anchors — the galaxy group slowly rotates, so world positions drift
  private gxGlowDim: Array<{ mat: THREE.SpriteMaterial; pos: THREE.Vector3; base: number }> = []; // far-view glow anchors dim as the camera closes in
  private dustShell: THREE.Points | null = null; // near-field parallax dust (replaces the tunnel)
  private dustMeta: Array<{ x: number; y: number; z: number; v: number }> = [];
  private warpSfxWhoosh: HTMLAudioElement | null = null;
  private warpSfxBoom: HTMLAudioElement | null = null;
  private globeMarkers: THREE.Mesh[] = [];
  private lmLabels: Array<{ el: HTMLElement; obj: THREE.Object3D; lm: Landmark }> = [];
  private dimmed: Array<{ m: THREE.Material; transparent: boolean; opacity: number }> = [];
  private dimHidden: THREE.Object3D[] = [];
  private earthNode?: PlanetNode;
  private ephemOn = false;
  private halley?: { node: PlanetNode; tail: THREE.Points; trail: THREE.Line; trailPts: THREE.Vector3[]; tailMat: THREE.ShaderMaterial; coma: THREE.Sprite };
  private voyagers: { node: PlanetNode; v: VoyagerSpec; lastAu: number; craft: THREE.Group }[] = [];
  private tex: TextureSet = {};
  private earthClouds?: THREE.Mesh;
  private sunGlow1?: THREE.Sprite;
  private sunGlow2?: THREE.Sprite;
  private pulseT = 0;

  onProgress: ((pct: number) => void) | null = null;
  onReady: (() => void) | null = null;

  private raf = 0;
  private disposed = false;
  private tween: Tween | null = null;
  private cine = false;
  private cineShot = 0;
  private cineTime = 0;
  private cineAz = 0;
  private cineTarget = new THREE.Vector3();
  private orbit = false;
  private labelsOn = true;
  private focus: PlanetNode | null = null;
  private focusOffset = new THREE.Vector3();
  private speed = 1;
  private simDays = 0;
  private mission: {
    spec: import('./data').MissionSpec;
    t: number;              // decimal year
    playing: boolean;
    speed: number;          // years per second
    curve: THREE.CatmullRomCurve3;
    yrs: number[];          // resolved keyframe years ('today' → current year)
    eventIdx: number;       // milestone pause card; -1 = none
    node: PlanetNode;
  } | null = null;
  private prevSpeed = 1;
  private eventCache: { fromDay: number; events: AstroEvent[] } | null = null;
  private halleyLastDay = 0;
  private probeFollow = false;
  private focusSettle = false;  // only true during the initial focus approach
  private probeSettle = false;
  private expert = false;
  private eventLog: Array<{ jd: number; text: string }> = [];
  private lastEventJd: number | null = null;
  private well: THREE.Mesh | null = null;
  private lagrangeGroup: THREE.Group | null = null;
  private lagLabels: HTMLElement[] = [];
  private trojanGroup: THREE.Group | null = null;   // permanent L4/L5 camps, tracks Jupiter live
  private trojanLabels: Array<{ el: HTMLElement; anchor: THREE.Object3D }> = [];
  private experiment: {
    bodies: Array<{
      id: string; mu: number;
      x: number; y: number; z: number;
      vx: number; vy: number; vz: number;
    }>;
    jd: number;
    sinceTrail: number;
    rogueMesh: THREE.Group;
    trail: THREE.Line;
    trailAttr: THREE.BufferAttribute;
    trailCount: number;
    lastTrailPos: THREE.Vector3;
  } | null = null;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private bloomOn = false;
  private bloomAuto = true;   // auto quality-degrade armed
  private fpsLowT = 0;
  private surface: {
    node: PlanetNode;
    savedCam: THREE.Vector3;
    savedTarget: THREE.Vector3;
    savedMin: number;
    savedMax: number;
    savedNear: number;
    firstTick: boolean;
  } | null = null;
  private probe: {
    phase: ProbePhase;
    outcome: string;
    mission: ProbeMission;
    target: string;
    s: ProbeState;
    fuel: number;
    closestAU: number;
    prevDist: number;
    launchJd: number;
    score: number | null;
    mesh: THREE.Group;
    beacon: THREE.Sprite;
    arrow: THREE.ArrowHelper;
    trail: THREE.Line;
    trailAttr: THREE.BufferAttribute;
    trailCount: number;
    lastTrailPos: THREE.Vector3;
    pred: THREE.Line;
    aiming: boolean;
    aimStart: { x: number; y: number };
    aimKms: number;
    aimVec: THREE.Vector3;
    lastPredAt: number;
  } | null = null;
  private fps = 60;
  private fpsAcc = 0; private fpsN = 0; private fpsTimer = 0;
  private telTimer = 0;
  private ambience = new Ambience();
  private downPos = { x: 0, y: 0 };
  private params = { speed: 1, orbitOpacity: 0.55, planetScale: 1, starfield: 0.9 };
  private lang: Lang = 'en';

  onSnapshot: ((s: HudSnapshot) => void) | null = null;
  onTelemetry: ((t: Telemetry) => void) | null = null;
  onToast: ((msg: string) => void) | null = null;
  onFatal: ((msg: string) => void) | null = null;

  private canvas: HTMLCanvasElement;
  private labelLayer: HTMLElement;

  constructor(canvas: HTMLCanvasElement, labelLayer: HTMLElement) {
    this.canvas = canvas;
    this.labelLayer = labelLayer;
    (window as unknown as { __helion?: SolarEngine }).__helion = this; // debug/testing handle
  }

  // ------------------------------------------------------------- init
  init() {
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      this.onFatal?.('WEBGL CONTEXT UNAVAILABLE — ' + String(e));
      return;
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 3000);
    this.camera.position.set(-52, 62, 88);

    // post-processing: bloom on capable devices; auto-degrades if fps drops
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    this.bloomOn = !coarse && window.innerWidth >= 768;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.65, 0.82);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 500;
    this.controls.addEventListener('start', () => {
      this.tween = null;
      if (this.cine) this.setCine(false);
      // user grabbed the camera — stop enforcing distances, they own it now
      this.focusSettle = false;
      this.probeSettle = false;
    });

    // load real maps first; procedural painters fill any gaps
    loadRealTextures('textures/', p => this.onProgress?.(p))
      .then(t => { this.tex = t; })
      .catch(() => { /* fall back to procedural */ })
      .finally(() => {
        this.buildScene();
        this.bindPointer();
        window.addEventListener('resize', this.onResize);
        this.loop();
        this.emitSnapshot();
        this.onReady?.();
      });
  }

  private buildScene() {
    // lights
    const sunLight = new THREE.PointLight(0xfff2dd, 2.6, 0, 0);
    this.scene.add(sunLight);
    this.scene.add(new THREE.AmbientLight(0x2a3c52, 0.95));

    // milky way backdrop
    if (this.tex.milkyway) {
      const sky = new THREE.Mesh(
        new THREE.SphereGeometry(1400, 48, 32),
        new THREE.MeshBasicMaterial({ map: this.tex.milkyway, side: THREE.BackSide, depthWrite: false, transparent: true, opacity: 0.9 }),
      );
      sky.renderOrder = -10;
      this.scene.add(sky);
      this.sky = sky;
    }

    // starfield
    this.stars = this.makeStars(3600, 700);
    this.scene.add(this.stars);

    // sun
    const sunGeo = new THREE.SphereGeometry(SUN_RADIUS, 64, 48);
    const sunMat = new THREE.MeshBasicMaterial({ map: this.tex.sun ?? sunTexture() });
    this.sun = new THREE.Mesh(sunGeo, sunMat);
    this.scene.add(this.sun);
    const glow1 = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSprite('rgba(255,230,170,1)', 'rgba(255,150,50,0.55)'),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    glow1.scale.setScalar(SUN_RADIUS * 4.2);
    this.scene.add(glow1);
    this.sunGlow1 = glow1;
    const glow2 = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSprite('rgba(255,190,90,0.9)', 'rgba(255,110,20,0.28)'),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55,
    }));
    glow2.scale.setScalar(SUN_RADIUS * 8.5);
    this.scene.add(glow2);
    this.sunGlow2 = glow2;

    // planets (+ belt asteroids Ceres & Vesta)
    for (const spec of [...PLANETS, ...ASTEROID_SPECS, ...DWARF_SPECS]) {
      const node = this.makePlanet(spec);
      this.planets.push(node);
      if (spec.id === 'earth') this.earthNode = node;
      void this.earthNode; // reserved for surface-view batch
    }

    // asteroid belt between Mars (30) and Jupiter (43)
    this.belt = this.makeBelt(2400, 33.8, 39.0);
    this.scene.add(this.belt);

    // Kuiper belt — 30–50 AU compressed to 80–105 units. Eris (100),
    // Makemake (96) and Haumea (92) live right inside it. Icy & fat.
    this.kuiper = this.makeBelt(1800, 80, 105, { yHalf: 4.2, icy: true });
    this.scene.add(this.kuiper);

    // Jupiter's Trojan camps — permanent citizens like the belt
    this.buildTrojans();

    // heliopause — the bubble the Voyagers punched through (~121 AU real)
    {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x6fc8ff, transparent: true, opacity: 0.04,
        side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      this.heliopause = new THREE.Mesh(new THREE.SphereGeometry(118, 48, 32), mat);
      this.scene.add(this.heliopause);
      const hl = document.createElement('div');
      hl.className = 'p-label helio-label';
      hl.textContent = this.lang === 'zh' ? '日球层顶 · ~121 AU' : 'HELIOPAUSE · ~121 AU';
      this.labelLayer.appendChild(hl);
      this.helioLabel = hl;
    }

    // the Moon — real period & inclination, phases anchored to a true new moon
    this.buildMoon();
    this.buildIss();
    this.buildOrbiter();

    // Halley's comet — stylized elliptical orbit, particle tail, fading trail
    this.buildHalley();

    // Voyager 1 & 2 — escaping the system
    for (const v of VOYAGERS) this.buildVoyager(v);
  }

  private buildMoon() {
    const spec = MOON_SPEC;
    const pivot = new THREE.Group();
    this.scene.add(pivot);
    const body = new THREE.Group();
    pivot.add(body);

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(spec.radius, 24, 18),
      new THREE.MeshStandardMaterial({ map: this.tex.moon ?? planetTexture('mercury'), roughness: 1 }),
    );
    mesh.userData.planetId = spec.id;
    body.add(mesh);
    this.pickMeshes.push(mesh);

    // lunar orbit ring, tilted 5.14° about the pivot's local x-axis
    const ringPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 96; i++) {
      const t = (i / 96) * Math.PI * 2;
      ringPts.push(new THREE.Vector3(
        Math.cos(t) * MOON_SCENE_R,
        Math.sin(t) * Math.sin(spec.inclination * DEG) * MOON_SCENE_R,
        Math.sin(t) * Math.cos(spec.inclination * DEG) * MOON_SCENE_R,
      ));
    }
    const ring = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(ringPts),
      new THREE.LineBasicMaterial({ color: 0x8a94a8, transparent: true, opacity: 0.35 }),
    );
    pivot.add(ring);

    // Hill sphere — the Moon's gravitational domain: true ratio 61,500 km of the
    // 384,400 km orbit ≈ 0.16 × MOON_SCENE_R (≈1.24× the displayed lunar disc)
    const hill = new THREE.Mesh(
      new THREE.SphereGeometry(MOON_SCENE_R * 0.16, 14, 9),
      new THREE.MeshBasicMaterial({
        color: 0x63d8d0, wireframe: true, transparent: true, opacity: 0.14,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    hill.visible = this.hillOn;
    body.add(hill);
    this.moonHill = hill;

    // Fresnel halo — lit only while the Moon is focused (uStrength driven per-frame)
    const haloMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      uniforms: {
        uStrength: { value: 0 },
        uColor: { value: new THREE.Color(0x9fd4e4) },
      },
      vertexShader: `
        varying vec3 vN; varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float uStrength; uniform vec3 uColor;
        varying vec3 vN; varying vec3 vV;
        void main() {
          float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
          gl_FragColor = vec4(uColor, rim * uStrength);
        }`,
    });
    const halo = new THREE.Mesh(new THREE.SphereGeometry(spec.radius * 1.18, 32, 24), haloMat);
    body.add(halo);
    this.moonHalo = halo;

    const label = this.makeLabel(spec);
    const node: PlanetNode = { spec, pivot, mesh, body, angle: 0, period: 0, label, orbitRing: ring };
    this.planets.push(node);
    this.moonNode = node;
  }

  // fresnel focus halo — the same shell the Moon wears, factored for reuse
  private makeFocusHalo(radius: number, color: number): THREE.Mesh {
    const haloMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      uniforms: {
        uStrength: { value: 0 },
        uColor: { value: new THREE.Color(color) },
      },
      vertexShader: `
        varying vec3 vN; varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float uStrength; uniform vec3 uColor;
        varying vec3 vN; varying vec3 vV;
        void main() {
          float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
          gl_FragColor = vec4(uColor, rim * uStrength);
        }`,
    });
    return new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 24), haloMat);
  }

  // moon systems deploy lazily — built the first time the host is focused or
  // globe-viewed, then they live in this.planets like every other body
  private ensureMoonSystem(hostId: MoonHost) {
    if (this.moonSysBuilt.has(hostId)) return;
    this.moonSysBuilt.add(hostId);
    // moons orbit in the host's equatorial plane — tilt every pivot by the
    // host's axial tilt so Uranus's system really stands on its side (97.8°)
    // and Saturn's moons lie in the ring plane
    const hostTilt = PLANETS.find(pl => pl.id === hostId)?.tiltDeg ?? 0;
    for (const spec of MOON_SYS[hostId]) {
      const pivot = new THREE.Group();
      pivot.rotation.z = hostTilt * DEG;
      this.scene.add(pivot);
      const body = new THREE.Group();
      body.scale.setScalar(this.params.planetScale);
      pivot.add(body);

      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(spec.radius, 24, 18),
        new THREE.MeshStandardMaterial({ map: planetTexture(spec.tex), roughness: 1 }),
      );
      mesh.userData.planetId = spec.id;
      body.add(mesh);
      // a drop-in upgrade: place textures/2k_<id>.jpg next to the other textures
      // and the real photo skin replaces the procedural one
      new THREE.TextureLoader().load(`textures/2k_${spec.id}.jpg`, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        (mesh.material as THREE.MeshStandardMaterial).map = tex;
        (mesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
      }, undefined, () => {});

      // generous invisible hit-proxy so even Enceladus is easy to click
      const proxy = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(spec.radius * 2.5, 0.35), 8, 6),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      proxy.userData.planetId = spec.id;
      body.add(proxy);
      this.pickMeshes.push(proxy);

      // orbit ring — same tilted-circle convention as the Moon's
      const ringPts: THREE.Vector3[] = [];
      for (let i = 0; i <= 96; i++) {
        const t = (i / 96) * Math.PI * 2;
        ringPts.push(new THREE.Vector3(
          Math.cos(t) * spec.distance,
          Math.sin(t) * Math.sin(spec.inclination * DEG) * spec.distance,
          Math.sin(t) * Math.cos(spec.inclination * DEG) * spec.distance,
        ));
      }
      const ring = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(ringPts),
        new THREE.LineBasicMaterial({ color: 0x8a94a8, transparent: true, opacity: 0.3 }),
      );
      pivot.add(ring);

      const halo = this.makeFocusHalo(spec.radius * 1.18, new THREE.Color(spec.color).getHex());
      body.add(halo);
      this.moonHalos.set(spec.id, halo);

      const label = this.makeLabel(spec);
      this.planets.push({ spec, pivot, mesh, body, angle: 0, period: 0, label, orbitRing: ring });
    }
    this.toast(STR[this.lang].toast.moonSys);
  }

  // chip UI entry — focus any body, deploying its moon system on the way
  focusBodyById(id: string) {
    const host = MOON_HOST[id];
    if (host) this.ensureMoonSystem(host);
    if (id in MOON_SYS) this.ensureMoonSystem(id as MoonHost);
    const node = this.planets.find(p => p.spec.id === id);
    if (node) this.focusPlanet(node);
  }

  // ------------------------------------------------- mission replay (方案②)
  enterMission(craftId: string) {
    const spec = MISSIONS[craftId];
    const node = this.planets.find(p => p.spec.id === craftId);
    if (!spec || !node) return;
    const nowYr = 1970 + Date.now() / (365.25 * 86400000);
    // resolve keyframes to scene positions at THIS moment — encounters
    // rendezvous with the planets wherever they currently stand
    const pts: THREE.Vector3[] = [];
    const yrs: number[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    for (const k of spec.keys) {
      let pos: THREE.Vector3;
      if (k.target === 'today') {
        const v = VOYAGERS.find(v => v.id === craftId)!;
        pos = new THREE.Vector3(...Object.values(voyagerScenePos(v, this.simDays)) as [number, number, number]);
        yrs.push(nowYr);
      } else if (k.target === 'out') {
        const v = VOYAGERS.find(v => v.id === craftId)!;
        pos = new THREE.Vector3(
          105 * Math.cos(v.lat) * Math.cos(v.lon),
          105 * Math.sin(v.lat),
          105 * Math.cos(v.lat) * Math.sin(v.lon),
        );
        yrs.push(k.yr);
      } else {
        const host = this.planets.find(p => p.spec.id === k.target);
        if (!host) return;
        // flyby offset: swing BESIDE the planet, not through its center
        const side = host.body.position.clone().cross(up).normalize()
          .multiplyScalar(Math.max(host.spec.radius * 3, 1.2));
        pos = host.body.position.clone().add(side);
        yrs.push(k.yr);
      }
      pts.push(pos);
    }
    // smooth cruise segments between keyframes
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.mission = { spec, t: yrs[0], playing: true, speed: 1.5, curve, yrs, eventIdx: -1, node };
    this.focusPlanet(node);
    this.toast(this.lang === 'zh' ? `任务回放 — ${spec.nameCn}` : `MISSION REPLAY — ${spec.name}`);
    this.emitSnapshot();
  }

  exitMission() {
    if (!this.mission) return;
    this.mission = null; // craft snaps back to its real position next frame
    this.toast(this.lang === 'zh' ? '任务回放结束' : 'MISSION REPLAY ENDED');
    this.emitSnapshot();
  }

  setMissionT(t: number) {
    if (!this.mission) return;
    this.mission.t = t;
    this.mission.eventIdx = -1;
  }

  toggleMissionPlay() {
    if (!this.mission) return;
    const m = this.mission;
    if (m.eventIdx >= 0) { m.eventIdx = -1; m.playing = true; return; } // resume from milestone
    if (!m.playing && m.t >= m.yrs[m.yrs.length - 1]) m.t = m.yrs[0];    // replay from start
    m.playing = !m.playing;
  }

  cycleMissionSpeed() {
    if (!this.mission) return;
    const speeds = [1.5, 4, 12];
    const i = speeds.indexOf(this.mission.speed);
    this.mission.speed = speeds[(i + 1) % speeds.length];
  }

  // ------------------------------------------------- eclipse shadow geometry
  // Schematic but proportionally honest: the umbral cone length is the REAL
  // cone length mapped into scene scale — a total eclipse's cone overshoots
  // Earth, an annular one's falls short. That difference IS the astronomy.
  private buildEclipseRig(ev: EclipseEvent) {
    this.teardownEclipseRig();
    const t = STR[this.lang];
    const solar = ev.kind === 'solar';
    const occ = this.planets.find(p => p.spec.id === (solar ? 'moon' : 'earth'));
    if (!occ) return;
    const occR = occ.spec.radius * this.params.planetScale;
    const moonSceneDist = MOON_SCENE_R * 1; // 2.1 scene units
    const scale = moonSceneDist / 384400;   // scene units per km at the Moon's orbit
    const Lu = (ev.umbraKm ?? 375000) * scale;
    const Lp = Lu * 1.35;
    const rig = new THREE.Group();
    // umbra: tapering to a point
    const umbra = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0015, occR, Lu, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }),
    );
    umbra.geometry.translate(0, Lu / 2, 0);
    rig.add(umbra);
    // penumbra: widening at the Sun's angular radius (0.266°)
    const penR = occR + Lp * Math.tan(0.266 * Math.PI / 180);
    const pen = new THREE.Mesh(
      new THREE.CylinderGeometry(penR, occR, Lp, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
    );
    pen.geometry.translate(0, Lp / 2, 0);
    rig.add(pen);
    // amber rim on the umbra so the cone reads against black space
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0015, occR, Lu, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffbe64, transparent: true, opacity: 0.18, wireframe: true, depthWrite: false }),
    );
    rim.geometry.translate(0, Lu / 2, 0);
    rig.add(rim);
    this.scene.add(rig);
    this.eclipseRig = rig;
    this.eclipseKey = String(ev.jd);
    this.toast(t.toast.eclipseGeo);
  }

  private teardownEclipseRig() {
    if (!this.eclipseRig) return;
    this.eclipseRig.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) (m.material as THREE.Material).dispose();
    });
    this.scene.remove(this.eclipseRig);
    this.eclipseRig = null;
    this.eclipseKey = '';
  }

  private updateEclipseRig() {
    const jd = BASE_JD + this.simDays;
    const ev = activeEclipse(jd);
    if (!ev || this.galaxy || this.globe || this.surface) {
      if (this.eclipseRig) this.teardownEclipseRig();
      return;
    }
    if (!this.eclipseRig || this.eclipseKey !== String(ev.jd)) this.buildEclipseRig(ev);
    if (!this.eclipseRig) return;
    // aim: sun sits at the origin, shadow streams away from it
    const solar = ev.kind === 'solar';
    const occ = this.planets.find(p => p.spec.id === (solar ? 'moon' : 'earth'));
    if (!occ) return;
    const pos = occ.body.getWorldPosition(new THREE.Vector3());
    const axis = pos.clone().normalize();
    this.eclipseRig.position.copy(pos);
    this.eclipseRig.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
  }

  private missionPos(m: NonNullable<SolarEngine['mission']>): THREE.Vector3 {
    const n = m.yrs.length;
    const t = Math.min(Math.max(m.t, m.yrs[0]), m.yrs[n - 1]);
    let k = 0;
    while (k < n - 2 && t > m.yrs[k + 1]) k++;
    const u = (t - m.yrs[k]) / Math.max(1e-9, m.yrs[k + 1] - m.yrs[k]);
    return m.curve.getPoint((k + u) / (n - 1));
  }

  private stepMission(dt: number) {
    const m = this.mission;
    if (!m) return;
    // drive the craft along the keyframe curve
    m.node.body.position.copy(this.missionPos(m));
    if (!m.playing) return;
    const prevT = m.t;
    m.t += dt * m.speed;
    const end = m.yrs[m.yrs.length - 1];
    // milestone crossing → pause + caption card
    for (let i = 0; i < m.spec.keys.length; i++) {
      const ky = m.spec.keys[i].yr === 0 ? end : m.spec.keys[i].yr;
      if (ky > prevT && ky <= m.t) {
        m.t = ky;
        m.eventIdx = i;
        m.playing = false;
        const k = m.spec.keys[i];
        this.toast(this.lang === 'zh' ? k.labelCn : k.label);
        break;
      }
    }
    if (m.t >= end) { m.t = end; m.playing = false; }
  }

  // ISS — showcase orbit around Earth (real-time, not sim-clock driven)
  private buildIss() {
    const spec = ISS_SPEC;
    const pivot = new THREE.Group();
    this.scene.add(pivot);
    const body = new THREE.Group();
    pivot.add(body);

    // station model: detailed ISS — lattice truss, 4 solar array pairs, radiators,
    // pressurized module chain (Zvezda→Zarya→Unity→Destiny→Harmony→forward node),
    // Columbus/Kibo labs, cupola, Canadarm2 and a docked crew capsule
    const station = new THREE.Group();
    const alu = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.45, metalness: 0.8 });
    const white = new THREE.MeshStandardMaterial({ color: 0xe6e9ec, roughness: 0.55, metalness: 0.35 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd8a520, roughness: 0.4, metalness: 0.85, emissive: 0x201604 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.6, metalness: 0.6 });
    const panelBlue = new THREE.MeshStandardMaterial({ color: 0x22477e, roughness: 0.35, metalness: 0.5, emissive: 0x0a1830, emissiveIntensity: 0.7 });
    const strut = (a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) => {
      const d = b.clone().sub(a);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), mat);
      m.position.copy(a).addScaledVector(d, 0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      station.add(m);
    };
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

    // --- integrated truss: square lattice of 4 longerons + frames + diagonals (X axis)
    const T = 0.46;  // truss span
    const g = 0.014; // lattice half-gauge
    for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      strut(V(-T / 2, sy * g, sz * g), V(T / 2, sy * g, sz * g), 0.0035, alu);
    }
    for (let i = 0; i <= 10; i++) {
      const x = -T / 2 + (T / 10) * i;
      strut(V(x, -g, -g), V(x, g, -g), 0.002, alu);
      strut(V(x, -g, g), V(x, g, g), 0.002, alu);
      strut(V(x, -g, -g), V(x, -g, g), 0.002, alu);
      strut(V(x, g, -g), V(x, g, g), 0.002, alu);
      if (i < 10) {
        const x2 = -T / 2 + (T / 10) * (i + 1);
        strut(V(x, g, -g), V(x2, -g, -g), 0.0015, alu);
        strut(V(x, -g, g), V(x2, g, g), 0.0015, alu);
      }
    }

    // --- 4 photovoltaic array pairs (S6/S4 port-starboard ends): gold frame + blue blanket
    for (const sx of [-1, 1]) {
      for (const ax of [0.16, 0.205]) {
        const hx = sx * ax;
        // gimbal hub
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 8), gold);
        hub.position.set(hx, 0, 0);
        hub.rotation.x = Math.PI / 2;
        station.add(hub);
        for (const sz of [-1, 1]) {
          const frame = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.0012, 0.148), gold);
          frame.position.set(hx, -0.0016, sz * 0.084);
          station.add(frame);
          const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.0016, 0.14), panelBlue);
          blanket.position.set(hx, 0, sz * 0.084);
          station.add(blanket);
        }
      }
      // --- radiators: 3 white panels per side, deployed forward of the truss
      for (let i = 0; i < 3; i++) {
        const rad = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.0012, 0.07), white);
        rad.position.set(sx * (0.075 + i * 0.024), 0, 0.055);
        station.add(rad);
      }
    }

    // --- pressurized module chain along Z (aft +Z → forward −Z)
    const mod = (r: number, len: number, z: number, mat: THREE.Material) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), mat);
      m.rotation.x = Math.PI / 2;
      m.position.set(0, -0.004, z);
      station.add(m);
      return m;
    };
    mod(0.016, 0.075, 0.125, gold);                 // Zvezda service module (MLI gold)
    mod(0.016, 0.055, 0.068, white);                // Zarya FGB
    mod(0.015, 0.032, 0.032, alu);                  // Unity node
    const core = mod(0.0165, 0.052, -0.006, alu);   // Destiny lab — pick target
    core.userData.planetId = spec.id;
    mod(0.015, 0.038, -0.048, alu);                 // Harmony node
    mod(0.014, 0.03, -0.08, white);                 // forward node
    // end cone (forward docking port)
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.004, 0.02, 10), alu);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, -0.004, -0.104);
    station.add(nose);

    // --- Columbus (starboard) & Kibo (port) labs hanging off Harmony
    const columbus = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.045, 12), alu);
    columbus.rotation.x = Math.PI / 2;
    columbus.position.set(0.027, -0.004, -0.048);
    station.add(columbus);
    const kibo = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.05, 12), white);
    kibo.rotation.x = Math.PI / 2;
    kibo.position.set(-0.027, -0.004, -0.048);
    station.add(kibo);
    // Kibo exposed pallet + its own small solar wing
    const pallet = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.004, 0.014), gold);
    pallet.position.set(-0.027, 0.008, -0.076);
    station.add(pallet);
    const kiboPanel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.0014, 0.026), panelBlue);
    kiboPanel.position.set(-0.056, 0.012, -0.048);
    station.add(kiboPanel);

    // --- cupola under Harmony: faceted dome with dark window band
    const cupola = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.01, 7), white);
    cupola.position.set(0.008, -0.026, -0.048);
    station.add(cupola);
    const cupolaTop = new THREE.Mesh(new THREE.SphereGeometry(0.011, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), dark);
    cupolaTop.rotation.x = Math.PI;
    cupolaTop.position.set(0.008, -0.031, -0.048);
    station.add(cupolaTop);

    // --- Canadarm2: two-segment white arm off Destiny
    strut(V(0.006, -0.016, -0.01), V(0.05, -0.048, 0.045), 0.004, white);
    strut(V(0.05, -0.048, 0.045), V(0.088, -0.04, 0.09), 0.0032, white);
    const wrist = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.012), white);
    wrist.position.set(0.09, -0.04, 0.094);
    station.add(wrist);

    // --- docked crew capsule at Zvezda aft port (sphere + cone + twin panels)
    const capsule = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), gold);
    capsule.position.set(0, -0.004, 0.172);
    station.add(capsule);
    const capsuleTop = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.004, 0.024, 8), alu);
    capsuleTop.rotation.x = Math.PI / 2;
    capsuleTop.position.set(0, -0.004, 0.188);
    station.add(capsuleTop);
    for (const sz of [-1, 1]) {
      const cp = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.0012, 0.014), panelBlue);
      cp.position.set(sz * 0.022, -0.004, 0.2);
      station.add(cp);
    }

    body.add(station);
    this.pickMeshes.push(core); // click target (Destiny)

    // orbit ring (local, inclined 51.6°) — radius is updated live (planetScale-safe)
    const ringPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 96; i++) {
      const t = (i / 96) * Math.PI * 2;
      ringPts.push(new THREE.Vector3(Math.cos(t), 0, Math.sin(t)));
    }
    const ring = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(ringPts),
      new THREE.LineBasicMaterial({ color: 0x9ab8cc, transparent: true, opacity: 0.4 }),
    );
    ring.rotation.x = spec.inclination * DEG;
    pivot.add(ring);

    const label = this.makeLabel(spec);
    const node: PlanetNode = { spec, pivot, mesh: core, body, angle: 0, period: 0, label, orbitRing: ring };
    this.planets.push(node);
  }

  // Lunar orbiter — LRO-style mini satellite on a real-time polar showcase orbit.
  // Teaching point: the Moon can barely keep satellites (Earth tides + mascons),
  // so this little craft needs constant station-keeping — and it nests inside the
  // Hill-sphere cage when that layer is on.
  private buildOrbiter() {
    const spec = ORBITER_SPEC;
    const pivot = new THREE.Group();
    this.scene.add(pivot);
    const body = new THREE.Group();
    pivot.add(body);

    const craft = new THREE.Group();
    const alu = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.45, metalness: 0.8 });
    const white = new THREE.MeshStandardMaterial({ color: 0xe6e9ec, roughness: 0.55, metalness: 0.35 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd8a520, roughness: 0.4, metalness: 0.85, emissive: 0x201604 });
    const panelBlue = new THREE.MeshStandardMaterial({ color: 0x22477e, roughness: 0.35, metalness: 0.5, emissive: 0x0a1830, emissiveIntensity: 0.7 });

    // bus (MLI-wrapped) — pick target
    const bus = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.024, 0.024), gold);
    bus.userData.planetId = spec.id;
    craft.add(bus);
    // instrument deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.012, 0.03), alu);
    deck.position.set(0.02, 0, 0);
    craft.add(deck);
    // twin solar panels with yokes
    for (const sz of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.0012, 0.046), panelBlue);
      panel.position.set(0, 0, sz * 0.037);
      craft.add(panel);
      const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.004, 0.014), alu);
      yoke.position.set(0, 0, sz * 0.012);
      craft.add(yoke);
    }
    // high-gain dish on a mast (lathe paraboloid, opens upward)
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 8; i++) { const r = (i / 8) * 0.016; pts.push(new THREE.Vector2(r, r * r * 28)); }
    const dish = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), white);
    dish.position.set(-0.012, 0.022, 0);
    craft.add(dish);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.012, 6), alu);
    mast.position.set(-0.012, 0.014, 0);
    craft.add(mast);
    // omni antenna whip
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.0008, 0.0008, 0.03, 5), alu);
    ant.position.set(0.008, 0.024, -0.008);
    craft.add(ant);

    body.add(craft);
    this.pickMeshes.push(bus);

    // polar orbit ring — unit circle in the vertical X-Y plane, scaled live
    const ringPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 96; i++) {
      const t = (i / 96) * Math.PI * 2;
      ringPts.push(new THREE.Vector3(Math.cos(t), Math.sin(t), 0));
    }
    const ring = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(ringPts),
      new THREE.LineBasicMaterial({ color: 0xd8c9a0, transparent: true, opacity: 0.35 }),
    );
    pivot.add(ring);

    const label = this.makeLabel(spec);
    const node: PlanetNode = { spec, pivot, mesh: bus, body, angle: 0, period: 0, label, orbitRing: ring };
    this.planets.push(node);
  }

  private makeLabel(spec: PlanetSpec): HTMLElement {
    const label = document.createElement('div');
    label.className = 'p-label';
    label.textContent = this.lang === 'zh' ? spec.cn : spec.name;
    label.style.color = spec.color;
    this.labelLayer.appendChild(label);
    return label;
  }

  private buildHalley() {
    const spec = HALLEY_SPEC;
    const pivot = new THREE.Group();
    this.scene.add(pivot);
    const body = new THREE.Group();
    pivot.add(body);

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(spec.radius, 24, 18),
      new THREE.MeshStandardMaterial({ map: planetTexture('pluto'), roughness: 1 }),
    );
    mesh.userData.planetId = spec.id;
    body.add(mesh);
    this.pickMeshes.push(mesh);

    // icy coma glow
    const coma = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSprite('rgba(210,240,255,0.95)', 'rgba(140,200,255,0.35)'),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9,
    }));
    coma.scale.setScalar(2.2);
    body.add(coma);

    // tail: shader-driven soft particles (dust fan + bluer ion streamer)
    const NT = 700;
    const tGeo = new THREE.BufferGeometry();
    tGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NT * 3), 3));
    const aT = new Float32Array(NT);
    const aSeed = new Float32Array(NT);
    const aJit = new Float32Array(NT * 2);
    const aIon = new Float32Array(NT);
    for (let i = 0; i < NT; i++) {
      aT[i] = Math.pow(Math.random(), 0.8);
      aSeed[i] = Math.random();
      aJit[i * 2] = Math.random() - 0.5;
      aJit[i * 2 + 1] = Math.random() - 0.5;
      aIon[i] = i % 10 < 3 ? 1 : 0; // 30 % ion tail
    }
    tGeo.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
    tGeo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
    tGeo.setAttribute('aJit', new THREE.BufferAttribute(aJit, 2));
    tGeo.setAttribute('aIon', new THREE.BufferAttribute(aIon, 1));
    const tailMat = new THREE.ShaderMaterial({
      uniforms: {
        uDust: { value: new THREE.Color(0xd8ecff) },
        uIon: { value: new THREE.Color(0x5fa8ff) },
        uOpacity: { value: 0.6 },
      },
      vertexShader: `
        attribute float aT;
        attribute float aSeed;
        attribute float aIon;
        varying float vT;
        varying float vIon;
        varying float vSeed;
        void main() {
          vT = aT; vIon = aIon; vSeed = aSeed;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float size = mix(1.6, 5.0, aT) * (0.7 + 0.6 * aSeed);
          gl_PointSize = clamp(size * (170.0 / -mv.z), 1.0, 40.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uDust;
        uniform vec3 uIon;
        uniform float uOpacity;
        varying float vT;
        varying float vIon;
        varying float vSeed;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          float a = smoothstep(0.5, 0.04, d);
          a *= (1.0 - vT) * (0.55 + 0.45 * vSeed) * uOpacity;
          vec3 col = mix(uDust, uIon, vIon);
          gl_FragColor = vec4(col, a);
        }`,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    });
    const tail = new THREE.Points(tGeo, tailMat);
    tail.frustumCulled = false;
    this.scene.add(tail);

    // trail of recent positions — fixed-capacity buffer + drawRange (no realloc)
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(220 * 3), 3));
    trailGeo.setDrawRange(0, 0);
    const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({
      color: 0x7fc4ff, transparent: true, opacity: 0.3,
    }));
    trail.frustumCulled = false;
    this.scene.add(trail);

    const node: PlanetNode = {
      spec, pivot, mesh, body,
      angle: 0, period: Infinity,
      label: this.makeLabel(spec),
    };
    this.planets.push(node);
    this.halley = { node, tail, trail, trailPts: [], tailMat, coma };
  }

  // detailed Voyager: 3.7 m high-gain dish with feed tripod, golden MLI bus
  // with equipment bays & the Golden Record, finned RTG, 13 m magnetometer
  // boom, twin plasma-wave whips, scan platform. Dish (+Z) tracks the Sun.
  private buildVoyagerCraft(): THREE.Group {
    const g = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: 0xd8a520, roughness: 0.32, metalness: 0.9, emissive: 0x2a1e05 });
    const goldDark = new THREE.MeshStandardMaterial({ color: 0x8a6d1a, roughness: 0.45, metalness: 0.85 });
    const white = new THREE.MeshStandardMaterial({ color: 0xcfccc4, roughness: 0.72, metalness: 0.08, side: THREE.DoubleSide });
    const dark = new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.55, metalness: 0.65 });
    const rtgRed = new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.5, metalness: 0.4 });
    const record = new THREE.MeshStandardMaterial({ color: 0xffd766, roughness: 0.18, metalness: 1.0, emissive: 0x332200 });

    const strut = (a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) => {
      const d = b.clone().sub(a);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), mat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      g.add(m);
    };

    // ---- bus: decagonal body + equipment bay + top deck
    const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.38, 10), gold);
    g.add(bus);
    const bay = new THREE.Mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.1, 10), dark);
    bay.position.y = -0.24;
    g.add(bay);
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.09, 10), goldDark);
    deck.position.y = 0.235;
    g.add(deck);

    // thermal louvers / electronics boxes around the bus
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.26;
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.03), i % 2 ? dark : goldDark);
      box.position.set(Math.cos(a) * 0.33, (i % 3 - 1) * 0.09, Math.sin(a) * 0.33);
      box.lookAt(Math.cos(a) * 2, box.position.y, Math.sin(a) * 2);
      g.add(box);
    }

    // Golden Record — bright disc mounted on the bus flank
    const rec = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.015, 24), record);
    rec.rotation.z = Math.PI / 2;
    rec.position.set(0.335, 0.05, 0.06);
    rec.rotation.y = 0.2;
    g.add(rec);

    // thruster clusters under the bus rim
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const th = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 8), dark);
      th.position.set(Math.cos(a) * 0.28, -0.3, Math.sin(a) * 0.28);
      th.rotation.x = Math.PI;
      g.add(th);
    }

    // ---- high-gain dish: paraboloid + rim ring + feed tripod
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 16; i++) {
      const r = (i / 16) * 0.55;
      pts.push(new THREE.Vector2(r, 0.05 + 0.5 * r * r));
    }
    const dish = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), white);
    dish.rotation.x = Math.PI / 2;
    dish.position.set(0, 0, 0.2);
    g.add(dish);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.014, 8, 40), dark);
    rim.position.set(0, 0, 0.2 + 0.05 + 0.5 * 0.55 * 0.55);
    g.add(rim);
    // feed assembly held by three struts
    const feedPos = new THREE.Vector3(0, 0, 0.52);
    const feed = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 10), dark);
    feed.rotation.x = -Math.PI / 2;
    feed.position.copy(feedPos);
    g.add(feed);
    const subRef = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 12), white);
    subRef.rotation.x = Math.PI / 2;
    subRef.position.set(0, 0, 0.44);
    g.add(subRef);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
      strut(new THREE.Vector3(Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0.4), feedPos, 0.011, dark);
    }

    // ---- RTG boom: articulated strut + finned generator
    strut(new THREE.Vector3(-0.3, 0.12, -0.12), new THREE.Vector3(-0.95, 0.18, -0.18), 0.02, dark);
    const rtgCore = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.34, 10), rtgRed);
    rtgCore.rotation.z = Math.PI / 2;
    rtgCore.position.set(-1.14, 0.18, -0.18);
    g.add(rtgCore);
    for (let i = 0; i < 6; i++) {
      const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.014, 12), rtgRed);
      fin.rotation.z = Math.PI / 2;
      fin.position.set(-1.0 - i * 0.055, 0.18, -0.18);
      g.add(fin);
    }

    // ---- magnetometer boom: two-segment, very long, aft-pointing
    strut(new THREE.Vector3(0.28, -0.15, -0.15), new THREE.Vector3(0.85, -0.7, -0.3), 0.013, dark);
    strut(new THREE.Vector3(0.85, -0.7, -0.3), new THREE.Vector3(1.35, -1.2, -0.42), 0.009, dark);
    const magBox = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.08), dark);
    magBox.position.set(1.35, -1.2, -0.42);
    g.add(magBox);

    // ---- twin plasma-wave whip antennas (thin V pair)
    strut(new THREE.Vector3(0, -0.28, 0.05), new THREE.Vector3(0.55, -1.35, 0.35), 0.006, dark);
    strut(new THREE.Vector3(0, -0.28, 0.05), new THREE.Vector3(-0.55, -1.35, 0.35), 0.006, dark);

    // ---- scan platform: articulated arm with camera pair
    strut(new THREE.Vector3(0.15, 0.05, -0.28), new THREE.Vector3(0.4, 0.28, -0.55), 0.016, goldDark);
    const platform = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.08), dark);
    platform.position.set(0.44, 0.32, -0.6);
    platform.rotation.y = 0.5;
    g.add(platform);
    for (const off of [-0.04, 0.04]) {
      const cam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.09, 8), white);
      cam.position.set(0.44 + off, 0.38, -0.6);
      cam.rotation.x = 0.9;
      g.add(cam);
    }

    // ---- star tracker / sun sensor on the deck
    const tracker = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.09, 8), dark);
    tracker.position.set(-0.18, 0.28, 0.12);
    tracker.rotation.z = 0.5;
    g.add(tracker);

    return g;
  }

  private buildVoyager(v: VoyagerSpec) {
    const spec = VOYAGER_SPECS.find(s => s.id === v.id)!;
    const pivot = new THREE.Group();
    this.scene.add(pivot);
    const body = new THREE.Group();
    pivot.add(body);

    const craft = this.buildVoyagerCraft();
    body.add(craft);

    // placeholder for the shared spin / raycast plumbing
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.01, 4, 4),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    body.add(mesh);

    // generous invisible hit-sphere so the tiny craft is clickable
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 8, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    hit.userData.planetId = spec.id;
    body.add(hit);
    this.pickMeshes.push(hit);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSprite('rgba(255,210,140,0.9)', 'rgba(255,180,90,0.25)'),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.45,
    }));
    glow.scale.setScalar(1.1);
    body.add(glow);

    const node: PlanetNode = {
      spec, pivot, mesh, body,
      angle: 0, period: Infinity,
      label: this.makeLabel(spec),
    };
    this.planets.push(node);
    this.voyagers.push({ node, v, lastAu: -1, craft });
  }

  private makeStars(count: number, radius: number): THREE.Points {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(radius * (0.85 + Math.random() * 0.3));
      pos.set([v.x, v.y, v.z], i * 3);
      const r = Math.random();
      c.set(r < 0.62 ? 0xffffff : r < 0.82 ? 0xaaccff : 0xffddaa);
      c.multiplyScalar(0.55 + Math.random() * 0.45);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: 1.6, vertexColors: true, sizeAttenuation: false, transparent: true, opacity: this.params.starfield, depthWrite: false });
    return new THREE.Points(geo, mat);
  }

  // asteroid belt: real 3D rocks (instanced, noise-deformed icosahedra)
  // plus a faint dust layer of soft round sprites.
  // Jupiter's Trojan swarms: the Greek camp leads at L4 (+60°), the Trojan
  // camp trails at L5 (−60°). The whole group counter-rotates to Jupiter's
  // live longitude every frame (see the main loop), so the 60° geometry stays
  // honest in both clock modes. ±20° elongation matches the real libration
  // spread of the swarm; ±5% radial scatter; label anchors ride the group.
  private buildTrojans() {
    const jupSpec = PLANETS.find(pl => pl.id === 'jupiter')!;
    const R = jupSpec.distance; // 43 — Jupiter's exact display radius
    const g = new THREE.Group();
    this.scene.add(g);
    this.trojanGroup = g;
    const camps = [
      { deg: 60, en: 'GREEK CAMP · L4', cn: '希腊营 · L4', tint: 'rgba(228,202,152,0.9)' },
      { deg: -60, en: 'TROJAN CAMP · L5', cn: '特洛伊营 · L5', tint: 'rgba(204,178,138,0.9)' },
    ];
    for (const camp of camps) {
      const mk = (n: number, size: number, op: number) => {
        const arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          const along = (Math.random() + Math.random() - 1) * 20; // triangular ±20° arc
          const a = (camp.deg + along) * DEG;
          const r = R * (1 + (Math.random() * 2 - 1) * 0.05);
          arr[i * 3] = Math.cos(a) * r;
          arr[i * 3 + 1] = (Math.random() * 2 - 1) * 1.1;
          arr[i * 3 + 2] = Math.sin(a) * r;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        const pts = new THREE.Points(geo, new THREE.PointsMaterial({
          map: glowSprite(camp.tint, 'rgba(160,140,110,0.25)', 32),
          color: 0xd8c49a, size, transparent: true, opacity: op,
          sizeAttenuation: true, depthWrite: false,
        }));
        pts.frustumCulled = false;
        g.add(pts);
      };
      mk(850, 0.16, 0.7);  // fine dust of small bodies
      mk(300, 0.30, 0.5);  // brighter cores for the big ones
      const anchor = new THREE.Object3D();
      anchor.position.set(Math.cos(camp.deg * DEG) * R, 2.6, Math.sin(camp.deg * DEG) * R);
      g.add(anchor);
      const el = document.createElement('div');
      el.className = 'p-label lag-label';
      el.textContent = this.lang === 'zh' ? camp.cn : camp.en;
      el.style.color = '#d8c49a';
      this.labelLayer.appendChild(el);
      this.trojanLabels.push({ el, anchor });
    }
  }

  private makeBelt(count: number, inner: number, outer: number, opts?: { yHalf?: number; icy?: boolean }): THREE.Group {
    const group = new THREE.Group();

    // ---- rock geometry with welded, deterministically jittered vertices
    const rockGeo = new THREE.IcosahedronGeometry(1, 1);
    const rp = rockGeo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < rp.count; i++) {
      v.fromBufferAttribute(rp, i);
      const h = Math.sin(v.x * 12.9898 + v.y * 78.233 + v.z * 37.719) * 43758.5453;
      const n = 0.72 + (h - Math.floor(h)) * 0.56; // 0.72–1.28
      rp.setXYZ(i, v.x * n, v.y * (0.62 + (h - Math.floor(h)) * 0.5), v.z * n);
    }
    rockGeo.computeVertexNormals();

    const rockMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0.04 });
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, count);
    rocks.frustumCulled = false;
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = inner + Math.pow(Math.random(), 0.7) * (outer - inner);
      const y = (Math.random() - 0.5) * 2 * (opts?.yHalf ?? 0.85);
      dummy.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      const s = 0.05 + Math.pow(Math.random(), 2.6) * 0.34; // many small, few large
      dummy.scale.set(s * (0.75 + Math.random() * 0.5), s, s * (0.75 + Math.random() * 0.5));
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
      if (opts?.icy) col.setHSL(0.55 + Math.random() * 0.08, 0.10 + Math.random() * 0.12, 0.30 + Math.random() * 0.25);
      else col.setHSL(0.07 + Math.random() * 0.05, 0.08 + Math.random() * 0.16, 0.16 + Math.random() * 0.26);
      rocks.setColorAt(i, col);
    }
    rocks.instanceMatrix.needsUpdate = true;
    if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
    group.add(rocks);

    // ---- soft dust haze (round sprites, not square points)
    const dustN = 1400;
    const dustPos = new Float32Array(dustN * 3);
    for (let i = 0; i < dustN; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = inner - 0.6 + Math.pow(Math.random(), 0.8) * (outer - inner + 1.0);
      dustPos.set([Math.cos(a) * r, (Math.random() - 0.5) * 1.2, Math.sin(a) * r], i * 3);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      map: glowSprite('rgba(190,170,140,0.55)', 'rgba(150,130,105,0.18)', 64),
      color: 0xbbaa90, size: 0.55, transparent: true, opacity: 0.4,
      sizeAttenuation: true, depthWrite: false,
    }));
    dust.frustumCulled = false;
    group.add(dust);

    return group;
  }

  // per-planet material — real maps when available, procedural fallback
  private makePlanetMaterial(spec: PlanetSpec): THREE.Material {
    const real = this.tex[spec.id] ?? null;
    if (spec.id === 'earth' && this.tex.earth) {
      return new THREE.MeshPhongMaterial({
        map: this.tex.earth,
        normalMap: this.tex.earthNormal ?? undefined,
        specularMap: this.tex.earthSpecular ?? undefined,
        specular: new THREE.Color(0x3a3a3a),
        shininess: 16,
        emissiveMap: this.tex.earthNight ?? undefined,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.85,
      });
    }
    const rocky = spec.id === 'mercury' || spec.id === 'mars' || spec.id === 'pluto';
    const mat = new THREE.MeshStandardMaterial({
      map: real ?? planetTexture(spec.tex),
      roughness: 0.95, metalness: 0.02,
    });
    if (real && rocky) { mat.bumpMap = real; mat.bumpScale = 0.25; }
    return mat;
  }

  // Fresnel rim-glow shell
  private makeAtmosphere(radius: number, color: number, k: number): THREE.Mesh {
    return new THREE.Mesh(
      new THREE.SphereGeometry(radius, 48, 36),
      new THREE.ShaderMaterial({
        uniforms: { c: { value: new THREE.Color(color) }, kk: { value: k } },
        vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform vec3 c; uniform float kk; varying vec3 vN; void main(){ float i = pow(kk - dot(vN, vec3(0.0, 0.0, 1.0)), 2.0); gl_FragColor = vec4(c, 1.0) * i; }',
        side: THREE.BackSide, blending: THREE.AdditiveBlending,
        transparent: true, depthWrite: false,
      }),
    );
  }

  private makePlanet(spec: PlanetSpec): PlanetNode {
    const pivot = new THREE.Group();
    pivot.rotation.x = spec.inclination * DEG; // orbital inclination
    this.scene.add(pivot);

    const body = new THREE.Group();
    body.rotation.z = spec.tiltDeg * DEG;
    body.position.set(spec.distance, 0, 0);

    const geo = new THREE.SphereGeometry(spec.radius, 64, 48);
    const mat = this.makePlanetMaterial(spec);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.planetId = spec.id;
    body.add(mesh);
    pivot.add(body);
    this.pickMeshes.push(mesh);

    // earth cloud layer — rotates slightly faster than the surface
    if (spec.id === 'earth' && this.tex.earthClouds) {
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(spec.radius * 1.018, 48, 36),
        new THREE.MeshLambertMaterial({
          alphaMap: this.tex.earthClouds, transparent: true,
          depthWrite: false, opacity: 0.85,
        }),
      );
      body.add(clouds);
      this.earthClouds = clouds;
    }

    // atmosphere rim glow
    const atmo = ATMO[spec.id];
    let atmoMesh: THREE.Mesh | undefined;
    if (atmo) {
      atmoMesh = this.makeAtmosphere(spec.radius * atmo.scale, atmo.color, atmo.k);
      body.add(atmoMesh);
    }

    // rings
    let ring: THREE.Mesh | undefined;
    if (spec.ring) {
      const rGeo = new THREE.RingGeometry(spec.radius * spec.ring.inner, spec.radius * spec.ring.outer, 96, 1);
      // radial UVs for the strip texture
      const uv = rGeo.attributes.uv;
      const posA = rGeo.attributes.position;
      const inner = spec.radius * spec.ring.inner, outerR = spec.radius * spec.ring.outer;
      for (let i = 0; i < uv.count; i++) {
        const x = posA.getX(i), y = posA.getY(i);
        const r = Math.sqrt(x * x + y * y);
        uv.setXY(i, (r - inner) / (outerR - inner), 0.5);
      }
      const useReal = spec.id === 'saturn' && this.tex.saturnRing;
      const ringMap = useReal ? this.tex.saturnRing! : ringTexture();
      const rMat = new THREE.MeshBasicMaterial({
        map: ringMap, side: THREE.DoubleSide, transparent: true,
        opacity: spec.ring.opacity, depthWrite: false,
      });
      if (useReal) rMat.alphaMap = ringMap; // luminance gaps → transparent
      else rMat.color.set(spec.ring.color);
      ring = new THREE.Mesh(rGeo, rMat);
      ring.rotation.x = -Math.PI / 2;
      body.add(ring);
    }

    // orbit line
    const seg = 160;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * spec.distance, 0, Math.sin(a) * spec.distance));
    }
    const lGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const lMat = new THREE.LineBasicMaterial({ color: spec.color, transparent: true, opacity: this.params.orbitOpacity });
    const line = new THREE.LineLoop(lGeo, lMat);
    pivot.add(line);
    this.orbitLines.push(line);

    // label
    const label = document.createElement('div');
    label.className = 'p-label';
    label.textContent = this.lang === 'zh' ? spec.cn : spec.name;
    label.style.color = spec.color;
    this.labelLayer.appendChild(label);

    return {
      spec, pivot, mesh, body, ring, atmo: atmoMesh, label,
      angle: Math.random() * Math.PI * 2,
      period: keplerPeriod(spec.distance),
    };
  }

  // ------------------------------------------------------------- input
  private bindPointer() {
    this.canvas.addEventListener('pointerdown', (e) => {
      this.downPos = { x: e.clientX, y: e.clientY };
      if (this.probe && this.probe.phase === 'aim' && e.button === 0) {
        this.probe.aiming = true;
        this.probe.aimStart = { x: e.clientX, y: e.clientY };
        this.probe.aimKms = 0;
      }
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.probe?.aiming) this.updateAim(e.clientX, e.clientY);
    });
    this.canvas.addEventListener('pointerup', (e) => {
      if (this.probe?.aiming) {
        this.probe.aiming = false;
        this.launchProbe();
        return;
      }
      const dx = e.clientX - this.downPos.x, dy = e.clientY - this.downPos.y;
      if (dx * dx + dy * dy > 36) return; // drag, not click
      this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.pickMeshes, false);
      if (hits.length > 0) {
        const id = hits[0].object.userData.planetId as string;
        const node = this.planets.find(p => p.spec.id === id);
        if (node) this.focusPlanet(node);
      }
    });
    this.canvas.addEventListener('dblclick', (e) => {
      this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.pickMeshes, false);
      if (hits.length > 0) {
        const id = hits[0].object.userData.planetId as string;
        const node = this.planets.find(p => p.spec.id === id);
        if (node) this.enterGlobeView(node);
      }
    });
  }

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer?.setSize(window.innerWidth, window.innerHeight);
  };

  // ------------------------------------------------------------- public API
  setBloom(on: boolean, manual = false) {
    this.bloomOn = on;
    if (manual) this.bloomAuto = true; // user re-enabled → re-arm auto-degrade
    this.emitSnapshot();
  }

  toggleBloom() {
    this.setBloom(!this.bloomOn, true);
    this.toast(this.bloomOn ? STR[this.lang].toast.bloomOn : STR[this.lang].toast.bloomOff);
  }

  setLang(lang: Lang) {
    this.lang = lang;
    for (const p of this.planets) {
      if (p.label) p.label.textContent = lang === 'zh' ? p.spec.cn : p.spec.name;
    }
    if (this.helioLabel) this.helioLabel.textContent = lang === 'zh' ? '日球层顶 · ~121 AU' : 'HELIOPAUSE · ~121 AU';
    for (const L of this.lmLabels) L.el.textContent = lang === 'zh' ? L.lm.nameCn : L.lm.name;
    for (const L of this.galaxyLabels) L.el.textContent = lang === 'zh' ? L.nameCn : L.name;
    this.voyagers.forEach(r => { r.lastAu = -1; }); // force live-range refresh
    this.emitSnapshot();
  }

  private planetName(node: PlanetNode): string {
    return this.lang === 'zh' ? node.spec.cn : node.spec.name;
  }

  toggleCine() {
    if (this.gxTrans) return;
    if (!this.cine && this.galaxy) this.exitGalaxyView(true);
    this.setCine(!this.cine);
  }

  private setCine(on: boolean) {
    this.cine = on;
    this.controls.enabled = !on;
    if (on) {
      if (this.surface) this.exitSurfaceView(true);
      this.tween = null;
      this.cineShot = 0;
      this.cineTime = 0;
      this.cineAz = CINE_SHOTS[0].azimuth;
      this.cineTarget.copy(this.controls.target);
      this.toast(STR[this.lang].toast.cineOn);
    } else {
      this.toast(STR[this.lang].toast.cineOff);
    }
    this.emitSnapshot();
  }

  setView(i: number) {
    const v = VIEWS[i];
    if (!v || this.gxTrans) return;
    if (v.galaxy) { this.enterGalaxyView(); return; }
    if (this.galaxy) this.exitGalaxyView(true);
    this.setCine(false);
    if (this.surface) this.exitSurfaceView(true);
    this.focus = null;
    const tgt = new THREE.Vector3(0, 0, 0);
    const pos = new THREE.Vector3(
      Math.cos(v.elevation * DEG) * Math.cos(v.azimuth * DEG),
      Math.sin(v.elevation * DEG),
      Math.cos(v.elevation * DEG) * Math.sin(v.azimuth * DEG),
    ).multiplyScalar(v.distance);
    this.startTween(pos, tgt, 2.2);
    const name = this.lang === 'zh' ? v.nameCn : v.name;
    this.toast(STR[this.lang].toast.vectorLock + name);
    this.emitSnapshot(name);
  }

  toggleOrbit() {
    this.orbit = !this.orbit;
    this.toast(this.orbit ? STR[this.lang].toast.orbitOn : STR[this.lang].toast.orbitOff);
    this.emitSnapshot();
  }

  toggleLabels() {
    this.labelsOn = !this.labelsOn;
    this.labelLayer.style.display = this.labelsOn ? '' : 'none';
    this.toast(this.labelsOn ? STR[this.lang].toast.labelsOn : STR[this.lang].toast.labelsOff);
    this.emitSnapshot();
  }

  toggleSound(): boolean {
    const on = this.ambience.toggle();
    this.toast(on ? STR[this.lang].toast.soundOn : STR[this.lang].toast.soundOff);
    this.emitSnapshot();
    return on;
  }

  toggleEphemeris() {
    this.ephemOn = !this.ephemOn;
    this.toast(this.ephemOn ? STR[this.lang].toast.ephemOn : STR[this.lang].toast.ephemOff);
    this.emitSnapshot();
  }

  focusPlanet(node: PlanetNode) {
    if (node.spec.id in MOON_SYS) this.ensureMoonSystem(node.spec.id as MoonHost);
    this.setCine(false);
    this.probeFollow = false;
    if (this.surface) this.exitSurfaceView(true);
    this.focus = node;
    this.tween = null;
    this.focusSettle = true;
    this.toast(STR[this.lang].toast.acquiring + this.planetName(node));
    this.emitSnapshot();
  }

  clearFocus() {
    this.probeFollow = false;
    if (!this.focus) return;
    this.focus = null;
    const back = this.controls.target.clone().add(this.camera.position.clone().sub(this.controls.target).normalize().multiplyScalar(60));
    this.startTween(back, new THREE.Vector3(0, 0, 0), 1.8);
    this.toast(STR[this.lang].toast.released);
    this.emitSnapshot();
  }

  setParam(key: keyof SolarEngine['params'], value: number) {
    this.params[key] = value;
    if (key === 'orbitOpacity') {
      this.orbitLines.forEach(l => (l.material as THREE.LineBasicMaterial).opacity = value);
    }
    if (key === 'starfield') {
      (this.stars.material as THREE.PointsMaterial).opacity = value;
    }
    if (key === 'planetScale') {
      this.planets.forEach(p => { p.body.scale.setScalar(value); });
    }
    this.emitSnapshot();
  }

  resetParams() {
    this.params = { speed: 1, orbitOpacity: 0.55, planetScale: 1, starfield: 0.9 };
    this.setParam('orbitOpacity', 0.55);
    this.setParam('starfield', 0.9);
    this.setParam('planetScale', 1);
    this.setParam('speed', 1);
    this.toast(STR[this.lang].toast.reset);
  }

  // ------------------------------------------------------------- time controls
  setTimeScale(mult: number) {
    if (mult !== 0) this.prevSpeed = mult;
    this.setParam('speed', mult);
  }

  togglePause(): boolean {
    const paused = this.params.speed !== 0;
    this.setTimeScale(paused ? 0 : (this.prevSpeed || 1));
    return paused;
  }

  // Jump the simulation clock to an absolute date (UTC).
  jumpToDate(d: Date) {
    if (this.gxTrans) return;
    if (this.globe) this.exitGlobeView(true);
    if (this.galaxy) this.exitGalaxyView(true);
    this.simDays = (d.getTime() - BASE_DATE) / 86400000;
    if (this.experiment) this.resetExperiment(true); // integrated state can't time-jump
    this.eventCache = null;
    this.lastEventJd = null;
    this.resetHalleyTrail();
    this.emitSnapshot();
  }

  // Scrub relative to the current sim day (timeline dragging).
  scrubToDay(day: number) {
    if (this.gxTrans) return;
    if (this.globe) this.exitGlobeView(true);
    if (this.galaxy) this.exitGalaxyView(true);
    this.simDays = day;
    if (this.experiment) this.resetExperiment(true);
    this.eventCache = null;
    this.lastEventJd = null;
    this.resetHalleyTrail();
    this.emitSnapshot();
  }

  private resetHalleyTrail() {
    if (!this.halley) return;
    this.halley.trailPts.length = 0;
    this.halley.trail.geometry.setDrawRange(0, 0);
  }

  // Upcoming sky events, cached per quarter-day so the UI can poll cheaply.
  getUpcomingEvents(count = 8): AstroEvent[] {
    const jd = BASE_JD + this.simDays;
    const key = Math.floor(this.simDays * 4);
    if (!this.eventCache || this.eventCache.fromDay !== key) {
      this.eventCache = { fromDay: key, events: listUpcoming(jd, count) };
    }
    return this.eventCache.events;
  }

  // Jump the clock to the next event; returns it so the UI can announce it.
  jumpToNextEvent(): AstroEvent | null {
    const ev = this.getUpcomingEvents(1)[0];
    if (!ev) return null;
    this.jumpToDate(new Date((ev.jd - 2440587.5) * 86400000));
    return ev;
  }

  // Prediction game — solve the real date of the chosen event from *now*.
  solvePrediction(type: EventType, a: string, b: string): number | null {
    return solveEvent(type, a, b, BASE_JD + this.simDays);
  }

  // ------------------------------------------------------------- surface view
  isSurfaceView(): boolean { return this.surface !== null; }

  // stand on a planet's surface and look at the sky
  enterSurfaceView(node?: PlanetNode) {
    if (this.gxTrans) return;
    if (this.surface) this.exitSurfaceView(true);
    if (this.globe) this.exitGlobeView(true);
    if (this.galaxy) this.exitGalaxyView(true);
    const target = node ?? this.focus ?? this.planets.find(p => p.spec.id === 'earth');
    if (!target) return;
    this.setCine(false);
    this.tween = null;
    this.probeFollow = false;
    this.surface = {
      node: target,
      savedCam: this.camera.position.clone(),
      savedTarget: this.controls.target.clone(),
      savedMin: this.controls.minDistance,
      savedMax: this.controls.maxDistance,
      savedNear: this.camera.near,
      firstTick: true,
    };
    this.controls.minDistance = 0.02;
    this.controls.maxDistance = 0.6;
    // the ground is centimeters away — the default near plane would clip it
    this.camera.near = 0.002;
    this.camera.updateProjectionMatrix();
    // orbit rings & the host's own shell look wrong from the ground — hide them
    this.orbitLines.forEach(l => (l.visible = false));
    if (target.atmo) target.atmo.visible = false;
    if (target.ring) target.ring.visible = false;
    if (target.orbitRing) target.orbitRing.visible = false;
    if (target.spec.id === 'earth' && this.earthClouds) this.earthClouds.visible = false;
    this.toast(STR[this.lang].toast.surfaceOn + this.planetName(target));
    this.emitSnapshot();
  }

  exitSurfaceView(silent = false) {
    const s = this.surface;
    if (!s) return;
    this.surface = null;
    this.controls.minDistance = s.savedMin;
    this.controls.maxDistance = s.savedMax;
    this.camera.near = s.savedNear;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(s.savedCam);
    this.controls.target.copy(s.savedTarget);
    this.orbitLines.forEach(l => (l.visible = true));
    if (s.node.atmo) s.node.atmo.visible = true;
    if (s.node.ring) s.node.ring.visible = true;
    if (s.node.orbitRing) s.node.orbitRing.visible = true;
    if (s.node.spec.id === 'earth' && this.earthClouds) this.earthClouds.visible = true;
    if (!silent) this.toast(STR[this.lang].toast.surfaceOff);
    this.emitSnapshot();
  }

  private updateSurface() {
    const s = this.surface!;
    const center = s.node.body.getWorldPosition(new THREE.Vector3());
    const visR = Math.max(s.node.spec.radius * this.params.planetScale, 0.05);
    // landing site: sun sits ~25° above the horizon
    const toSun = center.clone().negate().normalize();
    const perp = new THREE.Vector3(0, 1, 0).cross(toSun);
    if (perp.lengthSq() < 1e-6) perp.set(1, 0, 0);
    perp.normalize();
    const up = toSun.clone().multiplyScalar(0.42).addScaledVector(perp, 0.91).normalize();
    const camPos = center.clone().addScaledVector(up, visR * 1.02 + 0.01);

    // keep the user's current look direction while glued to the site;
    // on entry, face the Sun above the horizon.
    // NOTE: camera.up stays world-up — OrbitControls caches its up-basis at
    // construction, and our sites are near the ecliptic so the horizon is
    // already level.
    const look = this.controls.target.clone().sub(this.camera.position);
    if (s.firstTick || look.lengthSq() < 1e-8) {
      look.copy(toSun).addScaledVector(up, -toSun.dot(up)).normalize(); // horizontal, toward the Sun
      s.firstTick = false;
    } else {
      look.normalize();
    }
    this.camera.position.copy(camPos);
    this.controls.target.copy(camPos).addScaledVector(look, 0.3);
  }

  // real angular diameter of the Sun seen from a body (degrees)
  sunAngularDeg(id: string): number | null {
    const au = DIST_AU[id];
    if (!au) return null;
    return 2 * Math.atan(695700 / (au * 1.496e8)) * 180 / Math.PI;
  }

  // ------------------------------------------------------------- expert mode & event log
  onLog: ((entries: LogEntry[]) => void) | null = null;

  setExpert(on: boolean) {
    this.expert = on;
    this.emitSnapshot();
  }

  private eventDesc(ev: AstroEvent): string {
    if (ev.info) return this.lang === 'zh' ? (ev.infoCn ?? ev.info) : ev.info;
    const t = STR[this.lang];
    const name = (id: string) => {
      if (id === 'sun') return t.sun;
      const node = this.planets.find(p => p.spec.id === id);
      return node ? this.planetName(node) : id;
    };
    const tpl = ev.type === 'opposition' ? t.evOpposition
      : ev.type === 'conjunction' ? t.evConjunction : t.evPerihelion;
    return tpl.replace('{a}', name(ev.a)).replace('{b}', name(ev.b));
  }

  private fmtJdShort(jd: number): string {
    const d = new Date((jd - 2440587.5) * 86400000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }

  private pushLog(jd: number, text: string) {
    this.eventLog.push({ jd, text });
    if (this.eventLog.length > 60) this.eventLog.shift();
    this.emitLog();
  }

  private emitLog() {
    if (!this.onLog) return;
    const out = this.eventLog.slice(-30).reverse()
      .map(e => ({ date: this.fmtJdShort(e.jd), text: e.text }));
    this.onLog(out);
  }

  // watch for sky events crossed by the simulation clock
  private watchEvents(jd: number) {
    if (this.lastEventJd === null) { this.lastEventJd = jd; return; }
    if (jd - this.lastEventJd > 0.5) {
      const crossed = listUpcoming(this.lastEventJd + 0.001, 40).filter(e => e.jd <= jd);
      for (const e of crossed) this.pushLog(e.jd, this.eventDesc(e));
      this.lastEventJd = jd;
    } else if (jd < this.lastEventJd - 0.5) {
      this.lastEventJd = jd; // clock rewound — resync silently
    }
  }

  // ------------------------------------------------------------- batch 3
  // ------------------------------------------------------------- galaxy view
  // Milky Way mode: hide the solar system entirely and hand over a procedural
  // particle galaxy (1 unit = 1,000 ly). Intro glide, sun marker with a
  // click-to-return easter egg, POI labels, frozen sim time.
  private gauss(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  private buildGalaxy() {
    const g = new THREE.Group();
    g.visible = false;
    this.scene.add(g);
    this.galaxyGroup = g;

    const ARMS = 4, R_MAX = 50, WIND = 1.7, BAR_ANG = 0.44;
    const glowTex = glowSprite('rgba(255,255,255,1)', 'rgba(255,255,255,0.25)');

    // barred-spiral geometry: the primary arm pair streams off the bar ends,
    // the secondary pair fills the other quadrants at 80% brightness
    const armSample = (tight: number): number[] => {
      const arm = Math.floor(Math.random() * ARMS);
      const main = arm % 2 === 0;
      const t = Math.pow(Math.random(), 0.6);
      const r0 = main ? 8.5 : 5.5;
      const r = r0 + t * (R_MAX - r0);
      const ang = BAR_ANG + (arm / ARMS) * Math.PI * 2 + Math.log(r / 4) * WIND + (Math.random() - 0.5) * 0.3 * tight;
      const sp = (1.1 + t * 2.2) * tight;
      return [
        Math.cos(ang) * r + this.gauss() * sp * 0.55,
        (Math.random() - 0.5) * (1.4 - t * 0.8),
        Math.sin(ang) * r + this.gauss() * sp * 0.55,
        t,
        main ? 1 : 0.8, // primary vs secondary arm brightness
      ];
    };
    const bulgeSample = (): number[] => {
      const rr = Math.abs(this.gauss()) * 2.3;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1);
      return [rr * Math.sin(ph) * Math.cos(th), rr * Math.cos(ph), rr * Math.sin(ph) * Math.sin(th), 0];
    };
    const barSample = (): number[] => {
      const bx = Math.max(-15, Math.min(15, this.gauss() * 5)); // short & chunky, ~1/3 of the disk
      const bz = this.gauss() * 1.6;
      return [bx * Math.cos(BAR_ANG) - bz * Math.sin(BAR_ANG), this.gauss() * 0.7, bx * Math.sin(BAR_ANG) + bz * Math.cos(BAR_ANG), 0];
    };
    const haloSample = (): number[] => {
      const rr = 18 + Math.random() * 36;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1);
      return [rr * Math.sin(ph) * Math.cos(th), rr * Math.cos(ph), rr * Math.sin(ph) * Math.sin(th), 0];
    };

    // one draw call per layer — points clouds with per-point colors
    // (a sampler's optional 5th return value dims that point — used for secondary arms)
    const cloud = (
      count: number, size: number, opacity: number,
      sampler: () => number[],
      colorize: () => [number, number, number],
      opts?: { blending?: THREE.Blending; renderOrder?: number; win?: [number, number]; radial?: boolean },
    ) => {
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      const dist = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const smp = sampler();
        const dim = smp.length > 4 ? smp[4] : 1;
        pos[i * 3] = smp[0]; pos[i * 3 + 1] = smp[1]; pos[i * 3 + 2] = smp[2];
        dist[i] = Math.min(1, Math.hypot(smp[0], smp[1], smp[2]) / 60); // anchor distance, normalized
        const [cr, cg, cb] = colorize();
        col[i * 3] = cr * dim; col[i * 3 + 1] = cg * dim; col[i * 3 + 2] = cb * dim;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({
        size, vertexColors: true, transparent: true, opacity, depthWrite: false,
        map: glowTex, blending: opts?.blending ?? THREE.AdditiveBlending, sizeAttenuation: true, toneMapped: false,
      });
      let u: { value: number } | null = null;
      if (opts?.win && opts?.radial !== false) {
        // radial reveal wavefront: the layer blooms outward from the anchor point
        geo.setAttribute('aDist', new THREE.BufferAttribute(dist, 1));
        u = { value: 1 };
        const uu = u;
        mat.onBeforeCompile = (sh) => {
          sh.uniforms.uReveal = uu;
          sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nattribute float aDist; varying float vDist;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDist = aDist;');
          sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform float uReveal; varying float vDist;')
            .replace('#include <color_fragment>', '#include <color_fragment>\n{ float rw = clamp((uReveal - vDist * 0.5) / 0.2, 0.0, 1.0); diffuseColor.a *= rw * rw * (3.0 - 2.0 * rw); }');
        };
        this.gxLayers.push({ mat, base: opacity, win: opts.win, u });
      } else if (opts?.win) {
        // flat fade only — fog layers must never clump into a central blob
        this.gxLayers.push({ mat, base: opacity, win: opts.win, u: null });
      }
      const pts = new THREE.Points(geo, mat);
      if (opts?.renderOrder) pts.renderOrder = opts.renderOrder;
      g.add(pts);
    };

    // 1) halo veil + globular clusters — a faint cool cradle around the disk
    const haloGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSprite('rgba(150,175,225,0.5)', 'rgba(90,120,180,0.12)'),
      transparent: true, opacity: 0.16, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    haloGlow.scale.setScalar(170);
    g.add(haloGlow);
    this.gxLayers.push({ mat: haloGlow.material as THREE.SpriteMaterial, base: 0.16, win: [0.90, 1.0], u: null });
    cloud(70, 1.5, 0.9, () => {
      const rr = 26 + Math.random() * 42;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1);
      return [rr * Math.sin(ph) * Math.cos(th), rr * Math.cos(ph), rr * Math.sin(ph) * Math.sin(th), 0];
    }, () => {
      const b = 0.85 + Math.random() * 0.5;
      return [b, b * 0.95, b * 0.85];
    }, { win: [0.48, 0.66] });

    // 2) disk base fog — fills the inter-arm voids so the galaxy reads as one body
    cloud(520, 11, 0.045, () => {
      const t = Math.sqrt(Math.random());
      const r = 3 + t * R_MAX;
      const a = Math.random() * Math.PI * 2;
      return [Math.cos(a) * r, (Math.random() - 0.5) * 1.6, Math.sin(a) * r, t];
    }, () => [0.55, 0.64, 0.85], { win: [0.78, 0.97], radial: false });

    // 3) dust lanes — subtle dark veils, inner two rings only (rendered last, normal blending)
    cloud(170, 3.6, 0.3, () => {
      const arm = Math.floor(Math.random() * ARMS);
      const t = Math.random() * 0.3;
      const r0 = arm % 2 === 0 ? 8.5 : 5.5;
      const r = r0 + t * (R_MAX - r0);
      const ang = BAR_ANG + (arm / ARMS) * Math.PI * 2 + Math.log(r / 4) * WIND - 0.14 + (Math.random() - 0.5) * 0.08;
      return [Math.cos(ang) * r, (Math.random() - 0.5) * 0.9, Math.sin(ang) * r, t];
    }, () => [0.02, 0.025, 0.045], { blending: THREE.NormalBlending, renderOrder: 10, win: [0.60, 0.78], radial: false });

    // 4) milky nebula veils (thickened) — continuous fog volume along the arms
    cloud(420, 11, 0.07, () => armSample(1.35), () => [0.6, 0.7, 0.92], { win: [0.70, 0.92], radial: false });
    cloud(720, 6.0, 0.1, () => armSample(1.0), () => [0.66, 0.76, 0.95], { win: [0.73, 0.94], radial: false });
    cloud(950, 3.0, 0.115, () => armSample(0.62), () => [0.72, 0.8, 0.98], { win: [0.76, 0.96], radial: false });

    // 5) ridge star band — dense bright pinpoints that keep the arms sharp
    cloud(9000, 0.5, 1.0, () => armSample(0.2), () => {
      const b = 0.9 + Math.random() * 0.5;
      return [0.85 * b, 0.92 * b, b];
    }, { win: [0.46, 0.70] });

    // 6) discrete star backdrop across all populations
    cloud(35000, 0.34, 0.9, () => {
      const pick = Math.random();
      if (pick < 0.62) return armSample(1);
      if (pick < 0.85) return bulgeSample();
      return haloSample();
    }, () => {
      const b = 0.75 + Math.random() * 0.45;
      return Math.random() < 0.75 ? [0.75 * b, 0.85 * b, b] : [b, 0.85 * b, 0.66 * b];
    }, { win: [0.44, 0.68] });

    // 7) central bar (short & chunky) + warm bulge haze
    cloud(300, 5.5, 0.13, () => barSample(), () => [1.0, 0.85, 0.6], { win: [0.52, 0.72] });
    cloud(140, 4.2, 0.12, () => bulgeSample(), () => [1.0, 0.87, 0.65], { win: [0.54, 0.74] });

    // 8) pink H II star-forming knots — clustered along the outer arm edges
    const hiiCenters: Array<[number, number, number]> = [];
    for (let i = 0; i < 280; i++) {
      const smp = armSample(0.12);
      hiiCenters.push([smp[0] * 1.06, smp[1], smp[2] * 1.06]);
    }
    cloud(1400, 0.85, 0.6, () => {
      const c = hiiCenters[(Math.random() * hiiCenters.length) | 0];
      return [c[0] + this.gauss() * 0.5, c[1] + this.gauss() * 0.2, c[2] + this.gauss() * 0.5, 0];
    }, () => [1.0, 0.4 + Math.random() * 0.18, 0.6], { win: [0.66, 0.84] });

    // 5) luminous galactic core — stacked golden glows
    const coreTex = glowSprite('rgba(255,238,200,1)', 'rgba(255,180,90,0.35)');
    for (const [sc, op] of [[8, 0.9], [17, 0.55], [34, 0.28]] as Array<[number, number]>) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: coreTex, transparent: true, opacity: op,
        depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      }));
      sp.scale.setScalar(sc);
      g.add(sp);
      this.gxLayers.push({ mat: sp.material as THREE.SpriteMaterial, base: op, win: [0.74, 0.92], u: null });
    }

    // markers + labels
    const marker = (p: [number, number, number], color: string, scale: number, win?: [number, number]) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowSprite(color, 'rgba(0,0,0,0)'),
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
      }));
      sp.position.set(p[0], p[1], p[2]);
      sp.scale.setScalar(scale);
      g.add(sp);
      if (win) this.gxLayers.push({ mat: sp.material as THREE.SpriteMaterial, base: 1, win, u: null });
      return sp;
    };
    const addLabel = (obj: THREE.Object3D, name: string, nameCn: string, extra?: Partial<{ poi: GalaxyPoi; isSun: boolean }>) => {
      const el = document.createElement('div');
      el.className = 'p-label gx-label' + (extra ? ' clickable' : '');
      el.textContent = this.lang === 'zh' ? nameCn : name;
      el.style.opacity = '0';
      if (extra?.isSun) el.addEventListener('click', () => this.returnToSolarSystem(true));
      else if (extra?.poi) el.addEventListener('click', () => {
        const poi = extra.poi!;
        if (poi.focusDist) this.focusGalaxyPoi(poi);
        else this.toast(this.lang === 'zh' ? poi.descCn : poi.desc);
      });
      this.labelLayer.appendChild(el);
      this.galaxyLabels.push({ el, obj, name, nameCn, poi: extra?.poi, isSun: extra?.isSun });
    };

    // the Sun — clickable, rides home
    this.galaxySun = marker(GALAXY_SUN_POS, 'rgba(127,220,255,1)', 3.2, [0.62, 0.78]);
    addLabel(this.galaxySun, GALAXY_SUN_LABEL.name, GALAXY_SUN_LABEL.nameCn, { isSun: true });

    // the Oort cloud — the true outer boundary of the solar system, a
    // whisper-thin shell around the Sun marker (0.03–1.6 light-years real)
    {
      const N = 2600, R = 1.7;
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
        const rr = R * (0.8 + Math.random() * 0.4);
        const sq = Math.sqrt(1 - u * u);
        pos[i * 3] = GALAXY_SUN_POS[0] + rr * sq * Math.cos(a);
        pos[i * 3 + 1] = GALAXY_SUN_POS[1] + rr * u;
        pos[i * 3 + 2] = GALAXY_SUN_POS[2] + rr * sq * Math.sin(a);
      }
      const og = new THREE.BufferGeometry();
      og.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const om = new THREE.PointsMaterial({
        color: 0x9fd8ff, size: 0.045, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      g.add(new THREE.Points(og, om));
      this.gxLayers.push({ mat: om, base: 0.55, win: [0.68, 0.84], u: null });
      const anchor = new THREE.Object3D();
      anchor.position.set(GALAXY_SUN_POS[0], GALAXY_SUN_POS[1] + 4.2, GALAXY_SUN_POS[2]);
      g.add(anchor);
      addLabel(anchor, 'OORT CLOUD · 0.03–1.6 LY', '奥尔特云 · 0.03–1.6 光年');
    }

    // ---- companion galaxies & merger relics (方案三) -----------------------
    // Scene scale is honest: 1 unit = 1,000 ly, so everything below sits at
    // its TRUE galactocentric position (converted from real l/b/distance).
    const companionCloud = (
      count: number, center: [number, number, number], size: number, opacity: number,
      sampler: () => [number, number, number],
      rgb: [number, number, number] | ((x: number, y: number, z: number) => [number, number, number]),
      win: [number, number],
      pulse?: { amp: number; speed: number },
    ) => {
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const [x, y, z] = sampler();
        const px = center[0] + x, py = center[1] + y, pz = center[2] + z;
        pos[i * 3] = px; pos[i * 3 + 1] = py; pos[i * 3 + 2] = pz;
        const c = typeof rgb === 'function' ? rgb(px, py, pz) : rgb;
        const v = 0.72 + Math.random() * 0.28; // per-star brightness jitter
        col[i * 3] = c[0] * v; col[i * 3 + 1] = c[1] * v; col[i * 3 + 2] = c[2] * v;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({
        size, vertexColors: true, transparent: true, opacity: 0, depthWrite: false,
        map: glowTex, blending: THREE.AdditiveBlending, sizeAttenuation: true, toneMapped: false,
      });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      g.add(pts);
      this.gxLayers.push({ mat, base: opacity, win, u: null });
      if (pulse) this.gxPulse.push({ mat, base: opacity, amp: pulse.amp, speed: pulse.speed, phase: Math.random() * Math.PI * 2 });
      return pts;
    };
    const poi3 = (cx: number, cy: number, cz: number, name: string, nameCn: string, desc: string, descCn: string, focusDist?: number, focusAt?: [number, number, number]) => {
      const anchor = new THREE.Object3D();
      anchor.position.set(cx, cy, cz);
      g.add(anchor);
      addLabel(anchor, name, nameCn, { poi: { id: name, name, nameCn, pos: [cx, cy, cz], desc, descCn, color: 'rgba(255,220,170,1)', focusDist, focusAt } });
    };

    // soft glow anchors so the clouds read from the default face-on view
    {
      const glowAt = (c: [number, number, number], scale: number, rgba: string, base: number) => {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTex, color: new THREE.Color(rgba), transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        sp.position.set(c[0], c[1], c[2]);
        sp.scale.setScalar(scale);
        g.add(sp);
        this.gxLayers.push({ mat: sp.material as THREE.SpriteMaterial, base, win: [0.72, 0.88], u: null });
        this.gxGlowDim.push({ mat: sp.material as THREE.SpriteMaterial, pos: new THREE.Vector3(c[0], c[1], c[2]), base });
      };
      glowAt([79.9, -88.0, 108.3], 20, 'rgba(255,236,190,1)', 0.42);
      glowAt([113.4, -139.2, 65.3], 15, 'rgba(255,225,180,1)', 0.36);
    }

    // ── LMC — layered build: halo / bar+clumpy disk / dense core / 30 Doradus ──
    // (irregular dwarf: a bright central BAR, no spiral arms — that shape IS the astronomy)
    const LMC: [number, number, number] = [79.9, -88.0, 108.3];
    // halo — sparse old blue-white stars reaching far beyond the visible disk
    companionCloud(1800, LMC, 0.62, 0.38, () =>
      [this.gauss() * 6.5, this.gauss() * 3.2, this.gauss() * 6.5], [0.70, 0.80, 1.0], [0.72, 0.88]);
    // (halo layer opacity lifted to keep the cloud readable from far side views)
    // bar + clumpy disk — the main body
    companionCloud(5600, LMC, 0.34, 0.85, () => {
      if (Math.random() < 0.55) {
        // the LMC bar, tilted ~20° off the galactic plane
        const t = this.gauss() * 5.5;
        const tilt = 0.35;
        return [t, this.gauss() * 1.1 + t * Math.sin(tilt) * 0.35, this.gauss() * 1.4];
      }
      // clumpy disk: several offset knots (giant HII regions)
      const knots = [[3.5, 1.5, 0], [-3, -1, 1.5], [0.5, -2.5, -1], [-1.5, 2, -1.2]];
      const k = knots[(Math.random() * knots.length) | 0];
      return [k[0] + this.gauss() * 2.6, k[1] + this.gauss() * 1.8, k[2] + this.gauss() * 2.6];
    }, [1.0, 0.9, 0.72], [0.72, 0.88]);
    // dense bar core
    companionCloud(1400, LMC, 0.27, 0.95, () => {
      const t = this.gauss() * 2.4;
      const tilt = 0.35;
      return [t, this.gauss() * 0.7 + t * Math.sin(tilt) * 0.35, this.gauss() * 0.9];
    }, [1.0, 0.97, 0.88], [0.72, 0.88], { amp: 0.06, speed: 0.7 });
    // 30 Doradus — the Tarantula Nebula, largest star-forming region in the Local
    // Group: a cyan knot off the bar's end + a faint pink hydrogen fringe
    companionCloud(520, [LMC[0] + 5.2, LMC[1] - 2.0, LMC[2] + 1.0], 0.42, 0.9, () =>
      [this.gauss() * 1.05, this.gauss() * 0.8, this.gauss() * 1.05], [0.60, 0.94, 1.0], [0.72, 0.88], { amp: 0.14, speed: 1.1 });
    companionCloud(170, [LMC[0] + 5.2, LMC[1] - 2.0, LMC[2] + 1.0], 0.55, 0.4, () =>
      [this.gauss() * 1.5, this.gauss() * 1.1, this.gauss() * 1.5], [1.0, 0.58, 0.68], [0.72, 0.88]);
    poi3(LMC[0], LMC[1] + 9, LMC[2], 'LMC · 163,000 LY', '大麦哲伦云 · 16.3 万光年',
      'The Milky Way\'s largest satellite galaxy. Supernova 1987A exploded here; the cyan knot is the Tarantula Nebula, the largest star-forming region in the Local Group. It will merge with us in ~2.4 billion years. Southern skies only. Click to fly in.',
      '银河最大的伴星系。超新星 1987A 就爆发在这里；青色亮斑是蜘蛛星云——本星系群最大的恒星形成区。约 24 亿年后将被银河并合。仅南半球可见。点击标签可飞近细看。',
      26, LMC);

    // ── SMC — smaller, dimmer, visibly STRETCHED: the Milky Way and the LMC
    // are pulling it apart right now ──
    const SMC: [number, number, number] = [113.4, -139.2, 65.3];
    companionCloud(1000, SMC, 0.55, 0.36, () =>
      [this.gauss() * 7.5, this.gauss() * 3.4, this.gauss() * 5.5], [0.70, 0.79, 1.0], [0.72, 0.88]);
    companionCloud(3100, SMC, 0.30, 0.78, () => {
      const t = this.gauss() * 6.5;
      const tail = Math.random() < 0.12 ? Math.random() * 9 : 0; // tidal tail toward LMC
      return [t - tail * 0.6, this.gauss() * 2.0 - tail * 0.5, this.gauss() * 2.4 + tail * 0.4];
    }, [1.0, 0.86, 0.66], [0.72, 0.88]);
    companionCloud(900, SMC, 0.25, 0.95, () =>
      [this.gauss() * 2.6, this.gauss() * 1.2, this.gauss() * 1.8], [1.0, 0.94, 0.82], [0.72, 0.88], { amp: 0.06, speed: 0.8 });
    poi3(SMC[0], SMC[1] + 8, SMC[2], 'SMC · 200,000 LY', '小麦哲伦云 · 20 万光年',
      'Visible to southern naked eyes, unknown to Europe before Magellan. Its stars are being stretched between the Milky Way and the LMC. Click to fly in.',
      '南半球肉眼可见，麦哲伦环球航行前欧洲一无所知。它的恒星正被银河与大麦哲伦云双向拉扯变形。点击标签可飞近细看。',
      22, SMC);

    // ── the Magellanic Bridge — young BLUE stars torn out between the clouds
    // (real structure, confirmed to contain stars since the 1970s) ──
    companionCloud(850, [0, 0, 0], 0.42, 0.65, () => {
      const u = Math.random();
      return [
        LMC[0] + (SMC[0] - LMC[0]) * u + this.gauss() * 2.6,
        LMC[1] + (SMC[1] - LMC[1]) * u + this.gauss() * 2.0,
        LMC[2] + (SMC[2] - LMC[2]) * u + this.gauss() * 2.6,
      ];
    }, [0.68, 0.84, 1.0], [0.74, 0.90]);

    // ── the Magellanic Stream — hydrogen GAS (not stars) stripped from the
    // clouds, arcing over the south galactic pole. Faint on purpose: it IS faint ──
    const msE1 = new THREE.Vector3(SMC[0], SMC[1], SMC[2]).normalize();
    const msE2 = new THREE.Vector3(0, -1, 0).addScaledVector(msE1, msE1.y).normalize();
    companionCloud(2400, [0, 0, 0], 1.0, 0.42, () => {
      const th = -0.35 + Math.random() * 2.9; // Leading Arm (θ<0) + Trailing Stream past the pole
      const r = 190 + this.gauss() * 12;
      const p = msE1.clone().multiplyScalar(Math.cos(th) * r).addScaledVector(msE2, Math.sin(th) * r);
      const w = 1.6 + Math.abs(Math.sin(th * 1.7)) * 2.0;
      return [p.x + this.gauss() * w, p.y + this.gauss() * w, p.z + this.gauss() * w];
    }, [0.55, 0.68, 0.86], [0.74, 0.90]);
    {
      const mp = msE2.clone().multiplyScalar(195);
      poi3(mp.x, mp.y, mp.z, 'MAGELLANIC STREAM · GAS', '麦哲伦流 · 气体',
        'Not stars — hydrogen gas torn from the Magellanic Clouds by a past close encounter, arcing over the south galactic pole for more than half a sky. Rendered faint blue-grey because that is what it is: cold, starless gas.',
        '不是恒星——是麦哲伦云在过去一次近距离相遇中被撕出的氢气带，越过南银极延伸超过半个天空。故意渲染得暗淡蓝灰，因为它本来就是寒冷、没有恒星的气体。');
    }

    // ── Sagittarius dwarf + stream — a galaxy being shredded in real time ──
    const SGR: [number, number, number] = [29.3, -16.4, -30.3];
    companionCloud(1500, SGR, 0.35, 0.85, () =>
      [this.gauss() * 2.4, this.gauss() * 2.4, this.gauss() * 2.4], [1.0, 0.74, 0.52], [0.74, 0.90]);
    // M54 — the bright globular cluster living in its core (real)
    companionCloud(120, SGR, 0.5, 1.0, () =>
      [this.gauss() * 0.5, this.gauss() * 0.5, this.gauss() * 0.5], [1.0, 0.95, 0.85], [0.74, 0.90], { amp: 0.10, speed: 0.9 });
    // the stream ring: orbit plane contains the core direction, steep to the disk;
    // leading arm (near the core) warmer, far wrap dimmer & redder — an age/metallicity cue
    const e1 = new THREE.Vector3(SGR[0], SGR[1], SGR[2]).normalize();
    const e2 = new THREE.Vector3(0, 1, 0).addScaledVector(e1, -e1.y).normalize();
    companionCloud(6500, [0, 0, 0], 0.38, 0.7, () => {
      const pick = Math.random();
      const th = pick < 0.4 ? this.gauss() * 0.5 : pick < 0.7 ? Math.PI + this.gauss() * 0.7 : Math.random() * Math.PI * 2;
      const r = 45 + this.gauss() * 3.2;
      const p = e1.clone().multiplyScalar(Math.cos(th) * r).addScaledVector(e2, Math.sin(th) * r);
      const w = 1.1 + Math.abs(Math.sin(th)) * 1.0;
      p.x += this.gauss() * w; p.y += this.gauss() * w; p.z += this.gauss() * w;
      return [p.x, p.y, p.z];
    }, (px, py, pz) => {
      const c = (px * e1.x + py * e1.y + pz * e1.z) / Math.max(1e-6, Math.hypot(px, py, pz));
      return c > 0 ? [1.0, 0.76, 0.55] as [number, number, number] : [0.90, 0.62, 0.45] as [number, number, number];
    }, [0.74, 0.90]);
    poi3(SGR[0], SGR[1] - 7, SGR[2], 'SAGITTARIUS STREAM', '人马座星流',
      'A dwarf galaxy being torn apart by the Milky Way\'s tides right now — stretched into a star stream wrapping nearly the whole galaxy. The bright dot in its core is globular cluster M54. Found only in 1994. Click to fly in.',
      '一个正在被银河潮汐力当场撕碎的矮星系——被拉成环绕银河近一圈的恒星流。核心亮点是球状星团 M54。1994 年才被发现。点击标签可飞近细看。',
      20, SGR);

    // points of interest
    for (const poi of GALAXY_POIS) {
      const sp = marker(poi.pos, poi.color, poi.id === 'sgra' ? 4.5 : 2.2, [0.70, 0.85]);
      addLabel(sp, poi.name, poi.nameCn, { poi });
    }

    // arm labels at r ≈ 33 along each lane
    for (let a = 0; a < ARMS; a++) {
      const r = 33;
      const ang = BAR_ANG + (a / ARMS) * Math.PI * 2 + Math.log(r / 4) * WIND + 0.35;
      const anchor = new THREE.Object3D();
      anchor.position.set(Math.cos(ang) * r, 1.5, Math.sin(ang) * r);
      g.add(anchor);
      addLabel(anchor, GALAXY_ARMS[a].name, GALAXY_ARMS[a].nameCn);
    }
  }

  enterGalaxyView() {
    if (this.mission) this.exitMission();
    const t = STR[this.lang];
    if (this.experiment) { this.toast(t.toast.galNoExp); return; }
    if (this.probe) { this.toast(t.toast.galNoProbe); return; }
    if (this.galaxy || this.gxTrans) return;
    if (this.globe) this.exitGlobeView(true);
    if (this.surface) this.exitSurfaceView(true);
    this.setCine(false);
    this.tween = null;
    this.focus = null;

    this.galaxy = {
      savedSpeed: this.params.speed,
      savedNear: this.camera.near, savedFar: this.camera.far,
      savedMin: this.controls.minDistance, savedMax: this.controls.maxDistance,
      savedBg: null,
      hidden: [],
    };
    this.setParam('speed', 0);
    const firstBuild = !this.galaxyGroup;
    if (firstBuild) this.buildGalaxy();
    this.ensureWarpCanvas();

    // the galaxy waits in the wings at origin — every layer dark for now
    const gg = this.galaxyGroup!;
    gg.position.set(0, 0, 0);
    gg.scale.setScalar(1.08);
    gg.visible = true;
    for (const L of this.gxLayers) { L.mat.opacity = 0; if (L.u) L.u.value = 0; }
    this.ensureDustShell();

    // one continuous pull-back: watch home shrink to a star — the galaxy blooms around it
    const begin = () => {
      this.gxPrep = false;
      if (!this.galaxy || this.gxTrans) return; // aborted while preparing
      this.tween = null;
      this.focus = null;
      this.controls.enabled = false;
      this.savedFov = this.camera.fov;
      const fromPos = this.camera.position.clone();
      if (fromPos.lengthSq() < 1e-6) fromPos.set(30, 20, 40);
      const midPos = fromPos.clone().normalize().multiplyScalar(Math.max(95, fromPos.length() * 1.3));
      midPos.y = Math.max(midPos.y, 42);
      this.gxTrans = {
        dir: 'toGalaxy', t: 0, dur: 8,
        fromPos, midPos,
        arrPos: new THREE.Vector3(36, 40, 47),
        fromTgt: this.controls.target.clone(),
        swapped: false, whooshed: false, boomed: false,
      };
      this.collectGxFade();
      this.toast(STR[this.lang].toast.galaxyOn);
      this.emitSnapshot();
    };

    if (firstBuild) {
      // first visit: compile every galaxy shader BEFORE the clock starts —
      // the transition timeline must never pay the one-time compile stall
      this.gxPrep = true;
      this.toast(t.toast.galPrep);
      requestAnimationFrame(() => {
        this.renderer.compileAsync(this.scene, this.camera).then(() => {
          // macOS/Metal creates render pipelines at the first real draw call,
          // not at compile/link — rehearse one frame so the transition never
          // pays it. Galaxy layers are opacity-0: nothing visibly changes.
          this.renderer.render(this.scene, this.camera);
          begin();
        }, begin);
      });
    } else {
      begin();
    }
  }

  exitGalaxyView(silent = false) {
    const g = this.galaxy;
    if (!g || this.gxTrans) return;
    // user-facing exit rides the anchor home — same dive as the Sun marker, no hard cut
    if (!silent) { this.returnToSolarSystem(); return; }
    if (this.gxFocus) { this.gxFocus = null; this.tween = null; }
    this.applyGalaxyScene(false);
    this.galaxy = null;
    this.galaxyObserve = false;
    if (this.params.speed === 0) this.setParam('speed', g.savedSpeed);
    this.emitSnapshot();
  }

  // companion-galaxy focus: fly the camera to a cloud and hand the user an orbit around it
  focusGalaxyPoi(poi: GalaxyPoi) {
    if (!this.galaxy || this.gxTrans || this.gxPrep) return;
    if (this.gxFocus?.poi.id === poi.id) { this.exitGalaxyFocus(); return; }
    const at = poi.focusAt ?? poi.pos;
    let anchor = this.gxAnchors.get(poi.id);
    if (!anchor) {
      anchor = new THREE.Object3D();
      anchor.position.set(at[0], at[1], at[2]);
      this.galaxyGroup!.add(anchor); // rides the group's slow rotation — always current
      this.gxAnchors.set(poi.id, anchor);
    }
    const target = anchor.getWorldPosition(new THREE.Vector3());
    const dist = poi.focusDist ?? 20;
    if (!this.gxFocus) {
      this.gxFocus = { poi, anchor, savedPos: this.camera.position.clone(), savedTgt: this.controls.target.clone() };
    } else {
      this.gxFocus.poi = poi;
      this.gxFocus.anchor = anchor;
    }
    // approach from outside-and-above so the galactic disk stays in frame as the backdrop
    const dir = target.clone().normalize().multiplyScalar(0.55).add(new THREE.Vector3(0.2, 0.6, 0.15)).normalize();
    const toPos = target.clone().addScaledVector(dir, dist);
    this.controls.enabled = false;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 120;
    this.tween = {
      t: 0, dur: 2.6,
      fromPos: this.camera.position.clone(), toPos,
      fromTgt: this.controls.target.clone(), toTgt: target,
      after: () => { this.controls.enabled = true; this.emitSnapshot(); },
    };
    this.emitSnapshot();
  }

  exitGalaxyFocus() {
    const f = this.gxFocus;
    if (!f || this.gxTrans) return;
    this.gxFocus = null;
    this.controls.enabled = false;
    this.tween = {
      t: 0, dur: 2.6,
      fromPos: this.camera.position.clone(), toPos: f.savedPos,
      fromTgt: this.controls.target.clone(), toTgt: f.savedTgt,
      after: () => {
        this.controls.enabled = true;
        this.controls.minDistance = 60;  // back to the rim-hugging galaxy limits
        this.controls.maxDistance = 300;
        this.emitSnapshot();
      },
    };
    this.emitSnapshot();
  }

  // easter egg + galaxy-bar button: one continuous dive home through the star
  // sea. inner = the full voyage: past the Sun's shoulder and down INTO the
  // inner solar system (VIEWS[3] framing), longer burn, harder fov kick.
  returnToSolarSystem(inner = false) {
    if (!this.galaxy || this.gxTrans || this.gxPrep) return;
    if (this.gxFocus) { this.gxFocus = null; this.tween = null; this.emitSnapshot(); }
    this.galaxyObserve = false;
    this.controls.enabled = false;
    this.ensureWarpCanvas();
    this.ensureDustShell();
    this.savedFov = this.camera.fov;
    const v0 = inner ? VIEWS[3] : VIEWS[0];
    const arrPos = new THREE.Vector3(
      Math.cos(v0.elevation * DEG) * Math.cos(v0.azimuth * DEG),
      Math.sin(v0.elevation * DEG),
      Math.cos(v0.elevation * DEG) * Math.sin(v0.azimuth * DEG),
    ).multiplyScalar(v0.distance);
    const fromPos = this.camera.position.clone();
    if (fromPos.lengthSq() < 1e-6) fromPos.set(36, 40, 47);
    // inner voyage: the control point hugs the Sun so the bezier dives deep
    // before settling at the inner-system framing (peak proximity lands right
    // on the t=0.5 scene swap — the marker you dive into ignites into the Sun)
    const midPos = fromPos.clone().normalize().multiplyScalar(inner ? 10 : 7);
    midPos.y += inner ? 4 : 2;
    this.gxTrans = {
      dir: 'toSolar', t: 0, dur: inner ? 10.5 : 7,
      fromPos, midPos, arrPos,
      fromTgt: this.controls.target.clone(),
      swapped: false, whooshed: false, boomed: false,
      inner,
    };
    this.collectGxFade();
    this.toast(inner ? STR[this.lang].toast.galDiving : STR[this.lang].toast.galReturning);
    this.emitSnapshot();
  }

  private applyGalaxyScene(on: boolean) {
    const g = this.galaxy!;
    if (on) {
      for (const o of this.scene.children) {
        if (o === this.galaxyGroup || o === this.dustShell) continue;
        g.hidden.push({ o, v: o.visible });
        o.visible = false;
      }
      this.galaxyGroup!.visible = true;
      this.galaxyGroup!.position.set(0, 0, 0);
      this.galaxyGroup!.scale.setScalar(1);
      g.savedBg = this.scene.background;
      this.scene.background = new THREE.Color(0x06080e); // deep-night tint, barely off black
      this.camera.near = 0.5;
      this.camera.far = 4000;
      this.camera.updateProjectionMatrix();
      this.controls.minDistance = 60;  // rim-hugging floor: never inside the fog
      this.controls.maxDistance = 300;
    } else {
      for (const h of g.hidden) h.o.visible = h.v;
      g.hidden = [];
      this.scene.background = g.savedBg;
      if (this.galaxyGroup) this.galaxyGroup.visible = false;
      for (const L of this.galaxyLabels) L.el.style.opacity = '0'; // synchronous — no frame wait
      this.camera.near = g.savedNear;
      this.camera.far = g.savedFar;
      this.camera.updateProjectionMatrix();
      this.controls.minDistance = g.savedMin;
      this.controls.maxDistance = g.savedMax;
    }
  }

  // anchor-relay transition — one continuous timeline per direction:
  // watch home shrink to a star → sail the star sea → the galaxy blooms open.
  // m = "galaxy-ness": every element owns a window; toSolar mirrors it around t=0.5.
  private updateGxTransition(dt: number) {
    const fx = this.gxTrans;
    if (!fx) return;
    fx.t = Math.min(1, fx.t + dt / fx.dur);
    const t = fx.t;
    const toGal = fx.dir === 'toGalaxy';
    const ssw = (a: number, b: number) => {
      const k = THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
      return k * k * (3 - 2 * k);
    };
    const m = (win: [number, number]) => (toGal ? ssw(win[0], win[1]) : 1 - ssw(1 - win[1], 1 - win[0]));

    // scene crossfade — the solar system dissolves, the galaxy blooms
    for (const f of this.gxFadeO) f.mat.opacity = f.base * (1 - m(f.win));
    for (const f of this.gxFadeS) f.obj.scale.setScalar(f.base * Math.max(0.01, 1 - m(f.win)));
    for (const L of this.gxLayers) {
      const k = m(L.win);
      L.mat.opacity = L.base * k;
      if (L.u) L.u.value = k;
    }
    // …and the Sun itself becomes the star you keep watching
    this.gxSunK = Math.max(0.02, 1 - m(GX_SUN_WIN));
    this.sun.scale.setScalar(this.gxSunK);
    this.galaxyGroup!.scale.setScalar(toGal ? 1.08 - 0.08 * ssw(0.15, 1) : 1 + 0.06 * ssw(0, 0.5));

    // camera: one continuous bezier ride, gaze never leaves the anchor
    const e = easeInOut(t);
    const om = 1 - e;
    this.camera.position.set(
      om * om * fx.fromPos.x + 2 * om * e * fx.midPos.x + e * e * fx.arrPos.x,
      om * om * fx.fromPos.y + 2 * om * e * fx.midPos.y + e * e * fx.arrPos.y,
      om * om * fx.fromPos.z + 2 * om * e * fx.midPos.z + e * e * fx.arrPos.z,
    );
    this.controls.target.lerpVectors(fx.fromTgt, GX_ORIGIN, ssw(0, 0.25));

    // the crossing: bookkeeping swaps while the eye is at peak exposure
    if (t >= 0.5 && !fx.swapped) {
      fx.swapped = true;
      this.gxFlash = 1;
      if (toGal) {
        this.applyGalaxyScene(true);
      } else {
        this.applyGalaxyScene(false);
        const g = this.galaxy!;
        if (this.params.speed === 0) this.setParam('speed', g.savedSpeed);
        this.galaxy = null;
        this.galaxyObserve = false;
        this.emitSnapshot();
      }
    }
    if (!fx.whooshed && t >= 0.4) { fx.whooshed = true; this.playWarpSfx(false); }
    const boomAt = toGal ? 0.80 : 0.56; // the heart ignites / home ignites
    if (!fx.boomed && t >= boomAt) { fx.boomed = true; this.playWarpSfx(true); }

    // cinematic dressing — a gentle fov kick + a whisper of roll at peak zoom
    const bump = ssw(0.3, 0.55) * (1 - ssw(0.55, 0.8));
    this.warpIntensity = bump;
    this.camera.fov = this.savedFov + bump * (fx.inner ? 13 : 8);
    this.camera.updateProjectionMatrix();
    const roll = bump * 0.03 * (toGal ? 1 : -1);
    this.camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    this.gxVeil = t > 0.82 ? 0.3 * (1 - ssw(0.82, 1)) : 0; // eyes adapting on arrival

    if (t >= 1) {
      this.gxTrans = null;
      this.warpIntensity = 0;
      this.gxVeil = 0;
      this.camera.fov = this.savedFov;
      this.camera.updateProjectionMatrix();
      this.camera.up.set(0, 1, 0);
      this.controls.enabled = true;
      this.gxSunK = 1;
      this.sun.scale.setScalar(1);
      // leave nothing half-dissolved: exiting the galaxy later must find
      // the solar system whole again (it is hidden, so restore for free)
      for (const f of this.gxFadeO) f.mat.opacity = f.base;
      for (const f of this.gxFadeS) f.obj.scale.setScalar(f.base);
      if (toGal) for (const L of this.gxLayers) { L.mat.opacity = L.base; if (L.u) L.u.value = 1; }
      else this.toast(fx.inner ? STR[this.lang].toast.galArriveInner : STR[this.lang].toast.galaxyOff);
      this.emitSnapshot();
    }
  }

  // gather everything the solar-side dissolve touches, each with its window
  private collectGxFade() {
    this.gxFadeO = [];
    this.gxFadeS = [];
    const seen = new Set<THREE.Material>();
    const pushO = (mat: THREE.Material | undefined, win: [number, number]) => {
      if (!mat || seen.has(mat)) return;
      seen.add(mat);
      mat.transparent = true;
      this.gxFadeO.push({ mat, base: mat.opacity, win });
    };
    for (const l of this.orbitLines) pushO(l.material as THREE.Material, [0.08, 0.22]);
    // every other line joins the SAME window — local orbit circles (moon,
    // station, voyagers) and scene-level trails must leave WITH the orbit lines
    const extraLine = (o: THREE.Object3D) => {
      const lo = o as THREE.Line;
      if ((lo as unknown as { isLine?: boolean }).isLine && !(lo as unknown as { isLineLoop?: boolean }).isLineLoop) {
        pushO(lo.material as THREE.Material | undefined, [0.08, 0.22]);
      }
    };
    for (const pl of this.planets) pl.pivot.children.forEach(extraLine);
    for (const c of this.scene.children) extraLine(c);
    if (this.sky) pushO((this.sky as THREE.Mesh).material as THREE.Material, [0.10, 0.28]);
    this.belt.traverse((o) => pushO((o as THREE.Mesh).material as THREE.Material | undefined, [0.10, 0.30]));
    this.kuiper.traverse((o) => pushO((o as THREE.Mesh).material as THREE.Material | undefined, [0.12, 0.32]));
    if (this.trojanGroup) this.trojanGroup.traverse((o) => pushO((o as THREE.Points).material as THREE.Material | undefined, [0.10, 0.30]));
    if (this.heliopause) pushO(this.heliopause.material as THREE.MeshBasicMaterial, [0.40, 0.58]);
    if (this.eclipseRig) this.eclipseRig.traverse((o) => pushO((o as THREE.Mesh).material as THREE.Material | undefined, [0.10, 0.30]));
    if (this.sunGlow1) pushO(this.sunGlow1.material as THREE.Material, [0.20, 0.40]);
    if (this.sunGlow2) pushO(this.sunGlow2.material as THREE.Material, [0.22, 0.42]);
    // a farewell in distance order — the outer worlds leave first
    const ps = [...this.planets].sort((a, b) => b.spec.distance - a.spec.distance);
    const n = Math.max(1, ps.length - 1);
    ps.forEach((pl, i) => {
      const a = 0.14 + 0.2 * (i / n);
      this.gxFadeS.push({ obj: pl.body, base: pl.body.scale.x, win: [a, a + 0.08] });
    });
  }

  // near-field dust shell — the speed cue that replaces the streak tunnel:
  // a sparse cylinder of motes riding the view axis, drifting past at peak zoom
  private ensureDustShell() {
    if (this.dustShell) return;
    const N = 300;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 6 + Math.pow(Math.random(), 0.8) * 32;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      const z = -15 + Math.random() * 275;
      const v = 0.5 + Math.random() * 1.0;
      this.dustMeta.push({ x, y, z, v });
      pos.set([x, y, z], i * 3);
      const b = 0.6 + Math.random() * 0.4;
      col.set([0.75 * b, 0.85 * b, b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.7, vertexColors: true, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, toneMapped: false,
    });
    this.dustShell = new THREE.Points(geo, mat);
    this.dustShell.frustumCulled = false;
    this.dustShell.visible = false;
    this.scene.add(this.dustShell);
  }

  private updateDustShell(dt: number) {
    const ds = this.dustShell;
    if (!ds) return;
    const w = this.warpIntensity;
    if (w <= 0.02) { ds.visible = false; return; }
    ds.visible = true;
    (ds.material as THREE.PointsMaterial).opacity = w * 0.5;
    ds.position.copy(this.camera.position);
    const look = this.controls.target.clone().sub(this.camera.position);
    if (look.lengthSq() < 1e-6) look.set(0, 0, 1);
    ds.lookAt(this.camera.position.clone().add(look));
    const attr = ds.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const speed = (50 + 130 * w) * dt;
    for (let i = 0; i < this.dustMeta.length; i++) {
      const mote = this.dustMeta[i];
      mote.z -= speed * mote.v;
      if (mote.z < -18) mote.z = 260;
      arr[i * 3] = mote.x; arr[i * 3 + 1] = mote.y; arr[i * 3 + 2] = mote.z;
    }
    attr.needsUpdate = true;
  }

  // warp audio garnish — a riser at jump start, a boom at the scene swap
  private playWarpSfx(boom: boolean) {
    if (!this.ambience.isOn) return;
    try {
      const a = boom ? (this.warpSfxBoom ??= new Audio('/sfx/warp-boom.mp3'))
                     : (this.warpSfxWhoosh ??= new Audio('/sfx/warp-whoosh.mp3'));
      a.currentTime = 0;
      a.volume = boom ? 0.7 : 0.55;
      void a.play().catch(() => { /* autoplay policies may say no — fine */ });
    } catch { /* audio is garnish — never break the flight */ }
  }

  // warp overlay canvas — white flash, vignette and the settle veil
  private ensureWarpCanvas() {
    if (this.warpCanvas) return;
    const c = document.createElement('canvas');
    c.id = 'warpfx';
    document.body.appendChild(c);
    this.warpCanvas = c;
    this.warpCtx = c.getContext('2d');
  }

  private drawWarp(dt: number) {
    if (!this.warpCtx || !this.warpCanvas) return;
    const ctx = this.warpCtx, c = this.warpCanvas;
    if (c.width !== window.innerWidth || c.height !== window.innerHeight) {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    }
    ctx.clearRect(0, 0, c.width, c.height);
    if (this.gxVeil > 0.004) {
      ctx.fillStyle = `rgba(0,0,0,${this.gxVeil.toFixed(3)})`;
      ctx.fillRect(0, 0, c.width, c.height);
    }
    // exposure pulse at the scene swap
    if (this.gxFlash > 0.004) {
      ctx.fillStyle = `rgba(235,242,255,${(this.gxFlash * 0.18).toFixed(3)})`;
      ctx.fillRect(0, 0, c.width, c.height);
      this.gxFlash = Math.max(0, this.gxFlash - dt * 2.2);
    }
    // vignette only — the tunnel's central glow is gone with the tunnel;
    // the galaxy itself must carry the scene now, no canvas light blob
    if (this.warpIntensity > 0.01) {
      const cx = c.width / 2, cy = c.height / 2;
      const grad = ctx.createRadialGradient(cx, cy, Math.min(cx, cy) * 0.35, cx, cy, Math.hypot(cx, cy));
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(0,0,0,${(this.warpIntensity * 0.35).toFixed(3)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, c.width, c.height);
    }
  }

  toggleGalaxyLabels() {
    this.galaxyLabelsOn = !this.galaxyLabelsOn;
    this.emitSnapshot();
  }

  // observe mode ("观赏"): hide labels + HUD — nothing but the galaxy.
  // Returns whether observe mode is now on (false when a guard blocked it).
  toggleGalaxyObserve(): boolean {
    if (!this.galaxy || this.gxTrans) return false;
    this.galaxyObserve = !this.galaxyObserve;
    this.emitSnapshot();
    return this.galaxyObserve;
  }
  // returns true if observe mode was active, so callers can restore their own UI
  exitGalaxyObserve(): boolean {
    if (!this.galaxyObserve) return false;
    this.galaxyObserve = false;
    this.emitSnapshot();
    return true;
  }

  private updateGalaxyLabels() {
    const w = window.innerWidth, h = window.innerHeight;
    const v = new THREE.Vector3();
    for (const L of this.galaxyLabels) {
      if (!this.galaxyLabelsOn || this.galaxyObserve || !this.galaxy || this.gxTrans || this.gxPrep) { L.el.style.opacity = '0'; continue; }
      L.obj.getWorldPosition(v);
      v.project(this.camera);
      if (v.z > 1 || v.z < -1) { L.el.style.opacity = '0'; continue; }
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      L.el.style.transform = `translate(-50%,-140%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      L.el.style.opacity = L.isSun ? '0.85' : '0.6'; // subtle, non-scene-stealing
    }
  }

  // ------------------------------------------------------------- globe view
  // "Specimen mode": isolate one body, dim the rest of the system, freeze sim
  // time and hand the camera to the user. Layers: graticule, fill light +
  // terminator glow, landmark markers. Sun / spacecraft / comets excluded.
  private static GLOBEABLE = new Set([
    'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn',
    'uranus', 'neptune', 'pluto', 'moon', 'ceres', 'vesta',
    'io', 'europa', 'ganymede', 'callisto', 'titan', 'enceladus',
    'phobos', 'deimos', 'ariel', 'titania', 'oberon', 'triton', 'charon',
    'eris', 'haumea', 'makemake',
  ]);

  enterGlobeView(node?: PlanetNode) {
    const t = STR[this.lang];
    const target = node ?? this.focus;
    if (!target || !SolarEngine.GLOBEABLE.has(target.spec.id)) { this.toast(t.toast.globeNoBody); return; }
    if (this.gxTrans) return;
    if (this.experiment) { this.toast(t.toast.globeNoExp); return; }
    if (this.probe) { this.toast(t.toast.globeNoProbe); return; }
    if (this.globe) this.exitGlobeView(true);
    if (this.galaxy) this.exitGalaxyView(true);
    if (this.surface) this.exitSurfaceView(true);
    this.setCine(false);
    this.tween = null;

    if (target.spec.id in MOON_SYS) this.ensureMoonSystem(target.spec.id as MoonHost);
    const sys = new Set<string>([target.spec.id]);
    if (target.spec.id === 'earth') ['moon', 'iss', 'orbiter'].forEach(id => sys.add(id));
    if (target.spec.id === 'moon') sys.add('orbiter');
    const hostMoons = MOON_SYS[target.spec.id as MoonHost];
    if (hostMoons) hostMoons.forEach(m => sys.add(m.id));

    this.globe = {
      node: target, sys,
      savedSpeed: this.params.speed,
      savedNear: this.camera.near,
      savedMin: this.controls.minDistance,
      savedMax: this.controls.maxDistance,
    };

    // freeze sim time (spin keeps running — driven by real dt while globe is on)
    this.setParam('speed', 0);

    // dim everything outside the retained system
    for (const p of this.planets) {
      if (sys.has(p.spec.id)) continue;
      p.pivot.traverse(o => {
        const any = o as unknown as { isLine?: boolean; isPoints?: boolean; material?: THREE.Material };
        if (!any.material) return;
        const mat = any.material as THREE.Material;
        if (any.isLine || any.isPoints || (mat as THREE.ShaderMaterial).isShaderMaterial) {
          this.dimHidden.push(o); o.visible = false;
        } else {
          this.dimmed.push({ m: mat, transparent: mat.transparent, opacity: mat.opacity });
          mat.transparent = true; mat.opacity = 0.08;
        }
      });
    }
    const dimMat = (m: THREE.Material) => {
      this.dimmed.push({ m, transparent: m.transparent, opacity: m.opacity });
      m.transparent = true; m.opacity = 0.08;
    };
    dimMat(this.sun.material as THREE.Material);
    if (this.sunGlow1) dimMat(this.sunGlow1.material as THREE.Material);
    if (this.sunGlow2) dimMat(this.sunGlow2.material as THREE.Material);
    dimMat(this.stars.material as THREE.Material);
    if (this.sky) dimMat(this.sky.material as THREE.Material);
    this.dimHidden.push(this.belt); this.belt.visible = false;
    this.dimHidden.push(this.kuiper); this.kuiper.visible = false;
    if (this.trojanGroup) { this.dimHidden.push(this.trojanGroup); this.trojanGroup.visible = false; }
    if (this.heliopause) { this.dimHidden.push(this.heliopause); this.heliopause.visible = false; }
    if (this.eclipseRig) { this.dimHidden.push(this.eclipseRig); this.eclipseRig.visible = false; }
    if (this.halley) {
      this.dimHidden.push(this.halley.tail); this.halley.tail.visible = false;
      this.dimHidden.push(this.halley.trail); this.halley.trail.visible = false;
    }
    this.orbitLines.forEach(l => { this.dimHidden.push(l); l.visible = false; });
    if (target.orbitRing) { this.dimHidden.push(target.orbitRing); target.orbitRing.visible = false; } // its path around the parent is not part of the specimen
    if (this.well) { this.dimHidden.push(this.well); this.well.visible = false; }
    if (this.lagrangeGroup) { this.dimHidden.push(this.lagrangeGroup); this.lagrangeGroup.visible = false; }

    // camera envelope for close inspection
    const visR = Math.max(target.spec.radius * this.params.planetScale, 0.05);
    this.controls.minDistance = visR * 1.15;
    this.controls.maxDistance = visR * 25;
    this.camera.near = Math.min(0.01, visR * 0.02);
    this.camera.updateProjectionMatrix();
    this.focus = target;
    this.focusSettle = true;

    this.buildGlobeLayers(target);
    this.toast(t.toast.globeOn);
    this.emitSnapshot();
  }

  exitGlobeView(silent = false) {
    const g = this.globe;
    if (!g) return;
    this.globe = null;
    for (const d of this.dimmed) { d.m.transparent = d.transparent; d.m.opacity = d.opacity; }
    this.dimmed = [];
    for (const o of this.dimHidden) o.visible = true;
    this.dimHidden = [];
    if (this.globeGrid) {
      this.globeGrid.removeFromParent();
      this.globeGrid.geometry.dispose();
      (this.globeGrid.material as THREE.Material).dispose();
      this.globeGrid = null;
    }
    if (this.globeTerm) {
      this.globeTerm.removeFromParent();
      this.globeTerm.geometry.dispose();
      (this.globeTerm.material as THREE.Material).dispose();
      this.globeTerm = null;
    }
    for (const mk of this.globeMarkers) {
      mk.removeFromParent();
      mk.geometry.dispose();
      (mk.material as THREE.Material).dispose();
    }
    this.globeMarkers = [];
    for (const L of this.lmLabels) L.el.remove();
    this.lmLabels = [];
    if (this.globeFillLight) { this.scene.remove(this.globeFillLight); this.globeFillLight = null; }
    this.controls.minDistance = g.savedMin;
    this.controls.maxDistance = g.savedMax;
    this.camera.near = g.savedNear;
    this.camera.updateProjectionMatrix();
    // resume time only if the user left it frozen
    if (this.params.speed === 0) this.setParam('speed', g.savedSpeed);
    if (!silent) this.toast(STR[this.lang].toast.globeOff);
    this.emitSnapshot();
  }

  resetGlobeView() {
    if (!this.globe) return;
    const node = this.globe.node;
    const visR = Math.max(node.spec.radius * this.params.planetScale, 0.05);
    const world = node.body.getWorldPosition(new THREE.Vector3());
    const off = new THREE.Vector3(1.7, 1.0, 2.1).normalize().multiplyScalar(visR * 3.2);
    this.camera.position.copy(world).add(off);
    this.controls.target.copy(world);
    this.focusSettle = false;
  }

  toggleGlobeGrid() {
    this.globeGridOn = !this.globeGridOn;
    if (this.globeGrid) this.globeGrid.visible = this.globeGridOn;
    this.emitSnapshot();
  }

  toggleGlobeFill() {
    this.globeFillOn = !this.globeFillOn;
    if (this.globeTerm) this.globeTerm.visible = this.globeFillOn;
    if (this.globeFillLight) this.globeFillLight.visible = this.globeFillOn;
    this.emitSnapshot();
  }

  toggleGlobeLabels() {
    this.globeLabelsOn = !this.globeLabelsOn;
    this.emitSnapshot();
  }

  toggleGlobeSpin() {
    this.globeSpinOn = !this.globeSpinOn;
    this.emitSnapshot();
  }

  private buildGlobeLayers(node: PlanetNode) {
    const r = node.spec.radius;
    // 1) graticule — surface-fixed, spins with the body
    this.globeGrid = new THREE.Mesh(
      new THREE.SphereGeometry(r * 1.004, 24, 12),
      new THREE.MeshBasicMaterial({
        color: 0x63d8d0, wireframe: true, transparent: true, opacity: 0.1,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    this.globeGrid.visible = this.globeGridOn;
    node.mesh.add(this.globeGrid);

    // 2) terminator glow band — sun-direction shader shell (rides with fill light)
    const termMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
      uniforms: {
        uSunDir: { value: new THREE.Vector3(1, 0, 0) },
        uStrength: { value: 0.4 },
        uColor: { value: new THREE.Color(0xffd9a0) },
      },
      vertexShader: 'varying vec3 vW; void main(){ vW = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uSunDir; uniform float uStrength; uniform vec3 uColor; varying vec3 vW; void main(){ float band = pow(1.0 - abs(dot(normalize(vW), normalize(uSunDir))), 7.0); gl_FragColor = vec4(uColor, band * uStrength); }',
    });
    this.globeTerm = new THREE.Mesh(new THREE.SphereGeometry(r * 1.01, 48, 32), termMat);
    this.globeTerm.visible = this.globeFillOn;
    node.body.add(this.globeTerm);

    // 3) landmark markers + clickable DOM labels
    for (const lm of LANDMARKS[node.spec.id] ?? []) {
      const lr = r * 1.015;
      const theta = (90 - lm.lat) * DEG;
      const phi = (lm.lon + 180) * DEG;
      const pos = new THREE.Vector3(
        -lr * Math.cos(phi) * Math.sin(theta),
        lr * Math.cos(theta),
        lr * Math.sin(phi) * Math.sin(theta),
      );
      const mk = new THREE.Mesh(
        new THREE.RingGeometry(r * 0.04, r * 0.06, 24),
        new THREE.MeshBasicMaterial({ color: 0x7fdcff, side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false }),
      );
      mk.position.copy(pos);
      mk.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize());
      node.mesh.add(mk);
      this.globeMarkers.push(mk);

      const el = document.createElement('div');
      el.className = 'p-label lm-label';
      el.textContent = this.lang === 'zh' ? lm.nameCn : lm.name;
      el.style.opacity = '0';
      el.addEventListener('click', () => this.toast(this.lang === 'zh' ? lm.descCn : lm.desc));
      this.labelLayer.appendChild(el);
      this.lmLabels.push({ el, obj: mk, lm });
    }

    // museum fill light (independent of the shell, both ride the same toggle)
    this.globeFillLight = new THREE.HemisphereLight(0x8fa8c8, 0x1a2028, 0.55);
    this.globeFillLight.visible = this.globeFillOn;
    this.scene.add(this.globeFillLight);
  }

  private updateGlobeLabels() {
    if (!this.globe) return;
    const w = window.innerWidth, h = window.innerHeight;
    const center = this.globe.node.body.getWorldPosition(new THREE.Vector3());
    const v = new THREE.Vector3();
    for (const L of this.lmLabels) {
      if (!this.globeLabelsOn) { L.el.style.opacity = '0'; continue; }
      L.obj.getWorldPosition(v);
      const facing = v.clone().sub(center).normalize().dot(this.camera.position.clone().sub(v).normalize());
      if (facing < 0.03) { L.el.style.opacity = '0'; continue; }
      v.project(this.camera);
      if (v.z > 1 || v.z < -1) { L.el.style.opacity = '0'; continue; }
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      L.el.style.transform = `translate(-50%,-170%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      L.el.style.opacity = '0.85';
    }
  }

  // Moon Hill sphere overlay — resident layer, toggled from the expert panel
  toggleHill() {
    this.hillOn = !this.hillOn;
    const t = STR[this.lang];
    this.toast(this.hillOn ? t.toast.hillOn : t.toast.hillOff);
    this.emitSnapshot();
  }

  // Gravity well (spacetime-fabric grid), Lagrange points + Trojan swarms,
  // and a full N-body "rogue object" experiment mode.

  toggleWell() {
    const t = STR[this.lang];
    if (this.well) {
      this.scene.remove(this.well);
      this.well.geometry.dispose();
      (this.well.material as THREE.Material).dispose();
      this.well = null;
      this.toast(t.toast.wellOff);
    } else {
      const geo = new THREE.PlaneGeometry(200, 200, 80, 80);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        const r = Math.hypot(x, z);
        pos.setY(i, -16 / (1 + r / 8));
      }
      const mat = new THREE.MeshBasicMaterial({
        color: 0x35e0d8, wireframe: true, transparent: true, opacity: 0.11,
        depthWrite: false, blending: THREE.AdditiveBlending,
      });
      this.well = new THREE.Mesh(geo, mat);
      this.well.renderOrder = -2;
      this.scene.add(this.well);
      this.toast(t.toast.wellOn);
    }
    this.emitSnapshot();
  }

  toggleLagrange() {
    const t = STR[this.lang];
    if (this.lagrangeGroup) {
      for (const child of this.lagrangeGroup.children) {
        const m = child as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | undefined;
        if (mat) mat.dispose();
      }
      for (const el of this.lagLabels) el.remove();
      this.lagLabels = [];
      this.scene.remove(this.lagrangeGroup);
      this.lagrangeGroup = null;
      this.toast(t.toast.lagrangeOff);
    } else {
      const g = new THREE.Group();
      for (const pid of ['earth', 'jupiter']) {
        const color = pid === 'earth' ? '#7fd8ff' : '#ffc36b';
        const colorHex = pid === 'earth' ? 0x7fd8ff : 0xffc36b;
        for (let li = 1; li <= 5; li++) {
          const marker = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.22),
            new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.9, depthWrite: false }),
          );
          marker.userData = { pid, li };
          g.add(marker);
          const el = document.createElement('div');
          el.className = 'p-label lag-label';
          el.textContent = `L${li}`;
          el.style.color = color;
          this.labelLayer.appendChild(el);
          this.lagLabels.push(el);
        }
      }
      // (Trojan swarms graduated to permanent scene citizens — see buildTrojans)
      this.lagrangeGroup = g;
      this.scene.add(g);
      this.toast(t.toast.lagrangeOn);
    }
    this.emitSnapshot();
  }

  // reposition L1–L5 markers / Trojan clouds from live planet world positions
  private updateLagrange() {
    const g = this.lagrangeGroup;
    if (!g) return;
    const UP = new THREE.Vector3(0, 1, 0);
    for (const child of g.children) {
      const ud = child.userData as { pid: string; li: number };
      const node = this.planets.find(p => p.spec.id === ud.pid);
      if (!node) continue;
      const P = node.body.getWorldPosition(new THREE.Vector3());
      const R = P.length();
      if (R < 1e-6) continue;
      const mu = PLANET_MU[ud.pid] ?? 0;
      const h = Math.cbrt(mu / (3 * MU_SUN));
      const off = Math.max(R * h, 1.3);
      const dir = P.clone().normalize();
      let v: THREE.Vector3;
      switch (ud.li) {
        case 1: v = P.clone().sub(dir.multiplyScalar(off)); break;
        case 2: v = P.clone().add(dir.multiplyScalar(off)); break;
        case 3: v = P.clone().negate(); break;
        case 4: v = P.clone().applyAxisAngle(UP, -Math.PI / 3); break; // L4 leads by 60°
        default: v = P.clone().applyAxisAngle(UP, Math.PI / 3); break;  // L5 trails by 60°
      }
      child.position.copy(v);
    }
  }

  // ---- rogue-object N-body experiment --------------------------------------
  // 8 planets + a 13-Jupiter-mass brown dwarf, full mutual gravity, Sun pinned.
  injectRogue() {
    if (this.experiment || this.gxTrans) return;
    if (this.galaxy) { this.toast(STR[this.lang].toast.galNoExp); return; }
    if (this.probe) this.exitProbeMode();
    if (this.globe) this.exitGlobeView(true);
    const t = STR[this.lang];
    const jd = BASE_JD + this.simDays;
    const ids = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
    const bodies = ids.map(id => {
      const p = helioState(id, jd);
      const v = bodyVelocity(id, jd);
      return { id, mu: PLANET_MU[id], x: p.x, y: p.y, z: p.z, vx: v[0], vy: v[1], vz: v[2] };
    });
    // brown dwarf inbound from 42 AU, 12° above the ecliptic, ~5.5 km/s
    const muR = (13 * MU_SUN) / 1047.348644;
    const phi = 100 * DEG, inc = 12 * DEG, R0 = 42;
    const px = R0 * Math.cos(inc) * Math.cos(phi);
    const py = R0 * Math.cos(inc) * Math.sin(phi);
    const pz = R0 * Math.sin(inc);
    const vt = 4.5 * KMS_TO_AUDAY, vr = -3.2 * KMS_TO_AUDAY;
    const tx = -Math.sin(phi), ty = Math.cos(phi);
    bodies.push({
      id: 'rogue', mu: muR, x: px, y: py, z: pz,
      vx: vt * tx + (vr * px) / R0, vy: vt * ty + (vr * py) / R0, vz: (vr * pz) / R0,
    });

    // brown dwarf visual: dim red dwarf-like glowing sphere + glow sprite
    const rogueMesh = new THREE.Group();
    rogueMesh.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 24, 18),
      new THREE.MeshStandardMaterial({ color: 0x3a1408, emissive: 0xb03410, emissiveIntensity: 1.1, roughness: 0.85 }),
    ));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSprite('rgba(255,120,60,0.85)', 'rgba(180,40,10,0.3)'),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.75,
    }));
    glow.scale.setScalar(3.2);
    rogueMesh.add(glow);
    const sp0 = auToScenePos(px, py, pz);
    rogueMesh.position.set(sp0.x, sp0.y, sp0.z);
    this.scene.add(rogueMesh);

    // trail
    const MAXP = 12000;
    const tArr = new Float32Array(MAXP * 3);
    const tGeo = new THREE.BufferGeometry();
    const trailAttr = new THREE.BufferAttribute(tArr, 3);
    tGeo.setAttribute('position', trailAttr);
    tGeo.setDrawRange(0, 0);
    const trail = new THREE.Line(tGeo, new THREE.LineBasicMaterial({
      color: 0xff6a3a, transparent: true, opacity: 0.75, depthWrite: false,
    }));
    trail.frustumCulled = false;
    this.scene.add(trail);

    this.experiment = {
      bodies, jd, sinceTrail: 0,
      rogueMesh, trail, trailAttr, trailCount: 0,
      lastTrailPos: new THREE.Vector3(sp0.x, sp0.y, sp0.z),
    };
    this.pushExpTrailPoint(sp0.x, sp0.y, sp0.z);
    // analytic orbit rings no longer match — hide them while the experiment runs
    this.orbitLines.forEach(l => (l.visible = false));
    this.pushLog(jd, t.logExpInject);
    this.toast(t.toast.expInjected);
    this.emitSnapshot();
  }

  resetExperiment(silent = false) {
    const ex = this.experiment;
    if (!ex) return;
    const t = STR[this.lang];
    this.scene.remove(ex.rogueMesh);
    ex.rogueMesh.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | undefined;
      if (mat) mat.dispose();
    });
    this.scene.remove(ex.trail);
    ex.trail.geometry.dispose();
    (ex.trail.material as THREE.Material).dispose();
    this.experiment = null;
    this.orbitLines.forEach(l => (l.visible = true));
    const jd = BASE_JD + this.simDays;
    this.pushLog(jd, silent ? t.logExpResetJump : t.logExpReset);
    this.toast(silent ? t.toast.expResetJump : t.toast.expReset);
    this.emitSnapshot();
  }

  // heliocentric accel on body i: Sun + direct & indirect terms of all others
  private expAccel(i: number, out: [number, number, number]) {
    const bs = this.experiment!.bodies;
    const b = bs[i];
    const r2 = b.x * b.x + b.y * b.y + b.z * b.z;
    const r = Math.sqrt(Math.max(r2, 1e-12));
    const f = -MU_SUN / (r2 * r);
    let ax = b.x * f, ay = b.y * f, az = b.z * f;
    for (let j = 0; j < bs.length; j++) {
      if (j === i) continue;
      const o = bs[j];
      const dx = o.x - b.x, dy = o.y - b.y, dz = o.z - b.z;
      const d2 = Math.max(dx * dx + dy * dy + dz * dz, 1e-12);
      const d = Math.sqrt(d2);
      let g = o.mu / (d2 * d);
      ax += dx * g; ay += dy * g; az += dz * g;
      const pr2 = o.x * o.x + o.y * o.y + o.z * o.z;
      const pr = Math.sqrt(Math.max(pr2, 1e-12));
      g = o.mu / (pr2 * pr);
      ax -= o.x * g; ay -= o.y * g; az -= o.z * g;
    }
    out[0] = ax; out[1] = ay; out[2] = az;
  }

  private expStep(dt: number) {
    const bs = this.experiment!.bodies;
    const n = bs.length;
    const tmp: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      this.expAccel(i, tmp);
      expAcc[i * 3] = tmp[0]; expAcc[i * 3 + 1] = tmp[1]; expAcc[i * 3 + 2] = tmp[2];
    }
    for (let i = 0; i < n; i++) {
      const b = bs[i];
      b.x += b.vx * dt + 0.5 * expAcc[i * 3] * dt * dt;
      b.y += b.vy * dt + 0.5 * expAcc[i * 3 + 1] * dt * dt;
      b.z += b.vz * dt + 0.5 * expAcc[i * 3 + 2] * dt * dt;
    }
    for (let i = 0; i < n; i++) {
      this.expAccel(i, tmp);
      const b = bs[i];
      b.vx += 0.5 * (expAcc[i * 3] + tmp[0]) * dt;
      b.vy += 0.5 * (expAcc[i * 3 + 1] + tmp[1]) * dt;
      b.vz += 0.5 * (expAcc[i * 3 + 2] + tmp[2]) * dt;
    }
  }

  private pushExpTrailPoint(x: number, y: number, z: number) {
    const ex = this.experiment!;
    if (ex.trailCount >= 12000) return;
    ex.trailAttr.setXYZ(ex.trailCount, x, y, z);
    ex.trailAttr.needsUpdate = true;
    ex.trailCount++;
    ex.trail.geometry.setDrawRange(0, ex.trailCount);
    ex.lastTrailPos.set(x, y, z);
  }

  // integrate the experiment clock to jd, then drive all body scene positions
  private updateExperiment(jd: number) {
    const ex = this.experiment;
    if (!ex) return;
    let remaining = jd - ex.jd;
    let guard = 0;
    while (Math.abs(remaining) > 1e-9 && guard++ < 1600) {
      const dtMag = Math.min(Math.abs(remaining), Math.max(0.05, Math.abs(remaining) / 1500));
      const dt = Math.sign(remaining) * dtMag;
      this.expStep(dt);
      ex.jd += dt;
      ex.sinceTrail += Math.abs(dt);
      remaining = jd - ex.jd;
      if (ex.sinceTrail >= 2) {
        ex.sinceTrail = 0;
        const rb = ex.bodies[ex.bodies.length - 1];
        const sp = auToScenePos(rb.x, rb.y, rb.z);
        this.pushExpTrailPoint(sp.x, sp.y, sp.z);
      }
    }
    if (Math.abs(remaining) > 1e-9) ex.jd = jd; // fell behind — resync clock
    for (const b of ex.bodies) {
      const sp = auToScenePos(b.x, b.y, b.z);
      if (b.id === 'rogue') ex.rogueMesh.position.set(sp.x, sp.y, sp.z);
      else {
        const node = this.planets.find(p => p.spec.id === b.id);
        if (node) node.body.position.set(sp.x, sp.y, sp.z);
      }
    }
  }

  // ------------------------------------------------------------- probe mode
  // Generic deep-space probe — hexagonal bus, high-gain dish, twin solar
  // wings, RTG, magnetometer boom, thruster cluster, beacon.
  private buildProbeCraft(): THREE.Group {
    const g = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: 0xd8a520, roughness: 0.35, metalness: 0.9, emissive: 0x241a04 });
    const goldDark = new THREE.MeshStandardMaterial({ color: 0x8a6d1a, roughness: 0.5, metalness: 0.85 });
    const white = new THREE.MeshStandardMaterial({ color: 0xcfccc4, roughness: 0.7, metalness: 0.1, side: THREE.DoubleSide });
    const dark = new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.55, metalness: 0.65 });
    const panelBlue = new THREE.MeshStandardMaterial({ color: 0x1c3f74, roughness: 0.35, metalness: 0.55, emissive: 0x060d1d });
    const rtgRed = new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.5, metalness: 0.4 });

    const strut = (a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) => {
      const d = b.clone().sub(a);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), mat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      g.add(m);
    };

    // ---- hexagonal bus + decks
    const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.42, 6), gold);
    g.add(bus);
    const deckTop = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.29, 0.08, 6), goldDark);
    deckTop.position.y = 0.25;
    g.add(deckTop);
    const deckBot = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.24, 0.08, 6), dark);
    deckBot.position.y = -0.25;
    g.add(deckBot);
    // equipment boxes around the bus
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.03), i % 2 ? dark : goldDark);
      box.position.set(Math.cos(a) * 0.31, (i % 3 - 1) * 0.1, Math.sin(a) * 0.31);
      box.lookAt(Math.cos(a) * 2, box.position.y, Math.sin(a) * 2);
      g.add(box);
    }

    // ---- solar wings: yoke + two panel arrays along ±x
    for (const side of [-1, 1]) {
      strut(new THREE.Vector3(side * 0.28, 0.05, 0), new THREE.Vector3(side * 0.5, 0.05, 0), 0.018, dark);
      const wing = new THREE.Group();
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.02, 0.34), panelBlue);
      wing.add(panel);
      // frame rails + cell strips
      for (const zz of [-0.17, 0, 0.17]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.024, 0.012), dark);
        rail.position.z = zz;
        wing.add(rail);
      }
      for (let i = 0; i < 5; i++) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.024, 0.33), goldDark);
        strip.position.x = -0.34 + i * 0.17;
        wing.add(strip);
      }
      wing.position.set(side * 0.93, 0.05, 0);
      wing.rotation.x = 0.12;
      g.add(wing);
    }

    // ---- high-gain dish on top deck, faces +z
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 14; i++) {
      const r = (i / 14) * 0.42;
      pts.push(new THREE.Vector2(r, 0.04 + 0.55 * r * r));
    }
    const dish = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), white);
    dish.rotation.x = Math.PI / 2;
    dish.position.set(0, 0.18, 0.22);
    g.add(dish);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.011, 8, 36), dark);
    rim.position.set(0, 0.18, 0.22 + 0.04 + 0.55 * 0.42 * 0.42);
    g.add(rim);
    const feedPos = new THREE.Vector3(0, 0.18, 0.48);
    const feed = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 10), dark);
    feed.rotation.x = -Math.PI / 2;
    feed.position.copy(feedPos);
    g.add(feed);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
      strut(new THREE.Vector3(Math.cos(a) * 0.4, 0.18 + Math.sin(a) * 0.4, 0.32), feedPos, 0.009, dark);
    }

    // ---- RTG on an aft boom
    strut(new THREE.Vector3(-0.2, -0.1, -0.2), new THREE.Vector3(-0.55, -0.28, -0.42), 0.015, dark);
    const rtg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.26, 10), rtgRed);
    rtg.position.set(-0.62, -0.32, -0.48);
    rtg.rotation.z = 1.0;
    g.add(rtg);
    for (let i = 0; i < 5; i++) {
      const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.012, 12), rtgRed);
      fin.position.set(-0.62 + (i - 2) * 0.045 * Math.cos(1.0), -0.32 - (i - 2) * 0.045 * Math.sin(1.0), -0.48);
      fin.rotation.z = 1.0;
      g.add(fin);
    }

    // ---- magnetometer boom (aft, long)
    strut(new THREE.Vector3(0.22, -0.12, -0.2), new THREE.Vector3(0.6, -0.5, -0.62), 0.01, dark);
    strut(new THREE.Vector3(0.6, -0.5, -0.62), new THREE.Vector3(0.92, -0.85, -0.98), 0.007, dark);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.07), dark);
    mag.position.set(0.92, -0.85, -0.98);
    g.add(mag);

    // ---- omni whip + thrusters
    strut(new THREE.Vector3(0, -0.28, 0.08), new THREE.Vector3(0, -0.72, 0.28), 0.005, dark);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.5;
      const th = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 8), dark);
      th.position.set(Math.cos(a) * 0.24, -0.3, Math.sin(a) * 0.24);
      th.rotation.x = Math.PI;
      g.add(th);
    }

    return g;
  }

  isProbeMode(): boolean { return this.probe !== null; }

  // chase-camera on the probe
  toggleProbeFollow(): boolean {
    if (!this.probe) return false;
    this.probeFollow = !this.probeFollow;
    if (this.probeFollow) {
      this.setCine(false);
      this.focus = null; // probe cam takes over from planet focus
      this.tween = null;
      this.probeSettle = true;
      this.toast(STR[this.lang].toast.probeFollowOn);
    } else {
      this.toast(STR[this.lang].toast.probeFollowOff);
    }
    return this.probeFollow;
  }

  private followProbeCam(dt: number) {
    const pr = this.probe!;
    const world = pr.mesh.position;
    const prevTarget = this.controls.target.clone();
    this.controls.target.lerp(world, 1 - Math.exp(-dt * 6));
    const delta = this.controls.target.clone().sub(prevTarget);
    this.camera.position.add(delta);
    // ease to chase distance only until the user takes over
    if (this.probeSettle) {
      const desired = 4.2;
      const offset = this.camera.position.clone().sub(this.controls.target);
      const d = offset.length();
      const newD = THREE.MathUtils.lerp(d, desired, 1 - Math.exp(-dt * 1.2));
      offset.setLength(newD);
      this.camera.position.copy(this.controls.target).add(offset);
      if (Math.abs(newD - desired) < 0.05) this.probeSettle = false;
    }
  }

  enterProbeMode(mission: ProbeMission = 'flyby', target = 'mars') {
    if (this.probe) this.exitProbeMode();
    if (this.gxTrans) return;
    if (this.experiment) { this.toast(STR[this.lang].toast.expNoProbe); return; }
    if (this.globe) { this.toast(STR[this.lang].toast.globeNoProbe); return; }
    if (this.galaxy) { this.toast(STR[this.lang].toast.galNoProbe); return; }
    if (this.surface) this.exitSurfaceView(true);
    if (!this.ephemOn) this.ephemOn = true; // physics needs real positions

    const mesh = new THREE.Group();
    const craft = this.buildProbeCraft();
    mesh.add(craft);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSprite('rgba(255,240,200,0.9)', 'rgba(255,180,80,0.28)', 64),
      transparent: true, depthWrite: false, opacity: 0.55,
    }));
    glow.scale.setScalar(2.4);
    mesh.add(glow);
    // blinking navigation beacon on top of the bus
    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSprite('rgba(255,90,70,1)', 'rgba(255,60,40,0.25)', 32),
      transparent: true, depthWrite: false, opacity: 0.9,
    }));
    beacon.scale.setScalar(0.35);
    beacon.position.y = 0.42;
    mesh.add(beacon);

    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12000 * 3), 3));
    trailGeo.setDrawRange(0, 0);
    const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({
      color: 0xffd27f, transparent: true, opacity: 0.55,
    }));
    trail.frustumCulled = false;

    const predGeo = new THREE.BufferGeometry();
    predGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(900 * 3), 3));
    predGeo.setDrawRange(0, 0);
    const pred = new THREE.Line(predGeo, new THREE.LineBasicMaterial({
      color: 0x7fdcff, transparent: true, opacity: 0.5,
    }));
    pred.frustumCulled = false;

    // launch-vector arrow shown while aiming
    const arrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 3, 0xffb35c, 0.9, 0.5,
    );
    arrow.visible = false;

    this.scene.add(mesh, trail, pred, arrow);

    const jd = BASE_JD + this.simDays;
    const ep = helioState('earth', jd);
    this.probe = {
      phase: 'aim', outcome: '', mission, target,
      s: { x: ep.x, y: ep.y, z: ep.z, vx: 0, vy: 0, vz: 0, jd },
      fuel: 8, closestAU: Infinity, prevDist: Infinity, launchJd: jd, score: null,
      mesh, beacon, arrow, trail, trailAttr: trailGeo.attributes.position as THREE.BufferAttribute,
      trailCount: 0, lastTrailPos: new THREE.Vector3(), pred,
      aiming: false, aimStart: { x: 0, y: 0 }, aimKms: 0,
      aimVec: new THREE.Vector3(1, 0, 0), lastPredAt: 0,
    };
    this.syncProbeMesh();

    // left mouse button is reserved for the launch drag while aiming
    this.controls.mouseButtons = {
      LEFT: undefined as unknown as THREE.MOUSE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    const earth = this.planets.find(p => p.spec.id === 'earth');
    if (earth) this.focusPlanet(earth);
    this.toast(STR[this.lang].toast.probeAim);
    this.emitSnapshot();
  }

  exitProbeMode() {
    if (!this.probe) return;
    this.scene.remove(this.probe.mesh, this.probe.trail, this.probe.pred, this.probe.arrow);
    this.probe.mesh.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.probe.trail.geometry.dispose();
    this.probe.pred.geometry.dispose();
    this.probe.arrow.dispose();
    this.probe = null;
    this.probeFollow = false;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    this.toast(STR[this.lang].toast.probeExit);
    this.emitSnapshot();
  }

  setProbeMission(mission: ProbeMission, target: string) {
    if (!this.probe) return;
    this.probe.mission = mission;
    this.probe.target = target;
    if (this.probe.phase !== 'flying') this.resetProbe();
  }

  // back to the aiming phase at Earth's current position
  resetProbe() {
    const pr = this.probe;
    if (!pr) return;
    const jd = BASE_JD + this.simDays;
    const ep = helioState('earth', jd);
    pr.s = { x: ep.x, y: ep.y, z: ep.z, vx: 0, vy: 0, vz: 0, jd };
    pr.phase = 'aim';
    pr.outcome = '';
    pr.fuel = 8;
    pr.closestAU = Infinity;
    pr.prevDist = Infinity;
    pr.score = null;
    pr.aimKms = 0;
    pr.trailCount = 0;
    pr.trail.geometry.setDrawRange(0, 0);
    pr.pred.geometry.setDrawRange(0, 0);
    pr.arrow.visible = false;
    this.syncProbeMesh();
    this.toast(STR[this.lang].toast.probeReset);
  }

  // aim drag — pointer move while aiming (called from bindPointer)
  private updateAim(clientX: number, clientY: number) {
    const pr = this.probe;
    if (!pr || pr.phase !== 'aim') return;
    const dx = clientX - pr.aimStart.x;
    const dy = clientY - pr.aimStart.y;
    const len = Math.hypot(dx, dy);
    pr.aimKms = Math.min((len / 420) * 20, 20);
    if (len > 4) {
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
      const v = right.multiplyScalar(dx).addScaledVector(up, -dy);
      v.y = 0; // lock to the ecliptic plane
      if (v.lengthSq() > 1e-6) pr.aimVec.copy(v.normalize());
    }
    // live prediction, throttled
    const now = performance.now();
    if (now - pr.lastPredAt > 90) {
      pr.lastPredAt = now;
      this.updatePrediction();
    }
    this.syncProbeArrow();
  }

  private launchStateFromAim(): ProbeState | null {
    const pr = this.probe;
    if (!pr) return null;
    const jd = BASE_JD + this.simDays;
    const ep = helioState('earth', jd);
    const ev = bodyVelocity('earth', jd);
    const dv = pr.aimKms * KMS_TO_AUDAY;
    // scene planar dir (x, 0, z) → ecliptic (x, z, 0)
    const dx = pr.aimVec.x, dy = pr.aimVec.z;
    return {
      x: ep.x + dx * 4.3e-4, y: ep.y + dy * 4.3e-4, z: ep.z,
      vx: ev[0] + dx * dv, vy: ev[1] + dy * dv, vz: ev[2],
      jd,
    };
  }

  private updatePrediction() {
    const pr = this.probe;
    if (!pr) return;
    const s0 = pr.phase === 'aim' ? this.launchStateFromAim() : { ...pr.s };
    if (!s0 || (pr.phase === 'aim' && pr.aimKms < 4)) {
      pr.pred.geometry.setDrawRange(0, 0);
      return;
    }
    const res = predictOrbit(s0);
    const attr = pr.pred.geometry.attributes.position as THREE.BufferAttribute;
    attr.array.set(res.points.subarray(0, res.count * 3));
    attr.needsUpdate = true;
    pr.pred.geometry.setDrawRange(0, res.count);
  }

  private launchProbe() {
    const pr = this.probe;
    if (!pr || pr.phase !== 'aim') return;
    if (pr.aimKms < 4) {
      this.toast(STR[this.lang].toast.probeMinSpeed);
      return;
    }
    const s0 = this.launchStateFromAim();
    if (!s0) return;
    pr.s = s0;
    pr.launchJd = s0.jd;
    pr.phase = 'flying';
    pr.trailCount = 0;
    pr.trail.geometry.setDrawRange(0, 0);
    pr.arrow.visible = false;
    this.updatePrediction();
    // chase the probe from ignition
    this.focus = null;
    this.probeFollow = true;
    this.probeSettle = true;
    this.pushLog(s0.jd, STR[this.lang].toast.probeLaunched + pr.aimKms.toFixed(1) + ' km/s');
    this.toast(STR[this.lang].toast.probeLaunched + pr.aimKms.toFixed(1) + ' km/s');
  }

  // mid-course correction burn, 0.3 km/s per click
  burnProbe(dir: 'pro' | 'retro' | 'radout' | 'radin' | 'norm' | 'normin') {
    const pr = this.probe;
    if (!pr || pr.phase !== 'flying') return;
    const DV = 0.3;
    if (pr.fuel < DV) {
      this.toast(STR[this.lang].toast.noFuel);
      return;
    }
    const s = pr.s;
    const v = Math.hypot(s.vx, s.vy, s.vz);
    const r = Math.hypot(s.x, s.y, s.z);
    let bx = 0, by = 0, bz = 0;
    if (dir === 'pro' || dir === 'retro') {
      const k = (dir === 'pro' ? 1 : -1) / v;
      bx = s.vx * k; by = s.vy * k; bz = s.vz * k;
    } else if (dir === 'radout' || dir === 'radin') {
      const k = (dir === 'radout' ? 1 : -1) / r;
      bx = s.x * k; by = s.y * k; bz = s.z * k;
    } else {
      // orbit normal = r × v
      let nx = s.y * s.vz - s.z * s.vy;
      let ny = s.z * s.vx - s.x * s.vz;
      let nz = s.x * s.vy - s.y * s.vx;
      const nl = Math.hypot(nx, ny, nz);
      if (nl < 1e-9) return;
      const k = (dir === 'norm' ? 1 : -1) / nl;
      bx = nx * k; by = ny * k; bz = nz * k;
    }
    const dv = DV * KMS_TO_AUDAY;
    s.vx += bx * dv; s.vy += by * dv; s.vz += bz * dv;
    pr.fuel -= DV;
    this.updatePrediction();
    this.toast(STR[this.lang].toast.burnDone);
  }

  private syncProbeMesh() {
    const pr = this.probe;
    if (!pr) return;
    const p = auToScenePos(pr.s.x, pr.s.y, pr.s.z);
    pr.mesh.position.set(p.x, p.y, p.z);
    if (pr.phase === 'aim') {
      // while aiming the probe sits at Earth's centre — lift the marker
      // toward the camera so it stays visible above the surface
      const earth = this.planets.find(pl => pl.spec.id === 'earth');
      const lift = (earth ? earth.spec.radius * this.params.planetScale : 1) + 0.8;
      const dir = this.camera.position.clone().sub(pr.mesh.position).normalize();
      pr.mesh.position.addScaledVector(dir, lift);
    }
  }

  // aim arrow from Earth along the chosen launch vector — refreshed every frame
  private syncProbeArrow() {
    const pr = this.probe;
    if (!pr) return;
    if (pr.phase !== 'aim' || pr.aimKms < 0.5) {
      pr.arrow.visible = false;
      return;
    }
    pr.arrow.visible = true;
    pr.arrow.position.copy(pr.mesh.position);
    pr.arrow.setDirection(pr.aimVec);
    pr.arrow.setLength(1.2 + pr.aimKms * 0.5, 0.9, 0.5);
  }

  private pushProbeTrail() {
    const pr = this.probe;
    if (!pr || pr.trailCount >= 12000) return;
    const p = auToScenePos(pr.s.x, pr.s.y, pr.s.z);
    if (pr.trailCount > 0 && pr.lastTrailPos.distanceToSquared(new THREE.Vector3(p.x, p.y, p.z)) < 0.002) return;
    pr.trailAttr.setXYZ(pr.trailCount, p.x, p.y, p.z);
    pr.trailAttr.needsUpdate = true;
    pr.trailCount++;
    pr.lastTrailPos.set(p.x, p.y, p.z);
    pr.trail.geometry.setDrawRange(0, pr.trailCount);
  }

  private endProbe(outcome: string, success: boolean) {
    const pr = this.probe;
    if (!pr || pr.phase !== 'flying') return;
    pr.phase = success ? 'success' : 'fail';
    pr.outcome = outcome;
    const elapsedYr = (pr.s.jd - pr.launchJd) / 365.25;
    if (success) {
      let score = 0;
      if (outcome === 'flyby') {
        const th = FLYBY_THRESHOLD_AU[pr.target] ?? 0.05;
        score = 500 + 400 * Math.max(0, 1 - pr.closestAU / th);
      } else if (outcome === 'impact') score = 500;
      else if (outcome === 'captured') score = 900;
      score += pr.fuel * 30;                 // fuel conservation bonus
      score -= elapsedYr * 25;               // faster is better
      pr.score = Math.max(0, Math.round(score));
    } else {
      pr.score = 0;
    }
    const key = success ? ('out_' + outcome) : 'out_fail';
    const t = STR[this.lang].toast as unknown as Record<string, string>;
    const msg = (success ? t[key] : t.out_fail) ?? outcome;
    this.pushLog(pr.s.jd, msg);
    this.toast(msg);
  }

  private hillRadius(id: string): number {
    const el = ELEMENTS[id];
    const mu = PLANET_MU[id];
    if (!el || !mu) return 0.01;
    return el.a * Math.pow(mu / (3 * MU_SUN), 1 / 3);
  }

  private updateProbe() {
    const pr = this.probe;
    if (!pr) return;

    if (pr.phase === 'flying') {
      const jdTarget = BASE_JD + this.simDays;
      // sim clock jumped backwards — reset to aiming
      if (pr.s.jd - jdTarget > 2) {
        this.resetProbe();
        return;
      }
      let steps = 0;
      let sinceTrail = 0;
      while (pr.s.jd < jdTarget - 1e-9 && steps < 3000 && pr.phase === 'flying') {
        const dt = Math.min(adaptiveDt(pr.s), jdTarget - pr.s.jd);
        stepProbe(pr.s, dt);
        steps++;
        sinceTrail += dt;
        // sample the trail *during* integration so high time-warp stays smooth
        if (sinceTrail >= 2) { sinceTrail = 0; this.pushProbeTrail(); }
        this.checkProbeEncounters();
      }
      this.syncProbeMesh();
      this.pushProbeTrail();
      // dish tracks the Sun (Earth relay) while cruising; beacon blinks
      pr.mesh.lookAt(0, 0, 0);
      const bm = pr.beacon.material as THREE.SpriteMaterial;
      bm.opacity = 0.25 + 0.75 * Math.abs(Math.sin(this.pulseT * 4));
    } else if (pr.phase === 'aim') {
      // keep the probe glued to Earth while aiming
      const jd = BASE_JD + this.simDays;
      const ep = helioState('earth', jd);
      pr.s.x = ep.x; pr.s.y = ep.y; pr.s.z = ep.z; pr.s.jd = jd;
      this.syncProbeMesh();
      this.syncProbeArrow();
    }
  }

  private checkProbeEncounters() {
    const pr = this.probe;
    if (!pr || pr.phase !== 'flying') return;
    const s = pr.s;
    const r = Math.hypot(s.x, s.y, s.z);
    if (r < 0.02) return this.endProbe('sun', false);
    if (r > 80) return this.endProbe('escaped', false);

    // impacts against any body
    for (const id in PLANET_RADIUS_AU) {
      const d = distToBody(s, id);
      if (d < PLANET_RADIUS_AU[id] * 5) {
        if (id === pr.target && pr.mission === 'impact') return this.endProbe('impact', true);
        if (id === pr.target) return this.endProbe('impact', false); // crashed instead of flying by
        return this.endProbe('wrongbody', false);
      }
    }

    if (pr.target === 'free' || !PLANET_RADIUS_AU[pr.target]) { pr.prevDist = Infinity; return; }
    const d = distToBody(s, pr.target);
    if (d < pr.closestAU) pr.closestAU = d;

    if (pr.mission === 'flyby') {
      const th = FLYBY_THRESHOLD_AU[pr.target] ?? 0.05;
      // success at the moment we start receding inside the threshold
      if (d > pr.prevDist && pr.closestAU < th) return this.endProbe('flyby', true);
    } else if (pr.mission === 'captured') {
      const hill = this.hillRadius(pr.target);
      const mu = PLANET_MU[pr.target];
      if (d < hill * 0.5) {
        const vescKms = Math.sqrt(2 * mu / Math.max(d, 1e-6)) * AUDAY_TO_KMS;
        if (relSpeedKms(s, pr.target) < vescKms * 0.95) return this.endProbe('captured', true);
      }
    }
    pr.prevDist = d;
  }

  getProbeTelemetry(): ProbeTelemetry | null {
    const pr = this.probe;
    if (!pr) return null;
    const speed = Math.hypot(pr.s.vx, pr.s.vy, pr.s.vz) * AUDAY_TO_KMS;
    return {
      active: true,
      phase: pr.phase,
      outcome: pr.outcome,
      mission: pr.mission,
      target: pr.target,
      fuel: Math.round(pr.fuel * 10) / 10,
      fuelMax: 8,
      speedKms: Math.round(speed * 10) / 10,
      distTargetAU: pr.target !== 'free' ? Math.round(distToBody(pr.s, pr.target) * 1000) / 1000 : null,
      closestAU: pr.closestAU === Infinity ? null : Math.round(pr.closestAU * 10000) / 10000,
      elapsedYr: Math.round(((pr.s.jd - pr.launchJd) / 365.25) * 100) / 100,
      aimKms: Math.round(pr.aimKms * 10) / 10,
      score: pr.score,
      following: this.probeFollow,
    };
  }

  getSnapshot(): HudSnapshot {
    const zh = this.lang === 'zh';
    const shot = CINE_SHOTS[this.cineShot];
    return {
      cine: this.cine,
      orbit: this.orbit,
      labels: this.labelsOn,
      sound: this.ambience.isOn,
      ephemeris: this.ephemOn,
      expert: this.expert,
      surfaceId: this.surface ? this.surface.node.spec.id : '',
      well: this.well !== null,
      lagrange: this.lagrangeGroup !== null,
      hill: this.hillOn,
      globeId: this.globe?.node.spec.id ?? '',
      globeGrid: this.globeGridOn,
      globeFill: this.globeFillOn,
      globeLabels: this.globeLabelsOn,
      globeSpin: this.globeSpinOn,
      galaxy: this.galaxy !== null,
      gxTrans: this.gxTrans !== null,
      galaxyLabels: this.galaxyLabelsOn,
      galaxyObserve: this.galaxyObserve,
      gxFocus: this.gxFocus
        ? { id: this.gxFocus.poi.id, name: this.gxFocus.poi.name, nameCn: this.gxFocus.poi.nameCn,
            desc: this.gxFocus.poi.desc, descCn: this.gxFocus.poi.descCn }
        : null,
      experiment: this.experiment !== null,
      bloom: this.bloomOn,
      shotName: this.cine ? (zh ? shot.nameCn : shot.name) : '',
      focusId: this.focus?.spec.id ?? 'sun',
      focusName: this.focus ? this.planetName(this.focus) : STR[this.lang].sun,
      focusFact: this.focus
        ? (zh
          ? `${this.focus.spec.cn} · ${this.focus.spec.name} — ${this.focus.spec.factCn}`
          : `${this.focus.spec.name} · ${this.focus.spec.cn} — ${this.focus.spec.fact}`)
        : '',
      viewName: '',
      params: { ...this.params },
    };
  }

  emitSnapshot(viewName = '') {
    const s = this.getSnapshot();
    s.viewName = viewName;
    this.onSnapshot?.(s);
  }

  private toast(msg: string) { this.onToast?.(msg); }

  private startTween(toPos: THREE.Vector3, toTgt: THREE.Vector3, dur: number, after?: () => void) {
    this.tween = {
      t: 0, dur,
      fromPos: this.camera.position.clone(), toPos,
      fromTgt: this.controls.target.clone(), toTgt,
      after,
    };
  }

  // ------------------------------------------------------------- main loop
  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const rawDt = this.lastTime === 0 ? 0.016 : (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.25);
    this.stepMission(dt);
    this.speed = this.params.speed;
    const simDt = dt * this.speed;
    this.simDays += simDt * DAYS_PER_SECOND;

    // orbital mechanics
    const jd = BASE_JD + this.simDays;
    this.watchEvents(jd);
    if (this.experiment) this.updateExperiment(jd);
    for (const p of this.planets) {
      if (p.spec.id === 'moon') {
        // lunar position: earth pos + offset rotating with the sun-earth line
        const earth = this.planets.find(pl => pl.spec.id === 'earth');
        if (earth && this.moonNode) {
          const epos = earth.body.position;
          const A = (Math.PI * 2 * (jd - NEW_MOON_JD)) / MOON_PERIOD_DAYS;
          const I = p.spec.inclination * DEG;
          p.pivot.position.copy(epos);
          p.pivot.rotation.y = -Math.atan2(epos.z, epos.x);
          p.body.position.set(
            -Math.cos(A) * MOON_SCENE_R,
            Math.sin(A) * Math.sin(I) * MOON_SCENE_R,
            Math.sin(A) * Math.cos(I) * MOON_SCENE_R,
          );
          p.mesh.rotation.y = -A; // tidally locked
          // shells: hill cage obeys the layer toggle; fresnel halo is a focus highlight
          const onMoonSurface = this.surface?.node === p;
          if (this.moonHill) this.moonHill.visible = this.hillOn && !onMoonSurface && (!this.globe || this.globe.node.spec.id === 'earth' || this.globe.node.spec.id === 'moon');
          if (this.moonHalo) {
            const hm = this.moonHalo.material as THREE.ShaderMaterial;
            const want = this.focus === p && !onMoonSurface ? 0.65 : 0;
            hm.uniforms.uStrength.value += (want - hm.uniforms.uStrength.value) * Math.min(1, dt * 3);
          }
        }
      } else if (MOON_SYS_IDS.has(p.spec.id)) {
        // moon-system bodies: showcase clock (real-time, period-proportional),
        // tidally locked, riding their host's position
        const ms = p.spec as MoonSysSpec;
        const host = this.planets.find(pl => pl.spec.id === ms.host);
        if (host) {
          p.pivot.position.copy(host.body.position);
          const A = this.pulseT * ((Math.PI * 2) / ms.showSecs) + ms.phase;
          const I = ms.inclination * DEG;
          p.body.position.set(
            Math.cos(A) * ms.distance,
            Math.sin(A) * Math.sin(I) * ms.distance,
            Math.sin(A) * Math.cos(I) * ms.distance,
          );
          p.mesh.rotation.y = -A; // tidally locked
          const halo = this.moonHalos.get(p.spec.id);
          if (halo) {
            const hm = halo.material as THREE.ShaderMaterial;
            const want = this.focus === p && !this.globe ? 0.65 : 0;
            hm.uniforms.uStrength.value += (want - hm.uniforms.uStrength.value) * Math.min(1, dt * 3);
          }
          if (p.orbitRing) p.orbitRing.visible = this.globe?.node !== p && this.surface?.node !== p;
        }
      } else if (p.spec.id === 'orbiter') {
        // pivot glued to the Moon; real-time polar showcase orbit (not sim-clock)
        const moon = this.moonNode;
        if (moon) {
          moon.body.getWorldPosition(p.pivot.position);
          const R = Math.max(moon.spec.radius * this.params.planetScale + 0.05, 0.31);
          const A = this.pulseT * ((Math.PI * 2) / 12); // ~12 s per revolution
          p.body.position.set(Math.cos(A) * R, Math.sin(A) * R, 0);
          const hide = !!this.surface && (this.surface.node === moon || this.surface.node === p);
          p.body.visible = !hide;
          if (p.orbitRing) { p.orbitRing.visible = !hide; p.orbitRing.scale.setScalar(R); }
        }
      } else if (p.spec.id === 'iss') {
        const earth = this.planets.find(pl => pl.spec.id === 'earth');
        if (earth) {
          const epos = earth.body.position;
          p.pivot.position.copy(epos);
          p.pivot.rotation.y = -Math.atan2(epos.z, epos.x);
          // keep clear of the (possibly upscaled) Earth, then showcase-orbit
          const R = Math.max(ISS_SCENE_R, earth.spec.radius * this.params.planetScale + 0.55);
          const A = this.pulseT * ((Math.PI * 2) / 16); // ~16 s per revolution, real time
          const I = p.spec.inclination * DEG;
          p.body.position.set(
            Math.cos(A) * R,
            Math.sin(A) * Math.sin(I) * R,
            Math.sin(A) * Math.cos(I) * R,
          );
          if (p.orbitRing) p.orbitRing.scale.setScalar(R);
        }
      } else if (p.spec.id === 'halley') {
        const pos = halleyScenePos(this.simDays);
        p.body.position.set(pos.x, pos.y, pos.z);
        this.updateCometTail(p.body.position);
      } else if (p.spec.id === 'voyager1' || p.spec.id === 'voyager2') {
        if (this.mission && this.mission.node === p) continue; // replay drives it
        const rec = this.voyagers.find(r => r.v.id === p.spec.id);
        if (rec) {
          const pos = voyagerScenePos(rec.v, this.simDays);
          p.body.position.set(pos.x, pos.y, pos.z);
          rec.craft.lookAt(0, 0, 0); // high-gain dish tracks Earth/Sun
          const au = voyagerAU(rec.v, this.simDays);
          if (Math.abs(au - rec.lastAu) >= 0.05 && p.label) {
            rec.lastAu = au;
            p.label.textContent = `${this.lang === 'zh' ? p.spec.cn : p.spec.name} · ${au.toFixed(1)} AU`;
          }
        }
      } else if (this.experiment && PLANET_MU[p.spec.id] !== undefined) {
        // position already driven by the N-body experiment integrator
      } else if (this.ephemOn) {
        const { lon, lat } = helioLonLat(p.spec.id, jd);
        const d = p.spec.distance;
        p.body.position.set(Math.cos(lon) * d, Math.sin(lat) * d, Math.sin(lon) * d);
      } else {
        p.angle += (simDt / p.period) * Math.PI * 2;
        p.body.position.set(Math.cos(p.angle) * p.spec.distance, 0, Math.sin(p.angle) * p.spec.distance);
      }
      p.mesh.rotation.y += simDt * p.spec.spin * 0.9;
    }
    // Trojan camps: keep the ±60° Lagrange geometry against Jupiter's live position
    if (this.trojanGroup) {
      const jup = this.planets.find(pl => pl.spec.id === 'jupiter');
      if (jup) {
        const jp = jup.body.getWorldPosition(new THREE.Vector3());
        this.trojanGroup.rotation.y = -Math.atan2(jp.z, jp.x);
      }
    }
    if (this.globe) {
      const g = this.globe.node;
      if (this.globeSpinOn) {
        if (g.spec.id === 'moon') g.mesh.rotation.y -= dt * ((Math.PI * 2) / MOON_PERIOD_DAYS) * DAYS_PER_SECOND;
        else g.mesh.rotation.y += dt * g.spec.spin * 0.9;
      }
      if (this.globeTerm && this.globeFillOn) {
        const wp = g.body.getWorldPosition(new THREE.Vector3());
        ((this.globeTerm.material as THREE.ShaderMaterial).uniforms.uSunDir.value as THREE.Vector3).copy(wp).negate().normalize();
      }
      this.updateGlobeLabels();
    }
    if (this.galaxyGroup && this.galaxyLabels.length) {
      if (this.galaxy) {
        this.galaxyGroup.rotation.y += dt * 0.012; // gentle, perceptible drift
        if (this.galaxySun && !this.gxTrans) this.galaxySun.scale.setScalar(3.2 + Math.sin(this.pulseT * 3) * 0.9);
        // cosmetic shimmer on star-forming knots & dense cores (pure dressing, marked as such)
        if (this.gxPulse.length && !this.gxTrans) {
          for (const P of this.gxPulse) P.mat.opacity = P.base * (1 + P.amp * Math.sin(this.pulseT * P.speed + P.phase));
        }
        // far-view glow anchors are a distance crutch — dim them as the camera closes in
        if (this.gxGlowDim.length && !this.gxTrans) {
          for (const G of this.gxGlowDim) {
            const w = this.galaxyGroup.localToWorld(G.pos.clone());
            const d = w.distanceTo(this.camera.position);
            G.mat.opacity = G.base * THREE.MathUtils.clamp((d - 30) / 70, 0.08, 1);
          }
        }
        // companion-focus tracking: the galaxy rotates, so the focused cloud drifts —
        // ease the orbit target to its live world position and carry the camera along
        if (this.gxFocus && !this.gxTrans && !this.tween) {
          const w = this.gxFocus.anchor.getWorldPosition(new THREE.Vector3());
          const prev = this.controls.target.clone();
          this.controls.target.lerp(w, 1 - Math.exp(-dt * 3));
          this.camera.position.add(this.controls.target.clone().sub(prev));
        }
      }
      this.updateGalaxyLabels(); // its own guard hides labels off-mode / mid-transition
    }
    this.updateGxTransition(dt);
    this.updateDustShell(dt);
    this.drawWarp(dt);
    this.updateCometTrail();
    this.updateProbe();
    this.updateLagrange();
    this.sun.rotation.y += simDt * 0.02;
    this.belt.rotation.y += simDt * 0.012;
    this.kuiper.rotation.y += simDt * 0.004;
    this.updateEclipseRig();
    // heliopause brightens while a Voyager holds the spotlight
    if (this.heliopause) {
      const hot = this.focus && (this.focus.spec.id === 'voyager1' || this.focus.spec.id === 'voyager2');
      const hm = this.heliopause.material as THREE.MeshBasicMaterial;
      const want = hot ? 0.16 : 0.04;
      hm.opacity += (want - hm.opacity) * Math.min(1, dt * 3);
    }
    // keep the belt clear of the planets at any planetScale: shrink the whole
    // ring inward if Jupiter's *visual* radius would otherwise reach it
    {
      const jup = this.planets.find(p => p.spec.id === 'jupiter');
      const mars = this.planets.find(p => p.spec.id === 'mars');
      if (jup && mars) {
        const jupEdge = jup.spec.distance - jup.spec.radius * this.params.planetScale - 0.9;
        const marsEdge = mars.spec.distance + mars.spec.radius * this.params.planetScale + 0.9;
        const sOuter = jupEdge / 39.0;   // belt rocks live at 33.8–39.0
        const s = THREE.MathUtils.clamp(Math.min(1, sOuter), marsEdge / 33.8, 1);
        this.belt.scale.setScalar(s);
      }
    }
    if (this.earthClouds) this.earthClouds.rotation.y += simDt * 1.25 * 0.9;

    // solar corona breathing
    this.pulseT += dt;
    if (this.sunGlow1) this.sunGlow1.scale.setScalar(SUN_RADIUS * 4.2 * (1 + 0.03 * Math.sin(this.pulseT * 1.7)) * this.gxSunK);
    if (this.sunGlow2) this.sunGlow2.scale.setScalar(SUN_RADIUS * 8.5 * (1 + 0.05 * Math.sin(this.pulseT * 0.9 + 1.3)) * this.gxSunK);

    // camera modes
    if (this.surface) this.updateSurface();
    else if (this.cine) this.updateCine(dt);
    else if (this.tween) this.updateTween(dt);
    else if (this.probeFollow && this.probe) this.followProbeCam(dt);
    else if (this.focus) this.followFocus(dt);

    if (this.orbit && !this.cine) {
      const offset = this.camera.position.clone().sub(this.controls.target);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.05);
      this.camera.position.copy(this.controls.target).add(offset);
    }

    if (!this.cine) this.controls.update();

    // labels
    if (this.labelsOn) this.updateLabels();

    // fps + telemetry @ 5 Hz (fps measured on real elapsed time)
    this.fpsAcc += rawDt; this.fpsN++; this.fpsTimer += rawDt; this.telTimer += rawDt;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.fpsN / this.fpsAcc);
      this.fpsAcc = 0; this.fpsN = 0; this.fpsTimer = 0;
      this.ambience.setFlow(Math.abs(this.speed * DAYS_PER_SECOND));
      // bloom auto-degrade: sustained low fps → disable + notify once
      if (this.bloomOn && this.bloomAuto && this.fps > 0 && this.fps < 26) {
        this.fpsLowT += 0.5;
        if (this.fpsLowT >= 3) {
          this.bloomAuto = false;
          this.setBloom(false);
          this.toast(STR[this.lang].toast.bloomAutoOff);
        }
      } else this.fpsLowT = 0;
    }
    if (this.telTimer >= 0.2) {
      this.telTimer = 0;
      const focusVoy = this.focus && (this.focus.spec.id === 'voyager1' || this.focus.spec.id === 'voyager2')
        ? VOYAGERS.find(v => v.id === this.focus!.spec.id) : undefined;
      this.onTelemetry?.({
        fps: this.fps,
        distAU: this.camera.position.distanceTo(this.controls.target) / AU_UNITS,
        flow: this.speed * DAYS_PER_SECOND,
        simDays: this.simDays,
        focusAU: focusVoy ? voyagerAU(focusVoy, this.simDays) : null,
        probe: this.getProbeTelemetry(),
        mission: this.mission ? {
          craft: this.mission.spec.craft,
          t: this.mission.t,
          playing: this.mission.playing,
          eventIdx: this.mission.eventIdx,
        } : null,
      });
    }

    if (this.bloomOn && this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  };

  // comet tail — soft shader particles streaming away from the Sun
  private updateCometTail(nucleus: THREE.Vector3) {
    if (!this.halley) return;
    const geo = this.halley.tail.geometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const aT = geo.attributes.aT as THREE.BufferAttribute;
    const aSeed = geo.attributes.aSeed as THREE.BufferAttribute;
    const aJit = geo.attributes.aJit as THREE.BufferAttribute;
    const aIon = geo.attributes.aIon as THREE.BufferAttribute;
    const r = nucleus.length();
    const L = THREE.MathUtils.clamp(620 / (r * r), 1.2, 13);
    const dir = nucleus.clone().normalize();
    const perp = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
    if (perp.lengthSq() < 1e-6) perp.set(1, 0, 0);
    perp.normalize();
    const perp2 = new THREE.Vector3().crossVectors(dir, perp).normalize();
    const time = this.pulseT;
    const n = pos.count;
    for (let i = 0; i < n; i++) {
      const t = aT.getX(i);
      const seed = aSeed.getX(i);
      const ion = aIon.getX(i);
      const Li = ion > 0.5 ? L * 1.6 : L;
      const spreadBase = ion > 0.5 ? 0.05 : 0.24;
      const spread = t * Li * spreadBase * (0.5 + 0.9 * seed);
      const wob = Math.sin(time * 2.4 + seed * 43.0) * 0.1 * t * Li;
      const j1 = aJit.getX(i) * spread * 2 + wob;
      const j2 = aJit.getY(i) * spread * 2;
      pos.setXYZ(i,
        nucleus.x + dir.x * Li * t + perp.x * j1 + perp2.x * j2,
        nucleus.y + dir.y * Li * t + perp.y * j1 + perp2.y * j2,
        nucleus.z + dir.z * Li * t + perp.z * j1 + perp2.z * j2);
    }
    pos.needsUpdate = true;
    this.halley.tailMat.uniforms.uOpacity.value = THREE.MathUtils.clamp(26 / (r * r) + 0.18, 0.18, 0.9);
    this.halley.coma.scale.setScalar(2.2 * THREE.MathUtils.clamp(18 / r, 0.6, 2.4));
  }

  // comet trail — recent path through the system
  private updateCometTrail() {
    if (!this.halley) return;
    const pts = this.halley.trailPts;
    const cur = this.halley.node.body.position;
    const last = pts[pts.length - 1];
    if (!last) {
      pts.push(cur.clone());
      this.halleyLastDay = this.simDays;
    } else {
      const gap = last.distanceTo(cur);
      if (gap < 0.15) return;
      // backfill intermediate samples so high time-warp still draws a smooth
      // curve instead of long straight chords
      const daySpan = this.simDays - this.halleyLastDay;
      const n = Math.min(Math.max(Math.ceil(gap / 1.2), 1), 24);
      for (let i = 1; i <= n; i++) {
        const d = this.halleyLastDay + (daySpan * i) / n;
        const p = halleyScenePos(d);
        pts.push(new THREE.Vector3(p.x, p.y, p.z));
        if (pts.length > 220) pts.shift();
      }
      this.halleyLastDay = this.simDays;
    }
    const attr = this.halley.trail.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pts.length; i++) attr.setXYZ(i, pts[i].x, pts[i].y, pts[i].z);
    attr.needsUpdate = true;
    this.halley.trail.geometry.setDrawRange(0, pts.length);
  }

  private updateCine(dt: number) {
    const shot = CINE_SHOTS[this.cineShot];
    this.cineTime += dt;
    if (this.cineTime >= shot.duration) {
      this.cineShot = (this.cineShot + 1) % CINE_SHOTS.length;
      this.cineTime = 0;
      this.emitSnapshot();
    }
    const s = CINE_SHOTS[this.cineShot];
    this.cineAz += s.drift * dt;

    // resolve target world position
    const node = this.planets.find(p => p.spec.id === s.targetId);
    const desired = new THREE.Vector3();
    if (node) desired.copy(node.body.getWorldPosition(new THREE.Vector3()));
    this.cineTarget.lerp(desired, 1 - Math.exp(-dt * 1.6));

    const az = this.cineAz * DEG;
    const el = s.inclination * DEG;
    const camDesired = new THREE.Vector3(
      Math.cos(el) * Math.cos(az),
      Math.sin(el),
      Math.cos(el) * Math.sin(az),
    ).multiplyScalar(s.radius).add(this.cineTarget);

    this.camera.position.lerp(camDesired, 1 - Math.exp(-dt * 1.8));
    this.camera.lookAt(this.cineTarget);
    this.controls.target.copy(this.cineTarget);
  }

  private updateTween(dt: number) {
    const tw = this.tween!;
    tw.t += dt / tw.dur;
    const k = easeInOut(Math.min(1, tw.t));
    this.camera.position.lerpVectors(tw.fromPos, tw.toPos, k);
    this.controls.target.lerpVectors(tw.fromTgt, tw.toTgt, k);
    if (tw.t >= 1) {
      this.tween = null;
      tw.after?.();
    }
  }

  private followFocus(dt: number) {
    const node = this.focus!;
    const world = node.body.getWorldPosition(new THREE.Vector3());
    const prevTarget = this.controls.target.clone();
    this.controls.target.lerp(world, 1 - Math.exp(-dt * 5));
    const delta = this.controls.target.clone().sub(prevTarget);
    this.camera.position.add(delta);

    // only ease to the framing distance during the initial approach —
    // after that (or as soon as the user grabs the camera) they own the zoom
    if (this.focusSettle) {
      const desired = node.spec.radius * this.params.planetScale * 6 + 1.2;
      const offset = this.camera.position.clone().sub(this.controls.target);
      const d = offset.length();
      const newD = THREE.MathUtils.lerp(d, desired, 1 - Math.exp(-dt * 1.5));
      offset.setLength(newD);
      this.focusOffset.copy(offset);
      this.camera.position.copy(this.controls.target).add(offset);
      if (Math.abs(newD - desired) < 0.05) this.focusSettle = false;
    }
  }

  private updateLabels() {
    const w = window.innerWidth, h = window.innerHeight;
    const v = new THREE.Vector3();
    for (const p of this.planets) {
      const el = p.label!;
      if (this.galaxy || this.gxTrans) { el.style.opacity = '0'; continue; }
      if (this.globe && !this.globe.sys.has(p.spec.id)) { el.style.opacity = '0'; continue; }
      p.body.getWorldPosition(v);
      const dist = v.distanceTo(this.camera.position);
      v.project(this.camera);
      if (v.z > 1 || v.z < -1) { el.style.opacity = '0'; continue; }
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      el.style.transform = `translate(-50%,-140%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      const a = THREE.MathUtils.clamp(1.4 - dist / 160, 0.15, 0.9);
      el.style.opacity = a.toFixed(2);
    }
    // heliopause label sits on the bubble's crown; only meaningful zoomed out
    if (this.heliopause && this.helioLabel) {
      const el = this.helioLabel;
      if (this.galaxy || this.gxTrans || this.globe || !this.heliopause.visible) { el.style.opacity = '0'; }
      else {
        v.set(0, 118, 0);
        const dist = v.distanceTo(this.camera.position);
        v.project(this.camera);
        if (v.z > 1 || v.z < -1) { el.style.opacity = '0'; }
        else {
          const x = (v.x * 0.5 + 0.5) * w;
          const y = (-v.y * 0.5 + 0.5) * h;
          el.style.transform = `translate(-50%,-140%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
          el.style.opacity = THREE.MathUtils.clamp((dist - 150) / 160, 0, 0.7).toFixed(2);
        }
      }
    }
    // Trojan camp labels ride their anchors (the group tracks Jupiter live)
    if (this.trojanGroup) {
      for (const tl of this.trojanLabels) {
        const el = tl.el;
        if (this.galaxy || this.gxTrans || this.globe) { el.style.opacity = '0'; continue; }
        tl.anchor.getWorldPosition(v);
        const dist = v.distanceTo(this.camera.position);
        v.project(this.camera);
        if (v.z > 1 || v.z < -1) { el.style.opacity = '0'; continue; }
        const x = (v.x * 0.5 + 0.5) * w;
        const y = (-v.y * 0.5 + 0.5) * h;
        el.style.transform = `translate(-50%,-140%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
        el.style.opacity = THREE.MathUtils.clamp(1.5 - dist / 160, 0.1, 0.8).toFixed(2);
      }
    }
    // Lagrange-point labels ride their markers
    if (this.lagrangeGroup && this.lagLabels.length > 0) {
      const markers = this.lagrangeGroup.children.filter(c => (c as THREE.Mesh).geometry?.type === 'OctahedronGeometry');
      for (let i = 0; i < markers.length && i < this.lagLabels.length; i++) {
        const el = this.lagLabels[i];
        markers[i].getWorldPosition(v);
        const dist = v.distanceTo(this.camera.position);
        v.project(this.camera);
        if (v.z > 1 || v.z < -1) { el.style.opacity = '0'; continue; }
        const x = (v.x * 0.5 + 0.5) * w;
        const y = (-v.y * 0.5 + 0.5) * h;
        el.style.transform = `translate(-50%,-190%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
        el.style.opacity = THREE.MathUtils.clamp(1.5 - dist / 140, 0.1, 0.85).toFixed(2);
      }
    }
  }

  getSimDate(): Date {
    return new Date(BASE_DATE + this.simDays * 86400000);
  }

  dispose() {
    this.disposed = true;
    if (this.experiment) this.resetExperiment(true);
    if (this.lagrangeGroup) this.toggleLagrange();
    if (this.well) this.toggleWell();
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.controls.dispose();
    this.renderer.dispose();
    this.scene.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(m => m.dispose());
      else mat?.dispose();
    });
    this.labelLayer.innerHTML = '';
  }
}
