import { useEffect, useRef, useState, useCallback } from 'react';
import { SolarEngine } from './solar/engine';
import type { HudSnapshot, Telemetry } from './solar/engine';
import { VIEWS, DOSSIER } from './solar/data';
import { STR } from './solar/i18n';
import type { Lang } from './solar/i18n';

const BASE_DATE = Date.UTC(2026, 6, 17);
const LANG_KEY = 'helion-lang';

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
  const [tel, setTel] = useState<Telemetry>({ fps: 0, distAU: 0, flow: 0, simDays: 0, focusAU: null });
  const [dossierOpen, setDossierOpen] = useState(true);
  const [hudOn, setHudOn] = useState(true);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [introGone, setIntroGone] = useState(false);
  const [introFading, setIntroFading] = useState(false);
  const [toast, setToast] = useState('');
  const [fatal, setFatal] = useState('');
  const [clock, setClock] = useState('00:00:00');
  const [hintShow, setHintShow] = useState(false);
  const [lang, setLang] = useState<Lang>(() => {
    try { return (localStorage.getItem(LANG_KEY) as Lang) || 'zh'; } catch { return 'zh'; }
  });
  const langRef = useRef(lang);
  langRef.current = lang;
  const t = STR[lang];

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
    engine.setLang(langRef.current);
    const initTimer = setTimeout(() => engine.init(), 60);
    return () => { clearTimeout(initTimer); engine.dispose(); engineRef.current = null; };
  }, [showToast]);

  // language switching
  useEffect(() => {
    engineRef.current?.setLang(lang);
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* noop */ }
  }, [lang]);

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
        case 'e': eng.toggleEphemeris(); break;
        case 'd': setDossierOpen(v => !v); break;
        case 'escape': eng.clearFocus(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // auto-open dossier when a new target is acquired
  const focusId = snap?.focusId ?? 'sun';
  useEffect(() => {
    if (focusId !== 'sun') setDossierOpen(true);
  }, [focusId]);

  const eng = () => engineRef.current;
  const p = snap?.params ?? { speed: 1, orbitOpacity: 0.55, planetScale: 1, starfield: 0.9 };
  const dossier = focusId !== 'sun' ? DOSSIER[focusId] : undefined;

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
          <div className="sub">{t.subtitle}</div>
          <div className="sub2">{t.subtitle2}</div>
        </div>

        <div id="clock-block">
          <div className="label">{t.missionElapsed}</div>
          <div id="clock-val">{clock}</div>
          <div id="sim-val">{t.simDate} {fmtSimDate(tel.simDays)}</div>
        </div>

        <div id="telemetry">
          <div className="row"><span className="k">{t.observerDistance}</span><span className="v">{tel.distAU.toFixed(2)} AU</span></div>
          <div className="row"><span className="k">{t.focusTarget}</span><span className="v">{snap?.focusName ?? t.sun}</span></div>
          <div className="row"><span className="k">{t.orbitalFlow}</span><span className="v">{tel.flow.toFixed(1)} {t.daysPerSec}</span></div>
          <div className="row"><span className="k">{t.timeDilation}</span><span className="v">×{p.speed.toFixed(2)}</span></div>
          <div className="row"><span className="k">{t.frameRate}</span><span className="v">{tel.fps} FPS</span></div>
          {snap?.focusFact ? <div className="row"><span className="fact">▸ {snap.focusFact}</span></div> : null}
        </div>

        <div id="deck" className="ctl">
          <div className="deck-title">
            <span>{snap?.cine ? `${t.cinePrefix} · ${snap.shotName}` : t.flightDeck}</span>
            <span className="deck-dot" />
          </div>
          <button className={`hbtn wide ${snap?.cine ? 'active' : ''}`} onClick={() => eng()?.toggleCine()}>
            {snap?.cine ? t.cineStop : t.cinePlay}
          </button>
          <div className="grid2">
            {VIEWS.map((v, i) => (
              <button key={v.name} className="hbtn" onClick={() => eng()?.setView(i)}>{lang === 'zh' ? v.nameCn : v.name}</button>
            ))}
          </div>
          <div className="grid4">
            <button className={`hbtn ${snap?.orbit ? 'active' : ''}`} onClick={() => eng()?.toggleOrbit()}>{t.orbit}</button>
            <button className={`hbtn ${snap?.labels ? 'active' : ''}`} onClick={() => eng()?.toggleLabels()}>{t.labels}</button>
            <button className={`hbtn ${paramsOpen ? 'active' : ''}`} onClick={() => setParamsOpen(v => !v)}>{t.params}</button>
            <button className={`hbtn ${hudOn ? 'active' : ''}`} onClick={() => setHudOn(v => !v)}>{t.hud}</button>
          </div>
          <button className={`hbtn wide ${snap?.sound ? 'active' : ''}`} onClick={() => eng()?.toggleSound()}>
            {snap?.sound ? t.soundOn : t.soundOff}
          </button>
          <button className={`hbtn wide ${snap?.ephemeris ? 'active' : ''}`} onClick={() => eng()?.toggleEphemeris()}>
            🛰 {t.ephemeris}{snap?.ephemeris ? t.ephemOn : t.ephemOff}
          </button>
          <button className="hbtn wide" onClick={() => setLang(l => (l === 'zh' ? 'en' : 'zh'))}>
            {t.langButton}
          </button>
          <div id="deck-hint">{t.deckHint}</div>
        </div>

        <div id="hint" className={hintShow ? 'show' : ''}>
          {t.bottomHint}
        </div>
      </div>

      <div id="params" className={paramsOpen ? 'ctl' : 'ctl hidden'}>
        <div className="p-head">
          <span className="p-title">{t.parameters}</span>
          <button id="btn-reset" className="hbtn" onClick={() => eng()?.resetParams()}>{t.reset}</button>
        </div>
        <div className="p-row">
          <div className="p-meta"><span>{t.timeFlow}</span><span className="p-val">×{p.speed.toFixed(2)}</span></div>
          <input type="range" min={0} max={8} step={0.05} value={p.speed}
            onChange={e => eng()?.setParam('speed', Number(e.target.value))} />
        </div>
        <div className="p-row">
          <div className="p-meta"><span>{t.orbitLines}</span><span className="p-val">{Math.round(p.orbitOpacity * 100)}%</span></div>
          <input type="range" min={0} max={1} step={0.01} value={p.orbitOpacity}
            onChange={e => eng()?.setParam('orbitOpacity', Number(e.target.value))} />
        </div>
        <div className="p-row">
          <div className="p-meta"><span>{t.planetScale}</span><span className="p-val">×{p.planetScale.toFixed(2)}</span></div>
          <input type="range" min={0.5} max={3} step={0.05} value={p.planetScale}
            onChange={e => eng()?.setParam('planetScale', Number(e.target.value))} />
        </div>
        <div className="p-row">
          <div className="p-meta"><span>{t.starfield}</span><span className="p-val">{Math.round(p.starfield * 100)}%</span></div>
          <input type="range" min={0} max={1} step={0.01} value={p.starfield}
            onChange={e => eng()?.setParam('starfield', Number(e.target.value))} />
        </div>
      </div>

      {dossier && dossierOpen && (
        <div id="dossier" className="ctl">
          <div className="p-head">
            <span className="p-title">{snap?.focusName} · {t.dossier}</span>
            <button id="btn-reset" className="hbtn" onClick={() => setDossierOpen(false)}>{t.dossierClose}</button>
          </div>
          <div className="d-type">{lang === 'zh' ? dossier.typeCn : dossier.type}</div>
          {dossier.diameterKm != null && (
            <div className="d-block">
              <div className="d-meta">
                <span>{t.diameter}</span>
                <span className="p-val">{dossier.diameterKm.toLocaleString()} KM</span>
              </div>
              <div className="d-bar-track">
                <div className="d-bar" style={{ width: `${Math.max(4, (Math.log10(dossier.diameterKm) - Math.log10(2000)) / (Math.log10(140000) - Math.log10(2000)) * 100)}%` }} />
                <div className="d-earth-marker" style={{ left: `${(Math.log10(12742) - Math.log10(2000)) / (Math.log10(140000) - Math.log10(2000)) * 100}%` }} title="EARTH" />
              </div>
              <div className="d-caption">{t.vsEarth}</div>
            </div>
          )}
          {tel.focusAU != null && (
            <div className="d-row highlight"><span>{t.rangeNow}</span><span className="p-val">{tel.focusAU.toFixed(1)} AU</span></div>
          )}
          {dossier.rows.map(r => (
            <div className="d-row" key={r.k}><span>{lang === 'zh' ? r.kCn : r.k}</span><span className="p-val">{lang === 'zh' ? r.vCn : r.v}</span></div>
          ))}
          <div className="d-blurb">{lang === 'zh' ? dossier.blurbCn : dossier.blurb}</div>
        </div>
      )}

      {!introGone && (
        <div id="intro" className={introFading ? 'done' : ''}>
          <div className="intro-card">
            <div className="intro-tag">{t.introTag}</div>
            <div className="intro-title">HELION</div>
            <div className="intro-quote">{t.introQuote}</div>
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
