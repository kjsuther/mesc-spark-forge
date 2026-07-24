// Kaplay game logic. Imported dynamically from the client so the "kaplay"
// module (which touches window at import time) never reaches the server bundle.
import type { KAPLAYCtx } from "kaplay";
import type { ImprovementKey } from "@/lib/game.functions";

export type GameFlags = Record<ImprovementKey, boolean>;

export type StartGameOpts = {
  canvas: HTMLCanvasElement;
  flags: GameFlags;
  mode: "before" | "after";
  onWin?: () => void;
};

type Ctx = KAPLAYCtx;

const COLORS = {
  sky: [235, 240, 220] as [number, number, number],
  ground: [70, 90, 55] as [number, number, number],
  dirt: [110, 80, 55] as [number, number, number],
  water: [50, 110, 165] as [number, number, number],
  mountain: [90, 100, 115] as [number, number, number],
  snow: [230, 235, 240] as [number, number, number],
  trail: [180, 68, 43] as [number, number, number],
  sign: [200, 160, 80] as [number, number, number],
  wood: [130, 90, 55] as [number, number, number],
  player: [230, 60, 60] as [number, number, number],
  playerSkin: [255, 210, 170] as [number, number, number],
  pack: [70, 130, 90] as [number, number, number],
  doc: [250, 245, 220] as [number, number, number],
  goal: [255, 255, 255] as [number, number, number],
  goalCross: [220, 40, 60] as [number, number, number],
  ranger: [80, 60, 120] as [number, number, number],
  fire: [255, 140, 40] as [number, number, number],
} as const;

export async function startGame(opts: StartGameOpts): Promise<() => void> {
  const kaplay = (await import("kaplay")).default;
  const active = opts.mode === "after" ? opts.flags : ({} as GameFlags);

  const k: Ctx = kaplay({
    canvas: opts.canvas,
    width: 960,
    height: 540,
    background: COLORS.sky,
    letterbox: true,
    global: false,
    debug: false,
    pixelDensity: 1,
    crisp: true,
    touchToMouse: true,
  });

  const GROUND_Y = 460;
  const LEVEL_END = 4400;

  k.setGravity(1600);

  // ---------- Scene builder ----------
  k.scene("trail", (spawnX: number = 40) => {
    // Sky gradient bands
    k.add([
      k.rect(LEVEL_END + 400, 260),
      k.pos(0, 0),
      k.color(200, 220, 235),
      k.fixed(),
      k.z(-30),
    ]);

    // Distant mountains
    for (let i = 0; i < 10; i++) {
      const mx = i * 500 + 100;
      k.add([
        k.polygon([
          k.vec2(0, 0),
          k.vec2(220, -180),
          k.vec2(440, 0),
        ]),
        k.pos(mx, 340),
        k.color(140, 155, 165),
        k.opacity(0.55),
        k.z(-20),
      ]);
    }

    // Pine trees decoration
    for (let i = 0; i < 40; i++) {
      const tx = 200 + i * 110 + (i % 3) * 30;
      if (tx > 1400 && tx < 2500) continue; // clear zone for river+docs
      if (tx > 3000 && tx < 3900) continue; // clear zone for mountain
      const th = 60 + (i % 3) * 20;
      k.add([
        k.polygon([k.vec2(-20, 0), k.vec2(20, 0), k.vec2(0, -th)]),
        k.pos(tx, GROUND_Y),
        k.color(50, 90, 60),
        k.z(-10),
      ]);
      k.add([
        k.rect(6, 10),
        k.pos(tx - 3, GROUND_Y - 5),
        k.color(80, 55, 30),
        k.z(-10),
      ]);
    }

    // ---------- Ground segments ----------
    // Segment 1: spawn to river
    addGround(k, 0, 1500, GROUND_Y);
    // Gap for river 1500-1900
    // Segment 2: after river to mountain base
    addGround(k, 1900, 3000, GROUND_Y);
    // Mountain slope area: 3000-3800 (built with stepped platforms)
    // Segment 3: summit plateau + finish 3800-LEVEL_END
    addGround(k, 3800, LEVEL_END, GROUND_Y);

    // ---------- Zone 1: Finding the Trail (signs) ----------
    addZoneLabel(k, 100, "Finding the Trail");
    addSign(k, 250, active.clearer_directions ? "Start\n\u2192 This way" : "?");
    addSign(k, 550, active.clearer_directions ? "River ahead\nJump on logs" : "??");
    addSign(k, 950, active.clearer_directions ? "Docs zone\nCollect 3" : "?");
    addSign(k, 1300, active.clearer_directions ? "River\ncrossing" : "??");

    // ---------- Zone 2: Crossing the River ----------
    addZoneLabel(k, 1500, "Crossing the River");
    // Water
    k.add([
      k.rect(400, 80),
      k.pos(1500, GROUND_Y),
      k.color(COLORS.water),
      k.z(-5),
    ]);
    // Water ripples
    for (let i = 0; i < 8; i++) {
      k.add([
        k.rect(20, 3),
        k.pos(1520 + i * 45, GROUND_Y + 15),
        k.color(180, 210, 235),
        k.opacity(0.7),
        k.z(-4),
      ]);
    }

    if (active.bridge) {
      // Continuous bridge
      k.add([
        k.rect(400, 12),
        k.pos(1500, GROUND_Y - 30),
        k.color(COLORS.wood),
        k.area(),
        k.body({ isStatic: true }),
        k.outline(2, k.rgb(80, 55, 30)),
      ]);
      // Bridge planks
      for (let i = 0; i < 10; i++) {
        k.add([
          k.rect(4, 12),
          k.pos(1500 + i * 40 + 20, GROUND_Y - 30),
          k.color(80, 55, 30),
          k.z(1),
        ]);
      }
      // Bridge rope rails
      k.add([
        k.rect(400, 3),
        k.pos(1500, GROUND_Y - 60),
        k.color(120, 90, 60),
      ]);
      addLabel(k, 1600, GROUND_Y - 90, "\u2605 Clear instructions", [200, 140, 40]);
    } else {
      // Two tricky floating logs
      k.add([
        k.rect(80, 14),
        k.pos(1600, GROUND_Y - 60),
        k.color(COLORS.wood),
        k.area(),
        k.body({ isStatic: true }),
        k.outline(2, k.rgb(80, 55, 30)),
      ]);
      k.add([
        k.rect(80, 14),
        k.pos(1780, GROUND_Y - 90),
        k.color(COLORS.wood),
        k.area(),
        k.body({ isStatic: true }),
        k.outline(2, k.rgb(80, 55, 30)),
      ]);
    }

    // Water kills (respawn)
    k.add([
      k.rect(400, 40),
      k.pos(1500, GROUND_Y + 80),
      k.area(),
      k.opacity(0),
      "water",
    ]);

    // ---------- Save point (campfire) ----------
    let checkpointX = spawnX > 2000 ? spawnX : 40;
    if (active.save_progress) {
      // Campfire logs
      k.add([
        k.rect(30, 6),
        k.pos(1980, GROUND_Y - 6),
        k.color(80, 55, 30),
      ]);
      // Fire
      k.add([
        k.polygon([k.vec2(0, 0), k.vec2(-8, -18), k.vec2(0, -12), k.vec2(8, -20), k.vec2(6, -6)]),
        k.pos(1995, GROUND_Y - 6),
        k.color(COLORS.fire),
      ]);
      k.add([
        k.circle(24),
        k.pos(1995, GROUND_Y - 14),
        k.color(255, 200, 80),
        k.opacity(0.25),
      ]);
      addLabel(k, 1950, GROUND_Y - 70, "\u2605 Checkpoint", [200, 100, 40]);
      // Checkpoint trigger
      k.add([
        k.rect(30, 60),
        k.pos(1980, GROUND_Y - 60),
        k.area(),
        k.opacity(0),
        "checkpoint",
      ]);
    }

    // ---------- Zone 3: Gathering docs ----------
    addZoneLabel(k, 2100, "Gathering What You Need");
    const docLabels = ["ID", "\u0024\u0024", "HH"];
    for (let i = 0; i < 3; i++) {
      const dx = 2200 + i * 200;
      const dy = GROUND_Y - 80 - (i % 2) * 40;
      k.add([
        k.rect(24, 30),
        k.pos(dx, dy),
        k.color(COLORS.doc),
        k.outline(2, k.rgb(80, 60, 30)),
        k.area(),
        k.z(2),
        "doc",
        { docKey: docLabels[i] },
      ]);
      k.add([
        k.text(docLabels[i], { size: 12, font: "sans-serif" }),
        k.pos(dx + 12, dy + 15),
        k.anchor("center"),
        k.color(60, 40, 20),
        k.z(3),
        { docKey: docLabels[i] },
        "docLabel",
      ]);
    }

    // ---------- Zone 4: Application Mountain ----------
    addZoneLabel(k, 3000, "Application Mountain");
    // Mountain silhouette
    k.add([
      k.polygon([
        k.vec2(0, 0),
        k.vec2(400, -260),
        k.vec2(800, 0),
      ]),
      k.pos(3000, GROUND_Y),
      k.color(COLORS.mountain),
      k.z(-8),
    ]);
    // Snow cap
    k.add([
      k.polygon([
        k.vec2(-40, 0),
        k.vec2(0, -60),
        k.vec2(40, 0),
      ]),
      k.pos(3400, GROUND_Y - 260),
      k.color(COLORS.snow),
      k.z(-7),
    ]);

    if (active.clearer_directions) {
      // Gentle stepped path with markers
      const steps = 8;
      for (let i = 0; i < steps; i++) {
        const px = 3050 + i * 90;
        const py = GROUND_Y - 30 - i * 28;
        k.add([
          k.rect(80, 12),
          k.pos(px, py),
          k.color(COLORS.dirt),
          k.area(),
          k.body({ isStatic: true }),
          k.outline(2, k.rgb(70, 50, 30)),
        ]);
        // Marker post
        k.add([
          k.rect(3, 20),
          k.pos(px + 40, py - 20),
          k.color(COLORS.trail),
        ]);
        k.add([
          k.polygon([k.vec2(0, 0), k.vec2(14, -6), k.vec2(0, -12)]),
          k.pos(px + 43, py - 14),
          k.color(COLORS.trail),
        ]);
      }
      // Downslope steps
      for (let i = 0; i < 4; i++) {
        const px = 3050 + steps * 90 + i * 90;
        const py = GROUND_Y - 30 - (steps - i - 1) * 28;
        k.add([
          k.rect(80, 12),
          k.pos(px, py),
          k.color(COLORS.dirt),
          k.area(),
          k.body({ isStatic: true }),
          k.outline(2, k.rgb(70, 50, 30)),
        ]);
      }
    } else {
      // Sparse, hard-to-time platforms
      const spots: [number, number][] = [
        [3100, GROUND_Y - 70],
        [3220, GROUND_Y - 130],
        [3340, GROUND_Y - 180],
        [3460, GROUND_Y - 220],
        [3580, GROUND_Y - 180],
        [3700, GROUND_Y - 120],
        [3800, GROUND_Y - 60],
      ];
      for (const [px, py] of spots) {
        k.add([
          k.rect(60, 10),
          k.pos(px, py),
          k.color(COLORS.mountain),
          k.area(),
          k.body({ isStatic: true }),
          k.outline(2, k.rgb(60, 70, 80)),
        ]);
      }
    }

    // ---------- Zone 5: Health Coverage (finish) ----------
    addZoneLabel(k, 4000, "Health Coverage");
    // Flag pole
    k.add([
      k.rect(4, 120),
      k.pos(4200, GROUND_Y - 120),
      k.color(120, 90, 60),
    ]);
    // Hospital cross flag
    k.add([
      k.rect(60, 50),
      k.pos(4204, GROUND_Y - 120),
      k.color(COLORS.goal),
      k.outline(2, k.rgb(80, 80, 80)),
    ]);
    k.add([
      k.rect(30, 10),
      k.pos(4219, GROUND_Y - 100),
      k.color(COLORS.goalCross),
    ]);
    k.add([
      k.rect(10, 30),
      k.pos(4229, GROUND_Y - 110),
      k.color(COLORS.goalCross),
    ]);
    // Finish trigger
    k.add([
      k.rect(70, 120),
      k.pos(4200, GROUND_Y - 120),
      k.area(),
      k.opacity(0),
      "finish",
    ]);

    // ---------- Player ----------
    const player = k.add([
      k.rect(16, 24),
      k.pos(spawnX, GROUND_Y - 60),
      k.color(COLORS.player),
      k.area(),
      k.body(),
      k.outline(2, k.rgb(120, 30, 30)),
      k.anchor("bot"),
      "player",
      {
        docs: new Set<string>(),
        checkpointX,
        speed: 220,
        won: false,
      },
    ]);

    // Player head (child sprite)
    const head = k.add([
      k.circle(6),
      k.pos(0, 0),
      k.color(COLORS.playerSkin),
      k.outline(2, k.rgb(160, 100, 60)),
      k.z(10),
    ]);
    // Backpack
    const pack = k.add([
      k.rect(8, 10),
      k.pos(0, 0),
      k.color(COLORS.pack),
      k.z(9),
    ]);
    player.onUpdate(() => {
      head.pos = k.vec2(player.pos.x, player.pos.y - 28);
      pack.pos = k.vec2(player.pos.x - 10, player.pos.y - 20);
    });

    // ---------- Ranger helper (if enabled) ----------
    if (active.helper) {
      const ranger = k.add([
        k.rect(14, 22),
        k.pos(spawnX + 60, GROUND_Y - 22),
        k.color(COLORS.ranger),
        k.outline(2, k.rgb(40, 30, 70)),
        k.anchor("bot"),
        k.z(4),
      ]);
      const rangerHead = k.add([
        k.circle(6),
        k.pos(0, 0),
        k.color(COLORS.playerSkin),
        k.outline(2, k.rgb(160, 100, 60)),
        k.z(11),
      ]);
      const hat = k.add([
        k.rect(14, 4),
        k.pos(0, 0),
        k.color(120, 90, 40),
        k.z(12),
      ]);
      const speech = k.add([
        k.text("Follow me!", { size: 12, font: "sans-serif" }),
        k.pos(0, 0),
        k.color(30, 30, 30),
        k.z(20),
        k.anchor("center"),
      ]);
      ranger.onUpdate(() => {
        // Stay ~140px ahead of player, on ground
        const target = Math.min(player.pos.x + 140, LEVEL_END - 100);
        const dx = target - ranger.pos.x;
        ranger.pos.x += Math.sign(dx) * Math.min(Math.abs(dx), 3);
        ranger.pos.y = GROUND_Y;
        rangerHead.pos = k.vec2(ranger.pos.x, ranger.pos.y - 26);
        hat.pos = k.vec2(ranger.pos.x - 7, ranger.pos.y - 30);
        speech.pos = k.vec2(ranger.pos.x, ranger.pos.y - 50);
      });
    }

    // ---------- HUD ----------
    const modeLabel = k.add([
      k.text(opts.mode === "after" ? "AFTER FEEDBACK" : "BEFORE FEEDBACK", {
        size: 14,
        font: "sans-serif",
      }),
      k.pos(12, 12),
      k.color(opts.mode === "after" ? k.rgb(30, 120, 60) : k.rgb(180, 40, 40)),
      k.fixed(),
      k.z(100),
    ]);

    const hint = k.add([
      k.text("\u2190 \u2192 move    \u2191 / Space jump    R reset", {
        size: 12,
        font: "sans-serif",
      }),
      k.pos(12, 32),
      k.color(60, 60, 60),
      k.fixed(),
      k.z(100),
    ]);
    void modeLabel;
    void hint;

    let docsHudActive = active.documents_earlier;
    const docsHud = k.add([
      k.text("", { size: 14, font: "sans-serif" }),
      k.pos(k.width() - 12, 12),
      k.anchor("topright"),
      k.color(30, 30, 30),
      k.fixed(),
      k.z(100),
    ]);
    function updateDocsHud() {
      const need = ["ID", "\u0024\u0024", "HH"].filter((d) => !player.docs.has(d));
      if (docsHudActive || player.docs.size > 0) {
        docsHud.text = need.length
          ? `Docs needed: ${need.join(" ")}`
          : "Docs: complete";
      } else {
        docsHud.text = "";
      }
    }
    updateDocsHud();

    // ---------- Collectibles ----------
    player.onCollide("doc", (d: unknown) => {
      const doc = d as { docKey: string; destroy: () => void };
      player.docs.add(doc.docKey);
      const key = doc.docKey;
      doc.destroy();
      k.get("docLabel").forEach((label) => {
        const l = label as unknown as { docKey: string; destroy: () => void };
        if (l.docKey === key) l.destroy();
      });
      docsHudActive = true;
      updateDocsHud();
    });

    // Water = respawn
    player.onCollide("water", () => {
      const respawn = active.save_progress ? player.checkpointX : 40;
      player.pos = k.vec2(respawn, GROUND_Y - 60);
      player.vel = k.vec2(0, 0);
      if (!active.documents_earlier) {
        player.docs.clear();
        docsHudActive = false;
        updateDocsHud();
      }
    });

    player.onCollide("checkpoint", () => {
      player.checkpointX = 2000;
    });

    // Finish
    player.onCollide("finish", () => {
      if (player.won) return;
      player.won = true;
      opts.onWin?.();
      const overlay = k.add([
        k.rect(k.width(), k.height()),
        k.pos(0, 0),
        k.color(0, 0, 0),
        k.opacity(0.65),
        k.fixed(),
        k.z(200),
      ]);
      const title = k.add([
        k.text("\u2605 COVERED! \u2605", { size: 42, font: "sans-serif" }),
        k.pos(k.width() / 2, k.height() / 2 - 60),
        k.anchor("center"),
        k.color(255, 220, 90),
        k.fixed(),
        k.z(201),
      ]);
      const msg = k.add([
        k.text("You successfully found your path to coverage.", {
          size: 18,
          font: "sans-serif",
          width: 720,
          align: "center",
        }),
        k.pos(k.width() / 2, k.height() / 2 - 10),
        k.anchor("center"),
        k.color(240, 240, 240),
        k.fixed(),
        k.z(201),
      ]);
      const after = k.add([
        k.text(
          opts.mode === "after"
            ? "Every trail starts somewhere.\nBetter trails are built by listening to the people who use them."
            : "Now imagine this trail with the improvements we vote on.",
          { size: 14, font: "sans-serif", width: 700, align: "center" },
        ),
        k.pos(k.width() / 2, k.height() / 2 + 60),
        k.anchor("center"),
        k.color(220, 220, 220),
        k.fixed(),
        k.z(201),
      ]);
      const restart = k.add([
        k.text("Press R to play again", { size: 14, font: "sans-serif" }),
        k.pos(k.width() / 2, k.height() / 2 + 130),
        k.anchor("center"),
        k.color(255, 255, 255),
        k.fixed(),
        k.z(201),
      ]);
      void overlay;
      void title;
      void msg;
      void after;
      void restart;
    });

    // ---------- Controls ----------
    const leftKeys = ["left", "a"];
    const rightKeys = ["right", "d"];
    const jumpKeys = ["space", "up", "w"];

    k.onUpdate(() => {
      if (player.won) return;
      let dir = 0;
      for (const key of leftKeys) if (k.isKeyDown(key as never)) dir -= 1;
      for (const key of rightKeys) if (k.isKeyDown(key as never)) dir += 1;
      player.move(dir * player.speed, 0);
      // Camera follow
      const camX = Math.max(k.width() / 2, Math.min(player.pos.x, LEVEL_END - k.width() / 2));
      k.setCamPos(camX, k.height() / 2);
    });

    for (const key of jumpKeys) {
      k.onKeyPress(key as never, () => {
        if (player.won) return;
        if (player.isGrounded()) player.jump(560);
      });
    }

    k.onKeyPress("r", () => {
      k.go("trail", 40);
    });

    // Fall out of world
    player.onUpdate(() => {
      if (player.pos.y > 700) {
        const respawn = active.save_progress ? player.checkpointX : 40;
        player.pos = k.vec2(respawn, GROUND_Y - 60);
        player.vel = k.vec2(0, 0);
      }
    });
  });

  k.go("trail", 40);

  return () => {
    try {
      k.quit();
    } catch {
      // ignore teardown errors
    }
  };
}

function addGround(k: Ctx, x1: number, x2: number, y: number) {
  k.add([
    k.rect(x2 - x1, 80),
    k.pos(x1, y),
    k.color(...[80, 60, 40] as [number, number, number]),
    k.area(),
    k.body({ isStatic: true }),
    k.z(-2),
  ]);
  // Grass top
  k.add([
    k.rect(x2 - x1, 8),
    k.pos(x1, y),
    k.color(...[90, 140, 70] as [number, number, number]),
    k.z(-1),
  ]);
}

function addSign(k: Ctx, x: number, text: string) {
  const y = 460 - 60;
  // Post
  k.add([k.rect(4, 40), k.pos(x + 28, y + 20), k.color(120, 90, 60)]);
  // Board
  k.add([
    k.rect(60, 40),
    k.pos(x, y - 10),
    k.color(200, 160, 80),
    k.outline(2, k.rgb(120, 90, 40)),
  ]);
  k.add([
    k.text(text, { size: 10, font: "sans-serif", align: "center", width: 56 }),
    k.pos(x + 30, y + 10),
    k.anchor("center"),
    k.color(60, 40, 20),
  ]);
}

function addZoneLabel(k: Ctx, x: number, label: string) {
  k.add([
    k.text(label.toUpperCase(), { size: 14, font: "sans-serif" }),
    k.pos(x, 100),
    k.color(30, 60, 100),
    k.opacity(0.75),
    k.z(-1),
  ]);
}

function addLabel(
  k: Ctx,
  x: number,
  y: number,
  text: string,
  rgb: [number, number, number],
) {
  k.add([
    k.text(text, { size: 12, font: "sans-serif" }),
    k.pos(x, y),
    k.color(...rgb),
  ]);
}
