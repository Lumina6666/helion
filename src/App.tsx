import { useEffect, useRef, useState, useCallback } from 'react';
import { SolarEngine } from './solar/engine';
import type { HudSnapshot, Telemetry } from './solar/engine';
import { VIEWS, INTRO_QUOTE } from './solar/data';

const BASE_DATE = Date.UTC(2026, 6, 17);

function fmtSimDate(days: number): string {
  const d = new Date(BASE_DATE + days * 86400000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SolarEngine | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [snap, setSnap] = useState<HudSnapshot | null>(null);
  const [tel, setTel] = useState<Telemetry>({ fps: 0, distAU: 0, flow: 0, simDays: 0 });
  const [hudOn, setHudOn] = useState(true);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [introGone, setIntroGone] = useState(false);
  const [introFading, setIntroFading] = useState(false);
  const [toast, setToast] = useState('');
  const [fatal, setFatal] = useState('');
  const [clock, setClock] = useState('00:00:00');
  const [hintShow, setHintShow] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2300);
  }, []);

  useEffect(() => {
    const engine = new SolarEngine(canvasRef.current!, labelRef.current!);
    engineRef.current = engine;
    engine.onSnapshot = setSnap;
    engine.onTelemetry = setTel;
    engine.onToast = showToast;
    engine.onFatal = (m) => setFatal(m);
    const initTimer = setTimeout(() => engine.init(), 60);
    return () => { clearTimeout(initTimer); engine.dispose(); engineRef.current = null; };
  }, [showToast]);

  // mission clock
  useEffect(() => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      const hh = String(Math.floor(s / 3600)).padStart(2, '0');
      const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      setClock(`${hh}:${mm}:${ss}`);
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // intro lifecycle
  useEffect(() => {
    const t1 = setTimeout(() => setIntroFading(true), 4700);
    const t2 = setTimeout(() => { setIntroGone(true); setHintShow(true); }, 6400);
    const t3 = setTimeout(() => setHintShow(false), 16000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const eng = engineRef.current;
      if (!eng) return;
      const k = e.key.toLowerCase();
      if (k >= '1' && k <= '4') { eng.setView(Number(k) - 1); return; }
      switch (k) {
        case 'c': eng.toggleCine(); break;
        case 'r': eng.toggleOrbit(); break;
        case 'l': eng.toggleLabels(); break;
        case 'p': setParamsOpen(v => !v); break;
        case 'm': eng.toggleSound(); break;
        case 'h': setHudOn(v => !v); break;
        case 'escape': eng.clearFocus(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const eng = () => engineRef.current;
  const p = snap?.params ?? { speed: 1, orbitOpacity: 0.55, planetScale: 1, starfield: 0.9 };

  return (
    <>
      <canvas id="view" ref={canvasRef} />
      <div id="labels" ref={labelRef} style={snap?.labels === false ? { display: 'none' } : undefined} />
      <div id="fx" />

      <div id="hud" className={hudOn ? '' : 'off'}>
        <div className="corner tl" /><div className="corner tr" />
        <div className="corner bl" /><div className="corner br" />

        <div id="title-block">
          <h1>HELION</h1>
          <div className="sub">SOLAR SYSTEM · 8 PLANETS · 1 STAR · 1 BELT</div>
          <div className="sub2">KEPLERIAN ORBITAL MECHANICS // REAL-TIME SIMULATION</div>
        </div>

        <div id="clock-block">
          <div className="label">MISSION ELAPSED</div>
          <div id="clock-val">{clock}</div>
          <div id="sim-val">SIM {fmtSimDate(tel.simDays)}</div>
        </div>

        <div id="telemetry">
          <div className="row"><span className="k">OBSERVER DISTANCE</span><span className="v">{tel.distAU.toFixed(2)} AU</span></div>
          <div className="row"><span className="k">FOCUS TARGET</span><span className="v">{(snap?.focusId ?? 'sun').toUpperCase()}</span></div>
          <div className="row"><span className="k">ORBITAL FLOW</span><span className="v">{tel.flow.toFixed(1)} DAYS/S</span></div>
          <div className="row"><span className="k">TIME DILATION</span><span className="v">×{p.speed.toFixed(2)}</span></div>
          <div className="row"><span className="k">FRAME RATE</span><span className="v">{tel.fps} FPS</span></div>
          {snap?.focusFact ? <div className="row"><span className="fact">▸ {snap.focusFact}</span></div> : null}
        </div>

        <div id="deck" className="ctl">
          <div className="deck-title">
            <span>{snap?.cine ? `CINE · ${snap.shotName}` : 'FLIGHT DECK'}</span>
            <span className="deck-dot" />
          </div>
          <button className={`hbtn wide ${snap?.cine ? 'active' : ''}`} onClick={() => eng()?.toggleCine()}>
            {snap?.cine ? '■ CINEMATIC SEQUENCE' : '▶ CINEMATIC SEQUENCE'}
          </button>
          <div className="grid2">
            {VIEWS.map((v, i) => (
              <button key={v.name} className="hbtn" onClick={() => eng()?.setView(i)}>{v.name}</button>
            ))}
          </div>
          <div className="grid4">
            <button className={`hbtn ${snap?.orbit ? 'active' : ''}`} onClick={() => eng()?.toggleOrbit()}>ORBIT</button>
            <button className={`hbtn ${snap?.labels ? 'active' : ''}`} onClick={() => eng()?.toggleLabels()}>LABELS</button>
            <button className={`hbtn ${paramsOpen ? 'active' : ''}`} onClick={() => setParamsOpen(v => !v)}>PARAMS</button>
            <button className={`hbtn ${hudOn ? 'active' : ''}`} onClick={() => setHudOn(v => !v)}>HUD</button>
          </div>
          <button className={`hbtn wide ${snap?.sound ? 'active' : ''}`} onClick={() => eng()?.toggleSound()}>
            {snap?.sound ? '🔊 SOUND: ON' : '🔇 SOUND: OFF'}
          </button>
          <div id="deck-hint">1-4 VIEWS · C CINE · R ORBIT · L LABELS · P PARAMS · M SOUND · H HUD · ESC RELEASE</div>
        </div>

        <div id="hint" className={hintShow ? 'show' : ''}>
          DRAG ORBIT · SCROLL ZOOM · CLICK PLANET TO FOCUS · C CINEMATIC · M SOUND · H HUD
        </div>
      </div>

      <div id="params" className={paramsOpen ? 'ctl' : 'ctl hidden'}>
        <div className="p-head">
          <span className="p-title">PARAMETERS</span>
          <button id="btn-reset" className="hbtn" onClick={() => eng()?.resetParams()}>RESET</button>
        </div>
        <div className="p-row">
          <div className="p-meta"><span>TIME FLOW</span><span className="p-val">×{p.speed.toFixed(2)}</span></div>
          <input type="range" min={0} max={8} step={0.05} value={p.speed}
            onChange={e => eng()?.setParam('speed', Number(e.target.value))} />
        </div>
        <div className="p-row">
          <div className="p-meta"><span>ORBIT LINES</span><span className="p-val">{Math.round(p.orbitOpacity * 100)}%</span></div>
          <input type="range" min={0} max={1} step={0.01} value={p.orbitOpacity}
            onChange={e => eng()?.setParam('orbitOpacity', Number(e.target.value))} />
        </div>
        <div className="p-row">
          <div className="p-meta"><span>PLANET SCALE</span><span className="p-val">×{p.planetScale.toFixed(2)}</span></div>
          <input type="range" min={0.5} max={3} step={0.05} value={p.planetScale}
            onChange={e => eng()?.setParam('planetScale', Number(e.target.value))} />
        </div>
        <div className="p-row">
          <div className="p-meta"><span>STARFIELD</span><span className="p-val">{Math.round(p.starfield * 100)}%</span></div>
          <input type="range" min={0} max={1} step={0.01} value={p.starfield}
            onChange={e => eng()?.setParam('starfield', Number(e.target.value))} />
        </div>
      </div>

      {!introGone && (
        <div id="intro" className={introFading ? 'done' : ''}>
          <div className="intro-card">
            <div className="intro-tag">REAL-TIME ORBITAL SIMULATION</div>
            <div className="intro-title">HELION</div>
            <div className="intro-quote">{INTRO_QUOTE}</div>
          </div>
        </div>
      )}

      <div id="toast" className={toast ? 'show' : ''}>{toast}</div>

      <div id="fatal" className={fatal ? 'show' : ''}>
        <div className="fatal-card">
          <div className="fatal-title">SIGNAL LOST</div>
          <div className="fatal-msg">{fatal}</div>
        </div>
      </div>
    </>
  );
}
