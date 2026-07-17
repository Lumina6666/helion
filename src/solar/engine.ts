// HELION engine — Three.js solar system simulation.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  PLANETS, SUN_RADIUS, AU_UNITS, DAYS_PER_SECOND,
  keplerPeriod, CINE_SHOTS, VIEWS,
} from './data';
import type { PlanetSpec } from './data';
import { planetTexture, sunTexture, ringTexture, glowSprite } from './textures';
import { Ambience } from './audio';
import { STR } from './i18n';
import type { Lang } from './i18n';

export interface HudSnapshot {
  cine: boolean;
  orbit: boolean;
  labels: boolean;
  sound: boolean;
  shotName: string;
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
  private belt!: THREE.Points;
  private sun!: THREE.Mesh;
  private moon?: { pivot: THREE.Group; mesh: THREE.Mesh };
  private earthNode?: PlanetNode;

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

    this.buildScene();
    this.bindPointer();
    window.addEventListener('resize', this.onResize);
    this.loop();
    this.emitSnapshot();
  }

  private buildScene() {
    // lights
    const sunLight = new THREE.PointLight(0xfff2dd, 2.6, 0, 0);
    this.scene.add(sunLight);
    this.scene.add(new THREE.AmbientLight(0x2a3c52, 0.95));

    // starfield
    this.stars = this.makeStars(3600, 700);
    this.scene.add(this.stars);

    // sun
    const sunGeo = new THREE.SphereGeometry(SUN_RADIUS, 64, 48);
    const sunMat = new THREE.MeshBasicMaterial({ map: sunTexture() });
    this.sun = new THREE.Mesh(sunGeo, sunMat);
    this.scene.add(this.sun);
    const glow1 = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSprite('rgba(255,230,170,1)', 'rgba(255,150,50,0.55)'),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    glow1.scale.setScalar(SUN_RADIUS * 4.2);
    this.scene.add(glow1);
    const glow2 = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSprite('rgba(255,190,90,0.9)', 'rgba(255,110,20,0.28)'),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55,
    }));
    glow2.scale.setScalar(SUN_RADIUS * 8.5);
    this.scene.add(glow2);

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
        new THREE.MeshStandardMaterial({ map: planetTexture('mercury'), roughness: 1 }),
      );
      mesh.position.set(2.1, 0, 0);
      pivot.add(mesh);
      pivot.rotation.x = 5.1 * DEG;
      this.earthNode.body.add(pivot);
      this.moon = { pivot, mesh };
    }
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

  private makeBelt(count: number, inner: number, outer: number): THREE.Points {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = inner + Math.pow(Math.random(), 0.7) * (outer - inner);
      const y = (Math.random() - 0.5) * 1.6;
      pos.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xbbaa90, size: 0.22, transparent: true, opacity: 0.75, sizeAttenuation: true });
    return new THREE.Points(geo, mat);
  }

  private makePlanet(spec: PlanetSpec): PlanetNode {
    const pivot = new THREE.Group();
    pivot.rotation.x = spec.inclination * DEG; // orbital inclination
    this.scene.add(pivot);

    const body = new THREE.Group();
    body.rotation.z = spec.tiltDeg * DEG;
    body.position.set(spec.distance, 0, 0);

    const geo = new THREE.SphereGeometry(spec.radius, 48, 36);
    const mat = new THREE.MeshStandardMaterial({
      map: planetTexture(spec.tex), roughness: 0.95, metalness: 0.02,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.planetId = spec.id;
    body.add(mesh);
    pivot.add(body);
    this.pickMeshes.push(mesh);

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
      const rMat = new THREE.MeshBasicMaterial({
        map: ringTexture(), side: THREE.DoubleSide, transparent: true,
        opacity: spec.ring.opacity, depthWrite: false,
      });
      rMat.color.set(spec.ring.color);
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

  getSnapshot(): HudSnapshot {
    const zh = this.lang === 'zh';
    const shot = CINE_SHOTS[this.cineShot];
    return {
      cine: this.cine,
      orbit: this.orbit,
      labels: this.labelsOn,
      sound: this.ambience.isOn,
      shotName: this.cine ? (zh ? shot.nameCn : shot.name) : '',
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
    for (const p of this.planets) {
      p.angle += (simDt / p.period) * Math.PI * 2;
      p.body.position.set(Math.cos(p.angle) * p.spec.distance, 0, Math.sin(p.angle) * p.spec.distance);
      p.mesh.rotation.y += simDt * p.spec.spin * 0.9;
    }
    this.sun.rotation.y += simDt * 0.02;
    this.belt.rotation.y += simDt * 0.012;
    if (this.moon) this.moon.pivot.rotation.y += simDt * (Math.PI * 2 / (0.074 * 24));

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
      this.onTelemetry?.({
        fps: this.fps,
        distAU: this.camera.position.distanceTo(this.controls.target) / AU_UNITS,
        flow: this.speed * DAYS_PER_SECOND,
        simDays: this.simDays,
      });
    }

    this.renderer.render(this.scene, this.camera);
  };

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
