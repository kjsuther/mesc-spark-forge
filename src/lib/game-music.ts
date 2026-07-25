// Procedural 8/16-bit style chiptune generated with the Web Audio API.
// No external audio files, no licensing concerns, tiny bundle impact.
// Upbeat "quest" theme in D major: square lead + triangle bass + noise hat.

type NoteEvt = [number, number]; // [midi-note (0 = rest), beats]

// ~8-bar melody in D major, dotted rhythm + arpeggiated runs for drive.
const MELODY: NoteEvt[] = [
  // Bar 1: D pickup + arp up
  [74, 0.5], [78, 0.5], [81, 0.5], [86, 0.5], [83, 1], [81, 1],
  // Bar 2: motif answer
  [78, 0.5], [81, 0.5], [83, 0.5], [86, 0.5], [85, 1], [83, 1],
  // Bar 3: climb over V
  [76, 0.5], [79, 0.5], [81, 0.5], [83, 0.5], [85, 1], [88, 1],
  // Bar 4: descent
  [86, 0.5], [83, 0.5], [81, 0.5], [78, 0.5], [76, 2],
  // Bar 5: bright restatement
  [74, 0.5], [78, 0.5], [81, 0.5], [86, 0.5], [90, 1], [88, 1],
  // Bar 6: hook
  [86, 0.5], [83, 0.5], [81, 0.5], [83, 0.5], [85, 2],
  // Bar 7: turnaround
  [83, 0.5], [81, 0.5], [79, 0.5], [78, 0.5], [76, 1], [74, 1],
  // Bar 8: resolve
  [74, 0.5], [78, 0.5], [81, 0.5], [78, 0.5], [74, 2],
];

// Walking bass: D — A — Bm — G, twice, in D major (I–V–vi–IV).
const BASS: NoteEvt[] = [
  [50, 1], [57, 1], [50, 1], [57, 1], // D
  [45, 1], [52, 1], [45, 1], [52, 1], // A
  [47, 1], [54, 1], [47, 1], [54, 1], // Bm
  [43, 1], [50, 1], [43, 1], [50, 1], // G
  [50, 1], [57, 1], [50, 1], [57, 1], // D
  [45, 1], [52, 1], [45, 1], [52, 1], // A
  [47, 1], [54, 1], [47, 1], [54, 1], // Bm
  [43, 1], [50, 1], [45, 1], [45, 1], // G → A (turnaround)
];

const midiToFreq = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class GameMusic {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private timer: number | null = null;
  private enabled = false;
  private volume = 0.2;

  isEnabled() { return this.enabled; }

  toggle(): boolean {
    if (this.enabled) this.stop();
    else this.start();
    return this.enabled;
  }

  start() {
    if (this.enabled) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      // Pre-bake ~0.5s of white noise for reuse in hi-hat clicks.
      const sr = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, Math.floor(sr * 0.5), sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      this.enabled = true;
      this.loop();
    } catch {
      this.enabled = false;
    }
  }

  stop() {
    this.enabled = false;
    if (this.timer !== null) { window.clearTimeout(this.timer); this.timer = null; }
    if (this.master) { try { this.master.disconnect(); } catch { /* ignore */ } }
    if (this.ctx) { try { void this.ctx.close(); } catch { /* ignore */ } this.ctx = null; }
    this.master = null;
    this.noiseBuf = null;
  }

  private playNote(freq: number, start: number, dur: number, type: OscillatorType, gain: number) {
    const ctx = this.ctx; const master = this.master;
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.008);
    g.gain.linearRampToValueAtTime(gain * 0.6, start + dur * 0.5);
    g.gain.linearRampToValueAtTime(0, start + dur);
    osc.connect(g); g.connect(master);
    osc.start(start); osc.stop(start + dur + 0.05);
  }

  private playHat(start: number) {
    const ctx = this.ctx; const master = this.master; const buf = this.noiseBuf;
    if (!ctx || !master || !buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.06);
    src.connect(hp); hp.connect(g); g.connect(master);
    src.start(start); src.stop(start + 0.08);
  }

  private loop() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const bpm = 152;
    const beat = 60 / bpm;
    const now = ctx.currentTime + 0.05;

    // Melody (square lead)
    let t = now;
    for (const [n, b] of MELODY) {
      const d = b * beat;
      if (n > 0) this.playNote(midiToFreq(n), t, d * 0.92, "square", 0.13);
      t += d;
    }
    const melodyEnd = t;

    // Bass (triangle)
    let bt = now;
    for (const [n, b] of BASS) {
      const d = b * beat;
      this.playNote(midiToFreq(n), bt, d * 0.95, "triangle", 0.22);
      bt += d;
    }

    // Hi-hat on every off-beat for the full loop length.
    const totalBeats = MELODY.reduce((s, [, b]) => s + b, 0);
    for (let i = 0; i < totalBeats * 2; i++) {
      // Off-beats: skip beat 0, 1, 2… — hit on the "&".
      if (i % 2 === 1) this.playHat(now + i * (beat / 2));
    }

    const totalMs = Math.max(0, (melodyEnd - now) * 1000);
    this.timer = window.setTimeout(() => this.loop(), totalMs);
  }
}

let singleton: GameMusic | null = null;
export function getGameMusic(): GameMusic {
  if (!singleton) singleton = new GameMusic();
  return singleton;
}
