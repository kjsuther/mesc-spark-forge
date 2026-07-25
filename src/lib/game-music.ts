// Procedural 8/16-bit style chiptune generated with the Web Audio API.
// No external audio files, no licensing concerns, tiny bundle impact.
// A short square-wave melody loops every ~20 seconds while enabled.

type Osc = { osc: OscillatorNode; gain: GainNode };

const MELODY: Array<[number, number]> = [
  // [midi-note, beats] — cheerful major-key adventure loop, ~20s at 120bpm
  [67, 1], [72, 1], [76, 1], [79, 2], [76, 1],
  [72, 1], [74, 1], [76, 2], [72, 1], [67, 1],
  [69, 1], [72, 2], [76, 1], [79, 1], [81, 2],
  [79, 1], [76, 1], [72, 2], [67, 1], [69, 1],
  [72, 1], [74, 1], [76, 2], [79, 2], [76, 2],
  [72, 4],
];
const BASS: Array<[number, number]> = [
  [48, 2], [52, 2], [55, 2], [52, 2],
  [50, 2], [53, 2], [57, 2], [53, 2],
  [48, 2], [52, 2], [55, 2], [59, 2],
  [48, 4], [55, 4],
];

const midiToFreq = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class GameMusic {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private enabled = false;
  private volume = 0.18;

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
  }

  private playNote(freq: number, start: number, dur: number, type: OscillatorType, gain: number): Osc | null {
    const ctx = this.ctx; const master = this.master;
    if (!ctx || !master) return null;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.01);
    g.gain.linearRampToValueAtTime(gain * 0.7, start + dur * 0.6);
    g.gain.linearRampToValueAtTime(0, start + dur);
    osc.connect(g); g.connect(master);
    osc.start(start); osc.stop(start + dur + 0.05);
    return { osc, gain: g };
  }

  private loop() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const bpm = 132;
    const beat = 60 / bpm;
    const now = ctx.currentTime + 0.05;

    let t = now;
    for (const [n, b] of MELODY) {
      const d = b * beat;
      this.playNote(midiToFreq(n), t, d * 0.9, "square", 0.14);
      t += d;
    }
    const melodyEnd = t;

    let bt = now;
    for (const [n, b] of BASS) {
      const d = b * beat;
      this.playNote(midiToFreq(n), bt, d * 0.95, "triangle", 0.22);
      bt += d;
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
