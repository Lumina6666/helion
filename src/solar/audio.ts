// Deep-space ambient drone — pure WebAudio, no assets.
export class Ambience {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private nodes: AudioNode[] = [];
  private running = false;
  private filter: BiquadFilterNode | null = null;

  get isOn() { return this.running; }

  // brightness follows the time-flow rate — faster clock → more open filter
  setFlow(daysPerSec: number) {
    if (!this.running || !this.ctx || !this.filter) return;
    const f = Math.min(900, Math.max(180, 180 + Math.log10(1 + daysPerSec) * 110));
    this.filter.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.5);
  }

  toggle(): boolean {
    if (this.running) { this.stop(); return false; }
    this.start(); return true;
  }

  private start() {
    try {
      const AC: typeof AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      this.ctx = ctx;
      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
      this.master = master;

      // two detuned low oscillators → slow-filtered drone
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 240;
      filter.Q.value = 2.2;
      filter.connect(master);
      this.filter = filter;

      const mk = (type: OscillatorType, freq: number, gain: number) => {
        const o = ctx.createOscillator();
        o.type = type; o.frequency.value = freq;
        const g = ctx.createGain(); g.gain.value = gain;
        o.connect(g); g.connect(filter); o.start();
        this.nodes.push(o, g);
      };
      mk('sine', 55, 0.5);
      mk('sine', 55.4, 0.4);
      mk('triangle', 110.3, 0.12);
      mk('sine', 32.7, 0.35);

      // slow LFO breathing on the filter
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 120;
      lfo.connect(lfoGain); lfoGain.connect(filter.frequency); lfo.start();
      this.nodes.push(lfo, lfoGain);

      // faint shimmering high partial
      const shimmer = ctx.createOscillator();
      shimmer.type = 'sine'; shimmer.frequency.value = 660;
      const shGain = ctx.createGain(); shGain.gain.value = 0.0;
      const shLfo = ctx.createOscillator(); shLfo.frequency.value = 0.11;
      const shLfoG = ctx.createGain(); shLfoG.gain.value = 0.012;
      shLfo.connect(shLfoG); shLfoG.connect(shGain.gain);
      shimmer.connect(shGain); shGain.connect(master);
      shimmer.start(); shLfo.start();
      this.nodes.push(shimmer, shGain, shLfo, shLfoG);

      master.gain.linearRampToValueAtTime(0.32, ctx.currentTime + 2.5);
      this.running = true;
    } catch {
      this.running = false;
    }
  }

  private stop() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
    const nodes = this.nodes;
    setTimeout(() => {
      nodes.forEach(n => { try { (n as OscillatorNode).stop?.(); } catch { /* noop */ } try { n.disconnect(); } catch { /* noop */ } });
      void ctx.close();
    }, 900);
    this.nodes = [];
    this.ctx = null; this.master = null;
    this.running = false;
  }
}
