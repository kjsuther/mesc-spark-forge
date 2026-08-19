import { useEffect, useState } from "react";

/**
 * Shared USB game-controller service (arcade sticks such as the Trooper 2,
 * plus any other standard-mapping HID gamepad).
 *
 * One poll loop for the whole app: the game reads held directions for
 * movement, the website reads edge-triggered directions for focus
 * navigation. Polling only runs while at least one pad is connected, so
 * keyboard/touch players pay nothing.
 *
 * Two sampling rates on purpose. A fast timer samples the pads every few
 * milliseconds and *latches* anything it sees pressed; the animation frame
 * then hands that latched state to listeners. Polling only on rAF drops
 * button taps that start and finish between two frames, which is exactly the
 * "I pressed jump and nothing happened" complaint on an arcade stick.
 */

export type GamepadFrame = {
  /** Held state, -1..1 after dead-zone, from stick, hat or D-pad. */
  x: number;
  y: number;
  /** Held direction flags (digital). */
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  /** Edge-triggered directions, with key-repeat while held (menu navigation). */
  tapLeft: boolean;
  tapRight: boolean;
  tapUp: boolean;
  tapDown: boolean;
  /** Edge-triggered buttons. */
  confirm: boolean; // button 0 (main / A)
  back: boolean; // button 1 (B)
  start: boolean; // button 9
  select: boolean; // button 8
  /** Stick click (button 10 / 11) — used to leave demo mode. */
  exit: boolean;
  /** Any face button just pressed — the game treats all four as "jump". */
  jump: boolean;
  /** Any button just pressed — useful for "press anything to continue". */
  anyPress: boolean;
};

type Listener = (frame: GamepadFrame) => void;

/** Movement: engage early so the stick feels as immediate as a key press… */
const MOVE_ON = 0.13;
/** …and release a touch later so a stick resting on the threshold can't chatter. */
const MOVE_OFF = 0.09;
/** Menu navigation needs a deliberate push: well above any resting drift. */
const NAV_ZONE = 0.75;
/** The stick must fall back below this before another menu move counts. */
const NAV_RELEASE = 0.35;
/**
 * Pulling DOWN raises the in-game umbrella, so it must be a deliberate push:
 * resting drift on a cheap arcade stick easily clears the movement threshold
 * and would leave the umbrella permanently open.
 */
const DOWN_ON = 0.55;
const DOWN_OFF = 0.3;

const SAMPLE_MS = 4;

const listeners = new Set<Listener>();
const connectListeners = new Set<(connected: boolean) => void>();

let raf = 0;
let sampler: ReturnType<typeof setInterval> | undefined;
let running = false;
let connected = false;

/** Buttons held at the most recent sample. */
let heldButtons = new Set<number>();
/** Buttons seen pressed since the last delivered frame (sub-frame taps land here). */
let latchedButtons = new Set<number>();
/** Buttons that were already held when the previous frame was delivered. */
const prevButtons = new Set<number>();
/** Live axis values from the most recent sample. */
let sampleX = 0;
let sampleY = 0;
/** Hysteresis state for held directions. */
let heldLeft = false;
let heldRight = false;
let heldUp = false;
let heldDown = false;

const heldSince: Record<"left" | "right" | "up" | "down", number> = {
  left: 0,
  right: 0,
  up: 0,
  down: 0,
};
const nextRepeat: Record<"left" | "right" | "up" | "down", number> = {
  left: 0,
  right: 0,
  up: 0,
  down: 0,
};

function pads(): Gamepad[] {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return [];
  return Array.from(navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => !!p);
}

function raw(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Decode the classic hat/POV axis (usually axis 9) into x/y.
 * It rests at a value outside -1..1 (commonly 1.28 / 3.28) and steps through
 * the eight compass directions in 2/7 increments starting at "up" = -1.
 */
function hat(value: number | undefined): { x: number; y: number } | null {
  const v = raw(value);
  if (!Number.isFinite(v) || v > 1.05 || v < -1.05) return null;
  const step = Math.round(((v + 1) * 7) / 2) % 8;
  switch (step) {
    case 0:
      return { x: 0, y: -1 }; // up
    case 1:
      return { x: 1, y: -1 };
    case 2:
      return { x: 1, y: 0 };
    case 3:
      return { x: 1, y: 1 };
    case 4:
      return { x: 0, y: 1 };
    case 5:
      return { x: -1, y: 1 };
    case 6:
      return { x: -1, y: 0 };
    case 7:
      return { x: -1, y: -1 };
    default:
      return null;
  }
}

/** Take whichever source is pushing hardest in this direction. */
function strongest(current: number, next: number): number {
  return Math.abs(next) > Math.abs(current) ? next : current;
}

/** Sample every connected pad and latch anything pressed. */
function sample() {
  const list = pads();
  let x = 0;
  let y = 0;
  const down = new Set<number>();

  for (const pad of list) {
    // Sticks report on axes 0/1. Arcade sticks and some pads mirror the same
    // direction on axes 6/7, on a hat axis (9), or on D-pad buttons 12-15 —
    // depending on the switch position, only one of them carries the signal.
    x = strongest(x, raw(pad.axes[0]));
    y = strongest(y, raw(pad.axes[1]));
    x = strongest(x, raw(pad.axes[6]));
    y = strongest(y, raw(pad.axes[7]));
    const h = hat(pad.axes[9]);
    if (h) {
      x = strongest(x, h.x);
      y = strongest(y, h.y);
    }
    pad.buttons.forEach((b, i) => {
      if (b?.pressed || (b?.value ?? 0) > 0.5) down.add(i);
    });
  }

  if (down.has(14)) x = -1;
  if (down.has(15)) x = 1;
  if (down.has(12)) y = -1;
  if (down.has(13)) y = 1;

  sampleX = x;
  sampleY = y;
  heldButtons = down;
  for (const i of down) {
    latchedButtons.add(i);
    pullLatched.add(i);
  }
}

/** Held-with-hysteresis: engage at MOVE_ON, stay on until below MOVE_OFF. */
function hold(active: boolean, value: number, sign: 1 | -1): boolean {
  const magnitude = sign > 0 ? value : -value;
  if (active) return magnitude > MOVE_OFF;
  return magnitude > MOVE_ON;
}

/**
 * Edge-only menu direction: fires once per physical push. Holding the stick
 * does nothing more until it returns near center, so a drifting or leaned-on
 * stick can't cycle the page through every link and form field.
 */
function edgeDir(dir: "left" | "right" | "up" | "down", held: boolean, released: boolean): boolean {
  if (released) heldSince[dir] = 0;
  if (!held) return false;
  if (heldSince[dir]) return false;
  heldSince[dir] = 1;
  return true;
}

function clearInputState() {
  heldButtons = new Set<number>();
  latchedButtons = new Set<number>();
  prevButtons.clear();
  sampleX = 0;
  sampleY = 0;
  heldLeft = heldRight = heldUp = heldDown = false;
  pullLatched.clear();
  pullPrev = new Set<number>();
  padOwnsLeft = padOwnsRight = false;
  for (const dir of ["left", "right", "up", "down"] as const) {
    heldSince[dir] = 0;
    nextRepeat[dir] = 0;
  }
}

/** Deliver a frame with every input released — used on blur/disconnect so a
 *  direction held at the moment we stop polling can never stick. */
function emitReleaseFrame() {
  clearInputState();
  const frame: GamepadFrame = {
    x: 0,
    y: 0,
    left: false,
    right: false,
    up: false,
    down: false,
    tapLeft: false,
    tapRight: false,
    tapUp: false,
    tapDown: false,
    confirm: false,
    back: false,
    start: false,
    select: false,
    exit: false,
    jump: false,
    anyPress: false,
  };
  for (const fn of listeners) {
    try {
      fn(frame);
    } catch (err) {
      console.warn("[gamepad] listener failed", err);
    }
  }
}

function poll() {
  // rAF can coalesce; make sure we have a reading even if the timer is starved.
  sample();
  heldLeft = hold(heldLeft, sampleX, -1);
  heldRight = hold(heldRight, sampleX, 1);
  heldUp = hold(heldUp, sampleY, -1);
  heldDown = heldDown ? sampleY > DOWN_OFF : sampleY > DOWN_ON;
  // Opposite directions can't both win (some hats briefly report both).
  if (heldLeft && heldRight) {
    if (sampleX < 0) heldRight = false;
    else heldLeft = false;
  }

  const navLeft = sampleX < -NAV_ZONE;
  const navRight = sampleX > NAV_ZONE;
  const navUp = sampleY < -NAV_ZONE;
  const navDown = sampleY > NAV_ZONE;

  // A latched button counts as pressed for this frame even if the player
  // already let go — that is what rescues fast taps between frames.
  const pressed = (i: number) => latchedButtons.has(i) && !prevButtons.has(i);
  let anyPress = false;
  for (const i of latchedButtons) if (!prevButtons.has(i)) anyPress = true;

  const frame: GamepadFrame = {
    x: sampleX,
    y: sampleY,
    left: heldLeft,
    right: heldRight,
    up: heldUp,
    down: heldDown,
    tapLeft: edgeDir("left", navLeft, sampleX > -NAV_RELEASE),
    tapRight: edgeDir("right", navRight, sampleX < NAV_RELEASE),
    tapUp: edgeDir("up", navUp, sampleY > -NAV_RELEASE),
    tapDown: edgeDir("down", navDown, sampleY < NAV_RELEASE),
    confirm: pressed(0) || pressed(2),
    back: pressed(1) || pressed(3),
    start: pressed(9),
    select: pressed(8),
    exit: pressed(10) || pressed(11),
    // Any face button jumps: on an arcade stick the "main" button varies.
    jump: pressed(0) || pressed(1) || pressed(2) || pressed(3),
    anyPress,
  };

  prevButtons.clear();
  // Only buttons still physically held carry over; a latched-and-released tap
  // must be able to fire again on the very next frame.
  for (const i of heldButtons) prevButtons.add(i);
  latchedButtons = new Set<number>();

  for (const fn of listeners) {
    try {
      fn(frame);
    } catch (err) {
      console.warn("[gamepad] listener failed", err);
    }
  }

  raf = requestAnimationFrame(poll);
}

function setConnected(next: boolean) {
  if (connected === next) return;
  connected = next;
  if (!next) emitReleaseFrame();
  for (const fn of connectListeners) fn(next);
}

function start() {
  if (running || typeof window === "undefined") return;
  running = true;
  clearInputState();
  sampler = setInterval(sample, SAMPLE_MS);
  raf = requestAnimationFrame(poll);
}

function stop() {
  if (!running) return;
  running = false;
  cancelAnimationFrame(raf);
  if (sampler !== undefined) clearInterval(sampler);
  sampler = undefined;
  emitReleaseFrame();
}

function refresh() {
  const any = pads().length > 0;
  setConnected(any);
  if (any && listeners.size > 0) start();
  else if (!any) stop();
}

let installed = false;
function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("gamepadconnected", refresh);
  window.addEventListener("gamepaddisconnected", () => setTimeout(refresh, 0));
  // Leaving the page (tab switch, alt-tab, fullscreen swap) freezes polling —
  // release everything first so nothing is left held down on the way out.
  window.addEventListener("blur", emitReleaseFrame);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") emitReleaseFrame();
  });
  // Some browsers only expose a pad after its first input event, so take one
  // reading now in case the stick was already plugged in.
  refresh();
}

/** Subscribe to per-frame controller input. Returns an unsubscribe function. */
export function subscribeGamepad(fn: Listener): () => void {
  install();
  listeners.add(fn);
  if (connected) start();
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) stop();
  };
}

/** Face buttons that all count as "jump" on an arcade stick. */
const FACE_BUTTONS = [0, 1, 2, 3];
/** Buttons pressed since the last direct pull (sub-frame taps land here). */
const pullLatched = new Set<number>();
/** Buttons already held at the previous direct pull. */
let pullPrev = new Set<number>();
/** Whether the pad — rather than touch/keyboard — set each held direction. */
let padOwnsLeft = false;
let padOwnsRight = false;
let padOwnsDown = false;

/**
 * Read the controller synchronously and write straight into the game's shared
 * input object. Called from the engine's own update loop so stick and button
 * state is sampled microseconds before the hero moves — no extra frame of lag
 * from the subscription pipeline.
 *
 * Touch and keyboard input share the same object, so directions the pad is not
 * driving are left untouched.
 */
export function pumpGamepadInput(target: {
  left: boolean;
  right: boolean;
  jumpReq: boolean;
  down?: boolean;
}): void {
  if (typeof navigator === "undefined") return;
  if (!connected && pads().length === 0) {
    padOwnsLeft = padOwnsRight = padOwnsDown = false;
    return;
  }

  sample();
  heldLeft = hold(heldLeft, sampleX, -1);
  heldRight = hold(heldRight, sampleX, 1);
  heldDown = hold(heldDown, sampleY, 1);
  if (heldLeft && heldRight) {
    if (sampleX < 0) heldRight = false;
    else heldLeft = false;
  }

  if (heldDown) {
    target.down = true;
    padOwnsDown = true;
  } else if (padOwnsDown) {
    target.down = false;
    padOwnsDown = false;
  }


  if (heldLeft) {
    target.left = true;
    padOwnsLeft = true;
  } else if (padOwnsLeft) {
    target.left = false;
    padOwnsLeft = false;
  }
  if (heldRight) {
    target.right = true;
    padOwnsRight = true;
  } else if (padOwnsRight) {
    target.right = false;
    padOwnsRight = false;
  }

  for (const i of FACE_BUTTONS) {
    if ((pullLatched.has(i) || heldButtons.has(i)) && !pullPrev.has(i)) {
      target.jumpReq = true;
      break;
    }
  }
  pullPrev = new Set(heldButtons);
  pullLatched.clear();
}

export function isGamepadConnected(): boolean {
  return connected;
}

/** Reactive "is a controller plugged in?" flag for UI copy. */
export function useGamepadConnected(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    install();
    setOn(isGamepadConnected());
    const fn = (next: boolean) => setOn(next);
    connectListeners.add(fn);
    // Pads sometimes only appear once the player moves the stick — a light
    // subscription keeps the poll loop alive so that first input registers.
    const unsub = subscribeGamepad(() => {});
    return () => {
      connectListeners.delete(fn);
      unsub();
    };
  }, []);
  return on;
}
