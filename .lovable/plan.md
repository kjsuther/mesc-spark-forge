## Root causes discovered

I measured every frame in both sprite sheets. The graphical bugs (floating player, monsters above the road, cropped heads, gaps between signs) all trace to **two engine-level defects**, not per-entity mistakes:

### Root cause 1 — Sprite sheets are not a uniform grid

`character-sheet.png` (loaded as `sliceX:3, sliceY:2`) and `props-sheet.png` (loaded as `sliceX:4, sliceY:3`) have wildly different transparent padding per frame:

- Hero idle: 72px bottom padding. Hero walk frame 2: **0px** bottom padding. Hero jump: **177px** bottom padding.
- Props envelope / boulder / formMonster / denied: **~219px** bottom padding (they're packed at the TOP of their cell, filling only ~120 of 341 pixels).
- Signpost, bridge, campfire, backpack, id, paystub: 0px bottom padding but varying top padding (0–44px).

Kaplay's `anchor("bot")` puts the *frame's* bottom edge at `pos.y`, so any transparent bottom padding becomes visible float. Because it varies **per frame within the same animation**, no single `PLAYER_FOOT_PAD` constant can make the hero stand on the ground — he floats during walk frame 0/1, plants during walk frame 2, and rockets up during the jump frame. Same story for every prop with a different per-frame `bot_pad`.

The current code compensates with hand-tuned `PLAYER_FOOT_PAD`, `RANGER_FOOT_PAD`, `MONSTER_FOOT_PAD`, `ENVELOPE_FOOT_PAD`, `DENIED_FOOT_PAD` constants and manual `pos.y = GROUND_Y + PAD` re-clamps. That is exactly the "hardcoded offsets for specific entities" pattern the brief forbids, and it can never work because the padding is per-frame, not per-entity.

### Root cause 2 — Fixed render size stretches non-uniform frames

Every sprite is drawn with an explicit `width`/`height` (e.g. `sprite("props", { frame: PROP.signpost, width: 56, height: 56 })`). Because the frames have different real pixel dimensions and different padding, this **stretches each frame differently** and forces two adjacent signposts to visually disagree, producing the "gap between stacked wooden signs" seen in screenshot 1. It also chops enemy heads (screenshot 2) because the top-half-only monster art is being rendered as if it were a full-height sprite anchored to the bottom, so the visible body sits above the road while the transparent bottom half occupies the ground line.

### Root cause 3 — Ground and layering are drawn as flat rects

`addGround` draws a colored rectangle, then a 8px "grass" strip, then a 2px highlight — all with `z(-3/-2/-1)`. Players, props, and enemies use `z(2..4)`. That works, but decorative props (trees, signs) get no distance layering, and there is no consistent Z scheme, so every future addition is a coin flip on ordering.

## Plan

The fix is to remove the variable-padding problem at the asset layer and unify rendering behind a single helper. No per-entity offsets remain in gameplay code.

### 1. Asset pipeline: bake trimmed, baseline-aligned sprites

Add `scripts/build-game-sprites.mjs` (Node, run manually once) that:

- Loads `character-sheet.png` and `props-sheet.png` with `sharp`.
- For each frame index used in code, crops to the cell, computes the alpha bounding box, trims transparent padding on all sides, and re-emits a **per-frame PNG** into `src/assets/game/sprites/{name}.png` (`hero-idle.png`, `hero-walk-1..4.png`, `hero-jump.png`, `signpost.png`, `ranger.png`, `map.png`, `campfire.png`, `backpack.png`, `bridge.png`, `id.png`, `paystub.png`, `envelope.png`, `boulder.png`, `form-monster.png`, `denied.png`).
- Emits `sprites/manifest.json` with each sprite's trimmed `w`, `h`, and — critical — a normalized `footY` (the y-coordinate of the visible feet, defaulting to trimmed `h` for grounded actors, and to `h/2` for airborne props like the boulder).
- Uploads each PNG through `lovable-assets create` so we get stable CDN URLs (repo stays small), and writes a `sprites/index.ts` that imports the `.asset.json` pointers.

Because every emitted frame is trimmed to its visible pixels, `anchor("bot")` alone will always plant feet on the ground — for **every frame of every animation**, with no compensation constants.

### 2. Rendering pipeline: one authoritative helper

In `game-scenes.ts`, replace scattered `k.add([k.sprite(...), k.pos(...), k.anchor(...), ...])` calls with three helpers that every entity must use:

- `spawnGrounded(k, spriteId, { x, groundY, z, anim?, hitbox? })` — places the sprite with `anchor("bot")` at `(x, groundY)`, adds a body/area sized to the trimmed sprite (or an explicit hitbox tuple), and sets `z` from a shared `LAYERS` enum.
- `spawnAirborne(k, spriteId, { x, y, z, hitbox? })` — same, `anchor("center")`, for the boulder and any future projectile.
- `spawnDecor(k, spriteId, { x, groundY, z })` — non-colliding scenery (signs, ranger idle, map, campfire visuals).

All three read the trimmed size from the sprite manifest so `width`/`height` are the sprite's real trimmed pixels — nothing is stretched, so the sign-seam and cropped-head issues cannot recur.

Introduce a `LAYERS` constant used by every `k.z(...)` call:

```text
SKY=-40  BG_FAR=-30  BG_NEAR=-20  GROUND=-10  GROUND_TOP=-9
DECOR_BACK=-5  PLATFORM=0  PROP=5  ACTOR=10  PLAYER=12
EFFECT=20  UI=100  OVERLAY=200
```

### 3. Delete every per-entity foot-pad constant

Remove `PLAYER_FOOT_PAD`, `RANGER_FOOT_PAD`, `MONSTER_FOOT_PAD`, `ENVELOPE_FOOT_PAD`, `DENIED_FOOT_PAD` and every `pos.y = GROUND_Y + PAD` re-clamp. Platform snapping (`snapToPlatform`, riding logic) becomes `player.pos.y = plat.pos.y` because `anchor("bot")` is now truthful.

### 4. Camera, scaling, pixel snapping

- Set `pixelDensity: Math.min(2, devicePixelRatio)` and keep `crisp: true` for nearest-neighbor.
- Wrap camera position each frame with `k.camPos(Math.round(x), Math.round(y))` to kill sub-pixel jitter.
- Keep `letterbox: true` so mobile scaling stays integer-friendly.

### 5. Ground / tilemap seams

Replace the 3-rect `addGround` with a single helper that draws one soil rect + one grass strip using the same `x`/`w`, at `LAYERS.GROUND`/`GROUND_TOP`, and asserts `x2 > x1`. Adjacent ground segments now share exact edges (no 1px seam) because they're issued from one function with integer coordinates.

### 6. Automated QA sweep

Add `scripts/qa-game-render.mjs`: launches the built game in headless Chromium via Playwright, scripts the player to teleport through each biome (using a debug `window.__qa` hook we expose only when `import.meta.env.DEV`), and screenshots every 200px. A post-processing pass:

- Confirms the player's bottom pixel row equals `GROUND_Y` at rest in every biome.
- Confirms every monster/prop's visible bottom-edge matches its ground segment top.
- Confirms adjacent ground rects have no transparent column between them.
- Fails the script if any check misses.

Report is written to `QA-REPORT.md`.

### 7. Regression pass

After the refactor: walk every zone, jump every gap, ride every moving platform, collide with every monster, collect every doc, hit the win + lose overlays. Verified in the QA script above and by a manual Playwright screenshot pass captured into `/tmp/browser/qa/`.

## Files touched

- **New**: `scripts/build-game-sprites.mjs`, `scripts/qa-game-render.mjs`, `src/assets/game/sprites/*.png.asset.json`, `src/assets/game/sprites/index.ts`, `src/assets/game/sprites/manifest.json`.
- **Rewritten**: `src/components/game/game-scenes.ts` (asset imports, spawn helpers, layer constants, foot-pad removal, ground helper, snap simplification).
- **Minor**: `src/components/game/game-canvas.tsx` (dev-only `window.__qa` hook), `QA-REPORT.md` (regenerated).
- **Untouched**: routing, voting, scoring, leaderboard, admin panels — this is purely a rendering-pipeline refactor.

## Confirmation criteria

The plan is complete when: no `*_FOOT_PAD` constant exists anywhere in the codebase; every entity flows through `spawnGrounded` / `spawnAirborne` / `spawnDecor`; the QA script passes for all five biomes on desktop and a mobile viewport; and manual Playwright screenshots show the hero, ranger, form monsters, envelopes, and signs all standing on the same visible ground line with no cropping and no gaps.
