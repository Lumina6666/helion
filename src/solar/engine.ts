// HELION engine — Three.js solar system simulation.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  PLANETS, SUN_RADIUS, AU_UNITS, DAYS_PER_SECOND,
  keplerPeriod, CINE_SHOTS, VIEWS, HALLEY_SPEC, VOYAGER_SPECS,
} from './data';
import type { PlanetSpec } from './data';
import { planetTexture, sunTexture, ringTexture, glowSprite, loadRealTextures } from './textures';
import type { TextureSet } from './textures';
import { Ambience } from './audio';
import { STR } from './i18n';
import type { Lang } from './i18n';
import { BASE_JD, helioLonLat, halleyScenePos, VOYAGERS, voyagerAU, voyagerScenePos } from './ephem';
import { listUpcoming, solveEvent } from './events';
import type { AstroEvent, EventType } from './events';
import type { VoyagerSpec } from './ephem';

export interface HudSnapshot {
  cine: boolean;
  orbit: boolean;
  labels: boolean;
  sound: boolean;
  ephemeris: boolean;
  shotName: string;
  focusId: string;
  focusName: string;
  focusFact: string;
  viewName: string;
  params: { speed: number; orbitOpacity: number; planetScale: number; starfield: number };
}

export interface Telemetry {
  fps: number;
  distAU: number;
  flow: number;
  simDays: number;
  focusAU: number | null;
}

const BASE_DATE = Date.UTC(2026, 6, 17);
const DEG = Math.PI / 180;

interface PlanetNode {
  spec: PlanetSpec;
  pivot: THREE.Group;      // orbit rotation group (inclined)
  mesh: THREE.Mesh;        // planet sphere (spins)
  body: THREE.Group;       // axial-tilt group holding mesh
  angle: number;           // current orbital angle
  period: number;          // seconds per orbit at 1×
  label?: HTMLElement;
  ring?: THREE.Mesh;
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
  private moon?: { pivot: THREE.Group; mesh: THREE.Mesh };
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

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 500;
    this.controls.addEventListener('start', () => {
      this.tween = null;
      if (this.cine) this.setCine(false);
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

    // planets
    for (const spec of PLANETS) {
      const node = this.makePlanet(spec);
      this.planets.push(node);
      if (spec.id === 'earth') this.earthNode = node;
    }

    // asteroid belt between Mars (30) and Jupiter (43)
    this.belt = this.makeBelt(2400, 33.5, 40.5);
    this.scene.add(this.belt);

    // moon
    if (this.earthNode) {
      const pivot = new THREE.Group();
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.27, 24, 18),
        new THREE.MeshStandardMaterial({ map: this.tex.moon ?? planetTexture('mercury'), roughness: 1 }),
      );
      mesh.position.set(2.1, 0, 0);
      pivot.add(mesh);
      pivot.rotation.x = 5.1 * DEG;
      this.earthNode.body.add(pivot);
      this.moon = { pivot, mesh };
    }

    // Halley's comet — stylized elliptical orbit, particle tail, fading trail
    this.buildHalley();

    // Voyager 1 & 2 — escaping the system
    for (const v of VOYAGERS) this.buildVoyager(v);
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
      const r = inner - 1 + Math.pow(Math.random(), 0.8) * (outer - inner + 2);
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
    if (atmo) body.add(this.makeAtmosphere(spec.radius * atmo.scale, atmo.color, atmo.k));

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
      spec, pivot, mesh, body, ring, label,
      angle: Math.random() * Math.PI * 2,
      period: keplerPeriod(spec.distance),
    };
  }

  // ------------------------------------------------------------- input
  private bindPointer() {
    this.canvas.addEventListener('pointerdown', (e) => {
      this.downPos = { x: e.clientX, y: e.clientY };
    });
    this.canvas.addEventListener('pointerup', (e) => {
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
  };

  // ------------------------------------------------------------- public API
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
    this.focus = node;
    this.tween = null;
    this.toast(STR[this.lang].toast.acquiring + this.planetName(node));
    this.emitSnapshot();
  }

  clearFocus() {
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
    this.eventCache = null;
    this.resetHalleyTrail();
    this.emitSnapshot();
  }

  // Scrub relative to the current sim day (timeline dragging).
  scrubToDay(day: number) {
    this.simDays = day;
    this.eventCache = null;
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

  getSnapshot(): HudSnapshot {
    const zh = this.lang === 'zh';
    const shot = CINE_SHOTS[this.cineShot];
    return {
      cine: this.cine,
      orbit: this.orbit,
      labels: this.labelsOn,
      sound: this.ambience.isOn,
      ephemeris: this.ephemOn,
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
    for (const p of this.planets) {
      if (p.spec.id === 'halley') {
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
    this.sun.rotation.y += simDt * 0.02;
    this.belt.rotation.y += simDt * 0.012;
    if (this.moon) this.moon.pivot.rotation.y += simDt * (Math.PI * 2 / (0.074 * 24));
    if (this.earthClouds) this.earthClouds.rotation.y += simDt * 1.25 * 0.9;

    // solar corona breathing
    this.pulseT += dt;
    if (this.sunGlow1) this.sunGlow1.scale.setScalar(SUN_RADIUS * 4.2 * (1 + 0.03 * Math.sin(this.pulseT * 1.7)));
    if (this.sunGlow2) this.sunGlow2.scale.setScalar(SUN_RADIUS * 8.5 * (1 + 0.05 * Math.sin(this.pulseT * 0.9 + 1.3)));

    // camera modes
    if (this.cine) this.updateCine(dt);
    else if (this.tween) this.updateTween(dt);
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
      });
    }

    this.renderer.render(this.scene, this.camera);
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
    if (!last || last.distanceToSquared(cur) > 0.02) {
      pts.push(cur.clone());
      if (pts.length > 220) pts.shift();
      const attr = this.halley.trail.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pts.length; i++) attr.setXYZ(i, pts[i].x, pts[i].y, pts[i].z);
      attr.needsUpdate = true;
      this.halley.trail.geometry.setDrawRange(0, pts.length);
    }
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

    // keep a sane viewing distance
    const desired = node.spec.radius * this.params.planetScale * 6 + 1.2;
    const offset = this.camera.position.clone().sub(this.controls.target);
    const d = offset.length();
    const newD = THREE.MathUtils.lerp(d, desired, 1 - Math.exp(-dt * 1.5));
    offset.setLength(newD);
    this.focusOffset.copy(offset);
    this.camera.position.copy(this.controls.target).add(offset);
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
  }

  getSimDate(): Date {
    return new Date(BASE_DATE + this.simDays * 86400000);
  }

  dispose() {
    this.disposed = true;
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
