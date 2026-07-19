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
  ASTEROID_SPECS, ISS_SPEC, ISS_SCENE_R, ORBITER_SPEC } from './data';
import type { PlanetSpec } from './data';
import { planetTexture, sunTexture, ringTexture, glowSprite, loadRealTextures } from './textures';
import type { TextureSet } from './textures';
import { Ambience } from './audio';
import { STR } from './i18n';
import type { Lang } from './i18n';
import { BASE_JD, helioLonLat, helioState, halleyScenePos, VOYAGERS, voyagerAU, voyagerScenePos, ELEMENTS } from './ephem';
import { listUpcoming, solveEvent } from './events';
import type { AstroEvent, EventType } from './events';
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
  private sun!: THREE.Mesh;
  private moonNode: PlanetNode | null = null;
  private hillOn = false;
  private moonHill: THREE.Mesh | null = null;   // wireframe cage: gravitational domain
  private moonHalo: THREE.Mesh | null = null;   // fresnel shell: focus highlight
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
  private trojans: THREE.Points[] = [];
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
    for (const spec of [...PLANETS, ...ASTEROID_SPECS]) {
      const node = this.makePlanet(spec);
      this.planets.push(node);
      if (spec.id === 'earth') this.earthNode = node;
      void this.earthNode; // reserved for surface-view batch
    }

    // asteroid belt between Mars (30) and Jupiter (43)
    this.belt = this.makeBelt(2400, 33.8, 39.0);
    this.scene.add(this.belt);

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
  private makeBelt(count: number, inner: number, outer: number): THREE.Group {
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
      const y = (Math.random() - 0.5) * 1.7;
      dummy.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      const s = 0.05 + Math.pow(Math.random(), 2.6) * 0.34; // many small, few large
      dummy.scale.set(s * (0.75 + Math.random() * 0.5), s, s * (0.75 + Math.random() * 0.5));
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
      col.setHSL(0.07 + Math.random() * 0.05, 0.08 + Math.random() * 0.16, 0.16 + Math.random() * 0.26);
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
    this.voyagers.forEach(r => { r.lastAu = -1; }); // force live-range refresh
    this.emitSnapshot();
  }

  private planetName(node: PlanetNode): string {
    return this.lang === 'zh' ? node.spec.cn : node.spec.name;
  }

  toggleCine() { this.setCine(!this.cine); }

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
    if (!v) return;
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
    this.simDays = (d.getTime() - BASE_DATE) / 86400000;
    if (this.experiment) this.resetExperiment(true); // integrated state can't time-jump
    this.eventCache = null;
    this.lastEventJd = null;
    this.resetHalleyTrail();
    this.emitSnapshot();
  }

  // Scrub relative to the current sim day (timeline dragging).
  scrubToDay(day: number) {
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
    if (this.surface) this.exitSurfaceView(true);
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
      this.trojans = [];
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
      // Trojan swarms around Jupiter's L4 / L5
      for (const li of [4, 5]) {
        const n = 400;
        const arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const rr = Math.sqrt(Math.random()) * 3.5;
          arr[i * 3] = Math.cos(a) * rr;
          arr[i * 3 + 1] = (Math.random() * 2 - 1) * 1.2;
          arr[i * 3 + 2] = Math.sin(a) * rr;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        const pts = new THREE.Points(geo, new THREE.PointsMaterial({
          color: 0xd8c49a, size: 0.14, transparent: true, opacity: 0.8, depthWrite: false,
        }));
        pts.userData = { pid: 'jupiter', li };
        this.trojans.push(pts);
        g.add(pts);
      }
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
    if (this.experiment) return;
    if (this.probe) this.exitProbeMode();
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
    if (this.experiment) { this.toast(STR[this.lang].toast.expNoProbe); return; }
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
          if (this.moonHill) this.moonHill.visible = this.hillOn && !onMoonSurface;
          if (this.moonHalo) {
            const hm = this.moonHalo.material as THREE.ShaderMaterial;
            const want = this.focus === p && !onMoonSurface ? 0.65 : 0;
            hm.uniforms.uStrength.value += (want - hm.uniforms.uStrength.value) * Math.min(1, dt * 3);
          }
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
    this.updateCometTrail();
    this.updateProbe();
    this.updateLagrange();
    this.sun.rotation.y += simDt * 0.02;
    this.belt.rotation.y += simDt * 0.012;
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
    if (this.sunGlow1) this.sunGlow1.scale.setScalar(SUN_RADIUS * 4.2 * (1 + 0.03 * Math.sin(this.pulseT * 1.7)));
    if (this.sunGlow2) this.sunGlow2.scale.setScalar(SUN_RADIUS * 8.5 * (1 + 0.05 * Math.sin(this.pulseT * 0.9 + 1.3)));

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
