// Procedural 8/16-bit style chiptune generated with the Web Audio API.
// No external audio files, no licensing concerns, tiny bundle impact.
//
// Three themes drive the emotional arc of the trail:
//   adventure - upbeat D-major quest theme (default exploration music)
//   boss      - tense D-minor battle theme (Zone 7 Paperwork Ogre)
//   victory   - triumphant fanfare (Zone 8 pole slide + WIN screen)

type NoteEvt = [number, number]; // [midi-note (0 = rest), beats]

export type MusicTheme =
  | "adventure"
  | "town"
  | "river"
  | "waiting"
  | "boss"
  | "victory";

/** Exploration themes that may be shuffled between runs. */
export const EXPLORATION_THEMES: MusicTheme[] = ["adventure", "town", "river"];

/**
 * Which theme plays in each zone (0-based). Zones share a small rotation so
 * the trail keeps changing mood without whiplash; the caller may rotate the
 * exploration set so repeat runs don't start on the same tune.
 */
export const ZONE_THEMES: MusicTheme[] = [
  "adventure", // 1 Finding the Trail
  "town",      // 2 Setting Up Camp
  "river",     // 3 Crossing the River of Paperwork
  "town",      // 4 Gathering Supplies
  "adventure", // 5 Answering the Call
  "waiting",   // 6 Waiting Mountain
  "boss",      // 7 Choosing Your Path (boss arena sets this itself)
  "victory",   // 8 Coverage Begins
];

type ThemeDef = {
  melody: NoteEvt[];
  bass: NoteEvt[];
  /** Optional third voice (harmony / counter-line) played as a pulse wave. */
  harmony?: NoteEvt[];
  bpm: number;
  /** Master gain while this theme plays. */
  volume: number;
  /** Lead oscillator flavour. */
  leadWave: OscillatorType;
  leadGain: number;
  bassWave: OscillatorType;
  bassGain: number;
  /** "offbeat" = light hi-hats, "downbeat" = heavy noise hits, "none" = silent. */
  percussion: "offbeat" | "downbeat" | "none";
  /** Adds a slightly detuned second lead osc for a snarling, menacing tone. */
  detuneLead?: boolean;
};

// ---------------------------------------------------------------------------
// ADVENTURE — ~8-bar melody in D major, dotted rhythm + arpeggiated runs.
// ---------------------------------------------------------------------------
const ADVENTURE_MELODY: NoteEvt[] = [
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
const ADVENTURE_BASS: NoteEvt[] = [
  [50, 1], [57, 1], [50, 1], [57, 1], // D
  [45, 1], [52, 1], [45, 1], [52, 1], // A
  [47, 1], [54, 1], [47, 1], [54, 1], // Bm
  [43, 1], [50, 1], [43, 1], [50, 1], // G
  [50, 1], [57, 1], [50, 1], [57, 1], // D
  [45, 1], [52, 1], [45, 1], [52, 1], // A
  [47, 1], [54, 1], [47, 1], [54, 1], // Bm
  [43, 1], [50, 1], [45, 1], [45, 1], // G → A (turnaround)
];

// ---------------------------------------------------------------------------
// BOSS — D natural minor with a flat-5 snarl. Slower, heavier, menacing.
// ---------------------------------------------------------------------------
const BOSS_MELODY: NoteEvt[] = [
  // Bar 1: low ominous stalk
  [62, 1], [62, 0.5], [65, 0.5], [68, 1], [67, 1],
  // Bar 2: tritone jab
  [62, 0.5], [68, 0.5], [62, 0.5], [69, 0.5], [67, 2],
  // Bar 3: rising threat
  [65, 0.5], [67, 0.5], [68, 0.5], [70, 0.5], [72, 1], [70, 1],
  // Bar 4: slam back down
  [68, 0.5], [67, 0.5], [65, 0.5], [63, 0.5], [62, 2],
  // Bar 5: octave-up restatement
  [74, 1], [74, 0.5], [77, 0.5], [80, 1], [79, 1],
  // Bar 6: chromatic squeeze
  [79, 0.5], [78, 0.5], [77, 0.5], [76, 0.5], [75, 1], [74, 1],
  // Bar 7: pounding pedal
  [62, 0.5], [62, 0.5], [63, 0.5], [62, 0.5], [68, 1], [67, 1],
  // Bar 8: unresolved cliffhanger
  [65, 0.5], [64, 0.5], [63, 0.5], [62, 0.5], [61, 2],
];

// Relentless eighth-note pedal bass; the flat-2 (Eb) keeps it uneasy.
const BOSS_BASS: NoteEvt[] = [
  [38, 0.5], [38, 0.5], [38, 0.5], [45, 0.5], [38, 0.5], [38, 0.5], [44, 0.5], [43, 0.5],
  [38, 0.5], [38, 0.5], [38, 0.5], [45, 0.5], [38, 0.5], [38, 0.5], [44, 0.5], [43, 0.5],
  [41, 0.5], [41, 0.5], [41, 0.5], [48, 0.5], [41, 0.5], [41, 0.5], [47, 0.5], [46, 0.5],
  [38, 0.5], [38, 0.5], [38, 0.5], [45, 0.5], [38, 0.5], [38, 0.5], [44, 0.5], [43, 0.5],
  [38, 0.5], [38, 0.5], [38, 0.5], [45, 0.5], [38, 0.5], [38, 0.5], [44, 0.5], [43, 0.5],
  [39, 0.5], [39, 0.5], [39, 0.5], [46, 0.5], [39, 0.5], [39, 0.5], [45, 0.5], [44, 0.5],
  [38, 0.5], [38, 0.5], [38, 0.5], [45, 0.5], [38, 0.5], [38, 0.5], [44, 0.5], [43, 0.5],
  [37, 0.5], [37, 0.5], [37, 0.5], [44, 0.5], [37, 1], [36, 1],
];

// ---------------------------------------------------------------------------
// VICTORY — bright D-major fanfare that resolves on a big held tonic, then
// vamps so the WIN screen keeps celebrating.
// ---------------------------------------------------------------------------
const VICTORY_MELODY: NoteEvt[] = [
  // Fanfare call: triadic rip up to the octave
  [74, 0.33], [78, 0.33], [81, 0.34], [86, 1.5], [0, 0.5],
  [76, 0.33], [79, 0.33], [83, 0.34], [88, 1.5], [0, 0.5],
  // Answer: descend and lift
  [86, 0.5], [85, 0.5], [83, 0.5], [81, 0.5], [83, 1], [86, 1],
  // Big resolve on the tonic
  [90, 0.5], [88, 0.5], [86, 0.5], [83, 0.5], [86, 2],
  // Celebration vamp
  [81, 0.5], [83, 0.5], [86, 0.5], [90, 0.5], [88, 1], [86, 1],
  [85, 0.5], [86, 0.5], [88, 0.5], [90, 0.5], [93, 2],
];

const VICTORY_BASS: NoteEvt[] = [
  [50, 1], [50, 1], [50, 1], [50, 1], // D
  [52, 1], [52, 1], [52, 1], [52, 1], // E
  [45, 1], [45, 1], [52, 1], [52, 1], // A → E
  [50, 1], [50, 1], [50, 1], [50, 1], // D
  [55, 1], [55, 1], [45, 1], [45, 1], // G → A
  [50, 1], [50, 1], [50, 1], [50, 1], // D
];

// Sustained brass-like harmony a third under the fanfare.
const VICTORY_HARMONY: NoteEvt[] = [
  [69, 2], [69, 2],
  [71, 2], [71, 2],
  [74, 2], [74, 2],
  [78, 2], [78, 2],
  [76, 2], [76, 2],
  [81, 2], [81, 2],
];

// ---------------------------------------------------------------------------
// TOWN — bouncy G-major market tune. Faster, brighter, staccato triangle bass.
// ---------------------------------------------------------------------------
const TOWN_MELODY: NoteEvt[] = [
  [79, 0.5], [83, 0.5], [86, 0.5], [83, 0.5], [88, 1], [86, 1],
  [84, 0.5], [86, 0.5], [88, 0.5], [91, 0.5], [90, 1], [88, 1],
  [86, 0.5], [83, 0.5], [79, 0.5], [83, 0.5], [86, 1], [88, 1],
  [90, 0.5], [88, 0.5], [86, 0.5], [83, 0.5], [79, 2],
  [81, 0.5], [84, 0.5], [88, 0.5], [84, 0.5], [86, 1], [83, 1],
  [79, 0.5], [81, 0.5], [83, 0.5], [86, 0.5], [88, 2],
  [86, 0.5], [84, 0.5], [83, 0.5], [81, 0.5], [79, 1], [78, 1],
  [79, 0.5], [83, 0.5], [86, 0.5], [83, 0.5], [79, 2],
];
const TOWN_BASS: NoteEvt[] = [
  [43, 0.5], [55, 0.5], [43, 0.5], [55, 0.5], [43, 0.5], [55, 0.5], [43, 0.5], [55, 0.5],
  [48, 0.5], [60, 0.5], [48, 0.5], [60, 0.5], [48, 0.5], [60, 0.5], [48, 0.5], [60, 0.5],
  [45, 0.5], [57, 0.5], [45, 0.5], [57, 0.5], [45, 0.5], [57, 0.5], [45, 0.5], [57, 0.5],
  [50, 0.5], [62, 0.5], [50, 0.5], [62, 0.5], [50, 0.5], [62, 0.5], [50, 0.5], [62, 0.5],
  [43, 0.5], [55, 0.5], [43, 0.5], [55, 0.5], [47, 0.5], [59, 0.5], [47, 0.5], [59, 0.5],
  [48, 0.5], [60, 0.5], [48, 0.5], [60, 0.5], [45, 0.5], [57, 0.5], [45, 0.5], [57, 0.5],
  [50, 1], [50, 1], [45, 1], [45, 1],
  [43, 1], [43, 1], [50, 1], [50, 1],
];

// ---------------------------------------------------------------------------
// RIVER — flowing A-major travelling theme, lilting swung arpeggios.
// ---------------------------------------------------------------------------
const RIVER_MELODY: NoteEvt[] = [
  [69, 0.75], [73, 0.25], [76, 0.5], [81, 0.5], [80, 1], [76, 1],
  [74, 0.75], [76, 0.25], [78, 0.5], [81, 0.5], [83, 1.5], [0, 0.5],
  [81, 0.5], [78, 0.5], [76, 0.5], [74, 0.5], [73, 1], [76, 1],
  [78, 0.75], [76, 0.25], [73, 0.5], [69, 0.5], [71, 2],
  [76, 0.5], [81, 0.5], [85, 0.5], [88, 0.5], [86, 1], [83, 1],
  [81, 0.75], [80, 0.25], [78, 0.5], [76, 0.5], [74, 2],
  [73, 0.5], [76, 0.5], [78, 0.5], [80, 0.5], [81, 1], [78, 1],
  [76, 0.5], [73, 0.5], [69, 0.5], [73, 0.5], [69, 2],
];
const RIVER_BASS: NoteEvt[] = [
  [45, 1], [57, 1], [52, 1], [57, 1],
  [50, 1], [62, 1], [57, 1], [62, 1],
  [42, 1], [54, 1], [49, 1], [54, 1],
  [47, 1], [59, 1], [54, 1], [59, 1],
  [45, 1], [57, 1], [52, 1], [57, 1],
  [50, 1], [62, 1], [57, 1], [62, 1],
  [52, 1], [64, 1], [59, 1], [64, 1],
  [45, 1], [52, 1], [45, 1], [45, 1],
];
const RIVER_HARMONY: NoteEvt[] = [
  [64, 2], [61, 2], [66, 2], [64, 2],
  [61, 2], [57, 2], [59, 2], [57, 2],
  [64, 2], [61, 2], [66, 2], [64, 2],
  [59, 2], [61, 2], [64, 2], [57, 2],
];

// ---------------------------------------------------------------------------
// WAITING — patient, slightly anxious B-minor pulse for the decision zone.
// Tense but not the boss theme: soft lead, no heavy drums.
// ---------------------------------------------------------------------------
const WAITING_MELODY: NoteEvt[] = [
  [71, 1], [74, 1], [78, 1], [76, 1],
  [74, 1], [71, 1], [69, 2],
  [71, 1], [76, 1], [81, 1], [78, 1],
  [76, 1], [74, 1], [71, 2],
  [78, 0.5], [76, 0.5], [74, 1], [71, 1], [69, 1],
  [71, 1], [74, 1], [78, 2],
  [76, 1], [74, 1], [73, 1], [71, 1],
  [69, 1], [71, 1], [71, 2],
];
const WAITING_BASS: NoteEvt[] = [
  [47, 2], [47, 2], [54, 2], [54, 2],
  [43, 2], [43, 2], [45, 2], [45, 2],
  [47, 2], [47, 2], [52, 2], [52, 2],
  [50, 2], [50, 2], [45, 2], [45, 2],
  [47, 2], [47, 2], [54, 2], [54, 2],
  [43, 2], [43, 2], [45, 2], [45, 2],
  [47, 2], [47, 2], [50, 2], [50, 2],
  [45, 2], [45, 2], [47, 2], [47, 2],
];

const THEMES: Record<MusicTheme, ThemeDef> = {
  adventure: {
    melody: ADVENTURE_MELODY,
    bass: ADVENTURE_BASS,
    bpm: 152,
    volume: 0.2,
    leadWave: "square",
    leadGain: 0.13,
    bassWave: "triangle",
    bassGain: 0.22,
    percussion: "offbeat",
  },
  town: {
    melody: TOWN_MELODY,
    bass: TOWN_BASS,
    bpm: 168,
    volume: 0.19,
    leadWave: "square",
    leadGain: 0.12,
    bassWave: "triangle",
    bassGain: 0.2,
    percussion: "offbeat",
  },
  river: {
    melody: RIVER_MELODY,
    bass: RIVER_BASS,
    harmony: RIVER_HARMONY,
    bpm: 138,
    volume: 0.2,
    leadWave: "triangle",
    leadGain: 0.16,
    bassWave: "triangle",
    bassGain: 0.2,
    percussion: "offbeat",
  },
  waiting: {
    melody: WAITING_MELODY,
    bass: WAITING_BASS,
    bpm: 112,
    volume: 0.18,
    leadWave: "triangle",
    leadGain: 0.14,
    bassWave: "sine",
    bassGain: 0.22,
    percussion: "none",
  },
  boss: {
    melody: BOSS_MELODY,
    bass: BOSS_BASS,
    bpm: 128,
    volume: 0.24,
    leadWave: "sawtooth",
    leadGain: 0.11,
    bassWave: "triangle",
    bassGain: 0.28,
    percussion: "downbeat",
    detuneLead: true,
  },
  victory: {
    melody: VICTORY_MELODY,
    bass: VICTORY_BASS,
    harmony: VICTORY_HARMONY,
    bpm: 144,
    volume: 0.24,
    leadWave: "square",
    leadGain: 0.15,
    bassWave: "triangle",
    bassGain: 0.24,
    percussion: "offbeat",
  },
};

const midiToFreq = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class GameMusic {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private timer: number | null = null;
  private enabled = false;
  private theme: MusicTheme = "adventure";
  /** Counts loop repeats so alternating passes can vary the arrangement. */
  private pass = 0;
  /** Nodes scheduled by the current loop, so a theme swap can silence them. */
  private scheduled: { osc: OscillatorNode | AudioBufferSourceNode; gain: GainNode }[] = [];

  isEnabled() { return this.enabled; }
  getTheme() { return this.theme; }

  toggle(): boolean {
    if (this.enabled) this.stop();
    else this.start();
    return this.enabled;
  }

  /**
   * Switch themes mid-run. Silences whatever is already scheduled, dips the
   * master gain briefly so the swap doesn't click, then restarts the loop.
   * Remembered while muted so unmuting resumes the right theme.
   */
  setTheme(next: MusicTheme) {
    if (this.theme === next) return;
    this.theme = next;
    if (!this.enabled || !this.ctx || !this.master) return;

    const ctx = this.ctx;
    const master = this.master;
    const now = ctx.currentTime;
    const fade = 0.15;

    // Cancel the pending loop and kill everything already queued up.
    if (this.timer !== null) { window.clearTimeout(this.timer); this.timer = null; }
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0.0001, now + fade);
    this.clearScheduled(now + fade);

    window.setTimeout(() => {
      if (!this.enabled || !this.ctx || !this.master) return;
      const t = this.ctx.currentTime;
      const vol = THEMES[this.theme].volume;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(0.0001, t);
      this.master.gain.linearRampToValueAtTime(vol, t + fade);
      this.loop();
    }, fade * 1000 + 20);
  }

  start() {
    if (this.enabled) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = THEMES[this.theme].volume;
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
    this.scheduled = [];
    if (this.master) { try { this.master.disconnect(); } catch { /* ignore */ } }
    if (this.ctx) { try { void this.ctx.close(); } catch { /* ignore */ } this.ctx = null; }
    this.master = null;
    this.noiseBuf = null;
  }

  /** Pause audio while the page is backgrounded without forgetting the tune. */
  suspend() {
    if (!this.enabled || !this.ctx || this.ctx.state !== "running") return;
    void this.ctx.suspend().catch(() => {
      // iOS can race a page suspension; the browser will pause audio anyway.
    });
  }

  /** Resume after a page return. This may still wait for the next user tap on iOS. */
  resume() {
    if (!this.enabled || !this.ctx || this.ctx.state !== "suspended") return;
    void this.ctx.resume().catch(() => {
      // Autoplay policy can require another explicit gesture.
    });
  }

  /** Mute + reset to the default theme (used when a run ends / menu returns). */
  reset() {
    this.theme = "adventure";
    this.pass = 0;
  }

  private clearScheduled(at: number) {
    for (const n of this.scheduled) {
      try {
        n.gain.gain.cancelScheduledValues(at);
        n.gain.gain.setValueAtTime(0, at);
        n.osc.stop(at);
      } catch { /* already stopped */ }
    }
    this.scheduled = [];
  }

  private playNote(
    freq: number,
    start: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    detune = 0,
  ) {
    const ctx = this.ctx; const master = this.master;
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (detune) osc.detune.setValueAtTime(detune, start);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.008);
    g.gain.linearRampToValueAtTime(gain * 0.6, start + dur * 0.5);
    g.gain.linearRampToValueAtTime(0, start + dur);
    osc.connect(g); g.connect(master);
    osc.start(start); osc.stop(start + dur + 0.05);
    this.scheduled.push({ osc, gain: g });
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
    this.scheduled.push({ osc: src, gain: g });
  }

  /** Heavy low noise thud used by the boss theme on the downbeat. */
  private playThud(start: number) {
    const ctx = this.ctx; const master = this.master; const buf = this.noiseBuf;
    if (!ctx || !master || !buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 320;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.28, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    src.connect(lp); lp.connect(g); g.connect(master);
    src.start(start); src.stop(start + 0.26);
    this.scheduled.push({ osc: src, gain: g });
  }

  private loop() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const def = THEMES[this.theme];
    const beat = 60 / def.bpm;
    const now = ctx.currentTime + 0.05;
    // Every other pass through the loop gets a light variation so the repeat
    // point is less obvious: an octave-up echo lead and thinner hats.
    this.pass += 1;
    const varied = this.pass % 2 === 0;

    // Drop references to the previous bar's (already finished) nodes.
    this.scheduled = [];

    // Melody (lead voice)
    let t = now;
    for (const [n, b] of def.melody) {
      const d = b * beat;
      if (n > 0) {
        this.playNote(midiToFreq(n), t, d * 0.92, def.leadWave, def.leadGain);
        // Slightly detuned twin gives the boss lead a snarling, unstable edge.
        if (def.detuneLead) {
          this.playNote(midiToFreq(n), t, d * 0.92, def.leadWave, def.leadGain * 0.7, 14);
        }
        if (varied && def.percussion !== "downbeat") {
          // Soft octave-up echo, a half-beat late.
          this.playNote(midiToFreq(n + 12), t + beat * 0.5, d * 0.5, "triangle", def.leadGain * 0.28);
        }
      }
      t += d;
    }
    const melodyEnd = t;

    // Bass
    let bt = now;
    for (const [n, b] of def.bass) {
      const d = b * beat;
      if (n > 0) this.playNote(midiToFreq(n), bt, d * 0.95, def.bassWave, def.bassGain);
      bt += d;
    }

    // Optional harmony pad
    if (def.harmony) {
      let ht = now;
      for (const [n, b] of def.harmony) {
        const d = b * beat;
        if (n > 0) this.playNote(midiToFreq(n), ht, d * 0.9, "square", def.leadGain * 0.5);
        ht += d;
      }
    }

    // Percussion for the full loop length.
    const totalBeats = def.melody.reduce((s, [, b]) => s + b, 0);
    if (def.percussion === "offbeat") {
      for (let i = 0; i < totalBeats * 2; i++) {
        // Off-beats: skip beat 0, 1, 2… — hit on the "&".
        if (varied ? i % 4 === 1 : i % 2 === 1) this.playHat(now + i * (beat / 2));
      }
    } else if (def.percussion === "downbeat") {
      for (let i = 0; i < totalBeats; i++) {
        if (i % 2 === 0) this.playThud(now + i * beat);
        else this.playHat(now + i * beat);
      }
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
