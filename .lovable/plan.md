# Mobile Fullscreen Overhaul + Zone 6 / Boss Difficulty

## What I found (verified in code)

- The game renders into a fixed 960×540 buffer with the engine's `letterbox: true` mode (`src/components/game/game-scenes.ts`, lines ~101-110, ~890-906).
- The engine **overwrites the canvas inline style** on init (`style.cssText = "...width:100%;height:100%"`), so the React-set `aspectRatio`/`objectFit: contain` on the canvas in `game-canvas.tsx` is discarded — sizing is entirely driven by the canvas's parent box.
- The engine's resize handler contains an early `if (app.isFullscreen()) return;` — **while the browser is in native fullscreen, the canvas backing buffer is never recomputed**. It stays at whatever size the canvas had before fullscreen was entered. This is the direct cause of "small game with large margins" after pressing Full Screen.
- On phones, launching already flips into a faux-fullscreen fixed overlay (`pickMode`), but the canvas parent is `100vw × 100dvh`, and 960×540 (16:9) letterboxed into a 19.5:9 phone leaves permanent side bars.
- Touch pads and the Exit button already use `env(safe-area-inset-*)`, but only for left/right/bottom/top-right — the canvas itself ignores safe areas.

## Changes

### 1. Fix fullscreen canvas resizing (root cause)
- Add a `useLayoutEffect`-driven resize controller in `game-canvas.tsx` that owns canvas element sizing: on mount, `resize`, `orientationchange`, `fullscreenchange`, `visualViewport` resize, and a `ResizeObserver` on the wrapper.
- Since the engine skips its own resize while in native fullscreen, the controller will explicitly set `canvas.width/height` (backing store) and re-trigger the engine's viewport recalculation by dispatching a synthetic resize after briefly leaving/refreshing the size, or by setting the canvas box then forcing a `window.dispatchEvent(new Event("resize"))` while temporarily not in the engine's fullscreen state path. If the engine still refuses, fall back to preferring **faux fullscreen** (fixed overlay, no browser fullscreen API) on touch devices, which the engine resizes normally — this is already the default path on coarse pointers and will become the canonical mobile path.
- Debounce/rAF-coalesce resizes so no flicker or frame drops.

### 2. Landscape-adaptive logical viewport (kills black bars)
- Replace fixed `LOGICAL_W = 960` with a computed view width: keep height locked at 540 (so all vertical layout, ground plane, and sprite scale are untouched) and derive width from the device aspect ratio, clamped to 960–1200.
- Effect: on a 19.5:9 phone the player simply sees slightly more trail horizontally instead of black bars. No gameplay values change; camera clamp at line ~3620 switches from the `LOGICAL_W` constant to the computed view width, and all HUD already uses `k.width()`/`k.height()`.
- Desktop keeps 960×540 exactly (aspect ≈ 16:9 → clamp resolves to 960), so no desktop regression.

### 3. Full-bleed layout and safe areas
- Fullscreen wrapper: `100dvw × 100dvh`, zero padding/margins, `background: #000`, with `padding` from `env(safe-area-inset-*)` applied only to the *UI overlay layer* (Exit button, pads, hint text) — the canvas itself goes edge to edge so no display area is wasted.
- Remove the redundant `aspectRatio`/`objectFit` styles that the engine wipes anyway, and let the wrapper be the single source of truth.

### 4. Readability and touch targets in fullscreen
- Scale menu/pause/instruction overlays with viewport-relative clamps (`clamp()` font sizes keyed off `svh`) so title, story, controls, zone step screens, score entry, and end screens stay legible and never clip in short landscape viewports; add internal scroll only as a last resort.
- Bump touch pad sizes on small landscape heights (D-pad 72→ responsive 64-88, JUMP 92→ responsive 80-104) and keep them anchored inside safe areas.
- Keep `image-rendering: pixelated` and integer-snapped positions so pixel art stays sharp.

### 5. Fullscreen persistence
- Persist the fullscreen intent in state; on `fullscreenchange` exit that wasn't user-initiated, fall back to the faux-fullscreen overlay instead of dropping to the page layout.
- Re-run the resize controller after every scene change (level load, death, restart, boss, menus) by resizing on the engine's scene transitions as well as DOM events.

### 6. Zone 6 harder (`game-scenes.ts`, current build only)
- Calendar page fall speed `230 → 340`.
- `CAL_MIN_GAP` `0.85 → 0.5`; telegraph `0.5 → 0.35`; rearm delay window `0.2-1.8 → 0.15-0.9`.
- Keep the "never drop directly on the player" safety so it stays fair.

### 7. Boss harder (`game-scenes.ts`, current build only)
- Hop cooldown `3.2 + rand(1.8)` → `1.5 + rand(0.9)`.
- Shot cooldown roughly halved; projectile speed `210 → 300`.
- Projectiles live long enough (and are not culled early) to travel the full zone width, so the player must actively dodge or shoot them down rather than out-walk them.
- Boss still requires exactly 3 "+" hits; the 0.9s post-hit invulnerability stays.

The frozen "Before Feedback" build (`src/components/game/original/`) receives the fullscreen/layout fixes only — its difficulty stays as-is, since it represents the pre-feedback version.

## Testing
Automated headless-browser passes at iPhone Mini, iPhone Pro Max, Pixel, and small-tablet landscape viewports (plus a desktop regression pass): launch → fullscreen → confirm the canvas fills the viewport with no dead margin, step screens readable, pads inside safe areas, then play through a zone transition, a death/restart, and the boss fight, capturing screenshots at each step.

## Technical notes
Files touched: `src/components/game/game-canvas.tsx` (layout/fullscreen/resize/UI scaling), `src/components/game/game-scenes.ts` (dynamic view width, Zone 6, boss), `src/components/game/original/game-scenes.ts` (dynamic view width only).
