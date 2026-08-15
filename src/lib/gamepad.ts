import { useEffect, useState } from "react";

/**
 * Shared USB game-controller service (arcade sticks such as the Trooper 2,
 * plus any other standard-mapping HID gamepad).
 *
 * One poll loop for the whole app: the game reads held directions for
 * movement, the website reads edge-triggered directions for focus
 * navigation. Polling only runs while at least one pad is connected, so
 * keyboard/touch players pay nothing.
 */

export type GamepadFrame = {
  /** Held state, -1..1 after dead-zone, from stick or D-pad. */
  x: number;
  y: number;
  /** Held direction flags (digital). */
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  /** Edge-triggered directions, with key-repeat while held. */
  tapLeft: boolean;
  tapRight: boolean;
  tapUp: boolean;
  tapDown: boolean;
  /** Edge-triggered buttons. */
  confirm: boolean; // button 0 (main / A)
  back: boolean; // button 1 (B)
  start: boolean; // button 9
  select: boolean; // button 8
  /** Any button just pressed — useful for "press anything to continue". */
  anyPress: boolean;
};

type Listener = (frame: GamepadFrame) => void;

const DEAD_ZONE = 0.45;
const REPEAT_DELAY = 380;
const REPEAT_RATE = 130;

const listeners = new Set<Listener>();
const connectListeners = new Set<(connected: boolean) => void>();

let raf = 0;
let running = false;
let connected = false;

const prevButtons = new Set<number>();
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

function axis(value: number | undefined): number {
  const v = typeof value === "number" ? value : 0;
  return Math.abs(v) < DEAD_ZONE ? 0 : v;
}

function edgeDir(
  dir: "left" | "right" | "up" | "down",
  held: boolean,
  now: number,
): boolean {
  if (!held) {
    heldSince[dir] = 0;
    nextRepeat[dir] = 0;
    return false;
  }
  if (!heldSince[dir]) {
    heldSince[dir] = now;
    nextRepeat[dir] = now + REPEAT_DELAY;
    return true;
  }
  if (now >= nextRepeat[dir]) {
    nextRepeat[dir] = now + REPEAT_RATE;
    return true;
  }
  return false;
}

function poll() {
  const list = pads();
  const now = performance.now();

  let x = 0;
  let y = 0;
  const down = new Set<number>();

  for (const pad of list) {
    // Most arcade sticks report the stick on axes 0/1; many also mirror it on
    // the D-pad buttons 12-15 or on a hat axis. Read all of them and merge.
    const ax = axis(pad.axes[0]);
    const ay = axis(pad.axes[1]);
    if (Math.abs(ax) > Math.abs(x)) x = ax;
    if (Math.abs(ay) > Math.abs(y)) y = ay;
    pad.buttons.forEach((b, i) => {
      if (b?.pressed || (b?.value ?? 0) > 0.5) down.add(i);
    });
  }

  if (down.has(14)) x = -1;
  if (down.has(15)) x = 1;
  if (down.has(12)) y = -1;
  if (down.has(13)) y = 1;

  const left = x < -0.001;
  const right = x > 0.001;
  const up = y < -0.001;
  const dn = y > 0.001;

  const pressed = (i: number) => down.has(i) && !prevButtons.has(i);
  let anyPress = false;
  for (const i of down) if (!prevButtons.has(i)) anyPress = true;

  const frame: GamepadFrame = {
    x,
    y,
    left,
    right,
    up,
    down: dn,
    tapLeft: edgeDir("left", left, now),
    tapRight: edgeDir("right", right, now),
    tapUp: edgeDir("up", up, now),
    tapDown: edgeDir("down", dn, now),
    confirm: pressed(0) || pressed(2),
    back: pressed(1) || pressed(3),
    start: pressed(9),
    select: pressed(8),
    anyPress,
  };

  prevButtons.clear();
  for (const i of down) prevButtons.add(i);

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
  for (const fn of connectListeners) fn(next);
}

function start() {
  if (running || typeof window === "undefined") return;
  running = true;
  raf = requestAnimationFrame(poll);
}

function stop() {
  running = false;
  cancelAnimationFrame(raf);
  prevButtons.clear();
}

function refresh() {
  const any = pads().length > 0;
  setConnected(any);
  if (any) start();
  else stop();
}

let installed = false;
function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("gamepadconnected", refresh);
  window.addEventListener("gamepaddisconnected", () => setTimeout(refresh, 0));
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
