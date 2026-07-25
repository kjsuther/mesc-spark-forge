## Fixes for Blazing the Trail to Coverage

All changes live in `src/components/game/game-scenes.ts` unless noted.

### 1. Player spawn height (red-arrow alignment)
- The hero currently spawns on the soil strip below the grass line. Move initial spawn and respawn Y so the player's feet land on the top edge of the green grass strip (the light-green pixel row), matching the arrow in the screenshot.
- Recompute `GROUND_Y` (or introduce `GRASS_TOP_Y = GROUND_Y - grassStripHeight`) and use it everywhere player/enemies/signs anchor `bot`. Signs and monsters get re-grounded to the same line so nothing floats.

### 2. Zone 2 title
- In `ZONES`, rename Zone 2 label to **"Crossing River of Paperwork"** (subtitle stays Medicaid-themed, e.g. "Step 2 · Verify your info").

### 3. Zone 3 paperwork villain (impossible to pass)
- Reduce enemy `DISPLAY_H` for the form-monster from ~50 to ~36, cap width via scaled height so it fits inside the jump arc.
- Fix cropped top: re-run `loadTrimmedSheet` with padding so alpha bounds include the top envelope flap; anchor `bot` after full trim. Verify by drawing a bounding rect during dev.
- Space the two monsters farther apart and lower their speed slightly so a single well-timed jump clears each one.

### 4. Zone 4 has no road (dead end)
- Root cause: mountain zone builds stepped platforms but the ground segment for biome index 3 isn't emitted at full width. Extend `addGround` to run continuously across all 5 biomes, and make mountain platforms sit **above** the ground rather than replacing it, so the player always has a floor to fall back to. Add a guaranteed climbable staircase from ground level up to the mountain summit and back down into Zone 5.

### 5. Zone 1 easy obstacle
- Add one small gap (about 40–60px) roughly midway through Zone 1 with a short hop platform, teaching the jump before Zone 2.

### 6. Lives = "applications", checkpoint respawn, i-frames
- Start with 3 lives. Replace heart HUD glyphs with a small pixel "application form" icon (new sprite generated via imagegen, or a simple CSS/canvas glyph in the HUD).
- On death: do **not** teleport to start. Respawn at the entrance of the current zone (or last checkpoint if `save_progress` improvement enabled) with 2 seconds of invulnerability during which the sprite blinks at ~10Hz (toggle opacity each 100ms). Extend `INVULN_S` to 2.0.

### 7. Score above lives
- Add a score readout in the HUD above the applications row. Score keeps accumulating across deaths (don't zero on respawn; only the −500 death penalty applies, floored at 0). Update `updateHud()` layout accordingly.

### 8. Zone 1 sign readability
- The `[MAIL] Apply by Mail` labels render in low-contrast cyan over foggy forest. Give each sign label a solid dark plaque background (e.g. filled rect behind the text with cream/parchment color and dark brown text), matching a wooden trail-sign look. Applies to all four method signs.

### Technical notes
- Files touched: `src/components/game/game-scenes.ts` (spawn Y, ZONES label, enemy sizing, ground continuity, Zone 1 gap, respawn logic, i-frames, HUD, sign labels).
- Possibly `src/components/game/game-canvas.tsx` if HUD is rendered in React overlay rather than Kaplay (will confirm on read).
- May generate one new small pixel-art icon for the "application" life via `imagegen` (16×16, transparent).
- Verify with Playwright: desktop + mobile playthrough capturing spawn, Zone 1 gap, Zone 3 clear, Zone 4 traversal, HUD score/lives.
