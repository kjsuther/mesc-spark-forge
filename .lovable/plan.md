## Goal

Bring `Blazing the Trail to Coverage` up to a "polished 16-bit platformer" bar: fix the concrete bugs first (moving platforms, enemy/sprite alignment, mobile browser interference), then run a structured QA pass on every level and file a report. Keep current difficulty.

Scope is the `/tool` game only — `src/components/game/game-scenes.ts`, `src/components/game/game-canvas.tsx`, and the `/tool` route wrapper. No new backend, no art regeneration, no audio system added (audio isn't in the game today — flagged as out-of-scope, see bottom).

---

## 1. Physics + moving-platform fixes (highest priority)

Root cause of the "character slides / lags / floats off" on moving platforms: static Kaplay bodies that translate via `onUpdate` don't transfer velocity to riders, and the player's horizontal velocity is set from raw input each frame, wiping any carry.

Changes in `game-scenes.ts`:

- Give each moving platform a `platformSpeed` object (`{vx, vy}`) updated every frame from its sine motion (delta since last frame ÷ dt).
- Track `player.riding` = the platform whose top the player is standing on (detect via `onCollide` with a small `"platform"` tag + `player.isGrounded()` + feet-Y within 2px of platform top).
- Each frame, when `riding` is set: add `platform.platformSpeed.vx * dt` to player's x position AFTER input movement, and snap `player.pos.y` to `platform.pos.y - platform.height/2 - playerHalfHeight` so the player never separates or sinks. Clear `riding` when not grounded or when leaving the platform's x-range.
- Cap horizontal input to a `MOVE_SPEED` constant applied via `player.move(...)` (not by rewriting velocity), so carry works additively.
- Add a coyote-time window (~90ms) and a jump-buffer (~120ms) so jumps off platform edges feel responsive.
- Fix landing snap: on `onGround`, zero any residual downward velocity to remove the 1-frame bounce.
- Kill-plane: verify triggers on river gaps before the player can land on nothing; move to `GROUND_Y + 40` on river zone only.

## 2. Sprite + enemy alignment audit

- Re-anchor every actor to `anchor("bot")` at its ground Y so sprite feet sit exactly on the visible ground strip: player, ranger/helper, doc pickups, campfire, backpack, form-monster enemies, boulders, signposts, gate, finish flag. Currently only player + ranger are `anchor("bot")`.
- For each entity, add an explicit `area({ shape: new k.Rect(...) })` sized to the visible sprite (not the full frame), and offset so the collision box matches the pixels. This fixes the "enemy hitbox is off" and sprite-clipping reports.
- Verify per-biome ground strip height matches `GROUND_Y` (currently 80px; ensure no biome overrides it).

## 3. Enemy behavior polish

- Form-monster patrol: clamp to its spawn zone's x-range so it can't walk into a wall and jitter.
- Add a 200ms invulnerability window on player after taking damage (prevents multi-hit death from one contact frame).
- Boulders: ensure they despawn off-screen (memory) and don't spawn while player is at the entry ledge.

## 4. Mobile browser interference + fullscreen

`game-canvas.tsx`:

- Wrap the canvas + touch controls in a container that gets `touch-action: none`, `user-select: none`, `-webkit-user-select: none`, `-webkit-touch-callout: none`, `overscroll-behavior: contain`.
- Add `onContextMenu={(e) => e.preventDefault()}` on canvas and touch buttons.
- Add a "⛶ Fullscreen" button (desktop + mobile) that calls `containerRef.current.requestFullscreen()` (with `webkitRequestFullscreen` fallback for iOS Safari where supported). While fullscreen: canvas fills viewport preserving 16:9 with letterboxing (Kaplay already has `letterbox: true`), touch controls overlay the bottom of the canvas with `position: absolute` and safe-area insets (`env(safe-area-inset-bottom)`).
- Prevent double-tap zoom by keeping `touch-action: none` on the game surface AND adding `<meta name="viewport" content="..., user-scalable=no">` scoped via the route's `head()` (already partly there — verify).
- Pointer capture on each touch button so dragging off the button while held doesn't lose the input (already partly implemented — verify multi-touch: press-and-hold left + tap jump must both register).

## 5. Camera + level bounds

- Confirm `camPos` clamp accounts for fullscreen width changes (recompute `width()` each frame instead of caching).
- Add a 1-tile invisible wall at `x=0` and `x=LEVEL_END` so the player can't walk off the left edge.

## 6. QA pass + report

After fixes, run Playwright at 1280×800 (desktop) and 402×800 (mobile-portrait) + 800×402 (mobile-landscape). For each biome capture: entry, mid-zone, exit. Additionally reproduce: death on river gap, gate-locked with 2 docs, mountain peak, clinic win, mobile reset button, fullscreen toggle.

Deliver a `QA-REPORT.md` at project root with, per issue: symptom, root cause, fix, file/line, screenshot path, regression check result. Include a "known limitations" section for anything intentionally deferred.

---

## Explicitly out of scope (call out to user)

- **Audio / SFX / music** — the game currently has none; adding an audio system, sourcing SFX, and testing pause/resume behavior is a separate feature, not a QA fix. Flag in the report.
- **Controller / gamepad support** — not currently implemented.
- **Double jump** — not a current mechanic; the prompt lists it as "if applicable". Leaving single-jump as designed.
- **Animation states beyond current idle/walk/jump** — no new sprite sheets; will polish transitions on what exists.
- **New art or biomes.**

## Technical notes

- Files touched: `src/components/game/game-scenes.ts`, `src/components/game/game-canvas.tsx`, possibly `src/routes/tool.tsx` (viewport meta), new `QA-REPORT.md`.
- No dependencies added, no schema changes, no new routes.
- Verification: Playwright screenshots + a scripted playthrough that walks right, jumps a river platform, collects a doc, and reaches the gate — asserting no console errors and player.y stays within 1px of expected ground each landing frame.
