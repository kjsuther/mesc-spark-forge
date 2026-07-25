## Goal
Make the game actually start and play well on mobile, matching the desktop experience.

## Suspected root causes (from code audit)

1. **Start button doesn't respond reliably on touch.** `MenuButton` uses `onClick` inside a container with `touchAction: "none"` and `userSelect: "none"`. On iOS Safari this combo occasionally swallows synthetic click events after a pointerdown that hits the "none" region — the button appears dead. Switch the launch buttons to `onPointerUp` (with `preventDefault`) so a tap always fires.
2. **Fullscreen launch path loses the user gesture on iOS.** `pickMode('fullscreen')` `await`s `requestNativeFullscreen()` before `setLaunchMode`. iOS drops the gesture across the await, native fullscreen rejects, faux-fullscreen kicks in but the whole flow can hang if `requestFullscreen` throws synchronously on a `<div>` (unsupported on iOS Safari). Detect unsupported up front and go straight to faux-fullscreen; never block `setLaunchMode` on the fullscreen promise.
3. **Asset memory pressure crashes low-end mobile.** 8 backgrounds at 1920×640 plus sprite sheets total ~16 MB on disk and ~40+ MB decoded in GPU memory. Combined with `pixelDensity: 2` (1920×1080 backing buffer), iOS Safari can silently kill the WebGL context. Shrink backgrounds to 1280×426 (still crisp at logical 240px tall zones) and drop `PIXEL_DENSITY` to 1 on devices with `devicePixelRatio ≥ 2` — pixel-art rendering with `imageRendering: pixelated` looks identical.
4. **No loading feedback.** If the dynamic import or asset load stalls, the user sees the title screen frozen with no spinner and assumes it's broken. Show a "Loading…" state between "Start" tap and first frame.
5. **Inline non-fullscreen mobile layout is cramped at 402px.** Canvas ends up ~226px tall with touch buttons below. Auto-switch mobile devices into faux-fullscreen on Start so the game gets full viewport by default; keep an explicit "Windowed" option for tablets/desktop.

## Changes

**`src/components/game/game-canvas.tsx`**
- Replace `MenuButton` `onClick` with `onPointerUp` + `preventDefault`; add `touch-none` class and matching pointer handlers so the first tap always registers.
- Detect mobile (`matchMedia('(pointer: coarse)')`); on Start, force `fauxFullscreen = true` immediately and set `launchMode` synchronously — do not await `requestFullscreen` on mobile.
- Guard `requestNativeFullscreen` when `el.requestFullscreen` / `webkitRequestFullscreen` are missing (iPhone Safari) and short-circuit to faux.
- Add a loading overlay ("LOADING…" pixel text) between `launchMode` set and the moment `startGame` resolves, so users see feedback even on slow networks.
- Tighten fullscreen control layout so the bottom control strip reserves a safe area and never overlaps the canvas at short landscape heights (already partially done; verify at 360×640 landscape).

**`src/components/game/game-scenes.ts`**
- Drop `PIXEL_DENSITY` from `2` to `1`. With `LOGICAL_W/H = 960×540` and `imageRendering: pixelated`, this halves GPU memory and roughly 2× improves fill-rate on mobile with no visible quality loss for pixel art.
- Add a try/catch around the initial `loadAllSprites` call that logs individual asset failures via the existing `ASSET_REPORT` so a single bad texture no longer aborts the whole game silently.

**Asset resize (build-time, one-off)**
- Re-export the 8 zone backgrounds at 1280×426 (they are currently 1920×640 for a 960×540 game — 2× oversampled). Use `ffmpeg`/`sharp` at 75% JPEG-like PNG quality. Keeps crispness at logical scale, cuts ~10 MB of decoded texture memory.

## Verification

- Playwright: iPhone 14 emulation, load `/tool`, tap Start, confirm canvas renders first frame within 5s, tap ◀/▶/JUMP, confirm player moves.
- Playwright: iPad emulation landscape, same flow in faux-fullscreen.
- Desktop Chrome regression: Start, Fullscreen, keyboard controls all still work.
- Manual: check `window.performance.memory` before/after on mobile; expect ≥50% JS heap reduction from the pixelDensity + background resize.

## Out of scope
- No gameplay balance changes, no new sprites, no zone logic edits.
