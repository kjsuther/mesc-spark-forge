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
import { FeatureFlags } from "@/lib/game-features";
import { t as tr } from "@/lib/i18n";
import { computeFinalScore, zoneSpeedBonus } from "@/lib/game-score";
import { pumpGamepadInput } from "@/lib/gamepad";

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
import {
  continuePrompt,
  isTouchDevice,
  jumpPrompt,
  readyPrompt,
  restartPrompt,
} from "@/lib/device";
import charSheetUrl from "@/assets/game/character-sheet.webp";
import heroSlideSheetUrl from "@/assets/game/hero-slide-sheet.webp";
import propsSheetUrl from "@/assets/game/props-sheet.webp";
import propsSheet2Url from "@/assets/game/props-sheet-2.webp";
import bgForestUrl from "@/assets/game/bg-forest.webp";
import bgSignupUrl from "@/assets/game/bg-signup.webp";
import bgRiverUrl from "@/assets/game/bg-river.webp";
import bgTownUrl from "@/assets/game/bg-town.webp";
import bgRelayUrl from "@/assets/game/bg-relay.webp";
import bgMountainUrl from "@/assets/game/bg-mountain.webp";
import bgMarketUrl from "@/assets/game/bg-market.webp";
import bgClinicUrl from "@/assets/game/bg-clinic.webp";
import bgThanksUrl from "@/assets/game/bg-thankyou-office.webp";
import bgBonusUrl from "@/assets/game/bg-bonus-portland.webp";
import doorSheetUrl from "@/assets/game/door-sheet.webp";
import credentialsSheetUrl from "@/assets/game/credentials-sheet.webp";
import goldKeyUrl from "@/assets/game/gold-key.webp";
import planCardsSheetUrl from "@/assets/game/plan-cards-sheet.webp";
import medicalIdUrl from "@/assets/game/medical-id.webp";
import calendarPageUrl from "@/assets/game/calendar-page.webp";
import paperAirplaneUrl from "@/assets/game/paper-airplane.webp";
import brickBlockSheetUrl from "@/assets/game/brick-block-sheet.webp";
import envelopeGremlinSheetUrl from "@/assets/game/envelope-gremlin-sheet.webp";
import bossSheetUrl from "@/assets/game/boss-sheet.webp";
import bearScoutSheetUrl from "@/assets/game/bear-scout-sheet.webp";
import bearPosesSheetUrl from "@/assets/game/bear-poses-sheet.webp";
import doorLockUrl from "@/assets/game/door-lock.webp";
import heroPortraitUrl from "@/assets/game/hero-portrait.webp";
import heroSittingUrl from "@/assets/game/hero-sitting.webp";
import rangerGuideUrl from "@/assets/game/ranger-guide.webp";
import heroSadUrl from "@/assets/game/hero-sad.webp";
import mescLogo16Url from "@/assets/game/mesc-2026-logo-16bit.webp";
import dhsLogo16Url from "@/assets/game/mn-dhs-logo-16bit.webp";

import docIdAsset from "@/assets/game/doc-id.png.asset.json";
import { ZONE_THEMES, type MusicTheme } from "@/lib/game-music";
import { playSfx } from "@/lib/game-sfx";
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
  farthestZone: number; // 0..7
  won: boolean;
  score: number;
  distancePx: number;
  jumpsLanded: number;
  enemiesPassed: number;
  deaths: number;
  /** Total speed bonus banked from clearing zones under par. */
  timeBonus?: number;
  /** Per-zone split times in ms (0 = zone never cleared). */
  zoneSplitsMs?: number[];
};

/**
 * Everything needed to resume a run exactly where it stood after the browser
 * throws away the WebGL context (iOS Safari does this aggressively when the
 * tab is backgrounded). Without the elapsed clock and banked score, a resumed
 * run would report an artificially fast finish.
 */
export type RunSnapshot = {
  /** Unix ms when the snapshot was taken — used to reject stale resumes. */
  savedAt: number;
  zone: number;
  elapsedMs: number;
  score: number;
  timeBonus: number;
  lives: number;
  maxLives: number;
  docs: string[];
  deaths: number;
  distancePx: number;
  jumpsLanded: number;
  enemiesPassed: number;
  farthestZone: number;
  zoneSplitsMs: number[];
};

export type StartGameOpts = {
  canvas: HTMLCanvasElement;
  flags: GameFlags;
  /** Stage to resume after the browser has discarded the canvas context. */
  resumeZone?: number;
  /** Full run state to restore after a context loss. */
  resumeSnapshot?: RunSnapshot | null;
  /** Reports durable stage progress to the React host. */
  onSafeProgress?: (zone: number) => void;
  /** Reports the full run state so a recovery can restore it. */
  onSnapshot?: (snapshot: RunSnapshot | null) => void;
  onWin?: (result: WinResult) => void;
  onLose?: (result: WinResult) => void;
  /** Lets the scene ask the host for a different music theme. */
  onMusicTheme?: (theme: MusicTheme) => void;
  /** Attract mode: the hero plays himself, can't die, and nothing is scored. */
  demo?: boolean;
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
  // Exact device-pixel match — no half-step rounding. Rounding used to leave
  // the buffer slightly under (or over) the real on-screen size, and the
  // leftover fractional upscale is what made glyph edges chunky.
  const need = (cssW * Math.min(dpr, 2)) / logicalW;
  return Math.max(1, Math.min(PIXEL_DENSITY_MAX, need));
}

/** Snap any world coordinate or computed sprite dimension to an integer.
 *  Using `floor` (not `round`) is deterministic across renders: a value of
 *  N.4999 and N.5001 both collapse to N, so a sub-pixel jitter can never
 *  toggle a sprite between two adjacent integer positions. */
const px = (n: number): number => Math.floor(n);

/**
 * How much to enlarge UI type so it keeps a constant PHYSICAL size no matter
 * how small the canvas is drawn on screen. The engine renders into a fixed
 * logical buffer, so a canvas displayed at half its logical width halves every
 * glyph. Multiplying font sizes by (logical width / CSS width) cancels that
 * out, which is what makes briefing text readable when the player is NOT in
 * fullscreen. Clamped so the panel can never outgrow the screen.
 */
let UI_TEXT_SCALE = 1;
function computeUiTextScale(canvas: HTMLCanvasElement | null, logicalW: number): number {
  const cssW = canvas?.getBoundingClientRect().width || 0;
  const shrink = cssW > 0 ? logicalW / cssW : 1;
  const wide = logicalW / LOGICAL_W;
  return Math.max(1, Math.min(2.4, Math.max(wide, shrink)));
}

/**
 * Text scale for a panel of a known design size.
 *
 * `computeUiTextScale` alone answers "how much bigger must type be to stay
 * physically readable in a small CSS box?" — but the panel that holds the type
 * lives in the FIXED logical buffer and cannot grow past it. Enlarging text
 * without capping it to the panel is exactly what pushed headings, captions,
 * and the continue prompt outside the card in windowed play. Clamping the
 * scale by how much room the buffer actually has keeps every screen legible
 * AND inside its panel at any window size, windowed or fullscreen.
 */
function computeFittedUiScale(
  canvas: HTMLCanvasElement | null,
  W: number,
  H: number,
  baseW: number,
  baseH: number,
  marginW = 32,
  marginH = 20,
): number {
  const raw = computeUiTextScale(canvas, W);
  return Math.max(1, Math.min(raw, (W - marginW) / baseW, (H - marginH) / baseH));
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
const START_X = (): number => (isCoarsePointer() ? 40 + Math.round(VIEW_W * 0.18) : 40);

/** Touch-first device? Single shared detector (see src/lib/device.ts). */
const isCoarsePointer = isTouchDevice;

/** One shared continue prompt string for every paused screen. */
const CONTINUE_PROMPT = continuePrompt;

const BIOME_W = 1200;

const ZONES = [
  {
    key: "forest",
    label: "Finding the Trail",
    phase: "Step 1 · Learn you may qualify",
    bg: "bg-forest",
    ground: [80, 130, 60] as [number, number, number],
    soil: [70, 45, 25] as [number, number, number],
  },
  {
    key: "signup",
    label: "Setting Up Camp",
    phase: "Step 2 · Create your account",
    bg: "bg-signup",
    ground: [95, 115, 70] as [number, number, number],
    soil: [60, 45, 30] as [number, number, number],
  },
  {
    key: "river",
    label: "Crossing River of Paperwork",
    phase: "Step 3 · Start your application",
    bg: "bg-river",
    ground: [180, 160, 110] as [number, number, number],
    soil: [120, 90, 50] as [number, number, number],
  },
  {
    key: "town",
    label: "Gathering Supplies",
    phase: "Step 4 · Gather your documents",
    bg: "bg-town",
    ground: [140, 140, 150] as [number, number, number],
    soil: [80, 80, 90] as [number, number, number],
  },
  {
    key: "relay",
    label: "Answering the Call",
    phase: "Step 5 · Respond to requests for info",
    bg: "bg-relay",
    ground: [140, 170, 90] as [number, number, number],
    soil: [90, 70, 40] as [number, number, number],
  },
  {
    key: "mountain",
    label: "Waiting Mountain",
    phase: "Step 6 · Await a decision",
    bg: "bg-mountain",
    ground: [130, 120, 110] as [number, number, number],
    soil: [70, 60, 55] as [number, number, number],
  },
  {
    key: "market",
    label: "Choosing Your Path",
    phase: "Step 7 · Choose a health plan",
    bg: "bg-market",
    ground: [150, 180, 100] as [number, number, number],
    soil: [90, 65, 40] as [number, number, number],
  },
  {
    key: "clinic",
    label: "Coverage Begins",
    phase: "Step 8 · Enroll in coverage",
    bg: "bg-clinic",
    ground: [220, 220, 225] as [number, number, number],
    soil: [140, 145, 155] as [number, number, number],
  },
] as const;

const GROUND_Y = 470;
const LEVEL_END = ZONES.length * BIOME_W;
const MOVE_SPEED = 260;
const JUMP_VEL = 720;
// Mid-air second jump: a boost, not flight — slightly weaker than the launch.
const AIR_JUMP_VEL = Math.round(720 * 0.85);
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
  1: ["You need an account before you can apply online.", "Set up your login and try again."],
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
  5: ["Your application is still under review.", "Stay on the trail — you're almost there."],
  6: [
    "You need to pick a health plan to continue.",
    "Choose the plan that best fits your household.",
  ],
  7: ["One final step remains before coverage begins.", "Don't stop now — you're almost enrolled!"],
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
  "bear-scout-walk-0": 54,
  "bear-scout-walk-1": 54,
  "bear-scout-look": 54,
  "bear-scout-sniff": 58,
  "bear-pose-limb": 54,
  "bear-pose-drink": 54,
  "bear-pose-rear": 54,
  "bear-pose-peek": 54,
  "bear-pose-lean": 54,
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
  sheets: Record<
    string,
    { url: string; cols: number; rows: number; status: AssetStatus; error?: string; label: string }
  >;
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
  6: [
    "bg-market",
    "plan-blue",
    "plan-green",
    "plan-orange",
    "gold-key",
    "plan-card",
    "insurance-card",
    "door-closed",
    "door-open",
  ],
  7: [
    "bg-clinic",
    "medical-id",
    "door-closed",
    "door-open",
    "ranger",
    "campfire",
    "backpack",
    "map",
  ],
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
/**
 * Processed frames survive engine restarts (recovery, play-again). Trimming a
 * sheet means decoding it into a canvas and walking every pixel, which is the
 * single most memory-hungry thing the game does on an iPhone — doing it once
 * per page instead of once per run keeps Safari from reaping the tab.
 */
const FRAME_CACHE = new Map<string, { dataUrl: string; w: number; h: number }>();

/**
 * Family name used for every piece of in-canvas text.
 *
 * The engine keeps its rasterised glyph atlas in a module-level cache keyed by
 * family name, and that cache OUTLIVES an engine restart — so a second run
 * would sample a texture belonging to the previous, already-destroyed graphics
 * context and draw every label as a solid black block. Booting under a fresh
 * (still sans-serif) family name forces a clean atlas for each run. The
 * leading alias never resolves, so the text always falls back to sans-serif.
 */
let UI_FONT = "sans-serif";
let bootCount = 0;
function nextUiFont(): string {
  bootCount += 1;
  return bootCount === 1 ? "sans-serif" : `kbrun${bootCount}, sans-serif`;
}

async function loadTrimmedSheet(k: Ctx, spec: SheetSpec): Promise<SpriteSizes> {
  const label0 = spec.label ?? spec.url.split("/").pop() ?? spec.url;
  // Fully cached sheet: register the stored frames and skip decoding entirely.
  if (spec.frames.every((f) => FRAME_CACHE.has(`${spec.url}#${f.name}`))) {
    const cachedSizes: SpriteSizes = {};
    for (const f of spec.frames) {
      const hit = FRAME_CACHE.get(`${spec.url}#${f.name}`)!;
      await k.loadSprite(f.name, hit.dataUrl);
      cachedSizes[f.name] = { w: hit.w, h: hit.h };
      ASSET_REPORT.entries[f.name] = {
        name: f.name,
        kind: "sprite",
        sheetLabel: label0,
        sheetUrl: spec.url,
        cols: spec.cols,
        rows: spec.rows,
        frame: f.frame,
        unified: { w: hit.w, h: hit.h },
        status: "loaded",
      };
    }
    return cachedSizes;
  }

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
    ox.drawImage(img, cc * fw + bb.x, rr * fh + bb.y, bb.w, bb.h, dx, dy, bb.w, bb.h);

    const dataUrl = out.toDataURL("image/png");
    FRAME_CACHE.set(`${spec.url}#${f.name}`, { dataUrl, w: unifiedW, h: unifiedH });
    await k.loadSprite(f.name, dataUrl);
    sizes[f.name] = { w: unifiedW, h: unifiedH };
    // Release the scratch canvas: iOS counts every backing store against the
    // tab's memory budget even after the JS handle goes out of scope.
    out.width = 0;
    out.height = 0;
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
  src.width = 0;
  src.height = 0;
  img.src = "";
  return sizes;
}

/** Wrap loadTrimmedSheet with fallback: on any error, register 16x16 magenta
 *  placeholders for every frame and record the failure in the asset report. */
async function safeLoadSheet(k: Ctx, spec: SheetSpec): Promise<SpriteSizes> {
  const label = spec.label ?? spec.url.split("/").pop() ?? spec.url;
  try {
    const sizes = await loadTrimmedSheet(k, spec);
    ASSET_REPORT.sheets[label] = {
      url: spec.url,
      cols: spec.cols,
      rows: spec.rows,
      status: "loaded",
      label,
    };
    return sizes;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ASSET_REPORT.sheets[label] = {
      url: spec.url,
      cols: spec.cols,
      rows: spec.rows,
      status: "failed",
      error: msg,
      label,
    };
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
    } catch {
      /* ignore */
    }
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
    { name: "laptop", frame: 0 },
    { name: "padlock", frame: 1 },
    { name: "phone", frame: 2 },
    { name: "mailbox", frame: 3 },
    { name: "plan-card", frame: 4 },
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
  // Zone 2 background cameo: the boss bear roaming the campground, searching.
  const bearScoutFrames: FrameSpec[] = [
    { name: "bear-scout-walk-0", frame: 0 },
    { name: "bear-scout-walk-1", frame: 1 },
    { name: "bear-scout-look", frame: 2 },
    { name: "bear-scout-sniff", frame: 3 },
  ];
  // Per-zone background sighting poses (one distinct pose per zone 1-6).
  const bearPoseFrames: FrameSpec[] = [
    { name: "bear-pose-limb", frame: 0 },
    { name: "bear-pose-drink", frame: 1 },
    { name: "bear-pose-rear", frame: 2 },
    { name: "bear-pose-peek", frame: 3 },
    { name: "bear-pose-lean", frame: 4 },
  ];

  const [
    heroSizes,
    slideSizes,
    propSizes,
    propSizes2,
    doorSizes,
    credSizes,
    keySizes,
    planSizes,
    idSizes,
    calSizes,
    airSizes,
    brickSizes,
    gremlinSizes,
    bossSizes,
    bearScoutSizes,
    bearPoseSizes,
    lockSizes,
    docIdSizes,
    docPaystubSizes,
    docEnvelopeSizes,
    formMonsterSizes,
  ] = await Promise.all([
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
    safeLoadSheet(k, {
      url: propsSheetUrl,
      cols: 4,
      rows: 3,
      frames: propFrames,
      label: "props-sheet.png",
    }),
    safeLoadSheet(k, {
      url: propsSheet2Url,
      cols: 3,
      rows: 2,
      frames: propFrames2,
      label: "props-sheet-2.png",
    }),
    safeLoadSheet(k, {
      url: doorSheetUrl,
      cols: 2,
      rows: 1,
      frames: doorFrames,
      label: "door-sheet.png",
    }),
    safeLoadSheet(k, {
      url: credentialsSheetUrl,
      cols: 2,
      rows: 1,
      frames: credFrames,
      label: "credentials-sheet.png",
    }),
    safeLoadSheet(k, {
      url: goldKeyUrl,
      cols: 1,
      rows: 1,
      frames: keyFrames,
      label: "gold-key.png",
    }),
    safeLoadSheet(k, {
      url: planCardsSheetUrl,
      cols: 3,
      rows: 1,
      frames: planFrames,
      label: "plan-cards-sheet.png",
    }),
    safeLoadSheet(k, {
      url: medicalIdUrl,
      cols: 1,
      rows: 1,
      frames: idFrames,
      label: "medical-id.png",
    }),
    safeLoadSheet(k, {
      url: calendarPageUrl,
      cols: 1,
      rows: 1,
      frames: calendarFrames,
      label: "calendar-page.png",
    }),
    safeLoadSheet(k, {
      url: paperAirplaneUrl,
      cols: 1,
      rows: 1,
      frames: airplaneFrames,
      label: "paper-airplane.png",
    }),
    safeLoadSheet(k, {
      url: brickBlockSheetUrl,
      cols: 2,
      rows: 1,
      frames: brickFrames,
      groups: [brickFrames.map((f) => f.name)],
      label: "brick-block-sheet.png",
    }),
    safeLoadSheet(k, {
      url: envelopeGremlinSheetUrl,
      cols: 2,
      rows: 1,
      frames: gremlinFrames,
      groups: [gremlinFrames.map((f) => f.name)],
      label: "envelope-gremlin-sheet.png",
    }),
    safeLoadSheet(k, {
      url: bossSheetUrl,
      cols: 3,
      rows: 1,
      frames: bossFrames,
      label: "boss-sheet.png",
    }),
    safeLoadSheet(k, {
      url: bearScoutSheetUrl,
      cols: 4,
      rows: 1,
      frames: bearScoutFrames,
      groups: [bearScoutFrames.map((f) => f.name)],
      label: "bear-scout-sheet.png",
    }),
    safeLoadSheet(k, {
      url: bearPosesSheetUrl,
      cols: 5,
      rows: 1,
      frames: bearPoseFrames,
      groups: [bearPoseFrames.map((f) => f.name)],
      label: "bear-poses-sheet.png",
    }),
    safeLoadSheet(k, {
      url: doorLockUrl,
      cols: 1,
      rows: 1,
      frames: lockFrames,
      label: "door-lock.png",
    }),
    safeLoadSheet(k, { url: docIdUrl, cols: 1, rows: 1, frames: docIdFrames, label: "doc-id.png" }),
    safeLoadSheet(k, {
      url: docPaystubUrl,
      cols: 1,
      rows: 1,
      frames: docPaystubFrames,
      label: "doc-paystub.png",
    }),
    safeLoadSheet(k, {
      url: docEnvelopeUrl,
      cols: 1,
      rows: 1,
      frames: docEnvelopeFrames,
      label: "doc-envelope.png",
    }),
    safeLoadSheet(k, {
      url: formMonsterV2Url,
      cols: 1,
      rows: 1,
      frames: formMonsterFrames,
      label: "form-monster-v2.png",
    }),
  ]);

  // Register horizontally-mirrored copies of the hero walk/idle/jump frames
  // so the character has a true set of left-facing sprites (rather than
  // relying on render-time flipX, which can subtly misalign the hitbox
  // against decorative asymmetric details).
  const leftSizes = await registerLeftMirrors(
    k,
    heroFrames.map((f) => f.name),
    heroSizes,
  );

  // Backgrounds don't need trimming but still get load-status tracking + a
  // magenta fallback so a missing PNG doesn't crash the scene.
  await Promise.all([
    safeLoadBackground(k, "bg-forest", bgForestUrl),
    safeLoadBackground(k, "bg-signup", bgSignupUrl),
    safeLoadBackground(k, "bg-river", bgRiverUrl),
    safeLoadBackground(k, "bg-town", bgTownUrl),
    safeLoadBackground(k, "bg-relay", bgRelayUrl),
    safeLoadBackground(k, "bg-mountain", bgMountainUrl),
    safeLoadBackground(k, "bg-market", bgMarketUrl),
    safeLoadBackground(k, "bg-clinic", bgClinicUrl),
    safeLoadBackground(k, "bg-thanks", bgThanksUrl),
    safeLoadBackground(k, "bg-bonus", bgBonusUrl),
    safeLoadBackground(k, "hero-portrait", heroPortraitUrl),
    safeLoadBackground(k, "hero-sitting", heroSittingUrl),
    safeLoadBackground(k, "ranger-guide", rangerGuideUrl),
    safeLoadBackground(k, "hero-sad", heroSadUrl),
    safeLoadBackground(k, "mesc-logo-16bit", mescLogo16Url),
    safeLoadBackground(k, "dhs-logo-16bit", dhsLogo16Url),
  ]);

  ASSET_REPORT.ready = true;
  if (typeof window !== "undefined") {
    (window as unknown as { __gameAssetReport?: AssetReport }).__gameAssetReport = ASSET_REPORT;
  }

  return {
    ...heroSizes,
    ...slideSizes,
    ...leftSizes,
    ...propSizes,
    ...propSizes2,
    ...doorSizes,
    ...credSizes,
    ...keySizes,
    ...planSizes,
    ...idSizes,
    ...calSizes,
    ...airSizes,
    ...brickSizes,
    ...gremlinSizes,
    ...bossSizes,
    ...bearScoutSizes,
    ...bearPoseSizes,
    ...lockSizes,
    ...docIdSizes,
    ...docPaystubSizes,
    ...docEnvelopeSizes,
    ...formMonsterSizes,
  };
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
  // already recorded on ASSET_REPORT.entries. One scratch canvas is reused for
  // every frame: mobile Safari is far more likely to fail (or return a blank
  // bitmap) when a handful of canvases are allocated back to back.
  const cvs = document.createElement("canvas");
  const cx = cvs.getContext("2d");
  if (!cx) return out;
  const sheetCache = new Map<string, HTMLImageElement>();
  const objectUrls: string[] = [];

  const encode = (canvas: HTMLCanvasElement): Promise<string> =>
    new Promise((resolve) => {
      try {
        if (typeof canvas.toBlob === "function") {
          canvas.toBlob((blob) => {
            if (!blob) {
              resolve(canvas.toDataURL("image/png"));
              return;
            }
            const url = URL.createObjectURL(blob);
            objectUrls.push(url);
            resolve(url);
          }, "image/png");
          return;
        }
      } catch {
        /* fall through to data URL */
      }
      resolve(canvas.toDataURL("image/png"));
    });

  for (const name of names) {
    const entry = ASSET_REPORT.entries[name];
    const src = sizes[name];
    if (!entry || !entry.sheetUrl || !entry.sheetRect || !entry.trimBBox || !src) continue;
    try {
      let img = sheetCache.get(entry.sheetUrl);
      if (!img) {
        img = await loadImageEl(entry.sheetUrl);
        sheetCache.set(entry.sheetUrl, img);
      }
      const { fx, fy } = entry.sheetRect;
      const bb = entry.trimBBox;
      cvs.width = src.w;
      cvs.height = src.h;
      cx.setTransform(1, 0, 0, 1, 0, 0);
      cx.clearRect(0, 0, src.w, src.h);
      cx.imageSmoothingEnabled = false;
      const dx = Math.floor((src.w - bb.w) / 2);
      const dy = src.h - bb.h;
      cx.save();
      cx.translate(src.w, 0);
      cx.scale(-1, 1);
      cx.drawImage(img, fx + bb.x, fy + bb.y, bb.w, bb.h, src.w - dx - bb.w, dy, bb.w, bb.h);
      cx.restore();
      const leftName = `${name}-left`;
      await k.loadSprite(leftName, await encode(cvs));
      out[leftName] = { w: src.w, h: src.h };
      ASSET_REPORT.entries[leftName] = {
        ...entry,
        name: leftName,
        sheetLabel: `${entry.sheetLabel ?? ""} (mirror)`,
        status: "loaded",
      };
    } catch (err) {
      console.warn(`[assets] mirror failed: ${name}`, err);
      ASSET_REPORT.entries[`${name}-left`] = {
        ...entry,
        name: `${name}-left`,
        sheetLabel: `${entry.sheetLabel ?? ""} (mirror)`,
        status: "failed",
      };
    }
  }
  // The engine has decoded every mirror by now; release the blob handles so
  // they do not count against mobile memory for the rest of the run.
  if (objectUrls.length) {
    setTimeout(() => {
      for (const url of objectUrls) URL.revokeObjectURL(url);
    }, 5000);
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
function spawnGrounded(k: Ctx, name: string, sizes: SpriteSizes, opts: SpawnGrounded) {
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

function spawnAirborne(k: Ctx, name: string, sizes: SpriteSizes, opts: SpawnAirborne) {
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

/**
 * Shared "collect me" treatment. Playtesters could not tell pickups apart from
 * scenery, so every required item now wears the SAME green kit: a pulsing glow
 * ring behind it, a couple of twinkling sparkles, a blinking chevron pointing
 * down at it and a short caption. Hazards keep their red AVOID styling, so the
 * colour alone answers "grab it or dodge it?".
 *
 * The decorations are separate root objects that follow the item every frame
 * (children would inherit anchors/rotation from wildly different sprites) and
 * they self-destruct with it.
 */
function markCollectible(
  k: Ctx,
  obj: AnyObj,
  opts: {
    /** Caption under the chevron. Pass "" for no caption. */
    label?: string;
    /** Item height, used to centre the ring and place the chevron. */
    height?: number;
    /** Item width, used to size the ring. */
    width?: number;
    /** true when the object uses anchor("bot") instead of anchor("center"). */
    anchorBot?: boolean;
    /** Extra lift for the chevron/caption (px). */
    topLift?: number;
  } = {},
) {
  const h = opts.height ?? 34;
  const w = opts.width ?? 34;
  const centerDy = opts.anchorBot ? -h / 2 : 0;
  const topDy = (opts.anchorBot ? -h : -h / 2) - 16 - (opts.topLift ?? 0);
  const radius = Math.max(w, h) * 0.72;
  const lowFx = isTouchDevice();

  const ring = k.add([
    k.circle(radius),
    k.pos(obj.pos.x, obj.pos.y + centerDy),
    k.anchor("center"),
    k.color(120, 240, 150),
    k.opacity(0.2),
    k.scale(1),
    k.z(LAYERS.BG_NEAR + 4),
  ]) as AnyObj;
  const ring2 = k.add([
    k.circle(radius * 0.62),
    k.pos(obj.pos.x, obj.pos.y + centerDy),
    k.anchor("center"),
    k.color(230, 255, 235),
    k.opacity(0.16),
    k.z(LAYERS.BG_NEAR + 5),
  ]) as AnyObj;

  const sparkCount = lowFx ? 2 : 3;
  const sparks: AnyObj[] = [];
  for (let i = 0; i < sparkCount; i++) {
    sparks.push(
      k.add([
        k.rect(4, 4),
        k.pos(obj.pos.x, obj.pos.y + centerDy),
        k.anchor("center"),
        k.color(255, 255, 210),
        k.opacity(0.9),
        k.z(LAYERS.EFFECT - 1),
      ]) as AnyObj,
    );
  }

  const chev = k.add([
    k.polygon([k.vec2(-9, -7), k.vec2(9, -7), k.vec2(0, 7)]),
    k.pos(obj.pos.x, obj.pos.y + topDy),
    k.color(120, 240, 150),
    k.outline(2, k.rgb(20, 60, 35)),
    k.opacity(1),
    k.z(LAYERS.EFFECT + 1),
  ]) as AnyObj;

  const text = opts.label ?? "GRAB";
  const caption: AnyObj[] = [];
  if (text) {
    const cy = obj.pos.y + topDy - 22;
    caption.push(
      k.add([
        k.text(text, { size: 12, font: UI_FONT }),
        k.pos(obj.pos.x + 1, cy + 1),
        k.anchor("center"),
        k.color(10, 30, 18),
        k.z(LAYERS.EFFECT),
      ]) as AnyObj,
      k.add([
        k.text(text, { size: 12, font: UI_FONT }),
        k.pos(obj.pos.x, cy),
        k.anchor("center"),
        k.color(150, 250, 175),
        k.z(LAYERS.EFFECT + 1),
      ]) as AnyObj,
    );
  }

  const decor: AnyObj[] = [ring, ring2, chev, ...sparks, ...caption];

  obj.onUpdate(() => {
    const t = k.time();
    const cx = obj.pos.x;
    const cy = obj.pos.y + centerDy;
    const pulse = 0.5 + Math.sin(t * 3) * 0.5;
    ring.pos = k.vec2(cx, cy);
    ring.opacity = 0.14 + pulse * 0.2;
    ring.scale = k.vec2(0.94 + pulse * 0.14, 0.94 + pulse * 0.14);
    ring2.pos = k.vec2(cx, cy);
    ring2.opacity = 0.1 + (1 - pulse) * 0.18;
    for (let i = 0; i < sparks.length; i++) {
      const a = t * 1.6 + (i * Math.PI * 2) / sparks.length;
      sparks[i].pos = k.vec2(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius * 0.55);
      sparks[i].opacity = 0.35 + Math.abs(Math.sin(a * 1.7)) * 0.65;
    }
    const bob = Math.sin(t * 4) * 4;
    chev.pos = k.vec2(cx, obj.pos.y + topDy + bob);
    chev.opacity = Math.sin(t * 6) > -0.3 ? 1 : 0.25;
    if (caption.length) {
      const capY = obj.pos.y + topDy - 22 + bob * 0.5;
      caption[0].pos = k.vec2(cx + 1, capY + 1);
      caption[1].pos = k.vec2(cx, capY);
    }
  });

  obj.onDestroy(() => {
    for (const d of decor) {
      try {
        d.destroy();
      } catch {
        /* already gone */
      }
    }
  });

  return obj;
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

  // Fresh glyph atlas for this run (see UI_FONT).
  UI_FONT = nextUiFont();

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
  /** Every zone owns a distinct tune — no rotation, no repeats within a run. */
  const zoneMusic = (zoneIdx: number): MusicTheme =>
    ZONE_THEMES[Math.max(0, Math.min(ZONE_THEMES.length - 1, zoneIdx))] ?? "adventure";

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

  // Kaplay's `crisp` flag also stamps `image-rendering: pixelated` onto the
  // canvas ELEMENT, which nearest-neighbour-resamples the finished frame when
  // the backing buffer and the CSS box are not an exact integer multiple —
  // that is what makes text look jagged in windowed mode. Sprite sampling
  // stays crisp inside the GL pipeline; only the final present is smoothed.
  if (opts.canvas) opts.canvas.style.imageRendering = "auto";

  // Localization hook: every text component created from here on is routed
  // through the translation dictionary, so scene code keeps its English
  // literals while the rendered glyphs follow the player's language choice.
  {
    const rawText = k.text.bind(k) as Ctx["text"];
    (k as unknown as { text: Ctx["text"] }).text = ((value: unknown, options?: unknown) =>
      rawText(tr(String(value ?? "")), options as never)) as Ctx["text"];
  }

  // ---- Live layout watcher ------------------------------------------------
  // The canvas keeps its logical resolution, but the CSS box it is painted
  // into changes constantly on desktop: window resize, browser zoom, and
  // entering / leaving fullscreen. Any UI screen already on screen was laid
  // out for the OLD box, so text and buttons ended up either too small to
  // read (windowed) or clipped outside their panel (after leaving
  // fullscreen). Every open screen registers a relayout callback here and is
  // rebuilt at the new size.
  const uiRelayout = new Set<() => void>();
  let lastCssW = 0;
  let lastCssH = 0;
  let layoutRaf = 0;
  const readLayout = () => {
    const rect = opts.canvas?.getBoundingClientRect();
    const cw = Math.round(rect?.width ?? 0);
    const ch = Math.round(rect?.height ?? 0);
    if (cw <= 0 || ch <= 0) return;
    if (cw === lastCssW && ch === lastCssH) return;
    lastCssW = cw;
    lastCssH = ch;
    UI_TEXT_SCALE = computeUiTextScale(opts.canvas, k.width());
    for (const fn of [...uiRelayout]) {
      try {
        fn();
      } catch {
        /* a screen closed mid-resize */
      }
    }
  };
  const scheduleLayout = () => {
    if (typeof window === "undefined") return;
    window.cancelAnimationFrame(layoutRaf);
    layoutRaf = window.requestAnimationFrame(readLayout);
  };
  let layoutObserver: ResizeObserver | null = null;
  if (typeof window !== "undefined") {
    window.addEventListener("resize", scheduleLayout);
    document.addEventListener("fullscreenchange", scheduleLayout);
    document.addEventListener("webkitfullscreenchange", scheduleLayout as EventListener);
    if (typeof ResizeObserver !== "undefined" && opts.canvas) {
      layoutObserver = new ResizeObserver(scheduleLayout);
      layoutObserver.observe(opts.canvas);
    }
    scheduleLayout();
  }
  const stopLayoutWatch = () => {
    if (typeof window === "undefined") return;
    window.cancelAnimationFrame(layoutRaf);
    window.removeEventListener("resize", scheduleLayout);
    document.removeEventListener("fullscreenchange", scheduleLayout);
    document.removeEventListener("webkitfullscreenchange", scheduleLayout as EventListener);
    layoutObserver?.disconnect();
    layoutObserver = null;
    uiRelayout.clear();
  };



  // The win result is held back until the player leaves the Thank You screen,
  // so the high-score / suggestion overlay never covers the finale.
  let pendingWin: WinResult | null = null;
  const flushPendingWin = () => {
    if (!pendingWin) return;
    const r = pendingWin;
    pendingWin = null;
    opts.onWin?.(r);
  };

  k.setGravity(1800);

  const sizes = await loadAllSprites(k);

  k.scene("trail", (spawnX: number = 40, lives: number = 1, resume: RunSnapshot | null = null) => {
    const startTime = k.time();
    /** Attract mode — autopilot drives, hits never cost a life. */
    const DEMO = opts.demo === true;
    // Screens from the previous scene are gone; drop their relayout hooks so
    // a resize can never resurrect destroyed nodes.
    uiRelayout.clear();
    // Re-read the on-screen size for this scene's UI (the window may have been
    // resized, or fullscreen toggled, while the previous scene was running).
    UI_TEXT_SCALE = computeUiTextScale(opts.canvas, k.width());
    // ---- Run clock + per-zone split timing -------------------------------
    // Every zone is timed in the background. Clearing a zone under its par
    // time pays a speed bonus, so two players with identical play still end
    // up with clearly different scores.
    let pausedTotal = 0;
    let pausedNow = false;
    let pauseStartedAt = 0;
    /** Time already played before a recovery restart (seconds). */
    const carriedElapsed = resume ? Math.max(0, resume.elapsedMs) / 1000 : 0;
    /** Wall-clock seconds of actual play (pauses/briefings excluded). The
     *  currently-open pause is subtracted too, so the HUD clock visibly stops
     *  while a briefing is on screen instead of jumping back on resume. */
    const runClock = () =>
      carriedElapsed +
      Math.max(0, k.time() - startTime - pausedTotal - (pausedNow ? k.time() - pauseStartedAt : 0));

    const zoneSplitsMs: number[] = resume
      ? Array.from({ length: 8 }, (_, i) => resume.zoneSplitsMs[i] ?? 0)
      : new Array(8).fill(0);
    let zoneClockStart = carriedElapsed;
    let timeBonusTotal = resume ? resume.timeBonus : 0;

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

    // ---- Decorative mosquito swarm (backdrop only, no collision) ---------
    {
      const perZone = isTouchDevice() ? 2 : 3;
      ZONES.forEach((_z, i) => spawnMosquitoSwarm(k, i * BIOME_W, BIOME_W, perZone));
    }


    // ---- Ground ----
    // Zone 0: 3 small jump gaps carved BETWEEN the four brick positions
    // (bricks live at x = 220, 460, 720, 980) so a gap never blocks reaching a brick.
    const Z0_GAP_A0 = 320,
      Z0_GAP_A1 = 360;
    const Z0_GAP_B0 = 600,
      Z0_GAP_B1 = 646;
    const Z0_GAP_C0 = 860,
      Z0_GAP_C1 = 900;
    addGround(k, 0, Z0_GAP_A0, GROUND_Y, ZONES[0].ground, ZONES[0].soil);
    addGround(k, Z0_GAP_A1, Z0_GAP_B0, GROUND_Y, ZONES[0].ground, ZONES[0].soil);
    addGround(k, Z0_GAP_B1, Z0_GAP_C0, GROUND_Y, ZONES[0].ground, ZONES[0].soil);
    addGround(k, Z0_GAP_C1, BIOME_W, GROUND_Y, ZONES[0].ground, ZONES[0].soil);

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
      k.area(),
      k.opacity(0),
      "water",
    ]);

    // Invisible level walls
    k.add([
      k.rect(20, 800),
      k.pos(-20, 0),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      k.z(LAYERS.BOUND),
    ]);
    k.add([
      k.rect(20, 800),
      k.pos(LEVEL_END, 0),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      k.z(LAYERS.BOUND),
    ]);

    // Water kill plane inside river gap.
    k.add([
      k.rect(RIVER_GAP_X1 - RIVER_GAP_X0, 40),
      k.pos(RIVER_GAP_X0, GROUND_Y + 40),
      k.area(),
      k.opacity(0),
      "water",
    ]);

    // ============ Zone objective + door system ============
    type ZoneObjective = {
      hudLabel: () => string;
      met: () => boolean;
    };
    const zoneObjectives: (ZoneObjective | null)[] = new Array(ZONES.length).fill(null);
    // Manual umbrella: held Down in the Awaiting-Decision zone. Tracked here so
    // the visual, the movement penalty and the damage check all read one flag.
    const umbrellaState = { up: false, taught: false };
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
    // Attract mode keeps moving: the approval wait is trimmed so the demo
    // loop doesn't stall a watcher on a countdown.
    if (DEMO) zoneState.waitDur = 5;


    // Zone 3 collapsing platforms — registered on build so a life loss can
    // restore every one of them for the next attempt.
    const riverPlatforms: Array<() => void> = [];
    function resetRiverPlatforms() {
      for (const reset of riverPlatforms) reset();
    }

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
      const BAR_W = 14,
        BAR_H = 560;
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
      playSfx("door-unlock");
      d.obj.color = k.rgb(255, 240, 120);
      k.wait(0.25, () => {
        d.obj.color = k.rgb(255, 255, 255);
      });
      k.wait(0.5, () => {
        playSfx("door-open");
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
        // --- Flashing "the way is open" arrow above the door ---------------
        const doorTopY = d.obj.pos.y - DISPLAY_H["door-open"] - 22;
        const parts: AnyObj[] = [];
        const mk = (ox: number, oy: number, w: number, h: number) => {
          const p = k.add([
            k.rect(w, h),
            k.pos(d.obj.pos.x + ox, doorTopY + oy),
            k.color(255, 214, 64),
            k.outline(3, k.rgb(40, 26, 0)),
            k.anchor("center"),
            k.z(LAYERS.EFFECT),
            k.opacity(1),
          ]) as AnyObj;
          p.__oy = oy;
          p.__ox = ox;
          parts.push(p);
          return p;
        };
        // A real arrow: long shaft, then a stepped triangular head. Built from
        // blocks so it stays true 16-bit, but reads unmistakably as "go right".
        mk(-30, 0, 40, 14); // shaft
        mk(-2, 0, 14, 42); // head base
        mk(10, 0, 12, 30); // head mid
        mk(20, 0, 12, 18); // head tip
        mk(29, 0, 8, 8); // point
        const baseY = doorTopY;
        const arrowCtl = k.onUpdate(() => {
          const t = k.time();
          const bob = Math.sin(t * 5) * 6;
          const nudge = (Math.sin(t * 5) + 1) * 4; // slides right, urging you on
          const flash = Math.floor(t * 4) % 2 === 0 ? 1 : 0.4;
          for (const p of parts) {
            p.pos.y = baseY + bob + (p.__oy ?? 0);
            p.pos.x = d.obj.pos.x + (p.__ox ?? 0) + nudge;
            p.opacity = flash;
          }
          // Retire the cue once the player has stepped through the doorway.
          if (player && player.pos.x > d.obj.pos.x + 24) {
            try {
              arrowCtl.cancel();
            } catch {
              /* ignore */
            }
            for (const p of parts) {
              try {
                p.destroy();
              } catch {
                /* ignore */
              }
            }
            parts.length = 0;
          }
        });

        // Brief on-screen cue so it reads even when the door is off-camera.
        const cue = k.add([
          k.text("DOOR OPEN  \u2192", { size: 18, font: UI_FONT }),
          k.pos(k.width() / 2, 74),
          k.anchor("center"),
          k.color(255, 214, 64),
          k.outline(3, k.rgb(0, 0, 0)),
          k.fixed(),
          k.z(LAYERS.HUD + 8),
          k.opacity(1),
        ]) as AnyObj;
        const cueStart = k.time();
        const cueCtl = k.onUpdate(() => {
          const el = k.time() - cueStart;
          cue.opacity =
            el > 2.2 ? Math.max(0, 1 - (el - 2.2) * 2) : Math.floor(el * 4) % 2 === 0 ? 1 : 0.4;
          if (el > 2.8) {
            try {
              cueCtl.cancel();
            } catch {
              /* ignore */
            }
            try {
              cue.destroy();
            } catch {
              /* ignore */
            }
          }
        });
      });
    }

    // ---- Doorway transition ------------------------------------------------
    // Completing a zone no longer teleports the player: they walk into the
    // doorway, vanish inside, the door swings shut behind them, the screen
    // fades, and the next zone opens at its official start. Once through, the
    // door is sealed for good — the journey only ever moves forward.
    let transitioning = false;
    /** Hard floor on X: the far side of the last door walked through. */
    let progressFloorX = 0;

    function walkThroughDoor(zoneIdx: number) {
      const d = doors[zoneIdx];
      if (!d || !d.unlocked || transitioning) return;
      if (zoneIdx >= 7) return;
      transitioning = true;
      pauseGameplay();

      const doorX = d.obj.pos.x;
      const p = player as AnyObj;
      const startX = player.pos.x;
      const startScale = 1;
      let t = 0;
      let stepAt = 0;
      p.vel = k.vec2(0, 0);
      player.flipX = false;

      const ctl = k.onUpdate(() => {
        const dt = k.dt();
        t += dt;
        // Phase 1 (0.55s): stride into the doorway, footsteps on the boards.
        if (t < 0.55) {
          const f = t / 0.55;
          player.pos.x = startX + (doorX - startX) * f;
          player.pos.y = GROUND_Y;
          if (t - stepAt > 0.18) {
            stepAt = t;
            playSfx("footstep");
          }
          return;
        }
        // Phase 2 (0.45s): step inside — shrink into the frame and fade out.
        if (t < 1.0) {
          const f = (t - 0.55) / 0.45;
          player.pos.x = doorX;
          p.opacity = Math.max(0, 1 - f);
          p.scale = k.vec2(startScale * (1 - f * 0.35), startScale * (1 - f * 0.15));
          return;
        }
        try {
          ctl.cancel();
        } catch {
          /* ignore */
        }

        // Door swings shut behind them, with a solid thump.
        setGameObjSprite(d.obj, "door-closed");
        playSfx("door-close");
        for (let i = 0; i < 6; i++) {
          const dust = k.add([
            k.rect(5, 5),
            k.pos(doorX - 20 + i * 8, GROUND_Y - 4),
            k.color(190, 175, 150),
            k.opacity(0.8),
            k.anchor("center"),
            k.z(LAYERS.EFFECT),
            { life: 0, vx: (i - 3) * 22 },
          ]) as AnyObj;
          dust.onUpdate(() => {
            dust.life += k.dt();
            dust.pos.x += dust.vx * k.dt();
            dust.pos.y -= 26 * k.dt();
            dust.opacity = Math.max(0, 0.8 - dust.life * 1.8);
            if (dust.life > 0.5) dust.destroy();
          });
        }

        // Fade to black, move to the start of the next zone, fade back in.
        const fade = k.add([
          k.rect(k.width(), k.height()),
          k.pos(0, 0),
          k.color(0, 0, 0),
          k.opacity(0),
          k.fixed(),
          k.z(320),
        ]) as AnyObj;
        let ft = 0;
        let moved = false;
        const fadeCtl = k.onUpdate(() => {
          ft += k.dt();
          if (ft < 0.45) {
            fade.opacity = ft / 0.45;
            return;
          }
          if (!moved) {
            moved = true;
            fade.opacity = 1;
            // Official start of the next zone, on solid ground.
            player.pos.x = (zoneIdx + 1) * BIOME_W + 46;
            player.pos.y = GROUND_Y - 4;
            p.vel = k.vec2(0, 0);
            p.opacity = 1;
            p.scale = k.vec2(1, 1);
            // Seal the completed zone: nothing can walk back through.
            progressFloorX = (zoneIdx + 1) * BIOME_W + 12;
            const seal = k.add([
              k.rect(16, 620),
              k.pos(progressFloorX - 24, GROUND_Y - 620),
              k.opacity(0),
              k.area({ shape: new k.Rect(k.vec2(0, 0), 16, 620) }),
              k.body({ isStatic: true }),
              k.z(LAYERS.PROP),
            ]);
            seal.paused = false;
            return;
          }
          if (ft < 0.75) return; // hold on black while the new zone settles
          fade.opacity = Math.max(0, 1 - (ft - 0.75) / 0.4);
          if (ft > 1.2) {
            try {
              fadeCtl.cancel();
            } catch {
              /* ignore */
            }
            try {
              fade.destroy();
            } catch {
              /* ignore */
            }
            resumeGameplay();
            transitioning = false;
            leftArmed = false;
            rightArmed = false;
            if (w?.__gameInput) w.__gameInput.jumpReq = false;
            // The main loop notices the new zone and opens its briefing.
          }
        });
      });
    }

    // Spawn doors for zones 0..6 (zone 7 = finale, uses fire pole instead).

    for (let i = 0; i < 7; i++) doors[i] = spawnDoor(i);

    // ================= ZONE 0: Finding the Trail — smash a brick to pick your apply method =================
    // Bricks float at head height. Player jumps UP into one (upward velocity)
    // to smash it — the "method" icon pops out, drops to the ground, and the
    // door unlocks the moment the player touches the icon.
    const applyMethods: { x: number; icon: string; label: string }[] = [
      { x: 220, icon: "MAIL", label: "Apply by Mail" },
      { x: 460, icon: "PHONE", label: "Apply by Phone" },
      { x: 720, icon: "IN PERSON", label: "Apply In Person" },
      { x: 980, icon: "ONLINE", label: "Apply Online" },
    ];
    const BRICK_Y = GROUND_Y - 150;
    const bw = displaySize("brick-idle", sizes).w;
    const bh = DISPLAY_H["brick-idle"];
    // Player feedback: picking one channel must visibly close the others, so
    // every brick + signpost is kept here and switched off on selection.
    const methodStations: { label: string; icon: string; brick: AnyObj; sign: AnyObj[] }[] = [];
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
      const sign = addSignPlaque(k, m.x, BRICK_Y - 42, m.label, m.icon, `sign-${m.icon}`);
      methodStations.push({ label: m.label, icon: m.icon, brick, sign });
    }
    // Called once the player collects a method: the unchosen bricks POP out of
    // existence (players read a greyed-out block as still interactive), their
    // signposts come down, and any loose icon is swept away — so the only
    // choice left standing on the trail is the one the player made.
    const lockApplyMethods = (chosen: string) => {
      for (const st of methodStations) {
        const picked = st.label === chosen;
        const signTag = `sign-${st.icon}`;
        // Head-bump handler exits early on `hit`, so this disables the brick.
        (st.brick as unknown as { hit: boolean }).hit = true;
        if (picked) {
          const labelObj = st.sign[st.sign.length - 1] as unknown as { text?: string };
          if (labelObj && typeof labelObj.text === "string" && !labelObj.text.includes("✓")) {
            labelObj.text = `${labelObj.text} ✓`;
          }
          continue;
        }
        sparkleBurst(st.brick.pos.x, st.brick.pos.y, [235, 205, 150]);
        (st.brick as unknown as { destroy: () => void }).destroy();
        for (const part of st.sign) (part as unknown as { destroy: () => void }).destroy();
        // Belt-and-braces: also sweep by tag in case a piece outlived its ref.
        for (const part of k.get(signTag)) (part as unknown as { destroy: () => void }).destroy();
      }
      // Sweep up icons that were knocked out of other bricks earlier.
      for (const leftover of k.get("method")) (leftover as unknown as AnyObj).destroy();
      spawnExitArrow();
    };

    // Persistent "keep going right" guide shown after the pick: a blinking
    // yellow chevron + caption that floats beside the hero until the player
    // leaves Zone 1. Transient hint text alone was missed by testers.
    let exitArrow: AnyObj | null = null;
    function spawnExitArrow() {
      if (exitArrow) return;
      const guide = k.add([
        k.pos(player.pos.x + 90, GROUND_Y - 120),
        k.anchor("center"),
        k.opacity(1),
        k.z(LAYERS.EFFECT + 2),
      ]) as AnyObj;
      const parts: AnyObj[] = [];
      parts.push(guide.add([
        k.text("▶", { size: Math.round(26 * UI_TEXT_SCALE), font: UI_FONT }),
        k.pos(0, 0),
        k.anchor("center"),
        k.color(255, 220, 90),
        k.opacity(1),
        k.outline(2, k.rgb(40, 30, 10)),
      ]) as AnyObj);
      const cap = tr("Go right to the door");
      const capW = Math.max(120, cap.length * 6 * UI_TEXT_SCALE + 18);
      parts.push(guide.add([
        k.rect(capW, Math.round(18 * UI_TEXT_SCALE), { radius: 3 }),
        k.pos(0, Math.round(22 * UI_TEXT_SCALE)),
        k.anchor("center"),
        k.color(20, 24, 40),
        k.opacity(1),
        k.outline(2, k.rgb(255, 220, 90)),
      ]) as AnyObj);
      parts.push(guide.add([
        k.text(cap, { size: Math.round(10 * UI_TEXT_SCALE), font: UI_FONT }),
        k.pos(0, Math.round(22 * UI_TEXT_SCALE)),
        k.anchor("center"),
        k.color(255, 240, 190),
        k.opacity(1),
      ]) as AnyObj);
      guide.onUpdate(() => {
        // Gone the moment the player steps into the next zone.
        if (player.pos.x >= BIOME_W - 20) {
          guide.destroy();
          exitArrow = null;
          return;
        }
        guide.pos.x = player.pos.x + 90;
        guide.pos.y = GROUND_Y - 120 + Math.sin(k.time() * 5) * 5;
        // Blink the caption/arrow themselves (children don't inherit opacity).
        const a = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(k.time() * 6));
        for (const p of parts) p.opacity = a;
      });
      exitArrow = guide;
    }
    zoneObjectives[0] = {
      hudLabel: () => `METHOD ${zoneState.methodTouched ? "✓" : "☐"}`,
      met: () => zoneState.methodTouched,
    };

    // ================= ZONE 1: Setting Up Camp — create account =================
    const sx0 = BIOME_W;
    // Player-feedback fix: the decorative laptops used to stand in the running
    // lane and read as hazards. They now sit BEHIND the play plane, tucked at
    // the zone edges and dimmed, so the zone keeps its density while every
    // object the player can actually touch stays unambiguous.
    const laptopSpots = [sx0 + 120, sx0 + 1160];
    for (const lx of laptopSpots) {
      const d = spawnDecor(k, "laptop", sizes, {
        x: lx,
        groundY: GROUND_Y - 96,
        z: LAYERS.BG_NEAR + 1,
      });
      (d as AnyObj).use(k.opacity(0.5));
    }


    // --- Background sightings: the boss bear glimpsed through Zones 1-6 ------
    // Purely decorative and painted INTO the backdrop: no drawn ledges, no
    // invented geometry, no patrol across empty sky. Each zone gets one short,
    // mostly-stationary beat at a spot that already reads as terrain in that
    // zone's art. He fades in out of the haze, does a small organic beat
    // (sniff / look / head turn), then fades back out and waits a long time.
    {
      type BearMotion = "sway" | "bob" | "dip" | "peer" | "rise" | "ghost";
      type BearSighting = {
        zone: number; // 0-based zone index
        x: number; // spot within the zone
        rise: number; // pixels above the player's ground line
        scale: number;
        tint: [number, number, number];
        opacity: number; // peak opacity while visible
        frame: string; // pose sprite for this zone
        motion: BearMotion;
        hold: number; // seconds visible
        gap: number; // seconds hidden between sightings
        faceLeft: boolean;
      };
      const BEAR_SIGHTINGS: BearSighting[] = [
        // Zone 1 — draped along the big pine limb on the left of the backdrop.
        {
          zone: 0,
          x: 232,
          rise: 254,
          scale: 1.55,
          tint: [178, 190, 196],
          opacity: 0.98,
          frame: "bear-pose-limb",
          motion: "sway",
          hold: 11.0,
          gap: 2.0,
          faceLeft: false,
        },
        // Zone 2 — leaning out from behind the RIGHT post of the signboard so
        // he never covers the "LOOK OUT FOR BEARS!" lettering.
        {
          zone: 1,
          x: 1148,
          rise: 150,
          scale: 1.75,
          tint: [206, 208, 214],
          opacity: 1,
          frame: "bear-pose-peek",
          motion: "peer",
          hold: 11.0,
          gap: 2.0,
          faceLeft: true,
        },
        // Zone 3 — on the far riverbank where the water meets the rock.
        {
          zone: 2,
          x: 214,
          rise: 84,
          scale: 1.35,
          tint: [188, 202, 214],
          opacity: 0.95,
          frame: "bear-pose-drink",
          motion: "dip",
          hold: 11.0,
          gap: 2.0,
          faceLeft: false,
        },
        // Zone 4 — leaning out from the edge of the lodge building.
        {
          zone: 3,
          x: 676,
          rise: 52,
          scale: 1.32,
          tint: [182, 182, 196],
          opacity: 0.93,
          frame: "bear-pose-lean",
          motion: "bob",
          hold: 10.0,
          gap: 2.5,
          faceLeft: true,
        },
        // Zone 5 — reared up on the painted hill crest behind the fields.
        {
          zone: 4,
          x: 430,
          rise: 192,
          scale: 1.4,
          tint: [164, 182, 198],
          opacity: 0.92,
          frame: "bear-pose-rear",
          motion: "rise",
          hold: 10.5,
          gap: 2.5,
          faceLeft: true,
        },
        // Zone 6 — half-behind a dead pine trunk in the storm haze.
        {
          zone: 5,
          x: 172,
          rise: 92,
          scale: 1.45,
          tint: [156, 148, 186],
          opacity: 0.88,
          frame: "bear-pose-lean",
          motion: "ghost",
          hold: 11.0,
          gap: 2.5,
          faceLeft: false,
        },
      ];

      for (const cam of BEAR_SIGHTINGS) {
        const zx = BIOME_W * cam.zone;
        const baseX = zx + cam.x;
        const baseY = GROUND_Y - cam.rise;
        const disp = displaySize(cam.frame, sizes);
        const bearW = Math.max(8, disp.w * cam.scale);
        const bearH = Math.max(8, (DISPLAY_H[cam.frame] ?? 54) * cam.scale);

        const bear = k.add([
          k.sprite(cam.frame, { width: bearW, height: bearH }),
          k.pos(px(baseX), px(baseY)),
          k.anchor("bot"),
          k.color(cam.tint[0], cam.tint[1], cam.tint[2]), // atmospheric haze
          k.opacity(0),
          k.z(LAYERS.DECOR_BACK),
        ]) as AnyObj;
        bear.flipX = cam.faceLeft;

        const FADE = 1.1;
        const cycle = cam.hold + cam.gap;
        let t = Math.random() * cycle;

        bear.onUpdate(() => {
          t = (t + k.dt()) % cycle;
          if (t > cam.hold) {
            bear.opacity = 0;
            return;
          }
          const fadeIn = Math.min(1, t / FADE);
          const fadeOut = Math.min(1, (cam.hold - t) / FADE);
          let alpha = cam.opacity * Math.min(fadeIn, fadeOut);

          const p = t / cam.hold; // 0..1 through the visible window
          let dx = 0;
          let dy = 0;
          switch (cam.motion) {
            case "sway": // branch rocking under his weight
              dx = Math.sin(t * 1.5) * 5;
              dy = Math.sin(t * 1.5 + 0.6) * 4;
              break;
            case "peer": // pops up behind cover, ducks back down twice
              dy = 16 * (1 - Math.abs(Math.sin(p * Math.PI * 2)));
              dx = Math.sin(t * 2.2) * 2;
              break;
            case "dip": // muzzle dips to the water and lifts again
              dy = Math.sin(t * 1.1) * 5;
              break;
            case "bob": // leans further out of the gap, then back
              dx = (cam.faceLeft ? -1 : 1) * 14 * Math.sin(p * Math.PI);
              break;
            case "rise": // climbs into ridge silhouette, holds, drops away
              dy = 34 * Math.max(0, 1 - Math.sin(Math.min(1, p * 1.6) * Math.PI * 0.5));
              break;
            case "ghost": // drifts sideways in the storm, pulsing faintly
              dx = Math.sin(t * 0.5) * 18;
              alpha *= 0.75 + Math.sin(t * 1.7) * 0.25;
              break;
          }
          bear.opacity = alpha;
          bear.pos.x = px(baseX + dx);
          bear.pos.y = px(baseY + dy);
        });
      }
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
      item.onUpdate(() => {
        item.pos.y = item.basY + Math.sin(k.time() * 2) * 5;
      });
      item.sign = addSpeech(k, ux, uy - 32, "USERNAME", [30, 60, 130]);
      markCollectible(k, item, {
        label: "GRAB",
        width: disp.w,
        height: DISPLAY_H["username"],
        topLift: 26,
      });
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
      item.onUpdate(() => {
        item.pos.y = item.basY + Math.sin(k.time() * 2 + 1) * 5;
      });
      item.sign = addSpeech(k, px, py - 32, "PASSWORD", [30, 60, 130]);
      markCollectible(k, item, {
        label: "GRAB",
        width: disp.w,
        height: DISPLAY_H["password"],
        topLift: 26,
      });
    }
    // Password padlock enemy patrol.
    // Player-feedback fix: this lock used to sit RIGHT of the Z1 gap, which
    // left two locks crowding the narrow landing. It now patrols well LEFT of
    // the gap where there is room to time the jump.
    {
      const px = sx0 + 300;
      const ph = DISPLAY_H["padlock"];
      const pw = displaySize("padlock", sizes).w;
      const speed = 54;
      const m = spawnGrounded(k, "padlock", sizes, {
        x: px,
        z: LAYERS.ACTOR,
        tag: "monster",
        props: { dir: 1, home: px, range: 90 },
        hitboxScale: { x: -pw / 2, w: pw, h: ph },
      });
      m.onUpdate(() => {
        m.pos.x += m.dir * speed * k.dt();
        m.pos.y = GROUND_Y;
        if (m.pos.x > m.home + m.range) {
          m.pos.x = m.home + m.range;
          m.dir = -1;
        }
        if (m.pos.x < m.home - m.range) {
          m.pos.x = m.home - m.range;
          m.dir = 1;
        }
      });

      // First real enemy of the run: a blinking coach caption rides above it
      // until the player has cleared it, so nobody learns the rule by dying.
      let coach: AnyObj[] | null = addSpeech(k, px, GROUND_Y - ph - 46, "JUMP OVER — NO STOMPING!", [
        200, 40, 40,
      ]);
      const coachOffsets = coach.map((part) => ({
        part,
        dx: part.pos.x - px,
        dy: part.pos.y - (GROUND_Y - ph - 46),
      }));
      m.onUpdate(() => {
        if (!coach) return;
        const hero = k.get("player")[0] as AnyObj | undefined;
        if (hero && hero.pos.x > m.home + m.range + 120) {
          for (const part of coach) part.destroy();
          coach = null;
          return;
        }
        const blink = Math.sin(k.time() * 6) > -0.35 ? 1 : 0.15;
        for (const { part, dx, dy } of coachOffsets) {
          part.pos.x = m.pos.x + dx;
          part.pos.y = GROUND_Y - ph - 46 + dy;
          part.opacity = blink;
        }
      });
    }
    // Gap guards. Final layout: ONE lock left of the Z1 gap (the patroller
    // above) and exactly ONE on the right, whose patrol is kept short so the
    // landing ledge always has clear space. The second left-side roamer was
    // removed per player feedback — the approach was too crowded.
    {
      const ph = DISPLAY_H["padlock"];
      const pw = displaySize("padlock", sizes).w;
      const spots: Array<{ x: number; dir: 1 | -1; speed: number; range: number }> = [
        // The single padlock guarding the approach to the door on the right.
        { x: sx0 + 1010, dir: -1, speed: 104, range: 110 },
      ];

      for (const s of spots) {
        const m = spawnGrounded(k, "padlock", sizes, {
          x: s.x,
          z: LAYERS.ACTOR,
          tag: "monster",
          props: { dir: s.dir, home: s.x, range: s.range },
          hitboxScale: { x: -pw / 2, w: pw, h: ph },
        });
        m.onUpdate(() => {
          m.pos.x += m.dir * s.speed * k.dt();
          m.pos.y = GROUND_Y;
          if (m.pos.x > m.home + m.range) {
            m.pos.x = m.home + m.range;
            m.dir = -1;
          }
          if (m.pos.x < m.home - m.range) {
            m.pos.x = m.home - m.range;
            m.dir = 1;
          }
        });
      }
    }

    zoneObjectives[1] = {
      hudLabel: () =>
        `USER ${zoneState.userGot ? "✓" : "☐"}  PASS ${zoneState.passGot ? "✓" : "☐"}`,
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
        k.area(),
        k.body({ isStatic: true }),
        k.z(LAYERS.PLATFORM),
        "platform",
        { platformSpeed: k.vec2(0, 0), lastPos: k.vec2(rx0, GROUND_Y - 6) },
      ]);
      const bridgeH = DISPLAY_H["bridge"];
      for (let i = 0; i < 7; i++) {
        spawnDecor(k, "bridge", sizes, {
          x: rx0 + i * 100 + 50,
          groundY: GROUND_Y - 6 + bridgeH,
          z: LAYERS.PLATFORM - 1,
        });
      }
    } else {
      // Each platform represents an application section. Label baked into the
      // platform surface so the player literally steps on "About You", "Household",
      // "Income", "Signature" to cross the river.
      // Difficulty pass: the platforms no longer bob. They sit at fixed,
      // jumpable heights and COLLAPSE — step on one, it shakes briefly, then
      // drops away to the bottom of the screen. Keep moving or fall in.
      const platforms = [
        { x: rx0 + 30, y: GROUND_Y - 108, label: "ABOUT YOU" },
        { x: rx0 + 200, y: GROUND_Y - 140, label: "HOUSEHOLD" },
        { x: rx0 + 370, y: GROUND_Y - 124, label: "INCOME" },
        { x: rx0 + 540, y: GROUND_Y - 104, label: "SIGNATURE" },
      ];
      const SHAKE_S = 0.55; // longer warning so the platform stays up before it drops
      const FALL_G = 900;

      for (const p of platforms) {
        const PLAT_W = 108;
        const plat = k.add([
          k.rect(PLAT_W, 16),
          k.pos(p.x, p.y),
          k.color(240, 230, 200),
          k.outline(2, k.rgb(60, 45, 25)),
          k.area(),
          k.body({ isStatic: true }),
          k.z(LAYERS.PLATFORM),
          k.opacity(1),
          "platform",
          {
            basX: p.x,
            basY: p.y,
            phase: "idle" as "idle" | "shaking" | "falling",
            trigT: 0,
            fallVy: 0,
            platformSpeed: k.vec2(0, 0),
            lastPos: k.vec2(p.x, p.y),
          },
        ]) as AnyObj;
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
          k.text(p.label, { size: labelSize, font: UI_FONT }),
          k.pos(p.x + PLAT_W / 2 + 1, p.y + 3 + 1),
          k.anchor("center"),
          k.color(0, 0, 0),
          k.z(LAYERS.PLATFORM + 2),
        ]) as AnyObj;
        const label = k.add([
          k.text(p.label, { size: labelSize, font: UI_FONT }),
          k.pos(p.x + PLAT_W / 2, p.y + 3),
          k.anchor("center"),
          k.color(255, 220, 90),
          k.z(LAYERS.PLATFORM + 3),
        ]) as AnyObj;

        function place(x: number, y: number) {
          plat.pos.x = x;
          plat.pos.y = y;
          plaque.pos.x = x + PLAT_W / 2;
          plaque.pos.y = y + 3;
          shadow.pos.x = x + PLAT_W / 2 + 1;
          shadow.pos.y = y + 3 + 1;
          label.pos.x = x + PLAT_W / 2;
          label.pos.y = y + 3;
        }

        // Restores this platform for the next attempt at the crossing.
        riverPlatforms.push(() => {
          plat.phase = "idle";
          plat.trigT = 0;
          plat.fallVy = 0;
          plat.platformSpeed.x = 0;
          plat.platformSpeed.y = 0;
          plat.lastPos.x = plat.basX;
          plat.lastPos.y = plat.basY;
          plat.opacity = 1;
          plaque.opacity = 0.95;
          shadow.opacity = 1;
          label.opacity = 1;
          if (!plat.is("platform")) plat.tag("platform");
          if (!plat.is("area")) plat.use(k.area());
          if (!plat.is("body")) plat.use(k.body({ isStatic: true }));

          place(plat.basX, plat.basY);
        });

        plat.onUpdate(() => {
          const dt = k.dt();
          const now = k.time();
          if (plat.phase === "idle") {
            // Standing on it (or landing on it) starts the collapse.
            const standing =
              player.riding === plat ||
              (Math.abs(player.pos.y - plat.pos.y) <= 10 &&
                player.pos.x >= plat.pos.x - PLATFORM_EDGE_TOLERANCE &&
                player.pos.x <= plat.pos.x + PLAT_W + PLATFORM_EDGE_TOLERANCE);
            if (standing) {
              plat.phase = "shaking";
              plat.trigT = now;
            }
          } else if (plat.phase === "shaking") {
            // Keep the physical platform fixed while it warns the player.
            // Moving the collider side-to-side made its calculated ride speed
            // carry an idle player forward, which felt like auto-run.
            place(plat.basX, plat.basY);
            const warningOpacity = Math.floor((now - plat.trigT) * 24) % 2 === 0 ? 1 : 0.68;
            plat.opacity = warningOpacity;
            plaque.opacity = warningOpacity * 0.95;
            shadow.opacity = warningOpacity;
            label.opacity = warningOpacity;
            if (now - plat.trigT >= SHAKE_S) {
              plat.phase = "falling";
              plat.fallVy = 60;
              // Release the hero FIRST: if stripping components throws, the
              // ride must still be gone or the player floats on nothing.
              if (player.riding === plat) player.riding = null;
              plat.platformSpeed.x = 0;
              plat.platformSpeed.y = 0;
              try {
                plat.untag("platform");
                plat.unuse("body");
                plat.unuse("area");
              } catch {
                /* component already gone */
              }
            }

          } else {
            plat.fallVy += FALL_G * dt;
            const ny = plat.pos.y + plat.fallVy * dt;
            place(plat.basX, ny);
            const fade = Math.max(0, 1 - (ny - plat.basY) / 420);
            plat.opacity = fade;
            plaque.opacity = fade * 0.95;
            shadow.opacity = fade;
            label.opacity = fade;
          }
          if (dt > 0) {
            plat.platformSpeed.x = (plat.pos.x - plat.lastPos.x) / dt;
            plat.platformSpeed.y = (plat.pos.y - plat.lastPos.y) / dt;
          }
          plat.lastPos.x = plat.pos.x;
          plat.lastPos.y = plat.pos.y;
        });
      }
    }
    // Background thought bubbles — decorative "what am I filling out?" chatter.
    {
      const bubbles: Array<[number, number, string]> = [
        [rx0 + 60, 120, "Which form?"],
        [rx0 + 220, 90, "Do I qualify?"],
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
      const doc = spawnGrounded(k, prop, sizes, {
        x,
        z: LAYERS.PROP,
        tag: "doc",
        props: { docKey: key },
        hitboxScale: { x: -dh / 2, w: dh, h: dh },
      });
      // Sign above the document; destroyed the moment it's collected.
      doc.sign = addSpeech(k, x, GROUND_Y - dh - 30, key.toUpperCase(), [30, 60, 130]);
      markCollectible(k, doc, {
        label: "GRAB",
        width: displaySize(prop, sizes).w,
        height: dh,
        anchorBot: true,
        topLift: 30,
      });
    }

    {
      const mh = DISPLAY_H["form-monster"];
      const mw = displaySize("form-monster", sizes).w;
      // Difficulty pass: three clipboards instead of four, spaced further
      // apart and patrolling slower so gaps between them stay walkable.
      const baseSpeed = active.plain_language ? 34 : 56;
      const monsterSpots: Array<{ x: number; speed: number; range: number }> = [
        { x: tx0 + 360, speed: active.plain_language ? 30 : 50, range: 90 },
        { x: tx0 + 700, speed: baseSpeed, range: 105 },
        { x: tx0 + 1040, speed: active.plain_language ? 30 : 48, range: 95 },
      ];

      for (const s of monsterSpots) {
        const m = spawnGrounded(k, "form-monster", sizes, {
          x: s.x,
          z: LAYERS.ACTOR,
          tag: "monster",
          props: { dir: 1, home: s.x, range: s.range },
          hitboxScale: { x: -mw / 2, w: mw, h: mh },
        });
        m.onUpdate(() => {
          m.pos.x += m.dir * s.speed * k.dt();
          m.pos.y = GROUND_Y;
          if (m.pos.x > m.home + m.range) {
            m.pos.x = m.home + m.range;
            m.dir = -1;
            m.flipX = true;
          }
          if (m.pos.x < m.home - m.range) {
            m.pos.x = m.home - m.range;
            m.dir = 1;
            m.flipX = false;
          }
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
      const reply = spawnGrounded(k, "mailbox", sizes, {
        x: rx,
        z: LAYERS.PROP,
        tag: "reply",
        props: { bonus: 400 },
        hitboxScale: { x: -dh / 2, w: dh, h: dh },
      });
      markCollectible(k, reply, {
        label: "COLLECT",
        width: displaySize("mailbox", sizes).w,
        height: dh,
        anchorBot: true,
      });
    }
    {
      // Difficulty pass: two Envelope-Gremlins (down from three), each
      // patrolling its own half of the relay stretch so they can't bunch up.
      const mh = DISPLAY_H["envelope-gremlin-0"];
      const mw = displaySize("envelope-gremlin-0", sizes).w;
      const zoneL = relayBase + 80;
      const zoneR = relayBase + BIOME_W - 80;
      const laneW = (zoneR - zoneL) / 2;
      const startXs = [relayBase + 400, relayBase + 880];
      let nextDiveAllowedAt = 3;

      for (let gi = 0; gi < startXs.length; gi++) {
        const sx = startXs[gi];
        const laneL = zoneL + laneW * gi + 20;
        const laneR = zoneL + laneW * (gi + 1) - 20;
        const m = spawnGrounded(k, "envelope-gremlin-0", sizes, {
          x: sx,
          z: LAYERS.ACTOR,
          tag: "monster",
          props: {
            dir: (Math.random() < 0.5 ? -1 : 1) as 1 | -1,
            speed: 42 + Math.random() * 40,
            targetX: laneL + Math.random() * (laneR - laneL),
            nextRoll: 0.7 + Math.random() * 0.6,
            rollT: 0,
            baseY: GROUND_Y,
            bobPhase: Math.random() * Math.PI * 2,
            animT: 0,
            gremlinFrame: 0,
            diveUntil: 0,
            nextDive: 3 + gi * 1.6 + Math.random() * 2.0,
          },
          hitboxScale: { x: -mw / 2, w: mw, h: mh },
        });
        m.onUpdate(() => {
          const dt = k.dt();
          const now = k.time();
          m.rollT += dt;
          // Occasionally lock onto the player for a short dive burst — but
          // only one gremlin may be diving at a time.
          if (now >= m.nextDive) {
            if (now >= nextDiveAllowedAt) {
              m.diveUntil = now + 0.6;
              nextDiveAllowedAt = now + 1.8;
              m.nextDive = now + 3.0 + Math.random() * 2.5;
            } else {
              m.nextDive = now + 0.5;
            }
          }
          if (now < m.diveUntil) {
            m.targetX = k.clamp(player.pos.x, laneL, laneR);
            m.speed = 150;
          } else if (m.rollT >= m.nextRoll || Math.abs(m.pos.x - m.targetX) < 8) {
            m.targetX = laneL + Math.random() * (laneR - laneL);
            m.speed = 55 + Math.random() * 55;
            m.nextRoll = 0.7 + Math.random() * 0.6;
            m.rollT = 0;
          }
          m.dir = m.pos.x < m.targetX ? 1 : -1;
          m.pos.x += m.dir * m.speed * dt;
          if (m.pos.x < laneL) m.pos.x = laneL;
          if (m.pos.x > laneR) m.pos.x = laneR;
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
        { y: 90, spd: 70, phase: 0.0, bobA: 8, bobS: 1.6 },
        { y: 140, spd: 55, phase: 1.7, bobA: 6, bobS: 1.2 },
        { y: 190, spd: 85, phase: 3.2, bobA: 10, bobS: 1.9 },
        { y: 60, spd: 45, phase: 2.4, bobA: 5, bobS: 1.4 },
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
    const CAL_COUNT = 19;
    const CAL_L = mx0 + 40;
    const CAL_R = mx0 + BIOME_W - 40;
    const CAL_MIN_GAP = 0.13; // seconds between two pages starting to fall
    const CAL_TELEGRAPH = 0.35; // seconds a warning marker shows before the drop
    let calNextDropAt = 0;
    // Full-width coverage: the zone is sliced into columns and every column is
    // used once per shuffled sweep, so no lane ever stays safe — the player has
    // to keep moving instead of parking in a dead spot.
    const CAL_COLS = 16;
    const CAL_COL_W = (CAL_R - CAL_L) / CAL_COLS;
    let calBag: number[] = [];
    function refillCalBag() {
      calBag = Array.from({ length: CAL_COLS }, (_, i) => i);
      for (let i = calBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [calBag[i], calBag[j]] = [calBag[j], calBag[i]];
      }
    }
    refillCalBag();
    // Once the 10-second wait is survived the sky clears: no new pages are
    // scheduled and anything mid-air is swept away, so the walk to the exit
    // door is completely safe.
    let calDone = false;
    const calPages: AnyObj[] = [];
    /** Next drop column from the shuffled sweep (jittered inside the column). */
    function pickCalX(): number {
      if (calBag.length === 0) refillCalBag();
      const col = calBag.pop() as number;
      return CAL_L + col * CAL_COL_W + CAL_COL_W * (0.2 + Math.random() * 0.6);
    }
    for (let i = 0; i < CAL_COUNT; i++) {
      const b = spawnAirborne(k, "calendar-page", sizes, {
        x: (CAL_L + CAL_R) / 2,
        y: -400,
        z: LAYERS.ACTOR,
        tag: "boulder",
        props: {
          spd: 340,
          spin: 40,
          driftAmp: 10,
          driftSpd: 1,
          driftPhase: Math.random() * Math.PI * 2,
          baseX: (CAL_L + CAL_R) / 2,
          armAt: 0,
          falling: false,
          marker: null as null | {
            pos: { x: number; y: number };
            destroy: () => void;
            opacity: number;
          },
        },
      });
      b.use(k.rotate(0));
      calPages.push(b);
      /** Park the page off-screen and schedule its next telegraphed drop. */
      const rearm = () => {
        b.falling = false;
        b.pos = k.vec2((CAL_L + CAL_R) / 2, -600);
        b.armAt = k.time() + 0.05 + Math.random() * 0.28;
      };
      rearm();
      b.onUpdate(() => {
        const now = k.time();
        if (calDone) return;
        if (!b.falling) {
          // Only rain while the player is actually in the waiting zone.
          if (player.pos.x < mx0 - 200 || player.pos.x > mx0 + BIOME_W + 200) return;
          // Wait for this page's turn AND for the global spacing gap.
          if (now < b.armAt || now < calNextDropAt) return;
          calNextDropAt = now + CAL_MIN_GAP;
          const nx = pickCalX();
          b.baseX = nx;
          b.pos = k.vec2(nx, -80);
          b.spd = 329 + Math.random() * 105; // 30% slower than 470-620
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

    /** Sweep every page (and its shadow marker) out of the sky, for good. */
    function clearCalendarRain() {
      if (calDone) return;
      calDone = true;
      for (const page of calPages) {
        if (page.falling) sparkleBurst(page.pos.x, page.pos.y, [255, 255, 255]);
        page.falling = false;
        page.pos = k.vec2((CAL_L + CAL_R) / 2, -900);
        if (page.marker) {
          try {
            page.marker.destroy();
          } catch {
            /* marker already gone */
          }
          page.marker = null;
        }
      }
      showHint("Approved — the calendar stops. Head right to the door.", 3.5);
    }

    addSpeech(k, mx0 + 500, 90, "Awaiting a decision…", [50, 40, 80]);
    // Entrance signpost: the same instruction as the briefing, for anyone who
    // clicked past the step screen.
    addSignPlaque(
      k,
      mx0 + 150,
      GROUND_Y - 210,
      isCoarsePointer()
        ? "Dodge the dates 10 seconds. Pull the stick DOWN for your umbrella."
        : "Dodge the dates 10 seconds. Hold DOWN for your umbrella.",
      "AWAITING DECISION",
    );
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
    // The plans used to sit on the ground in the running path, so the first
    // one got collected by accident. Each plan now sits on its OWN high
    // platform reached by its own step-up BLOCK that rests on the ground —
    // a solid pillar, not a floating ledge, so there is nothing to get
    // wedged under while dodging the bear's paperwork.
    //
    // Physics budget: gravity 1800, JUMP_VEL 720 -> max rise 144px.
    // Peak feet = GROUND_Y - 144, peak head = GROUND_Y - 210 (hero 66 tall).
    // Plan platform underside (GROUND_Y - 252) sits above that peak head, so
    // a full jump anywhere under a plan island never bonks a ceiling.
    // The whole plan area is also placed LEFT of the bear's patrol range
    // (he roams BIOME_W*6 + 840 .. +1260) so the fight lane stays clear floor.
    const PLAN_PLAT_TOP = GROUND_Y - 240; // underside ≈ GROUND_Y - 252
    const PLAN_STEP_TOP = GROUND_Y - 112; // pillar top: 144px jump reaches -256
    // IMPORTANT: the ride/snap system treats a platform's pos as its TOP-LEFT
    // corner (plat.pos.y is the walkable surface, plat.pos.x the left edge).
    // These are positioned that way — a centered anchor made the hero snap to
    // the block's mid-height and jam against its side.
    const addStaticPlat = (cx: number, topY: number, w: number, h: number) => {
      const left = cx - w / 2;
      k.add([
        k.rect(w, h),
        k.pos(left, topY),
        k.color(200, 195, 210),
        k.outline(2, k.rgb(90, 90, 110)),
        k.area(),
        k.body({ isStatic: true }),
        k.z(LAYERS.PLATFORM),
        "platform",
        { platformSpeed: k.vec2(0, 0), lastPos: k.vec2(left, topY) },
      ]);
    };

    const planDefs: Array<{ x: number; sprite: string; label: string }> = [
      { x: kx0 + 300, sprite: "plan-blue", label: "Blue Cross / Blue Shield" },
      { x: kx0 + 520, sprite: "plan-green", label: "HealthPartners" },
      { x: kx0 + 740, sprite: "plan-orange", label: "Medica" },
    ];
    for (const p of planDefs) {
      const dh = DISPLAY_H[p.sprite];
      const dw = displaySize(p.sprite, sizes).w;
      // Its own island up top…
      addStaticPlat(p.x, PLAN_PLAT_TOP, 128, 14);
      // …and its own step-up: a solid block standing ON the ground just left
      // of the island (8px air gap). Nothing overhangs the running lane, and
      // it can be mounted from either side.
      addStaticPlat(p.x - 104, PLAN_STEP_TOP, 64, 112);
      k.add([
        k.rect(dw + 12, 10),
        k.pos(p.x, PLAN_PLAT_TOP),
        k.anchor("bot"),
        k.color(120, 100, 80),
        k.outline(2, k.rgb(60, 45, 30)),
        k.z(LAYERS.PROP - 1),
      ]);
      const item = k.add([
        k.sprite(p.sprite, { width: dw, height: dh }),
        k.pos(p.x, PLAN_PLAT_TOP - 10),
        k.anchor("bot"),
        // Same convention as every other pickup: with anchor("bot") the shape
        // origin is the sprite's bottom-left, so this box exactly covers the
        // drawn card. (A hand-rolled offset here shifted the box off the art
        // and made touches silently miss.)
        k.area({ shape: new k.Rect(k.vec2(0, 0), dw, dh) }),
        k.z(LAYERS.PROP),
        "plan-pick",
        "plan-choice-ui",
        { planLabel: p.label, bonus: 800 },
      ]) as AnyObj;
      void item;
      markCollectible(k, item, {
        label: "PICK ONE",
        width: dw,
        height: dh,
        anchorBot: true,
        topLift: 24,
      });
      addSpeech(k, p.x, PLAN_PLAT_TOP - dh - 26, p.label, [30, 30, 60], "plan-choice-ui");
    }
    addSpeech(
      k,
      kx0 + 520,
      GROUND_Y - 186,
      "Step up and pick ONE plan",
      [30, 60, 120],
      "plan-choice-ui",
    );




    zoneObjectives[6] = {
      hudLabel: () =>
        zoneState.hasKey
          ? "KEY ✓"
          : zoneState.bossDefeated
            ? "GRAB KEY →"
            : zoneState.planPicked
              ? `BOSS ${zoneState.bossHits}/4`
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
    const STEP_GAP_X = 110; // matches Z7_GAP1 above so the pole lands on ground
    const STEP_START_X = cx0 + 260;
    // (Lethal gap water plane is created with the ground split for Zone 7.)
    for (let i = 0; i < stepCount; i++) {
      const sxi = STEP_START_X + i * STEP_GAP_X;
      const syi = stairY0 - 60 - i * 45;
      k.add([
        k.rect(72, 14),
        k.pos(sxi, syi),
        k.color(200, 195, 210),
        k.outline(2, k.rgb(90, 90, 110)),
        k.area(),
        k.body({ isStatic: true }),
        k.z(LAYERS.PLATFORM),
        "platform",
        { platformSpeed: k.vec2(0, 0), lastPos: k.vec2(sxi, syi) },
      ]);
    }
    // Top landing + medical ID card. Landing width kept short so it ends
    // BEFORE the fire pole — otherwise the solid platform blocks the slide.
    const topLandingX = STEP_START_X + stepCount * STEP_GAP_X + 20;
    const topLandingY = stairY0 - 60 - stepCount * 45;
    const topLanding = k.add([
      k.rect(72, 14),
      k.pos(topLandingX, topLandingY),
      k.color(200, 195, 210),
      k.outline(2, k.rgb(90, 90, 110)),
      k.area(),
      k.body({ isStatic: true }),
      k.z(LAYERS.PLATFORM),
      "platform",
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
      idItem.onUpdate(() => {
        idItem.pos.y = idItem.basY + Math.sin(k.time() * 2.5) * 4;
      });
      markCollectible(k, idItem, { label: "GRAB", width: idW, height: idH });
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
    k.add([
      // pole cap
      k.circle(10),
      k.pos(poleX, poleTop),
      k.color(255, 215, 80),
      k.outline(2, k.rgb(140, 100, 30)),
      k.z(LAYERS.PROP + 2),
    ]);
    // Victory pennant. It flies at the top of the pole until the hero grabs
    // on, then rides down with him — held just above his head — and stays
    // planted at the base for the walk to the clinic.
    const flagMastY = poleTop + 4;
    const flagBaseY = poleBaseY - 34;
    const flagPennant = k.add([
      k.rect(22, 15),
      k.pos(poleX + 4, flagMastY),
      k.color(255, 215, 70),
      k.outline(2, k.rgb(140, 100, 30)),
      k.z(LAYERS.PROP + 3),
      "pole-flag",
      { mastY: flagMastY, baseY: flagBaseY },
    ]) as AnyObj;
    flagPennant.onUpdate(() => {
      // A gentle two-frame flutter keeps it alive without leaving the mast.
      flagPennant.pos.x = poleX + 4 + (Math.floor(k.time() * 4) % 2 === 0 ? 0 : 1);
      if (zoneState.firePoleAttached && !zoneState.firePoleDone) {
        // Ride the slide: pinned just above the hero for the whole descent.
        flagPennant.pos.y = Math.min(flagBaseY, Math.max(flagMastY, player.pos.y - 84));
      } else if (zoneState.firePoleDone) {
        flagPennant.pos.y = flagBaseY;
      }
    });
    // Trigger areas for fire pole (attach) and finish base (base of pole).
    k.add([
      k.rect(24, poleBaseY - poleTop),
      k.pos(poleX - 12, poleTop),
      k.area(),
      k.opacity(0),
      "fire-pole",
      { poleX, poleTop, poleBaseY },
    ]);
    k.add([k.rect(60, 30), k.pos(poleX - 30, poleBaseY - 10), k.area(), k.opacity(0), "pole-base"]);
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

    // ===== "Still needed" checklist (failure screen) =====
    // What the player had left to do on the step they died on. Every entry is
    // derived from the same `zoneState` the HUD objective badge reads, so the
    // checklist can never disagree with what the badge said a frame earlier.
    type StillNeeded = { done: boolean; label: string };
    function remainingTasks(zone: number): StillNeeded[] {
      const t = (done: boolean, label: string): StillNeeded => ({ done, label });
      switch (zone) {
        case 0:
          return [t(zoneState.methodTouched, "Pick how you want to apply")];
        case 1:
          return [
            t(zoneState.userGot, "Collect your username"),
            t(zoneState.passGot, "Collect your password"),
          ];
        case 2:
          return [t(zoneObjectives[2]?.met() ?? false, "Cross the river to the door")];
        case 3:
          return [
            t(
              zoneState.docsInZone >= 3,
              `Gather ${Math.max(0, 3 - zoneState.docsInZone)} more verification document${
                3 - zoneState.docsInZone === 1 ? "" : "s"
              }`,
            ),
          ];
        case 4: {
          const left = Math.max(0, zoneState.repliesNeeded - zoneState.repliesGot);
          return [
            t(left === 0, `Send ${left} more repl${left === 1 ? "y" : "ies"} to the request`),
          ];
        }
        case 5:
          return [t(zoneObjectives[5]?.met() ?? false, "Survive the 10-second wait")];
        case 6:
          return [
            t(zoneState.planPicked, "Pick a health plan"),
            t(zoneState.bossDefeated, "Get past the bear"),
            t(zoneState.hasKey, "Grab the key"),
          ];
        case 7:
          return [
            t(zoneState.idCardCollected, "Grab your medical ID card"),
            t(zoneState.firePoleDone, "Slide down the pole to the clinic"),
          ];
        default:
          return [];
      }
    }

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
              x: fx,
              z: LAYERS.PROP,
              tag: "checkpoint",
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
      k.sprite("hero-idle", {
        width: displaySize("hero-idle", sizes).w,
        height: DISPLAY_H["hero-idle"],
      }),
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
        airJumpsLeft: 1,
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
        visitedZones: new Set<number>([
          Math.min(ZONES.length - 1, Math.max(0, Math.floor(spawnX / BIOME_W))),
        ]),
        riding: null as null | {
          pos: { x: number; y: number };
          platformSpeed: { x: number; y: number };
          width: number;
          height: number;
        },
        animState: "idle" as "idle" | "walk" | "jump" | "slide",
        animTick: 0,
        walkFrame: 0,
        slideFrame: 0,
      },
    ]);
    // A recovery restart resumes the run in progress: score, lives, documents
    // and counters all carry over so the finished run reports honest numbers.
    if (resume) {
      player.score = resume.score;
      player.lives = Math.max(1, resume.lives);
      player.maxLives = Math.max(player.lives, resume.maxLives);
      player.docs = new Set(resume.docs);
      player.deaths = resume.deaths;
      player.distancePx = resume.distancePx;
      player.jumpsLanded = resume.jumpsLanded;
      player.enemiesPassed = resume.enemiesPassed;
      player.farthestZone = Math.max(player.farthestZone, resume.farthestZone);
    }

    // Debug hook so QA/Playwright can inspect live game state.
    if (typeof window !== "undefined") {
      (window as unknown as { __gameDebug?: unknown }).__gameDebug = {
        k,

        player,
        doors,
        zoneState,
        zoneObjectives,
        BIOME_W,
        GROUND_Y,
        ZONES_LEN: ZONES.length,
      };
    }

    // Manual animation: swap sprite per state. All hero frames share size
    // (grouped in the trim step), so swapping never causes horizontal jitter.
    let currentSpriteName = "hero-idle";
    function setSprite(name: string) {
      // Pre-mirrored "-left" frames can fail to register on memory-constrained
      // mobile browsers. When we end up on a right-facing frame while facing
      // left, flip at render time so the hero always turns instead of
      // moon-walking backwards.
      const wantFlip = player.facing < 0 && !name.endsWith("-left");
      if (player.flipX !== wantFlip) player.flipX = wantFlip;
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

    /** Turn the hero right (toward the bear, who always comes from the right)
     *  and refresh his sprite so the mirrored frames update immediately. */
    function faceTheBear() {
      player.facing = 1;
      player.flipX = false;
      setSprite(`hero-idle${facingSuffix("hero-idle")}`);
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
      // Every rideable platform carries a speed vector; a platform without one
      // would crash the ride maintenance, so treat it as not rideable.
      const speed = c.platformSpeed;
      if (!speed || typeof speed.x !== "number" || typeof speed.y !== "number") return null;
      // Return the object ITSELF, never a copy. Zone 3's collapsing platforms
      // compare `player.riding === plat` to release the ride when they let go;
      // a fresh copy every frame made that check impossible and the hero kept
      // standing on a platform that had already dropped away.
      if ((c as { phase?: string }).phase === "falling") return null;
      return p as PlatformRide;
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
      const nearTop =
        feetY >= plat.pos.y - PLATFORM_SNAP_TOLERANCE &&
        feetY <= plat.pos.y + PLATFORM_SNAP_TOLERANCE;
      if (nearTop || col?.isBottom()) snapToPlatform(plat);
    });

    // ================= Power-ups (Navigator / Live Chat / Email) =================
    // Every pickup is driven by PowerUpManager, which is driven by the flags.
    // Nothing here asks about a flag directly.
    const POWERUP_STYLE: Record<PowerUpKind, { fill: [number, number, number]; glyph: string }> = {
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
      const W = 54,
        H = 30;
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
        k.text(style.glyph, { size: 13, font: UI_FONT }),
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
      const obj = p as unknown as {
        kind: PowerUpKind;
        pos: { x: number; y: number };
        destroy: () => void;
      };
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
          k.text(navLabel, { size: navSize, font: UI_FONT }),
          k.pos(0, 0),
          k.anchor("center"),
          k.color(0, 0, 0),
          k.z(LAYERS.EFFECT + 1),
        ]) as AnyObj;
        const navText = k.add([
          k.text(navLabel, { size: navSize, font: UI_FONT }),
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
      // The umbrella only exists while the player holds Down — the Email
      // power-up makes sheltering free of the slow-down, it does not open it.
      umbrella.opacity = umbrellaState.up ? 1 : 0;

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
      const textOpts: Record<string, unknown> = { size: fs, font: UI_FONT };
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
        set text(v: string) {
          for (const n of halo) n.text = tr(v);
        },
        set opacity(v: number) {
          for (const n of halo) n.opacity = v;
        },
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
        get text() {
          return main.text as string;
        },
        set text(v: string) {
          main.text = tr(v);
          shadow.text = tr(v);
        },
        get opacity() {
          return main.opacity as number;
        },
        set opacity(v: number) {
          main.opacity = v;
          shadow.opacity = v;
        },
        setPos(x: number, y: number) {
          main.pos = k.vec2(x, y);
          shadow.setPos(x, y);
        },
      };
    }

    pixelHudText({
      x: 12,
      y: 12,
      size: 14,
      color: [30, 160, 60],
      initial: "BLAZING THE TRAIL",
    });

    // Score row (above the applications-as-lives row).
    const scoreHud = pixelHudText({
      x: 12,
      y: 34,
      size: 16,
      color: [255, 235, 120],
      initial: "SCORE 0",
    });
    // Run clock — the whole run is timed, and faster steps pay bonus points.
    const timeHud = pixelHudText({
      x: 190,
      y: 34,
      size: 16,
      color: [180, 235, 255],
      initial: "TIME 0:00",
    });

    // Applications row: little application icons that represent lives.
    // Each icon is a paper card with three horizontal "form field" lines.
    // Lives row: classic 16-bit pixel hearts.
    const HEART_PX = 3; // size of one pixel-art cell
    const HEART_MAP = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"];
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
              edge ? k.color(40, 20, 30) : shine ? k.color(255, 170, 180) : k.color(220, 45, 60),
              k.fixed(),
              k.z(LAYERS.HUD),
            ]) as AnyObj,
          );
        }
      });
      appIcons.push({ cells });
    }
    const docsHud = pixelHudText({
      x: k.width() - 12,
      y: 12,
      size: 14,
      color: [255, 255, 255],
      anchor: "topright",
    });
    // Per-zone objective badge, top-right under the "AFTER FEEDBACK" chip.
    const objectiveHud = pixelHudText({
      x: k.width() - 12,
      y: 34,
      size: 14,
      color: [255, 220, 90],
      anchor: "topright",
    });
    // Hint bubble that pops up when player bumps a locked door.
    let hintUntil = 0;
    const hintHud = pixelHudText({
      x: k.width() / 2,
      y: k.height() - 60,
      size: 14,
      color: [255, 255, 255],
      anchor: "center",
      width: 460,
      align: "center",
      opacity: 0,
    });
    function showHint(msg: string, seconds = 1.8) {
      hintHud.text = tr(msg);
      hintHud.opacity = 1;
      hintUntil = k.time() + seconds;
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
      x: k.width() / 2,
      y: 22,
      size: 12,
      color: [255, 220, 90],
      anchor: "top",
      initial: "AWAITING DECISION",
      opacity: 0,
    });
    const waitCountdown = pixelHudText({
      x: k.width() / 2,
      y: 40,
      size: 28,
      color: [255, 255, 255],
      anchor: "top",
      initial: "0:30",
      opacity: 0,
    });

    // ===== ACTIVE UPGRADES panel =====
    // Sits to the RIGHT of the score/lives block in the top-left HUD cluster so
    // it never covers the player or the playfield floor.
    const UPG_ROWS = 5;
    const UPG_X = Math.round(150 * HUD_S); // just right of the 5 life hearts
    const UPG_Y = 30; // aligned with the SCORE row
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
      x: UPG_X + 6,
      y: UPG_Y + 5,
      size: 8,
      color: [255, 220, 90],
      anchor: "topleft",
      initial: "ACTIVE UPGRADES",
      opacity: 0,
    });
    const upgRows = Array.from({ length: UPG_ROWS }, () =>
      pixelHudText({
        x: UPG_X + 6,
        y: 0,
        size: 8,
        color: [255, 255, 255],
        anchor: "topleft",
        opacity: 0,
      }),
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
        t.text = tr(`${row.carried ? "✓" : "○"} ${row.label}`);
        t.setPos(UPG_X + 6, UPG_Y + 17 + i * UPG_ROW_H);
      });
    }

    function updateHud() {
      scoreHud.text = tr(`SCORE ${Math.max(0, Math.round(player.score))}`);
      {
        const t = runClock();
        timeHud.text = tr(`TIME ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`);
      }

      appIcons.forEach((g, i) => {
        const op = i < player.lives ? 1 : i < player.maxLives ? 0.25 : 0;
        g.cells.forEach((c: AnyObj) => (c.opacity = op));
      });
      updateUpgradePanel();
      const need = ["ID", "Income", "Household"].filter((d) => !player.docs.has(d));
      docsHud.text =
        player.docs.size > 0
          ? need.length
            ? `Application docs needed: ${need.join(", ")}`
            : "Application docs: complete ✓"
          : "";
      const z = player.farthestZone;
      const obj = zoneObjectives[z];
      objectiveHud.text = tr(obj ? obj.hudLabel() : "");

      // Zone-5 big countdown: visible while player is in Zone 5 with an
      // active wait timer, or briefly flashes APPROVED! at 0.
      const inZone5 = Math.floor(player.pos.x / BIOME_W) === 5;
      const started = zoneState.waitStart > 0;
      const elapsed = started ? k.time() - zoneState.waitStart : 0;
      const remaining = started ? Math.max(0, zoneState.waitDur - elapsed) : zoneState.waitDur;
      const approvedFlash =
        started && elapsed >= zoneState.waitDur && elapsed < zoneState.waitDur + 1.5;
      // Survived the wait: the rain is over for the rest of this zone.
      if (started && elapsed >= zoneState.waitDur) clearCalendarRain();
      const showTimer = inZone5;
      if (showTimer) {
        waitBg.opacity = 0.85;
        waitLabel.opacity = 1;
        waitCountdown.opacity = 1;
        if (approvedFlash) {
          waitLabel.text = tr("APPROVED!");
          waitCountdown.text = tr("✓");
          // Color for this label is set on the node itself; nothing to do here.
        } else {
          waitLabel.text = tr(started ? "AWAITING DECISION" : "STEP INTO THE MOUNTAIN");
          const secs = Math.ceil(remaining);
          waitCountdown.text = tr(`0:${String(secs).padStart(2, "0")}`);
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
    let pausedObjs: AnyObj[] = [];

    const isPaused = () => pausedNow;

    /** Tells the controller bridge whether a prompt/card is asking for input,
     *  so a jump press only doubles as "continue" while one is showing. */
    const setPromptFlag = (open: boolean) => {
      try {
        (window as unknown as { __gamePrompt?: boolean }).__gamePrompt = open;
      } catch {
        /* SSR / locked-down window */
      }
    };

    function pauseGameplay() {
      if (pausedNow) return;
      pausedNow = true;
      setPromptFlag(true);
      pauseStartedAt = k.time();
      pausedObjs = (k.get("*", { recursive: true }) as unknown as AnyObj[]).filter(
        (o) => !o.paused,
      );
      for (const o of pausedObjs) o.paused = true;
    }


    function resumeGameplay() {
      if (!pausedNow) return;
      const frozenFor = k.time() - pauseStartedAt;
      pausedTotal += frozenFor;

      pausedNow = false;
      setPromptFlag(!!pendingLose);

      for (const o of pausedObjs) {
        try {
          o.paused = false;
        } catch {
          /* destroyed while paused */
        }
      }
      pausedObjs = [];
      // Shift every wall-clock deadline forward so the pause costs no time.
      if (zoneState.waitStart > 0) zoneState.waitStart += frozenFor;
      player.invulnUntil += frozenFor;
      player.lastGroundedAt += frozenFor;
      if (hintUntil > 0) hintUntil += frozenFor;
    }

    type StepIcon = {
      sprite?: string;
      glyph?: string;
      shape?: "platform" | "stairs";
      label: string;
      /** Enemies/hazards: captioned in red with an AVOID tag. */
      danger?: boolean;
    };
    type StepScreen = { title: string; subtitle: string; lines: string[]; icons: StepIcon[] };
    const STEP_SCREENS: StepScreen[] = [
      {
        title: "STEP 1 · SELECTING YOUR APPLICATION TYPE",
        subtitle: "Finding the Trail",
        lines: [
          `${jumpPrompt()} to hit the brick and collect your application.`,
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
          "Account Locks hurt — jump OVER them; stomping does not work.",
        ],
        icons: [
          { sprite: "username", label: "USERNAME" },
          { sprite: "password", label: "PASSWORD" },
          { sprite: "padlock", label: "ACCOUNT LOCK", danger: true },
        ],
      },
      {
        title: "STEP 3 · COMPLETING YOUR APPLICATION",
        subtitle: "Crossing the River of Paperwork",
        lines: [
          "Platforms fall away once you step on them — keep moving!",
          "Reaching the other side unlocks the exit door.",
        ],
        icons: [{ shape: "platform", label: "PLATFORM" }],
      },
      {
        title: "STEP 4 · GATHER YOUR DOCUMENTS",
        subtitle: "Gathering Supplies",
        lines: [
          "Collect all 3 required documents.",
          "Evil Clipboards hurt — jump OVER them; stomping does not work.",
        ],
        icons: [
          { sprite: "id", label: "ID" },
          { sprite: "paystub", label: "INCOME" },
          { sprite: "envelope", label: "HOUSEHOLD" },
          { sprite: "form-monster", label: "EVIL CLIPBOARD", danger: true },
        ],
      },
      {
        title: "STEP 5 · RESPOND TO REQUEST",
        subtitle: "Answering the Call",
        lines: [
          "Collect all 4 mailboxes.",
          "Monster Envelopes hurt — jump OVER them; stomping does not work.",
        ],
        icons: [
          { sprite: "mailbox", label: "MAILBOX" },
          { sprite: "envelope-gremlin-0", label: "MONSTER ENVELOPE", danger: true },
        ],
      },
      {
        title: "STEP 6 · AWAITING DECISION",
        subtitle: "Waiting Mountain",
        lines: [
          "Avoid the falling calendar dates for 10 seconds.",
          "A date that touches you costs a life and restarts the 10 seconds.",
          isCoarsePointer()
            ? "NEW: pull the joystick DOWN to raise your umbrella — dates bounce off"
            : "NEW: hold DOWN (↓ / S / stick down) to raise your umbrella — dates bounce off",
          "(you move slower under it). Survive 10 seconds and the dates stop —",
          "then walk right through the unlocked door.",
        ],
        icons: [{ sprite: "calendar-page", label: "FALLING DATE", danger: true }],
      },
      {
        title: "STEP 7 · SELECTING YOUR MANAGED CARE PLAN",
        subtitle: "Choosing Your Path",
        lines: [
          "Three managed care plans are waiting ahead.",
          "Walk up to one and select it to move forward.",
        ],
        icons: [
          { sprite: "plan-blue", label: "PLAN" },
          { sprite: "plan-green", label: "PLAN" },
          { sprite: "plan-orange", label: "PLAN" },
        ],
      },

      {
        title: "STEP 8 · USING YOUR COVERAGE",
        subtitle: "Coverage Begins",
        lines: ["Climb the staircase.", "Collect your Medical ID Card."],
        icons: [
          { shape: "stairs", label: "STAIRS" },
          { sprite: "medical-id", label: "MEDICAL ID CARD" },
        ],
      },
    ];

    const stepScreensShown = new Set<number>();
    let stepScreenOpen = false;

    /** Pseudo-zone index for the hidden bonus stage briefing. */
    const BONUS_STEP_ID = -7;
    const BONUS_STEP_SCREEN: StepScreen = {
      title: "SECRET · PORTLAND WATERFRONT",
      subtitle: "You found the hidden trail!",
      lines: [
        "There are no enemies here — nothing in this pocket can hurt you.",
        "Grab the coffee, donuts and cart snacks for extra points.",
        "Look up high for an extra life.",
        "When you're done, walk into the EXIT door on the right.",
        "The door drops you at the start of Step 3.",
      ],
      icons: [
        { shape: "platform", label: "TREATS" },
        { glyph: "+", label: "EXTRA LIFE" },
        { sprite: "door-open", label: "EXIT DOOR" },
      ],
    };

    /** Pause the run and show the briefing for `z` — once per run per zone. */
    function showStepScreen(z: number, onDone?: () => void, custom?: StepScreen) {
      const data = custom ?? STEP_SCREENS[z];
      if (!data || stepScreenOpen || stepScreensShown.has(z) || player.dead || player.won) {
        onDone?.();
        return;
      }
      stepScreensShown.add(z);
      stepScreenOpen = true;
      pauseGameplay();


      let nodes: AnyObj[] = [];
      let promptNode: AnyObj | null = null;
      let closed = false;

      function render() {
        for (const n of nodes) {
          try {
            n.destroy();
          } catch {
            /* ignore */
          }
        }
        nodes = [];

        const W = k.width();
        const H = k.height();
        // Type is enlarged so it stays physically readable in a small CSS box,
        // then capped to what the panel can actually hold — otherwise windowed
        // play pushes headings and the prompt outside the card.
        const S = computeFittedUiScale(opts.canvas, W, H, 780, 430);
        UI_TEXT_SCALE = S;
        const px = (n: number) => Math.round(n * S);
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
        k.rect(panelW, panelH, { radius: 6 }),
        k.pos(panelX, panelY),
        k.color(16, 22, 52),
        k.outline(4, k.rgb(255, 220, 90)),
        k.fixed(),
        k.z(301),
      ]);

      // Ranger guide stands at the left edge of the panel and "delivers" the
      // briefing; the text column shifts right so nothing overlaps him.
      const rangerW = Math.max(px(70), Math.min(px(130), Math.floor(panelW * 0.19)));
      const rangerH = Math.min(panelH - px(56), Math.floor(rangerW / 0.677));
      put([
        k.sprite("ranger-guide", { width: Math.floor(rangerH * 0.677), height: rangerH }),
        k.pos(panelX + px(10) + rangerW / 2, panelY + panelH - px(14)),
        k.anchor("bot"),
        k.fixed(),
        k.z(302),
      ]);

      const textW = panelW - rangerW;
      const cx = Math.floor(panelX + rangerW + textW / 2);
      let y = panelY + px(26);
      const label = (
        text: string,
        size: number,
        rgb: [number, number, number],
        width?: number,
        opts?: { fit?: boolean; min?: number },
      ) => {
        let fs = Math.max(opts?.min ?? 15, px(size));
        // Headings must never clip on a short landscape phone: shrink a single
        // long line to the panel width instead of letting it run off the card.
        if (opts?.fit && width) {
          const longest = Math.max(...text.split("\n").map((l) => l.length), 1);
          fs = Math.max(opts.min ?? 11, Math.min(fs, (width * 1.28) / longest));
        }
        fs = Math.round(fs);
        put([
          k.text(text, {
            size: fs,
            font: UI_FONT,
            align: "center",
            ...(width ? { width } : {}),
          }),
          k.pos(cx + 1, y + 1),
          k.anchor("top"),
          k.color(0, 0, 0),
          k.fixed(),
          k.z(302),
        ]);
        const main = put([
          k.text(text, {
            size: fs,
            font: UI_FONT,
            align: "center",
            ...(width ? { width } : {}),
          }),
          k.pos(cx, y),
          k.anchor("top"),
          k.color(...rgb),
          k.fixed(),
          k.z(303),
        ]);
        y += (main.height ?? fs) + px(8);
      };

      label(data.title, 24, [255, 220, 90], textW - px(48), { fit: true, min: 11 });
      label(data.subtitle, 17, [180, 205, 255], textW - px(48), { fit: true, min: 10 });
      y += px(4);
      label(data.lines.map((l) => `• ${l}`).join("\n"), 19, [245, 245, 245], textW - px(60));
      // Enemy zones repeat the one rule new players miss, in danger red.
      if (data.icons.some((i) => i.danger)) {
        label("! NEVER TOUCH A RED-MARKED ENEMY — JUMP OVER IT !", 17, [255, 120, 110], textW - px(60));
      }

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
            k.sprite(icon.sprite, {
              width: Math.max(8, disp.w * scale),
              height: Math.max(8, nativeH * scale),
            }),
            k.pos(ix, centerY),
            k.anchor("center"),
            k.fixed(),
            k.z(303),
          ]);
        } else if (icon.glyph) {
          put([
            k.rect(px(30), px(9)),
            k.pos(ix, centerY),
            k.anchor("center"),
            k.color(60, 210, 120),
            k.outline(2, k.rgb(255, 255, 255)),
            k.fixed(),
            k.z(303),
          ]);
          put([
            k.rect(px(9), px(30)),
            k.pos(ix, centerY),
            k.anchor("center"),
            k.color(60, 210, 120),
            k.outline(2, k.rgb(255, 255, 255)),
            k.fixed(),
            k.z(303),
          ]);
        } else if (icon.shape === "platform") {
          put([
            k.rect(px(54), px(14)),
            k.pos(ix, centerY),
            k.anchor("center"),
            k.color(240, 230, 200),
            k.outline(2, k.rgb(60, 45, 25)),
            k.fixed(),
            k.z(303),
          ]);
        } else {
          for (let s = 0; s < 3; s++) {
            put([
              k.rect(px(18), px(10)),
              k.pos(ix - px(18) + s * px(18), centerY + px(16) - s * px(10)),
              k.anchor("center"),
              k.color(200, 195, 210),
              k.outline(2, k.rgb(90, 90, 110)),
              k.fixed(),
              k.z(303),
            ]);
          }
        }
        // Captions must never wrap mid-word ("APPLICATIO / N"): shrink the
        // font until the whole label fits the cell on a single line.
        const cellW = Math.min(iconBox + gap, (textW - px(24)) / data.icons.length);
        const capSize = Math.max(
          9,
          Math.min(px(12), Math.floor(cellW / Math.max(1, icon.label.length * 0.58))),
        );
        put([
          k.text(icon.label, { size: capSize, font: UI_FONT, align: "center" }),
          k.pos(ix, centerY + iconBox / 2 + px(12)),
          k.anchor("top"),
          icon.danger ? k.color(255, 120, 110) : k.color(200, 215, 255),
          k.fixed(),
          k.z(303),
        ]);
        if (icon.danger) {
          put([
            k.text("AVOID", { size: capSize, font: UI_FONT, align: "center" }),
            k.pos(ix, centerY + iconBox / 2 + px(12) + capSize + px(4)),
            k.anchor("top"),
            k.color(255, 220, 90),
            k.fixed(),
            k.z(303),
          ]);
        }

        ix += iconBox + gap;
      }

        promptNode = put([
          k.text(CONTINUE_PROMPT(), { size: Math.max(14, px(16)), font: UI_FONT }),
          k.pos(cx, panelY + panelH - px(30)),
          k.anchor("center"),
          k.opacity(1),
          k.color(255, 235, 120),
          k.fixed(),
          k.z(303),
        ]);

        // Continue: Enter / Space / click on desktop, tap anywhere on mobile.
        const hitArea = put([
          k.rect(W, H),
          k.pos(0, 0),
          k.opacity(0),
          k.area(),
          k.fixed(),
          k.z(305),
        ]);
        hitArea.onClick(() => close());
      }

      render();
      // Rebuild at the new size whenever the window resizes or the player
      // enters / leaves fullscreen while the briefing is up.
      const relayout = () => {
        if (closed) return;
        render();
      };
      uiRelayout.add(relayout);

      const keyHandlers = ["enter", "space", "kpenter"].map((key) =>
        k.onKeyPress(key as never, () => close()),
      );
      // Attract mode reads the briefing for the audience, then moves on.
      if (DEMO) k.wait(2.8, () => close());
      const blink = k.onUpdate(() => {
        if (promptNode) promptNode.opacity = Math.floor(k.time() * 2) % 2 === 0 ? 1 : 0.3;
      });
      function close() {
        if (closed) return;
        closed = true;
        for (const h of keyHandlers) {
          try {
            h.cancel();
          } catch {
            /* ignore */
          }
        }
        try {
          blink.cancel();
        } catch {
          /* ignore */
        }
        for (const n of nodes) {
          try {
            n.destroy();
          } catch {
            /* ignore */
          }
        }
        stepScreenOpen = false;
        resumeGameplay();
        // Zone 2 onward: a one-second grace window so nothing parked near the
        // entrance can land a hit the instant the briefing closes.
        if (z >= 1) player.invulnUntil = Math.max(player.invulnUntil, k.time() + 1);
        // Movement must be re-armed: a finger already on the D-pad when the
        // panel was dismissed should not launch the hero.
        leftArmed = false;
        rightArmed = false;
        if (w?.__gameInput) w.__gameInput.jumpReq = false;
        uiRelayout.delete(relayout);
        onDone?.();
      }
    }

    /**
     * Zone 7: "get ready" card, then a short scripted charge-in so the boss
     * fight never starts out of nowhere. Calls `onReady()` when the bear has
     * arrived and control should return to the player.
     */
    function showBossReadyPrompt(onReady: () => void) {
      if (stepScreenOpen) {
        onReady();
        return;
      }
      stepScreenOpen = true;
      pauseGameplay();

      let nodes: AnyObj[] = [];
      let promptNode: AnyObj | null = null;
      let closed = false;

      function render() {
        for (const n of nodes) {
          try {
            n.destroy();
          } catch {
            /* ignore */
          }
        }
        nodes = [];

        const W = k.width();
        const H = k.height();
        const S = computeFittedUiScale(opts.canvas, W, H, 660, 300);
        UI_TEXT_SCALE = S;
        const px = (n: number) => Math.round(n * S);
        const put = (parts: unknown[]) => {
          const o = k.add(parts as never) as AnyObj;
          nodes.push(o);
          return o;
        };

      put([k.rect(W, H), k.pos(0, 0), k.color(0, 0, 0), k.opacity(0.86), k.fixed(), k.z(300)]);
      const panelW = Math.min(px(660), W - px(32));
      const panelH = Math.min(px(300), H - px(20));
      const panelX = Math.floor(W / 2 - panelW / 2);
      const panelY = Math.floor(H / 2 - panelH / 2);
      put([
        k.rect(panelW, panelH, { radius: 6 }),
        k.pos(panelX, panelY),
        k.color(16, 22, 52),
        k.outline(4, k.rgb(255, 220, 90)),
        k.fixed(),
        k.z(301),
      ]);
      const cx = Math.floor(panelX + panelW / 2);
      let y = panelY + px(30);
      const label = (text: string, size: number, rgb: [number, number, number], width?: number) => {
        const fs = Math.max(15, px(size));
        put([
          k.text(text, {
            size: fs,
            font: UI_FONT,
            align: "center",
            ...(width ? { width } : {}),
          }),
          k.pos(cx + 1, y + 1),
          k.anchor("top"),
          k.color(0, 0, 0),
          k.fixed(),
          k.z(302),
        ]);
        const main = put([
          k.text(text, {
            size: fs,
            font: UI_FONT,
            align: "center",
            ...(width ? { width } : {}),
          }),
          k.pos(cx, y),
          k.anchor("top"),
          k.color(...rgb),
          k.fixed(),
          k.z(303),
        ]);
        y += (main.height ?? fs) + px(10);
      };
      label("THE BEAR IS CLOSE", 26, [255, 220, 90], panelW - px(48));
      label("Boss Battle · Choosing Your Path", 16, [180, 205, 255], panelW - px(48));
      y += px(6);
      label(
        '• Dodge the paperwork he throws — your "+" shots won\'t stop it.\n• He fires when he jumps, so watch his height.\n• Land 5 hits to win.',
        18,
        [245, 245, 245],
        panelW - px(70),
      );

        promptNode = put([
          k.text(readyPrompt(), {
            size: Math.max(14, px(16)),
            font: UI_FONT,
            align: "center",
            width: panelW - px(40),
          }),
          k.pos(cx, panelY + panelH - px(34)),
          k.anchor("center"),
          k.opacity(1),
          k.color(255, 235, 120),
          k.fixed(),
          k.z(303),
        ]);
        const hitArea = put([
          k.rect(W, H),
          k.pos(0, 0),
          k.opacity(0),
          k.area(),
          k.fixed(),
          k.z(305),
        ]);
        hitArea.onClick(() => close());
      }

      render();
      const relayout = () => {
        if (closed) return;
        render();
      };
      uiRelayout.add(relayout);

      const keyHandlers = ["enter", "space", "kpenter"].map((key) =>
        k.onKeyPress(key as never, () => close()),
      );
      if (DEMO) k.wait(2.6, () => close());
      const blink = k.onUpdate(() => {
        if (promptNode) promptNode.opacity = Math.floor(k.time() * 2) % 2 === 0 ? 1 : 0.35;
      });
      function close() {
        if (closed) return;
        closed = true;
        for (const h of keyHandlers) {
          try {
            h.cancel();
          } catch {
            /* ignore */
          }
        }
        try {
          blink.cancel();
        } catch {
          /* ignore */
        }
        for (const n of nodes) {
          try {
            n.destroy();
          } catch {
            /* ignore */
          }
        }
        stepScreenOpen = false;
        // The card paused gameplay; hand control straight back so the player
        // can move and fight the moment the briefing closes.
        resumeGameplay();

        leftArmed = false;
        rightArmed = false;
        if (w?.__gameInput) w.__gameInput.jumpReq = false;
        uiRelayout.delete(relayout);
        onReady();
      }
    }

    /** ~3s scripted entrance: the bear charges in from the woods and roars. */
    /** Zone 7 only plays its cinematic once per run. */
    let bossCinematicPlayed = false;

    /**
     * ~5s in-engine cinematic that opens Zone 7. Five one-second beats:
     * hush, rumble + falling leaves, the bear stalking in, the hero recoiling
     * in fear, then the rear-up roar that hands over to the boss theme.
     * Everything is drawn with the existing pixel sprites and blocky particles
     * so it sits inside the 16-bit look; nothing is pre-rendered video.
     */
    function playBossCinematic(onDone: () => void) {
      pauseGameplay();
      const p = player as AnyObj;
      const heroX = player.pos.x;
      // The plan is picked up on a raised island; drop the hero to the ground
      // and turn him to face the bear's approach from the right.
      p.pos.y = GROUND_Y;
      p.vel = k.vec2(0, 0);
      faceTheBear();
      const bh = DISPLAY_H["boss-idle"];
      const bw = displaySize("boss-idle", sizes).w;
      // He stalks in from off-camera on the right and stops a respectful,
      // very unrespectful, distance away.
      const bearTargetX = heroX + 300;
      const bear = k.add([

        k.sprite("boss-idle", { width: bw, height: bh }),
        k.pos(heroX + 720, GROUND_Y),
        k.anchor("bot"),
        k.opacity(0),
        k.z(LAYERS.ACTOR),
      ]) as AnyObj;
      bear.flipX = true;

      const spawned: AnyObj[] = [bear];
      const shakeUntilRef = { t: 0 };
      let t = 0;
      let beat = 0;
      let stepAt = 0;
      const baseCamY = LOGICAL_H / 2;

      const leaf = () => {
        const lx = heroX - 180 + Math.random() * 620;
        const l = k.add([
          k.rect(6, 4),
          k.pos(lx, GROUND_Y - 300 - Math.random() * 80),
          k.color(Math.random() < 0.5 ? 168 : 196, Math.random() < 0.5 ? 120 : 88, 48),
          k.anchor("center"),
          k.opacity(0.95),
          k.z(LAYERS.EFFECT),
          { life: 0, sway: Math.random() * 6 },
        ]) as AnyObj;
        l.onUpdate(() => {
          l.life += k.dt();
          l.pos.y += 70 * k.dt();
          l.pos.x += Math.sin(l.life * 3 + l.sway) * 30 * k.dt();
          l.angle = (l.angle ?? 0) + 120 * k.dt();
          if (l.pos.y > GROUND_Y - 2) {
            l.opacity -= k.dt() * 3;
          }
          if (l.opacity <= 0 || l.life > 5) l.destroy();
        });
        spawned.push(l);
      };

      const dustPuff = (x: number) => {
        const d = k.add([
          k.rect(7, 7),
          k.pos(x, GROUND_Y - 4),
          k.color(206, 194, 168),
          k.opacity(0.85),
          k.anchor("center"),
          k.z(LAYERS.EFFECT),
          { life: 0 },
        ]) as AnyObj;
        d.onUpdate(() => {
          d.life += k.dt();
          d.pos.x += 26 * k.dt();
          d.pos.y -= 22 * k.dt();
          d.opacity = Math.max(0, 0.85 - d.life * 1.9);
          if (d.life > 0.5) d.destroy();
        });
        spawned.push(d);
      };

      let bang: AnyObj | null = null;

      const ctl = k.onUpdate(() => {
        const dt = k.dt();
        t += dt;

        // Camera holds on the clearing, with impact shakes layered on top.
        const shake = shakeUntilRef.t > t ? Math.sin(t * 60) * 5 : 0;
        const camX = Math.max(VIEW_W / 2, Math.min(heroX + 90, LEVEL_END - VIEW_W / 2));
        k.setCamPos(px(camX), px(baseCamY + shake));

        // --- Beat 1 (0.0-1.0s): the clearing goes quiet ----------------------
        if (beat === 0 && t > 1.0) {
          // --- Beat 2: the ground shakes, leaves fall, something growls ------
          beat = 1;
          playSfx("rumble");
          shakeUntilRef.t = t + 0.9;
        }
        if (beat >= 1 && beat < 3 && Math.random() < 0.35) leaf();

        if (beat === 1 && t > 2.0) {
          // --- Beat 3: heavy footsteps, the bear walks into frame ------------
          beat = 2;
          bear.opacity = 1;
        }
        if (beat === 2) {
          bear.pos.x = Math.max(bearTargetX, bear.pos.x - 260 * dt);
          bear.pos.y = GROUND_Y - Math.abs(Math.sin(t * 8)) * 5;
          if (t - stepAt > 0.36) {
            stepAt = t;
            playSfx("bear-step");
            dustPuff(bear.pos.x + bw / 2);
            shakeUntilRef.t = t + 0.12;
          }
          if (t > 3.0) {
            beat = 3;
            bear.pos.y = GROUND_Y;
            // --- Beat 4: the hero recoils --------------------------------
            bang = k.add([
              k.text("!", { size: 34, font: UI_FONT }),
              k.pos(player.pos.x, GROUND_Y - 130),
              k.anchor("center"),
              k.color(255, 236, 120),
              k.outline(4, k.rgb(30, 20, 0)),
              k.z(LAYERS.HUD - 1),
            ]) as AnyObj;
            spawned.push(bang);
          }
        }
        if (beat === 3) {
          // Steps backward, trembling, eyes on the bear.
          player.pos.x = Math.max(heroX - 46, player.pos.x - 60 * dt);
          p.pos.y = GROUND_Y + Math.sin(t * 40) * 1.5;
          player.flipX = false;
          if (bang) bang.pos.x = player.pos.x + Math.sin(t * 30) * 2;
          if (t > 4.0) {
            beat = 4;
            p.pos.y = GROUND_Y;
            // --- Beat 5: he rears up and roars ------------------------------
            playSfx("roar");
            playSfx("impact");
            shakeUntilRef.t = t + 0.8;
            setMusic("boss");
            bear.height = bh * 1.18;
            const roar = k.add([
              k.text("ROAAR!", { size: 36, font: UI_FONT }),
              k.pos(bear.pos.x, GROUND_Y - bh - 34),
              k.anchor("center"),
              k.color(255, 90, 80),
              k.outline(4, k.rgb(30, 0, 0)),
              k.z(LAYERS.HUD - 1),
            ]) as AnyObj;
            spawned.push(roar);
            sparkleBurst(bear.pos.x, GROUND_Y - bh / 2, [255, 160, 90]);
          }
        }
        if (beat === 4 && t > 5.0) {
          beat = 5;
          try {
            ctl.cancel();
          } catch {
            /* ignore */
          }
          // Fade the clearing out, clean up, hand over to the briefing card.
          const fade = k.add([
            k.rect(k.width(), k.height()),
            k.pos(0, 0),
            k.color(0, 0, 0),
            k.opacity(0),
            k.fixed(),
            k.z(320),
          ]) as AnyObj;
          let ft = 0;
          const fadeCtl = k.onUpdate(() => {
            ft += k.dt();
            if (ft < 0.4) {
              fade.opacity = ft / 0.4;
              return;
            }
            if (ft < 0.75) {
              fade.opacity = 1;
              for (const o of spawned) {
                try {
                  o.destroy();
                } catch {
                  /* gone */
                }
              }
              spawned.length = 0;
              player.pos.x = heroX;
              player.pos.y = GROUND_Y;
              p.vel = k.vec2(0, 0);
              return;
            }
            fade.opacity = Math.max(0, 1 - (ft - 0.75) / 0.35);
            if (ft > 1.15) {
              try {
                fadeCtl.cancel();
              } catch {
                /* ignore */
              }
              try {
                fade.destroy();
              } catch {
                /* ignore */
              }
              resumeGameplay();
              leftArmed = false;
              rightArmed = false;
              if (w?.__gameInput) w.__gameInput.jumpReq = false;
              onDone();
            }
          });
        }
      });
    }

    function playBossEntrance(onDone: () => void) {
      // Gameplay stays frozen (the ready card already paused it) so the player
      // can just watch; objects created here are not part of that snapshot.
      setMusic("boss");
      // Face the hero toward the charging bear.
      faceTheBear();

      const targetX = BIOME_W * 6 + 1050;
      const bh = DISPLAY_H["boss-idle"];
      const bw = displaySize("boss-idle", sizes).w;
      const startX = targetX + 620;
      const runner = k.add([
        k.sprite("boss-idle", { width: bw, height: bh }),
        k.pos(startX, GROUND_Y),
        k.anchor("bot"),
        k.z(LAYERS.ACTOR),
      ]) as AnyObj;
      runner.flipX = true;
      let t = 0;
      let roared = false;
      const ctl = k.onUpdate(() => {
        const dt = k.dt();
        t += dt;
        if (runner.pos.x > targetX) {
          runner.pos.x = Math.max(targetX, runner.pos.x - 420 * dt);
          // Heavy running gait + puffs of trail dust.
          runner.pos.y = GROUND_Y - Math.abs(Math.sin(t * 14)) * 10;
          if (Math.floor(t * 12) % 3 === 0) {
            const dust = k.add([
              k.rect(6, 6),
              k.pos(runner.pos.x + bw / 2, GROUND_Y - 4),
              k.color(210, 200, 180),
              k.opacity(0.8),
              k.anchor("center"),
              k.z(LAYERS.EFFECT),
              { life: 0 },
            ]) as AnyObj;
            dust.onUpdate(() => {
              dust.life += k.dt();
              dust.pos.x += 40 * k.dt();
              dust.pos.y -= 24 * k.dt();
              dust.opacity = Math.max(0, 0.8 - dust.life * 2);
              if (dust.life > 0.45) dust.destroy();
            });
          }
          return;
        }
        runner.pos.y = GROUND_Y;
        if (!roared) {
          roared = true;
          const roar = k.add([
            k.text("ROAAR!", { size: 34, font: UI_FONT }),
            k.pos(targetX, GROUND_Y - bh - 30),
            k.anchor("center"),
            k.color(255, 90, 80),
            k.outline(4, k.rgb(30, 0, 0)),
            k.z(LAYERS.HUD - 1),
          ]) as AnyObj;
          sparkleBurst(targetX, GROUND_Y - bh / 2, [255, 160, 90]);
          k.wait(1.1, () => {
            try {
              roar.destroy();
            } catch {
              /* gone */
            }
          });
        }
        if (t > 0 && roared && k.time() >= 0) {
          // Hold the roar beat, then hand the fight over.
          if ((runner.__holdUntil ?? 0) === 0) runner.__holdUntil = k.time() + 1.1;
          if (k.time() >= runner.__holdUntil) {
            try {
              ctl.cancel();
            } catch {
              /* ignore */
            }
            try {
              runner.destroy();
            } catch {
              /* ignore */
            }
            resumeGameplay();
            onDone();
          }
        }
      });
    }

    // ================= Asset debug overlay =================
    // Toggle with the "D" key or by loading the page with ?debug=assets.
    // Shows every asset the current zone depends on, its sheet coordinates,
    // trimmed bounding box, unified sprite size, and load status.
    const debugQuery =
      typeof window !== "undefined" && /(?:^|[?&])debug=assets(?:&|$)/.test(window.location.search);
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
      k.text("ASSETS · press D", { size: 11, font: UI_FONT }),
      k.pos(k.width() - 16, 14),
      k.anchor("topright"),
      k.color(255, 220, 90),
      k.fixed(),
      k.z(LAYERS.HUD + 6),
    ]) as AnyObj;
    const debugSummary = k.add([
      k.text("", { size: 10, font: UI_FONT, width: 344 }),
      k.pos(k.width() - 16, 30),
      k.anchor("topright"),
      k.color(200, 220, 255),
      k.fixed(),
      k.z(LAYERS.HUD + 6),
    ]) as AnyObj;
    const debugBody = k.add([
      k.text("", { size: 9, font: UI_FONT, width: 344, lineSpacing: 1 }),
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
        if (!e) {
          lines.push(`??  ${n.padEnd(16)}  (not registered)`);
          continue;
        }
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
          lines.push(
            `${statusGlyph(e.status)}  ${e.name.padEnd(16)}  ${e.error?.slice(0, 40) ?? ""}`,
          );
        }
      }
      debugBody.text = tr(lines.join("\n"));
    }
    // Auto-size panel roughly to content height.
    k.onUpdate(() => {
      if (!debugVisible) {
        debugPanel.height = 26;
        return;
      }
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
        hit: boolean;
        bumpT: number;
        methodLabel: string;
        methodIcon: string;
        pos: { x: number; y: number };
        use: (c: unknown) => void;
        basY: number;
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
      const iw = 30,
        ih = 30;
      const icon = k.add([
        k.rect(iw, ih, { radius: 3 }),
        k.pos(brick.pos.x, brick.pos.y - 18),
        k.anchor("center"),
        k.color(250, 240, 210),
        k.outline(2, k.rgb(60, 45, 25)),
        k.area({ shape: new k.Rect(k.vec2(0, 0), iw, ih) }),
        k.z(LAYERS.PROP + 1),
        "method",
        { methodLabel: brick.methodLabel, vy: -180, landed: false },
      ]) as AnyObj;
      markCollectible(k, icon, { label: "GRAB", width: iw, height: ih });
      // 16-bit pixel art of the chosen channel, drawn as children so it
      // travels with the icon: letter / cell phone / office / laptop.
      for (const part of METHOD_ICON_PIXELS[brick.methodIcon] ?? []) {
        icon.add([
          k.rect(part.w, part.h),
          k.pos(part.x, part.y),
          k.anchor("center"),
          k.color(part.c[0], part.c[1], part.c[2]),
          k.z(LAYERS.PROP + 2),
        ]);
      }
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
      });
    });
    player.onCollide("method", (m) => {
      if (zoneState.methodTouched) return;
      zoneState.methodTouched = true;
      player.score += 400;
      const item = m as unknown as { methodLabel?: string; destroy: () => void };
      const chosen = item.methodLabel ?? "Method";
      item.destroy();
      lockApplyMethods(chosen);
      showHint(`You picked ${chosen}. Now walk right and go through the door.`, 3.2);
    });

    player.onCollide("credential", (c) => {
      const cr = c as unknown as {
        credKind: "user" | "pass";
        sign?: AnyObj[];
        destroy: () => void;
      };
      if (cr.credKind === "user") zoneState.userGot = true;
      else zoneState.passGot = true;
      player.score += 600;
      removeSpeech(cr.sign);
      playSfx("pickup");
      cr.destroy();
    });

    player.onCollide("doc", (d) => {
      const doc = d as unknown as { docKey: string; sign?: AnyObj[]; destroy: () => void };
      if (!player.docs.has(doc.docKey)) zoneState.docsInZone += 1;
      player.docs.add(doc.docKey);
      player.score += 750;
      removeSpeech(doc.sign);
      playSfx("pickup");
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
      ]) as AnyObj;
      markCollectible(k, keyItem as AnyObj, { label: "KEY", width: kw, height: kh });
      keyItem.onUpdate(() => {
        const dx = player.pos.x - keyItem.pos.x;
        const dy = player.pos.y - kh - keyItem.pos.y;
        keyItem.pos.x += dx * 2 * k.dt();
        keyItem.pos.y += dy * 2 * k.dt();
      });
    }
    /** Shared "a plan was taken" routine — collision OR proximity can call it. */
    function takePlan(p: unknown) {
      if (zoneState.planPicked) return;
      // Guard only against grabbing a card while clearly down in the running
      // lane below the island; anything at (or near) island level counts.
      if (!DEMO && player.pos.y > GROUND_Y - 60) return;

      const item = p as unknown as {
        planLabel: string;
        bonus: number;
        destroy: () => void;
        pos: { x: number; y: number };
      };
      const label = item.planLabel;
      zoneState.planPicked = true;
      player.score += item.bonus ?? 800;
      playSfx("pickup");
      // Remove every plan pedestal plus the labels and the prompt sign.
      k.get("plan-choice-ui").forEach((o) => (o as { destroy: () => void }).destroy());
      k.get("plan-pick").forEach((o) => (o as { destroy: () => void }).destroy());

      showHint(`Picked ${label} — get ready, something is coming through the trees...`);
      // Plan chosen -> the bear charges in (once), then the ready card, then
      // the fight begins.
      const startFight = () =>
        showBossReadyPrompt(() => {
          spawnPlanBoss();
          showHint("The bear attacks! You're firing + now — dodge his paperwork.");
        });
      if (!bossCinematicPlayed) {
        bossCinematicPlayed = true;
        playBossCinematic(startFight);
      } else {
        startFight();
      }
    }

    player.onCollide("plan-pick", (p) => takePlan(p));

    // Belt-and-braces: kaplay's collision callback can miss a frame when the
    // hero lands on the pedestal without lateral motion, which left players
    // standing on a card with nothing happening. This overlap poll guarantees
    // that touching any card starts the boss.
    k.onUpdate(() => {
      if (zoneState.planPicked) return;
      const pl = player.pos.x - PLAYER_HITBOX.w / 2;
      const pr = player.pos.x + PLAYER_HITBOX.w / 2;
      const pt = player.pos.y - PLAYER_HITBOX.h;
      const pb = player.pos.y;
      for (const o of k.get("plan-pick")) {
        const card = o as unknown as { pos: { x: number; y: number }; width: number; height: number };
        const cl = card.pos.x - card.width / 2;
        const cr = card.pos.x + card.width / 2;
        const ct = card.pos.y - card.height;
        const cb = card.pos.y;
        if (pr >= cl && pl <= cr && pb >= ct && pt <= cb) {
          takePlan(o);
          return;
        }
      }
    });


    // ----- Zone 7 boss battle: dodge the paperwork, land 3 "+" hits -----
    // Set once the boss exists so the auto-fire loop can report a hit without
    // reaching into the spawner's closure.
    let registerBossHit: ((shotX: number, shotY: number) => void) | null = null;

    /**
     * Denial letters / bills the boss throws. Whatever height they leave his
     * paws at, they glide down to a low "must jump" lane just above the ground
     * so they always reach the player instead of sailing overhead.
     */
    function spawnBossShot(x: number, y: number, dirX: 1 | -1, laneOffset = 26) {
      // Bound the number in flight without blocking the next timed wave. At
      // 470px/s a shot clears the battle viewport in a few seconds, so eight
      // permits uninterrupted two-shot waves while remaining dodgeable.
      if (k.get("boss-shot").length >= 5) return;

      const sw = displaySize("denied", sizes).w;
      const sh = DISPLAY_H["denied"];
      const targetY = GROUND_Y - laneOffset;
      const shot = k.add([
        k.sprite("denied", { width: sw, height: sh }),
        k.pos(x, y),
        k.anchor("center"),
        k.area({ shape: new k.Rect(k.vec2(0, 0), sw - 8, sh - 8) }),
        k.z(LAYERS.EFFECT),
        "boss-shot",
        { vx: dirX * 380, born: k.time() },
      ]) as AnyObj;
      shot.onUpdate(() => {
        const dt = k.dt();
        shot.pos.x += shot.vx * dt;
        // Descend toward the low lane, then bob gently along it.
        if (shot.pos.y < targetY - 1) {
          shot.pos.y = Math.min(targetY, shot.pos.y + 320 * dt);
        } else {
          shot.pos.y = targetY + Math.sin(k.time() * 6) * 3;
        }
        // Retire paperwork once it has crossed the active battle viewport.
        // The old 14-second lifetime filled the four-shot cap after two waves,
        // making the boss appear to stop firing until those shots expired.
        const battleLeft = BIOME_W * 6 - VIEW_W;
        const battleRight = BIOME_W * 7 + VIEW_W;
        if (shot.pos.x < battleLeft || shot.pos.x > battleRight || k.time() - shot.born > 5) {
          shot.destroy();
        }
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
        if (k.time() - shot.born > 2) {
          stem.destroy();
          shot.destroy();
        }
      });
      shot.onDestroy(() => {
        try {
          stem.destroy();
        } catch {
          /* already gone */
        }
      });
      shot.onCollide("boss", () => {
        registerBossHit?.(shot.pos.x, shot.pos.y);
        shot.destroy();
      });
      // Your "+" shots pass straight through his paperwork — it must be
      // dodged, not shot down.
    }

    // Auto-fire loop: no fire button, the power-up comes with the plan choice.
    let nextPlusShot = 0;
    k.onUpdate(() => {
      if (isPaused() || player.dead || player.won) return;
      if (!zoneState.planPicked || zoneState.bossDefeated) return;
      const now = k.time();
      if (now < nextPlusShot) return;
      nextPlusShot = now + 0.4;
      spawnPlusShot();
    });

    // Incoming paperwork hurts on contact.
    player.onCollide("boss-shot", (o) => {
      (o as unknown as { destroy: () => void }).destroy();
      if (k.time() < player.invulnUntil) return;
      loseLife("monster");
      // A little extra mercy window so one unlucky hit can't chain into another.
      player.invulnUntil = Math.max(player.invulnUntil, k.time() + 0.5);
    });

    function spawnPlanBoss() {
      if (zoneState.bossSpawned) return;
      zoneState.bossSpawned = true;
      // The ogre is here — drop into the tense battle theme.
      setMusic("boss");
      faceTheBear();
      const bx = BIOME_W * 6 + 1050;

      const bh = DISPLAY_H["boss-idle"];
      const bw = displaySize("boss-idle", sizes).w;
      const boss = spawnGrounded(k, "boss-idle", sizes, {
        x: bx,
        z: LAYERS.ACTOR,
        tag: "boss",
        props: {
          dir: -1,
          home: bx,
          range: 210,
          hits: 0,
          hurtUntil: 0,
          dead: false,
          vy: 0,
          nextShot: 0,
          nextHop: 0,
          armedShot: false,
        },
        hitboxScale: { x: -bw / 2, w: bw, h: bh },
      });
      const BOSS_MAX_HITS = 4;
      // Hearts HUD above the boss.
      const hearts = k.add([
        k.text("♥".repeat(BOSS_MAX_HITS), { size: 16, font: UI_FONT }),
        k.pos(bx, GROUND_Y - bh - 40),
        k.anchor("center"),
        k.color(230, 60, 80),
        k.z(LAYERS.HUD - 1),
      ]) as AnyObj;
      boss.nextShot = k.time() + 1.0;
      boss.nextHop = k.time() + 1.2;

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
        boss.hurtUntil = now + 1.05;
        zoneState.bossHits = boss.hits;
        player.score += 400;
        hearts.text = tr("♥".repeat(Math.max(0, BOSS_MAX_HITS - boss.hits)));
        sparkleBurst(sx, sy, [120, 255, 180]);
        if (boss.hits >= BOSS_MAX_HITS) defeatBoss();
        else showHint(`Boss hit! ${BOSS_MAX_HITS - boss.hits} to go.`);
      };

      boss.onUpdate(() => {
        if (boss.dead) return;
        const dt = k.dt();
        const now = k.time();
        // Rage phase: only on his final heart, and a gentler speed-up.
        const rage = boss.hits >= BOSS_MAX_HITS - 1 ? 1.15 : 1;
        const speed = 110 * rage;
        boss.pos.x += boss.dir * speed * dt;
        if (boss.pos.x > boss.home + boss.range) {
          boss.pos.x = boss.home + boss.range;
          boss.dir = -1;
          boss.flipX = true;
        }
        if (boss.pos.x < boss.home - boss.range) {
          boss.pos.x = boss.home - boss.range;
          boss.dir = 1;
          boss.flipX = false;
        }
        // Occasional hop.

        if (now >= boss.nextHop && boss.pos.y >= GROUND_Y) {
          boss.vy = -470;
          boss.nextHop = now + (0.4 + Math.random() * 0.3) / rage;
          boss.armedShot = true; // this jump will throw on the way up and down
        }

        boss.vy += 1300 * dt;
        boss.pos.y = Math.min(GROUND_Y, boss.pos.y + boss.vy * dt);
        if (boss.pos.y >= GROUND_Y) {
          boss.pos.y = GROUND_Y;
          boss.vy = 0;
        }
        hearts.pos.x = boss.pos.x;
        hearts.pos.y = boss.pos.y - bh - 40;
        // Paperwork comes in repeating waves until he is beaten. The wave is
        // on a pure timer — being mid-jump, on the ground or flashing from a
        // hit never stops it. His jump height still varies where the shots
        // leave from, so waves arrive at different heights.
        if (now >= boss.nextShot) {
          boss.armedShot = false;
          const toward: 1 | -1 = player.pos.x < boss.pos.x ? -1 : 1;
          // Short burst, spaced so one well-timed jump can clear the wave.
          spawnBossShot(boss.pos.x + toward * (bw / 2), boss.pos.y - 34, toward, 22);
          const burstY = boss.pos.y - 6;
          const burstX = boss.pos.x;
          k.wait(0.28, () => {
            if (boss.dead) return;
            spawnBossShot(burstX + toward * (bw / 2), burstY, toward, 44);
          });
          if (rage > 1) {
            k.wait(0.56, () => {
              if (boss.dead) return;
              spawnBossShot(burstX + toward * (bw / 2), burstY - 60, toward, 30);
            });
          }
          // Wave every ~1.8-2.3s (tighter in the rage phase) — continuous, but
          // with a readable gap to land the dodge in.
          boss.nextShot = now + (1.8 + Math.random() * 0.5) / rage;
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

    // Single owner of "the slide just finished". Both the pole-base collider
    // and the update-loop safety net funnel through here — previously the
    // collider set firePoleDone without advancing the cutscene, which stranded
    // the finale in the "slide" phase forever and the WIN screen never fired.
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
      if (enemyMgr.blocksDamage("boulder", zoneNow, umbrellaState.up)) {
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
      // Attract mode shrugs off hits, so it must not reset the countdown too —
      // otherwise the demo stalls in the waiting zone forever.
      if (!DEMO && zoneNow === ZONE_INDEX.awaitDecision && alive && zoneState.waitStart > 0) {
        zoneState.waitStart = k.time();
        showHint("Hit! The 10 seconds start over.", 2.2);
      }
      loseLife("boulder");
    });
    player.onCollide("water", () => loseLife("water"));

    // ================= 1-UP collectibles =================
    // A 16-bit heart badge. Grabbing it grants an extra application (life);
    // if the player is already carrying the maximum, it pays points instead so
    // the pickup is never a dud.
    const LIFE_CAP = 5;
    function spawn1UP(x: number, y: number) {
      const badge = k.add([
        k.rect(30, 26, { radius: 4 }),
        k.pos(x, y),
        k.anchor("center"),
        k.color(230, 60, 90),
        k.outline(3, k.rgb(255, 245, 235)),
        k.area({ shape: new k.Rect(k.vec2(0, 0), 30, 26) }),
        k.z(LAYERS.EFFECT),
        "oneup",
        { baseY: y },
      ]) as AnyObj;
      const label = k.add([
        k.text("1UP", { size: 11, font: UI_FONT }),
        k.pos(x, y),
        k.anchor("center"),
        k.color(255, 255, 255),
        k.z(LAYERS.EFFECT + 1),
      ]) as AnyObj;
      badge.onUpdate(() => {
        badge.pos.y = badge.baseY + Math.sin(k.time() * 3) * 7;
        label.pos = k.vec2(badge.pos.x, badge.pos.y);
      });
      badge.onDestroy(() => label.destroy());
      markCollectible(k, badge, { label: "EXTRA LIFE", width: 30, height: 26, topLift: 4 });
      return badge;
    }

    player.onCollide("oneup", (o: AnyObj) => {
      o.destroy();
      playSfx("pickup");
      sparkleBurst(player.pos.x, player.pos.y - 40, [255, 120, 150]);
      if (player.maxLives < LIFE_CAP) {
        player.maxLives += 1;
        player.lives += 1;
        showHint("Extra life! You're back in the game.");
      } else if (player.lives < player.maxLives) {
        player.lives += 1;
        showHint("Extra life! You're back in the game.");
      } else {
        player.score += 400;
        showHint("Full on lives — bonus points instead!");
      }
      updateHud();
    });

    // Two extra lives are hidden along the main trail, both reachable only
    // with a deliberate jump so they read as a reward, not a handout.
    spawn1UP(BIOME_W * 3 + 640, GROUND_Y - 190);
    spawn1UP(BIOME_W * 5 + 520, GROUND_Y - 200);

    // ================= Secret bonus stage (Portland waterfront) =================
    // Falling into the Zone 2 gap normally costs a life. The FIRST time it
    // happens the trail instead warps the player to a hidden pocket built far
    // above the level: a calm Portland waterfront with no enemies, a row of
    // treats and a 1-UP. Walking off its right edge drops them back onto the
    // trail just past the gap, so the run continues untouched.
    const BONUS_DY = -1600;
    const BONUS_X0 = BIOME_W + 120;
    const BONUS_X1 = BIOME_W + 1080;
    const BONUS_GROUND_Y = GROUND_Y + BONUS_DY;
    const BONUS_EXIT_X = BONUS_X1 - 90;
    let bonusActive = false;
    let bonusUsed = false;
    let bonusBuilt = false;

    function buildBonusStage() {
      if (bonusBuilt) return;
      bonusBuilt = true;
      k.add([
        k.rect(BONUS_X1 - BONUS_X0 + 240, 540),
        k.pos(BONUS_X0 - 120, BONUS_GROUND_Y - 430),
        k.color(30, 60, 90),
        k.z(LAYERS.BG_FAR - 1),
      ]);
      k.add([
        k.sprite("bg-bonus", { width: BONUS_X1 - BONUS_X0 + 240, height: 540 }),
        k.pos(BONUS_X0 - 120, BONUS_GROUND_Y - 430),
        k.z(LAYERS.BG_FAR),
      ]);
      addGround(k, BONUS_X0 - 120, BONUS_X1 + 120, BONUS_GROUND_Y, [90, 140, 90], [60, 50, 40]);

      showFloatingSign(BONUS_X0 + 150, BONUS_GROUND_Y - 250, "SECRET FOUND!", [255, 220, 90]);
      showFloatingSign(BONUS_X0 + 150, BONUS_GROUND_Y - 210, "PORTLAND WATERFRONT", [255, 255, 255]);
      showFloatingSign(
        BONUS_X0 + 150,
        BONUS_GROUND_Y - 176,
        "Collect everything — no enemies here!",
        [190, 235, 255],
      );
      // Visible exit door — the bonus stage now ends at a real doorway instead
      // of an unmarked drop off the right edge.
      {
        const disp = displaySize("door-open", sizes);
        k.add([
          k.sprite("door-open", { width: disp.w, height: DISPLAY_H["door-open"] }),
          k.pos(BONUS_EXIT_X, BONUS_GROUND_Y),
          k.anchor("bot"),
          k.z(LAYERS.PROP + 2),
        ]);
        showFloatingSign(BONUS_EXIT_X, BONUS_GROUND_Y - DISPLAY_H["door-open"] - 46, "EXIT", [
          255, 220, 90,
        ]);
        showFloatingSign(
          BONUS_EXIT_X,
          BONUS_GROUND_Y - DISPLAY_H["door-open"] - 22,
          "Walk into the door to rejoin the trail",
          [190, 235, 255],
        );
      }

      // Treats: a simple arc of collectible points across the waterfront.
      for (let i = 0; i < 9; i++) {
        const cx = BONUS_X0 + 220 + i * 78;
        const cy = BONUS_GROUND_Y - 90 - Math.round(Math.sin((i / 8) * Math.PI) * 120);
        const treat = k.add([
          k.rect(22, 22, { radius: 5 }),
          k.pos(cx, cy),
          k.anchor("center"),
          k.color(210, 160, 80),
          k.outline(3, k.rgb(255, 245, 230)),
          k.area({ shape: new k.Rect(k.vec2(0, 0), 22, 22) }),
          k.z(LAYERS.EFFECT),
          "bonus-treat",
          { baseY: cy },
        ]) as AnyObj;
        treat.onUpdate(() => {
          treat.pos.y = treat.baseY + Math.sin(k.time() * 3 + i) * 5;
        });
      }
      spawn1UP(BONUS_X0 + 610, BONUS_GROUND_Y - 250);
    }

    function showFloatingSign(x: number, y: number, msg: string, rgb: [number, number, number]) {
      k.add([
        k.text(msg, { size: 15, font: UI_FONT }),
        k.pos(x, y),
        k.anchor("center"),
        k.color(...rgb),
        k.outline(3, k.rgb(10, 15, 30)),
        k.z(LAYERS.EFFECT + 2),
      ]);
    }

    player.onCollide("bonus-treat", (o: AnyObj) => {
      o.destroy();
      playSfx("pickup");
      player.score += 120;
      updateHud();
    });

    function enterBonusStage() {
      bonusUsed = true;
      bonusActive = true;
      buildBonusStage();
      player.pos = k.vec2(BONUS_X0, BONUS_GROUND_Y - 30);
      player.vel = k.vec2(0, 0);
      player.riding = null;
      player.invulnUntil = k.time() + 1.2;
      playSfx("pickup");
      sparkleBurst(player.pos.x, player.pos.y - 40, [255, 220, 120]);
      showHint("SECRET FOUND!");
      // Explain the pocket the same way every other zone explains itself.
      showStepScreen(BONUS_STEP_ID, undefined, BONUS_STEP_SCREEN);
    }


    function exitBonusStage() {
      bonusActive = false;
      // The bonus pocket replaces the rest of Zone 2, so credit that zone's
      // objective and open its door before we move: the per-frame zone change
      // handler below then sees a coherent state when it fires for Zone 3.
      zoneState.userGot = true;
      zoneState.passGot = true;
      unlockDoor(1);
      player.pos = k.vec2(BIOME_W * 2 + 70, GROUND_Y - 60);
      player.vel = k.vec2(0, 0);
      player.riding = null;
      player.invulnUntil = k.time() + 1.0;
      player.score += 250;
      showHint("BONUS COMPLETE!");
      updateHud();
    }

    /** True when the fall was consumed by the secret warp (no life lost). */
    function bonusInterceptsFall(): boolean {
      if (bonusActive) return false;
      if (bonusUsed || DEMO) return false;
      if (player.pos.x < Z1_GAP_X0 - 40 || player.pos.x > Z1_GAP_X1 + 40) return false;
      enterBonusStage();
      return true;
    }

    /** Runs every frame while the hidden stage is on screen. */
    function updateBonusStage() {
      if (!bonusActive) return;
      const atDoor =
        Math.abs(player.pos.x - BONUS_EXIT_X) < 34 && player.pos.y > BONUS_GROUND_Y - 150;
      // Door is the intended exit; the edge/fall checks stay as a safety net so
      // nobody can strand themselves out here.
      if (atDoor || player.pos.x > BONUS_X1 || player.pos.y > BONUS_GROUND_Y + 220)
        exitBonusStage();
      else if (player.pos.x < BONUS_X0 - 100) player.pos.x = BONUS_X0 - 100;
    }

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
      if (DEMO) {
        // Attract mode never fails: shrug the hit off and keep the show going.
        player.invulnUntil = k.time() + INVULN_S;
        if (player.pos.y > GROUND_Y + 40) {
          const zoneEntryX = Math.max(40, currentZone * BIOME_W + 60);
          player.pos = k.vec2(zoneEntryX, GROUND_Y - 40);
          player.vel = k.vec2(0, 0);
          player.riding = null;
          resetRiverPlatforms();
        }
        return;
      }
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
      // Zone 3's collapsing platforms come back so the crossing stays winnable.
      resetRiverPlatforms();
      updateHud();
    }

    // Failure results are held until the player acknowledges the failure
    // screen, so the score / feedback panel never covers the message.
    let pendingLose: WinResult | null = null;
    function flushPendingLose() {
      if (!pendingLose) return;
      const r = pendingLose;
      pendingLose = null;
      setPromptFlag(isPaused());
      opts.onLose?.(r);
    }


    /**
     * Stamps the split time for a finished zone and pays a speed bonus.
     * The bonus curve is steep and uses odd multipliers so that two runs that
     * play the same but move at different speeds land on clearly different
     * totals instead of clustering around the same round number.
     */
    function closeZoneSplit(zone: number) {
      if (zone < 0 || zone > 7) return;
      if (zoneSplitsMs[zone] > 0) return; // already stamped
      const split = Math.max(0.5, runClock() - zoneClockStart);
      zoneSplitsMs[zone] = Math.round(split * 1000);
      const bonus = zoneSpeedBonus(zone, split);
      if (bonus > 0) {
        timeBonusTotal += bonus;
        player.score += bonus;
        showHint(`Step cleared in ${split.toFixed(1)}s — speed bonus +${bonus}`);
      }
      updateHud();
    }

    function buildResult(won: boolean): WinResult {
      const durationMs = Math.round(runClock() * 1000);
      return {
        durationMs,
        docs: player.docs.size,
        lives: player.lives,
        farthestZone: player.farthestZone,
        won,
        score: computeFinalScore({
          won,
          playScore: player.score,
          durationMs,
          lives: player.lives,
        }),
        distancePx: Math.round(player.distancePx),
        jumpsLanded: player.jumpsLanded,
        enemiesPassed: player.enemiesPassed,
        deaths: player.deaths,
        timeBonus: timeBonusTotal,
        zoneSplitsMs: [...zoneSplitsMs],
      };
    }

    // (Old fixed-finish collision removed — the clinic zone now ends at the
    //  fire-pole base which sets zoneState.firePoleDone in the update loop.)

    function tryWin() {
      if (player.won || player.dead) return;
      player.won = true;
      closeZoneSplit(currentZone);
      pendingWin = buildResult(true);

      showTitleCard(k, "STEP 8 · ENROLLED", "★ COVERED ★", [255, 220, 90], 2.4);
      showEnd(true);
    }

    function showEnd(win: boolean, cause?: FailCause) {
      const zone = player.farthestZone;
      const title = win ? "★ ENROLLED IN COVERAGE ★" : (OVERLAY_TITLES[zone] ?? OVERLAY_TITLES[0]);
      const body = win
        ? "You navigated every step and enrolled in Medicaid coverage."
        : `${pickFailureMessage(zone, cause ?? "fell")}\n\nTell us what would make the next attempt easier — the form is below the game.`;
      let nodes: AnyObj[] = [];

      function render() {
        for (const n of nodes) {
          try {
            n.destroy();
          } catch {
            /* ignore */
          }
        }
        nodes = [];
        const W = k.width();
        const H = k.height();
        // Capped to the visible buffer so the heading and body can never spill
        // past the edges when the window is small or leaves fullscreen.
        const T = computeFittedUiScale(opts.canvas, W, H, 760, 380);
        const put = (parts: unknown[]) => {
          const o = k.add(parts as never) as AnyObj;
          nodes.push(o);
          return o;
        };
        const overlay = put([
          k.rect(W, H),
          k.pos(0, 0),
          k.color(0, 0, 0),
          k.opacity(0.72),
          k.area(),
          k.fixed(),
          k.z(LAYERS.OVERLAY),
        ]);
        if (!win) overlay.onClick(() => flushPendingLose());
        put([
          k.text(title, {
            size: Math.round(30 * T),
            font: UI_FONT,
            width: W - Math.round(40 * T),
            align: "center",
          }),
          k.pos(W / 2, H / 2 - Math.round(78 * T)),
          k.anchor("center"),
          k.color(win ? k.rgb(255, 220, 90) : k.rgb(255, 150, 150)),
          k.fixed(),
          k.z(LAYERS.OVERLAY_TEXT),
        ]);
        put([
          k.text(body, {
            size: Math.round(16 * T),
            font: UI_FONT,
            width: Math.min(720 * T, W - 40),
            align: "center",
          }),
          k.pos(W / 2, H / 2),
          k.anchor("center"),
          k.color(240, 240, 240),
          k.fixed(),
          k.z(LAYERS.OVERLAY_TEXT),
        ]);
        if (!win) {
          // A dejected hero stands at the edge of the failure screen — he did
          // not get through this step of the coverage journey.
          const sadH = Math.max(120, Math.min(H * 0.52, 240));
          put([
            k.sprite("hero-sad", { width: Math.floor(sadH * 0.677), height: Math.floor(sadH) }),
            k.pos(18, H - 14),
            k.anchor("botleft"),
            k.opacity(0.95),
            k.fixed(),
            k.z(LAYERS.OVERLAY_TEXT),
          ]);
          put([
            k.text(restartPrompt(), {
              size: Math.round(14 * T),
              font: UI_FONT,
              width: W - Math.round(40 * T),
              align: "center",
            }),
            k.pos(W / 2, H / 2 + Math.round(100 * T)),
            k.anchor("center"),
            k.color(220, 220, 220),
            k.fixed(),
            k.z(LAYERS.OVERLAY_TEXT),
          ]);
        }
      }

      render();
      uiRelayout.add(render);

      if (win) {
        // The WIN screen holds for 5s, then hands off to the thank-you
        // cutscene — that scene owns the restart prompt.
        k.wait(5, () => k.go("thanks"));
      } else {
        // The name-entry / feedback panel is held back until the player
        // acknowledges the failure screen.
        pendingLose = buildResult(false);
        setPromptFlag(true);
      }

    }

    // ================= Controls =================
    const leftKeys = ["left", "a"];
    const rightKeys = ["right", "d"];
    const jumpKeys = ["space", "up", "w"];

    type TouchInput = {
      left: boolean;
      right: boolean;
      jumpReq: boolean;
      resetReq: boolean;
      down?: boolean;
    };
    const w =
      typeof window !== "undefined"
        ? (window as unknown as { __gameInput?: TouchInput })
        : undefined;
    // Wipe anything left over from the previous run (a held D-pad button, a
    // queued jump/reset) so a restart always begins from a standstill.
    if (w?.__gameInput) {
      w.__gameInput.left = false;
      w.__gameInput.right = false;
      w.__gameInput.jumpReq = false;
      w.__gameInput.resetReq = false;
      w.__gameInput.down = false;
    }
    let leftArmed = false;
    let rightArmed = false;

    let currentZone = Math.min(ZONES.length - 1, Math.max(0, Math.floor(spawnX / BIOME_W)));
    opts.onSafeProgress?.(currentZone);

    /** Publishes the full run state so a context-loss recovery can restore it. */
    function emitSnapshot() {
      if (player.dead || player.won) return;
      opts.onSnapshot?.({
        savedAt: Date.now(),
        zone: currentZone,
        elapsedMs: Math.round(runClock() * 1000),
        score: player.score,
        timeBonus: timeBonusTotal,
        lives: player.lives,
        maxLives: player.maxLives,
        docs: [...player.docs],
        deaths: player.deaths,
        distancePx: player.distancePx,
        jumpsLanded: player.jumpsLanded,
        enemiesPassed: player.enemiesPassed,
        farthestZone: player.farthestZone,
        zoneSplitsMs: [...zoneSplitsMs],
      });
    }
    emitSnapshot();

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
        player.airJumpsLeft = 1;
        if (player.riding) {
          player.vel.x += player.riding.platformSpeed.x;
          player.riding = null;
        }
      } else if (player.airJumpsLeft > 0) {
        // Mid-air double jump: kill any downward speed first so it also
        // rescues a fall, then boost.
        player.airJumpsLeft -= 1;
        if (player.vel.y > 0) player.vel.y = 0;
        player.jump(AIR_JUMP_VEL);
        player.jumpBufferedAt = -1;
        airJumpPuff(player.pos.x, player.pos.y);
      } else {
        player.jumpBufferedAt = now;
      }
    }

    /** Small pixel puff at the hero's feet so the air jump reads clearly. */
    function airJumpPuff(x: number, y: number) {
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI / 5) * i + Math.PI * 0.1;
        const puff = k.add([
          k.rect(4, 4),
          k.pos(x, y - 4),
          k.anchor("center"),
          k.color(255, 255, 255),
          k.opacity(0.9),
          k.z(LAYERS.PROP + 2),
          { t: 0, vx: Math.cos(ang) * 70, vy: -Math.abs(Math.sin(ang)) * 20 + 30 },
        ]) as AnyObj;
        puff.onUpdate(() => {
          puff.t += k.dt();
          puff.pos.x += puff.vx * k.dt();
          puff.pos.y += puff.vy * k.dt();
          puff.opacity = Math.max(0, 0.9 - puff.t * 2.6);
          if (puff.t > 0.4) k.destroy(puff);
        });
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

    // ===== Attract-mode autopilot =====
    // An objective-aware bot: it walks to whatever the current zone actually
    // requires (brick, credentials, documents, replies, plan card, key, ID
    // card), fights the bear, and only then heads for the door — so a passer-by
    // sees a genuine end-to-end run rather than doors popping open on a timer.
    let demoLastX = player.pos.x;
    let demoLastProgressAt = 0;
    let demoZoneEnteredAt = 0;
    let demoZoneWatched = -1;
    let demoLastTargetX = 0;
    let demoTargetSince = 0;

    function demoNear(tag: string, ahead: number, vertical: number): boolean {
      const list = k.get(tag) as unknown as Array<{ pos: { x: number; y: number } }>;
      for (const o of list) {
        const dx = o.pos.x - player.pos.x;
        if (dx > -30 && dx < ahead && Math.abs(o.pos.y - player.pos.y) < vertical) return true;
      }
      return false;
    }

    type DemoObj = { pos: { x: number; y: number }; hit?: boolean };

    /** Closest object carrying `tag` (optionally filtered), by horizontal distance. */
    function demoNearest(tag: string, keep?: (o: DemoObj) => boolean): DemoObj | null {
      const list = k.get(tag) as unknown as DemoObj[];
      let best: DemoObj | null = null;
      let bestD = Infinity;
      for (const o of list) {
        if (keep && !keep(o)) continue;
        const d = Math.abs(o.pos.x - player.pos.x);
        if (d < bestD) {
          bestD = d;
          best = o;
        }
      }
      return best;
    }

    /** What the bot should be walking toward right now, if anything. */
    function demoTarget(): { x: number; y: number; bump?: boolean } | null {
      const z = currentZone;
      if (z === 0 && !zoneState.methodTouched) {
        // The icon pops out of a smashed brick; grab it if it's already out.
        const icon = demoNearest("method");
        if (icon) return { x: icon.pos.x, y: icon.pos.y };
        const brick = demoNearest("brick", (o) => !o.hit);
        if (brick) return { x: brick.pos.x, y: brick.pos.y, bump: true };
      }
      if (z === 1 && !(zoneState.userGot && zoneState.passGot)) {
        const cred = demoNearest("credential");
        if (cred) return { x: cred.pos.x, y: cred.pos.y };
      }
      if (z === 3 && zoneState.docsInZone < 3) {
        const doc = demoNearest("doc");
        if (doc) return { x: doc.pos.x, y: doc.pos.y };
      }
      if (z === 4 && zoneState.repliesGot < zoneState.repliesNeeded) {
        const rep = demoNearest("reply");
        if (rep) return { x: rep.pos.x, y: rep.pos.y };
      }
      if (z === 6) {
        if (!zoneState.planPicked) {
          const plan = demoNearest("plan-pick");
          if (plan) {
            // Each card sits on a high island reached from its own step block.
            const onStep = player.pos.y <= PLAN_STEP_TOP + 12;
            if (!onStep) return { x: plan.pos.x - 104, y: PLAN_STEP_TOP };
            return { x: plan.pos.x, y: plan.pos.y };
          }
        } else if (zoneState.bossDefeated && !zoneState.hasKey) {
          const key = demoNearest("gold-key");
          if (key) return { x: key.pos.x, y: key.pos.y };
        }
      }
      if (z === 7 && !zoneState.idCardCollected) {
        const card = demoNearest("id-card");
        if (card) return { x: card.pos.x, y: card.pos.y };
      }
      return null;
    }

    /**
     * Boss lane: hold a firing stance to the LEFT of the bear (never turning
     * around, so the auto-fired "+" shots always travel toward him) and hop his
     * paperwork until all his hearts are gone.
     */
    function demoBoss(grounded: boolean): number {
      const boss = demoNearest("boss");
      if (!boss) return 0;
      const gap = boss.pos.x - player.pos.x;
      if (demoNear("boss-shot", 210, 220) && grounded) tryJump();
      // Only ever advance: moving left would flip the hero and waste shots.
      if (gap > 430) return 1;
      return 0;
    }


    /** Attract mode only: hard cap on how long one zone may hold the loop. */
    const DEMO_ZONE_TIMEOUT = 15;

    /** Satisfy the zone's objective the same way play would, then open the
     *  door, so the attract loop always advances instead of stalling. */
    function demoForceZoneComplete(z: number) {
      switch (z) {
        case 0:
          zoneState.methodTouched = true;
          break;
        case 1:
          zoneState.userGot = true;
          zoneState.passGot = true;
          break;
        case 2:
          // Positional objective — nudge the hero to the far bank.
          if (player.pos.x < BIOME_W * 3 - 150) {
            player.pos.x = BIOME_W * 3 - 150;
            player.pos.y = GROUND_Y - 40;
            player.vel = k.vec2(0, 0);
            player.riding = null;
            resetRiverPlatforms();
          }
          break;
        case 3:
          zoneState.docsInZone = 3;
          break;
        case 4:
          zoneState.repliesGot = Math.max(zoneState.repliesGot, zoneState.repliesNeeded);
          break;
        case 5:
          if (zoneState.waitStart === 0) zoneState.waitStart = k.time() - zoneState.waitDur;
          else zoneState.waitStart = Math.min(zoneState.waitStart, k.time() - zoneState.waitDur);
          break;
        case 6:
          zoneState.planPicked = true;
          zoneState.bossDefeated = true;
          zoneState.hasKey = true;
          break;
        case 7:
          zoneState.idCardCollected = true;
          break;
      }
      const d = doors[z];
      if (d && !d.unlocked) unlockDoor(z);
    }

    function demoAutopilot(now: number): number {

      const grounded = player.isGrounded() || !!player.riding;
      // Keep the run honest about progress so a wedged bot can free itself.
      if (player.pos.x > demoLastX + 10) {
        demoLastX = player.pos.x;
        demoLastProgressAt = now;
      }
      if (demoLastProgressAt === 0) demoLastProgressAt = now;

      // Safety valve: no zone may hold the attract loop for more than ~15s.
      // The objective is satisfied the same way play would satisfy it, so the
      // HUD, door and score bookkeeping all stay consistent.
      if (currentZone !== demoZoneWatched) {
        demoZoneWatched = currentZone;
        demoZoneEnteredAt = now;
      } else if (now - demoZoneEnteredAt > DEMO_ZONE_TIMEOUT) {
        demoForceZoneComplete(currentZone);
        demoZoneEnteredAt = now;
      }


      // Boss battle takes over the whole lane while the bear is alive.
      if (currentZone === 6 && zoneState.planPicked && !zoneState.bossDefeated) {
        // Standing and firing is intentional progress — don't let the
        // anti-stuck nudge teleport the hero out of the arena.
        demoLastX = player.pos.x;
        demoLastProgressAt = now;
        return demoBoss(grounded);
      }


      // Zone 5 is a timed wait: make sure the clock is actually running (the
      // briefing normally starts it) so the demo can't idle here forever.
      if (currentZone === 5 && zoneState.waitStart === 0) zoneState.waitStart = k.time();

      let dir = 1;
      let jump = false;
      const target = demoTarget();
      const openDoor = doors[currentZone];
      if (target) {
        const dx = target.x - player.pos.x;
        const dy = player.pos.y - target.y;
        if (target.bump) {
          // Stand under the brick and head-bump it.
          dir = Math.abs(dx) < 8 ? 0 : Math.sign(dx);
          if (Math.abs(dx) < 14) jump = true;
        } else {
          dir = Math.abs(dx) < 12 ? 0 : Math.sign(dx);
          // Pickup sits above us and is close enough to reach with a hop.
          if (dy > 40 && Math.abs(dx) < 150) jump = true;
        }
        // Nudge out of a standoff where the target can't be reached.
        if (Math.abs(target.x - demoLastTargetX) > 24) {
          demoLastTargetX = target.x;
          demoTargetSince = now;
        } else if (demoTargetSince === 0) {
          demoTargetSince = now;
        } else if (now - demoTargetSince > 6) {
          jump = true;
          demoTargetSince = now - 3;
        }
      } else if (openDoor?.unlocked && currentZone < 7) {
        // Nothing left to collect: walk straight at the open doorway so the
        // walk-through transition always fires.
        const ddx = openDoor.obj.pos.x - player.pos.x;
        dir = ddx < -8 ? -1 : 1;
        demoTargetSince = 0;
      } else {
        demoTargetSince = 0;
      }


      // Enemies, incoming paperwork and pits all get the same answer: hop.
      if (demoNear("monster", 150, 130)) jump = true;
      if (demoNear("boss-shot", 220, 150)) jump = true;
      if (demoNear("water", 170, 400)) jump = true;
      if (demoNear("hazard", 150, 200)) jump = true;
      // Climbable platform just ahead and above the hero's feet.
      const plats = k.get("platform") as unknown as Array<{
        pos: { x: number; y: number };
        width: number;
      }>;
      for (const pf of plats) {
        const pdx = pf.pos.x - player.pos.x;
        const pdy = player.pos.y - pf.pos.y;
        if (dir >= 0 && pdx > 10 && pdx < 150 && pdy > 20 && pdy < 170) jump = true;
      }
      // Waiting out the approval clock (or parked on a pickup) is deliberate
      // standing still, not being wedged.
      const waitingOnClock = currentZone === 5 && !(zoneObjectives[5]?.met() ?? true);
      const parkedOnTarget = !!target && Math.abs(target.x - player.pos.x) < 20;
      if (waitingOnClock || parkedOnTarget) {
        demoLastX = player.pos.x;
        demoLastProgressAt = now;
      }
      // Last resort: wedged against something for a while. Hop first; only if
      // that fails do we reposition — and then onto solid ground inside the
      // current zone, never a blind 70px shove that can drop us into a pit.
      if (now - demoLastProgressAt > 2.5) jump = true;
      if (now - demoLastProgressAt > 7) {
        const zoneStart = currentZone * BIOME_W + 60;
        const zoneEnd = (currentZone + 1) * BIOME_W - 120;
        player.pos.x = Math.min(zoneEnd, Math.max(zoneStart, player.pos.x + 40));
        player.pos.y = GROUND_Y - 40;
        player.vel = k.vec2(0, 0);
        player.riding = null;
        demoLastX = player.pos.x;
        demoLastProgressAt = now;
      }



      if (jump && grounded) tryJump();
      return dir;
    }


    k.onUpdate(() => {
      if (w?.__gameInput?.resetReq) {
        w.__gameInput.resetReq = false;
        opts.onSafeProgress?.(0);
        opts.onSnapshot?.(null);
        checkpointMgr.clear();
        powerUps.reset();
        setMusic(zoneMusic(currentZone));
        k.go("trail", START_X(), 1, null);
        return;
      }

      // A step screen (or any other pause) freezes the whole simulation.
      if (isPaused()) return;
      if (transitioning) return;
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
        // Close the split for the zone we're leaving and pay the speed bonus.
        if (z > currentZone) closeZoneSplit(currentZone);
        currentZone = z;
        zoneClockStart = runClock();
        opts.onSafeProgress?.(currentZone);
        emitSnapshot();
        if (!player.visitedZones.has(z)) {
          player.visitedZones.add(z);
          player.score += 1000;
        }

        const openBriefing = () =>
          showStepScreen(z, () => {
            // Start the wait clock only once the player has read the briefing.
            if (z === 5 && zoneState.waitStart === 0) zoneState.waitStart = k.time();
          });
        // Zone 7 opens with its normal briefing; the bear's charge-in cinematic
        // now waits until the player has actually chosen a health plan.
        openBriefing();
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

      // Reaching an unlocked doorway starts the walk-through transition.
      for (let i = 0; i < 7; i++) {
        const d = doors[i];
        if (!d || !d.unlocked) continue;
        const dx = d.obj.pos.x;
        if (player.pos.x >= dx - 16 && player.pos.x <= dx + 90 && i === currentZone) {
          walkThroughDoor(i);
          break;
        }
      }

      // Fire-pole slide: freeze x, descend at controlled speed until base.
      // Safety-net: complete when Y reaches GROUND_Y even if the base
      // collider is missed on a dropped frame.
      if (zoneState.firePoleAttached && !zoneState.firePoleDone) {
        player.vel = k.vec2(0, 0);
        player.pos.y = Math.min(GROUND_Y, player.pos.y + 220 * k.dt());
        if (player.pos.y >= GROUND_Y) completeSlide();
      }

      // Backstop: the WIN overlay can never be blocked by a missed cutscene
      // transition — force the finale to finish a few seconds after landing.
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
              try {
                landing.destroy();
              } catch {
                /* ignore */
              }
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
      } else if (DEMO) {
        dir = demoAutopilot(now);
      } else {
        // Fresh-input gate: a direction only counts once it has been released
        // at least one frame since this run started. Without it, a key or an
        // on-screen button still held when the scene restarts makes the hero
        // auto-run the moment the new run begins.
        // Sample the USB controller here, one instruction before the hero
        // reads it, so stick and button state is never a frame stale.
        if (w?.__gameInput) pumpGamepadInput(w.__gameInput);
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

      // ----- Umbrella: hold Down in the waiting zone to shelter -----
      {
        const zoneNow = Math.floor(player.pos.x / BIOME_W);
        let downHeld = false;
        if (!DEMO) {
          for (const key of ["down", "s"]) if (k.isKeyDown(key as never)) downHeld = true;
          if (w?.__gameInput?.down) downHeld = true;
        }
        const canUmbrella = zoneNow === ZONE_INDEX.awaitDecision && !player.dead && !player.won;
        const nowUp = downHeld && canUmbrella;
        if (nowUp && !umbrellaState.up && !umbrellaState.taught) {
          umbrellaState.taught = true;
          showHint(tr("Umbrella up! Falling dates bounce off while you hold it."), 2.6);
        }
        umbrellaState.up = nowUp;
      }

      // Sheltering slows you down — unless the Email power-up is carried, which
      // is now its benefit: shelter at full walking speed.
      {
        const zoneNow = Math.floor(player.pos.x / BIOME_W);
        const slow = umbrellaState.up && !powerUps.umbrellaActive(zoneNow) ? 0.45 : 1;
        player.move(dir * MOVE_SPEED * slow, 0);
      }

      if (dir > 0 && !zoneState.cutscene) player.score += 1;

      // A collapsing Zone 3 platform stops being ground the instant it lets
      // go — the hero must drop into the new gap, not hover on a memory.
      if (player.riding && (player.riding as { phase?: string }).phase === "falling") {
        player.riding = null;
      }

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

      if (groundedNow) {
        player.lastGroundedAt = now;
        player.airJumpsLeft = 1;
      }

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
        // Distance-based cycle: legs advance in lockstep with real movement.
        // Contact / passing / contact / passing at a 12px stride turns the legs
        // over fast enough that the run reads as steps, not a glide.
        const CYCLE = [0, 1, 2, 3];
        const STRIDE_PX = 12;
        const idx = Math.floor(Math.abs(player.pos.x) / STRIDE_PX) % CYCLE.length;
        const target = CYCLE[idx];
        const want = `hero-walk-${target}${facingSuffix(`hero-walk-${target}`)}`;
        if (player.walkFrame !== target || player.animState !== "walk") {
          player.walkFrame = target;
          setSprite(want);
        }
        // Footfall weight: squash 2px on the contact frames, full height on the
        // passing frames. Anchor is "bot" so the feet stay planted, and the
        // explicit area rect is untouched — purely visual.
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
      k.setCamPos(px(camX), px(LOGICAL_H / 2 + (bonusActive ? BONUS_DY : 0)));
    });

    for (const key of jumpKeys) k.onKeyPress(key as never, () => tryJump());
    const ackFail = () => {
      if (!pendingLose) return false;
      flushPendingLose();
      return true;
    };
    k.onKeyPress("r", () => {
      // While the win sequence is playing the player must watch the
      // thank-you cutscene before restarting.
      if (player.won) return;
      if (ackFail()) return;
      opts.onSnapshot?.(null);
      k.go("trail", START_X(), 1, null);
    });
    k.onKeyPress("enter", () => {
      if (player.won) return;
      ackFail();
    });

    (player as AnyObj).use(k.opacity(1));
    player.onUpdate(() => {
      updateBonusStage();
      if (player.pos.y > 720 && !bonusActive) {
        if (!bonusInterceptsFall()) loseLife("fell");
      }
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
      // Completed zones are sealed: never let the player drift back through a
      // door they already walked into.
      if (progressFloorX > 0 && player.pos.x < progressFloorX) {
        player.pos.x = progressFloorX;
        if (p.vel && p.vel.x < 0) p.vel.x = 0;
      }
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
    // Continuing from the Thank You screen is what finally reports the win —
    // that is when the high-score / suggestion overlay is allowed to appear.
    let leftThanks = false;
    const leaveThanks = () => {
      if (leftThanks) return;
      leftThanks = true;
      flushPendingWin();
      opts.onSnapshot?.(null);
      // Park on the finale either way — never auto-restart gameplay here.
      // Real run: the host shows the score / feedback screen over this frame
      // and returns to the title when the player closes it.
      // Demo: the host reboots the engine for a fresh attract loop.
    };
    // Attract mode has nobody to press "play again": hold the finale long
    // enough to read, then hand the loop back to the host.
    if (opts.demo === true) k.wait(9, () => leaveThanks());


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
      "Thanks for blazing the trail with me!\nEvery idea you share makes the next journey a little less bumpy.\n\nIf you enjoyed this game, vote for our poster session!\n\nHave a great time at MESC 2026!\nYour friends at Minnesota Department of Human Services!";

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
          font: UI_FONT,
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
    // Map a point in the backdrop art (0-1) to canvas space, accounting for
    // the COVER scaling above — used to stand the hero-on-bed sprite on the
    // room's floor where the painted exam bed used to be.
    const bgPt = (fx: number, fy: number) => ({
      x: W / 2 + (fx - 0.5) * BG_W * bgScale,
      y: H / 2 + (fy - 0.5) * BG_H * bgScale,
    });
    const bed = bgPt(0.8, 0.99);

    // Bubble tail pointing down toward the hero on the bed.
    k.add([
      k.rect(22, 16),
      k.pos(Math.floor(Math.min(W - 30, Math.max(30, bed.x - 40))), by + bh - 1),
      k.color(252, 250, 235),
      k.outline(3, k.rgb(0, 0, 0)),
      k.fixed(),
      k.z(9),
    ]);

    // The bed itself is no longer painted into the backdrop — this sprite is
    // the whole bed-and-hero element, standing on the room's floor.
    const bottomLimit = H - SAFE_Y * 0.2;
    const heroTop = by + bh + 8;
    const heroFootY = Math.floor(Math.min(bottomLimit, bed.y));
    const portraitH = Math.max(120, Math.min(300, heroFootY - heroTop));
    k.add([
      k.sprite("hero-sitting", { width: portraitH, height: portraitH }),
      k.pos(Math.floor(Math.min(W - portraitH * 0.35, bed.x)), heroFootY),
      k.anchor("bot"),
      k.fixed(),
      k.z(5),
    ]);

    // Logos were removed from this screen — the sign-off now lives in the
    // speech bubble copy so nothing overlaps the waving hero.

    // Blinking restart prompt.
    const prompt = k.add([
      k.text(CONTINUE_PROMPT(), { size: 16, font: UI_FONT }),
      k.pos(Math.floor(W / 2), H - SAFE_Y - 6),
      k.anchor("center"),
      k.color(255, 235, 120),
      k.opacity(1),
      k.fixed(),
      k.z(12),
    ]);
    const winReset =
      typeof window !== "undefined"
        ? (window as unknown as {
            __gameInput?: { left: boolean; right: boolean; jumpReq: boolean; resetReq: boolean };
          })
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
        leaveThanks();
      }
    });

    const hit = k.add([k.rect(W, H), k.pos(0, 0), k.opacity(0), k.area(), k.fixed(), k.z(20)]);
    hit.onClick(() => leaveThanks());
    for (const key of ["r", "space", "enter"]) {
      k.onKeyPress(key as never, () => leaveThanks());
    }
  });

  // ==================== Warm-up (practice trail) ====================
  // A safe Portland-forest clearing that runs BEFORE Zone 1: no enemies, no
  // pits, no clock, no lives. The player tries moving, jumping and grabbing a
  // pickup; once all three are done (or 20 seconds pass) the trail-head door
  // opens and the real run begins.
  k.scene("warmup", () => {
    uiRelayout.clear();
    UI_TEXT_SCALE = computeUiTextScale(opts.canvas, k.width());
    setMusic(zoneMusic(0));
    const touch = isCoarsePointer();
    const T = UI_TEXT_SCALE;

    const STAGE_END = 1700;
    const DOOR_X = STAGE_END - 150;

    // ---- Scenery: same 16-bit Oregon forest plate as Zone 1 --------------
    k.add([
      k.rect(STAGE_END + 400, 540),
      k.pos(-200, 0),
      k.color(128, 190, 220),
      k.z(LAYERS.BG_FAR - 1),
    ]);
    for (let i = 0; i < 2; i++) {
      k.add([
        k.sprite("bg-forest", { width: BIOME_W, height: 540 }),
        k.pos(i * BIOME_W, 0),
        k.z(LAYERS.BG_FAR),
      ]);
    }
    spawnMosquitoSwarm(k, 0, STAGE_END, isTouchDevice() ? 2 : 3);

    // Unbroken ground — there is nothing here to fall into.
    addGround(k, -200, STAGE_END + 200, GROUND_Y, ZONES[0].ground, ZONES[0].soil);
    // Invisible walls keep the practice pen closed on both ends.
    for (const wx of [-60, STAGE_END]) {
      k.add([
        k.rect(40, 600),
        k.pos(wx, GROUND_Y - 600),
        k.opacity(0),
        k.area(),
        k.body({ isStatic: true }),
        k.z(LAYERS.BOUND),
      ]);
    }

    // ---- Player ----------------------------------------------------------
    const spawnX = START_X();
    const hero = k.add([
      k.sprite("hero-idle", {
        width: displaySize("hero-idle", sizes).w,
        height: DISPLAY_H["hero-idle"],
      }),
      k.pos(spawnX, GROUND_Y - 20),
      k.area({ shape: new k.Rect(k.vec2(0, 0), PLAYER_HITBOX.w, PLAYER_HITBOX.h) }),
      k.body(),
      k.anchor("bot"),
      k.z(LAYERS.PLAYER),
      "player",
      { facing: 1 as 1 | -1, animState: "idle" as "idle" | "walk" | "jump", walkFrame: 0 },
    ]);

    let spriteName = "hero-idle";
    const suffix = (base: string) => (hero.facing < 0 && sizes[`${base}-left`] ? "-left" : "");
    const setHeroSprite = (name: string) => {
      const wantFlip = hero.facing < 0 && !name.endsWith("-left");
      if (hero.flipX !== wantFlip) hero.flipX = wantFlip;
      if (spriteName === name) return;
      spriteName = name;
      const ds = displaySize(name, sizes);
      hero.sprite = name;
      hero.width = ds.w;
      hero.height = DISPLAY_H[name] ?? ds.h;
      hero.frame = 0;
    };

    // ---- Practice checklist ---------------------------------------------
    const done = { move: false, jump: false, dbl: false, collect: false };
    let ready = false;
    let left = false;

    // ---- Coach plaques (device-aware copy) -------------------------------
    addSignPlaque(k, spawnX + 40, GROUND_Y - 210, "Practice here. Nothing can hurt you.", "WARM-UP");
    addSignPlaque(
      k,
      spawnX + 40,
      GROUND_Y - 150,
      touch ? "Slide the joystick left and right" : "Arrow keys or A / D",
      "MOVE",
    );
    addSignPlaque(
      k,
      700,
      GROUND_Y - 230,
      touch ? "Tap the JUMP button" : "Space or Up Arrow to jump",
      "JUMP",
    );
    addSignPlaque(k, 1120, GROUND_Y - 250, "Bump the brick above you", "COLLECT");
    addSignPlaque(
      k,
      900,
      GROUND_Y - 300,
      touch
        ? "Tap JUMP again in mid-air to jump twice"
        : "Press jump again in mid-air to jump twice",
      "DOUBLE JUMP",
    );

    // ---- Practice platforms ---------------------------------------------
    const addLedge = (x: number, y: number, w: number) => {
      k.add([
        k.rect(w, 18, { radius: 2 }),
        k.pos(x, y),
        k.color(120, 92, 54),
        k.outline(2, k.rgb(58, 40, 22)),
        k.area(),
        k.body({ isStatic: true }),
        k.z(LAYERS.PLATFORM),
      ]);
      k.add([k.rect(w, 6), k.pos(x, y), k.color(96, 148, 72), k.z(LAYERS.PLATFORM + 1)]);
    };
    addLedge(620, GROUND_Y - 110, 150);
    addLedge(880, GROUND_Y - 190, 150);

    // ---- Double-jump practice star (out of reach of a single jump) --------
    const star = k.add([
      k.rect(26, 26, { radius: 3 }),
      k.pos(955, GROUND_Y - 380),
      k.anchor("center"),
      k.rotate(45),
      k.color(255, 214, 92),
      k.outline(2, k.rgb(120, 84, 12)),
      k.area(),
      k.z(LAYERS.PROP + 1),
      { t: 0, baseY: GROUND_Y - 380 },
    ]) as AnyObj;
    markCollectible(k, star, { label: "DOUBLE JUMP", width: 26, height: 26 });
    star.onUpdate(() => {
      star.t += k.dt();
      star.pos.y = star.baseY + Math.sin(star.t * 3) * 7;
      star.angle = 45 + Math.sin(star.t * 2) * 12;
    });
    star.onCollide("player", () => {
      if (!star.exists()) return;
      done.dbl = true;
      showBanner("Double jump! Tap jump again in mid-air for extra height.", 3);
      k.destroy(star);
    });



    // ---- Practice brick + pack ------------------------------------------
    const brickDisp = displaySize("brick-idle", sizes);
    const brick = k.add([
      k.sprite("brick-idle", { width: brickDisp.w, height: DISPLAY_H["brick-idle"] }),
      k.pos(1150, GROUND_Y - 150),
      k.anchor("center"),
      k.area(),
      k.z(LAYERS.PROP),
      "pbrick",
      { popped: false },
    ]) as AnyObj;

    const popPack = () => {
      const disp = displaySize("backpack", sizes);
      const pack = k.add([
        k.sprite("backpack", { width: disp.w, height: DISPLAY_H["backpack"] }),
        k.pos(brick.pos.x, brick.pos.y - 30),
        k.anchor("center"),
        k.area(),
        k.z(LAYERS.PROP + 1),
        "ppack",
        { t: 0, baseY: brick.pos.y - 58 },
      ]) as AnyObj;
      markCollectible(k, pack, {
        label: "GRAB",
        width: disp.w,
        height: DISPLAY_H["backpack"],
      });
      pack.onUpdate(() => {
        pack.t += k.dt();
        pack.pos.y = pack.baseY + Math.sin(pack.t * 3) * 6;
      });
    };

    hero.onCollide("pbrick", (b: unknown) => {
      const bb = b as AnyObj;
      if (bb.popped || hero.vel.y >= 0) return;
      bb.popped = true;
      const hitDisp = displaySize("brick-hit", sizes);
      bb.sprite = "brick-hit";
      bb.width = hitDisp.w;
      bb.height = DISPLAY_H["brick-hit"];
      playSfx("pickup");
      popPack();
    });

    // ---- Harmless practice enemy ----------------------------------------
    // The first enemy anyone meets should be one that cannot kill them, so the
    // "jump over it" habit is learned here instead of in Zone 2.
    {
      const ENEMY_HOME = 1330;
      const ph = DISPLAY_H["padlock"];
      const pw = displaySize("padlock", sizes).w;
      const foe = k.add([
        k.sprite("padlock", { width: pw, height: ph }),
        k.pos(ENEMY_HOME, GROUND_Y),
        k.anchor("bot"),
        k.area({ shape: new k.Rect(k.vec2(-pw / 2, -ph), pw, ph) }),
        k.z(LAYERS.ACTOR),
        { dir: 1 as 1 | -1 },
      ]) as AnyObj;
      addSignPlaque(k, ENEMY_HOME, GROUND_Y - 250, "You can't squash me — jump OVER, not on me!", "ENEMY");
      let cleared = false;
      let bumped = 0;
      foe.onUpdate(() => {
        foe.pos.x += foe.dir * 46 * k.dt();
        if (foe.pos.x > ENEMY_HOME + 80) foe.dir = -1;
        if (foe.pos.x < ENEMY_HOME - 80) foe.dir = 1;
        const nearX = Math.abs(hero.pos.x - foe.pos.x) < pw * 0.7;
        // Landing on the head is the exact mistake this coach exists to stop,
        // so it gets its own message before the generic contact one.
        const onHead =
          nearX &&
          hero.pos.y <= GROUND_Y - ph * 0.55 &&
          hero.pos.y >= GROUND_Y - ph - 26 &&
          (hero.vel?.y ?? 0) >= -10;
        const overlapping = nearX && hero.pos.y > GROUND_Y - ph;
        if ((onHead || overlapping) && k.time() - bumped > 2) {
          bumped = k.time();
          showBanner(
            onHead
              ? "Jumping ON an enemy still hurts — clear it with a full jump."
              : "No stomping! That would have cost a life — jump over enemies.",
            3,
          );
        }

        if (!cleared && hero.pos.x > ENEMY_HOME + 120) {
          cleared = true;
          showBanner("Perfect — over the top, never on top.", 3);
        }
      });
    }

    hero.onCollide("ppack", (p: unknown) => {
      (p as AnyObj).destroy();
      done.collect = true;
      playSfx("pickup");
      showBanner("Nice grab! That's how you pick things up.");
    });

    // ---- HUD: checklist + banner ----------------------------------------
    const hudPanel = k.add([
      k.rect(Math.round(228 * T), Math.round(92 * T), { radius: 4 }),
      k.pos(14, 14),
      k.color(26, 30, 42),
      k.outline(3, k.rgb(250, 240, 210)),
      k.opacity(0.92),
      k.fixed(),
      k.z(LAYERS.HUD),
    ]);
    const hudTitle = k.add([
      k.text("WARM-UP · PRACTICE TRAIL", { size: Math.round(11 * T), font: UI_FONT }),
      k.pos(26, 24),
      k.color(255, 226, 120),
      k.fixed(),
      k.z(LAYERS.HUD + 1),
    ]) as AnyObj;
    const hudList = k.add([
      k.text("", { size: Math.round(12 * T), font: UI_FONT, lineSpacing: 4 }),
      k.pos(26, Math.round(24 + 18 * T)),
      k.color(250, 246, 235),
      k.fixed(),
      k.z(LAYERS.HUD + 1),
    ]) as AnyObj;

    const bannerY = 470;
    let bannerParts: AnyObj[] = [];
    function showBanner(msg: string, hold = 3) {
      for (const p of bannerParts) p.destroy();
      const size = Math.round(13 * T);
      const w = Math.min(k.width() - 40, Math.max(320, msg.length * 7.4 * T));
      const bg = k.add([
        k.rect(w, Math.round(34 * T), { radius: 4 }),
        k.pos(k.width() / 2, bannerY),
        k.anchor("center"),
        k.color(22, 26, 38),
        k.outline(3, k.rgb(255, 226, 120)),
        k.opacity(0.95),
        k.fixed(),
        k.z(LAYERS.HUD + 4),
      ]) as AnyObj;
      const tx = k.add([
        k.text(msg, { size, font: UI_FONT, width: w - 24, align: "center" }),
        k.pos(k.width() / 2, bannerY),
        k.anchor("center"),
        k.color(255, 252, 240),
        k.fixed(),
        k.z(LAYERS.HUD + 5),
      ]) as AnyObj;
      bannerParts = [bg, tx];
      const mine = bannerParts;
      if (hold > 0) {
        k.wait(hold, () => {
          if (bannerParts !== mine) return;
          for (const p of mine) p.destroy();
          bannerParts = [];
        });
      }
    }

    // ---- Skip button ------------------------------------------------------
    const skipW = Math.round(150 * T);
    const skipH = Math.round(30 * T);
    const skipBtn = k.add([
      k.rect(skipW, skipH, { radius: 4 }),
      k.pos(k.width() - skipW - 16, 16),
      k.color(40, 46, 62),
      k.outline(3, k.rgb(250, 240, 210)),
      k.opacity(0.92),
      k.area(),
      k.fixed(),
      k.z(LAYERS.HUD + 2),
    ]) as AnyObj;
    k.add([
      k.text(touch ? "SKIP WARM-UP" : "SKIP WARM-UP (ENTER)", {
        size: Math.round(9 * T),
        font: UI_FONT,
      }),
      k.pos(k.width() - skipW / 2 - 16, 16 + skipH / 2),
      k.anchor("center"),
      k.color(255, 226, 120),
      k.fixed(),
      k.z(LAYERS.HUD + 3),
    ]);

    // ---- Door -------------------------------------------------------------
    const doorDisp = displaySize("door-closed", sizes);
    const door = k.add([
      k.sprite("door-closed", { width: doorDisp.w, height: DISPLAY_H["door-closed"] }),
      k.pos(DOOR_X, GROUND_Y),
      k.anchor("bot"),
      k.z(LAYERS.PROP + 2),
    ]) as AnyObj;
    const doorBar = k.add([
      k.rect(14, 560),
      k.pos(DOOR_X - 7, GROUND_Y - 560),
      k.color(60, 40, 20),
      k.opacity(0),
      k.area(),
      k.body({ isStatic: true }),
      k.z(LAYERS.PROP),
    ]) as AnyObj;
    const lockDisp = displaySize("door-lock", sizes);
    const lockBadge = k.add([
      k.sprite("door-lock", { width: lockDisp.w, height: DISPLAY_H["door-lock"] }),
      k.pos(DOOR_X, GROUND_Y - DISPLAY_H["door-closed"] / 2),
      k.anchor("center"),
      k.z(LAYERS.PROP + 3),
    ]) as AnyObj;
    const doorSign = addSignPlaque(
      k,
      DOOR_X,
      GROUND_Y - DISPLAY_H["door-closed"] - 24,
      "Try moving, jumping and grabbing the pack.",
      "TRAIL HEAD",
    );

    function makeReady() {
      if (ready) return;
      ready = true;
      playSfx("door-unlock");
      k.wait(0.4, () => {
        playSfx("door-open");
        const openDisp = displaySize("door-open", sizes);
        door.sprite = "door-open";
        door.width = openDisp.w;
        door.height = DISPLAY_H["door-open"];
        doorBar.destroy();
        lockBadge.destroy();
        for (const part of doorSign) part.destroy();
        addSignPlaque(
          k,
          DOOR_X,
          GROUND_Y - DISPLAY_H["door-open"] - 24,
          "You're ready — go through the door to start.",
          "READY!",
        );
      });
      showBanner("You're ready — go through the door to start.", 0);
    }

    function leaveWarmup() {
      if (left) return;
      left = true;
      const w =
        typeof window !== "undefined"
          ? (window as unknown as {
              __gameInput?: { left: boolean; right: boolean; jumpReq: boolean; resetReq: boolean };
            })
          : undefined;
      if (w?.__gameInput) {
        w.__gameInput.left = false;
        w.__gameInput.right = false;
        w.__gameInput.jumpReq = false;
        w.__gameInput.resetReq = false;
      }
      opts.onSnapshot?.(null);
      k.go("trail", START_X(), 1, null);
    }

    skipBtn.onClick(() => leaveWarmup());
    k.onKeyPress("enter", () => leaveWarmup());

    // Nobody is stranded here: after 20 seconds the door opens regardless.
    k.wait(20, () => makeReady());
    showBanner("Practice here — nothing can hurt you. Move, jump and grab the pack.", 5);

    // ---- Movement + jump --------------------------------------------------
    const wIn =
      typeof window !== "undefined"
        ? (window as unknown as {
            __gameInput?: { left: boolean; right: boolean; jumpReq: boolean; resetReq: boolean };
          })
        : undefined;
    let leftArmed = false;
    let rightArmed = false;
    let lastGrounded = k.time();
    let airJumpsLeft = 1;

    const puffAt = (x: number, y: number) => {
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI / 5) * i + Math.PI * 0.1;
        const puff = k.add([
          k.rect(4, 4),
          k.pos(x, y - 4),
          k.anchor("center"),
          k.color(255, 255, 255),
          k.opacity(0.9),
          k.z(LAYERS.PROP + 2),
          { t: 0, vx: Math.cos(ang) * 70, vy: 30 },
        ]) as AnyObj;
        puff.onUpdate(() => {
          puff.t += k.dt();
          puff.pos.x += puff.vx * k.dt();
          puff.pos.y += puff.vy * k.dt();
          puff.opacity = Math.max(0, 0.9 - puff.t * 2.6);
          if (puff.t > 0.4) k.destroy(puff);
        });
      }
    };

    const tryJump = () => {
      if (left) return;
      if (hero.isGrounded() || k.time() - lastGrounded < COYOTE_S) {
        hero.jump(JUMP_VEL);
        airJumpsLeft = 1;
        done.jump = true;
      } else if (airJumpsLeft > 0) {
        airJumpsLeft -= 1;
        if (hero.vel.y > 0) hero.vel.y = 0;
        hero.jump(AIR_JUMP_VEL);
        puffAt(hero.pos.x, hero.pos.y);
        done.jump = true;
        done.dbl = true;
      }
    };
    for (const key of ["space", "up", "w"]) k.onKeyPress(key as never, () => tryJump());

    k.onUpdate(() => {
      let dir = 0;
      if (wIn?.__gameInput) pumpGamepadInput(wIn.__gameInput);
      let rawLeft = false;
      let rawRight = false;
      for (const key of ["left", "a"]) if (k.isKeyDown(key as never)) rawLeft = true;
      for (const key of ["right", "d"]) if (k.isKeyDown(key as never)) rawRight = true;
      if (wIn?.__gameInput?.left) rawLeft = true;
      if (wIn?.__gameInput?.right) rawRight = true;
      if (!rawLeft) leftArmed = true;
      if (!rawRight) rightArmed = true;
      if (rawLeft && leftArmed) dir -= 1;
      if (rawRight && rightArmed) dir += 1;
      dir = Math.sign(dir);

      hero.move(dir * MOVE_SPEED, 0);
      if (dir !== 0) {
        hero.facing = dir as 1 | -1;
        done.move = true;
      }

      if (wIn?.__gameInput?.jumpReq) {
        wIn.__gameInput.jumpReq = false;
        tryJump();
      }
      if (wIn?.__gameInput?.resetReq) {
        wIn.__gameInput.resetReq = false;
        leaveWarmup();
      }

      const grounded = hero.isGrounded();
      if (grounded) {
        lastGrounded = k.time();
        airJumpsLeft = 1;
      }

      if (!grounded) {
        setHeroSprite(`hero-jump${suffix("hero-jump")}`);
      } else if (dir !== 0) {
        const idx = Math.floor(Math.abs(hero.pos.x) / 12) % 4;
        setHeroSprite(`hero-walk-${idx}${suffix(`hero-walk-${idx}`)}`);
        hero.height = (DISPLAY_H[`hero-walk-${idx}`] ?? hero.height) - (idx % 2 === 0 ? 2 : 0);
      } else {
        setHeroSprite(`hero-idle${suffix("hero-idle")}`);
      }

      // Checklist HUD
      const mark = (ok: boolean) => (ok ? "✓" : "☐");
      hudList.text =
        `${mark(done.move)} MOVE\n` +
        `${mark(done.jump)} JUMP\n` +
        `${mark(done.dbl)} DOUBLE JUMP\n` +
        `${mark(done.collect)} COLLECT`;
      hudPanel.opacity = 0.92;
      hudTitle.opacity = 1;

      if (!ready && done.move && done.jump && done.dbl && done.collect) makeReady();

      // Walk through the open door to begin Zone 1.
      if (ready && hero.pos.x >= DOOR_X - 16) leaveWarmup();

      const camX = Math.max(
        Math.min(k.width(), VIEW_W) / 2,
        Math.min(hero.pos.x, STAGE_END - VIEW_W / 2),
      );
      k.setCamPos(px(camX), px(LOGICAL_H / 2));
    });
  });

  const resumeZone = Math.min(ZONES.length - 1, Math.max(0, Math.floor(opts.resumeZone ?? 0)));
  const bootSnapshot = opts.resumeSnapshot ?? null;
  // A fresh Zone 1 start (not a resume, not attract mode) begins in the
  // practice trail so players can learn the controls without risk.
  const startInWarmup = !bootSnapshot && resumeZone === 0 && opts.demo !== true;
  if (startInWarmup) {
    k.go("warmup");
  } else {
    k.go(
      "trail",
      (bootSnapshot ? bootSnapshot.zone : resumeZone) * BIOME_W + START_X(),
      1,
      bootSnapshot,
    );
  }


  return () => {
    try {
      stopLayoutWatch();
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
  k.add([k.rect(w, 14), k.pos(x, yy - 10), k.color(...topColor), k.z(LAYERS.GROUND_TOP)]);
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
    k.text(small, { size: 16, font: UI_FONT }),
    k.pos(W / 2, H / 2 - 44),
    k.anchor("center"),
    k.color(220, 220, 220),
    k.opacity(0),
    k.fixed(),
    k.z(151),
  ]);
  const bigShadow = k.add([
    k.text(big, { size: 44, font: UI_FONT }),
    k.pos(W / 2 + 3, H / 2 + 3),
    k.anchor("center"),
    k.color(0, 0, 0),
    k.opacity(0),
    k.fixed(),
    k.z(151),
  ]);
  const bigTxt = k.add([
    k.text(big, { size: 44, font: UI_FONT }),
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

/** Chunky 16-bit icons for each Zone 1 apply method, drawn as flat pixel
 *  blocks in a 30x30 space centred on the collectible (offsets are relative). */
type IconPixel = { x: number; y: number; w: number; h: number; c: [number, number, number] };
const METHOD_ICON_PIXELS: Record<string, IconPixel[]> = {
  // Envelope
  MAIL: [
    { x: 0, y: 0, w: 22, h: 15, c: [252, 252, 245] },
    { x: 0, y: -7, w: 22, h: 2, c: [180, 170, 150] },
    { x: -5, y: -4, w: 5, h: 3, c: [120, 110, 95] },
    { x: 0, y: -1, w: 5, h: 3, c: [120, 110, 95] },
    { x: 5, y: -4, w: 5, h: 3, c: [120, 110, 95] },
    { x: 0, y: 5, w: 14, h: 2, c: [200, 195, 180] },
  ],
  // Cell phone
  PHONE: [
    { x: 0, y: 0, w: 14, h: 24, c: [40, 45, 60] },
    { x: 0, y: -1, w: 10, h: 16, c: [120, 220, 240] },
    { x: 0, y: 9, w: 4, h: 3, c: [180, 190, 205] },
    { x: 0, y: -10, w: 5, h: 2, c: [180, 190, 205] },
  ],
  // Public assistance office building
  "IN PERSON": [
    { x: 0, y: 3, w: 22, h: 18, c: [176, 172, 165] },
    { x: 0, y: -8, w: 24, h: 5, c: [110, 118, 135] },
    { x: -6, y: -1, w: 5, h: 5, c: [130, 205, 235] },
    { x: 6, y: -1, w: 5, h: 5, c: [130, 205, 235] },
    { x: -6, y: 7, w: 5, h: 5, c: [130, 205, 235] },
    { x: 6, y: 7, w: 5, h: 5, c: [130, 205, 235] },
    { x: 0, y: 8, w: 6, h: 9, c: [90, 65, 40] },
  ],
  // Laptop
  ONLINE: [
    { x: 0, y: -4, w: 22, h: 15, c: [70, 78, 95] },
    { x: 0, y: -4, w: 17, h: 10, c: [130, 215, 235] },
    { x: 0, y: 6, w: 26, h: 4, c: [150, 158, 175] },
  ],
};

/** High-contrast wooden trail-sign plaque used for Zone 1 apply methods.
 *  Draws a solid cream card with a dark outline, an icon badge on top, and
 *  the sign label in dark brown so it stays readable over the foggy forest. */
function addSignPlaque(
  k: Ctx,
  x: number,
  topY: number,
  label: string,
  badge: string,
  tag?: string,
): AnyObj[] {
  const parts: AnyObj[] = [];
  const tagged = tag ? [tag] : [];
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
  parts.push(k.add([
    k.rect(w, badgeH, { radius: 3 }),
    k.pos(x, cy - totalH / 2 + badgeH / 2),
    k.anchor("center"),
    k.color(40, 55, 90),
    k.outline(2, k.rgb(20, 25, 40)),
    k.z(LAYERS.EFFECT),
    ...tagged,
  ]) as AnyObj);
  const badgeTextY = cy - totalH / 2 + badgeH / 2 + 1;
  parts.push(k.add([
    k.text(badge, { size: badgeSize, font: UI_FONT }),
    k.pos(x + 1, badgeTextY + 1),
    k.anchor("center"),
    k.color(0, 0, 0),
    k.z(LAYERS.EFFECT + 1),
    ...tagged,
  ]) as AnyObj);
  parts.push(k.add([
    k.text(badge, { size: badgeSize, font: UI_FONT }),
    k.pos(x, badgeTextY),
    k.anchor("center"),
    k.color(255, 235, 150),
    k.z(LAYERS.EFFECT + 2),
    ...tagged,
  ]) as AnyObj);
  // Label plaque (bottom)
  parts.push(k.add([
    k.rect(w, labelH, { radius: 3 }),
    k.pos(x, cy + totalH / 2 - labelH / 2),
    k.anchor("center"),
    k.color(250, 240, 210),
    k.outline(2, k.rgb(80, 55, 25)),
    k.z(LAYERS.EFFECT),
    ...tagged,
  ]) as AnyObj);
  const labelTextY = cy + totalH / 2 - labelH / 2 + 1;
  parts.push(k.add([
    k.text(label, { size: labelSize, font: UI_FONT }),
    k.pos(x + 1, labelTextY + 1),
    k.anchor("center"),
    k.color(255, 240, 220),
    k.z(LAYERS.EFFECT + 1),
    ...tagged,
  ]) as AnyObj);
  const labelText = k.add([
    k.text(label, { size: labelSize, font: UI_FONT }),
    k.pos(x, labelTextY),
    k.anchor("center"),
    k.color(30, 20, 10),
    k.z(LAYERS.EFFECT + 2),
    ...tagged,
  ]) as AnyObj;
  parts.push(labelText);
  return parts;
}

function addSpeech(
  k: Ctx,
  x: number,
  y: number,
  text: string,
  _rgb: [number, number, number],
  tag?: string,
): AnyObj[] {
  // High-contrast world label: dark plaque behind gold text with 1-px shadow.
  // (rgb argument ignored — standardized on gold-on-navy for legibility.)
  // Sized up so the sign stays readable in windowed (non-fullscreen) play.
  // Returns its parts so callers can destroy the sign once the thing it
  // labels has been collected.
  const size = Math.round(16 * UI_TEXT_SCALE);
  const charW = size * 0.62;
  const w = Math.max(72, Math.ceil(text.length * charW) + 22);
  const h = size + 16;
  const extra = tag ? [tag] : [];
  const plaque = k.add([
    k.rect(w, h, { radius: 3 }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(10, 14, 32),
    k.outline(3, k.rgb(255, 220, 90)),
    k.opacity(1),
    k.z(LAYERS.EFFECT),
    ...extra,
  ] as never) as AnyObj;
  const shadow = k.add([
    k.text(text, { size, font: UI_FONT, align: "center" }),
    k.pos(x + 2, y + 2),
    k.anchor("center"),
    k.color(0, 0, 0),
    k.z(LAYERS.EFFECT + 1),
    ...extra,
  ] as never) as AnyObj;
  const label = k.add([
    k.text(text, { size, font: UI_FONT, align: "center" }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(255, 232, 130),
    k.z(LAYERS.EFFECT + 2),
    ...extra,
  ] as never) as AnyObj;
  return [plaque, shadow, label];
}

/** Remove a sign returned by addSpeech (safe to call twice). */
function removeSpeech(parts?: AnyObj[] | null) {
  if (!parts) return;
  for (const o of parts) {
    try {
      (o as unknown as { destroy: () => void }).destroy();
    } catch {
      /* already gone */
    }
  }
}

/** Tiny decorative mosquito that flies back and forth across a stretch of the
 *  backdrop with a fluttering wobble. Purely cosmetic: no area, no collision,
 *  no gameplay effect. Drawn on BG_NEAR so it never covers gameplay or UI. */
function spawnMosquito(k: Ctx, x: number, y: number, range: number) {
  const scale = 0.8 + Math.random() * 0.7;
  const speed = (26 + Math.random() * 26) * scale;
  const bobAmp = 5 + Math.random() * 7;
  const bobSpeed = 1.4 + Math.random() * 1.2;
  const phase = Math.random() * Math.PI * 2;
  const left = x - range / 2;
  const right = x + range / 2;
  const z = LAYERS.BG_NEAR + 1;
  const body = k.add([
    k.rect(6 * scale, 3 * scale),
    k.pos(x, y),
    k.anchor("center"),
    k.color(38, 34, 44),
    k.opacity(0.9),
    k.z(z),
  ]) as AnyObj;
  const head = k.add([
    k.rect(3 * scale, 3 * scale),
    k.pos(x, y),
    k.anchor("center"),
    k.color(28, 24, 34),
    k.opacity(0.9),
    k.z(z),
  ]) as AnyObj;
  const beak = k.add([
    k.rect(4 * scale, 1 * scale),
    k.pos(x, y),
    k.anchor("center"),
    k.color(28, 24, 34),
    k.opacity(0.85),
    k.z(z),
  ]) as AnyObj;
  const wingA = k.add([
    k.rect(5 * scale, 2 * scale),
    k.pos(x, y),
    k.anchor("center"),
    k.color(225, 235, 245),
    k.opacity(0.6),
    k.z(z),
  ]) as AnyObj;
  const wingB = k.add([
    k.rect(5 * scale, 2 * scale),
    k.pos(x, y),
    k.anchor("center"),
    k.color(225, 235, 245),
    k.opacity(0.6),
    k.z(z),
  ]) as AnyObj;

  let px = x;
  let dir = Math.random() < 0.5 ? -1 : 1;
  k.onUpdate(() => {
    px += dir * speed * k.dt();
    if (px < left) {
      px = left;
      dir = 1;
    } else if (px > right) {
      px = right;
      dir = -1;
    }
    const t = k.time();
    const py = y + Math.sin(t * bobSpeed + phase) * bobAmp;
    // 2-frame wing flutter (fast up/down flap).
    const flap = Math.sin(t * 26 + phase) > 0 ? -2 * scale : 1 * scale;
    body.pos.x = px;
    body.pos.y = py;
    head.pos.x = px + dir * 4 * scale;
    head.pos.y = py;
    beak.pos.x = px + dir * 7.5 * scale;
    beak.pos.y = py;
    wingA.pos.x = px - dir * 1 * scale;
    wingA.pos.y = py + flap - 2 * scale;
    wingB.pos.x = px - dir * 3 * scale;
    wingB.pos.y = py - flap - 1 * scale;
  });
}

/** Scatter a small swarm of decorative mosquitoes over a horizontal span. */
function spawnMosquitoSwarm(k: Ctx, x0: number, width: number, count: number) {
  const n = Math.max(0, Math.min(4, count));
  for (let i = 0; i < n; i++) {
    const cx = x0 + width * (0.15 + (0.7 * (i + 0.5)) / n) + (Math.random() - 0.5) * 60;
    const cy = 90 + Math.random() * 210;
    const range = 90 + Math.random() * 150;
    spawnMosquito(k, cx, cy, range);
  }
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
    k.text(text, { size, font: UI_FONT }),
    k.pos(x + 1, y + 1),
    k.anchor("center"),
    k.color(0, 0, 0),
    k.opacity(0.35),
    k.z(LAYERS.BG_NEAR + 2),
  ]);
  const t = k.add([
    k.text(text, { size, font: UI_FONT }),
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
    [255, 90, 90],
    [255, 200, 80],
    [90, 220, 255],
    [140, 255, 140],
    [255, 130, 220],
    [255, 255, 120],
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
