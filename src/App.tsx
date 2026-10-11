import { useEffect, useRef, useState, useCallback } from 'react';
import { SolarEngine } from './solar/engine';
import type { HudSnapshot, Telemetry, LogEntry } from './solar/engine';
import { VIEWS, DOSSIER, PLANETS, DIST_AU, MOON_SYS, MOON_HOST, MOON_SPEC } from './solar/data';
import { CONJ_PAIRS, OPP_PLANETS } from './solar/events';
import type { AstroEvent } from './solar/events';
import { STR } from './solar/i18n';
import type { Lang } from './solar/i18n';

const BASE_DATE = Date.UTC(2026, 6, 17);
const LANG_KEY = 'helion-lang';
const JD_UNIX_EPOCH = 2440587.5;
const SCRUB_HALF = 30 * 365.25; // ±30 years on the timeline

function fmtSimDate(days: number): string {
  const d = new Date(BASE_DATE + days * 86400000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function fmtJd(jd: number): string {
  return fmtSimDate((jd - JD_UNIX_EPOCH) - BASE_DATE / 86400000);
}

// localized body display name (planets + sun + halley)
function bodyName(id: string, lang: Lang): string {
  if (id === 'sun') return lang === 'zh' ? '太阳' : 'Sun';
  const p = PLANETS.find(pl => pl.id === id);
  if (!p) return id;
  return lang === 'zh' ? p.cn : p.name;
}

interface PredictTarget { type: 'opposition' | 'conjunction' | 'perihelion'; a: string; b: string }

const PREDICT_OPTIONS: PredictTarget[] = [
  ...OPP_PLANETS.map(p => ({ type: 'opposition' as const, a: 'earth', b: p })),
  ...CONJ_PAIRS.map(([a, b]) => ({ type: 'conjunction' as const, a, b })),
  { type: 'perihelion', a: 'sun', b: 'halley' },
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SolarEngine | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [snap, setSnap] = useState<HudSnapshot | null>(null);
  const [tel, setTel] = useState<Telemetry>({ fps: 0, distAU: 0, flow: 0, simDays: 0, focusAU: null, probe: null });
  const [dossierOpen, setDossierOpen] = useState(true);
  const [hudOn, setHudOn] = useState(true);
  const [deckOn, setDeckOn] = useState(() => { try { return localStorage.getItem('helion.deck') !== '0'; } catch { return true; } });
  const toggleDeck = () => setDeckOn(v => { const n = !v; try { localStorage.setItem('helion.deck', n ? '1' : '0'); } catch { /* private mode */ } return n; });
  const [paramsOpen, setParamsOpen] = useState(false);
  const [introGone, setIntroGone] = useState(false);
  const [introFading, setIntroFading] = useState(false);
  const [toast, setToast] = useState('');
  const [fatal, setFatal] = useState('');
  const [clock, setClock] = useState('00:00:00');
  const [hintShow, setHintShow] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadPct, setLoadPct] = useState(0);
  const [minTime, setMinTime] = useState(false);
  const [forceIntro, setForceIntro] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [events, setEvents] = useState<AstroEvent[]>([]);
  const [jumpDate, setJumpDate] = useState('');
  const [predIdx, setPredIdx] = useState(0);
  const [predDate, setPredDate] = useState('');
  const [predResult, setPredResult] = useState<{ actual: string; errDays: number; score: number } | null>(null);
  const [scrubAnchor, setScrubAnchor] = useState<number | null>(null);
  const [scrubVal, setScrubVal] = useState(0);
  const [probeMission, setProbeMission] = useState<'flyby' | 'impact' | 'captured'>('flyby');
  const [probeTarget, setProbeTarget] = useState('mars');
  const [log, setLog] = useState<LogEntry[]>([]);
  const probeMissionRef = useRef(probeMission);
  const probeTargetRef = useRef(probeTarget);
  probeMissionRef.current = probeMission;
  probeTargetRef.current = probeTarget;
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
    engine.onLog = setLog;
    engine.onFatal = (m) => setFatal(m);
    engine.onProgress = (p) => setLoadPct(Math.round(p * 100));
    engine.onReady = () => setReady(true);
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

  // intro lifecycle — fades once textures are ready (or a hard timeout)
  useEffect(() => {
    const t1 = setTimeout(() => setMinTime(true), 4700);
    const t2 = setTimeout(() => setForceIntro(true), 16000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    if (!((ready && minTime) || forceIntro)) return;
    setIntroFading(true);
    const t1 = setTimeout(() => { setIntroGone(true); setHintShow(true); }, 1700);
    const t2 = setTimeout(() => setHintShow(false), 11000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [ready, minTime, forceIntro]);

  // poll upcoming sky events while the time panel is open
  useEffect(() => {
    if (!timeOpen) return;
    const pull = () => setEvents(engineRef.current?.getUpcomingEvents(6) ?? []);
    pull();
    const iv = setInterval(pull, 1000);
    return () => clearInterval(iv);
  }, [timeOpen]);

  // immersive mode: entering hides every panel — auto-close floaters so nothing
  // lingers over the clean view. Exit paths: corner button / H key / Escape.
  const toggleHud = () => {
    setHudOn(v => {
      if (v) { setParamsOpen(false); setTimeOpen(false); } // idempotent side effects
      return !v;
    });
  };

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const eng = engineRef.current;
      if (!eng) return;
      if (e.key === ' ') {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT' && target.tagName !== 'BUTTON') {
          e.preventDefault();
          eng.togglePause();
        }
        return;
      }
      const k = e.key.toLowerCase();
      if (k >= '1' && k <= '4') { eng.setView(Number(k) - 1); return; }
      switch (k) {
        case 'c': eng.toggleCine(); break;
        case 'r': eng.toggleOrbit(); break;
        case 'l': eng.toggleLabels(); break;
        case 'p': setParamsOpen(v => !v); break;
        case 'm': eng.toggleSound(); break;
        case 'h': toggleHud(); break;
        case 'x': toggleDeck(); break;
        case 'e': eng.toggleEphemeris(); break;
        case 'd': setDossierOpen(v => !v); break;
        case 't': setTimeOpen(v => !v); break;
        case 'g': {
          const e = eng;
          if (e.isProbeMode()) e.exitProbeMode();
          else e.enterProbeMode(probeMissionRef.current, probeTargetRef.current);
          break;
        }
        case 'v': eng.toggleProbeFollow(); break;
        case 'b': {
          if (eng.isSurfaceView()) eng.exitSurfaceView();
          else eng.enterSurfaceView();
          break;
        }
        case 'escape': if (eng.exitGalaxyObserve()) { setHudOn(true); break; } eng.exitSurfaceView(); eng.exitGlobeView(true); eng.exitGalaxyView(true); eng.clearFocus(); setHudOn(true); break;
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

  // ---- time panel helpers
  const evDesc = (ev: { type: string; a: string; b: string }): string => {
    const tpl = ev.type === 'opposition' ? t.evOpposition
      : ev.type === 'conjunction' ? t.evConjunction : t.evPerihelion;
    return tpl.replace('{a}', bodyName(ev.a, lang)).replace('{b}', bodyName(ev.b, lang));
  };
  const onPauseToggle = () => {
    const paused = eng()?.togglePause();
    if (paused != null) showToast(paused ? t.toast.paused : t.toast.resumed);
  };
  const onJumpDate = () => {
    if (!jumpDate) return;
    eng()?.jumpToDate(new Date(jumpDate + 'T00:00:00Z'));
    showToast(t.toast.timeJump + jumpDate);
  };
  const onNextEvent = () => {
    const ev = eng()?.jumpToNextEvent();
    if (ev) showToast(t.toast.eventJump + evDesc(ev) + ' · ' + fmtJd(ev.jd));
  };
  const onPredict = () => {
    const opt = PREDICT_OPTIONS[predIdx];
    const jd = eng()?.solvePrediction(opt.type, opt.a, opt.b);
    if (jd == null || !predDate) return;
    const userMs = Date.parse(predDate + 'T00:00:00Z');
    const err = Math.abs((jd - JD_UNIX_EPOCH) * 86400000 - userMs) / 86400000;
    setPredResult({
      actual: fmtJd(jd),
      errDays: Math.round(err * 10) / 10,
      score: Math.max(0, Math.round(100 - err)),
    });
  };
  // ---- probe mode helpers
  const probe = tel.probe;
  const onProbeToggle = () => {
    const e = eng();
    if (!e) return;
    if (e.isProbeMode()) e.exitProbeMode();
    else e.enterProbeMode(probeMission, probeTarget);
  };
  useEffect(() => {
    const e = engineRef.current;
    if (e?.isProbeMode()) e.setProbeMission(probeMission, probeTarget);
  }, [probeMission, probeTarget]);
  const phaseText = probe
    ? (probe.phase === 'aim' ? t.phaseAim
      : probe.phase === 'flying' ? t.phaseFlying
      : probe.phase === 'success' ? t.phaseSuccess : t.phaseFail)
    : '';
  const missionText = (m: string) =>
    m === 'flyby' ? t.missionFlyby : m === 'impact' ? t.missionImpact : t.missionOrbit;
  const scrubCenter = scrubAnchor ?? tel.simDays;
  const nowJd = JD_UNIX_EPOCH + BASE_DATE / 86400000 + tel.simDays;

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

        <div id="deck" className={deckOn ? 'ctl' : 'ctl tucked'}>
          <div className="deck-title">
            <span>{snap?.cine ? `${t.cinePrefix} · ${snap.shotName}` : t.flightDeck}</span>
            <span className="deck-tools">
              <button id="deck-collapse" title={t.deckHide} onClick={toggleDeck}>›</button>
              <span className="deck-dot" />
            </span>
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
            <button className={`hbtn ${hudOn ? 'active' : ''}`} onClick={toggleHud}>{t.hud}</button>
          </div>
          <button className={`hbtn wide ${snap?.sound ? 'active' : ''}`} onClick={() => eng()?.toggleSound()}>
            {snap?.sound ? t.soundOn : t.soundOff}
          </button>
          <button className={`hbtn wide ${snap?.ephemeris ? 'active' : ''}`} onClick={() => eng()?.toggleEphemeris()}>
            🛰 {t.ephemeris}{snap?.ephemeris ? t.ephemOn : t.ephemOff}
          </button>
          <button className={`hbtn wide ${timeOpen ? 'active' : ''}`} onClick={() => setTimeOpen(v => !v)}>
            {t.timeBtn}
          </button>
          <button className={`hbtn wide ${probe?.active ? 'active' : ''}`} onClick={onProbeToggle}>
            {t.probeBtn}
          </button>
          <button className={`hbtn wide ${snap?.expert ? 'active' : ''}`} onClick={() => eng()?.setExpert(!(snap?.expert))}>
            {t.expertBtn}
          </button>
          <button className="hbtn wide" onClick={() => setLang(l => (l === 'zh' ? 'en' : 'zh'))}>
            {t.langButton}
          </button>
          <div id="deck-hint">{t.deckHint}</div>
        </div>

        {!deckOn && (
          <button id="deck-handle" className="ctl" title={t.deckShow} onClick={toggleDeck}>❮</button>
        )}
        {(() => {
          const sysHost = (focusId === 'jupiter' || focusId === 'saturn' || focusId === 'earth') ? focusId
            : (focusId === 'moon' ? 'earth' : MOON_HOST[focusId]);
          if (!sysHost) return null;
          const moons = sysHost === 'earth' ? [MOON_SPEC] : MOON_SYS[sysHost];
          const title = sysHost === 'jupiter' ? t.moonSysJupiter : sysHost === 'saturn' ? t.moonSysSaturn : t.moonSysEarth;
          return (
            <div id="moon-chips" className="ctl">
              <span className="mc-title">{title}</span>
              {moons.map((m) => (
                <button key={m.id}
                  className={focusId === m.id ? 'mc-chip on' : 'mc-chip'}
                  onClick={() => eng()?.focusBodyById(m.id)}>
                  {lang === 'zh' ? m.cn : m.name}
                </button>
              ))}
            </div>
          );
        })()}
        <div id="hint" className={hintShow ? 'show' : ''}>
          {t.bottomHint}
        </div>
      </div>

      {snap?.galaxy && hudOn && !snap?.gxTrans && (
        <>
          <div id="galaxycap">{t.galaxyCap}</div>
          <div id="galaxybar" className="ctl">
            <span className="gb-title">◌ {t.galaxyTitle}</span>
            <button className={`hbtn ${snap.galaxyLabels ? 'active' : ''}`} onClick={() => eng()?.toggleGalaxyLabels()}>{t.galaxyLabels}</button>
            <button className="hbtn" onClick={() => { if (eng()?.toggleGalaxyObserve()) setHudOn(false); }}>{t.galaxyObserve}</button>
            <button className="hbtn gb-exit" onClick={() => eng()?.exitGalaxyView()}>{t.galaxyExit}</button>
          </div>
        </>
      )}

      {snap?.globeId && hudOn && (
        <div id="globebar" className="ctl">
          <span className="gb-title">◉ {t.globeTitle} · {snap.focusName}</span>
          <button className="hbtn" onClick={() => eng()?.resetGlobeView()}>{t.globeReset}</button>
          <button className={`hbtn ${snap.globeSpin ? 'active' : ''}`} onClick={() => eng()?.toggleGlobeSpin()}>{t.globeSpin}</button>
          <button className={`hbtn ${snap.globeGrid ? 'active' : ''}`} onClick={() => eng()?.toggleGlobeGrid()}>{t.globeGrid}</button>
          <button className={`hbtn ${snap.globeFill ? 'active' : ''}`} onClick={() => eng()?.toggleGlobeFill()}>{t.globeFill}</button>
          <button className={`hbtn ${snap.globeLabels ? 'active' : ''}`} onClick={() => eng()?.toggleGlobeLabels()}>{t.globeLabels}</button>
          <button className="hbtn gb-exit" onClick={() => eng()?.exitGlobeView()}>{t.globeExit}</button>
        </div>
      )}

      {!hudOn && !snap?.galaxyObserve && (
        <button id="btn-exit-immersive" onClick={toggleHud}>{t.exitImmersive}</button>
      )}
      {!hudOn && snap?.galaxyObserve && (
        <button id="btn-observe-exit" onClick={() => { eng()?.exitGalaxyObserve(); setHudOn(true); }}>{t.galaxyObserveExit}</button>
      )}

      <div id="params" className={paramsOpen && hudOn ? 'ctl' : 'ctl hidden'}>
        <div className="p-head">
          <span className="p-title">{t.parameters}</span>
          <button id="btn-reset" className="hbtn" onClick={() => eng()?.resetParams()}>{t.reset}</button>
          <button id="btn-params-close" className="hbtn" onClick={() => setParamsOpen(false)}>{t.dossierClose}</button>
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
        <div className="p-row">
          <button className={`hbtn wide ${snap?.bloom ? 'active' : ''}`} id="btn-bloom"
            onClick={() => eng()?.toggleBloom()}>{t.bloomLabel}{snap?.bloom ? ' · ON' : ' · OFF'}</button>
        </div>
        <div className="p-attrib">{t.attrib}</div>
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
          {dossier.diameterKm != null && DIST_AU[focusId] != null && (() => {
            // if this body were a 1 cm ball, how far would the Sun be?
            const m = (DIST_AU[focusId] * 1.496e8) / dossier.diameterKm! / 100;
            const d = m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m.toFixed(0)} m`;
            return (
              <div className="d-block">
                <div className="d-meta"><span>{t.scaleTitle}</span></div>
                <div className="d-scale">{t.scaleSunDist.replace('{d}', d)}</div>
                {focusId === 'earth' && <div className="d-scale">{t.scaleMoon}</div>}
              </div>
            );
          })()}
          <div className="d-blurb">{lang === 'zh' ? dossier.blurbCn : dossier.blurb}</div>
          {focusId !== 'sun' && !['iss', 'orbiter', 'halley', 'voyager1', 'voyager2'].includes(focusId) && (
            <button className="hbtn wide" style={{ marginTop: 8 }}
              onClick={() => eng()?.enterGlobeView()}>
              {t.globeBtn}
            </button>
          )}
          {focusId !== 'sun' && !MOON_HOST[focusId] && (
            <button className="hbtn wide" style={{ marginTop: 8 }}
              onClick={() => eng()?.enterSurfaceView()}>
              {t.surfaceBtn}
            </button>
          )}
        </div>
      )}

      <div id="timepanel" className={timeOpen && hudOn ? 'ctl' : 'ctl hidden'}>
        <div className="p-head">
          <span className="p-title">{t.timePanel}</span>
          <button className="hbtn" id="btn-reset" onClick={() => setTimeOpen(false)}>{t.dossierClose}</button>
        </div>

        <div className="grid2">
          <button className={`hbtn ${p.speed === 0 ? 'active' : ''}`} onClick={onPauseToggle}>
            {p.speed === 0 ? t.resume : t.pause}
          </button>
          <button className={`hbtn ${p.speed < 0 ? 'active' : ''}`}
            onClick={() => eng()?.setTimeScale(p.speed < 0 ? Math.abs(p.speed) : -Math.abs(p.speed || 1))}>
            {t.reverse}
          </button>
        </div>

        <div className="p-row">
          <div className="p-meta"><span>{t.speedLabel}</span><span className="p-val">×{p.speed.toFixed(0)}</span></div>
          <div className="grid4">
            {[1, 10, 100, 1000].map(m => (
              <button key={m} className={`hbtn ${Math.abs(p.speed) === m ? 'active' : ''}`}
                onClick={() => eng()?.setTimeScale(p.speed < 0 ? -m : m)}>×{m}</button>
            ))}
          </div>
        </div>

        <div className="p-row">
          <div className="p-meta"><span>{t.dateLabel}</span></div>
          <div className="tp-datejump">
            <input type="date" value={jumpDate} onChange={e => setJumpDate(e.target.value)} />
            <button className="hbtn" onClick={onJumpDate}>{t.jumpBtn}</button>
          </div>
        </div>

        <div className="p-row">
          <div className="p-meta"><span>{t.timelineLabel}</span><span className="p-val">{fmtSimDate(scrubAnchor !== null ? scrubVal : tel.simDays)}</span></div>
          <input type="range"
            min={scrubCenter - SCRUB_HALF} max={scrubCenter + SCRUB_HALF} step={1}
            value={scrubAnchor !== null ? scrubVal : tel.simDays}
            onPointerDown={() => { setScrubAnchor(tel.simDays); setScrubVal(tel.simDays); }}
            onChange={e => { const v = Number(e.target.value); setScrubVal(v); eng()?.scrubToDay(v); }}
            onPointerUp={() => setScrubAnchor(null)} />
        </div>

        <button className="hbtn wide" onClick={onNextEvent}>{t.nextEventBtn}</button>

        <div className="p-row">
          <div className="p-meta"><span>{t.upcoming}</span></div>
          {events.map((ev, i) => (
            <div className="tp-ev" key={`${ev.type}${ev.a}${ev.b}${i}`}>
              <span className="tp-ev-date">{fmtJd(ev.jd)}</span>
              <span className="tp-ev-desc">{evDesc(ev)}</span>
              <span className="p-val">T-{Math.max(0, Math.round(ev.jd - nowJd))}{t.predictDays}</span>
            </div>
          ))}
        </div>

        <div className="p-row tp-predict">
          <div className="p-meta"><span>{t.predictTitle}</span></div>
          <div className="p-meta"><span>{t.predictEvent}</span></div>
          <select value={predIdx} onChange={e => { setPredIdx(Number(e.target.value)); setPredResult(null); }}>
            {PREDICT_OPTIONS.map((opt, i) => (
              <option key={i} value={i}>{evDesc(opt)}</option>
            ))}
          </select>
          <div className="p-meta" style={{ marginTop: 6 }}><span>{t.predictDate}</span></div>
          <div className="tp-datejump">
            <input type="date" value={predDate} onChange={e => setPredDate(e.target.value)} />
            <button className="hbtn" onClick={onPredict}>{t.predictGo}</button>
          </div>
          {predResult && (
            <div className="tp-result">
              <div className="d-row"><span>{t.predictActual}</span><span className="p-val">{predResult.actual}</span></div>
              <div className="d-row"><span>{t.predictError}</span><span className="p-val">{predResult.errDays} {t.predictDays}</span></div>
              <div className="d-row highlight"><span>{t.predictScore}</span><span className="p-val">{predResult.score}</span></div>
            </div>
          )}
        </div>
      </div>

      {snap?.surfaceId && (
        <div id="surfaceinfo" className="ctl">
          <div className="p-head">
            <span className="p-title">{t.surfaceInfoTitle} · {bodyName(snap.surfaceId, lang)}</span>
          </div>
          {(() => {
            const ang = eng()?.sunAngularDeg(snap.surfaceId);
            const au = DIST_AU[snap.surfaceId];
            return (
              <>
                {ang != null && (
                  <div className="d-row"><span>{t.surfaceSunAng}</span><span className="p-val">{ang.toFixed(2)}°</span></div>
                )}
                {au != null && (
                  <div className="d-row"><span>{t.surfaceSunDist}</span><span className="p-val">{au} AU</span></div>
                )}
              </>
            );
          })()}
          <div className="si-hint">{t.surfaceHint}</div>
        </div>
      )}

      {snap?.expert && (
        <div id="eventlog" className="ctl">
          <div className="p-head"><span className="p-title">{t.logTitle}</span></div>
          <div className="p-row">
            <div className="p-meta"><span>{t.layerTitle}</span></div>
            <div className="grid2">
              <button className={`hbtn ${snap.well ? 'active' : ''}`} id="btn-well"
                onClick={() => eng()?.toggleWell()}>{t.layerWell}</button>
              <button className={`hbtn ${snap.lagrange ? 'active' : ''}`} id="btn-lagrange"
                onClick={() => eng()?.toggleLagrange()}>{t.layerLagrange}</button>
              <button className={`hbtn ${snap.hill ? 'active' : ''}`} id="btn-hill"
                onClick={() => eng()?.toggleHill()}>{t.layerHill}</button>
            </div>
          </div>
          <div className="p-row">
            <div className="p-meta"><span>{t.expTitle}</span></div>
            <div className="grid2">
              <button className={`hbtn ${snap.experiment ? 'active' : ''}`} id="btn-inject"
                disabled={snap.experiment}
                onClick={() => eng()?.injectRogue()}>{t.expInject}</button>
              <button className="hbtn" id="btn-expreset"
                disabled={!snap.experiment}
                onClick={() => eng()?.resetExperiment()}>{t.expReset}</button>
            </div>
            <div className="p-meta dim"><span>{t.expHint}</span></div>
          </div>
          {log.length === 0 && <div className="log-empty">{t.logEmpty}</div>}
          {log.map((e, i) => (
            <div className="log-row" key={`${e.date}${e.text}${i}`}>
              <span className="log-date">{e.date}</span>
              <span className="log-text">{e.text}</span>
            </div>
          ))}
        </div>
      )}

      {probe?.active && (
        <div id="probepanel" className="ctl">
          <div className="p-head">
            <span className="p-title">{t.probePanel}</span>
            <button className="hbtn" id="btn-reset" onClick={() => eng()?.exitProbeMode()}>{t.exitProbe}</button>
          </div>

          <div className="p-row">
            <div className="p-meta"><span>{t.missionLabel}</span></div>
            <div className="grid3">
              {(['flyby', 'impact', 'captured'] as const).map(m => (
                <button key={m} className={`hbtn ${probeMission === m ? 'active' : ''}`}
                  onClick={() => setProbeMission(m)}>{missionText(m)}</button>
              ))}
            </div>
          </div>

          <div className="p-row">
            <div className="p-meta"><span>{t.targetLabel}</span></div>
            <select value={probeTarget} onChange={e => setProbeTarget(e.target.value)}>
              {['mars', 'venus', 'mercury', 'jupiter', 'saturn', 'uranus', 'neptune'].map(id => (
                <option key={id} value={id}>{bodyName(id, lang)}</option>
              ))}
              <option value="free">{t.freeTarget}</option>
            </select>
          </div>

          <div className="d-row highlight"><span>{t.statusLabel}</span><span className="p-val">{phaseText}</span></div>
          <button className={`hbtn wide ${probe.following ? 'active' : ''}`} style={{ marginTop: 6 }}
            onClick={() => eng()?.toggleProbeFollow()}>
            {t.followProbe}
          </button>

          {probe.phase === 'aim' && (
            <>
              <div className="pp-help">{t.aimHelp}</div>
              <div className="d-row"><span>Δv</span><span className="p-val">{probe.aimKms.toFixed(1)} km/s</span></div>
            </>
          )}

          {probe.phase === 'flying' && (
            <>
              <div className="d-row"><span>{t.probeSpeedLabel}</span><span className="p-val">{probe.speedKms.toFixed(1)} km/s</span></div>
              {probe.distTargetAU != null && (
                <div className="d-row"><span>{t.distLabel}</span><span className="p-val">{probe.distTargetAU.toFixed(3)} AU</span></div>
              )}
              {probe.closestAU != null && (
                <div className="d-row"><span>{t.closestLabel}</span><span className="p-val">{probe.closestAU.toFixed(4)} AU</span></div>
              )}
              <div className="d-row"><span>{t.elapsedLabel}</span><span className="p-val">{probe.elapsedYr.toFixed(2)} yr</span></div>
              <div className="p-row" style={{ marginTop: 8 }}>
                <div className="p-meta"><span>{t.fuelLabel}</span><span className="p-val">{probe.fuel.toFixed(1)} / {probe.fuelMax} km/s</span></div>
                <div className="pp-fuel-track"><div className="pp-fuel" style={{ width: `${(probe.fuel / probe.fuelMax) * 100}%` }} /></div>
              </div>
              <div className="p-meta"><span>{t.burnLabel}</span></div>
              <div className="grid3">
                <button className="hbtn" onClick={() => eng()?.burnProbe('pro')}>{t.burnPro}</button>
                <button className="hbtn" onClick={() => eng()?.burnProbe('radout')}>{t.burnRadOut}</button>
                <button className="hbtn" onClick={() => eng()?.burnProbe('norm')}>{t.burnNorm}</button>
                <button className="hbtn" onClick={() => eng()?.burnProbe('retro')}>{t.burnRetro}</button>
                <button className="hbtn" onClick={() => eng()?.burnProbe('radin')}>{t.burnRadIn}</button>
                <button className="hbtn" onClick={() => eng()?.burnProbe('normin')}>{t.burnNormIn}</button>
              </div>
            </>
          )}

          {(probe.phase === 'success' || probe.phase === 'fail') && (
            <>
              {probe.closestAU != null && (
                <div className="d-row"><span>{t.closestLabel}</span><span className="p-val">{probe.closestAU.toFixed(4)} AU</span></div>
              )}
              <div className="d-row"><span>{t.elapsedLabel}</span><span className="p-val">{probe.elapsedYr.toFixed(2)} yr</span></div>
              <div className="d-row highlight"><span>{t.scoreLabel}</span><span className="p-val">{probe.score ?? 0}</span></div>
              <button className="hbtn wide" style={{ marginTop: 8 }} onClick={() => eng()?.resetProbe()}>{t.resetProbe}</button>
            </>
          )}
        </div>
      )}

      {!introGone && (
        <div id="intro" className={introFading ? 'done' : ''}>
          <div className="intro-card">
            <div className="intro-tag">{t.introTag}</div>
            <div className="intro-title">HELION</div>
            <div className="intro-quote">{t.introQuote}</div>
            {!ready && <div className="intro-load">{t.loading} {loadPct}%</div>}
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
