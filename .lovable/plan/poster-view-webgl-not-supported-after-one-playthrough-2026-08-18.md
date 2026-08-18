# Poster View: "WebGL not supported" after one playthrough

## What is confirmed

- The message comes from the game engine itself: it calls `canvas.getContext("webgl", ...)` at boot and throws `WebGL not supported` when that returns `null`. Two things make it return null: the browser's per-page live-context budget is exhausted, or that same canvas element already holds a context of a different type.
- The Poster View embeds the game in an iframe, and each new run mounts a brand-new canvas (`key={launchMode-engineGeneration}`) and boots a new engine, so contexts accumulate unless every retired one is truly released.
- The cleanup helper asks for `webgl2` first and falls back to `webgl`. On any canvas that has not booted yet, that call *creates* a webgl2 context and permanently poisons later `webgl` requests on that element — a real hazard on the paths that release a canvas that is still in play (the cancelled-boot path, and context-loss recovery).
- Retry only bumps the engine generation. If the underlying cause is still present, the second boot fails the same way, so the button looks dead.

The exact trigger in Poster View (budget exhaustion vs. a poisoned canvas) is not yet confirmed, so step 1 is to reproduce and measure before changing behavior.

## Plan

### 1. Reproduce and measure (first step, before the fix)
Drive the Poster View in a headless browser: play a run to its end, let it return to title / demo loop, and boot again. Log how many WebGL contexts are alive at each boot, whether the retired canvases actually report `isContextLost()`, and the exact error and stack on the failing boot. This tells us which of the two causes is in play.

### 2. Guarantee one live context at a time
- Release the retired context using the same context type the engine used (never request `webgl2` on a canvas that may still be booted).
- Release on every teardown path, and wait for the release plus a frame before the next boot, so no two contexts overlap.
- Never call the release helper on a canvas that is about to boot.

### 3. Make Retry actually recover
- Retry should fully remount the stage (drop the old canvas element, release its context, then boot fresh) rather than only incrementing a counter.
- If a boot still fails, fall back to returning to the title screen with a plain "Start" instead of a dead-end error card, so a kiosk attendee always has a way back into the game.
- Confirm the error card sits above the demo overlay and receives taps in the embedded Poster iframe.

### 4. Re-verify
Three consecutive Poster View runs (play → end → score/feedback → back to title → demo loop → play again) with a clean console and no error card, on desktop and a mobile viewport. Desktop `/tool` path re-checked for no regression.

## Technical notes

- Files touched: `src/components/game/game-canvas.tsx` (boot/teardown context release, retry handling, error overlay layering). No gameplay, scoring, or zone content changes.
