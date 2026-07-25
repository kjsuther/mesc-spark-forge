## Root cause of the stuck cutscene

The pole spawns at `topLandingX + 130` but the top landing platform is 160 px wide (`topLandingX .. topLandingX+160`) and is a **solid `body({ isStatic: true })`**. When the cutscene snaps the player to `poleTop + 6` (above the landing) and the slide loop starts pushing `pos.y` toward `GROUND_Y`, the player's body collides with the landing platform and gets shoved back to the platform top on every frame. Result: hero stands on the landing forever, HUD says "FINISHING…", no slide, no fireworks, no WIN.

## Fixes in `src/components/game/game-scenes.ts`

### 1. Zone 8 — actually slide down the pole (functional fix)

- Move the pole past the landing: `poleX = topLandingX + 190` (landing is 160 wide starting at `topLandingX`, so this places the pole ~30 px past the right edge). Adjust the ID card sign / arrow x accordingly so "GRAB THE ID →" still points at the card.
- Also, during `firePoleAttached`, temporarily flip the top landing platform to non-solid (`landing.unuse("body")` once at attach time) so any residual collision with a bot-anchored hitbox can't block descent. This is defense-in-depth.
- Keep the existing safety-net: once `pos.y >= GROUND_Y`, set `firePoleDone`, advance cutscene to `walk-to-office`, then run `tryWin()` (already wired).

### 2. Zone 8 — nicer slide visuals

- Regenerate `src/assets/game/hero-slide-sheet.png` (transparent bg, 2 frames) tuned for the current hero look: frame 0 = both arms up gripping pole, feet together; frame 1 = same pose with a subtle body twist / motion-blur streaks to sell downward motion. No pole baked into the sprite.
- Add a lightweight "swoosh" trail effect during the slide: a few semi-transparent vertical streaks spawned each 80 ms behind the hero, fading out over 300 ms. Purely decorative, no collision.

### 3. Zone 3 (River of Paperwork) — restore background thought bubbles

Inside the Zone 3 (`rx0 = BIOME_W * 2`) block, call `spawnThoughtBubble(k, x, y, text)` for 4–5 bubbles floating over the river at `BG_NEAR` depth, e.g. "Which form?", "Do I qualify?", "Where do I start?", "Is this online?", "How long?". No gameplay effect.

### 4. Zone 6 (Waiting Mountain) — falling calendar dates instead of boulders

- Generate a new sprite `src/assets/game/calendar-page.png` (single frame, ~40×48, SNES-style tear-off calendar page showing a date). Load through `safeLoadSheet` alongside existing sheets and register `DISPLAY_H["calendar-page"] = 40`.
- Replace the 3 `boulder` spawns in the Zone 5 (index 5, "Waiting Mountain") block with `calendar-page` entities that fall the same way. Keep the `"boulder"` tag on the entity so existing collide handler / fail message ("A tough eligibility question…") still fires — or rename the tag to `"calendar"` and add a new collide handler + fail message ("Another day on the waiting list…"). Prefer the rename for clarity; update `FailCause`, `failMessage`, and `player.onCollide` accordingly.
- Add a light rotation tween on each falling page for polish.

### 5. Zone 5 (Answering the Call / Respond to Requests) — paper airplanes flying across the background

- Generate `src/assets/game/paper-airplane.png` (single frame, ~48×24, folded-paper airplane, transparent bg). Load + register display size.
- In the Zone 4 (index 4, `relayBase = BIOME_W * 4`) block, spawn 3–4 airplane entities at `BG_NEAR` layer that drift horizontally (varying speeds, sine-wave Y bob), looping when they exit the zone bounds. No collision, no `"monster"`/`"boulder"` tag — decorative only.

### 6. Text legibility pass across all zones

Audit every text spawned via `addSpeech`, `addSignPlaque`, `spawnThoughtBubble`, and the HUD:
- Ensure each label uses `pixelHudText`-style rendering: pixel font + a 1 px black drop shadow OR a dark plaque background behind the text.
- Any labels currently drawn as plain `k.text(...)` without a plaque/shadow (e.g. `addSpeech` bodies, thought bubbles, "★ COVERED! ★", "Awaiting a decision…", "Answer every request!", HUD hint text) get upgraded to include a 1 px black shadow layer and, where they sit over busy backgrounds, a semi-opaque dark rounded rect behind them (matching the Zone 1 sign plaque style).
- Bump the Zone 5 big countdown contrast if needed (already has a backdrop; verify).

## Out of scope

- No changes to physics, scoring, controls, or zones 1/2/4/7 gameplay.
- No changes to backend / voting / admin.

## Verify

Playwright at 1280×1800 desktop and 844×390 mobile-landscape:
1. Force-advance to Zone 8, grab the Medical ID, confirm the hero walks to the pole, **slides all the way to the ground**, walks to the medical office, fireworks fire, WIN overlay + `ScoreSubmit` appear.
2. Walk through Zone 3 and confirm thought bubbles float in the background.
3. Enter Zone 6 and confirm calendar pages (not boulders) fall from the sky and still damage the player.
4. Enter Zone 5 and confirm paper airplanes drift across the background without colliding.
5. Screenshot every zone; confirm all in-world text has readable contrast on desktop and mobile.
