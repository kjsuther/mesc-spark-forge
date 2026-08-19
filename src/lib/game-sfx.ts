// ============================================================================
// Tiny procedural 16-bit sound-effect engine.
//
// Deliberately separate from GameMusic: effects are one-shots that must be
// able to fire while the music loop is muted or mid-theme-swap. Everything is
// synthesised (square/triangle oscillators + noise bursts) so there are no
// audio files to download and nothing to stall the first frame.
// ============================================================================

export type SfxKind =
  | "door-unlock"
  | "door-open"
  | "door-close"
  | "footstep"
  | "rumble"
  | "bear-step"
  | "roar"
  | "impact"
  | "pickup"
  | "whoosh"
  | "umbrella";


let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let enabled = true;

function ensure(): boolean {
  if (typeof window === "undefined") return false;
  if (ctx) return true;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.floor(sr * 0.6), sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise = buf;
    return true;
  } catch {
    ctx = null;
    return false;
  }
}

/** Mirrors the on-screen sound toggle so effects mute with the music. */
export function setSfxEnabled(on: boolean) {
  enabled = on;
  if (master && ctx) master.gain.setValueAtTime(on ? 0.5 : 0, ctx.currentTime);
}

function tone(
  freq: number,
  at: number,
  dur: number,
  type: OscillatorType,
  gain: number,
  endFreq?: number,
) {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), at + dur);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

function burst(at: number, dur: number, gain: number, lo: number, hi: number) {
  if (!ctx || !master || !noise) return;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(hi, at);
  bp.frequency.exponentialRampToValueAtTime(Math.max(40, lo), at + dur);
  bp.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(bp);
  bp.connect(g);
  g.connect(master);
  src.start(at);
  src.stop(at + dur + 0.05);
}

/** Fire a one-shot effect. Safe to call every frame-ish; cheap and non-blocking. */
export function playSfx(kind: SfxKind) {
  if (!enabled || !ensure() || !ctx) return;
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  const t = ctx.currentTime;
  switch (kind) {
    case "door-unlock":
      // Bright two-note chime + a metallic click, i.e. "the lock gave way".
      burst(t, 0.08, 0.25, 400, 3800);
      tone(880, t + 0.03, 0.12, "square", 0.16);
      tone(1318, t + 0.14, 0.22, "square", 0.16);
      break;
    case "door-open":
      tone(180, t, 0.35, "sawtooth", 0.1, 420);
      burst(t, 0.3, 0.12, 200, 1400);
      break;
    case "door-close":
      tone(420, t, 0.22, "sawtooth", 0.1, 120);
      burst(t + 0.18, 0.18, 0.3, 80, 900);
      tone(70, t + 0.2, 0.28, "triangle", 0.3, 45);
      break;
    case "footstep":
      burst(t, 0.07, 0.14, 120, 900);
      break;
    case "bear-step":
      tone(58, t, 0.2, "triangle", 0.35, 34);
      burst(t, 0.14, 0.2, 90, 700);
      break;
    case "rumble":
      tone(44, t, 1.4, "triangle", 0.3, 30);
      tone(31, t, 1.4, "sine", 0.25, 24);
      burst(t, 1.2, 0.1, 40, 260);
      break;
    case "roar": {
      // Layered growl: a falling saw, a detuned partner, and a noise snarl.
      tone(220, t, 0.9, "sawtooth", 0.22, 70);
      tone(146, t + 0.02, 0.95, "sawtooth", 0.18, 52);
      burst(t, 0.85, 0.24, 120, 1600);
      break;
    }
    case "impact":
      tone(90, t, 0.25, "triangle", 0.35, 40);
      burst(t, 0.2, 0.3, 60, 1200);
      break;
    case "pickup":
      // Bright two-note rising blip: "got it".
      tone(880, t, 0.09, "square", 0.18);
      tone(1318, t + 0.08, 0.14, "square", 0.16);
      break;
    case "whoosh":
      burst(t, 0.4, 0.16, 200, 2600);
      break;
    case "umbrella":
      // Canopy pop: quick airy whoosh + soft click, kept under the music.
      burst(t, 0.09, 0.1, 400, 2200);
      tone(520, t + 0.02, 0.07, "triangle", 0.08, 760);
      break;

  }
}
