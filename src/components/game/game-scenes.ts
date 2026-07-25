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
import propsSheetUrl from "@/assets/game/props-sheet.png";
import bgForestUrl from "@/assets/game/bg-forest.png";
import bgRiverUrl from "@/assets/game/bg-river.png";
import bgTownUrl from "@/assets/game/bg-town.png";
import bgMountainUrl from "@/assets/game/bg-mountain.png";
import bgClinicUrl from "@/assets/game/bg-clinic.png";

export type GameFlags = Record<ImprovementKey, boolean>;

export type WinResult = {
  durationMs: number;
  docs: number;
  lives: number;
  mode: "before" | "after";
  farthestZone: number; // 0..4
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

const BIOME_W = 1200;
const ZONES = [
  { key: "forest", label: "Finding the Trail", phase: "Step 1 · Learn you may qualify", bg: "bg-forest", ground: [80, 130, 60] as [number, number, number], soil: [70, 45, 25] as [number, number, number] },
  { key: "river", label: "Crossing the River", phase: "Step 2 · Start your application", bg: "bg-river", ground: [180, 160, 110] as [number, number, number], soil: [120, 90, 50] as [number, number, number] },
  { key: "town", label: "At the County Office", phase: "Step 3 · Submit your documents", bg: "bg-town", ground: [140, 140, 150] as [number, number, number], soil: [80, 80, 90] as [number, number, number] },
  { key: "mountain", label: "Application Mountain", phase: "Step 4 · Wait for review", bg: "bg-mountain", ground: [130, 120, 110] as [number, number, number], soil: [70, 60, 55] as [number, number, number] },
  { key: "clinic", label: "Health Coverage", phase: "Step 5 · Enroll in coverage", bg: "bg-clinic", ground: [220, 220, 225] as [number, number, number], soil: [140, 145, 155] as [number, number, number] },
] as const;

const GROUND_Y = 470;
const LEVEL_END = ZONES.length * BIOME_W;
const MOVE_SPEED = 240;
const JUMP_VEL = 680;
const COYOTE_S = 0.09;
const JUMP_BUFFER_S = 0.12;
const INVULN_S = 0.6;
const PLATFORM_SNAP_TOLERANCE = 22;
const PLATFORM_EDGE_TOLERANCE = 16;

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
  "hero-idle": 68,
  "hero-walk-0": 68,
  "hero-walk-1": 68,
  "hero-walk-2": 68,
  "hero-walk-3": 68,
  "hero-jump": 68,
  signpost: 68,
  ranger: 64,
  map: 44,
  campfire: 48,
  backpack: 40,
  bridge: 26,
  id: 34,
  paystub: 34,
  envelope: 34,
  boulder: 34,
  "form-monster": 60,
  denied: 44,
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
};
type SpriteSize = { w: number; h: number };
type SpriteSizes = Record<string, SpriteSize>;

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
  }
  return sizes;
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

  const [heroSizes, propSizes] = await Promise.all([
    loadTrimmedSheet(k, {
      url: charSheetUrl,
      cols: 3,
      rows: 2,
      frames: heroFrames,
      // All hero frames share size so the character never jitters horizontally
      // and its feet always meet the ground exactly.
      groups: [heroFrames.map((f) => f.name)],
    }),
    loadTrimmedSheet(k, {
      url: propsSheetUrl,
      cols: 4,
      rows: 3,
      frames: propFrames,
    }),
  ]);

  // Backgrounds don't need trimming.
  await Promise.all([
    k.loadSprite("bg-forest", bgForestUrl),
    k.loadSprite("bg-river", bgRiverUrl),
    k.loadSprite("bg-town", bgTownUrl),
    k.loadSprite("bg-mountain", bgMountainUrl),
    k.loadSprite("bg-clinic", bgClinicUrl),
  ]);

  return { ...heroSizes, ...propSizes };
}

// ============================ Spawn helpers ============================

/** Compute the display width for a sprite given its trimmed size and the
 *  target display height for that sprite name. */
function displaySize(name: string, sizes: SpriteSizes): { w: number; h: number } {
  const s = sizes[name];
  if (!s) throw new Error(`unknown sprite ${name}`);
  const h = DISPLAY_H[name] ?? s.h;
  const w = Math.round(s.w * (h / s.h));
  return { w, h };
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
    k.pos(Math.round(opts.x), Math.round(gy)),
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
  return k.add(comps as never);
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
    k.pos(Math.round(opts.x), Math.round(opts.y)),
    k.anchor("center"),
    k.z(opts.z ?? LAYERS.PROP),
    k.area({ shape: new k.Rect(k.vec2(-r, -r), r * 2, r * 2) }),
  ];
  if (opts.tag) comps.push(opts.tag);
  if (opts.props) comps.push(opts.props);
  return k.add(comps as never);
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
    k.pos(Math.round(opts.x), Math.round(gy)),
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
    width: 960,
    height: 540,
    background: [20, 20, 30],
    letterbox: true,
    global: false,
    debug: false,
    pixelDensity: Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1),
    crisp: true,
    touchToMouse: true,
  });

  k.setGravity(1800);

  const sizes = await loadAllSprites(k);

  k.scene("trail", (spawnX: number = 40, lives: number = 1) => {
    const startTime = k.time();

    // ---- Backgrounds ----
    ZONES.forEach((z, i) => {
      k.add([
        k.sprite(z.bg, { width: BIOME_W, height: 540 }),
        k.pos(i * BIOME_W, 0),
        k.z(LAYERS.BG_FAR),
      ]);
    });

    // ---- Ground ----
    addGround(k, 0, BIOME_W, GROUND_Y, ZONES[0].ground, ZONES[0].soil);
    addGround(k, BIOME_W, BIOME_W + 300, GROUND_Y, ZONES[1].ground, ZONES[1].soil);
    addGround(k, BIOME_W + 900, BIOME_W * 2, GROUND_Y, ZONES[1].ground, ZONES[1].soil);
    addGround(k, BIOME_W * 2, BIOME_W * 3, GROUND_Y, ZONES[2].ground, ZONES[2].soil);
    addGround(k, BIOME_W * 3, BIOME_W * 3 + 200, GROUND_Y, ZONES[3].ground, ZONES[3].soil);
    addGround(k, BIOME_W * 4 - 100, BIOME_W * 4, GROUND_Y, ZONES[3].ground, ZONES[3].soil);
    addGround(k, BIOME_W * 4, LEVEL_END, GROUND_Y, ZONES[4].ground, ZONES[4].soil);

    // Invisible walls
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

    // Water kill-plane
    const RIVER_GAP_X0 = BIOME_W + 300;
    const RIVER_GAP_X1 = BIOME_W + 900;
    k.add([
      k.rect(RIVER_GAP_X1 - RIVER_GAP_X0, 40),
      k.pos(RIVER_GAP_X0, GROUND_Y + 40),
      k.area(),
      k.opacity(0),
      "water",
    ]);

    // ================= ZONE 1: Forest signs =================
    const signs: [number, string, string][] = [
      [180, "?", "Coverage \u2192"],
      [420, "??", "River ahead\nBring docs"],
      [700, "?", "Town office \u2192"],
      [960, "??", "Watch for gaps"],
    ];
    for (const [x, bad, good] of signs) {
      spawnDecor(k, "signpost", sizes, { x, z: LAYERS.PROP });
      const label = active.clearer_directions ? good : (active.translated_signs ? `${bad}\n(??)` : bad);
      addSpeech(k, x, GROUND_Y - DISPLAY_H["signpost"] - 10, label, active.clearer_directions ? [40, 100, 40] : [140, 40, 40]);
    }

    // ================= ZONE 2: River =================
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
      for (let i = 0; i < 6; i++) {
        spawnDecor(k, "bridge", sizes, {
          x: rx0 + i * 100 + 50,
          groundY: GROUND_Y - 6 + bridgeH, // sprite sits atop plank
          z: LAYERS.PLATFORM - 1,
        });
      }
      addSpeech(k, (rx0 + rx1) / 2, GROUND_Y - 90, "★ Clear instructions", [30, 100, 60]);
    } else {
      const platforms = [
        { x: rx0 + 60, y: GROUND_Y - 40, amp: 30, spd: 2.2 },
        { x: rx0 + 200, y: GROUND_Y - 80, amp: 50, spd: 1.6 },
        { x: rx0 + 340, y: GROUND_Y - 40, amp: 40, spd: 2.5 },
        { x: rx0 + 480, y: GROUND_Y - 90, amp: 60, spd: 1.9 },
      ];
      for (const p of platforms) {
        const plat = k.add([
          k.rect(48, 12),
          k.pos(p.x, p.y),
          k.color(120, 130, 140),
          k.outline(2, k.rgb(60, 70, 80)),
          k.area(),
          k.body({ isStatic: true }),
          k.z(LAYERS.PLATFORM),
          "platform",
          {
            basY: p.y,
            amp: p.amp,
            spd: p.spd,
            phase: Math.random() * Math.PI * 2,
            platformSpeed: k.vec2(0, 0),
            lastPos: k.vec2(p.x, p.y),
          },
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

    // ================= ZONE 3: Town =================
    const tx0 = BIOME_W * 2;
    const docs: [number, "id" | "paystub" | "envelope", string][] = [
      [tx0 + 180, "id", "ID"],
      [tx0 + 380, "paystub", "Income"],
      [tx0 + 580, "envelope", "Household"],
    ];
    for (const [x, prop, key] of docs) {
      const dh = DISPLAY_H[prop];
      spawnGrounded(k, prop, sizes, {
        x,
        z: LAYERS.PROP,
        tag: "doc",
        props: { docKey: key },
        hitboxScale: { x: -dh / 2, w: dh, h: dh },
      });
    }

    // Form-monster enemies (patrol) — walk on the ground.
    const monsterSpots = [tx0 + 300, tx0 + 500, tx0 + 750];
    for (const mx of monsterSpots) {
      const speed = active.plain_language ? 40 : 110;
      const mh = DISPLAY_H["form-monster"];
      const mw = displaySize("form-monster", sizes).w;
      const m = spawnGrounded(k, "form-monster", sizes, {
        x: mx,
        z: LAYERS.ACTOR,
        tag: "monster",
        props: { dir: 1, home: mx, range: 80 },
        hitboxScale: { x: -mw / 2, w: mw, h: mh },
      });
      m.onUpdate(() => {
        m.pos.x += m.dir * speed * k.dt();
        m.pos.y = GROUND_Y; // stay planted
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

    // Locked coverage gate
    const gateX = tx0 + BIOME_W - 60;
    k.add([
      k.rect(20, 100),
      k.pos(gateX, GROUND_Y),
      k.anchor("bot"),
      k.color(180, 40, 40),
      k.outline(2, k.rgb(90, 20, 20)),
      k.area(),
      k.body({ isStatic: true }),
      k.z(LAYERS.PROP),
      "gate",
    ]);
    spawnDecor(k, "denied", sizes, {
      x: gateX + 10,
      groundY: GROUND_Y - 100,
      z: LAYERS.PROP + 1,
    });
    // Track for later removal
    k.get("gate"); // no-op; kept to reflect naming
    addSpeech(k, gateX + 10, GROUND_Y - 180, "COUNTY OFFICE\nDocs required", [140, 40, 40]);

    // ================= ZONE 4: Mountain =================
    const mx0 = BIOME_W * 3;
    if (active.clearer_directions) {
      const steps = 10;
      for (let i = 0; i < steps; i++) {
        const px = mx0 + 220 + i * 80;
        const py = GROUND_Y - 40 - i * 32;
        k.add([
          k.rect(70, 12),
          k.pos(px, py),
          k.color(120, 100, 90),
          k.area(),
          k.body({ isStatic: true }),
          k.outline(2, k.rgb(60, 50, 40)),
          k.z(LAYERS.PLATFORM),
          "platform",
          { platformSpeed: k.vec2(0, 0), lastPos: k.vec2(px, py) },
        ]);
        k.add([
          k.rect(3, 18),
          k.pos(px + 35, py - 18),
          k.color(220, 90, 40),
          k.z(LAYERS.PROP),
        ]);
      }
      for (let i = 0; i < 4; i++) {
        const px = mx0 + 220 + 10 * 80 + i * 80;
        const py = GROUND_Y - 40 - (10 - i - 1) * 32;
        k.add([
          k.rect(70, 12),
          k.pos(px, py),
          k.color(120, 100, 90),
          k.area(),
          k.body({ isStatic: true }),
          k.outline(2, k.rgb(60, 50, 40)),
          k.z(LAYERS.PLATFORM),
          "platform",
          { platformSpeed: k.vec2(0, 0), lastPos: k.vec2(px, py) },
        ]);
      }
    } else {
      const spots: [number, number][] = [
        [mx0 + 260, GROUND_Y - 90],
        [mx0 + 400, GROUND_Y - 160],
        [mx0 + 540, GROUND_Y - 220],
        [mx0 + 680, GROUND_Y - 260],
        [mx0 + 820, GROUND_Y - 220],
        [mx0 + 960, GROUND_Y - 160],
        [mx0 + 1080, GROUND_Y - 90],
      ];
      for (const [px, py] of spots) {
        k.add([
          k.rect(46, 8),
          k.pos(px, py),
          k.color(70, 65, 80),
          k.area(),
          k.body({ isStatic: true }),
          k.opacity(0.75),
          k.z(LAYERS.PLATFORM),
          "platform",
          { platformSpeed: k.vec2(0, 0), lastPos: k.vec2(px, py) },
        ]);
      }
      for (let i = 0; i < 3; i++) {
        const bx = mx0 + 300 + i * 240;
        const b = spawnAirborne(k, "boulder", sizes, {
          x: bx,
          y: -40 - i * 200,
          z: LAYERS.ACTOR,
          tag: "boulder",
          props: { spd: 260 + i * 40, home: bx },
        });
        b.onUpdate(() => {
          b.pos.y += b.spd * k.dt();
          if (b.pos.y > 700) b.pos = k.vec2(b.home, -100);
        });
      }
    }

    // ================= ZONE 5: Clinic — finish =================
    const cx = BIOME_W * 4 + 700;
    k.add([
      k.rect(80, 140),
      k.pos(cx, GROUND_Y),
      k.anchor("bot"),
      k.color(255, 255, 255),
      k.outline(3, k.rgb(60, 60, 60)),
      k.z(LAYERS.PROP),
    ]);
    k.add([
      k.rect(60, 12),
      k.pos(cx + 40, GROUND_Y - 78),
      k.anchor("center"),
      k.color(220, 40, 60),
      k.z(LAYERS.PROP + 1),
    ]);
    k.add([
      k.rect(12, 60),
      k.pos(cx + 40, GROUND_Y - 78),
      k.anchor("center"),
      k.color(220, 40, 60),
      k.z(LAYERS.PROP + 1),
    ]);
    k.add([
      k.rect(90, 140),
      k.pos(cx - 5, GROUND_Y),
      k.anchor("bot"),
      k.area(),
      k.opacity(0),
      "finish",
    ]);

    // Save-point campfire
    const checkpointX = spawnX > 1000 ? spawnX : 40;
    if (active.save_progress) {
      const fx = BIOME_W * 2 + 40;
      const ch = DISPLAY_H["campfire"];
      spawnGrounded(k, "campfire", sizes, {
        x: fx,
        z: LAYERS.PROP,
        tag: "checkpoint",
        props: { atX: fx },
        hitboxScale: { x: -ch / 2, w: ch, h: ch },
      });
      addSpeech(k, fx, GROUND_Y - ch - 12, "★ Save point", [200, 100, 40]);
    }

    // Documents-earlier backpack
    if (active.documents_earlier) {
      spawnDecor(k, "backpack", sizes, { x: 80, z: LAYERS.PROP });
      addSpeech(k, 100, GROUND_Y - DISPLAY_H["backpack"] - 12, "Bring: ID, Income, Household", [40, 60, 100]);
    }

    // ================= Player =================
    const player = k.add([
      k.sprite("hero-idle", { width: displaySize("hero-idle", sizes).w, height: DISPLAY_H["hero-idle"] }),
      k.pos(spawnX, GROUND_Y),
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
        lives: (active.phone_support ? 2 : 1) + (lives - 1),
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
      k.pos(12, 34),
      k.color(opts.mode === "after" ? k.rgb(30, 160, 60) : k.rgb(220, 60, 60)),
      k.fixed(),
      k.z(LAYERS.HUD),
    ]);
    const livesHud = k.add([
      k.text("", { size: 14, font: "sans-serif" }),
      k.pos(12, 54),
      k.color(255, 255, 255),
      k.fixed(),
      k.z(LAYERS.HUD),
    ]);
    const docsHud = k.add([
      k.text("", { size: 14, font: "sans-serif" }),
      k.pos(k.width() - 12, 34),
      k.anchor("topright"),
      k.color(255, 255, 255),
      k.fixed(),
      k.z(LAYERS.HUD),
    ]);
    function updateHud() {
      livesHud.text = `♥ ${player.lives}`;
      const need = ["ID", "Income", "Household"].filter((d) => !player.docs.has(d));
      docsHud.text = active.documents_earlier || player.docs.size > 0
        ? need.length ? `Application docs needed: ${need.join(", ")}` : "Application docs: complete ✓"
        : "";
    }
    updateHud();

    // ================= Collisions =================
    player.onCollide("doc", (d) => {
      const doc = d as unknown as { docKey: string; destroy: () => void };
      player.docs.add(doc.docKey);
      player.score += 750;
      doc.destroy();
      updateHud();
    });

    player.onCollide("checkpoint", (c) => {
      const ch = c as unknown as { atX: number };
      player.checkpointX = ch.atX;
    });

    player.onCollide("gate", () => {
      if (player.docs.size >= 3) {
        k.get("gate").forEach((g) => (g as { destroy: () => void }).destroy());
      }
    });

    player.onCollide("monster", () => loseLife("A form-monster stopped you."));
    player.onCollide("boulder", () => loseLife("A falling boulder hit you."));
    player.onCollide("water", () => loseLife("Fell in the river."));

    function loseLife(reason: string) {
      if (player.dead || player.won) return;
      if (k.time() < player.invulnUntil) return;
      player.invulnUntil = k.time() + INVULN_S;
      player.lives -= 1;
      player.deaths += 1;
      player.score = Math.max(0, player.score - 500);
      if (player.lives <= 0) {
        player.dead = true;
        showEnd(false, reason);
        return;
      }
      const rx = active.save_progress ? player.checkpointX : 40;
      player.pos = k.vec2(rx, GROUND_Y);
      player.vel = k.vec2(0, 0);
      player.riding = null;
      if (!active.documents_earlier && rx < BIOME_W * 2) {
        player.docs.clear();
      }
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

    player.onCollide("finish", () => {
      if (player.won || player.dead) return;
      if (player.docs.size < 3) return;
      player.won = true;
      opts.onWin?.(buildResult(true));
      showTitleCard(k, "STEP 5 · ENROLLED", "★ COVERED ★", [255, 220, 90], 2.4);
      showEnd(true);
    });

    function showEnd(win: boolean, reason?: string) {
      const overlay = k.add([
        k.rect(k.width(), k.height()),
        k.pos(0, 0),
        k.color(0, 0, 0),
        k.opacity(0.7),
        k.area(),
        k.fixed(),
        k.z(LAYERS.OVERLAY),
      ]);
      overlay.onClick(() => k.go("trail", 40, 1));
      k.add([
        k.text(win ? "★ ENROLLED IN COVERAGE ★" : "APPLICATION BLOCKED", { size: 34, font: "sans-serif" }),
        k.pos(k.width() / 2, k.height() / 2 - 70),
        k.anchor("center"),
        k.color(win ? k.rgb(255, 220, 90) : k.rgb(255, 120, 120)),
        k.fixed(),
        k.z(LAYERS.OVERLAY_TEXT),
      ]);
      k.add([
        k.text(
          win
            ? "You navigated every step and enrolled in Medicaid coverage."
            : `${reason ?? "The barriers were too many."}\nVote on a UX improvement to make the next attempt easier.`,
          { size: 16, font: "sans-serif", width: 720, align: "center" },
        ),
        k.pos(k.width() / 2, k.height() / 2),
        k.anchor("center"),
        k.color(240, 240, 240),
        k.fixed(),
        k.z(LAYERS.OVERLAY_TEXT),
      ]);
      k.add([
        k.text("Tap screen or press R to try again", { size: 14, font: "sans-serif" }),
        k.pos(k.width() / 2, k.height() / 2 + 90),
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
        // advance walk frame ~10fps
        player.animTick += k.dt();
        if (player.animTick > 0.1) {
          player.animTick = 0;
          player.walkFrame = (player.walkFrame + 1) % 4;
          setSprite(`hero-walk-${player.walkFrame}`);
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

      // Camera follow with integer pixel snap
      const camX = Math.max(k.width() / 2, Math.min(player.pos.x, LEVEL_END - k.width() / 2));
      k.setCamPos(Math.round(camX), Math.round(k.height() / 2));
    });

    for (const key of jumpKeys) k.onKeyPress(key as never, () => tryJump());
    k.onKeyPress("r", () => k.go("trail", 40, 1));

    player.onUpdate(() => {
      if (player.pos.y > 720) loseLife("Fell off the trail.");
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
  const w = Math.round(x2 - x1);
  const x = Math.round(x1);
  const yy = Math.round(y);
  k.add([
    k.rect(w, 80),
    k.pos(x, yy),
    k.color(...soilColor),
    k.area(),
    k.body({ isStatic: true }),
    k.z(LAYERS.GROUND),
  ]);
  k.add([
    k.rect(w, 8),
    k.pos(x, yy),
    k.color(...topColor),
    k.z(LAYERS.GROUND_TOP),
  ]);
  k.add([
    k.rect(w, 2),
    k.pos(x, yy),
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
