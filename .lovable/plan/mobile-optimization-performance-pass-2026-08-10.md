# Mobile Optimization & Performance Pass

A lot of mobile groundwork already exists (rotate prompt, safe-area padding, overlay touch pads in fullscreen, a device-aware Controls screen, WebP art, sprite frame caching). This pass closes the real gaps rather than rebuilding what works, and leaves the desktop path untouched.

## What the audit found

- Device detection is ad hoc: `isCoarsePointer()` is duplicated in the canvas host and the engine, and the in-page touch D-pad is gated by the Tailwind `md:hidden` width breakpoint — so a landscape phone or tablet wider than 768px loses its movement buttons entirely.
- Several in-canvas prompts are still keyboard-only on mobile: the Zone 1 hint ("Jump (Up Arrow or Space)…"), the failure prompt ("Tap Screen, Press R or Enter"), and a few pause/briefing lines.
- Touch pads only overlay the canvas in fullscreen; in windowed mobile play they sit below the canvas and can fall under the fold.
- Every sprite sheet and all eight zone backdrops load in two batched `Promise.all` calls before the title screen appears — the heaviest part of mobile load time and peak memory.
- Text sizing in the canvas is driven by a global density factor rather than by available viewport height, so short landscape phones get cramped briefings.

## Plan

### 1. One source of truth for device profile
Add `src/lib/device.ts` exporting a `getDeviceProfile()` (coarse pointer + `maxTouchPoints` + UA hints + viewport + orientation) and a `useDeviceProfile()` hook that re-evaluates on resize, orientation change, and fullscreen change. Replace every local `isCoarsePointer` and every width-only `md:` gate that controls behavior (not pure styling). The engine gets the profile passed in from the host instead of sniffing on its own.

### 2. Touch controls that are always there
- Show the D-pad whenever the profile says touch, regardless of width (fixes tablets and wide landscape phones).
- Overlay the pads on the canvas in windowed mobile play too, anchored to safe-area insets, so they never scroll off.
- Size buttons from viewport height with a comfortable minimum tap target and guaranteed spacing; keep the existing 16-bit button styling.
- Harden input: pointer capture on down, release on `pointerup`/`pointercancel`/`lostpointercapture`/blur so a button can never stick; multi-touch (hold LEFT + tap JUMP) verified.

### 3. Device-aware prompts everywhere
Add a small prompt helper in the engine (`continuePrompt()`, `jumpPrompt()`, `restartPrompt()`) driven by the shared profile, and route every remaining hard-coded keyboard string through it: Zone 1 brick hint, boss ready prompt, failure/score prompt, thank-you continue, pause and briefing footers, HUD hint line. Desktop wording stays exactly as it is today.

### 4. Responsive text and HUD
Derive canvas font sizes and briefing plaque widths from the live viewport (short-landscape gets tighter line count, not smaller glyphs), wrap on word boundaries only, and clamp plaques inside the safe area. HUD (time/score/lives) repositions into a compact single row on short screens instead of shrinking.

### 5. Landscape, fullscreen, orientation
Recalculate layout on `resize`, `orientationchange`, `visualViewport` resize/scroll, and fullscreen change with a debounced single path so canvas size, HUD, and pad positions always agree. Verify no black bars, no page scroll, no clipped controls entering/exiting fullscreen mid-run.

### 6. Load time and memory
- Load only title-screen and Zone 1 assets before first play; prefetch the next zone's backdrop during the current zone's briefing.
- Reuse the existing frame cache across restarts; release decoded images and scratch canvases for zones left behind.
- Audio: keep one shared context, no new oscillator graph per zone restart, stop and disconnect nodes on scene exit.
- Loop/listener audit: every `onUpdate`, timer, and DOM listener registered by a run is torn down on restart; confirm repeated start → play → die → restart cycles keep memory flat.

### 7. QA pass
Playwright runs at iPhone SE, iPhone 15, iPhone 15 landscape, Pixel 7, a large Android, and iPad viewports plus a desktop control run: title → controls screen → each zone → boss → win and lose paths, with orientation flips and fullscreen toggles mid-run, plus a repeated restart loop checking that the hero stays idle until input.

## Technical notes

- Files touched: `src/lib/device.ts` (new), `src/components/game/game-canvas.tsx`, `src/components/game/game-scenes.ts`, `src/components/game/score-entry-overlay.tsx`, `src/components/game/vote-overlay.tsx` if present, `src/styles.css` for touch-action/overscroll rules, `src/routes/tool.tsx` and `src/routes/embed.tsx` for page-level scroll locking.
- No gameplay constants (physics, difficulty, scoring, par times, zone content) change.
- Desktop path is guarded: all new behavior is behind the touch branch of the device profile.
