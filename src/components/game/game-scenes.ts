// Kaplay game logic. Imported dynamically from the client so the "kaplay"
// module (which touches window at import time) never reaches the server bundle.
//
// Rendering pipeline (single source of truth):
//   1. `loadAllSprites` fetches every raw sheet, alpha-trims each frame, pads
//      grouped animation frames to a shared (maxW, maxH) with bottom-center
//      alignment, and registers each frame as its own kaplay sprite. Result:
//      the sprite bitmap ends exactly at the visible feet on every frame.
//   2. `spawnGrounded` / `spawnAirborne` / `spawnDecor` are the only ways to
//      place a sprite. All use `anchor("bot")` (or "center"), the trimmed
//      sprite's own aspect ratio, and integer coordinates.
//   3. `LAYERS` is the single Z scheme used everywhere.
//
// Because the sprite ends at the visible feet, no per-entity foot-pad
// constants exist anywhere in this file. If you find yourself writing one,
// fix the trim/pad step instead.

import type { KAPLAYCtx } from "kaplay";
import type { ImprovementKey } from "@/lib/game.functions";
import charSheetUrl from "@/assets/game/character-sheet.png";
import heroSlideSheetUrl from "@/assets/game/hero-slide-sheet.png";
import propsSheetUrl from "@/assets/game/props-sheet.png";
import propsSheet2Url from "@/assets/game/props-sheet-2.png";
import bgForestUrl from "@/assets/game/bg-forest.png";
import bgSignupUrl from "@/assets/game/bg-signup.png";
import bgRiverUrl from "@/assets/game/bg-river.png";
import bgTownUrl from "@/assets/game/bg-town.png";
import bgRelayUrl from "@/assets/game/bg-relay.png";
import bgMountainUrl from "@/assets/game/bg-mountain.png";
import bgMarketUrl from "@/assets/game/bg-market.png";
import bgClinicUrl from "@/assets/game/bg-clinic.png";
import doorSheetUrl from "@/assets/game/door-sheet.png";
import credentialsSheetUrl from "@/assets/game/credentials-sheet.png";
import goldKeyUrl from "@/assets/game/gold-key.png";
import planCardsSheetUrl from "@/assets/game/plan-cards-sheet.png";
import medicalIdUrl from "@/assets/game/medical-id.png";

export type GameFlags = Record<ImprovementKey, boolean>;

export type WinResult = {
  durationMs: number;
  docs: number;
  lives: number;
  mode: "before" | "after";
  farthestZone: number; // 0..7
  won: boolean;
  score: number;
  distancePx: number;
  jumpsLanded: number;
  enemiesPassed: number;
  deaths: number;
};

export type StartGameOpts = {
  canvas: HTMLCanvasElement;
  flags: GameFlags;
  mode: "before" | "after";
  onWin?: (result: WinResult) => void;
  onLose?: (result: WinResult) => void;
};

type Ctx = KAPLAYCtx;

// ============================ Constants ============================

// -------- Viewport scaling contract --------
// The game renders into a FIXED logical resolution. Kaplay's letterbox mode
// scales that buffer to whatever CSS box the canvas has while preserving the
// 16:9 aspect ratio, so world coordinates never depend on the device's
// physical pixels. `PIXEL_DENSITY` is intentionally a constant (not
// `window.devicePixelRatio`) so the backing buffer stays the same size across
// DPR changes (rotation, browser zoom, external monitor). Combined with the
// integer `px()` snap used by every spawn/camera call, sprites and
// backgrounds cannot clip, misalign, or shift when the screen resizes.
const LOGICAL_W = 960;
const LOGICAL_H = 540;
const PIXEL_DENSITY = 2;
/** Snap any world coordinate or computed sprite dimension to an integer.
 *  Using `floor` (not `round`) is deterministic across renders: a value of
 *  N.4999 and N.5001 both collapse to N, so a sub-pixel jitter can never
 *  toggle a sprite between two adjacent integer positions. */
const px = (n: number): number => Math.floor(n);

const BIOME_W = 1200;

const ZONES = [
  { key: "forest",   label: "Finding the Trail",         phase: "Step 1 · Learn you may qualify",           bg: "bg-forest",   ground: [80, 130, 60] as [number, number, number],  soil: [70, 45, 25] as [number, number, number] },
  { key: "signup",   label: "Setting Up Camp",           phase: "Step 2 · Create your account",             bg: "bg-signup",   ground: [95, 115, 70] as [number, number, number],  soil: [60, 45, 30] as [number, number, number] },
  { key: "river",    label: "Crossing River of Paperwork", phase: "Step 3 · Start your application",         bg: "bg-river",    ground: [180, 160, 110] as [number, number, number], soil: [120, 90, 50] as [number, number, number] },
  { key: "town",     label: "Gathering Supplies",        phase: "Step 4 · Gather your documents",           bg: "bg-town",     ground: [140, 140, 150] as [number, number, number], soil: [80, 80, 90] as [number, number, number] },
  { key: "relay",    label: "Answering the Call",        phase: "Step 5 · Respond to requests for info",    bg: "bg-relay",    ground: [140, 170, 90] as [number, number, number],  soil: [90, 70, 40] as [number, number, number] },
  { key: "mountain", label: "Waiting Mountain",          phase: "Step 6 · Await a decision",                bg: "bg-mountain", ground: [130, 120, 110] as [number, number, number], soil: [70, 60, 55] as [number, number, number] },
  { key: "market",   label: "Choosing Your Path",        phase: "Step 7 · Choose a health plan",            bg: "bg-market",   ground: [150, 180, 100] as [number, number, number], soil: [90, 65, 40] as [number, number, number] },
  { key: "clinic",   label: "Coverage Begins",           phase: "Step 8 · Enroll in coverage",              bg: "bg-clinic",   ground: [220, 220, 225] as [number, number, number], soil: [140, 145, 155] as [number, number, number] },
] as const;

const GROUND_Y = 470;
const LEVEL_END = ZONES.length * BIOME_W;
const MOVE_SPEED = 260;
const JUMP_VEL = 720;
const COYOTE_S = 0.14;
const JUMP_BUFFER_S = 0.18;
const INVULN_S = 2.0;
const PLATFORM_SNAP_TOLERANCE = 26;
const PLATFORM_EDGE_TOLERANCE = 22;

// Zone-specific overlay title + failure copy. Every death message ties back
// to the step of the Medicaid application journey the player was on.
type FailCause = "monster" | "boulder" | "water" | "fell" | "noDocs";
const OVERLAY_TITLES = [
  "PAUSE ON THE TRAIL",
  "ACCOUNT NOT CREATED",
  "APPLICATION PAUSED",
  "MISSING PAPERWORK",
  "REQUEST UNANSWERED",
  "REVIEW IN PROGRESS",
  "PLAN NOT CHOSEN",
  "ALMOST ENROLLED",
] as const;
const FAILURE_MESSAGES: Record<number, string[]> = {
  0: [
    "Pick a way to apply before moving forward.",
    "Every journey starts by choosing how you'll apply.",
  ],
  1: [
    "You need an account before you can apply online.",
    "Set up your login and try again.",
  ],
  2: [
    "A missing answer is slowing your journey.",
    "Double-check your application before submitting.",
  ],
  3: [
    "Looks like some documents are still missing.",
    "Gather everything you need before continuing.",
  ],
  4: [
    "The agency asked for more info — respond quickly.",
    "A request for information went unanswered.",
  ],
  5: [
    "Your application is still under review.",
    "Stay on the trail — you're almost there.",
  ],
  6: [
    "You need to pick a health plan to continue.",
    "Choose the plan that best fits your household.",
  ],
  7: [
    "One final step remains before coverage begins.",
    "Don't stop now — you're almost enrolled!",
  ],
};
function pickFailureMessage(zone: number, cause: FailCause): string {
  const z = Math.max(0, Math.min(ZONES.length - 1, zone));
  const arr = FAILURE_MESSAGES[z] ?? FAILURE_MESSAGES[0];
  const base = arr[Math.floor(Math.random() * arr.length)];
  if (cause === "water") return `${base}\n(Don't slip crossing the river of paperwork.)`;
  if (cause === "boulder") return `${base}\n(A tough eligibility question knocked you back.)`;
  if (cause === "monster") return `${base}\n(A confusing form stood in your way.)`;
  if (cause === "fell") return `${base}\n(You wandered off the trail — try again.)`;
  return base;
}

// Player collision box (fixed — never changes with sprite frame).
const PLAYER_HITBOX = { x: -12, y: -60, w: 24, h: 60 };

// Unified Z scheme used everywhere. Never call k.z with a magic number.
const LAYERS = {
  BG_FAR: -40,
  BG_NEAR: -30,
  GROUND: -12,
  GROUND_TOP: -10,
  BOUND: -6,
  DECOR_BACK: -4,
  PLATFORM: 0,
  PROP: 5,
  ACTOR: 10,
  PLAYER: 12,
  EFFECT: 20,
  HUD: 100,
  OVERLAY: 200,
  OVERLAY_TEXT: 201,
} as const;

// Target visible height (world px) for each trimmed sprite. Width is derived
// from the sprite's own trimmed aspect ratio, so nothing is ever stretched.
const DISPLAY_H: Record<string, number> = {
  "hero-idle": 66,
  "hero-walk-0": 66,
  "hero-walk-1": 66,
  "hero-walk-2": 66,
  "hero-walk-3": 66,
  "hero-jump": 66,
  "hero-slide-0": 66,
  "hero-slide-1": 66,
  // Mirrored left-facing frames registered post-load in registerLeftMirrors().
  "hero-idle-left": 66,
  "hero-walk-0-left": 66,
  "hero-walk-1-left": 66,
  "hero-walk-2-left": 66,
  "hero-walk-3-left": 66,
  "hero-jump-left": 66,
  signpost: 46,
  ranger: 60,
  map: 40,
  campfire: 44,
  backpack: 36,
  bridge: 24,
  id: 30,
  paystub: 30,
  envelope: 30,
  boulder: 30,
  "form-monster": 38,
  denied: 40,
  laptop: 34,
  padlock: 36,
  phone: 34,
  mailbox: 42,
  "plan-card": 32,
  "insurance-card": 32,
  "door-closed": 108,
  "door-open": 108,
  username: 34,
  password: 34,
  "gold-key": 30,
  "plan-blue": 60,
  "plan-green": 60,
  "plan-orange": 60,
  "medical-id": 46,
};

// ============================ Sprite trim pipeline ============================

type FrameSpec = { name: string; frame: number };
type SheetSpec = {
  url: string;
  cols: number;
  rows: number;
  frames: FrameSpec[];
  /** Group names in one group render at a shared (maxW, maxH) so animation
   *  frames stay horizontally locked and feet stay flush. */
  groups?: string[][];
  /** Human-readable label used by the debug overlay. */
  label?: string;
};
type SpriteSize = { w: number; h: number };
type SpriteSizes = Record<string, SpriteSize>;

// ============================ Asset debug report ============================

type AssetStatus = "loaded" | "fallback" | "failed";
type AssetEntry = {
  name: string;
  kind: "sprite" | "background";
  sheetLabel?: string;
  sheetUrl?: string;
  cols?: number;
  rows?: number;
  frame?: number;
  sheetRect?: { fx: number; fy: number; fw: number; fh: number };
  trimBBox?: { x: number; y: number; w: number; h: number };
  unified?: { w: number; h: number };
  status: AssetStatus;
  error?: string;
};
type AssetReport = {
  entries: Record<string, AssetEntry>;
  sheets: Record<string, { url: string; cols: number; rows: number; status: AssetStatus; error?: string; label: string }>;
  zoneAssets: Record<number, string[]>;
  ready: boolean;
};
const ASSET_REPORT: AssetReport = { entries: {}, sheets: {}, zoneAssets: {}, ready: false };

// Per-zone asset presence — kept in sync with spawn logic in the trail scene.
// Used by the debug overlay to show which assets each zone depends on.
const ZONE_ASSETS: Record<number, string[]> = {
  0: ["bg-forest", "signpost", "door-closed", "door-open"],
  1: ["bg-signup", "username", "password", "laptop", "door-closed", "door-open"],
  2: ["bg-river", "bridge", "boulder", "door-closed", "door-open"],
  3: ["bg-town", "id", "paystub", "envelope", "form-monster", "door-closed", "door-open"],
  4: ["bg-relay", "mailbox", "phone", "door-closed", "door-open"],
  5: ["bg-mountain", "boulder", "denied", "door-closed", "door-open"],
  6: ["bg-market", "plan-blue", "plan-green", "plan-orange", "gold-key", "plan-card", "insurance-card", "door-closed", "door-open"],
  7: ["bg-clinic", "medical-id", "door-closed", "door-open", "ranger", "campfire", "backpack", "map"],
};
for (let i = 0; i < ZONES.length; i++) ASSET_REPORT.zoneAssets[i] = ZONE_ASSETS[i] ?? [];

/** 16×16 magenta/black checker as a data URL. Used as a fallback sprite when
 *  an asset fails to load so the game can keep running and the debug overlay
 *  can flag the broken asset visually. */
function makeFallbackDataUrl(): string {
  if (typeof document === "undefined") return "";
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const g = c.getContext("2d");
  if (!g) return "";
  g.fillStyle = "#ff00ff";
  g.fillRect(0, 0, 16, 16);
  g.fillStyle = "#000";
  g.fillRect(0, 0, 8, 8);
  g.fillRect(8, 8, 8, 8);
  return c.toDataURL("image/png");
}


// Loose GameObj shape used by spawn helpers. Kaplay attaches all component
// fields at runtime; typing them as `any` here keeps the rendering pipeline
// simple without special-casing each caller.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = any;

async function loadImageEl(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => res(im);
    im.onerror = () => rej(new Error(`failed to load ${url}`));
    im.src = url;
  });
}

/**
 * Load one sheet, alpha-trim every listed frame, pad grouped frames to shared
 * (maxW, maxH) with bottom-center alignment, and register each frame as its
 * own kaplay sprite. Returns the trimmed size per sprite so callers can pick a
 * uniform display height without stretching.
 */
async function loadTrimmedSheet(k: Ctx, spec: SheetSpec): Promise<SpriteSizes> {
  const img = await loadImageEl(spec.url);
  const fw = Math.floor(img.width / spec.cols);
  const fh = Math.floor(img.height / spec.rows);

  const src = document.createElement("canvas");
  src.width = fw;
  src.height = fh;
  const sx = src.getContext("2d", { willReadFrequently: true });
  if (!sx) throw new Error("2d context unavailable");

  type BBox = { x: number; y: number; w: number; h: number };
  const bboxes: Record<string, BBox> = {};

  for (const f of spec.frames) {
    const cc = f.frame % spec.cols;
    const rr = Math.floor(f.frame / spec.cols);
    sx.clearRect(0, 0, fw, fh);
    sx.drawImage(img, cc * fw, rr * fh, fw, fh, 0, 0, fw, fh);
    const data = sx.getImageData(0, 0, fw, fh).data;
    let minX = fw;
    let minY = fh;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const a = data[(y * fw + x) * 4 + 3];
        if (a > 12) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) {
      bboxes[f.name] = { x: 0, y: 0, w: fw, h: fh };
    } else {
      bboxes[f.name] = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    }
  }

  const groupIndex: Record<string, string[]> = {};
  for (const g of spec.groups ?? []) {
    for (const n of g) groupIndex[n] = g;
  }

  const label = spec.label ?? spec.url.split("/").pop() ?? spec.url;
  const sizes: SpriteSizes = {};
  for (const f of spec.frames) {
    const group = groupIndex[f.name] ?? [f.name];
    const unifiedW = Math.max(...group.map((n) => bboxes[n].w));
    const unifiedH = Math.max(...group.map((n) => bboxes[n].h));
    const bb = bboxes[f.name];

    const out = document.createElement("canvas");
    out.width = unifiedW;
    out.height = unifiedH;
    const ox = out.getContext("2d");
    if (!ox) throw new Error("2d context unavailable");
    ox.imageSmoothingEnabled = false;

    const dx = Math.floor((unifiedW - bb.w) / 2);
    const dy = unifiedH - bb.h; // bottom-align → feet flush with bitmap bottom
    const cc = f.frame % spec.cols;
    const rr = Math.floor(f.frame / spec.cols);
    ox.drawImage(
      img,
      cc * fw + bb.x,
      rr * fh + bb.y,
      bb.w,
      bb.h,
      dx,
      dy,
      bb.w,
      bb.h,
    );

    const dataUrl = out.toDataURL("image/png");
    await k.loadSprite(f.name, dataUrl);
    sizes[f.name] = { w: unifiedW, h: unifiedH };
    ASSET_REPORT.entries[f.name] = {
      name: f.name,
      kind: "sprite",
      sheetLabel: label,
      sheetUrl: spec.url,
      cols: spec.cols,
      rows: spec.rows,
      frame: f.frame,
      sheetRect: { fx: cc * fw, fy: rr * fh, fw, fh },
      trimBBox: bb,
      unified: { w: unifiedW, h: unifiedH },
      status: "loaded",
    };
  }
  return sizes;
}

/** Wrap loadTrimmedSheet with fallback: on any error, register 16x16 magenta
 *  placeholders for every frame and record the failure in the asset report. */
async function safeLoadSheet(k: Ctx, spec: SheetSpec): Promise<SpriteSizes> {
  const label = spec.label ?? spec.url.split("/").pop() ?? spec.url;
  try {
    const sizes = await loadTrimmedSheet(k, spec);
    ASSET_REPORT.sheets[label] = { url: spec.url, cols: spec.cols, rows: spec.rows, status: "loaded", label };
    return sizes;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ASSET_REPORT.sheets[label] = { url: spec.url, cols: spec.cols, rows: spec.rows, status: "failed", error: msg, label };
    const fallback = makeFallbackDataUrl();
    const sizes: SpriteSizes = {};
    for (const f of spec.frames) {
      try {
        await k.loadSprite(f.name, fallback);
      } catch {
        /* even fallback can fail — the entry status still records it */
      }
      sizes[f.name] = { w: 32, h: 32 };
      ASSET_REPORT.entries[f.name] = {
        name: f.name,
        kind: "sprite",
        sheetLabel: label,
        sheetUrl: spec.url,
        cols: spec.cols,
        rows: spec.rows,
        frame: f.frame,
        unified: { w: 32, h: 32 },
        status: "fallback",
        error: msg,
      };
    }
    console.warn(`[assets] sheet failed: ${label}`, err);
    return sizes;
  }
}

/** Wrap k.loadSprite for a full-frame background, with fallback + reporting. */
async function safeLoadBackground(k: Ctx, name: string, url: string): Promise<void> {
  try {
    await k.loadSprite(name, url);
    ASSET_REPORT.entries[name] = {
      name,
      kind: "background",
      sheetLabel: name,
      sheetUrl: url,
      status: "loaded",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    try {
      await k.loadSprite(name, makeFallbackDataUrl());
    } catch { /* ignore */ }
    ASSET_REPORT.entries[name] = {
      name,
      kind: "background",
      sheetLabel: name,
      sheetUrl: url,
      status: "fallback",
      error: msg,
    };
    console.warn(`[assets] background failed: ${name}`, err);
  }
}


async function loadAllSprites(k: Ctx): Promise<SpriteSizes> {
  const heroFrames: FrameSpec[] = [
    { name: "hero-idle", frame: 0 },
    { name: "hero-walk-0", frame: 1 },
    { name: "hero-walk-1", frame: 2 },
    { name: "hero-walk-2", frame: 3 },
    { name: "hero-walk-3", frame: 4 },
    { name: "hero-jump", frame: 5 },
  ];
  const slideFrames: FrameSpec[] = [
    { name: "hero-slide-0", frame: 0 },
    { name: "hero-slide-1", frame: 1 },
  ];
  const propFrames: FrameSpec[] = [
    { name: "signpost", frame: 0 },
    { name: "ranger", frame: 1 },
    { name: "map", frame: 2 },
    { name: "campfire", frame: 3 },
    { name: "backpack", frame: 4 },
    { name: "bridge", frame: 5 },
    { name: "id", frame: 6 },
    { name: "paystub", frame: 7 },
    { name: "envelope", frame: 8 },
    { name: "boulder", frame: 9 },
    { name: "form-monster", frame: 10 },
    { name: "denied", frame: 11 },
  ];
  const propFrames2: FrameSpec[] = [
    { name: "laptop",         frame: 0 },
    { name: "padlock",        frame: 1 },
    { name: "phone",          frame: 2 },
    { name: "mailbox",        frame: 3 },
    { name: "plan-card",      frame: 4 },
    { name: "insurance-card", frame: 5 },
  ];

  const doorFrames: FrameSpec[] = [
    { name: "door-closed", frame: 0 },
    { name: "door-open", frame: 1 },
  ];
  const credFrames: FrameSpec[] = [
    { name: "username", frame: 0 },
    { name: "password", frame: 1 },
  ];
  const keyFrames: FrameSpec[] = [{ name: "gold-key", frame: 0 }];
  const planFrames: FrameSpec[] = [
    { name: "plan-blue", frame: 0 },
    { name: "plan-green", frame: 1 },
    { name: "plan-orange", frame: 2 },
  ];
  const idFrames: FrameSpec[] = [{ name: "medical-id", frame: 0 }];

  const [heroSizes, slideSizes, propSizes, propSizes2, doorSizes, credSizes, keySizes, planSizes, idSizes] = await Promise.all([
    safeLoadSheet(k, {
      url: charSheetUrl,
      cols: 3,
      rows: 2,
      frames: heroFrames,
      groups: [heroFrames.map((f) => f.name)],
      label: "character-sheet.png",
    }),
    safeLoadSheet(k, {
      url: heroSlideSheetUrl,
      cols: 2,
      rows: 1,
      frames: slideFrames,
      groups: [slideFrames.map((f) => f.name)],
      label: "hero-slide-sheet.png",
    }),
    safeLoadSheet(k, { url: propsSheetUrl,  cols: 4, rows: 3, frames: propFrames,  label: "props-sheet.png" }),
    safeLoadSheet(k, { url: propsSheet2Url, cols: 3, rows: 2, frames: propFrames2, label: "props-sheet-2.png" }),
    safeLoadSheet(k, { url: doorSheetUrl,        cols: 2, rows: 1, frames: doorFrames, label: "door-sheet.png" }),
    safeLoadSheet(k, { url: credentialsSheetUrl, cols: 2, rows: 1, frames: credFrames, label: "credentials-sheet.png" }),
    safeLoadSheet(k, { url: goldKeyUrl,          cols: 1, rows: 1, frames: keyFrames,  label: "gold-key.png" }),
    safeLoadSheet(k, { url: planCardsSheetUrl,   cols: 3, rows: 1, frames: planFrames, label: "plan-cards-sheet.png" }),
    safeLoadSheet(k, { url: medicalIdUrl,        cols: 1, rows: 1, frames: idFrames,   label: "medical-id.png" }),
  ]);

  // Register horizontally-mirrored copies of the hero walk/idle/jump frames
  // so the character has a true set of left-facing sprites (rather than
  // relying on render-time flipX, which can subtly misalign the hitbox
  // against decorative asymmetric details).
  const leftSizes = await registerLeftMirrors(k, heroFrames.map((f) => f.name), heroSizes);


  // Backgrounds don't need trimming but still get load-status tracking + a
  // magenta fallback so a missing PNG doesn't crash the scene.
  await Promise.all([
    safeLoadBackground(k, "bg-forest",   bgForestUrl),
    safeLoadBackground(k, "bg-signup",   bgSignupUrl),
    safeLoadBackground(k, "bg-river",    bgRiverUrl),
    safeLoadBackground(k, "bg-town",     bgTownUrl),
    safeLoadBackground(k, "bg-relay",    bgRelayUrl),
    safeLoadBackground(k, "bg-mountain", bgMountainUrl),
    safeLoadBackground(k, "bg-market",   bgMarketUrl),
    safeLoadBackground(k, "bg-clinic",   bgClinicUrl),
  ]);

  ASSET_REPORT.ready = true;
  if (typeof window !== "undefined") {
    (window as unknown as { __gameAssetReport?: AssetReport }).__gameAssetReport = ASSET_REPORT;
  }

  return { ...heroSizes, ...propSizes, ...propSizes2, ...doorSizes, ...credSizes, ...keySizes, ...planSizes, ...idSizes };
}


// ============================ Spawn helpers ============================

/** Compute the display width for a sprite given its trimmed size and the
 *  target display height for that sprite name. */
function displaySize(name: string, sizes: SpriteSizes): { w: number; h: number } {
  const s = sizes[name];
  if (!s) throw new Error(`unknown sprite ${name}`);
  const h = DISPLAY_H[name] ?? s.h;
  const w = px(s.w * (h / s.h));
  return { w, h: px(h) };
}


type SpawnGrounded = {
  x: number;
  groundY?: number;
  z?: number;
  tag?: string;
  props?: Record<string, unknown>;
  hitboxScale?: { x: number; w: number; h: number }; // relative to sprite feet
};

/** Spawn a sprite whose feet rest on the ground. Uses anchor("bot") so the
 *  trimmed sprite's bottom edge (== visible feet) sits at groundY. */
function spawnGrounded(
  k: Ctx,
  name: string,
  sizes: SpriteSizes,
  opts: SpawnGrounded,
) {
  const { w, h } = displaySize(name, sizes);
  const gy = opts.groundY ?? GROUND_Y;
  const comps: unknown[] = [
    k.sprite(name, { width: w, height: h }),
    k.pos(px(opts.x), px(gy)),
    k.anchor("bot"),
    k.z(opts.z ?? LAYERS.ACTOR),
  ];
  if (opts.hitboxScale) {
    const hx = opts.hitboxScale;
    comps.push(
      k.area({
        shape: new k.Rect(k.vec2(hx.x, -hx.h + 0), hx.w, hx.h),
      }),
    );
  }
  if (opts.tag) comps.push(opts.tag);
  if (opts.props) comps.push(opts.props);
  return k.add(comps as never) as AnyObj;
}

type SpawnAirborne = {
  x: number;
  y: number;
  z?: number;
  tag?: string;
  props?: Record<string, unknown>;
  hitboxRadius?: number;
};

function spawnAirborne(
  k: Ctx,
  name: string,
  sizes: SpriteSizes,
  opts: SpawnAirborne,
) {
  const { w, h } = displaySize(name, sizes);
  const r = opts.hitboxRadius ?? Math.min(w, h) / 2;
  const comps: unknown[] = [
    k.sprite(name, { width: w, height: h }),
    k.pos(px(opts.x), px(opts.y)),
    k.anchor("center"),
    k.z(opts.z ?? LAYERS.PROP),
    k.area({ shape: new k.Rect(k.vec2(-r, -r), r * 2, r * 2) }),
  ];
  if (opts.tag) comps.push(opts.tag);
  if (opts.props) comps.push(opts.props);
  return k.add(comps as never) as AnyObj;
}

function spawnDecor(
  k: Ctx,
  name: string,
  sizes: SpriteSizes,
  opts: { x: number; groundY?: number; z?: number },
) {
  const { w, h } = displaySize(name, sizes);
  const gy = opts.groundY ?? GROUND_Y;
  return k.add([
    k.sprite(name, { width: w, height: h }),
    k.pos(px(opts.x), px(gy)),
    k.anchor("bot"),
    k.z(opts.z ?? LAYERS.PROP),
  ]);
}

// ============================ Game bootstrap ============================

export async function startGame(opts: StartGameOpts): Promise<() => void> {
  const kaplay = (await import("kaplay")).default;
  const active: Partial<GameFlags> = opts.mode === "after" ? opts.flags : {};

  const k: Ctx = kaplay({
    canvas: opts.canvas,
    // Fixed logical resolution. Kaplay's letterbox mode scales this buffer to
    // whatever CSS box the canvas has while preserving 16:9, so gameplay
    // coordinates never depend on the physical viewport.
    width: LOGICAL_W,
    height: LOGICAL_H,
    background: [20, 20, 30],
    letterbox: true,
    global: false,
    debug: false,
    // CONSTANT pixel density — not derived from devicePixelRatio. This is the
    // whole reason sprites stay aligned across DPR changes (rotation, zoom,
    // external displays). The browser handles all CSS-pixel scaling uniformly.
    pixelDensity: PIXEL_DENSITY,
    crisp: true,
    touchToMouse: true,
  });


  k.setGravity(1800);

  const sizes = await loadAllSprites(k);

  k.scene("trail", (spawnX: number = 40, lives: number = 1) => {
    const startTime = k.time();

    // ---- Sky backdrops (per-zone solid color behind the painted bg so
    //      images with transparent or off-color edges don't leave whitespace).
    const SKY_COLORS: Array<[number, number, number]> = [
      [128, 190, 220], // forest
      [140, 200, 235], // signup
      [110, 180, 220], // river
      [160, 200, 220], // town
      [150, 200, 210], // relay - fixes zone 5 whitespace
      [130, 155, 190], // mountain
      [180, 210, 230], // market
      [220, 235, 245], // clinic
    ];
    ZONES.forEach((_z, i) => {
      k.add([
        k.rect(BIOME_W + 2, 540),
        k.pos(i * BIOME_W - 1, 0),
        k.color(...SKY_COLORS[i]),
        k.z(LAYERS.BG_FAR - 1),
      ]);
    });

    // ---- Backgrounds (painted). Draw the bg twice per zone with 50% overlap
    //      offset so any single tile with transparent edges is covered by the
    //      neighbor. Cheap fix for the zone-5 whitespace problem across the
    //      whole trail.
    ZONES.forEach((z, i) => {
      k.add([
        k.sprite(z.bg, { width: BIOME_W, height: 540 }),
        k.pos(i * BIOME_W, 0),
        k.z(LAYERS.BG_FAR),
      ]);
    });

    // ---- Ground ----
    const Z0_GAP_X0 = 640;
    const Z0_GAP_X1 = 686;
    addGround(k, 0, Z0_GAP_X0, GROUND_Y, ZONES[0].ground, ZONES[0].soil);
    addGround(k, Z0_GAP_X1, BIOME_W, GROUND_Y, ZONES[0].ground, ZONES[0].soil);

    const Z1_GAP_X0 = BIOME_W + 720;
    const Z1_GAP_X1 = BIOME_W + 780;
    addGround(k, BIOME_W, Z1_GAP_X0, GROUND_Y, ZONES[1].ground, ZONES[1].soil);
    addGround(k, Z1_GAP_X1, BIOME_W * 2, GROUND_Y, ZONES[1].ground, ZONES[1].soil);

    const RIVER_BASE = BIOME_W * 2;
    const RIVER_GAP_X0 = RIVER_BASE + 320;
    const RIVER_GAP_X1 = RIVER_BASE + 800;
    addGround(k, RIVER_BASE, RIVER_GAP_X0, GROUND_Y, ZONES[2].ground, ZONES[2].soil);
    addGround(k, RIVER_GAP_X1, BIOME_W * 3, GROUND_Y, ZONES[2].ground, ZONES[2].soil);

    addGround(k, BIOME_W * 3, BIOME_W * 4, GROUND_Y, ZONES[3].ground, ZONES[3].soil);
    addGround(k, BIOME_W * 4, BIOME_W * 5, GROUND_Y, ZONES[4].ground, ZONES[4].soil);
    addGround(k, BIOME_W * 5, BIOME_W * 6, GROUND_Y, ZONES[5].ground, ZONES[5].soil);
    addGround(k, BIOME_W * 6, BIOME_W * 7, GROUND_Y, ZONES[6].ground, ZONES[6].soil);
    addGround(k, BIOME_W * 7, LEVEL_END, GROUND_Y, ZONES[7].ground, ZONES[7].soil);

    // Invisible level walls
    k.add([
      k.rect(20, 800), k.pos(-20, 0), k.area(),
      k.body({ isStatic: true }), k.opacity(0), k.z(LAYERS.BOUND),
    ]);
    k.add([
      k.rect(20, 800), k.pos(LEVEL_END, 0), k.area(),
      k.body({ isStatic: true }), k.opacity(0), k.z(LAYERS.BOUND),
    ]);

    // Water kill plane inside river gap.
    k.add([
      k.rect(RIVER_GAP_X1 - RIVER_GAP_X0, 40),
      k.pos(RIVER_GAP_X0, GROUND_Y + 40),
      k.area(), k.opacity(0), "water",
    ]);

    // ============ Zone objective + door system ============
    type ZoneObjective = {
      hudLabel: () => string;
      met: () => boolean;
    };
    const zoneObjectives: (ZoneObjective | null)[] = new Array(ZONES.length).fill(null);
    const zoneState = {
      methodTouched: false,
      userGot: false,
      passGot: false,
      docsInZone: 0,
      repliesGot: 0,
      repliesNeeded: 0,
      waitStart: 0,
      waitDur: 30,
      planPicked: false,
      hasKey: false,
      firePoleAttached: false,
      firePoleDone: false,
      idCardCollected: false,
    };


    type Door = { obj: AnyObj; barrier: AnyObj | null; unlocked: boolean; playedAnim: boolean };
    const doors: (Door | null)[] = new Array(ZONES.length).fill(null);

    function spawnDoor(zoneIdx: number): Door {
      const dx = (zoneIdx + 1) * BIOME_W - 60;
      const disp = displaySize("door-closed", sizes);
      const doorObj = k.add([
        k.sprite("door-closed", { width: disp.w, height: DISPLAY_H["door-closed"] }),
        k.pos(dx, GROUND_Y),
        k.anchor("bot"),
        k.area({ shape: new k.Rect(k.vec2(-disp.w / 2, -DISPLAY_H["door-closed"]), disp.w, DISPLAY_H["door-closed"]) }),
        k.z(LAYERS.PROP + 2),
        "door",
        { zoneIdx, unlocked: false },
      ]) as AnyObj;
      // Solid barrier centered on door — blocks passage while locked. Kaplay's
      // default k.area() shape is anchored top-left of the rect regardless of
      // k.anchor(...), so we place the rect at top-left explicitly and give
      // it an explicit shape to be safe. Height 560 keeps its top above the
      // player's peak jump (GROUND_Y - 144).
      const BAR_W = 14, BAR_H = 560;
      const bar = k.add([
        k.rect(BAR_W, BAR_H),
        k.pos(dx - BAR_W / 2, GROUND_Y - BAR_H),
        k.color(60, 40, 20),
        k.opacity(0),
        k.area({ shape: new k.Rect(k.vec2(0, 0), BAR_W, BAR_H) }),
        k.body({ isStatic: true }),
        k.z(LAYERS.PROP),
      ]);


      return { obj: doorObj, barrier: bar, unlocked: false, playedAnim: false };
    }

    function unlockDoor(zoneIdx: number) {
      const d = doors[zoneIdx];
      if (!d || d.unlocked) return;
      d.unlocked = true;
      // Unlock animation: brief shake, chime, then swap sprite + drop barrier.
      d.obj.use(k.color(255, 240, 120));
      k.wait(0.25, () => d.obj.use(k.color(255, 255, 255)));
      k.wait(0.5, () => {
        const disp = displaySize("door-open", sizes);
        d.obj.use(k.sprite("door-open", { width: disp.w, height: DISPLAY_H["door-open"] }));
        d.barrier?.destroy();
        d.barrier = null;
        // Sparkle burst above door
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const sp = k.add([
            k.rect(4, 4),
            k.pos(d.obj.pos.x, d.obj.pos.y - DISPLAY_H["door-open"] / 2),
            k.color(255, 230, 100),
            k.anchor("center"),
            k.z(LAYERS.EFFECT),
            k.opacity(1),
            { vx: Math.cos(angle) * 90, vy: Math.sin(angle) * 90, life: 0 },
          ]);
          sp.onUpdate(() => {
            sp.pos.x += sp.vx * k.dt();
            sp.pos.y += sp.vy * k.dt();
            sp.life += k.dt();
            sp.opacity = Math.max(0, 1 - sp.life * 1.5);
            if (sp.life > 0.8) sp.destroy();
          });
        }
      });
    }

    // Spawn doors for zones 0..6 (zone 7 = finale, uses fire pole instead).
    for (let i = 0; i < 7; i++) doors[i] = spawnDoor(i);

    // ================= ZONE 0: Finding the Trail — pick an apply method =================
    const applyMethods: { x: number; icon: string; label: string }[] = [
      { x: 220, icon: "MAIL",      label: "Apply by Mail" },
      { x: 460, icon: "PHONE",     label: "Apply by Phone" },
      { x: 720, icon: "IN PERSON", label: "Apply In Person" },
      { x: 980, icon: "ONLINE",    label: "Apply Online" },
    ];
    for (const m of applyMethods) {
      const post = spawnGrounded(k, "signpost", sizes, {
        x: m.x,
        z: LAYERS.PROP,
        tag: "method",
        hitboxScale: { x: -DISPLAY_H["signpost"] / 2, w: DISPLAY_H["signpost"], h: DISPLAY_H["signpost"] + 16 },
      });
      void post;
      const topY = GROUND_Y - DISPLAY_H["signpost"] - 6;
      addSignPlaque(k, m.x, topY, m.label, m.icon);
    }
    addSignPlaque(k, 1080, GROUND_Y - DISPLAY_H["signpost"] - 30, "Reach the door →", "!");
    zoneObjectives[0] = {
      hudLabel: () => `METHOD ${zoneState.methodTouched ? "✓" : "☐"}`,
      met: () => zoneState.methodTouched,
    };

    // ================= ZONE 1: Setting Up Camp — create account =================
    const sx0 = BIOME_W;
    const laptopSpots = [sx0 + 180, sx0 + 380, sx0 + 560];
    for (const lx of laptopSpots) {
      spawnDecor(k, "laptop", sizes, { x: lx, z: LAYERS.PROP });
    }
    addSpeech(k, sx0 + 380, GROUND_Y - DISPLAY_H["laptop"] - 30, "Create an account", [40, 60, 120]);
    // Username collectible — floats above ground
    {
      const ux = sx0 + 300;
      const uy = GROUND_Y - 120;
      const disp = displaySize("username", sizes);
      const item = k.add([
        k.sprite("username", { width: disp.w, height: DISPLAY_H["username"] }),
        k.pos(ux, uy),
        k.anchor("center"),
        k.area({ shape: new k.Rect(k.vec2(-disp.w / 2, -DISPLAY_H["username"] / 2), disp.w, DISPLAY_H["username"]) }),
        k.z(LAYERS.PROP),
        "credential",
        { credKind: "user", basY: uy, phase: 0 },
      ]) as AnyObj;
      item.onUpdate(() => { item.pos.y = item.basY + Math.sin(k.time() * 2) * 5; });
      addSpeech(k, ux, uy - 32, "USERNAME", [30, 60, 130]);
    }
    // Password collectible + patrolling padlock
    {
      const px = sx0 + 620;
      const py = GROUND_Y - 90;
      const disp = displaySize("password", sizes);
      const item = k.add([
        k.sprite("password", { width: disp.w, height: DISPLAY_H["password"] }),
        k.pos(px, py),
        k.anchor("center"),
        k.area({ shape: new k.Rect(k.vec2(-disp.w / 2, -DISPLAY_H["password"] / 2), disp.w, DISPLAY_H["password"]) }),
        k.z(LAYERS.PROP),
        "credential",
        { credKind: "pass", basY: py, phase: 1 },
      ]) as AnyObj;
      item.onUpdate(() => { item.pos.y = item.basY + Math.sin(k.time() * 2 + 1) * 5; });
      addSpeech(k, px, py - 32, "PASSWORD", [30, 60, 130]);
    }
    // Password padlock enemy patrol
    {
      const px = sx0 + 900;
      const ph = DISPLAY_H["padlock"];
      const pw = displaySize("padlock", sizes).w;
      const speed = 40;
      const m = spawnGrounded(k, "padlock", sizes, {
        x: px, z: LAYERS.ACTOR, tag: "monster",
        props: { dir: 1, home: px, range: 60 },
        hitboxScale: { x: -pw / 2, w: pw, h: ph },
      });
      m.onUpdate(() => {
        m.pos.x += m.dir * speed * k.dt();
        m.pos.y = GROUND_Y;
        if (m.pos.x > m.home + m.range) { m.pos.x = m.home + m.range; m.dir = -1; }
        if (m.pos.x < m.home - m.range) { m.pos.x = m.home - m.range; m.dir = 1; }
      });
    }
    zoneObjectives[1] = {
      hudLabel: () => `USER ${zoneState.userGot ? "✓" : "☐"}  PASS ${zoneState.passGot ? "✓" : "☐"}`,
      met: () => zoneState.userGot && zoneState.passGot,
    };

    // ================= ZONE 2: Crossing River of Paperwork =================
    const rx0 = RIVER_GAP_X0;
    const rx1 = RIVER_GAP_X1;
    if (active.bridge) {
      k.add([
        k.rect(rx1 - rx0, 14),
        k.pos(rx0, GROUND_Y - 6),
        k.color(140, 90, 50),
        k.outline(2, k.rgb(80, 50, 20)),
        k.area(), k.body({ isStatic: true }),
        k.z(LAYERS.PLATFORM),
        "platform",
        { platformSpeed: k.vec2(0, 0), lastPos: k.vec2(rx0, GROUND_Y - 6) },
      ]);
      const bridgeH = DISPLAY_H["bridge"];
      for (let i = 0; i < 6; i++) {
        spawnDecor(k, "bridge", sizes, { x: rx0 + i * 100 + 50, groundY: GROUND_Y - 6 + bridgeH, z: LAYERS.PLATFORM - 1 });
      }
    } else {
      const platforms = [
        { x: rx0 + 40,  y: GROUND_Y - 34, amp: 12, spd: 1.4 },
        { x: rx0 + 160, y: GROUND_Y - 58, amp: 18, spd: 1.2 },
        { x: rx0 + 280, y: GROUND_Y - 44, amp: 14, spd: 1.6 },
        { x: rx0 + 400, y: GROUND_Y - 34, amp: 12, spd: 1.4 },
      ];
      for (const p of platforms) {
        const plat = k.add([
          k.rect(72, 14), k.pos(p.x, p.y),
          k.color(120, 130, 140), k.outline(2, k.rgb(60, 70, 80)),
          k.area(), k.body({ isStatic: true }),
          k.z(LAYERS.PLATFORM), "platform",
          { basY: p.y, amp: p.amp, spd: p.spd, phase: Math.random() * Math.PI * 2, platformSpeed: k.vec2(0, 0), lastPos: k.vec2(p.x, p.y) },
        ]);
        plat.onUpdate(() => {
          const newY = plat.basY + Math.sin(k.time() * plat.spd + plat.phase) * plat.amp;
          const dt = k.dt();
          if (dt > 0) {
            plat.platformSpeed.x = (plat.pos.x - plat.lastPos.x) / dt;
            plat.platformSpeed.y = (newY - plat.lastPos.y) / dt;
          }
          plat.lastPos.x = plat.pos.x;
          plat.lastPos.y = newY;
          plat.pos.y = newY;
        });
      }
    }
    // Zone 2 unlocks the moment player crosses the river.
    zoneObjectives[2] = {
      hudLabel: () => "CROSS THE RIVER →",
      // Only unlock after the player physically crosses the river and is
      // within reach of the door at (BIOME_W*3 - 60).
      met: () => player.pos.x >= BIOME_W * 3 - 160,
    };


    // ================= ZONE 3: Gathering Documents — 3 verifications =================
    const tx0 = BIOME_W * 3;
    const docs: [number, "id" | "paystub" | "envelope", string][] = [
      [tx0 + 180, "id", "ID"],
      [tx0 + 380, "paystub", "Income"],
      [tx0 + 580, "envelope", "Household"],
    ];
    for (const [x, prop, key] of docs) {
      const dh = DISPLAY_H[prop];
      spawnGrounded(k, prop, sizes, {
        x, z: LAYERS.PROP, tag: "doc",
        props: { docKey: key },
        hitboxScale: { x: -dh / 2, w: dh, h: dh },
      });
    }
    const monsterSpots = [tx0 + 280, tx0 + 780];
    for (const mx of monsterSpots) {
      const speed = active.plain_language ? 24 : 50;
      const mh = DISPLAY_H["form-monster"];
      const mw = displaySize("form-monster", sizes).w;
      const m = spawnGrounded(k, "form-monster", sizes, {
        x: mx, z: LAYERS.ACTOR, tag: "monster",
        props: { dir: 1, home: mx, range: 70 },
        hitboxScale: { x: -mw / 2, w: mw, h: mh },
      });
      m.onUpdate(() => {
        m.pos.x += m.dir * speed * k.dt();
        m.pos.y = GROUND_Y;
        if (m.pos.x > m.home + m.range) { m.pos.x = m.home + m.range; m.dir = -1; m.flipX = true; }
        if (m.pos.x < m.home - m.range) { m.pos.x = m.home - m.range; m.dir = 1; m.flipX = false; }
      });
    }
    zoneObjectives[3] = {
      hudLabel: () => `DOCS ${zoneState.docsInZone}/3`,
      met: () => zoneState.docsInZone >= 3,
    };

    // ================= ZONE 4: Answering the Call — collect all mailboxes =================
    const relayBase = BIOME_W * 4;
    const relaySpots = [relayBase + 180, relayBase + 380, relayBase + 640, relayBase + 900];
    zoneState.repliesNeeded = relaySpots.length;
    for (const rx of relaySpots) {
      const dh = DISPLAY_H["mailbox"];
      spawnGrounded(k, "mailbox", sizes, {
        x: rx, z: LAYERS.PROP, tag: "reply",
        props: { bonus: 400 },
        hitboxScale: { x: -dh / 2, w: dh, h: dh },
      });
    }
    {
      const mx = relayBase + 520;
      const mh = DISPLAY_H["form-monster"];
      const mw = displaySize("form-monster", sizes).w;
      const speed = 40;
      const m = spawnGrounded(k, "form-monster", sizes, {
        x: mx, z: LAYERS.ACTOR, tag: "monster",
        props: { dir: 1, home: mx, range: 70 },
        hitboxScale: { x: -mw / 2, w: mw, h: mh },
      });
      m.onUpdate(() => {
        m.pos.x += m.dir * speed * k.dt();
        m.pos.y = GROUND_Y;
        if (m.pos.x > m.home + m.range) { m.pos.x = m.home + m.range; m.dir = -1; m.flipX = true; }
        if (m.pos.x < m.home - m.range) { m.pos.x = m.home - m.range; m.dir = 1; m.flipX = false; }
      });
    }
    addSpeech(k, relayBase + 100, GROUND_Y - DISPLAY_H["mailbox"] - 40, "Answer every request!", [40, 80, 130]);
    zoneObjectives[4] = {
      hudLabel: () => `REPLIES ${zoneState.repliesGot}/${zoneState.repliesNeeded}`,
      met: () => zoneState.repliesGot >= zoneState.repliesNeeded,
    };

    // ================= ZONE 5: Waiting Mountain — 30-second countdown =================
    const mx0 = BIOME_W * 5;
    // Boulder hazards
    for (let i = 0; i < 3; i++) {
      const bx = mx0 + 300 + i * 300;
      const b = spawnAirborne(k, "boulder", sizes, {
        x: bx, y: -80 - i * 180, z: LAYERS.ACTOR,
        tag: "boulder",
        props: { spd: 180 + i * 20, home: bx },
      });
      b.onUpdate(() => {
        b.pos.y += b.spd * k.dt();
        if (b.pos.y > 700) b.pos = k.vec2(b.home, -180);
      });
    }
    addSpeech(k, mx0 + 500, 90, "Awaiting a decision…", [50, 40, 80]);
    zoneObjectives[5] = {
      hudLabel: () => {
        if (zoneState.waitStart === 0) return "WAIT 0:30";
        const left = Math.max(0, Math.ceil(zoneState.waitDur - (k.time() - zoneState.waitStart)));
        if (left === 0) return "APPROVED! →";
        return `WAIT 0:${String(left).padStart(2, "0")}`;
      },
      met: () => zoneState.waitStart > 0 && k.time() - zoneState.waitStart >= zoneState.waitDur,
    };

    // ================= ZONE 6: Choosing Your Path — pick a plan, get a key =================
    const kx0 = BIOME_W * 6;
    const planDefs: Array<{ x: number; sprite: string; label: string }> = [
      { x: kx0 + 260, sprite: "plan-blue",   label: "Medical Assistance" },
      { x: kx0 + 560, sprite: "plan-green",  label: "MinnesotaCare" },
      { x: kx0 + 860, sprite: "plan-orange", label: "Private Plan" },
    ];
    for (const p of planDefs) {
      const dh = DISPLAY_H[p.sprite];
      const dw = displaySize(p.sprite, sizes).w;
      // Small pedestal
      k.add([
        k.rect(dw + 12, 10),
        k.pos(p.x, GROUND_Y),
        k.anchor("bot"),
        k.color(120, 100, 80),
        k.outline(2, k.rgb(60, 45, 30)),
        k.z(LAYERS.PROP - 1),
      ]);
      const item = k.add([
        k.sprite(p.sprite, { width: dw, height: dh }),
        k.pos(p.x, GROUND_Y - 10),
        k.anchor("bot"),
        k.area({ shape: new k.Rect(k.vec2(-dw / 2, -dh), dw, dh) }),
        k.z(LAYERS.PROP),
        "plan-pick",
        { planLabel: p.label, bonus: 800 },
      ]) as AnyObj;
      void item;
      addSpeech(k, p.x, GROUND_Y - dh - 26, p.label, [30, 30, 60]);
    }
    addSpeech(k, kx0 + 560, GROUND_Y - 220, "Pick ONE plan", [30, 60, 120]);
    zoneObjectives[6] = {
      hudLabel: () => zoneState.hasKey ? "KEY ✓" : (zoneState.planPicked ? "GRAB KEY →" : "PLAN ☐"),
      met: () => zoneState.hasKey,
    };

    // ================= ZONE 7: Coverage Begins — stairs, ID card, fire pole =================
    const cx0 = BIOME_W * 7;
    // Staircase platforms rising
    const stairY0 = GROUND_Y;
    const stepCount = 6;
    for (let i = 0; i < stepCount; i++) {
      const sxi = cx0 + 280 + i * 90;
      const syi = stairY0 - 40 - i * 40;
      k.add([
        k.rect(84, 14), k.pos(sxi, syi),
        k.color(200, 195, 210),
        k.outline(2, k.rgb(90, 90, 110)),
        k.area(), k.body({ isStatic: true }),
        k.z(LAYERS.PLATFORM), "platform",
        { platformSpeed: k.vec2(0, 0), lastPos: k.vec2(sxi, syi) },
      ]);
    }
    // Top landing + medical ID card
    const topLandingX = cx0 + 280 + stepCount * 90 + 20;
    const topLandingY = stairY0 - 40 - stepCount * 40;
    k.add([
      k.rect(160, 14), k.pos(topLandingX, topLandingY),
      k.color(200, 195, 210), k.outline(2, k.rgb(90, 90, 110)),
      k.area(), k.body({ isStatic: true }),
      k.z(LAYERS.PLATFORM), "platform",
      { platformSpeed: k.vec2(0, 0), lastPos: k.vec2(topLandingX, topLandingY) },
    ]);
    {
      const idW = displaySize("medical-id", sizes).w;
      const idH = DISPLAY_H["medical-id"];
      const idX = topLandingX + 40;
      const idY = topLandingY - idH / 2 - 8;
      const idItem = k.add([
        k.sprite("medical-id", { width: idW, height: idH }),
        k.pos(idX, idY),
        k.anchor("center"),
        k.area({ shape: new k.Rect(k.vec2(-idW / 2, -idH / 2), idW, idH) }),
        k.z(LAYERS.PROP),
        "id-card",
        { basY: idY },
      ]) as AnyObj;
      idItem.onUpdate(() => { idItem.pos.y = idItem.basY + Math.sin(k.time() * 2.5) * 4; });
      addSpeech(k, idX, idY - idH / 2 - 14, "MEDICAL ID", [200, 40, 60]);
      addSpeech(k, topLandingX + 40, topLandingY - 42, "GRAB THE ID →", [220, 30, 60]);
    }

    // Fire pole — a tall vertical bar just past the top landing
    const poleX = topLandingX + 130;
    const poleTop = topLandingY - 40;
    const poleBaseY = GROUND_Y - 4;
    k.add([
      k.rect(6, poleBaseY - poleTop),
      k.pos(poleX, poleTop),
      k.color(220, 180, 60),
      k.outline(2, k.rgb(140, 100, 30)),
      k.z(LAYERS.PROP + 1),
    ]);
    k.add([ // pole cap
      k.circle(10),
      k.pos(poleX, poleTop),
      k.color(255, 215, 80),
      k.outline(2, k.rgb(140, 100, 30)),
      k.z(LAYERS.PROP + 2),
    ]);
    // Trigger areas for fire pole (attach) and finish base (base of pole).
    k.add([
      k.rect(24, poleBaseY - poleTop),
      k.pos(poleX - 12, poleTop),
      k.area(), k.opacity(0),
      "fire-pole",
      { poleX, poleTop, poleBaseY },
    ]);
    k.add([
      k.rect(60, 30),
      k.pos(poleX - 30, poleBaseY - 10),
      k.area(), k.opacity(0),
      "pole-base",
    ]);
    // "COVERED" celebration sign at right edge
    addSpeech(k, LEVEL_END - 100, GROUND_Y - 200, "★ COVERED! ★", [220, 30, 60]);
    zoneObjectives[7] = {
      hudLabel: () =>
        zoneState.firePoleDone
          ? "COVERED!"
          : zoneState.idCardCollected
            ? "SLIDE DOWN →"
            : "ID CARD ☐",
      met: () => zoneState.firePoleDone,
    };


    // Save-point campfire near town start (existing improvement).
    const checkpointX = spawnX > 1000 ? spawnX : 40;
    if (active.save_progress) {
      const fx = BIOME_W * 3 + 40;
      const ch = DISPLAY_H["campfire"];
      spawnGrounded(k, "campfire", sizes, {
        x: fx, z: LAYERS.PROP, tag: "checkpoint",
        props: { atX: fx },
        hitboxScale: { x: -ch / 2, w: ch, h: ch },
      });
    }
    if (active.documents_earlier) {
      spawnDecor(k, "backpack", sizes, { x: 80, z: LAYERS.PROP });
    }




    // ================= Player =================
    const player = k.add([
      k.sprite("hero-idle", { width: displaySize("hero-idle", sizes).w, height: DISPLAY_H["hero-idle"] }),
      k.pos(spawnX, GROUND_Y - 20),
      k.area({ shape: new k.Rect(k.vec2(PLAYER_HITBOX.x, PLAYER_HITBOX.y), PLAYER_HITBOX.w, PLAYER_HITBOX.h) }),
      k.body(),
      k.anchor("bot"),
      k.z(LAYERS.PLAYER),
      "player",
      {
        docs: new Set<string>(),
        checkpointX,
        won: false,
        dead: false,
        lives: 3 + Math.max(0, lives - 1),
        maxLives: 3 + Math.max(0, lives - 1),
        facing: 1 as 1 | -1,
        invulnUntil: 0,
        lastGroundedAt: k.time(),
        jumpBufferedAt: -1,
        farthestZone: Math.min(ZONES.length - 1, Math.max(0, Math.floor(spawnX / BIOME_W))),
        rightmostX: spawnX,
        wasGrounded: true,
        wasOnPlatform: false,
        score: 0,
        jumpsLanded: 0,
        enemiesPassed: 0,
        deaths: 0,
        distancePx: 0,
        prevFeetY: GROUND_Y,
        passedMonsters: new Set<unknown>(),
        visitedZones: new Set<number>([Math.min(ZONES.length - 1, Math.max(0, Math.floor(spawnX / BIOME_W)))]),
        riding: null as null | { pos: { x: number; y: number }; platformSpeed: { x: number; y: number }; width: number; height: number },
        animState: "idle" as "idle" | "walk" | "jump",
        animTick: 0,
        walkFrame: 0,
      },
    ]);
    // Debug hook so QA/Playwright can inspect live game state.
    if (typeof window !== "undefined") {
      (window as unknown as { __gameDebug?: unknown }).__gameDebug = {
        player, doors, zoneState, zoneObjectives,
        BIOME_W, GROUND_Y, ZONES_LEN: ZONES.length,
      };
    }


    // Manual animation: swap sprite per state. All hero frames share size
    // (grouped in the trim step), so swapping never causes horizontal jitter.
    function setSprite(name: string) {
      const ds = displaySize(name, sizes);
      player.use(k.sprite(name, { width: ds.w, height: DISPLAY_H[name] }));
    }
    function setAnim(next: "idle" | "walk" | "jump") {
      if (player.animState === next) return;
      player.animState = next;
      player.animTick = 0;
      player.walkFrame = 0;
      if (next === "idle") setSprite("hero-idle");
      else if (next === "jump") setSprite("hero-jump");
      else setSprite("hero-walk-0");
    }

    type PlatformRide = {
      pos: { x: number; y: number };
      platformSpeed: { x: number; y: number };
      width: number;
      height: number;
    };

    function asPlatformRide(p: unknown): PlatformRide | null {
      const c = p as Partial<PlatformRide>;
      if (!c.pos || typeof c.pos.x !== "number" || typeof c.pos.y !== "number") return null;
      const width = typeof c.width === "number" ? c.width : 0;
      const height = typeof c.height === "number" ? c.height : 0;
      if (width <= 0 || height <= 0) return null;
      return {
        pos: c.pos,
        platformSpeed: c.platformSpeed ?? k.vec2(0, 0),
        width,
        height,
      };
    }

    function snapToPlatform(plat: PlatformRide) {
      player.riding = plat;
      player.pos.y = plat.pos.y; // anchor("bot") + trimmed sprite = feet flush
      if (player.vel.y > 0) player.vel.y = 0;
      player.lastGroundedAt = k.time();
    }

    function findTopPlatformContact(): PlatformRide | null {
      const feetY = player.pos.y;
      const prevFeetY = player.prevFeetY;
      const platforms = k.get("platform");
      for (const raw of platforms) {
        const plat = asPlatformRide(raw);
        if (!plat) continue;
        const left = plat.pos.x - PLATFORM_EDGE_TOLERANCE;
        const right = plat.pos.x + plat.width + PLATFORM_EDGE_TOLERANCE;
        const top = plat.pos.y;
        const withinX = player.pos.x >= left && player.pos.x <= right;
        const fallingThroughTop =
          player.vel.y >= -80 &&
          prevFeetY <= top + PLATFORM_SNAP_TOLERANCE &&
          feetY >= top - PLATFORM_SNAP_TOLERANCE &&
          feetY <= top + PLATFORM_SNAP_TOLERANCE * 1.4;
        const alreadyStanding = Math.abs(feetY - top) <= 10 && player.vel.y >= -80;
        if (withinX && (fallingThroughTop || alreadyStanding)) return plat;
      }
      return null;
    }

    player.onCollide("platform", (p, col) => {
      const plat = asPlatformRide(p);
      if (!plat) return;
      const feetY = player.pos.y;
      const nearTop = feetY >= plat.pos.y - PLATFORM_SNAP_TOLERANCE && feetY <= plat.pos.y + PLATFORM_SNAP_TOLERANCE;
      if (nearTop || col?.isBottom()) snapToPlatform(plat);
    });

    // ================= Ranger helper =================
    if (active.helper) {
      const ranger = spawnGrounded(k, "ranger", sizes, {
        x: spawnX + 60,
        z: LAYERS.ACTOR,
      });
      const bubble = k.add([
        k.text("Follow me!", { size: 12, font: "sans-serif" }),
        k.pos(0, 0),
        k.color(30, 30, 30),
        k.z(LAYERS.EFFECT),
        k.anchor("center"),
      ]);
      ranger.onUpdate(() => {
        const target = Math.min(player.pos.x + 90, LEVEL_END - 100);
        const dx = target - ranger.pos.x;
        ranger.pos.x += Math.sign(dx) * Math.min(Math.abs(dx), 3);
        ranger.pos.y = GROUND_Y;
        bubble.pos = k.vec2(ranger.pos.x, ranger.pos.y - DISPLAY_H["ranger"] - 12);
      });
    }

    // ================= HUD =================
    k.add([
      k.text(opts.mode === "after" ? "AFTER FEEDBACK" : "BEFORE FEEDBACK", { size: 14, font: "sans-serif" }),
      k.pos(12, 12),
      k.color(opts.mode === "after" ? k.rgb(30, 160, 60) : k.rgb(220, 60, 60)),
      k.fixed(),
      k.z(LAYERS.HUD),
    ]);
    // Score row (above the applications-as-lives row).
    const scoreHud = k.add([
      k.text("SCORE 0", { size: 16, font: "sans-serif" }),
      k.pos(12, 34),
      k.color(255, 235, 120),
      k.fixed(),
      k.z(LAYERS.HUD),
    ]);
    // Applications row: little application icons that represent lives.
    // Each icon is a paper card with three horizontal "form field" lines.
    const APP_ICON_W = 18;
    const APP_ICON_H = 22;
    const appIcons: AnyObj[] = [];
    for (let i = 0; i < player.maxLives; i++) {
      const bx = 12 + i * (APP_ICON_W + 6);
      const by = 58;
      const card = k.add([
        k.rect(APP_ICON_W, APP_ICON_H),
        k.pos(bx, by),
        k.color(250, 245, 220),
        k.outline(2, k.rgb(40, 40, 60)),
        k.fixed(),
        k.z(LAYERS.HUD),
      ]);
      const line1 = k.add([
        k.rect(APP_ICON_W - 8, 2),
        k.pos(bx + 4, by + 5),
        k.color(80, 80, 120),
        k.fixed(),
        k.z(LAYERS.HUD + 1),
      ]);
      const line2 = k.add([
        k.rect(APP_ICON_W - 8, 2),
        k.pos(bx + 4, by + 10),
        k.color(80, 80, 120),
        k.fixed(),
        k.z(LAYERS.HUD + 1),
      ]);
      const line3 = k.add([
        k.rect(APP_ICON_W - 8, 2),
        k.pos(bx + 4, by + 15),
        k.color(80, 80, 120),
        k.fixed(),
        k.z(LAYERS.HUD + 1),
      ]);
      appIcons.push({ card, line1, line2, line3 });
    }
    const docsHud = k.add([
      k.text("", { size: 14, font: "sans-serif" }),
      k.pos(k.width() - 12, 12),
      k.anchor("topright"),
      k.color(255, 255, 255),
      k.fixed(),
      k.z(LAYERS.HUD),
    ]);
    // Per-zone objective badge, top-right under the "AFTER FEEDBACK" chip.
    const objectiveHud = k.add([
      k.text("", { size: 14, font: "sans-serif" }),
      k.pos(k.width() - 12, 34),
      k.anchor("topright"),
      k.color(255, 220, 90),
      k.fixed(),
      k.z(LAYERS.HUD),
    ]);
    // Hint bubble that pops up when player bumps a locked door.
    let hintUntil = 0;
    const hintHud = k.add([
      k.text("", { size: 14, font: "sans-serif", width: 460, align: "center" }),
      k.pos(k.width() / 2, k.height() - 60),
      k.anchor("center"),
      k.color(255, 255, 255),
      k.opacity(0),
      k.fixed(),
      k.z(LAYERS.HUD + 1),
    ]);
    function showHint(msg: string) {
      hintHud.text = msg;
      hintHud.opacity = 1;
      hintUntil = k.time() + 1.8;
    }
    function updateHud() {
      scoreHud.text = `SCORE ${Math.max(0, Math.round(player.score))}`;
      appIcons.forEach((g, i) => {
        const active = i < player.lives;
        const op = active ? 1 : 0.18;
        g.card.opacity = op;
        g.line1.opacity = op;
        g.line2.opacity = op;
        g.line3.opacity = op;
      });
      const need = ["ID", "Income", "Household"].filter((d) => !player.docs.has(d));
      docsHud.text = active.documents_earlier || player.docs.size > 0
        ? need.length ? `Application docs needed: ${need.join(", ")}` : "Application docs: complete ✓"
        : "";
      const z = player.farthestZone;
      const obj = zoneObjectives[z];
      objectiveHud.text = obj ? obj.hudLabel() : "";
    }
    updateHud();

    // ================= Asset debug overlay =================
    // Toggle with the "D" key or by loading the page with ?debug=assets.
    // Shows every asset the current zone depends on, its sheet coordinates,
    // trimmed bounding box, unified sprite size, and load status.
    const debugQuery =
      typeof window !== "undefined" &&
      /(?:^|[?&])debug=assets(?:&|$)/.test(window.location.search);
    let debugVisible = debugQuery;
    const debugPanel = k.add([
      k.rect(360, 260, { radius: 4 }),
      k.pos(k.width() - 8, 8),
      k.anchor("topright"),
      k.color(0, 0, 0),
      k.opacity(0.78),
      k.fixed(),
      k.z(LAYERS.HUD + 5),
    ]) as AnyObj;
    const debugTitle = k.add([
      k.text("ASSETS · press D", { size: 11, font: "sans-serif" }),
      k.pos(k.width() - 16, 14),
      k.anchor("topright"),
      k.color(255, 220, 90),
      k.fixed(),
      k.z(LAYERS.HUD + 6),
    ]) as AnyObj;
    const debugSummary = k.add([
      k.text("", { size: 10, font: "sans-serif", width: 344 }),
      k.pos(k.width() - 16, 30),
      k.anchor("topright"),
      k.color(200, 220, 255),
      k.fixed(),
      k.z(LAYERS.HUD + 6),
    ]) as AnyObj;
    const debugBody = k.add([
      k.text("", { size: 9, font: "sans-serif", width: 344, lineSpacing: 1 }),
      k.pos(k.width() - 16, 60),
      k.anchor("topright"),
      k.color(240, 240, 240),
      k.fixed(),
      k.z(LAYERS.HUD + 6),
    ]) as AnyObj;
    function statusGlyph(s: AssetStatus): string {
      return s === "loaded" ? "OK" : s === "fallback" ? "FB" : "!!";
    }
    function renderDebugOverlay() {
      const show = debugVisible;
      debugPanel.opacity = show ? 0.78 : 0;
      debugTitle.opacity = show ? 1 : 0;
      debugSummary.opacity = show ? 1 : 0;
      debugBody.opacity = show ? 1 : 0;
      if (!show) return;
      const entries = Object.values(ASSET_REPORT.entries);
      const failed = entries.filter((e) => e.status !== "loaded");
      const failedSprite = failed.filter((e) => e.kind === "sprite").length;
      const failedBg = failed.filter((e) => e.kind === "background").length;
      const z = player.farthestZone;
      debugSummary.text =
        `Zone ${z + 1}/${ZONES.length} · ${ZONES[z].key}\n` +
        `Sheets loaded: ${Object.values(ASSET_REPORT.sheets).filter((s) => s.status === "loaded").length}/${Object.keys(ASSET_REPORT.sheets).length}   ` +
        `Missing sprites: ${failedSprite}   Missing bgs: ${failedBg}`;
      const names = ZONE_ASSETS[z] ?? [];
      const lines: string[] = [];
      for (const n of names) {
        const e = ASSET_REPORT.entries[n];
        if (!e) { lines.push(`??  ${n.padEnd(16)}  (not registered)`); continue; }
        if (e.kind === "background") {
          lines.push(`${statusGlyph(e.status)}  ${n.padEnd(16)}  bg  ${e.sheetLabel ?? ""}`);
        } else {
          const r = e.sheetRect;
          const bb = e.trimBBox;
          const u = e.unified;
          const coords = r ? `f${e.frame} @${r.fx},${r.fy} ${r.fw}x${r.fh}` : `f${e.frame ?? "?"}`;
          const trim = bb ? `trim ${bb.w}x${bb.h}` : `trim -`;
          const uni = u ? `disp ${u.w}x${u.h}` : `disp -`;
          lines.push(`${statusGlyph(e.status)}  ${n.padEnd(16)}  ${coords}  ${trim}  ${uni}`);
        }
      }
      // Always append any failed asset from other zones so problems are visible
      // regardless of where the player currently is.
      const globalFails = failed.filter((e) => !names.includes(e.name));
      if (globalFails.length) {
        lines.push("");
        lines.push(`— failed elsewhere (${globalFails.length}) —`);
        for (const e of globalFails.slice(0, 6)) {
          lines.push(`${statusGlyph(e.status)}  ${e.name.padEnd(16)}  ${e.error?.slice(0, 40) ?? ""}`);
        }
      }
      debugBody.text = lines.join("\n");
    }
    // Auto-size panel roughly to content height.
    k.onUpdate(() => {
      if (!debugVisible) { debugPanel.height = 26; return; }
      const lineCount = ((debugBody as AnyObj).text ?? "").split("\n").length;
      debugPanel.height = Math.min(520, 60 + lineCount * 12 + 8);
      renderDebugOverlay();
    });
    for (const key of ["d", "D"]) {
      k.onKeyPress(key as never, () => {
        debugVisible = !debugVisible;
        renderDebugOverlay();
      });
    }
    renderDebugOverlay();



    // ================= Collisions =================
    player.onCollide("method", () => {
      if (zoneState.methodTouched) return;
      zoneState.methodTouched = true;
      player.score += 400;
    });

    player.onCollide("credential", (c) => {
      const cr = c as unknown as { credKind: "user" | "pass"; destroy: () => void };
      if (cr.credKind === "user") zoneState.userGot = true;
      else zoneState.passGot = true;
      player.score += 600;
      cr.destroy();
    });

    player.onCollide("doc", (d) => {
      const doc = d as unknown as { docKey: string; destroy: () => void };
      if (!player.docs.has(doc.docKey)) zoneState.docsInZone += 1;
      player.docs.add(doc.docKey);
      player.score += 750;
      doc.destroy();
    });

    player.onCollide("reply", (r) => {
      const item = r as unknown as { bonus: number; destroy: () => void };
      player.score += item.bonus ?? 300;
      zoneState.repliesGot += 1;
      item.destroy();
    });

    // Old free-plan collectible (unused now — kept for compatibility).
    player.onCollide("plan", (p) => {
      const item = p as unknown as { bonus: number; destroy: () => void };
      player.score += item.bonus ?? 500;
      item.destroy();
    });

    // New: plan pedestal pick. First selection spawns the gold key.
    player.onCollide("plan-pick", (p) => {
      if (zoneState.planPicked) return;
      const item = p as unknown as { planLabel: string; bonus: number; destroy: () => void; pos: { x: number; y: number } };
      zoneState.planPicked = true;
      player.score += item.bonus ?? 800;
      const kx = item.pos.x;
      const ky = item.pos.y - 40;
      // Remove the other unpicked pedestal cards
      k.get("plan-pick").forEach((o) => (o as { destroy: () => void }).destroy());
      // Spawn floating gold key that homes toward the player
      const kw = displaySize("gold-key", sizes).w;
      const kh = DISPLAY_H["gold-key"];
      const keyItem = k.add([
        k.sprite("gold-key", { width: kw, height: kh }),
        k.pos(kx, ky),
        k.anchor("center"),
        k.area({ shape: new k.Rect(k.vec2(-kw / 2, -kh / 2), kw, kh) }),
        k.z(LAYERS.EFFECT),
        "gold-key",
      ]);
      keyItem.onUpdate(() => {
        const dx = player.pos.x - keyItem.pos.x;
        const dy = (player.pos.y - kh) - keyItem.pos.y;
        keyItem.pos.x += dx * 2 * k.dt();
        keyItem.pos.y += dy * 2 * k.dt();
      });
      showHint(`Picked ${item.planLabel} — grab the key!`);
    });

    player.onCollide("gold-key", (kk) => {
      if (zoneState.hasKey) return;
      zoneState.hasKey = true;
      player.score += 500;
      (kk as unknown as { destroy: () => void }).destroy();
      showHint("You got the key! Head to the door.");
    });

    // Medical ID card pickup — required before the fire pole will activate.
    player.onCollide("id-card", (c) => {
      if (zoneState.idCardCollected) return;
      const card = c as unknown as { destroy: () => void; pos: { x: number; y: number } };
      zoneState.idCardCollected = true;
      player.score += 1500;
      // Sparkle burst
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const sp = k.add([
          k.rect(4, 4),
          k.pos(card.pos.x, card.pos.y),
          k.color(255, 230, 120),
          k.anchor("center"),
          k.z(LAYERS.EFFECT),
          k.opacity(1),
          { vx: Math.cos(angle) * 120, vy: Math.sin(angle) * 120, life: 0 },
        ]);
        sp.onUpdate(() => {
          sp.pos.x += sp.vx * k.dt();
          sp.pos.y += sp.vy * k.dt();
          sp.life += k.dt();
          sp.opacity = Math.max(0, 1 - sp.life * 1.5);
          if (sp.life > 0.8) sp.destroy();
        });
      }
      card.destroy();
      showHint("You got your Medical ID — slide down the pole!");
    });

    // Fire pole attach — locks the player to the pole and starts a slide down.
    // Gated on picking up the Medical ID card first.
    player.onCollide("fire-pole", (fp) => {
      if (zoneState.firePoleAttached || zoneState.firePoleDone) return;
      if (!zoneState.idCardCollected) {
        showHint("Grab the Medical ID card first!");
        return;
      }
      const pole = fp as unknown as { poleX: number; poleTop: number; poleBaseY: number };
      zoneState.firePoleAttached = true;
      player.pos.x = pole.poleX;
      player.vel = k.vec2(0, 0);
      showHint("Sliding down…");
    });


    player.onCollide("pole-base", () => {
      if (zoneState.firePoleDone || player.won) return;
      if (!zoneState.firePoleAttached) return;
      zoneState.firePoleDone = true;
      // Fireworks
      startFireworks(k, player.pos.x + 100, GROUND_Y - 240);
    });

    // Door collision — unlocked door lets player pass; locked door bumps them back
    // and shows a zone-specific hint.
    player.onCollide("door", (d) => {
      const door = d as unknown as { zoneIdx: number; unlocked: boolean };
      if (door.unlocked) return;
      const hints: Record<number, string> = {
        0: "Touch an application-method signpost to unlock this door.",
        1: "You need a USERNAME and PASSWORD to log in.",
        2: "Cross the river of paperwork to reach the door.",
        3: `Collect 3 verification documents (${zoneState.docsInZone}/3).`,
        4: `Answer every request for info (${zoneState.repliesGot}/${zoneState.repliesNeeded}).`,
        5: "Wait for your decision — the door will unlock in time.",
        6: "Choose a health plan and grab the key.",
      };
      showHint(hints[door.zoneIdx] ?? "The door is locked.");
    });

    player.onCollide("checkpoint", (c) => {
      const ch = c as unknown as { atX: number };
      player.checkpointX = ch.atX;
    });

    player.onCollide("monster", () => loseLife("monster"));
    player.onCollide("boulder", () => loseLife("boulder"));
    player.onCollide("water", () => loseLife("water"));


    function loseLife(cause: FailCause) {
      if (player.dead || player.won) return;
      if (k.time() < player.invulnUntil) return;
      player.invulnUntil = k.time() + INVULN_S;
      player.lives -= 1;
      player.deaths += 1;
      if (player.lives <= 0) {
        player.dead = true;
        showEnd(false, cause);
        return;
      }
      // Resume at the entry of the zone the player already reached — never
      // start the whole trail over. Save-point campfire still wins if active.
      const zoneEntryX = Math.max(40, player.farthestZone * BIOME_W + 40);
      const rx = active.save_progress ? player.checkpointX : zoneEntryX;
      player.pos = k.vec2(rx, GROUND_Y - 40);
      player.vel = k.vec2(0, 0);
      player.riding = null;
      updateHud();
    }

    function buildResult(won: boolean): WinResult {
      const durationMs = Math.round((k.time() - startTime) * 1000);
      let finalScore = player.score;
      if (won) {
        finalScore += 2000;
        finalScore += player.lives * 500;
        finalScore += Math.max(0, 4000 - Math.floor(durationMs / 100));
      }
      return {
        durationMs,
        docs: player.docs.size,
        lives: player.lives,
        mode: opts.mode,
        farthestZone: player.farthestZone,
        won,
        score: Math.max(0, Math.round(finalScore)),
        distancePx: Math.round(player.distancePx),
        jumpsLanded: player.jumpsLanded,
        enemiesPassed: player.enemiesPassed,
        deaths: player.deaths,
      };
    }

    // (Old fixed-finish collision removed — the clinic zone now ends at the
    //  fire-pole base which sets zoneState.firePoleDone in the update loop.)

    function tryWin() {
      if (player.won || player.dead) return;
      player.won = true;
      opts.onWin?.(buildResult(true));
      showTitleCard(k, "STEP 8 · ENROLLED", "★ COVERED ★", [255, 220, 90], 2.4);
      showEnd(true);
    }


    function showEnd(win: boolean, cause?: FailCause) {
      const zone = player.farthestZone;
      const title = win
        ? "★ ENROLLED IN COVERAGE ★"
        : (OVERLAY_TITLES[zone] ?? OVERLAY_TITLES[0]);
      const body = win
        ? "You navigated every step and enrolled in Medicaid coverage."
        : `${pickFailureMessage(zone, cause ?? "fell")}\n\nVote on a UX improvement below to make the next attempt easier.`;
      const overlay = k.add([
        k.rect(k.width(), k.height()),
        k.pos(0, 0),
        k.color(0, 0, 0),
        k.opacity(0.72),
        k.area(),
        k.fixed(),
        k.z(LAYERS.OVERLAY),
      ]);
      overlay.onClick(() => k.go("trail", 40, 1));
      k.add([
        k.text(title, { size: 30, font: "sans-serif" }),
        k.pos(k.width() / 2, k.height() / 2 - 78),
        k.anchor("center"),
        k.color(win ? k.rgb(255, 220, 90) : k.rgb(255, 150, 150)),
        k.fixed(),
        k.z(LAYERS.OVERLAY_TEXT),
      ]);
      k.add([
        k.text(body, { size: 16, font: "sans-serif", width: 720, align: "center" }),
        k.pos(k.width() / 2, k.height() / 2),
        k.anchor("center"),
        k.color(240, 240, 240),
        k.fixed(),
        k.z(LAYERS.OVERLAY_TEXT),
      ]);
      k.add([
        k.text("Tap screen or press R to try again", { size: 14, font: "sans-serif" }),
        k.pos(k.width() / 2, k.height() / 2 + 100),
        k.anchor("center"),
        k.color(220, 220, 220),
        k.fixed(),
        k.z(LAYERS.OVERLAY_TEXT),
      ]);
      if (!win) opts.onLose?.(buildResult(false));
    }

    // ================= Controls =================
    const leftKeys = ["left", "a"];
    const rightKeys = ["right", "d"];
    const jumpKeys = ["space", "up", "w"];

    type TouchInput = { left: boolean; right: boolean; jumpReq: boolean; resetReq: boolean };
    const w = typeof window !== "undefined" ? (window as unknown as { __gameInput?: TouchInput }) : undefined;

    let currentZone = Math.min(ZONES.length - 1, Math.max(0, Math.floor(spawnX / BIOME_W)));
    showTitleCard(k, ZONES[currentZone].phase.toUpperCase(), ZONES[currentZone].label.toUpperCase(), [255, 220, 90], 1.8);

    function tryJump() {
      if (player.dead || player.won) return;
      const now = k.time();
      const canCoyote = now - player.lastGroundedAt < COYOTE_S;
      if (player.isGrounded() || player.riding || canCoyote) {
        player.jump(JUMP_VEL);
        player.jumpBufferedAt = -1;
        if (player.riding) {
          player.vel.x += player.riding.platformSpeed.x;
          player.riding = null;
        }
      } else {
        player.jumpBufferedAt = now;
      }
    }

    k.onUpdate(() => {
      if (w?.__gameInput?.resetReq) {
        w.__gameInput.resetReq = false;
        k.go("trail", 40, 1);
        return;
      }
      if (player.dead || player.won) return;

      const now = k.time();

      const z = Math.min(ZONES.length - 1, Math.max(0, Math.floor(player.pos.x / BIOME_W)));
      if (z > player.farthestZone) player.farthestZone = z;
      if (z !== currentZone) {
        currentZone = z;
        if (!player.visitedZones.has(z)) {
          player.visitedZones.add(z);
          player.score += 1000;
        }
        showTitleCard(k, ZONES[z].phase.toUpperCase(), ZONES[z].label.toUpperCase(), [255, 220, 90], 1.4);
        // Start the 30-second wait when the player enters Waiting Mountain.
        if (z === 5 && zoneState.waitStart === 0) zoneState.waitStart = k.time();
      }

      // Check each zone's objective and unlock its door when met.
      for (let i = 0; i < doors.length; i++) {
        const d = doors[i];
        const obj = zoneObjectives[i];
        if (!d || d.unlocked || !obj) continue;
        if (obj.met()) unlockDoor(i);
      }

      // Fire-pole slide: freeze x, descend at controlled speed until base.
      // Safety-net: complete when Y reaches GROUND_Y even if the base
      // collider is missed on a dropped frame.
      if (zoneState.firePoleAttached && !zoneState.firePoleDone) {
        player.vel = k.vec2(0, 0);
        player.pos.y = Math.min(GROUND_Y, player.pos.y + 220 * k.dt());
        if (player.pos.y >= GROUND_Y) {
          zoneState.firePoleDone = true;
          startFireworks(k, player.pos.x + 100, GROUND_Y - 240);
        }
      }


      // Hint fade
      if (hintUntil > 0 && k.time() > hintUntil) {
        hintHud.opacity = Math.max(0, hintHud.opacity - k.dt() * 3);
        if (hintHud.opacity <= 0) hintUntil = 0;
      }

      // Winning: fire pole reached the base.
      if (zoneState.firePoleDone && !player.won) tryWin();


      if (player.pos.x > player.rightmostX) {
        const gained = player.pos.x - player.rightmostX;
        player.rightmostX = player.pos.x;
        player.distancePx += gained;
        player.score += gained * 2;
      }

      const monsters = k.get("monster") as unknown as Array<{ pos: { x: number } }>;
      for (const m of monsters) {
        if (!player.passedMonsters.has(m) && player.pos.x > m.pos.x + 40) {
          player.passedMonsters.add(m);
          player.enemiesPassed += 1;
          player.score += 100;
        }
      }

      let dir = 0;
      for (const key of leftKeys) if (k.isKeyDown(key as never)) dir -= 1;
      for (const key of rightKeys) if (k.isKeyDown(key as never)) dir += 1;
      if (w?.__gameInput?.left) dir -= 1;
      if (w?.__gameInput?.right) dir += 1;
      dir = Math.sign(dir);
      player.move(dir * MOVE_SPEED, 0);
      if (dir > 0) player.score += 1;

      if (player.riding) {
        const dt = k.dt();
        player.pos.x += player.riding.platformSpeed.x * dt;
        player.pos.y = player.riding.pos.y;
        if (player.vel.y > 0) player.vel.y = 0;
      }

      const platformContact = findTopPlatformContact();
      if (platformContact) snapToPlatform(platformContact);

      if (player.riding) {
        const withinX =
          player.pos.x >= player.riding.pos.x - PLATFORM_EDGE_TOLERANCE &&
          player.pos.x <= player.riding.pos.x + player.riding.width + PLATFORM_EDGE_TOLERANCE;
        const nearTop = Math.abs(player.pos.y - player.riding.pos.y) <= PLATFORM_SNAP_TOLERANCE;
        if (!withinX || !nearTop) player.riding = null;
      }

      const groundedNow = player.isGrounded() || !!player.riding;

      if (groundedNow && !player.wasGrounded && player.riding) {
        player.jumpsLanded += 1;
        player.score += 250;
      }
      player.wasGrounded = groundedNow;

      if (groundedNow) player.lastGroundedAt = now;

      // ---- Animation state machine ----
      if (dir !== 0) {
        player.facing = dir as 1 | -1;
        player.flipX = dir < 0;
      }
      if (!groundedNow) {
        setAnim("jump");
      } else if (dir !== 0) {
        setAnim("walk");
        // Distance-based cycle: legs advance in lockstep with real movement.
        // Tighter stride + a subtle squash/stretch per frame makes the run
        // read clearly even when trimmed frames look similar.
        const CYCLE = [0, 1, 2, 3];
        const STRIDE_PX = 9;
        const idx = Math.floor(Math.abs(player.pos.x) / STRIDE_PX) % CYCLE.length;
        const target = CYCLE[idx];
        if (player.walkFrame !== target) {
          player.walkFrame = target;
          setSprite(`hero-walk-${target}`);
        }
      } else {
        setAnim("idle");
      }

      if (w?.__gameInput?.jumpReq) {
        w.__gameInput.jumpReq = false;
        tryJump();
      }
      if (player.jumpBufferedAt > 0 && groundedNow && now - player.jumpBufferedAt < JUMP_BUFFER_S) {
        player.jump(JUMP_VEL);
        player.jumpBufferedAt = -1;
      }

      player.prevFeetY = player.pos.y;

      // Camera follow with integer pixel snap (uses LOGICAL_* so it never
      // drifts when the CSS box or DPR changes).
      const camX = Math.max(LOGICAL_W / 2, Math.min(player.pos.x, LEVEL_END - LOGICAL_W / 2));
      k.setCamPos(px(camX), px(LOGICAL_H / 2));

    });

    for (const key of jumpKeys) k.onKeyPress(key as never, () => tryJump());
    k.onKeyPress("r", () => k.go("trail", 40, 1));

    (player as AnyObj).use(k.opacity(1));
    player.onUpdate(() => {
      if (player.pos.y > 720) loseLife("fell");
      const now = k.time();
      const p = player as AnyObj;
      if (now < player.invulnUntil) {
        const t = player.invulnUntil - now;
        p.opacity = Math.floor(t * 10) % 2 === 0 ? 0.25 : 1;
      } else if (p.opacity !== 1) {
        p.opacity = 1;
      }
      // Belt-and-suspenders: hard-clamp player X so no jump/collision-resolution
      // edge case can smuggle them past a locked door. Applied while the player
      // is still on the "wrong" side of the nearest locked door — anywhere
      // before the door itself or within the door's own zone boundary if they
      // tunneled through in one frame.
      const HITBOX_HALF = 12;
      for (let i = 0; i < doors.length; i++) {
        const d = doors[i];
        if (!d || d.unlocked) continue;
        const dx = (i + 1) * BIOME_W - 60;
        const clampX = dx - 4 - HITBOX_HALF;
        // Only clamp if player has not YET beaten this door's zone (they should
        // still be in zone i or earlier). Never clamp backwards from a later zone.
        if (player.farthestZone <= i && player.pos.x > clampX) {
          player.pos.x = clampX;
          if (p.vel && p.vel.x > 0) p.vel.x = 0;
        }
        break; // nearest locked door only
      }
    });


    k.onUpdate(() => {
      if (!player.dead) updateHud();
    });
  });

  k.go("trail", 40, 1);

  return () => {
    try {
      k.quit();
    } catch {
      // ignore teardown errors
    }
  };
}

// ============================ Helpers ============================

function addGround(
  k: Ctx,
  x1: number,
  x2: number,
  y: number,
  topColor: [number, number, number] = [80, 130, 60],
  soilColor: [number, number, number] = [70, 45, 25],
) {
  if (x2 <= x1) return;
  const w = px(x2 - x1);
  const x = px(x1);
  const yy = px(y);

  // Solid physics soil rect starts at the feet line (y) and runs downward.
  k.add([
    k.rect(w, 80),
    k.pos(x, yy),
    k.color(...soilColor),
    k.area(),
    k.body({ isStatic: true }),
    k.z(LAYERS.GROUND),
  ]);
  // Grass strip drawn ABOVE the feet line so the player visibly stands
  // IN the grass rather than hovering above it. 14px band centered on yy
  // (extends 10px up, 4px down).
  k.add([
    k.rect(w, 14),
    k.pos(x, yy - 10),
    k.color(...topColor),
    k.z(LAYERS.GROUND_TOP),
  ]);
  // Highlight ribbon along the top of the grass band.
  k.add([
    k.rect(w, 2),
    k.pos(x, yy - 10),
    k.color(
      Math.min(255, topColor[0] + 40),
      Math.min(255, topColor[1] + 40),
      Math.min(255, topColor[2] + 40),
    ),
    k.z(LAYERS.GROUND_TOP + 1),
  ]);
}

function showTitleCard(
  k: Ctx,
  small: string,
  big: string,
  rgb: [number, number, number] = [255, 255, 255],
  holdSec: number = 1.6,
) {
  const W = k.width();
  const H = k.height();
  const overlay = k.add([
    k.rect(W, H),
    k.pos(0, 0),
    k.color(0, 0, 0),
    k.opacity(0),
    k.fixed(),
    k.z(150),
  ]);
  const smallTxt = k.add([
    k.text(small, { size: 16, font: "sans-serif" }),
    k.pos(W / 2, H / 2 - 44),
    k.anchor("center"),
    k.color(220, 220, 220),
    k.opacity(0),
    k.fixed(),
    k.z(151),
  ]);
  const bigShadow = k.add([
    k.text(big, { size: 44, font: "sans-serif" }),
    k.pos(W / 2 + 3, H / 2 + 3),
    k.anchor("center"),
    k.color(0, 0, 0),
    k.opacity(0),
    k.fixed(),
    k.z(151),
  ]);
  const bigTxt = k.add([
    k.text(big, { size: 44, font: "sans-serif" }),
    k.pos(W / 2, H / 2),
    k.anchor("center"),
    k.color(...rgb),
    k.opacity(0),
    k.fixed(),
    k.z(152),
  ]);
  const fadeIn = 0.25;
  const fadeOut = 0.4;
  const total = fadeIn + holdSec + fadeOut;
  const t0 = k.time();
  const upd = k.onUpdate(() => {
    const t = k.time() - t0;
    let a = 0;
    let overlayA = 0;
    if (t < fadeIn) {
      a = t / fadeIn;
      overlayA = a * 0.55;
    } else if (t < fadeIn + holdSec) {
      a = 1;
      overlayA = 0.55;
    } else if (t < total) {
      a = 1 - (t - fadeIn - holdSec) / fadeOut;
      overlayA = a * 0.55;
    } else {
      overlay.destroy();
      smallTxt.destroy();
      bigTxt.destroy();
      bigShadow.destroy();
      upd.cancel();
      return;
    }
    overlay.opacity = overlayA;
    smallTxt.opacity = a;
    bigTxt.opacity = a;
    bigShadow.opacity = a * 0.6;
  });
  return total;
}

/** High-contrast wooden trail-sign plaque used for Zone 1 apply methods.
 *  Draws a solid cream card with a dark outline, an icon badge on top, and
 *  the sign label in dark brown so it stays readable over the foggy forest. */
function addSignPlaque(
  k: Ctx,
  x: number,
  topY: number,
  label: string,
  badge: string,
) {
  const w = Math.max(96, label.length * 6 + 20);
  const badgeH = 16;
  const labelH = 18;
  const gap = 2;
  const totalH = badgeH + gap + labelH;
  const cy = topY - totalH / 2;
  // Badge (top)
  k.add([
    k.rect(w, badgeH, { radius: 3 }),
    k.pos(x, cy - totalH / 2 + badgeH / 2),
    k.anchor("center"),
    k.color(40, 55, 90),
    k.outline(2, k.rgb(20, 25, 40)),
    k.z(LAYERS.EFFECT),
  ]);
  k.add([
    k.text(badge, { size: 10, font: "sans-serif" }),
    k.pos(x, cy - totalH / 2 + badgeH / 2 + 1),
    k.anchor("center"),
    k.color(255, 235, 150),
    k.z(LAYERS.EFFECT + 1),
  ]);
  // Label plaque (bottom)
  k.add([
    k.rect(w, labelH, { radius: 3 }),
    k.pos(x, cy + totalH / 2 - labelH / 2),
    k.anchor("center"),
    k.color(250, 240, 210),
    k.outline(2, k.rgb(80, 55, 25)),
    k.z(LAYERS.EFFECT),
  ]);
  k.add([
    k.text(label, { size: 11, font: "sans-serif" }),
    k.pos(x, cy + totalH / 2 - labelH / 2 + 1),
    k.anchor("center"),
    k.color(50, 30, 15),
    k.z(LAYERS.EFFECT + 1),
  ]);
}

function addSpeech(
  k: Ctx,
  x: number,
  y: number,
  text: string,
  rgb: [number, number, number],
) {
  k.add([
    k.text(text, { size: 11, font: "sans-serif", align: "center" }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(...rgb),
    k.z(LAYERS.EFFECT),
  ]);
}

/** Floating pixel-art thought bubble drawn in the sky. Purely decorative —
 *  no collision, no gameplay effect. Uses BG_NEAR layer so it sits between
 *  the biome painting and gameplay elements. */
function spawnThoughtBubble(k: Ctx, x: number, y: number, text: string) {
  const w = Math.max(80, text.length * 6 + 22);
  const h = 24;
  const bg = k.add([
    k.rect(w, h, { radius: 10 }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(255, 255, 255),
    k.outline(2, k.rgb(90, 110, 150)),
    k.opacity(0.9),
    k.z(LAYERS.BG_NEAR + 1),
  ]);
  const tail = k.add([
    k.circle(3),
    k.pos(x - 4, y + h / 2 + 3),
    k.color(255, 255, 255),
    k.outline(2, k.rgb(90, 110, 150)),
    k.opacity(0.9),
    k.z(LAYERS.BG_NEAR + 1),
  ]);
  const t = k.add([
    k.text(text, { size: 10, font: "sans-serif" }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(45, 60, 100),
    k.z(LAYERS.BG_NEAR + 2),
  ]);
  const base = y;
  const phase = Math.random() * Math.PI * 2;
  k.onUpdate(() => {
    const dy = Math.sin(k.time() * 1.3 + phase) * 4;
    bg.pos.y = base + dy;
    t.pos.y = base + dy;
    tail.pos.y = base + dy + h / 2 + 3;
  });
}


/** Repeated multi-color firework bursts around a center point. Purely
 *  decorative — no gameplay effect. */
function startFireworks(k: Ctx, cx: number, cy: number) {
  const COLORS: Array<[number, number, number]> = [
    [255, 90, 90], [255, 200, 80], [90, 220, 255],
    [140, 255, 140], [255, 130, 220], [255, 255, 120],
  ];
  function burst(bx: number, by: number, color: [number, number, number]) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const s = 100 + Math.random() * 80;
      const p = k.add([
        k.rect(4, 4),
        k.pos(bx, by),
        k.color(...color),
        k.anchor("center"),
        k.opacity(1),
        k.z(200),
        { vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0 },
      ]) as AnyObj;
      p.onUpdate(() => {
        p.pos.x += p.vx * k.dt();
        p.pos.y += p.vy * k.dt();
        p.vy += 90 * k.dt();
        p.life += k.dt();
        p.opacity = Math.max(0, 1 - p.life * 0.9);
        if (p.life > 1.2) p.destroy();
      });
    }
  }
  let n = 0;
  const iv = setInterval(() => {
    const bx = cx + (Math.random() - 0.5) * 320;
    const by = cy + (Math.random() - 0.5) * 140;
    burst(bx, by, COLORS[n % COLORS.length]);
    n++;
    if (n > 24) clearInterval(iv);
  }, 220);
  // First burst immediately
  burst(cx, cy, COLORS[0]);
}
