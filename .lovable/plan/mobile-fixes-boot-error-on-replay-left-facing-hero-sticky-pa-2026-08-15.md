# Mobile fixes: boot error on replay, left-facing hero, sticky pad buttons

Three mobile defects. Each fix below is tied to something confirmed in the current code.

## 1. "Game hit a snag / failed to load shaders" on the second play

Confirmed in the boot effect: the canvas element is keyed by the engine generation, and on restart the effect cleanup releases the old canvas's graphics context only when `bootedCanvas !== canvasRef.current`. On a restart the cleanup runs before the replacement canvas mounts, so the ref still points at the retired canvas and that guard fails — the old context is never handed back. Mobile browsers cap live contexts, so the next boot fails at shader compile; tapping Retry works because by then the old context has been collected.

Fix:
- Track the booted canvas element directly and always release its context on teardown, instead of comparing against the live ref.
- Await the release plus a frame before the next boot so only one context is alive at a time.
- Keep the Retry path as a safety net, but it should no longer be reachable in normal restart flow.

## 2. Hero walks backwards instead of turning left

The hero uses pre-rendered mirrored sprites (`hero-*-left`) generated at load time by drawing each frame into a 2D canvas and calling `toDataURL`. `facingSuffix()` returns `"-left"` only when that mirrored sprite registered successfully; on failure it silently returns `""` and the right-facing sprite is used while the character moves left — exactly "walking backwards". On mobile this generation step is the most likely to fail or be skipped (memory pressure / decode limits), and there is currently no fallback.

Fix:
- Add a render-time fallback: when a mirrored variant is missing, set `flipX = true` (and clear it when facing right) so the hero always visually turns.
- Make mirror generation more robust on mobile (reuse a single scratch canvas, prefer a blob/bitmap path over repeated `toDataURL`) and log which frames failed to the asset report.
- Verify facing flips correctly for idle, walk and jump frames in both directions.

## 3. Left/Right buttons need more than one tap

In `PadButton`, `onPointerDown` early-returns whenever `activePointerRef.current` is not null. If a previous pointer's up/cancel was swallowed (common when a touch starts during a fullscreen or orientation transition, or when capture is lost), the ref stays set and the next tap is ignored entirely — the player taps twice.

Fix:
- Never drop a fresh press: adopt the new pointer id instead of returning early, releasing any stale one first.
- Clear the stale pointer id on window `pointerup`/`pointercancel`/`blur` even when the button is not in the pressed state (today that safety net only runs while `pressed` is true).
- Apply the direction on the very first pointer event and keep `touch-action: none`, so there is no delay between finger-down and movement.

## Verification

Playwright at iPhone SE, iPhone 15 landscape and Pixel 7: play a run to failure, restart, and assert no error card and a clean console across three consecutive runs; hold LEFT and screenshot the hero to confirm he faces left; rapid alternating taps of LEFT/RIGHT to confirm every tap registers. Desktop keyboard path re-checked for no regression.

## Technical notes

- Files touched: `src/components/game/game-canvas.tsx` (boot/teardown context release, `PadButton` pointer handling) and `src/components/game/game-scenes.ts` (mirror registration + `facingSuffix` flipX fallback).
- No gameplay constants, physics, scoring or zone content change.
