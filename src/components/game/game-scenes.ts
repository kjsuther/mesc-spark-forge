// Kaplay game logic. Imported dynamically from the client so the "kaplay"
// module (which touches window at import time) never reaches the server bundle.
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
};

export type StartGameOpts = {
  canvas: HTMLCanvasElement;
  flags: GameFlags;
  mode: "before" | "after";
  onWin?: (result: WinResult) => void;
  onLose?: () => void;
};

type Ctx = KAPLAYCtx;

// 5 biomes, each 1200px wide -> total level ~6000
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
const PLAYER_W = 44;
const PLAYER_H = 64;

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
    pixelDensity: 1,
    crisp: true,
    touchToMouse: true,
  });

  k.setGravity(1800);

  // ---- Load sprites ----
  k.loadSprite("hero", charSheetUrl, {
    sliceX: 3,
    sliceY: 2,
    anims: {
      idle: 0,
      walk: { from: 1, to: 4, loop: true, speed: 10 },
      jump: 5,
    },
  });
  k.loadSprite("props", propsSheetUrl, { sliceX: 4, sliceY: 3 });
  k.loadSprite("bg-forest", bgForestUrl);
  k.loadSprite("bg-river", bgRiverUrl);
  k.loadSprite("bg-town", bgTownUrl);
  k.loadSprite("bg-mountain", bgMountainUrl);
  k.loadSprite("bg-clinic", bgClinicUrl);

  const PROP = {
    signpost: 0,
    ranger: 1,
    map: 2,
    campfire: 3,
    backpack: 4,
    bridge: 5,
    id: 6,
    paystub: 7,
    envelope: 8,
    boulder: 9,
    formMonster: 10,
    denied: 11,
  } as const;

  k.scene("trail", (spawnX: number = 40, lives: number = 1) => {
    const startTime = k.time();

    // ---- Backgrounds (one per biome) ----
    ZONES.forEach((z, i) => {
      k.add([
        k.sprite(z.bg, { width: BIOME_W, height: 540 }),
        k.pos(i * BIOME_W, 0),
        k.z(-30),
      ]);
    });

    // ---- Ground blocks per biome, with intentional gaps ----
    addGround(k, 0, BIOME_W, GROUND_Y, ZONES[0].ground, ZONES[0].soil);
    addGround(k, BIOME_W, BIOME_W + 300, GROUND_Y, ZONES[1].ground, ZONES[1].soil);
    addGround(k, BIOME_W + 900, BIOME_W * 2, GROUND_Y, ZONES[1].ground, ZONES[1].soil);
    addGround(k, BIOME_W * 2, BIOME_W * 3, GROUND_Y, ZONES[2].ground, ZONES[2].soil);
    addGround(k, BIOME_W * 3, BIOME_W * 3 + 200, GROUND_Y, ZONES[3].ground, ZONES[3].soil);
    addGround(k, BIOME_W * 4 - 100, BIOME_W * 4, GROUND_Y, ZONES[3].ground, ZONES[3].soil);
    addGround(k, BIOME_W * 4, LEVEL_END, GROUND_Y, ZONES[4].ground, ZONES[4].soil);

    // Invisible walls at level bounds
    k.add([
      k.rect(20, 800),
      k.pos(-20, 0),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
    ]);
    k.add([
      k.rect(20, 800),
      k.pos(LEVEL_END, 0),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
    ]);

    // Kill-plane ONLY under river gap (so falling in triggers water immediately)
    const RIVER_GAP_X0 = BIOME_W + 300;
    const RIVER_GAP_X1 = BIOME_W + 900;
    k.add([
      k.rect(RIVER_GAP_X1 - RIVER_GAP_X0, 40),
      k.pos(RIVER_GAP_X0, GROUND_Y + 40),
      k.area(),
      k.opacity(0),
      "water",
    ]);

    // ================= ZONE 1: Forest =================
    const signs: [number, string, string][] = [
      [180, "?", "Coverage \u2192"],
      [420, "??", "River ahead\nBring docs"],
      [700, "?", "Town office \u2192"],
      [960, "??", "Watch for gaps"],
    ];
    for (const [x, bad, good] of signs) {
      k.add([
        k.sprite("props", { frame: PROP.signpost, width: 56, height: 56 }),
        k.pos(x, GROUND_Y),
        k.anchor("bot"),
        k.z(2),
      ]);
      const label = active.clearer_directions ? good : (active.translated_signs ? `${bad}\n(??)` : bad);
      addSpeech(k, x, GROUND_Y - 78, label, active.clearer_directions ? [40, 100, 40] : [140, 40, 40]);
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
        "platform",
        { platformSpeed: k.vec2(0, 0), lastPos: k.vec2(rx0, GROUND_Y - 6) },
      ]);
      for (let i = 0; i < 6; i++) {
        k.add([
          k.sprite("props", { frame: PROP.bridge, width: 100, height: 40 }),
          k.pos(rx0 + i * 100, GROUND_Y - 6),
          k.anchor("bot"),
          k.z(1),
        ]);
      }
      addSpeech(k, (rx0 + rx1) / 2, GROUND_Y - 90, "★ Clear instructions", [30, 100, 60]);
    } else {
      // Tiny moving stone platforms — brutal timing
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
    const docs: [number, keyof typeof PROP, string][] = [
      [tx0 + 180, "id", "ID"],
      [tx0 + 380, "paystub", "Income"],
      [tx0 + 580, "envelope", "Household"],
    ];
    for (const [x, prop, key] of docs) {
      k.add([
        k.sprite("props", { frame: PROP[prop], width: 40, height: 40 }),
        k.pos(x, GROUND_Y - 4),
        k.anchor("bot"),
        k.area({ shape: new k.Rect(k.vec2(-16, -36), 32, 36) }),
        k.z(3),
        "doc",
        { docKey: key },
      ]);
    }

    // Form-monster enemies (patrol)
    const monsterSpots = [tx0 + 300, tx0 + 500, tx0 + 750];
    for (const mx of monsterSpots) {
      const speed = active.plain_language ? 40 : 110;
      const m = k.add([
        k.sprite("props", { frame: PROP.formMonster, width: 48, height: 48 }),
        k.pos(mx, GROUND_Y),
        k.anchor("bot"),
        // Hitbox trimmed inward to match the visible body, sitting on ground
        k.area({ shape: new k.Rect(k.vec2(-18, -42), 36, 40) }),
        k.z(3),
        "monster",
        { dir: 1, home: mx, range: 80 },
      ]);
      m.onUpdate(() => {
        m.pos.x += m.dir * speed * k.dt();
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

    // Locked coverage gate at end of town
    const gateX = tx0 + BIOME_W - 60;
    k.add([
      k.rect(20, 100),
      k.pos(gateX, GROUND_Y),
      k.anchor("bot"),
      k.color(180, 40, 40),
      k.outline(2, k.rgb(90, 20, 20)),
      k.area(),
      k.body({ isStatic: true }),
      "gate",
    ]);
    k.add([
      k.sprite("props", { frame: PROP.denied, width: 60, height: 60 }),
      k.pos(gateX + 10, GROUND_Y - 100),
      k.anchor("bot"),
      k.z(4),
      "gateStamp",
    ]);
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
          "platform",
          { platformSpeed: k.vec2(0, 0), lastPos: k.vec2(px, py) },
        ]);
        k.add([
          k.rect(3, 18),
          k.pos(px + 35, py - 18),
          k.color(220, 90, 40),
          k.z(2),
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
          "platform",
          { platformSpeed: k.vec2(0, 0), lastPos: k.vec2(px, py) },
        ]);
      }
      for (let i = 0; i < 3; i++) {
        const bx = mx0 + 300 + i * 240;
        const b = k.add([
          k.sprite("props", { frame: PROP.boulder, width: 40, height: 40 }),
          k.pos(bx, -40 - i * 200),
          k.anchor("center"),
          k.area({ shape: new k.Rect(k.vec2(-16, -16), 32, 32) }),
          k.z(4),
          "boulder",
          { spd: 260 + i * 40, home: bx },
        ]);
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
      k.z(2),
    ]);
    k.add([
      k.rect(60, 12),
      k.pos(cx + 40, GROUND_Y - 78),
      k.anchor("center"),
      k.color(220, 40, 60),
      k.z(3),
    ]);
    k.add([
      k.rect(12, 60),
      k.pos(cx + 40, GROUND_Y - 78),
      k.anchor("center"),
      k.color(220, 40, 60),
      k.z(3),
    ]);
    k.add([
      k.rect(90, 140),
      k.pos(cx - 5, GROUND_Y),
      k.anchor("bot"),
      k.area(),
      k.opacity(0),
      "finish",
    ]);

    // ================= Save-point campfire =================
    const checkpointX = spawnX > 1000 ? spawnX : 40;
    if (active.save_progress) {
      const fx = BIOME_W * 2 + 40;
      k.add([
        k.sprite("props", { frame: PROP.campfire, width: 48, height: 48 }),
        k.pos(fx, GROUND_Y),
        k.anchor("bot"),
        k.area({ shape: new k.Rect(k.vec2(-20, -40), 40, 40) }),
        k.z(3),
        "checkpoint",
        { atX: fx },
      ]);
      addSpeech(k, fx, GROUND_Y - 78, "★ Save point", [200, 100, 40]);
    }

    // ================= Documents-earlier HUD backpack =================
    if (active.documents_earlier) {
      k.add([
        k.sprite("props", { frame: PROP.backpack, width: 40, height: 40 }),
        k.pos(80, GROUND_Y),
        k.anchor("bot"),
        k.z(4),
      ]);
      addSpeech(k, 100, GROUND_Y - 78, "Bring: ID, Income, Household", [40, 60, 100]);
    }

    // ================= Player =================
    const player = k.add([
      k.sprite("hero", { anim: "idle", width: PLAYER_W, height: PLAYER_H }),
      k.pos(spawnX, GROUND_Y),
      // With anchor("bot"), sprite spans x=[-22,22], y=[-64,0]. Center collision box on that.
      k.area({ shape: new k.Rect(k.vec2(-12, -58), 24, 58) }),
      k.body(),
      k.anchor("bot"),
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
        riding: null as null | { pos: { x: number; y: number }; platformSpeed: { x: number; y: number }; width: number; height: number },
      },
    ]);

    // Track platform ride: when player lands on a platform, remember it
    player.onCollide("platform", (p, col) => {
      // Only consider it a "ride" if we hit the top surface
      if (col?.isBottom()) {
        const plat = p as unknown as {
          pos: { x: number; y: number };
          platformSpeed: { x: number; y: number };
          width: number;
          height: number;
        };
        player.riding = plat;
      }
    });

    // ================= Ranger helper =================
    if (active.helper) {
      const ranger = k.add([
        k.sprite("props", { frame: PROP.ranger, width: 44, height: 60 }),
        k.pos(spawnX + 60, GROUND_Y),
        k.anchor("bot"),
        k.z(4),
      ]);
      const bubble = k.add([
        k.text("Follow me!", { size: 12, font: "sans-serif" }),
        k.pos(0, 0),
        k.color(30, 30, 30),
        k.z(20),
        k.anchor("center"),
      ]);
      ranger.onUpdate(() => {
        const target = Math.min(player.pos.x + 90, LEVEL_END - 100);
        const dx = target - ranger.pos.x;
        ranger.pos.x += Math.sign(dx) * Math.min(Math.abs(dx), 3);
        ranger.pos.y = GROUND_Y;
        bubble.pos = k.vec2(ranger.pos.x, ranger.pos.y - 74);
      });
    }

    // ================= HUD =================
    k.add([
      k.text(opts.mode === "after" ? "AFTER FEEDBACK" : "BEFORE FEEDBACK", {
        size: 14,
        font: "sans-serif",
      }),
      k.pos(12, 34),
      k.color(opts.mode === "after" ? k.rgb(30, 160, 60) : k.rgb(220, 60, 60)),
      k.fixed(),
      k.z(100),
    ]);

    const livesHud = k.add([
      k.text("", { size: 14, font: "sans-serif" }),
      k.pos(12, 54),
      k.color(255, 255, 255),
      k.fixed(),
      k.z(100),
    ]);
    const docsHud = k.add([
      k.text("", { size: 14, font: "sans-serif" }),
      k.pos(k.width() - 12, 34),
      k.anchor("topright"),
      k.color(255, 255, 255),
      k.fixed(),
      k.z(100),
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
        k.get("gateStamp").forEach((g) => (g as { destroy: () => void }).destroy());
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

    player.onCollide("finish", () => {
      if (player.won || player.dead) return;
      if (player.docs.size < 3) return;
      player.won = true;
      opts.onWin?.({
        durationMs: Math.round((k.time() - startTime) * 1000),
        docs: player.docs.size,
        lives: player.lives,
        mode: opts.mode,
      });
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
        k.z(200),
      ]);
      overlay.onClick(() => {
        k.go("trail", 40, 1);
      });
      k.add([
        k.text(win ? "★ ENROLLED IN COVERAGE ★" : "APPLICATION BLOCKED", { size: 34, font: "sans-serif" }),
        k.pos(k.width() / 2, k.height() / 2 - 70),
        k.anchor("center"),
        k.color(win ? k.rgb(255, 220, 90) : k.rgb(255, 120, 120)),
        k.fixed(),
        k.z(201),
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
        k.z(201),
      ]);
      k.add([
        k.text("Tap screen or press R to try again", { size: 14, font: "sans-serif" }),
        k.pos(k.width() / 2, k.height() / 2 + 90),
        k.anchor("center"),
        k.color(220, 220, 220),
        k.fixed(),
        k.z(201),
      ]);
      if (!win) opts.onLose?.();
    }

    // ================= Controls =================
    const leftKeys = ["left", "a"];
    const rightKeys = ["right", "d"];
    const jumpKeys = ["space", "up", "w"];

    type TouchInput = { left: boolean; right: boolean; jumpReq: boolean; resetReq: boolean };
    const w = typeof window !== "undefined" ? (window as unknown as { __gameInput?: TouchInput }) : undefined;

    let currentZone = Math.min(ZONES.length - 1, Math.max(0, Math.floor(spawnX / BIOME_W)));
    showTitleCard(
      k,
      ZONES[currentZone].phase.toUpperCase(),
      ZONES[currentZone].label.toUpperCase(),
      [255, 220, 90],
      1.8,
    );

    function tryJump() {
      if (player.dead || player.won) return;
      const now = k.time();
      const canCoyote = now - player.lastGroundedAt < COYOTE_S;
      if (player.isGrounded() || canCoyote) {
        player.jump(JUMP_VEL);
        player.jumpBufferedAt = -1;
        // If we jumped off a moving platform, transfer its horizontal speed once
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

      // Zone transition title cards
      const z = Math.min(ZONES.length - 1, Math.max(0, Math.floor(player.pos.x / BIOME_W)));
      if (z !== currentZone) {
        currentZone = z;
        showTitleCard(
          k,
          ZONES[z].phase.toUpperCase(),
          ZONES[z].label.toUpperCase(),
          [255, 220, 90],
          1.4,
        );
      }

      // Ground tracking for coyote time
      if (player.isGrounded()) {
        player.lastGroundedAt = now;
      }

      // Verify player is still on the tracked platform; drop ride otherwise.
      if (player.riding) {
        const halfW = player.riding.width / 2;
        const platCenterX = player.riding.pos.x + halfW;
        const withinX = Math.abs(player.pos.x - platCenterX) < halfW + 12;
        const platTop = player.riding.pos.y;
        const feetY = player.pos.y;
        const nearTop = Math.abs(feetY - platTop) < 6;
        if (!withinX || !nearTop || !player.isGrounded()) {
          player.riding = null;
        }
      }

      // Horizontal input
      let dir = 0;
      for (const key of leftKeys) if (k.isKeyDown(key as never)) dir -= 1;
      for (const key of rightKeys) if (k.isKeyDown(key as never)) dir += 1;
      if (w?.__gameInput?.left) dir -= 1;
      if (w?.__gameInput?.right) dir += 1;
      dir = Math.sign(dir);
      player.move(dir * MOVE_SPEED, 0);

      // Moving-platform carry: apply platform horizontal velocity while riding
      if (player.riding) {
        const dt = k.dt();
        player.pos.x += player.riding.platformSpeed.x * dt;
        // Snap feet to platform top so we don't drift up/down between frames
        player.pos.y = player.riding.pos.y;
      }

      if (dir !== 0) {
        player.facing = dir as 1 | -1;
        player.flipX = dir < 0;
        if (player.isGrounded() && player.getCurAnim()?.name !== "walk") player.play("walk");
      } else if (player.isGrounded() && player.getCurAnim()?.name !== "idle") {
        player.play("idle");
      }
      if (!player.isGrounded() && player.getCurAnim()?.name !== "jump") player.play("jump");

      // Touch jump edge (buffered)
      if (w?.__gameInput?.jumpReq) {
        w.__gameInput.jumpReq = false;
        tryJump();
      }

      // Consume buffered jump if we just landed
      if (player.jumpBufferedAt > 0 && player.isGrounded() && now - player.jumpBufferedAt < JUMP_BUFFER_S) {
        player.jump(JUMP_VEL);
        player.jumpBufferedAt = -1;
      }

      // Camera follow — recompute width() every frame for fullscreen changes
      const camX = Math.max(k.width() / 2, Math.min(player.pos.x, LEVEL_END - k.width() / 2));
      k.setCamPos(camX, k.height() / 2);
    });

    for (const key of jumpKeys) {
      k.onKeyPress(key as never, () => tryJump());
    }

    k.onKeyPress("r", () => {
      k.go("trail", 40, 1);
    });

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

function addGround(
  k: Ctx,
  x1: number,
  x2: number,
  y: number,
  topColor: [number, number, number] = [80, 130, 60],
  soilColor: [number, number, number] = [70, 45, 25],
) {
  k.add([
    k.rect(x2 - x1, 80),
    k.pos(x1, y),
    k.color(...soilColor),
    k.area(),
    k.body({ isStatic: true }),
    k.z(-3),
  ]);
  k.add([
    k.rect(x2 - x1, 8),
    k.pos(x1, y),
    k.color(...topColor),
    k.z(-2),
  ]);
  k.add([
    k.rect(x2 - x1, 2),
    k.pos(x1, y),
    k.color(
      Math.min(255, topColor[0] + 40),
      Math.min(255, topColor[1] + 40),
      Math.min(255, topColor[2] + 40),
    ),
    k.z(-1),
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
    k.z(5),
  ]);
}
