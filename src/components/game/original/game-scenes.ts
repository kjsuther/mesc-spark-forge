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
import type { ImprovementKey } from "./features";
import { FeatureFlags } from "./features";
import {
  PlayerManager,
  PowerUpManager,
  EnemyManager,
  BossManager,
  CheckpointManager,
  activeUpgradeRows,
  POWERUP_DEFS,
  POWERUP_KINDS,
  ZONE_INDEX,
  type PowerUpKind,
  type CheckpointSnapshot,
} from "./managers";
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
import bgThanksUrl from "@/assets/game/bg-thankyou-office.png";
import doorSheetUrl from "@/assets/game/door-sheet.png";
import credentialsSheetUrl from "@/assets/game/credentials-sheet.png";
import goldKeyUrl from "@/assets/game/gold-key.png";
import planCardsSheetUrl from "@/assets/game/plan-cards-sheet.png";
import medicalIdUrl from "@/assets/game/medical-id.png";
import calendarPageUrl from "@/assets/game/calendar-page.png";
import paperAirplaneUrl from "@/assets/game/paper-airplane.png";
import brickBlockSheetUrl from "@/assets/game/brick-block-sheet.png";
import envelopeGremlinSheetUrl from "@/assets/game/envelope-gremlin-sheet.png";
import bossSheetUrl from "@/assets/game/boss-sheet.png";
import doorLockUrl from "@/assets/game/door-lock.png";
import heroPortraitUrl from "@/assets/game/hero-portrait.png";
import heroSittingUrl from "@/assets/game/hero-sitting.png";
import rangerGuideUrl from "@/assets/game/ranger-guide.png";
import mescLogo16Url from "@/assets/game/mesc-2026-logo-16bit.png";
import dhsLogo16Url from "@/assets/game/mn-dhs-logo-16bit.png";

import docIdAsset from "@/assets/game/doc-id.png.asset.json";
import { EXPLORATION_THEMES, ZONE_THEMES, type MusicTheme } from "@/lib/game-music";
import docPaystubAsset from "@/assets/game/doc-paystub.png.asset.json";
import docEnvelopeAsset from "@/assets/game/doc-envelope.png.asset.json";
import formMonsterV2Asset from "@/assets/game/form-monster-v2.png.asset.json";
const docIdUrl = docIdAsset.url;
const docPaystubUrl = docPaystubAsset.url;
const docEnvelopeUrl = docEnvelopeAsset.url;
const formMonsterV2Url = formMonsterV2Asset.url;

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
  /** Stage to resume after the browser has discarded the canvas context. */
  resumeZone?: number;
  /** Reports durable stage progress to the React host. */
  onSafeProgress?: (zone: number) => void;
  onWin?: (result: WinResult) => void;
  onLose?: (result: WinResult) => void;
  /** Lets the scene ask the host for a different music theme. */
  onMusicTheme?: (theme: MusicTheme) => void;
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
// The logical HEIGHT is locked at 540 so ground plane, sprite scale, and every
// vertical layout constant stay byte-identical across devices. The logical
// WIDTH adapts once, at engine start, to the aspect ratio of the CSS box the
// canvas occupies. On a 16:9 desktop it resolves to exactly 960 (no change);
// on a 19.5:9 phone in landscape fullscreen it widens toward 1200 so the
// device fills edge to edge with more trail visible instead of black
// letterbox bars. Gameplay physics are untouched — only how much of the
// horizontally-scrolling world is on screen.
const VIEW_W_MIN = 960;
const VIEW_W_MAX = 1200;
let VIEW_W = LOGICAL_W;
/** Pick the logical width that best matches the canvas's on-screen aspect. */
function computeViewW(canvas: HTMLCanvasElement): number {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || canvas.offsetWidth || LOGICAL_W;
  const h = rect.height || canvas.offsetHeight || LOGICAL_H;
  if (w <= 0 || h <= 0) return LOGICAL_W;
  const target = Math.round((LOGICAL_H * w) / h);
  return Math.max(VIEW_W_MIN, Math.min(VIEW_W_MAX, target));
}
// Constant pixel density of 1 keeps GPU texture memory low on mobile
// (iOS Safari kills the WebGL context around ~64MB of backing store).
// Combined with `imageRendering: pixelated` on the canvas, this is
// visually indistinguishable from 2 for pixel-art content.
/**
 * Backing-buffer density. A logical 960px buffer displayed in a 1400px CSS box
 * used to be upscaled 1.46x with `image-rendering: pixelated`, which is what
 * made every glyph look soft and chunky. Matching the buffer to the box (up to
 * 2x) means text is rasterised at its real on-screen size and stays sharp,
 * while sprites still land on whole pixels. Clamped at 2 so the WebGL backing
 * store stays inside the ~64MB iOS Safari budget.
 */
const PIXEL_DENSITY_MAX = 2;
function computePixelDensity(canvas: HTMLCanvasElement | null, logicalW: number): number {
  const cssW = canvas?.getBoundingClientRect().width || 0;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  if (cssW <= 0) return 1;
  // Exact device-pixel match — no half-step rounding, so glyphs rasterise at
  // their true on-screen size instead of being resampled afterwards.
  const need = (cssW * Math.min(dpr, 2)) / logicalW;
  return Math.max(1, Math.min(PIXEL_DENSITY_MAX, need));
}

/** Snap any world coordinate or computed sprite dimension to an integer.
 *  Using `floor` (not `round`) is deterministic across renders: a value of
 *  N.4999 and N.5001 both collapse to N, so a sub-pixel jitter can never
 *  toggle a sprite between two adjacent integer positions. */
const px = (n: number): number => Math.floor(n);

/** Keeps UI type at a constant physical size when the canvas is drawn
 *  smaller than its logical buffer (windowed, non-fullscreen play). */
let UI_TEXT_SCALE = 1;
function computeUiTextScale(canvas: HTMLCanvasElement | null, logicalW: number): number {
  const cssW = canvas?.getBoundingClientRect().width || 0;
  const shrink = cssW > 0 ? logicalW / cssW : 1;
  const wide = logicalW / LOGICAL_W;
  return Math.max(1, Math.min(2.4, Math.max(wide, shrink)));
}

/**
 * Where a run begins inside a zone.
 *
 * On touch devices the on-screen D-pad and action buttons occupy the lower
 * LEFT and lower RIGHT of the canvas, so a hero spawned at x=40 starts
 * underneath the D-pad. Pushing the start position right by ~18% of the
 * visible width (about an inch and a half on a typical phone, and it scales
 * with the device because it is a proportion of the viewport) puts the hero
 * clear of every control before the player touches anything. Desktop is
 * unchanged at 40.
 */
const START_X = (): number =>
  isCoarsePointer() ? 40 + Math.round(VIEW_W * 0.18) : 40;

/** Touch-first device? Drives the wording of every "continue" prompt. */
const isCoarsePointer = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;

/** One shared continue prompt string for every paused screen. */
const CONTINUE_PROMPT = (): string =>
  isCoarsePointer() ? "Tap Anywhere to Continue" : "Press Enter, Space, or Click to Continue";


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
// Forgiving jump windows: you can still jump shortly after walking off an
// edge, and a jump pressed just before landing still fires.
const COYOTE_S = 0.2;
const JUMP_BUFFER_S = 0.24;
const INVULN_S = 2.4;
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
  if (cause === "boulder") return `${base}\n(Another day slipped by on the waiting list.)`;
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
  "form-monster": 36,
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
  "calendar-page": 46,
  "paper-airplane": 34,
  "brick-idle": 38,
  "brick-hit": 38,
  "envelope-gremlin-0": 42,
  "envelope-gremlin-1": 42,
  "boss-idle": 96,
  "boss-hurt": 96,
  "boss-defeat": 54,
  "door-lock": 26,
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
    { name: "boulder", frame: 9 },
    { name: "denied", frame: 11 },
  ];
  const formMonsterFrames: FrameSpec[] = [{ name: "form-monster", frame: 0 }];
  const docIdFrames: FrameSpec[] = [{ name: "id", frame: 0 }];
  const docPaystubFrames: FrameSpec[] = [{ name: "paystub", frame: 0 }];
  const docEnvelopeFrames: FrameSpec[] = [{ name: "envelope", frame: 0 }];
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
  const calendarFrames: FrameSpec[] = [{ name: "calendar-page", frame: 0 }];
  const airplaneFrames: FrameSpec[] = [{ name: "paper-airplane", frame: 0 }];
  const brickFrames: FrameSpec[] = [
    { name: "brick-idle", frame: 0 },
    { name: "brick-hit", frame: 1 },
  ];
  const gremlinFrames: FrameSpec[] = [
    { name: "envelope-gremlin-0", frame: 0 },
    { name: "envelope-gremlin-1", frame: 1 },
  ];
  const bossFrames: FrameSpec[] = [
    { name: "boss-idle", frame: 0 },
    { name: "boss-hurt", frame: 1 },
    { name: "boss-defeat", frame: 2 },
  ];
  const lockFrames: FrameSpec[] = [{ name: "door-lock", frame: 0 }];

  const [heroSizes, slideSizes, propSizes, propSizes2, doorSizes, credSizes, keySizes, planSizes, idSizes, calSizes, airSizes, brickSizes, gremlinSizes, bossSizes, lockSizes, docIdSizes, docPaystubSizes, docEnvelopeSizes, formMonsterSizes] = await Promise.all([
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
    safeLoadSheet(k, { url: calendarPageUrl,     cols: 1, rows: 1, frames: calendarFrames, label: "calendar-page.png" }),
    safeLoadSheet(k, { url: paperAirplaneUrl,    cols: 1, rows: 1, frames: airplaneFrames, label: "paper-airplane.png" }),
    safeLoadSheet(k, { url: brickBlockSheetUrl,  cols: 2, rows: 1, frames: brickFrames,
      groups: [brickFrames.map((f) => f.name)], label: "brick-block-sheet.png" }),
    safeLoadSheet(k, { url: envelopeGremlinSheetUrl, cols: 2, rows: 1, frames: gremlinFrames,
      groups: [gremlinFrames.map((f) => f.name)], label: "envelope-gremlin-sheet.png" }),
    safeLoadSheet(k, { url: bossSheetUrl,        cols: 3, rows: 1, frames: bossFrames, label: "boss-sheet.png" }),
    safeLoadSheet(k, { url: doorLockUrl,         cols: 1, rows: 1, frames: lockFrames, label: "door-lock.png" }),
    safeLoadSheet(k, { url: docIdUrl,            cols: 1, rows: 1, frames: docIdFrames,       label: "doc-id.png" }),
    safeLoadSheet(k, { url: docPaystubUrl,       cols: 1, rows: 1, frames: docPaystubFrames,  label: "doc-paystub.png" }),
    safeLoadSheet(k, { url: docEnvelopeUrl,      cols: 1, rows: 1, frames: docEnvelopeFrames, label: "doc-envelope.png" }),
    safeLoadSheet(k, { url: formMonsterV2Url,    cols: 1, rows: 1, frames: formMonsterFrames, label: "form-monster-v2.png" }),
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
    safeLoadBackground(k, "bg-thanks",   bgThanksUrl),
    safeLoadBackground(k, "hero-portrait", heroPortraitUrl),
    safeLoadBackground(k, "hero-sitting", heroSittingUrl),
    safeLoadBackground(k, "ranger-guide", rangerGuideUrl),
    safeLoadBackground(k, "mesc-logo-16bit", mescLogo16Url),
    safeLoadBackground(k, "dhs-logo-16bit", dhsLogo16Url),
  ]);


  ASSET_REPORT.ready = true;
  if (typeof window !== "undefined") {
    (window as unknown as { __gameAssetReport?: AssetReport }).__gameAssetReport = ASSET_REPORT;
  }

  return { ...heroSizes, ...slideSizes, ...leftSizes, ...propSizes, ...propSizes2, ...doorSizes, ...credSizes, ...keySizes, ...planSizes, ...idSizes, ...calSizes, ...airSizes, ...brickSizes, ...gremlinSizes, ...bossSizes, ...lockSizes, ...docIdSizes, ...docPaystubSizes, ...docEnvelopeSizes, ...formMonsterSizes };
}

/** Load already-registered sprites' backing images from the sheets by pulling
 *  their PNG data URLs via the browser, flipping horizontally on a canvas,
 *  and re-registering as `${name}-left`. Because we start from the trimmed
 *  bitmap the mirrored copy has identical trim + unified size — nothing else
 *  in the pipeline needs to change. */
async function registerLeftMirrors(
  k: Ctx,
  names: string[],
  sizes: SpriteSizes,
): Promise<SpriteSizes> {
  const out: SpriteSizes = {};
  // Reload the source hero sheet once and re-slice using the trim bboxes we
  // already recorded on ASSET_REPORT.entries.
  for (const name of names) {
    const entry = ASSET_REPORT.entries[name];
    const src = sizes[name];
    if (!entry || !entry.sheetUrl || !entry.sheetRect || !entry.trimBBox || !src) continue;
    try {
      const img = await loadImageEl(entry.sheetUrl);
      const { fx, fy } = entry.sheetRect;
      const bb = entry.trimBBox;
      const cvs = document.createElement("canvas");
      cvs.width = src.w;
      cvs.height = src.h;
      const cx = cvs.getContext("2d");
      if (!cx) continue;
      cx.imageSmoothingEnabled = false;
      const dx = Math.floor((src.w - bb.w) / 2);
      const dy = src.h - bb.h;
      cx.save();
      cx.translate(src.w, 0);
      cx.scale(-1, 1);
      cx.drawImage(img, fx + bb.x, fy + bb.y, bb.w, bb.h, src.w - dx - bb.w, dy, bb.w, bb.h);
      cx.restore();
      const leftName = `${name}-left`;
      await k.loadSprite(leftName, cvs.toDataURL("image/png"));
      out[leftName] = { w: src.w, h: src.h };
      ASSET_REPORT.entries[leftName] = {
        ...entry,
        name: leftName,
        sheetLabel: `${entry.sheetLabel ?? ""} (mirror)`,
        status: "loaded",
      };
    } catch (err) {
      console.warn(`[assets] mirror failed: ${name}`, err);
    }
  }
  return out;
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
        shape: new k.Rect(k.vec2(0, 0), hx.w, hx.h),
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
    k.area({ shape: new k.Rect(k.vec2(0, 0), r * 2, r * 2) }),
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

  // Match the logical viewport to the real on-screen aspect before boot.
  VIEW_W = computeViewW(opts.canvas);
  UI_TEXT_SCALE = computeUiTextScale(opts.canvas, VIEW_W);

  // Seed the shared flag store with whatever the caller knows right now. From
  // here on the engine reads the store live, so an admin toggle changes
  // gameplay without restarting the run.
  FeatureFlags.setFromDbFlags(opts.flags as Record<string, boolean>);

  // Centralized systems — the only consumers of the feature flags.
  const playerMgr = new PlayerManager();
  const powerUps = new PowerUpManager();
  const enemyMgr = new EnemyManager(powerUps);
  const bossMgr = new BossManager(powerUps);
  const checkpointMgr = new CheckpointManager();

  /** Legacy read-only view: `active.extra_lives` now resolves LIVE. */
  const active = new Proxy(
    {},
    { get: (_t, prop) => FeatureFlags.isDbKeyOn(String(prop)) },
  ) as Record<string, boolean>;

  /** Live subscription to the flag store; re-created whenever a scene starts. */
  let unsubscribeFeatures: (() => void) | null = null;

  // ----- Music direction -----
  // The scene doesn't own the audio engine (the React host does), it just
  // asks for a mood. Guarded so we only emit on an actual change.
  let musicTheme: MusicTheme = "adventure";
  const setMusic = (theme: MusicTheme) => {
    if (musicTheme === theme) return;
    musicTheme = theme;
    opts.onMusicTheme?.(theme);
  };
  // Rotate the exploration tunes by a random offset per run so the same zone
  // doesn't always play the same song across repeat plays.
  const musicRotation = Math.floor(Math.random() * EXPLORATION_THEMES.length);
  /** The tune that belongs to a zone, after this run's rotation. */
  const zoneMusic = (zoneIdx: number): MusicTheme => {
    const base = ZONE_THEMES[Math.max(0, Math.min(ZONE_THEMES.length - 1, zoneIdx))] ?? "adventure";
    const at = EXPLORATION_THEMES.indexOf(base);
    if (at < 0) return base; // boss / victory / waiting stay put
    return EXPLORATION_THEMES[(at + musicRotation) % EXPLORATION_THEMES.length];
  };





  const k: Ctx = kaplay({
    canvas: opts.canvas,
    // Fixed logical resolution. Kaplay's letterbox mode scales this buffer to
    // whatever CSS box the canvas has while preserving 16:9, so gameplay
    // coordinates never depend on the physical viewport.
    width: VIEW_W,
    height: LOGICAL_H,
    background: [20, 20, 30],
    letterbox: true,
    global: false,
    debug: false,
    // CONSTANT pixel density — not derived from devicePixelRatio. This is the
    // whole reason sprites stay aligned across DPR changes (rotation, zoom,
    // external displays). The browser handles all CSS-pixel scaling uniformly.
    pixelDensity: computePixelDensity(opts.canvas, VIEW_W),
    crisp: true,
    touchToMouse: true,
  });

  // See the current build: `crisp` also sets `image-rendering: pixelated` on
  // the canvas element, which resamples the finished frame and roughens text.
  if (opts.canvas) opts.canvas.style.imageRendering = "auto";



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
    // Zone 0: 3 small jump gaps carved BETWEEN the four brick positions
    // (bricks live at x = 220, 460, 720, 980) so a gap never blocks reaching a brick.
    const Z0_GAP_A0 = 320, Z0_GAP_A1 = 360;
    const Z0_GAP_B0 = 600, Z0_GAP_B1 = 646;
    const Z0_GAP_C0 = 860, Z0_GAP_C1 = 900;
    addGround(k, 0,          Z0_GAP_A0, GROUND_Y, ZONES[0].ground, ZONES[0].soil);
    addGround(k, Z0_GAP_A1,  Z0_GAP_B0, GROUND_Y, ZONES[0].ground, ZONES[0].soil);
    addGround(k, Z0_GAP_B1,  Z0_GAP_C0, GROUND_Y, ZONES[0].ground, ZONES[0].soil);
    addGround(k, Z0_GAP_C1,  BIOME_W,   GROUND_Y, ZONES[0].ground, ZONES[0].soil);

    const Z1_GAP_X0 = BIOME_W + 720;
    const Z1_GAP_X1 = BIOME_W + 780;
    addGround(k, BIOME_W, Z1_GAP_X0, GROUND_Y, ZONES[1].ground, ZONES[1].soil);
    addGround(k, Z1_GAP_X1, BIOME_W * 2, GROUND_Y, ZONES[1].ground, ZONES[1].soil);

    const RIVER_BASE = BIOME_W * 2;
    const RIVER_GAP_X0 = RIVER_BASE + 320;
    const RIVER_GAP_X1 = RIVER_BASE + 1010;
    addGround(k, RIVER_BASE, RIVER_GAP_X0, GROUND_Y, ZONES[2].ground, ZONES[2].soil);
    addGround(k, RIVER_GAP_X1, BIOME_W * 3, GROUND_Y, ZONES[2].ground, ZONES[2].soil);

    addGround(k, BIOME_W * 3, BIOME_W * 4, GROUND_Y, ZONES[3].ground, ZONES[3].soil);
    addGround(k, BIOME_W * 4, BIOME_W * 5, GROUND_Y, ZONES[4].ground, ZONES[4].soil);
    addGround(k, BIOME_W * 5, BIOME_W * 6, GROUND_Y, ZONES[5].ground, ZONES[5].soil);
    addGround(k, BIOME_W * 6, BIOME_W * 7, GROUND_Y, ZONES[6].ground, ZONES[6].soil);
    // Zone 7 has a lethal gap under the staircase — miss a step, lose a life.
    // Gap width tracks STEP_GAP_X (110) below so the pole base always lands on solid ground.
    const Z7_GAP0 = BIOME_W * 7 + 240;
    const Z7_GAP1 = BIOME_W * 7 + 240 + 110 * 6;
    addGround(k, BIOME_W * 7, Z7_GAP0, GROUND_Y, ZONES[7].ground, ZONES[7].soil);
    addGround(k, Z7_GAP1, LEVEL_END, GROUND_Y, ZONES[7].ground, ZONES[7].soil);
    // Kill plane inside the gap.
    k.add([
      k.rect(Z7_GAP1 - Z7_GAP0, 40),
      k.pos(Z7_GAP0, GROUND_Y + 40),
      k.area(), k.opacity(0), "water",
    ]);

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
      waitDur: 10,
      planPicked: false,
      hasKey: false,
      firePoleAttached: false,
      firePoleDone: false,
      idCardCollected: false,
      cutscene: false,
      cutscenePhase: "none" as "none" | "walk-to-pole" | "slide" | "walk-to-office" | "done",
      cutsceneTargetX: 0,
      cutscenePoleX: 0,
      cutscenePoleTop: 0,
      topLandingRef: null as null | AnyObj,
      bossHits: 0,
      bossDefeated: false,
      bossSpawned: false,
    };


    type Door = { obj: AnyObj; barrier: AnyObj | null; unlocked: boolean; playedAnim: boolean };
    const doors: (Door | null)[] = new Array(ZONES.length).fill(null);

    function setGameObjSprite(obj: AnyObj, name: string) {
      const ds = displaySize(name, sizes);
      obj.sprite = name;
      obj.width = ds.w;
      obj.height = DISPLAY_H[name] ?? ds.h;
      obj.frame = 0;
    }

    function spawnDoor(zoneIdx: number): Door {
      const dx = (zoneIdx + 1) * BIOME_W - 60;
      const disp = displaySize("door-closed", sizes);
      const doorObj = k.add([
        k.sprite("door-closed", { width: disp.w, height: DISPLAY_H["door-closed"] }),
        k.pos(dx, GROUND_Y),
        k.anchor("bot"),
        k.area({ shape: new k.Rect(k.vec2(0, 0), disp.w, DISPLAY_H["door-closed"]) }),
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
      // Padlock badge on the closed door (visually communicates "locked").
      const lockW = displaySize("door-lock", sizes).w;
      const lockH = DISPLAY_H["door-lock"];
      const lockBadge = k.add([
        k.sprite("door-lock", { width: lockW, height: lockH }),
        k.pos(dx, GROUND_Y - DISPLAY_H["door-closed"] / 2),
        k.anchor("center"),
        k.z(LAYERS.PROP + 3),
        { ownerZone: zoneIdx },
      ]) as AnyObj;
      lockBadge.onUpdate(() => {
        const d = doors[zoneIdx];
        if (d && d.unlocked) lockBadge.destroy();
      });

      return { obj: doorObj, barrier: bar, unlocked: false, playedAnim: false };
    }

    function unlockDoor(zoneIdx: number) {
      const d = doors[zoneIdx];
      if (!d || d.unlocked) return;
      d.unlocked = true;
      // Unlock animation: brief shake, chime, then swap sprite + drop barrier.
      d.obj.color = k.rgb(255, 240, 120);
      k.wait(0.25, () => { d.obj.color = k.rgb(255, 255, 255); });
      k.wait(0.5, () => {
        setGameObjSprite(d.obj, "door-open");
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

    // ================= ZONE 0: Finding the Trail — smash a brick to pick your apply method =================
    // Bricks float at head height. Player jumps UP into one (upward velocity)
    // to smash it — the "method" icon pops out, drops to the ground, and the
    // door unlocks the moment the player touches the icon.
    const applyMethods: { x: number; icon: string; label: string }[] = [
      { x: 220, icon: "MAIL",      label: "Apply by Mail" },
      { x: 460, icon: "PHONE",     label: "Apply by Phone" },
      { x: 720, icon: "IN PERSON", label: "Apply In Person" },
      { x: 980, icon: "ONLINE",    label: "Apply Online" },
    ];
    const BRICK_Y = GROUND_Y - 150;
    const bw = displaySize("brick-idle", sizes).w;
    const bh = DISPLAY_H["brick-idle"];
    for (const m of applyMethods) {
      const brick = k.add([
        k.sprite("brick-idle", { width: bw, height: bh }),
        k.pos(px(m.x), px(BRICK_Y)),
        k.anchor("center"),
        k.area({ shape: new k.Rect(k.vec2(0, 0), bw, bh) }),
        k.z(LAYERS.PROP),
        "brick",
        { methodLabel: m.label, methodIcon: m.icon, hit: false, basY: BRICK_Y, bumpT: 0 },
      ]) as AnyObj;
      brick.onUpdate(() => {
        // Bump animation when hit
        if (brick.bumpT > 0) {
          brick.bumpT = Math.max(0, brick.bumpT - k.dt() * 4);
          brick.pos.y = brick.basY - Math.sin((1 - brick.bumpT) * Math.PI) * 10;
        }
      });
      // Floating label above the brick so player knows what each represents.
      addSignPlaque(k, m.x, BRICK_Y - 42, m.label, m.icon);
    }
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
    // Username collectible — floats above ground
    {
      const ux = sx0 + 300;
      const uy = GROUND_Y - 120;
      const disp = displaySize("username", sizes);
      const item = k.add([
        k.sprite("username", { width: disp.w, height: DISPLAY_H["username"] }),
        k.pos(ux, uy),
        k.anchor("center"),
        k.area({ shape: new k.Rect(k.vec2(0, 0), disp.w, DISPLAY_H["username"]) }),
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
        k.area({ shape: new k.Rect(k.vec2(0, 0), disp.w, DISPLAY_H["password"]) }),
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
    // Two more padlocks LEFT of the Z1 gap. Difficulty pass: they no longer
    // cross paths at high speed — one crossing pair became a single slower
    // guard, and the door guard slowed down too.
    {
      const ph = DISPLAY_H["padlock"];
      const pw = displaySize("padlock", sizes).w;
      const spots: Array<{ x: number; dir: 1 | -1; speed: number; range: number }> = [
        { x: sx0 + 490, dir:  1, speed: 95, range: 240 },
        // Padlock guarding the approach to the door on the right.
        { x: sx0 + 1000, dir: -1, speed: 90, range: 140 },
      ];
      for (const s of spots) {
        const m = spawnGrounded(k, "padlock", sizes, {
          x: s.x, z: LAYERS.ACTOR, tag: "monster",
          props: { dir: s.dir, home: s.x, range: s.range },
          hitboxScale: { x: -pw / 2, w: pw, h: ph },
        });
        m.onUpdate(() => {
          m.pos.x += m.dir * s.speed * k.dt();
          m.pos.y = GROUND_Y;
          if (m.pos.x > m.home + m.range) { m.pos.x = m.home + m.range; m.dir = -1; }
          if (m.pos.x < m.home - m.range) { m.pos.x = m.home - m.range; m.dir = 1; }
        });
      }
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
      for (let i = 0; i < 7; i++) {
        spawnDecor(k, "bridge", sizes, { x: rx0 + i * 100 + 50, groundY: GROUND_Y - 6 + bridgeH, z: LAYERS.PLATFORM - 1 });
      }
    } else {
      // Each platform represents an application section. Label baked into the
      // platform surface so the player literally steps on "About You", "Household",
      // "Income", "Signature" to cross the river.
      // All four sit fully over the water gap (gap is 690px wide, platforms are
      // 108px wide and end ~40px short of the far bank).
      // Difficulty pass: slower, shallower bobbing gives a wider landing
      // window on every crossing platform (~25% gentler than before).
      const platforms = [
        { x: rx0 + 30,  y: GROUND_Y - 72,  amp: 50, spd: 3.3, label: "ABOUT YOU" },
        { x: rx0 + 200, y: GROUND_Y - 92,  amp: 68, spd: 2.9, label: "HOUSEHOLD" },
        { x: rx0 + 370, y: GROUND_Y - 86,  amp: 62, spd: 3.6, label: "INCOME" },
        { x: rx0 + 540, y: GROUND_Y - 72,  amp: 50, spd: 3.2, label: "SIGNATURE" },
      ];

      for (const p of platforms) {
        const PLAT_W = 108;
        const plat = k.add([
          k.rect(PLAT_W, 16), k.pos(p.x, p.y),
          k.color(240, 230, 200), k.outline(2, k.rgb(60, 45, 25)),
          k.area(), k.body({ isStatic: true }),
          k.z(LAYERS.PLATFORM), "platform",
          { basY: p.y, amp: p.amp, spd: p.spd, phase: Math.random() * Math.PI * 2, platformSpeed: k.vec2(0, 0), lastPos: k.vec2(p.x, p.y) },
        ]);
        // Dark plaque + shadowed gold text sitting flush on top of the platform.
        const labelSize = 10;
        const charW = labelSize * 0.62;
        const plaqueW = Math.min(PLAT_W - 4, Math.ceil(p.label.length * charW) + 12);
        const plaqueH = labelSize + 8;
        const plaque = k.add([
          k.rect(plaqueW, plaqueH, { radius: 2 }),
          k.pos(p.x + PLAT_W / 2, p.y + 3),
          k.anchor("center"),
          k.color(20, 25, 45),
          k.outline(1, k.rgb(255, 220, 90)),
          k.opacity(0.95),
          k.z(LAYERS.PLATFORM + 1),
        ]) as AnyObj;
        const shadow = k.add([
          k.text(p.label, { size: labelSize, font: "sans-serif" }),
          k.pos(p.x + PLAT_W / 2 + 1, p.y + 3 + 1),
          k.anchor("center"), k.color(0, 0, 0), k.z(LAYERS.PLATFORM + 2),
        ]) as AnyObj;
        const label = k.add([
          k.text(p.label, { size: labelSize, font: "sans-serif" }),
          k.pos(p.x + PLAT_W / 2, p.y + 3),
          k.anchor("center"), k.color(255, 220, 90), k.z(LAYERS.PLATFORM + 3),
        ]) as AnyObj;
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
          plaque.pos.y = newY + 3;
          shadow.pos.y = newY + 3 + 1;
          label.pos.y = newY + 3;
        });
      }
    }
    // Background thought bubbles — decorative "what am I filling out?" chatter.
    {
      const bubbles: Array<[number, number, string]> = [
        [rx0 + 60,  120, "Which form?"],
        [rx0 + 220, 90,  "Do I qualify?"],
        [rx0 + 360, 140, "Where do I start?"],
        [rx0 + 500, 100, "Is this online?"],
        [rx0 + 640, 130, "How long?"],
      ];
      for (const [bx, by, text] of bubbles) spawnThoughtBubble(k, bx, by, text);
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
      [tx0 + 220, "id", "ID"],
      [tx0 + 520, "paystub", "Income"],
      [tx0 + 900, "envelope", "Household"],
    ];
    for (const [x, prop, key] of docs) {
      const dh = DISPLAY_H[prop];
      spawnGrounded(k, prop, sizes, {
        x, z: LAYERS.PROP, tag: "doc",
        props: { docKey: key },
        hitboxScale: { x: -dh / 2, w: dh, h: dh },
      });
    }
    {
      const mh = DISPLAY_H["form-monster"];
      const mw = displaySize("form-monster", sizes).w;
      // Difficulty pass: three clipboards instead of four, spaced further
      // apart and patrolling slower so gaps between them stay walkable.
      const baseSpeed = active.plain_language ? 26 : 42;
      const monsterSpots: Array<{ x: number; speed: number; range: number }> = [
        { x: tx0 + 360,  speed: active.plain_language ? 22 : 38, range: 90 },
        { x: tx0 + 700,  speed: baseSpeed,                        range: 105 },
        { x: tx0 + 1040, speed: active.plain_language ? 22 : 36, range: 95 },
      ];

      for (const s of monsterSpots) {
        const m = spawnGrounded(k, "form-monster", sizes, {
          x: s.x, z: LAYERS.ACTOR, tag: "monster",
          props: { dir: 1, home: s.x, range: s.range },
          hitboxScale: { x: -mw / 2, w: mw, h: mh },
        });
        m.onUpdate(() => {
          m.pos.x += m.dir * s.speed * k.dt();
          m.pos.y = GROUND_Y;
          if (m.pos.x > m.home + m.range) { m.pos.x = m.home + m.range; m.dir = -1; m.flipX = true; }
          if (m.pos.x < m.home - m.range) { m.pos.x = m.home - m.range; m.dir = 1; m.flipX = false; }
        });
      }
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
      // Difficulty pass: two Envelope-Gremlins (was three), starting further
      // apart and roaming a little slower.
      const mh = DISPLAY_H["envelope-gremlin-0"];
      const mw = displaySize("envelope-gremlin-0", sizes).w;
      const zoneL = relayBase + 80;
      const zoneR = relayBase + BIOME_W - 80;
      const startXs = [relayBase + 340, relayBase + 940];
      for (let gi = 0; gi < startXs.length; gi++) {
        const sx = startXs[gi];
        const m = spawnGrounded(k, "envelope-gremlin-0", sizes, {
          x: sx, z: LAYERS.ACTOR, tag: "monster",
          props: {
            dir: (Math.random() < 0.5 ? -1 : 1) as 1 | -1,
            speed: 42 + Math.random() * 40,
            targetX: zoneL + Math.random() * (zoneR - zoneL),
            nextRoll: 0.7 + Math.random() * 0.6,
            rollT: 0,
            baseY: GROUND_Y,
            bobPhase: Math.random() * Math.PI * 2,
            animT: 0,
            gremlinFrame: 0,
            diveUntil: 0,
            nextDive: 2.5 + Math.random() * 2.0,
          },
          hitboxScale: { x: -mw / 2, w: mw, h: mh },
        });
        m.onUpdate(() => {
          const dt = k.dt();
          const now = k.time();
          m.rollT += dt;
          // Occasionally lock onto the player for a short dive burst.
          if (now >= m.nextDive) {
            m.diveUntil = now + 0.6;
            m.nextDive = now + 2.5 + Math.random() * 2.0;
          }
          if (now < m.diveUntil) {
            m.targetX = player.pos.x;
            m.speed = 150;
          } else if (m.rollT >= m.nextRoll || Math.abs(m.pos.x - m.targetX) < 8) {
            m.targetX = zoneL + Math.random() * (zoneR - zoneL);
            m.speed = 55 + Math.random() * 55;
            m.nextRoll = 0.7 + Math.random() * 0.6;
            m.rollT = 0;
          }
          m.dir = m.pos.x < m.targetX ? 1 : -1;
          m.pos.x += m.dir * m.speed * dt;
          if (m.pos.x < zoneL) m.pos.x = zoneL;
          if (m.pos.x > zoneR) m.pos.x = zoneR;
          m.pos.y = m.baseY + Math.sin(k.time() * 3 + m.bobPhase) * 8;
          m.flipX = m.dir < 0;
          m.animT += dt;
          const nf = Math.floor(m.animT * 4) % 2;
          if (nf !== m.gremlinFrame) {
            m.gremlinFrame = nf;
            setGameObjSprite(m, `envelope-gremlin-${nf}`);
          }
        });
      }
    }

    // Decorative paper airplanes drifting across the sky — ties into the
    // "letters back and forth with the agency" theme. No collision.
    {
      const planeDefs = [
        { y: 90,  spd: 70, phase: 0.0, bobA: 8,  bobS: 1.6 },
        { y: 140, spd: 55, phase: 1.7, bobA: 6,  bobS: 1.2 },
        { y: 190, spd: 85, phase: 3.2, bobA: 10, bobS: 1.9 },
        { y: 60,  spd: 45, phase: 2.4, bobA: 5,  bobS: 1.4 },
      ];
      const zoneL = relayBase - 40;
      const zoneR = relayBase + BIOME_W + 40;
      const span = zoneR - zoneL;
      for (const pd of planeDefs) {
        const pw = displaySize("paper-airplane", sizes).w;
        const ph = DISPLAY_H["paper-airplane"];
        const plane = k.add([
          k.sprite("paper-airplane", { width: pw, height: ph }),
          k.pos(zoneL + Math.random() * span, pd.y),
          k.anchor("center"),
          k.z(LAYERS.BG_NEAR + 2),
          { basY: pd.y, spd: pd.spd, phase: pd.phase, bobA: pd.bobA, bobS: pd.bobS },
        ]) as AnyObj;
        plane.onUpdate(() => {
          plane.pos.x += plane.spd * k.dt();
          if (plane.pos.x > zoneR) plane.pos.x = zoneL;
          plane.pos.y = plane.basY + Math.sin(k.time() * plane.bobS + plane.phase) * plane.bobA;
        });
      }
    }
    zoneObjectives[4] = {
      hudLabel: () => `REPLIES ${zoneState.repliesGot}/${zoneState.repliesNeeded}`,
      met: () => zoneState.repliesGot >= zoneState.repliesNeeded,
    };

    // ================= ZONE 5: Waiting Mountain — 10-second countdown =================
    const mx0 = BIOME_W * 5;
    // Falling calendar pages — days peeling off the calendar while you wait.
    // Rebalance pass: a small pool (8) of pages that drop one at a time on a
    // scheduler instead of raining continuously. Every drop is telegraphed,
    // never lands on the column the player is standing in, and keeps a minimum
    // horizontal gap from the previous drop, so there is always a safe lane.
    const CAL_COUNT = 8;
    const CAL_L = mx0 + 80;
    const CAL_R = mx0 + BIOME_W - 80;
    const CAL_MIN_GAP = 0.85; // seconds between two pages starting to fall
    const CAL_TELEGRAPH = 0.5; // seconds a warning marker shows before the drop
    let calNextDropAt = 0;
    let calLastX = (CAL_L + CAL_R) / 2;
    /** Pick a drop column: away from the player and from the previous drop. */
    function pickCalX(): number {
      let best = CAL_L + Math.random() * (CAL_R - CAL_L);
      let bestScore = -1;
      for (let i = 0; i < 8; i++) {
        const cand = CAL_L + Math.random() * (CAL_R - CAL_L);
        const dPlayer = Math.abs(cand - player.pos.x);
        const dPrev = Math.abs(cand - calLastX);
        if (dPlayer < 120) continue; // never right on top of the player
        const score = Math.min(dPlayer, dPrev * 1.4);
        if (score > bestScore) { bestScore = score; best = cand; }
      }
      calLastX = best;
      return best;
    }
    for (let i = 0; i < CAL_COUNT; i++) {
      const b = spawnAirborne(k, "calendar-page", sizes, {
        x: (CAL_L + CAL_R) / 2, y: -400, z: LAYERS.ACTOR,
        tag: "boulder",
        props: {
          spd: 230,
          spin: 40,
          driftAmp: 10,
          driftSpd: 1,
          driftPhase: Math.random() * Math.PI * 2,
          baseX: (CAL_L + CAL_R) / 2,
          armAt: 0,
          falling: false,
          marker: null as null | { pos: { x: number; y: number }; destroy: () => void; opacity: number },
        },
      });
      b.use(k.rotate(0));
      /** Park the page off-screen and schedule its next telegraphed drop. */
      const rearm = () => {
        b.falling = false;
        b.pos = k.vec2((CAL_L + CAL_R) / 2, -600);
        b.armAt = k.time() + 0.2 + Math.random() * 1.6;
      };
      rearm();
      b.onUpdate(() => {
        const now = k.time();
        if (!b.falling) {
          // Only rain while the player is actually in the waiting zone.
          if (player.pos.x < mx0 - 200 || player.pos.x > mx0 + BIOME_W + 200) return;
          // Wait for this page's turn AND for the global spacing gap.
          if (now < b.armAt || now < calNextDropAt) return;
          calNextDropAt = now + CAL_MIN_GAP;
          const nx = pickCalX();
          b.baseX = nx;
          b.pos = k.vec2(nx, -80);
          b.spd = 210 + Math.random() * 70; // slower than before (was 290-460)
          b.spin = (Math.random() < 0.5 ? -1 : 1) * (25 + Math.random() * 35);
          b.driftAmp = 8 + Math.random() * 12;
          b.driftSpd = 0.7 + Math.random() * 0.6;
          b.driftPhase = Math.random() * Math.PI * 2;
          b.angle = 0;
          b.falling = true;
          // Telegraph: a shadow marker on the ground under the drop column.
          const marker = k.add([
            k.rect(30, 6, { radius: 3 }),
            k.pos(nx, GROUND_Y - 4),
            k.anchor("center"),
            k.color(60, 45, 90),
            k.opacity(0.75),
            k.z(LAYERS.GROUND_TOP + 2),
          ]) as unknown as { destroy: () => void; opacity: number };
          b.marker = marker;
          k.wait(CAL_TELEGRAPH + 1.2, () => marker.destroy());
          return;
        }
        b.pos.y += b.spd * k.dt();
        b.pos.x = b.baseX + Math.sin(now * b.driftSpd + b.driftPhase) * b.driftAmp;
        b.angle = (b.angle ?? 0) + b.spin * k.dt();
        if (b.pos.y > 700) rearm();
      });
    }

    addSpeech(k, mx0 + 500, 90, "Awaiting a decision…", [50, 40, 80]);
    zoneObjectives[5] = {
      hudLabel: () => {
        if (zoneState.waitStart === 0) return "WAIT 0:10";
        const left = Math.max(0, Math.ceil(zoneState.waitDur - (k.time() - zoneState.waitStart)));
        if (left === 0) return "APPROVED! →";
        return `WAIT 0:${String(left).padStart(2, "0")}`;
      },
      met: () => zoneState.waitStart > 0 && k.time() - zoneState.waitStart >= zoneState.waitDur,
    };

    // ================= ZONE 6: Choosing Your Path — pick a plan, get a key =================
    const kx0 = BIOME_W * 6;
    const planDefs: Array<{ x: number; sprite: string; label: string }> = [
      { x: kx0 + 260, sprite: "plan-blue",   label: "Blue Cross / Blue Shield" },
      { x: kx0 + 560, sprite: "plan-green",  label: "HealthPartners" },
      { x: kx0 + 860, sprite: "plan-orange", label: "Medica" },
    ];
    for (const p of planDefs) {
      const dh = DISPLAY_H[p.sprite];
      const dw = displaySize(p.sprite, sizes).w;
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
        k.area({ shape: new k.Rect(k.vec2(0, 0), dw, dh) }),
        k.z(LAYERS.PROP),
        "plan-pick",
        { planLabel: p.label, bonus: 800 },
      ]) as AnyObj;
      void item;
      addSpeech(k, p.x, GROUND_Y - dh - 26, p.label, [30, 30, 60]);
    }
    addSpeech(k, kx0 + 560, GROUND_Y - 220, "Pick ONE plan", [30, 60, 120]);
    zoneObjectives[6] = {
      hudLabel: () =>
        zoneState.hasKey
          ? "KEY ✓"
          : zoneState.bossDefeated
            ? "GRAB KEY →"
            : zoneState.planPicked
              ? `BOSS ${zoneState.bossHits}/3`
              : "PLAN ☐",
      met: () => zoneState.hasKey,
    };

    // ================= ZONE 7: Coverage Begins — stairs, ID card, fire pole =================
    const cx0 = BIOME_W * 7;
    // Staircase platforms rising, wider spacing so jumps between steps are
    // committed (bottomless kill plane below the whole staircase). Steps sit
    // over a lethal gap in the ground so a missed jump costs a life.
    const stairY0 = GROUND_Y;
    const stepCount = 6;
    const STEP_GAP_X = 110;   // matches Z7_GAP1 above so the pole lands on ground
    const STEP_START_X = cx0 + 260;
    // (Lethal gap water plane is created with the ground split for Zone 7.)
    for (let i = 0; i < stepCount; i++) {
      const sxi = STEP_START_X + i * STEP_GAP_X;
      const syi = stairY0 - 60 - i * 45;
      k.add([
        k.rect(72, 14), k.pos(sxi, syi),
        k.color(200, 195, 210),
        k.outline(2, k.rgb(90, 90, 110)),
        k.area(), k.body({ isStatic: true }),
        k.z(LAYERS.PLATFORM), "platform",
        { platformSpeed: k.vec2(0, 0), lastPos: k.vec2(sxi, syi) },
      ]);
    }
    // Top landing + medical ID card. Landing width kept short so it ends
    // BEFORE the fire pole — otherwise the solid platform blocks the slide.
    const topLandingX = STEP_START_X + stepCount * STEP_GAP_X + 20;
    const topLandingY = stairY0 - 60 - stepCount * 45;
    const topLanding = k.add([
      k.rect(72, 14), k.pos(topLandingX, topLandingY),
      k.color(200, 195, 210), k.outline(2, k.rgb(90, 90, 110)),
      k.area(), k.body({ isStatic: true }),
      k.z(LAYERS.PLATFORM), "platform",
      { platformSpeed: k.vec2(0, 0), lastPos: k.vec2(topLandingX, topLandingY) },
    ]) as AnyObj;
    zoneState.topLandingRef = topLanding;
    {
      const idW = displaySize("medical-id", sizes).w;
      const idH = DISPLAY_H["medical-id"];
      const idX = topLandingX + 30;
      const idY = topLandingY - idH / 2 - 8;
      const idItem = k.add([
        k.sprite("medical-id", { width: idW, height: idH }),
        k.pos(idX, idY),
        k.anchor("center"),
        k.area({ shape: new k.Rect(k.vec2(0, 0), idW, idH) }),
        k.z(LAYERS.PROP),
        "id-card",
        { basY: idY },
      ]) as AnyObj;
      idItem.onUpdate(() => { idItem.pos.y = idItem.basY + Math.sin(k.time() * 2.5) * 4; });
      // (No floating labels here — the paused Step 8 briefing covers the ID card.)
    }

    // Fire pole — offset from top landing with a visible air gap so the pole
    // reads as a separate grabbable target and the slide can't be interrupted
    // by re-landing on the landing's static body.
    const poleX = topLandingX + 96;
    if (poleX > LEVEL_END - 40) {
      console.warn("[game] Zone 8 fire pole placed past LEVEL_END", { poleX, LEVEL_END });
    }
    const poleTop = topLandingY - 60;
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
          : zoneState.cutscene
            ? "FINISHING…"
            : zoneState.idCardCollected
              ? "SLIDE DOWN →"
              : "ID CARD ☐",
      met: () => zoneState.firePoleDone,
    };


    // ===== Checkpoint flags (Check Your Status Anytime) =====
    // Managed live: markers appear the moment the upgrade is switched on and
    // vanish the moment it is switched off.
    const checkpointX = spawnX > 1000 ? spawnX : 40;
    function syncCheckpointMarkers() {
      const existing = k.get("checkpoint");
      if (checkpointMgr.enabled()) {
        if (existing.length > 0) return;
        for (let z = 1; z < ZONES.length; z++) {
          const fx = BIOME_W * z + 60;
          if (z === 1) {
            // Zone 2 keeps the campfire sprite.
            const ch = DISPLAY_H["campfire"];
            spawnGrounded(k, "campfire", sizes, {
              x: fx, z: LAYERS.PROP, tag: "checkpoint",
              props: { atX: fx },
              hitboxScale: { x: -ch / 2, w: ch, h: ch },
            });
          } else {
            // Other zones: slim navy/gold checkpoint flag instead of a campfire.
            const pole = k.add([
              k.rect(4, 46),
              k.pos(fx, GROUND_Y - 46),
              k.color(30, 35, 60),
              k.outline(1, k.rgb(255, 220, 90)),
              k.area({ shape: new k.Rect(k.vec2(-14, 0), 32, 46) }),
              k.z(LAYERS.PROP),
              "checkpoint",
              { atX: fx },
            ]) as AnyObj;
            const flag = k.add([
              k.rect(20, 14),
              k.pos(fx + 4, GROUND_Y - 44),
              k.color(255, 220, 90),
              k.outline(1, k.rgb(20, 25, 45)),
              k.z(LAYERS.PROP),
              "checkpoint-flag",
            ]) as AnyObj;
            pole.onDestroy(() => flag.destroy());
          }
        }
      } else {
        existing.forEach((o) => (o as unknown as { destroy: () => void }).destroy());
        checkpointMgr.clear();
      }
    }




    // ================= Player =================
    const player = k.add([
      k.sprite("hero-idle", { width: displaySize("hero-idle", sizes).w, height: DISPLAY_H["hero-idle"] }),
      k.pos(spawnX, GROUND_Y - 20),
      k.area({ shape: new k.Rect(k.vec2(0, 0), PLAYER_HITBOX.w, PLAYER_HITBOX.h) }),
      k.body(),
      k.anchor("bot"),
      k.z(LAYERS.PLAYER),
      "player",
      {
        docs: new Set<string>(),
        checkpointX,
        won: false,
        dead: false,
        lives: playerMgr.startingLives(),
        maxLives: playerMgr.startingLives(),
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
        animState: "idle" as "idle" | "walk" | "jump" | "slide",
        animTick: 0,
        walkFrame: 0,
        slideFrame: 0,
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
    let currentSpriteName = "hero-idle";
    function setSprite(name: string) {
      if (currentSpriteName === name) return;
      currentSpriteName = name;
      setGameObjSprite(player, name);
    }
    /** Returns "-left" when the player currently faces left AND a mirrored
     *  variant is registered for the sprite; otherwise returns "". */
    function facingSuffix(baseName: string): string {
      if (player.facing >= 0) return "";
      return sizes[`${baseName}-left`] ? "-left" : "";
    }
    function setAnim(next: "idle" | "walk" | "jump" | "slide") {
      if (player.animState === next) return;
      player.animState = next;
      player.animTick = 0;
      player.walkFrame = 0;
      player.slideFrame = 0;
      if (next === "idle") setSprite(`hero-idle${facingSuffix("hero-idle")}`);
      else if (next === "jump") setSprite(`hero-jump${facingSuffix("hero-jump")}`);
      else if (next === "slide") setSprite("hero-slide-0");
      else setSprite(`hero-walk-0${facingSuffix("hero-walk-0")}`);
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

    // ================= Power-ups (Navigator / Live Chat / Email) =================
    // Every pickup is driven by PowerUpManager, which is driven by the flags.
    // Nothing here asks about a flag directly.
    const POWERUP_STYLE: Record<
      PowerUpKind,
      { fill: [number, number, number]; glyph: string }
    > = {
      navigator: { fill: [60, 150, 90], glyph: "NAV" },
      chat: { fill: [50, 110, 210], glyph: "CHAT" },
      email: { fill: [200, 130, 40], glyph: "MAIL" },
    };
    const powerUpObjs = new Map<PowerUpKind, AnyObj>();

    function spawnPowerUp(kind: PowerUpKind) {
      const def = POWERUP_DEFS[kind];
      const style = POWERUP_STYLE[kind];
      const x = def.zone * BIOME_W + def.offsetX;
      const y = GROUND_Y - def.y;
      const W = 54, H = 30;
      const box = k.add([
        k.rect(W, H, { radius: 6 }),
        k.pos(x, y),
        k.anchor("center"),
        k.color(...style.fill),
        k.outline(3, k.rgb(255, 255, 255)),
        k.area({ shape: new k.Rect(k.vec2(0, 0), W, H) }),
        k.z(LAYERS.EFFECT),
        "powerup",
        { kind, baseY: y },
      ]) as AnyObj;
      const label = k.add([
        k.text(style.glyph, { size: 13, font: "sans-serif" }),
        k.pos(x, y),
        k.anchor("center"),
        k.color(255, 255, 255),
        k.z(LAYERS.EFFECT + 1),
      ]) as AnyObj;
      box.onUpdate(() => {
        box.pos.y = box.baseY + Math.sin(k.time() * 2.4) * 6;
        label.pos = k.vec2(box.pos.x, box.pos.y);
      });
      box.onDestroy(() => label.destroy());
      powerUpObjs.set(kind, box);
    }

    function syncPowerUps() {
      powerUps.revokeDisabled();
      for (const kind of POWERUP_KINDS) {
        const present = powerUpObjs.get(kind);
        if (powerUps.shouldSpawn(kind)) {
          if (!present) spawnPowerUp(kind);
        } else if (present) {
          present.destroy();
          powerUpObjs.delete(kind);
        }
      }
    }

    function sparkleBurst(x: number, y: number, color: [number, number, number]) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const sp = k.add([
          k.rect(4, 4),
          k.pos(x, y),
          k.color(...color),
          k.anchor("center"),
          k.opacity(1),
          k.z(LAYERS.EFFECT + 2),
          { vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, life: 0 },
        ]) as AnyObj;
        sp.onUpdate(() => {
          sp.pos.x += sp.vx * k.dt();
          sp.pos.y += sp.vy * k.dt();
          sp.life += k.dt();
          sp.opacity = Math.max(0, 1 - sp.life * 1.4);
          if (sp.life > 0.8) sp.destroy();
        });
      }
    }

    player.onCollide("powerup", (p) => {
      const obj = p as unknown as { kind: PowerUpKind; pos: { x: number; y: number }; destroy: () => void };
      const kind = obj.kind;
      powerUps.collect(kind);
      player.score += 300;
      sparkleBurst(obj.pos.x, obj.pos.y, POWERUP_STYLE[kind].fill);
      obj.destroy();
      powerUpObjs.delete(kind);
      showHint(
        kind === "navigator"
          ? "Navigator joined you — they'll handle the boss!"
          : kind === "chat"
            ? "Live chat open — you're shielded in this zone!"
            : "Emailed your case worker — umbrella up!",
      );
    });

    // ----- Navigator companion: walks beside the player while carried -----
    let companion: AnyObj | null = null;
    let companionBubble: AnyObj | null = null;
    let companionBubbleParts: AnyObj[] = [];
    function syncCompanion() {
      const want = powerUps.navigatorReady();
      if (want && !companion) {
        companion = spawnGrounded(k, "ranger", sizes, {
          x: player.pos.x - 60,
          z: LAYERS.ACTOR,
        }) as AnyObj;
        // Name card: navy plaque + shadowed gold text so it stays readable
        // against bright skies and pale backgrounds.
        const navLabel = "Navigator — I'll help!";
        const navSize = 10;
        const navW = Math.ceil(navLabel.length * navSize * 0.62) + 14;
        const navH = navSize + 10;
        const navPlaque = k.add([
          k.rect(navW, navH, { radius: 3 }),
          k.pos(0, 0),
          k.anchor("center"),
          k.color(20, 25, 45),
          k.outline(2, k.rgb(255, 220, 90)),
          k.opacity(0.95),
          k.z(LAYERS.EFFECT),
        ]) as AnyObj;
        const navShadow = k.add([
          k.text(navLabel, { size: navSize, font: "sans-serif" }),
          k.pos(0, 0),
          k.anchor("center"),
          k.color(0, 0, 0),
          k.z(LAYERS.EFFECT + 1),
        ]) as AnyObj;
        const navText = k.add([
          k.text(navLabel, { size: navSize, font: "sans-serif" }),
          k.pos(0, 0),
          k.anchor("center"),
          k.color(255, 220, 90),
          k.z(LAYERS.EFFECT + 2),
        ]) as AnyObj;
        companionBubble = navPlaque;
        companionBubbleParts = [navPlaque, navShadow, navText];
      } else if (!want && companion) {
        companion.destroy();
        companionBubbleParts.forEach((o) => o.destroy());
        companionBubbleParts = [];
        companion = null;
        companionBubble = null;
      }
    }
    k.onUpdate(() => {
      if (!companion) return;
      const target = player.pos.x - 62 * player.facing;
      const dx = target - companion.pos.x;
      companion.pos.x += Math.sign(dx) * Math.min(Math.abs(dx), 4);
      companion.pos.y = GROUND_Y;
      if (companionBubbleParts.length) {
        const bx = companion.pos.x;
        const by = companion.pos.y - DISPLAY_H["ranger"] - 12;
        companionBubbleParts[0].pos = k.vec2(bx, by);
        companionBubbleParts[1].pos = k.vec2(bx + 1, by + 1);
        companionBubbleParts[2].pos = k.vec2(bx, by);
      }
      if (Math.random() < 0.06) {
        sparkleBurst(companion.pos.x, companion.pos.y - DISPLAY_H["ranger"] / 2, [255, 235, 140]);
      }
    });

    // ----- Chat shield ring + Email umbrella, purely reactive visuals -----
    const shieldRing = k.add([
      k.circle(34),
      k.pos(0, 0),
      k.anchor("center"),
      k.color(90, 170, 255),
      k.opacity(0),
      k.z(LAYERS.PLAYER - 1),
    ]) as AnyObj;
    const umbrella = k.add([
      k.rect(64, 12, { radius: 6 }),
      k.pos(0, 0),
      k.anchor("center"),
      k.color(220, 90, 90),
      k.outline(2, k.rgb(40, 40, 60)),
      k.opacity(0),
      k.z(LAYERS.PLAYER + 1),
    ]) as AnyObj;
    k.onUpdate(() => {
      const zoneNow = Math.floor(player.pos.x / BIOME_W);
      const shielded = powerUps.shieldActive(zoneNow);
      shieldRing.opacity = shielded ? 0.35 + Math.sin(k.time() * 8) * 0.15 : 0;
      shieldRing.pos = k.vec2(player.pos.x, player.pos.y - 26);
      const umb = powerUps.umbrellaActive(zoneNow);
      umbrella.opacity = umb ? 1 : 0;
      umbrella.pos = k.vec2(player.pos.x, player.pos.y - DISPLAY_H["hero-idle"] - 10);
    });


    // ================= HUD =================
    // pixelHudText: HUD label with a 1-px black drop shadow so pixel text
    // stays legible over bright biome backgrounds (previously HUD text
    // could wash out over the sky/snow/market palettes).
    type HudTextOpts = {
      x: number;
      y: number;
      size: number;
      color: [number, number, number];
      anchor?: "topleft" | "topright" | "center" | "top";
      width?: number;
      align?: "left" | "center" | "right";
      initial?: string;
      opacity?: number;
    };
    // HUD type is scaled by the same factor as the briefing panels (capped
    // lower, since the HUD must not eat the playfield) so score / timer /
    // docs stay legible when the canvas is drawn small in a browser window.
    const HUD_S = Math.max(1, Math.min(1.55, UI_TEXT_SCALE));
    function pixelHudText(o: HudTextOpts) {
      const fs = Math.round(o.size * HUD_S);
      const textOpts: Record<string, unknown> = { size: fs, font: "sans-serif" };
      if (o.width !== undefined) textOpts.width = Math.round(o.width * HUD_S);
      if (o.align !== undefined) textOpts.align = o.align;
      const initial = o.initial ?? "";
      const mkNode = (dx: number, dy: number, rgb: [number, number, number], z: number) => {
        const parts: unknown[] = [
          k.text(initial, textOpts as never),
          k.pos(o.x + dx, o.y + dy),
          k.color(...rgb),
          k.opacity(o.opacity ?? 1),
          k.fixed(),
          k.z(z),
        ];
        if (o.anchor) parts.push(k.anchor(o.anchor));
        return k.add(parts as never) as AnyObj;
      };
      // A full dark halo (not just a drop shadow) is what keeps white HUD text
      // readable over bright skies, snow, and the market awnings.
      const d = Math.max(1, Math.round(HUD_S));
      const halo = [
        mkNode(-d, 0, [0, 0, 0], LAYERS.HUD),
        mkNode(d, 0, [0, 0, 0], LAYERS.HUD),
        mkNode(0, -d, [0, 0, 0], LAYERS.HUD),
        mkNode(0, d, [0, 0, 0], LAYERS.HUD),
        mkNode(d, d, [0, 0, 0], LAYERS.HUD),
      ];
      const shadow = {
        set text(v: string) { for (const n of halo) n.text = v; },
        set opacity(v: number) { for (const n of halo) n.opacity = v; },
        setPos(x: number, y: number) {
          halo[0].pos = k.vec2(x - d, y);
          halo[1].pos = k.vec2(x + d, y);
          halo[2].pos = k.vec2(x, y - d);
          halo[3].pos = k.vec2(x, y + d);
          halo[4].pos = k.vec2(x + d, y + d);
        },
      };
      const main = mkNode(0, 0, o.color, LAYERS.HUD + 1);
      return {
        get text() { return main.text as string; },
        set text(v: string) { main.text = v; shadow.text = v; },
        get opacity() { return main.opacity as number; },
        set opacity(v: number) { main.opacity = v; shadow.opacity = v; },
        setPos(x: number, y: number) {
          main.pos = k.vec2(x, y);
          shadow.setPos(x, y);
        },
      };
    }

    pixelHudText({
      x: 12, y: 12, size: 14,
      color: opts.mode === "after" ? [30, 160, 60] : [220, 60, 60],
      initial: opts.mode === "after" ? "AFTER FEEDBACK" : "BEFORE FEEDBACK",
    });
    // Score row (above the applications-as-lives row).
    const scoreHud = pixelHudText({ x: 12, y: 34, size: 16, color: [255, 235, 120], initial: "SCORE 0" });
    // Applications row: little application icons that represent lives.
    // Each icon is a paper card with three horizontal "form field" lines.
    // Lives row: classic 16-bit pixel hearts.
    const HEART_PX = 3;              // size of one pixel-art cell
    const HEART_MAP = [
      "0110110",
      "1111111",
      "1111111",
      "0111110",
      "0011100",
      "0001000",
    ];
    const HEART_W = HEART_MAP[0].length * HEART_PX;
    const appIcons: AnyObj[] = [];
    const MAX_POSSIBLE_LIVES = 5;
    for (let i = 0; i < MAX_POSSIBLE_LIVES; i++) {
      const bx = 12 + i * (HEART_W + 6);
      const by = 58;
      const cells: AnyObj[] = [];
      HEART_MAP.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          if (row[rx] !== "1") continue;
          const edge =
            ry === 0 ||
            rx === 0 ||
            rx === row.length - 1 ||
            row[rx - 1] !== "1" ||
            row[rx + 1] !== "1" ||
            (HEART_MAP[ry - 1]?.[rx] ?? "0") !== "1" ||
            (HEART_MAP[ry + 1]?.[rx] ?? "0") !== "1";
          const shine = ry <= 1 && rx >= 1 && rx <= 2;
          cells.push(
            k.add([
              k.rect(HEART_PX, HEART_PX),
              k.pos(bx + rx * HEART_PX, by + ry * HEART_PX),
              edge
                ? k.color(40, 20, 30)
                : shine
                  ? k.color(255, 170, 180)
                  : k.color(220, 45, 60),
              k.fixed(),
              k.z(LAYERS.HUD),
            ]) as AnyObj,
          );
        }
      });
      appIcons.push({ cells });
    }
    const docsHud = pixelHudText({
      x: k.width() - 12, y: 12, size: 14, color: [255, 255, 255], anchor: "topright",
    });
    // Per-zone objective badge, top-right under the "AFTER FEEDBACK" chip.
    const objectiveHud = pixelHudText({
      x: k.width() - 12, y: 34, size: 14, color: [255, 220, 90], anchor: "topright",
    });
    // Hint bubble that pops up when player bumps a locked door.
    let hintUntil = 0;
    const hintHud = pixelHudText({
      x: k.width() / 2, y: k.height() - 60, size: 14, color: [255, 255, 255],
      anchor: "center", width: 460, align: "center", opacity: 0,
    });
    function showHint(msg: string) {
      hintHud.text = msg;
      hintHud.opacity = 1;
      hintUntil = k.time() + 1.8;
    }

    // Big Zone-5 "Awaiting a decision" countdown, top-center.
    const waitBgW = 260;
    const waitBgH = 68;
    const waitBg = k.add([
      k.rect(waitBgW, waitBgH, { radius: 8 }),
      k.pos(k.width() / 2 - waitBgW / 2, 12),
      k.color(15, 15, 30),
      k.outline(3, k.rgb(255, 220, 90)),
      k.opacity(0),
      k.fixed(),
      k.z(LAYERS.HUD),
    ]) as AnyObj;
    const waitLabel = pixelHudText({
      x: k.width() / 2, y: 22, size: 12, color: [255, 220, 90],
      anchor: "top", initial: "AWAITING DECISION", opacity: 0,
    });
    const waitCountdown = pixelHudText({
      x: k.width() / 2, y: 40, size: 28, color: [255, 255, 255],
      anchor: "top", initial: "0:30", opacity: 0,
    });

    // ===== ACTIVE UPGRADES panel =====
    // Sits to the RIGHT of the score/lives block in the top-left HUD cluster so
    // it never covers the player or the playfield floor.
    const UPG_ROWS = 5;
    const UPG_X = Math.round(150 * HUD_S);   // just right of the 5 life hearts
    const UPG_Y = 30;    // aligned with the SCORE row
    const UPG_W = 158;
    const UPG_ROW_H = 13;
    const upgPanel = k.add([
      k.rect(UPG_W, 20 + UPG_ROWS * UPG_ROW_H, { radius: 5 }),
      k.pos(UPG_X, UPG_Y),
      k.anchor("topleft"),
      k.color(15, 15, 30),
      k.outline(2, k.rgb(255, 220, 90)),
      k.opacity(0),
      k.fixed(),
      k.z(LAYERS.HUD),
    ]) as AnyObj;
    const upgTitle = pixelHudText({
      x: UPG_X + 6, y: UPG_Y + 5, size: 8, color: [255, 220, 90], anchor: "topleft",
      initial: "ACTIVE UPGRADES", opacity: 0,
    });
    const upgRows = Array.from({ length: UPG_ROWS }, () =>
      pixelHudText({ x: UPG_X + 6, y: 0, size: 8, color: [255, 255, 255], anchor: "topleft", opacity: 0 }),
    );

    function updateUpgradePanel() {
      const rows = activeUpgradeRows(FeatureFlags.get(), powerUps);
      const h = rows.length === 0 ? 0 : 20 + rows.length * UPG_ROW_H;
      upgPanel.height = h;
      upgPanel.opacity = rows.length === 0 ? 0 : 0.8;
      upgTitle.opacity = rows.length === 0 ? 0 : 1;
      upgTitle.setPos(UPG_X + 6, UPG_Y + 4);
      upgRows.forEach((t, i) => {
        const row = rows[i];
        if (!row) {
          t.opacity = 0;
          return;
        }
        t.opacity = 1;
        t.text = `${row.carried ? "✓" : "○"} ${row.label}`;
        t.setPos(UPG_X + 6, UPG_Y + 17 + i * UPG_ROW_H);
      });
    }


    function updateHud() {
      scoreHud.text = `SCORE ${Math.max(0, Math.round(player.score))}`;
      appIcons.forEach((g, i) => {
        const op = i < player.lives ? 1 : i < player.maxLives ? 0.25 : 0;
        g.cells.forEach((c: AnyObj) => (c.opacity = op));
      });
      updateUpgradePanel();
      const need = ["ID", "Income", "Household"].filter((d) => !player.docs.has(d));
      docsHud.text = player.docs.size > 0
        ? need.length ? `Application docs needed: ${need.join(", ")}` : "Application docs: complete ✓"
        : "";
      const z = player.farthestZone;
      const obj = zoneObjectives[z];
      objectiveHud.text = obj ? obj.hudLabel() : "";

      // Zone-5 big countdown: visible while player is in Zone 5 with an
      // active wait timer, or briefly flashes APPROVED! at 0.
      const inZone5 = Math.floor(player.pos.x / BIOME_W) === 5;
      const started = zoneState.waitStart > 0;
      const elapsed = started ? k.time() - zoneState.waitStart : 0;
      const remaining = started ? Math.max(0, zoneState.waitDur - elapsed) : zoneState.waitDur;
      const approvedFlash = started && elapsed >= zoneState.waitDur && elapsed < zoneState.waitDur + 1.5;
      const showTimer = inZone5;
      if (showTimer) {
        waitBg.opacity = 0.85;
        waitLabel.opacity = 1;
        waitCountdown.opacity = 1;
        if (approvedFlash) {
          waitLabel.text = "APPROVED!";
          waitCountdown.text = "✓";
          (waitLabel as unknown as { color?: unknown }); // color set via node; keep as-is
        } else {
          waitLabel.text = started ? "AWAITING DECISION" : "STEP INTO THE MOUNTAIN";
          const secs = Math.ceil(remaining);
          waitCountdown.text = `0:${String(secs).padStart(2, "0")}`;
        }
      } else {
        waitBg.opacity = 0;
        waitLabel.opacity = 0;
        waitCountdown.opacity = 0;
      }
    }
    updateHud();


    // ================= Pause + interactive step screens =================
    // A step screen is a true pause: every game object stops updating, the
    // wait timer stops counting, and nothing resumes until the player says so.
    let pausedNow = false;
    let pausedObjs: AnyObj[] = [];
    let pauseStartedAt = 0;
    const isPaused = () => pausedNow;

    function pauseGameplay() {
      if (pausedNow) return;
      pausedNow = true;
      pauseStartedAt = k.time();
      pausedObjs = (k.get("*", { recursive: true }) as unknown as AnyObj[]).filter((o) => !o.paused);
      for (const o of pausedObjs) o.paused = true;
    }

    function resumeGameplay() {
      if (!pausedNow) return;
      const frozenFor = k.time() - pauseStartedAt;
      pausedNow = false;
      for (const o of pausedObjs) {
        try { o.paused = false; } catch { /* destroyed while paused */ }
      }
      pausedObjs = [];
      // Shift every wall-clock deadline forward so the pause costs no time.
      if (zoneState.waitStart > 0) zoneState.waitStart += frozenFor;
      player.invulnUntil += frozenFor;
      player.lastGroundedAt += frozenFor;
      if (hintUntil > 0) hintUntil += frozenFor;
    }

    type StepIcon = { sprite?: string; glyph?: string; shape?: "platform" | "stairs"; label: string };
    type StepScreen = { title: string; subtitle: string; lines: string[]; icons: StepIcon[] };
    const STEP_SCREENS: StepScreen[] = [
      {
        title: "STEP 1 · SELECTING YOUR APPLICATION TYPE",
        subtitle: "Finding the Trail",
        lines: [
          "Jump (Up Arrow or Space) to hit the brick and collect your application.",
          "Bring the application to the exit door.",
        ],
        icons: [{ sprite: "brick-idle", label: "APPLICATION" }],
      },
      {
        title: "STEP 2 · CREATING YOUR ACCOUNT",
        subtitle: "Setting Up Camp",
        lines: [
          "Collect the Username item.",
          "Collect the Password item.",
          "Jump over the Account Locks.",
        ],
        icons: [
          { sprite: "username", label: "USERNAME" },
          { sprite: "password", label: "PASSWORD" },
          { sprite: "padlock", label: "ACCOUNT LOCK" },
        ],
      },
      {
        title: "STEP 3 · COMPLETING YOUR APPLICATION",
        subtitle: "Crossing the River of Paperwork",
        lines: [
          "Use the platforms to safely cross the level.",
          "Reaching the other side unlocks the exit door.",
        ],
        icons: [{ shape: "platform", label: "PLATFORM" }],
      },
      {
        title: "STEP 4 · GATHER YOUR DOCUMENTS",
        subtitle: "Gathering Supplies",
        lines: [
          "Collect all 3 required documents.",
          "Jump over the Evil Clipboards.",
        ],
        icons: [
          { sprite: "id", label: "ID" },
          { sprite: "paystub", label: "INCOME" },
          { sprite: "envelope", label: "HOUSEHOLD" },
          { sprite: "form-monster", label: "EVIL CLIPBOARD" },
        ],
      },
      {
        title: "STEP 5 · RESPOND TO REQUEST",
        subtitle: "Answering the Call",
        lines: [
          "Collect all 4 mailboxes.",
          "Jump over the Monster Envelopes.",
        ],
        icons: [
          { sprite: "mailbox", label: "MAILBOX" },
          { sprite: "envelope-gremlin-0", label: "MONSTER ENVELOPE" },
        ],
      },
      {
        title: "STEP 6 · AWAITING DECISION",
        subtitle: "Waiting Mountain",
        lines: [
          "Avoid the falling calendar dates.",
          "Survive for 10 seconds without being hit.",
          "The exit door unlocks automatically.",
        ],
        icons: [{ sprite: "calendar-page", label: "FALLING DATE" }],
      },
      {
        title: "STEP 7 · SELECTING YOUR MANAGED CARE PLAN",
        subtitle: "Choosing Your Path",
        lines: [
          "Select one of the three managed care plans.",
          "Selecting a plan causes the boss to appear.",
          "Dodge the boss's attacks.",
          "Defeat the boss by hitting it three times with \"+\" projectiles.",
        ],
        icons: [
          { sprite: "plan-blue", label: "PLAN" },
          { sprite: "plan-green", label: "PLAN" },
          { sprite: "plan-orange", label: "PLAN" },
          { sprite: "boss-idle", label: "BOSS" },
          { glyph: "+", label: "YOUR SHOT" },
        ],
      },
      {
        title: "STEP 8 · USING YOUR COVERAGE",
        subtitle: "Coverage Begins",
        lines: [
          "Climb the staircase.",
          "Collect your Medical ID Card.",
        ],
        icons: [
          { shape: "stairs", label: "STAIRS" },
          { sprite: "medical-id", label: "MEDICAL ID CARD" },
        ],
      },
    ];

    const stepScreensShown = new Set<number>();
    let stepScreenOpen = false;

    /** Pause the run and show the briefing for `z` — once per run per zone. */
    function showStepScreen(z: number, onDone?: () => void) {
      const data = STEP_SCREENS[z];
      if (!data || stepScreenOpen || stepScreensShown.has(z) || player.dead || player.won) {
        onDone?.();
        return;
      }
      stepScreensShown.add(z);
      stepScreenOpen = true;
      pauseGameplay();

      const W = k.width();
      const H = k.height();
      // Wide phones stretch the logical viewport past 960; scale the panel
      // and its type by the same factor so text keeps a constant on-screen size.
      UI_TEXT_SCALE = computeUiTextScale(opts.canvas, W);
      const S = UI_TEXT_SCALE;
      const px = (n: number) => Math.round(n * S);
      const nodes: AnyObj[] = [];
      const put = (parts: unknown[]) => {
        const o = k.add(parts as never) as AnyObj;
        nodes.push(o);
        return o;
      };

      put([k.rect(W, H), k.pos(0, 0), k.color(0, 0, 0), k.opacity(0.86), k.fixed(), k.z(300)]);
      const panelW = Math.min(px(780), W - px(32));
      const panelH = Math.min(px(430), H - px(20));
      const panelX = Math.floor(W / 2 - panelW / 2);
      const panelY = Math.floor(H / 2 - panelH / 2);
      put([
        k.rect(panelW, panelH, { radius: 6 }), k.pos(panelX, panelY),
        k.color(16, 22, 52), k.outline(4, k.rgb(255, 220, 90)), k.fixed(), k.z(301),
      ]);

      const cx = Math.floor(W / 2);
      let y = panelY + px(26);
      const label = (text: string, size: number, rgb: [number, number, number], width?: number) => {
        const fs = Math.max(15, px(size));
        put([
          k.text(text, { size: fs, font: "sans-serif", align: "center", ...(width ? { width } : {}) }),
          k.pos(cx + 1, y + 1), k.anchor("top"), k.color(0, 0, 0), k.fixed(), k.z(302),
        ]);
        const main = put([
          k.text(text, { size: fs, font: "sans-serif", align: "center", ...(width ? { width } : {}) }),
          k.pos(cx, y), k.anchor("top"), k.color(...rgb), k.fixed(), k.z(303),
        ]);
        y += (main.height ?? fs) + px(8);
      };

      label(data.title, 24, [255, 220, 90], panelW - px(48));
      label(data.subtitle, 17, [180, 205, 255], panelW - px(48));
      y += px(4);
      label(data.lines.map((l) => `• ${l}`).join("\n"), 19, [245, 245, 245], panelW - px(60));

      // Sprite strip: what you'll meet in this zone.
      const iconTop = Math.min(y + px(8), panelY + panelH - px(124));
      const iconBox = px(52);
      const gap = px(40);
      const totalW = data.icons.length * iconBox + (data.icons.length - 1) * gap;
      let ix = cx - totalW / 2 + iconBox / 2;
      for (const icon of data.icons) {
        const centerY = iconTop + iconBox / 2;
        if (icon.sprite) {
          const disp = displaySize(icon.sprite, sizes);
          const nativeH = DISPLAY_H[icon.sprite] ?? iconBox;
          const scale = Math.min(iconBox / Math.max(1, disp.w), iconBox / Math.max(1, nativeH));
          put([
            k.sprite(icon.sprite, { width: Math.max(8, disp.w * scale), height: Math.max(8, nativeH * scale) }),
            k.pos(ix, centerY), k.anchor("center"), k.fixed(), k.z(303),
          ]);
        } else if (icon.glyph) {
          put([k.rect(px(30), px(9)), k.pos(ix, centerY), k.anchor("center"), k.color(60, 210, 120), k.outline(2, k.rgb(255, 255, 255)), k.fixed(), k.z(303)]);
          put([k.rect(px(9), px(30)), k.pos(ix, centerY), k.anchor("center"), k.color(60, 210, 120), k.outline(2, k.rgb(255, 255, 255)), k.fixed(), k.z(303)]);
        } else if (icon.shape === "platform") {
          put([k.rect(px(54), px(14)), k.pos(ix, centerY), k.anchor("center"), k.color(240, 230, 200), k.outline(2, k.rgb(60, 45, 25)), k.fixed(), k.z(303)]);
        } else {
          for (let s = 0; s < 3; s++) {
            put([
              k.rect(px(18), px(10)), k.pos(ix - px(18) + s * px(18), centerY + px(16) - s * px(10)),
              k.anchor("center"), k.color(200, 195, 210), k.outline(2, k.rgb(90, 90, 110)),
              k.fixed(), k.z(303),
            ]);
          }
        }
        // Captions must never wrap mid-word: shrink to fit one line.
        const cellW = Math.min(iconBox + gap, (panelW - px(24)) / data.icons.length);
        const capSize = Math.max(
          9,
          Math.min(px(12), Math.floor(cellW / Math.max(1, icon.label.length * 0.58))),
        );
        put([
          k.text(icon.label, { size: capSize, font: "sans-serif", align: "center" }),
          k.pos(ix, centerY + iconBox / 2 + px(12)), k.anchor("top"), k.color(200, 215, 255), k.fixed(), k.z(303),
        ]);
        ix += iconBox + gap;
      }

      const promptNode = put([
        k.text(CONTINUE_PROMPT(), { size: Math.max(14, px(16)), font: "sans-serif" }),
        k.pos(cx, panelY + panelH - px(30)), k.anchor("center"), k.opacity(1),
        k.color(255, 235, 120), k.fixed(), k.z(303),
      ]);


      // Continue: Enter / Space / click on desktop, tap anywhere on mobile.
      const hitArea = put([
        k.rect(W, H), k.pos(0, 0), k.opacity(0), k.area(), k.fixed(), k.z(305),
      ]);
      const keyHandlers = ["enter", "space", "kpenter"].map((key) =>
        k.onKeyPress(key as never, () => close()),
      );
      const blink = k.onUpdate(() => {
        promptNode.opacity = Math.floor(k.time() * 2) % 2 === 0 ? 1 : 0.3;
      });
      let closed = false;
      function close() {
        if (closed) return;
        closed = true;
        for (const h of keyHandlers) { try { h.cancel(); } catch { /* ignore */ } }
        try { blink.cancel(); } catch { /* ignore */ }
        for (const n of nodes) { try { n.destroy(); } catch { /* ignore */ } }
        stepScreenOpen = false;
        resumeGameplay();
        // Movement must be re-armed: a finger already on the D-pad when the
        // panel was dismissed should not launch the hero.
        leftArmed = false;
        rightArmed = false;
        if (w?.__gameInput) w.__gameInput.jumpReq = false;
        onDone?.();
      }
      hitArea.onClick(() => close());
    }




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
    // Brick head-bump: only counts when player is moving UP (jumping into it).
    player.onCollide("brick", (b) => {
      const brick = b as unknown as {
        hit: boolean; bumpT: number; methodLabel: string; methodIcon: string;
        pos: { x: number; y: number }; use: (c: unknown) => void; basY: number;
      };
      if (brick.hit) return;
      // Only trigger on an upward hit (head bump), not walking into the side.
      if ((player.vel?.y ?? 0) >= -50) return;
      brick.hit = true;
      brick.bumpT = 1;
      setGameObjSprite(brick, "brick-hit");
      // Cancel remaining upward velocity so it feels like a solid bonk.
      player.vel.y = Math.max(0, player.vel.y);
      // Pop the method icon out of the brick — falls to the ground and can be
      // collected by walking into it.
      const iw = 28, ih = 28;
      const icon = k.add([
        k.rect(iw, ih),
        k.pos(brick.pos.x, brick.pos.y - 18),
        k.anchor("center"),
        k.color(255, 210, 60), k.outline(2, k.rgb(90, 60, 10)),
        k.area({ shape: new k.Rect(k.vec2(0, 0), iw, ih) }),
        k.z(LAYERS.PROP + 1),
        "method",
        { methodLabel: brick.methodLabel, vy: -180, landed: false },
      ]) as AnyObj;
      const iconText = k.add([
        k.text(brick.methodIcon, { size: 7, font: "sans-serif" }),
        k.pos(brick.pos.x, brick.pos.y - 18),
        k.anchor("center"), k.color(30, 20, 10), k.z(LAYERS.PROP + 2),
      ]) as AnyObj;
      icon.onUpdate(() => {
        if (!icon.landed) {
          icon.vy += 500 * k.dt();
          icon.pos.y += icon.vy * k.dt();
          if (icon.pos.y >= GROUND_Y - ih / 2) {
            icon.pos.y = GROUND_Y - ih / 2;
            icon.landed = true;
            icon.vy = 0;
          }
        }
        iconText.pos.x = icon.pos.x;
        iconText.pos.y = icon.pos.y;
      });
    });
    player.onCollide("method", (m) => {
      if (zoneState.methodTouched) return;
      zoneState.methodTouched = true;
      player.score += 400;
      const item = m as unknown as { methodLabel?: string; destroy: () => void };
      showHint(`${item.methodLabel ?? "Method"} chosen — door unlocked!`);
      item.destroy();
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

    // New: plan pedestal pick. Any selection spawns the gold key.
    function spawnGoldKey(kx: number, ky: number) {
      if (k.get("gold-key").length > 0) return;
      const kw = displaySize("gold-key", sizes).w;
      const kh = DISPLAY_H["gold-key"];
      const keyItem = k.add([
        k.sprite("gold-key", { width: kw, height: kh }),
        k.pos(kx, ky),
        k.anchor("center"),
        k.area({ shape: new k.Rect(k.vec2(0, 0), kw, kh) }),
        k.z(LAYERS.EFFECT),
        "gold-key",
      ]);
      keyItem.onUpdate(() => {
        const dx = player.pos.x - keyItem.pos.x;
        const dy = (player.pos.y - kh) - keyItem.pos.y;
        keyItem.pos.x += dx * 2 * k.dt();
        keyItem.pos.y += dy * 2 * k.dt();
      });
    }
    player.onCollide("plan-pick", (p) => {
      if (zoneState.planPicked) return;
      const item = p as unknown as { planLabel: string; bonus: number; destroy: () => void; pos: { x: number; y: number } };
      const label = item.planLabel;
      zoneState.planPicked = true;
      player.score += item.bonus ?? 800;
      // Remove every plan pedestal (including the collided one).
      k.get("plan-pick").forEach((o) => (o as { destroy: () => void }).destroy());
      // Spawn the paperwork-ogre boss — 3 "+" hits before the key drops.
      spawnPlanBoss();
      showHint(`Picked ${label} — a claims-denial boss appeared! You're firing + now.`);
    });

    // ----- Zone 7 boss battle: dodge the paperwork, land 3 "+" hits -----
    // Set once the boss exists so the auto-fire loop can report a hit without
    // reaching into the spawner's closure.
    let registerBossHit: ((shotX: number, shotY: number) => void) | null = null;

    /** Denial letters / bills the boss throws. Horizontal, jumpable, spaced. */
    function spawnBossShot(x: number, y: number, dirX: 1 | -1) {
      const sw = displaySize("denied", sizes).w;
      const sh = DISPLAY_H["denied"];
      const shot = k.add([
        k.sprite("denied", { width: sw, height: sh }),
        k.pos(x, y),
        k.anchor("center"),
        k.area({ shape: new k.Rect(k.vec2(0, 0), sw - 8, sh - 8) }),
        k.z(LAYERS.EFFECT),
        "boss-shot",
        { vx: dirX * 210, born: k.time() },
      ]) as AnyObj;
      shot.onUpdate(() => {
        shot.pos.x += shot.vx * k.dt();
        shot.pos.y += Math.sin(k.time() * 6) * 0.6;
        if (k.time() - shot.born > 6) shot.destroy();
      });
    }

    /** The player's healing "+" — auto-fired once a plan has been chosen. */
    function spawnPlusShot() {
      const size = 22;
      const dirX = player.facing >= 0 ? 1 : -1;
      const shot = k.add([
        k.rect(size, 6),
        k.pos(player.pos.x + dirX * 20, player.pos.y - DISPLAY_H["hero-idle"] * 0.55),
        k.anchor("center"),
        k.color(60, 210, 120),
        k.outline(2, k.rgb(255, 255, 255)),
        k.area({ shape: new k.Rect(k.vec2(0, 0), size, size) }),
        k.z(LAYERS.EFFECT),
        "plus-shot",
        { vx: dirX * 430, born: k.time() },
      ]) as AnyObj;
      const stem = k.add([
        k.rect(6, size),
        k.pos(shot.pos.x, shot.pos.y),
        k.anchor("center"),
        k.color(60, 210, 120),
        k.outline(2, k.rgb(255, 255, 255)),
        k.z(LAYERS.EFFECT),
      ]) as AnyObj;
      shot.onUpdate(() => {
        shot.pos.x += shot.vx * k.dt();
        stem.pos = k.vec2(shot.pos.x, shot.pos.y);
        if (k.time() - shot.born > 2) { stem.destroy(); shot.destroy(); }
      });
      shot.onDestroy(() => { try { stem.destroy(); } catch { /* already gone */ } });
      shot.onCollide("boss", () => {
        registerBossHit?.(shot.pos.x, shot.pos.y);
        shot.destroy();
      });
      // A well-aimed "+" also knocks incoming paperwork out of the air.
      shot.onCollide("boss-shot", (o: unknown) => {
        (o as unknown as { destroy: () => void }).destroy();
        shot.destroy();
      });
    }

    // Auto-fire loop: no fire button, the power-up comes with the plan choice.
    let nextPlusShot = 0;
    k.onUpdate(() => {
      if (isPaused() || player.dead || player.won) return;
      if (!zoneState.planPicked || zoneState.bossDefeated) return;
      const now = k.time();
      if (now < nextPlusShot) return;
      nextPlusShot = now + 0.5;
      spawnPlusShot();
    });

    // Incoming paperwork hurts on contact.
    player.onCollide("boss-shot", (o) => {
      (o as unknown as { destroy: () => void }).destroy();
      if (k.time() < player.invulnUntil) return;
      loseLife("monster");
    });

    function spawnPlanBoss() {
      if (zoneState.bossSpawned) return;
      zoneState.bossSpawned = true;
      // The ogre is here — drop into the tense battle theme.
      setMusic("boss");
      const bx = BIOME_W * 6 + 1050;
      const bh = DISPLAY_H["boss-idle"];
      const bw = displaySize("boss-idle", sizes).w;
      const boss = spawnGrounded(k, "boss-idle", sizes, {
        x: bx, z: LAYERS.ACTOR, tag: "boss",
        props: {
          dir: -1, home: bx, range: 150, hits: 0, hurtUntil: 0, dead: false,
          vy: 0, nextShot: 0, nextHop: 0,
        },
        hitboxScale: { x: -bw / 2, w: bw, h: bh },
      });
      const BOSS_MAX_HITS = 3;
      // Hearts HUD above the boss (3 hits to defeat).
      const hearts = k.add([
        k.text("♥♥♥", { size: 16, font: "sans-serif" }),
        k.pos(bx, GROUND_Y - bh - 40),
        k.anchor("center"), k.color(230, 60, 80), k.z(LAYERS.HUD - 1),
      ]) as AnyObj;
      boss.nextShot = k.time() + 1.4;
      boss.nextHop = k.time() + 2.2;

      function defeatBoss() {
        boss.dead = true;
        zoneState.bossDefeated = true;
        setMusic(zoneMusic(currentZone));
        setGameObjSprite(boss, "boss-defeat");
        hearts.destroy();
        k.get("boss-shot").forEach((o) => (o as unknown as { destroy: () => void }).destroy());
        const kx = boss.pos.x;
        const ky = GROUND_Y - 40;
        sparkleBurst(boss.pos.x, GROUND_Y - bh / 2, [255, 235, 140]);
        k.wait(0.7, () => {
          boss.destroy();
          spawnGoldKey(kx, ky);
          showHint("Boss defeated! Grab the key.");
        });
      }

      registerBossHit = (sx: number, sy: number) => {
        if (boss.dead) return;
        const now = k.time();
        // Brief invulnerability window after every hit.
        if (now < boss.hurtUntil) return;
        boss.hits += 1;
        boss.hurtUntil = now + 0.9;
        zoneState.bossHits = boss.hits;
        player.score += 400;
        hearts.text = "♥".repeat(Math.max(0, BOSS_MAX_HITS - boss.hits));
        sparkleBurst(sx, sy, [120, 255, 180]);
        if (boss.hits >= BOSS_MAX_HITS) defeatBoss();
        else showHint(`Boss hit! ${BOSS_MAX_HITS - boss.hits} to go.`);
      };

      boss.onUpdate(() => {
        if (boss.dead) return;
        const dt = k.dt();
        const now = k.time();
        const speed = 70;
        boss.pos.x += boss.dir * speed * dt;
        if (boss.pos.x > boss.home + boss.range) { boss.pos.x = boss.home + boss.range; boss.dir = -1; boss.flipX = true; }
        if (boss.pos.x < boss.home - boss.range) { boss.pos.x = boss.home - boss.range; boss.dir = 1; boss.flipX = false; }
        // Occasional hop.
        if (now >= boss.nextHop && boss.pos.y >= GROUND_Y) {
          boss.vy = -430;
          boss.nextHop = now + 3.2 + Math.random() * 1.8;
        }
        boss.vy += 1300 * dt;
        boss.pos.y = Math.min(GROUND_Y, boss.pos.y + boss.vy * dt);
        if (boss.pos.y >= GROUND_Y) { boss.pos.y = GROUND_Y; boss.vy = 0; }
        hearts.pos.x = boss.pos.x;
        hearts.pos.y = boss.pos.y - bh - 40;
        // Throw paperwork toward the player, never while flashing.
        if (now >= boss.nextShot && now >= boss.hurtUntil) {
          const toward: 1 | -1 = player.pos.x < boss.pos.x ? -1 : 1;
          spawnBossShot(boss.pos.x + toward * (bw / 2), GROUND_Y - 34, toward);
          boss.nextShot = now + 2.1 + Math.random() * 0.7;
        }
        // Flash while invulnerable.
        const wantHurt = now < boss.hurtUntil;
        const nextBossSprite = wantHurt ? "boss-hurt" : "boss-idle";
        if (boss.sprite !== nextBossSprite) setGameObjSprite(boss, nextBossSprite);
        (boss as AnyObj).opacity = wantHurt && Math.floor(now * 12) % 2 === 0 ? 0.4 : 1;
      });

      // Walking into the boss still costs a life; the Navigator upgrade (when
      // enabled) clears the fight on first contact as before.
      player.onCollide("boss", () => {
        if (boss.dead) return;
        if (k.time() < player.invulnUntil) return;
        if (bossMgr.shouldAutoDefeat()) {
          bossMgr.consumeNavigator();
          syncCompanion();
          boss.hits = BOSS_MAX_HITS;
          zoneState.bossHits = BOSS_MAX_HITS;
          player.invulnUntil = k.time() + 0.5;
          player.score += 600;
          defeatBoss();
          return;
        }
        loseLife("monster");
      });
    }




    player.onCollide("gold-key", (kk) => {
      if (zoneState.hasKey) return;
      zoneState.hasKey = true;
      player.score += 500;
      (kk as unknown as { destroy: () => void }).destroy();
      showHint("You got the key! Head to the door.");
    });

    // Medical ID card pickup — triggers the automated finale cutscene.
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
      // Look up the fire-pole entity so the cutscene doesn't depend on
      // collision to know its coordinates.
      const poleEnts = k.get("fire-pole") as unknown as Array<{ poleX: number; poleTop: number }>;
      const pole = poleEnts[0];
      if (!pole) {
        // Extremely defensive: without a pole we can't slide, so just win.
        setMusic("victory");
        showHint("You got your Medical ID!");
        return;
      }
      // Coverage is secured — triumphant fanfare carries the pole slide
      // straight through to the WIN screen.
      setMusic("victory");
      zoneState.cutscene = true;
      zoneState.cutscenePhase = "walk-to-pole";
      zoneState.cutscenePoleX = pole.poleX;
      zoneState.cutscenePoleTop = pole.poleTop;
      player.facing = 1;
      showHint("You got your Medical ID!");
    });

    // Fire pole attach — now driven by the cutscene, not direct collision.
    // Kept as a no-op safety in case the player brushes the pole first.
    player.onCollide("fire-pole", () => {
      // Attachment is handled inside the cutscene state machine below.
    });



    // Single owner of "the slide just finished" — see the main build for the
    // stranded-cutscene defect this replaces.
    let slideDoneAt = 0;
    function completeSlide() {
      if (zoneState.firePoleDone || player.won) return;
      zoneState.firePoleDone = true;
      slideDoneAt = k.time();
      startFireworks(k, player.pos.x + 100, GROUND_Y - 240);
      if (zoneState.cutscene && zoneState.cutscenePhase === "slide") {
        zoneState.cutscenePhase = "walk-to-office";
        zoneState.cutsceneTargetX = LEVEL_END - 140;
        player.facing = 1;
      }
    }

    player.onCollide("pole-base", () => {
      if (!zoneState.firePoleAttached) return;
      completeSlide();
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

    player.onCollide("monster", () => {
      const zoneNow = Math.floor(player.pos.x / BIOME_W);
      if (enemyMgr.blocksDamage("monster", zoneNow)) return;
      loseLife("monster");
    });
    player.onCollide("boulder", (b) => {
      // In the Awaiting-Decision zone, a calendar hit also resets the countdown
      // to the full 10 seconds — feels like the clock starting over.
      const zoneNow = Math.floor(player.pos.x / BIOME_W);
      if (enemyMgr.blocksDamage("boulder", zoneNow)) {
        // Umbrella: the calendar bounces away instead of hurting.
        const obj = b as unknown as { pos: { x: number; y: number }; spd?: number; baseX?: number };
        obj.pos.y = -80;
        if (typeof obj.baseX === "number") {
          obj.baseX = obj.pos.x + (Math.random() - 0.5) * 200;
        }
        sparkleBurst(player.pos.x, player.pos.y - 60, [255, 255, 255]);
        return;
      }
      const alive = !player.dead && !player.won && k.time() >= player.invulnUntil;
      if (zoneNow === ZONE_INDEX.awaitDecision && alive && zoneState.waitStart > 0) {
        zoneState.waitStart = k.time();
      }
      loseLife("boulder");
    });
    player.onCollide("water", () => loseLife("water"));


    function buildCheckpoint(): CheckpointSnapshot {
      return {
        x: player.pos.x,
        y: player.pos.y,
        lives: player.lives,
        maxLives: player.maxLives,
        score: player.score,
        docs: [...player.docs],
        farthestZone: player.farthestZone,
        powerups: powerUps.snapshot(),
        zoneState: { ...zoneState },
        doorsUnlocked: doors.map((d) => !!d?.unlocked),
      };
    }

    function loseLife(cause: FailCause) {
      if (player.dead || player.won) return;
      if (k.time() < player.invulnUntil) return;
      player.invulnUntil = k.time() + INVULN_S;
      player.lives -= 1;
      player.deaths += 1;
      if (player.lives <= 0) {
        player.dead = true;
        checkpointMgr.clear();
        // Run over — the battle theme should never linger on the score screen.
        setMusic(zoneMusic(currentZone));
        showEnd(false, cause);
        return;
      }
      // Check Your Status Anytime: resume exactly where you were, keeping
      // documents, power-ups and unlocked doors. Otherwise fall back to the
      // entry of the furthest zone reached.
      const snap = checkpointMgr.get();
      if (snap) {
        player.pos = k.vec2(snap.x, snap.y - 20);
        player.docs = new Set(snap.docs);
        powerUps.restore(snap.powerups);
        syncPowerUps();
        syncCompanion();
        sparkleBurst(player.pos.x, player.pos.y - 40, [120, 255, 170]);
        showHint("Resumed from your saved checkpoint.");
      } else {
        const zoneEntryX = Math.max(40, player.farthestZone * BIOME_W + 40);
        player.pos = k.vec2(zoneEntryX, GROUND_Y - 40);
      }
      player.vel = k.vec2(0, 0);
      player.riding = null;
      updateHud();
    }


    function buildResult(won: boolean): WinResult {
      const durationMs = Math.round((k.time() - startTime) * 1000);
      // Pace matters: the accumulated play score is scaled by how fast the run
      // was against a par time (~2:30 for all 8 zones, pro-rated for how far
      // the player actually got). Fast runs earn up to x2, slow runs floor x0.5.
      const zonesReached = Math.min(8, Math.max(1, player.farthestZone + 1));
      const parMs = (150_000 * zonesReached) / 8;
      const ratio = durationMs / parMs;
      let speedMult: number;
      if (ratio <= 0.4) speedMult = 2;
      else if (ratio <= 1) speedMult = 2 - ((ratio - 0.4) / 0.6) * 1;
      else if (ratio <= 2) speedMult = 1 - ((ratio - 1) / 1) * 0.5;
      else speedMult = 0.5;
      let finalScore = player.score * speedMult;
      if (won) {
        finalScore += 2000;
        finalScore += player.lives * 500;
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
        : `${pickFailureMessage(zone, cause ?? "fell")}\n\nTell us what would make the next attempt easier — the form is below the game.`;
      const T = computeUiTextScale(opts.canvas, k.width());
      const overlay = k.add([
        k.rect(k.width(), k.height()),
        k.pos(0, 0),
        k.color(0, 0, 0),
        k.opacity(0.72),
        k.area(),
        k.fixed(),
        k.z(LAYERS.OVERLAY),
      ]);
      if (!win) overlay.onClick(() => k.go("trail", START_X(), 1));
      k.add([
        k.text(title, { size: Math.round(30 * T), font: "sans-serif" }),
        k.pos(k.width() / 2, k.height() / 2 - 78),
        k.anchor("center"),
        k.color(win ? k.rgb(255, 220, 90) : k.rgb(255, 150, 150)),
        k.fixed(),
        k.z(LAYERS.OVERLAY_TEXT),
      ]);
      k.add([
        k.text(body, {
          size: Math.round(16 * T),
          font: "sans-serif",
          width: Math.min(720 * T, k.width() - 40),
          align: "center",
        }),
        k.pos(k.width() / 2, k.height() / 2),
        k.anchor("center"),
        k.color(240, 240, 240),
        k.fixed(),
        k.z(LAYERS.OVERLAY_TEXT),
      ]);
      if (win) {
        // The WIN screen holds for 5s, then hands off to the thank-you
        // cutscene — that scene owns the restart prompt.
        k.wait(5, () => k.go("thanks"));
      } else {
        k.add([
          k.text("Tap screen or press R to try again", { size: Math.round(14 * T), font: "sans-serif" }),
          k.pos(k.width() / 2, k.height() / 2 + 100),
          k.anchor("center"),
          k.color(220, 220, 220),
          k.fixed(),
          k.z(LAYERS.OVERLAY_TEXT),
        ]);
        opts.onLose?.(buildResult(false));
      }
    }


    // ================= Controls =================
    const leftKeys = ["left", "a"];
    const rightKeys = ["right", "d"];
    const jumpKeys = ["space", "up", "w"];

    type TouchInput = { left: boolean; right: boolean; jumpReq: boolean; resetReq: boolean };
    const w = typeof window !== "undefined" ? (window as unknown as { __gameInput?: TouchInput }) : undefined;
    // Wipe anything left over from the previous run (a held D-pad button, a
    // queued jump/reset) so a restart always begins from a standstill.
    if (w?.__gameInput) {
      w.__gameInput.left = false;
      w.__gameInput.right = false;
      w.__gameInput.jumpReq = false;
      w.__gameInput.resetReq = false;
    }
    let leftArmed = false;
    let rightArmed = false;

    let currentZone = Math.min(ZONES.length - 1, Math.max(0, Math.floor(spawnX / BIOME_W)));
    opts.onSafeProgress?.(currentZone);
    // Start the run on this zone's tune (rotated for variety per run).
    setMusic(zoneMusic(currentZone));
    showStepScreen(currentZone);


    function tryJump() {
      if (player.dead || player.won) return;
      if (zoneState.cutscene) return;
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

    // ===== Feature-flag reconciliation =====
    // One place where a live toggle is applied to a run in progress. Called
    // once at boot, on every store change, and defensively each second.
    function applyFeatures() {
      if (playerMgr.reconcileLives(player)) updateHud();
      syncCheckpointMarkers();
      syncPowerUps();
      syncCompanion();
      updateHud();
    }
    unsubscribeFeatures?.();
    unsubscribeFeatures = FeatureFlags.subscribe(() => applyFeatures());
    applyFeatures();
    let lastFeatureSweep = 0;

    k.onUpdate(() => {
      if (w?.__gameInput?.resetReq) {
        w.__gameInput.resetReq = false;
        opts.onSafeProgress?.(0);
        checkpointMgr.clear();
        powerUps.reset();
        setMusic(zoneMusic(currentZone));
        k.go("trail", START_X(), 1);
        return;
      }
      // A step screen (or any other pause) freezes the whole simulation.
      if (isPaused()) return;
      if (player.dead || player.won) return;

      const now = k.time();

      // Defensive sweep (covers any missed store notification) + checkpoint save.
      if (now - lastFeatureSweep > 1) {
        lastFeatureSweep = now;
        applyFeatures();
        const grounded = player.isGrounded?.() || !!player.riding;
        const safe = grounded && now >= player.invulnUntil && !zoneState.cutscene;
        checkpointMgr.maybeSave(now, safe, buildCheckpoint);
      }


      const z = Math.min(ZONES.length - 1, Math.max(0, Math.floor(player.pos.x / BIOME_W)));
      if (z > player.farthestZone) player.farthestZone = z;
      if (z !== currentZone) {
        currentZone = z;
        opts.onSafeProgress?.(currentZone);
        if (!player.visitedZones.has(z)) {
          player.visitedZones.add(z);
          player.score += 1000;
        }
        // Interactive step briefing instead of a fading title card.
        showStepScreen(z, () => {
          // Start the wait clock only once the player has read the briefing.
          if (z === 5 && zoneState.waitStart === 0) zoneState.waitStart = k.time();
        });
        // Each zone gets its own tune; the boss arena overrides this itself.
        if (z !== 6) setMusic(zoneMusic(z));
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
        if (player.pos.y >= GROUND_Y) completeSlide();
      }

      // Backstop so the WIN overlay can never be blocked by a missed transition.
      if (
        zoneState.firePoleDone &&
        zoneState.cutscene &&
        zoneState.cutscenePhase !== "done" &&
        slideDoneAt > 0 &&
        k.time() - slideDoneAt > 4
      ) {
        zoneState.cutscenePhase = "done";
        zoneState.cutscene = false;
      }


      // Hint fade
      if (hintUntil > 0 && k.time() > hintUntil) {
        hintHud.opacity = Math.max(0, hintHud.opacity - k.dt() * 3);
        if (hintHud.opacity <= 0) hintUntil = 0;
      }

      // Winning: fire pole reached the base. Hold off during the walk-to-office
      // beat of the cutscene so the character actually arrives at the medical
      // office before the WIN overlay fires.
      if (
        zoneState.firePoleDone &&
        !player.won &&
        (!zoneState.cutscene || zoneState.cutscenePhase === "done")
      ) {
        tryWin();
      }


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
      if (zoneState.cutscene) {
        // Scripted finale — ignore all player input.
        if (zoneState.cutscenePhase === "walk-to-pole") {
          dir = 1;
          if (player.pos.x >= zoneState.cutscenePoleX) {
            player.pos.x = zoneState.cutscenePoleX;
            player.vel = k.vec2(0, 0);
            player.pos.y = zoneState.cutscenePoleTop + 6;
            zoneState.firePoleAttached = true;
            zoneState.cutscenePhase = "slide";
            const landing = zoneState.topLandingRef;
            if (landing) {
              try { landing.destroy(); } catch { /* ignore */ }
              zoneState.topLandingRef = null;
            }
            dir = 0;
          }
        } else if (zoneState.cutscenePhase === "walk-to-office") {
          dir = 1;
          if (player.pos.x >= zoneState.cutsceneTargetX) {
            player.pos.x = zoneState.cutsceneTargetX;
            zoneState.cutscenePhase = "done";
            zoneState.cutscene = false;
            dir = 0;
          }
        } else {
          dir = 0;
        }
      } else {
        // Fresh-input gate: a direction only counts once it has been released
        // at least one frame since this run started. Without it, a key or an
        // on-screen button still held when the scene restarts makes the hero
        // auto-run the moment the new run begins.
        let rawLeft = false;
        let rawRight = false;
        for (const key of leftKeys) if (k.isKeyDown(key as never)) rawLeft = true;
        for (const key of rightKeys) if (k.isKeyDown(key as never)) rawRight = true;
        if (w?.__gameInput?.left) rawLeft = true;
        if (w?.__gameInput?.right) rawRight = true;
        if (!rawLeft) leftArmed = true;
        if (!rawRight) rightArmed = true;
        if (rawLeft && leftArmed) dir -= 1;
        if (rawRight && rightArmed) dir += 1;
        dir = Math.sign(dir);
      }

      player.move(dir * MOVE_SPEED, 0);
      if (dir > 0 && !zoneState.cutscene) player.score += 1;

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
      }
      // Fire-pole slide takes over the sprite until the base is reached.
      if (zoneState.firePoleAttached && !zoneState.firePoleDone) {
        setAnim("slide");
        player.animTick += k.dt();
        const nextFrame = Math.floor(player.animTick * 6) % 2;
        if (player.slideFrame !== nextFrame) {
          player.slideFrame = nextFrame;
          setSprite(`hero-slide-${nextFrame}`);
        }
      } else if (!groundedNow) {
        setAnim("jump");
        // Re-apply facing-correct sprite if facing changed mid-air.
        const want = `hero-jump${facingSuffix("hero-jump")}`;
        setSprite(want);
      } else if (dir !== 0) {
        setAnim("walk");
        // Contact / passing / contact / passing at a 12px stride so the run
        // reads as steps, not a glide.
        const CYCLE = [0, 1, 2, 3];
        const STRIDE_PX = 12;
        const idx = Math.floor(Math.abs(player.pos.x) / STRIDE_PX) % CYCLE.length;
        const target = CYCLE[idx];
        const want = `hero-walk-${target}${facingSuffix(`hero-walk-${target}`)}`;
        if (player.walkFrame !== target || player.animState !== "walk") {
          player.walkFrame = target;
          setSprite(want);
        }
        // Footfall weight: 2px squash on contact frames. Anchor is "bot" and the
        // area rect is explicit, so this is purely visual.
        const baseH = DISPLAY_H[`hero-walk-${target}`] ?? player.height;
        player.height = baseH - (idx % 2 === 0 ? 2 : 0);
      } else {
        setAnim("idle");
        // Ensure facing-correct idle sprite on facing flip while stationary.
        setSprite(`hero-idle${facingSuffix("hero-idle")}`);
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
      const camX = Math.max(VIEW_W / 2, Math.min(player.pos.x, LEVEL_END - VIEW_W / 2));
      k.setCamPos(px(camX), px(LOGICAL_H / 2));

    });

    for (const key of jumpKeys) k.onKeyPress(key as never, () => tryJump());
    k.onKeyPress("r", () => {
      // While the win sequence is playing the player must watch the
      // thank-you cutscene before restarting.
      if (player.won) return;
      k.go("trail", START_X(), 1);
    });


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
      // Record foot Y for next-frame stomp geometry (boss/other overhead checks).
      (p as AnyObj).lastY = player.pos.y;
    });


    k.onUpdate(() => {
      if (!player.dead) updateHud();
    });
  });

  // ================= Thank-you cutscene =================
  // Plays 5s after the WIN overlay. Close-up of the hero thanking the player,
  // with the 16-bit MESC 2026 conference badge. Only exit is "try again".
  k.scene("thanks", () => {
    const W = k.width();
    const H = k.height();

    // Doctor's-office backdrop (16-bit interior with a Portland skyline window).
    // Scaled to COVER the canvas so no gaps appear at any aspect ratio.
    const BG_W = 1280;
    const BG_H = 427;
    const bgScale = Math.max(W / BG_W, H / BG_H);
    k.add([
      k.sprite("bg-thanks", { width: BG_W * bgScale, height: BG_H * bgScale }),
      k.pos(W / 2, H / 2),
      k.anchor("center"),
      k.fixed(),
      k.z(0),
    ]);

    const MSG =
      "Thanks for blazing the trail with me!\nEvery idea you share makes the next journey a little less bumpy.\n\nIf this ride made you smile, vote for our poster session!\n\nHave a great time at MESC 2026!";

    // The canvas can be cropped top/bottom when the CSS box is wider than the
    // logical 16:9 buffer, so keep everything inside a vertical safe inset.
    const SAFE_Y = Math.round(H * 0.1);
    // --- Speech bubble: measure the real rendered text, then size the panel. ---
    const bw = Math.min(560, W - 40);
    const padX = 16;
    const padY = 14;
    const by = SAFE_Y;
    // Reserve room under the bubble for the logo stack + prompt.
    const maxBubbleH = Math.max(90, H - by - SAFE_Y - 130);

    let msg: AnyObj | null = null;
    let bh = 0;
    for (const size of [17, 16, 15, 14, 13, 12, 11, 10]) {
      const t = k.add([
        k.text(MSG, {
          size,
          font: "sans-serif",
          width: bw - padX * 2,
          align: "center",
          lineSpacing: 3,
        }),
        k.pos(-9999, -9999),
        k.anchor("center"),
        k.color(24, 32, 68),
        k.fixed(),
        k.z(10),
      ]) as AnyObj;
      const h = (t.height as number) || 0;
      if (h + padY * 2 <= maxBubbleH || size === 10) {
        msg = t;
        bh = Math.ceil(h + padY * 2);
        break;
      }
      k.destroy(t as never);
    }
    bh = Math.min(bh, maxBubbleH);
    const bx = Math.floor(W / 2 - bw / 2);
    k.add([k.rect(bw + 8, bh + 8), k.pos(bx - 4, by - 4), k.color(0, 0, 0), k.fixed(), k.z(8)]);
    k.add([k.rect(bw, bh), k.pos(bx, by), k.color(252, 250, 235), k.fixed(), k.z(9)]);
    if (msg) msg.pos = k.vec2(Math.floor(W / 2), by + Math.floor(bh / 2));
    // Bubble tail pointing down toward the hero.
    k.add([
      k.rect(22, 16),
      k.pos(Math.floor(W * 0.30), by + bh - 1),
      k.color(252, 250, 235),
      k.outline(3, k.rgb(0, 0, 0)),
      k.fixed(),
      k.z(9),
    ]);

    // Hero portrait, bottom-left (sized to whatever space is left under bubble).
    const bottomLimit = H - SAFE_Y - 26;
    const heroTop = by + bh + 8;
    const portraitH = Math.max(80, Math.min(240, bottomLimit - heroTop));
    k.add([
      k.sprite("hero-portrait", { width: portraitH, height: portraitH }),
      k.pos(Math.floor(W * 0.22), bottomLimit),
      k.anchor("bot"),
      k.fixed(),
      k.z(5),
    ]);

    // Conference badge + MN DHS badge, stacked BELOW the speech bubble on the
    // right so they are never clipped, on opaque backing plates.
    const logoTop = by + bh + 12;
    const logoBottom = bottomLimit;
    const availH = Math.max(50, logoBottom - logoTop);

    const dhsW = Math.floor(Math.min(W * 0.34, 300));
    const dhsH = Math.max(20, Math.floor(dhsW * 0.148));
    const logoS = Math.floor(Math.min(140, Math.max(44, availH - dhsH - 18)));
    const badgeX = Math.floor(W - Math.max(logoS, dhsW) / 2 - 18);
    const stackH = logoS + dhsH + 14;
    const stackTop = logoTop + Math.max(0, Math.floor((availH - stackH) / 2));
    const mescY = stackTop + Math.floor(logoS / 2);
    const dhsY = mescY + Math.floor(logoS / 2) + Math.floor(dhsH / 2) + 12;
    k.add([
      k.rect(logoS + 8, logoS + 8),
      k.pos(badgeX, mescY),
      k.anchor("center"),
      k.color(12, 18, 44),
      k.fixed(),
      k.z(4),
    ]);
    k.add([
      k.sprite("mesc-logo-16bit", { width: logoS, height: logoS }),
      k.pos(badgeX, mescY),
      k.anchor("center"),
      k.fixed(),
      k.z(5),
    ]);
    k.add([
      k.rect(dhsW + 8, dhsH + 8),
      k.pos(badgeX, dhsY),
      k.anchor("center"),
      k.color(12, 18, 44),
      k.opacity(1),
      k.fixed(),
      k.z(4),
    ]);
    k.add([
      k.sprite("dhs-logo-16bit", { width: dhsW, height: dhsH }),
      k.pos(badgeX, dhsY),
      k.anchor("center"),
      k.opacity(1),
      k.fixed(),
      k.z(5),
    ]);



    // Blinking restart prompt.
    const prompt = k.add([
      k.text(isCoarsePointer() ? "Tap Anywhere to Continue" : "Press Enter, Space, or Click to Continue", { size: 16, font: "sans-serif" }),
      k.pos(Math.floor(W / 2), H - SAFE_Y - 6),
      k.anchor("center"),
      k.color(255, 235, 120),
      k.opacity(1),
      k.fixed(),
      k.z(12),
    ]);
    const winReset =
      typeof window !== "undefined"
        ? (window as unknown as { __gameInput?: { left: boolean; right: boolean; jumpReq: boolean; resetReq: boolean } })
        : undefined;
    // Any input held when the run ended must not carry into the next run.
    if (winReset?.__gameInput) {
      winReset.__gameInput.left = false;
      winReset.__gameInput.right = false;
      winReset.__gameInput.jumpReq = false;
      winReset.__gameInput.resetReq = false;
    }
    k.onUpdate(() => {
      (prompt as AnyObj).opacity = Math.floor(k.time() * 2) % 2 === 0 ? 1 : 0.15;
      if (winReset?.__gameInput?.resetReq) {
        winReset.__gameInput.resetReq = false;
        k.go("trail", START_X(), 1);
      }
    });


    const hit = k.add([
      k.rect(W, H),
      k.pos(0, 0),
      k.opacity(0),
      k.area(),
      k.fixed(),
      k.z(20),
    ]);
    hit.onClick(() => k.go("trail", START_X(), 1));
    for (const key of ["r", "space", "enter"]) {
      k.onKeyPress(key as never, () => k.go("trail", START_X(), 1));
    }

  });

  const resumeZone = Math.min(
    ZONES.length - 1,
    Math.max(0, Math.floor(opts.resumeZone ?? 0)),
  );
  k.go("trail", resumeZone * BIOME_W + START_X(), 1);


  return () => {
    try {
      unsubscribeFeatures?.();
      unsubscribeFeatures = null;
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
  const T = UI_TEXT_SCALE;
  const badgeSize = Math.round(10 * T);
  const labelSize = Math.round(11 * T);
  const w = Math.max(96 * T, label.length * 6 * T + 20);
  const badgeH = Math.round(16 * T);
  const labelH = Math.round(18 * T);
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
  const badgeTextY = cy - totalH / 2 + badgeH / 2 + 1;
  k.add([
    k.text(badge, { size: badgeSize, font: "sans-serif" }),
    k.pos(x + 1, badgeTextY + 1),
    k.anchor("center"),
    k.color(0, 0, 0),
    k.z(LAYERS.EFFECT + 1),
  ]);
  k.add([
    k.text(badge, { size: badgeSize, font: "sans-serif" }),
    k.pos(x, badgeTextY),
    k.anchor("center"),
    k.color(255, 235, 150),
    k.z(LAYERS.EFFECT + 2),
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
  const labelTextY = cy + totalH / 2 - labelH / 2 + 1;
  k.add([
    k.text(label, { size: labelSize, font: "sans-serif" }),
    k.pos(x + 1, labelTextY + 1),
    k.anchor("center"),
    k.color(255, 240, 220),
    k.z(LAYERS.EFFECT + 1),
  ]);
  k.add([
    k.text(label, { size: labelSize, font: "sans-serif" }),
    k.pos(x, labelTextY),
    k.anchor("center"),
    k.color(30, 20, 10),
    k.z(LAYERS.EFFECT + 2),
  ]);
}

function addSpeech(
  k: Ctx,
  x: number,
  y: number,
  text: string,
  _rgb: [number, number, number],
) {
  // High-contrast world label: dark plaque behind gold text with 1-px shadow.
  // (rgb argument ignored — standardized on gold-on-navy for legibility.)
  const size = Math.round(16 * UI_TEXT_SCALE);
  const charW = size * 0.62;
  const w = Math.max(72, Math.ceil(text.length * charW) + 22);
  const h = size + 16;
  k.add([
    k.rect(w, h, { radius: 3 }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(10, 14, 32),
    k.outline(3, k.rgb(255, 220, 90)),
    k.opacity(1),
    k.z(LAYERS.EFFECT),
  ]);
  k.add([
    k.text(text, { size, font: "sans-serif", align: "center" }),
    k.pos(x + 1, y + 1),
    k.anchor("center"),
    k.color(0, 0, 0),
    k.z(LAYERS.EFFECT + 1),
  ]);
  k.add([
    k.text(text, { size, font: "sans-serif", align: "center" }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(255, 220, 90),
    k.z(LAYERS.EFFECT + 2),
  ]);
}

/** Floating pixel-art thought bubble drawn in the sky. Purely decorative —
 *  no collision, no gameplay effect. Uses BG_NEAR layer so it sits between
 *  the biome painting and gameplay elements. */
function spawnThoughtBubble(k: Ctx, x: number, y: number, text: string) {
  const size = 12;
  const charW = size * 0.62;
  const w = Math.max(96, Math.ceil(text.length * charW) + 22);
  const h = size + 14;
  const bg = k.add([
    k.rect(w, h, { radius: 8 }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(255, 255, 255),
    k.outline(3, k.rgb(30, 45, 90)),
    k.opacity(1),
    k.z(LAYERS.BG_NEAR + 1),
  ]);
  const tail = k.add([
    k.circle(4),
    k.pos(x - 6, y + h / 2 + 4),
    k.color(255, 255, 255),
    k.outline(3, k.rgb(30, 45, 90)),
    k.opacity(1),
    k.z(LAYERS.BG_NEAR + 1),
  ]);
  const shadow = k.add([
    k.text(text, { size, font: "sans-serif" }),
    k.pos(x + 1, y + 1),
    k.anchor("center"),
    k.color(0, 0, 0),
    k.opacity(0.35),
    k.z(LAYERS.BG_NEAR + 2),
  ]);
  const t = k.add([
    k.text(text, { size, font: "sans-serif" }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(30, 45, 90),
    k.z(LAYERS.BG_NEAR + 3),
  ]);
  const base = y;
  const phase = Math.random() * Math.PI * 2;
  k.onUpdate(() => {
    const dy = Math.sin(k.time() * 1.3 + phase) * 4;
    bg.pos.y = base + dy;
    t.pos.y = base + dy;
    shadow.pos.y = base + dy + 1;
    tail.pos.y = base + dy + h / 2 + 4;
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
