# Sharper Zone 4 / Zone 7 art and crisp in-game text

## What's actually wrong

Confirmed by inspecting the files and rendering setup:

- **Zone 4 (`bg-town`) and Zone 7 (`bg-market`)** carry roughly 2-3x the fine-detail noise of every other backdrop (measured horizontal detail: town 22.3, market 16.6 vs forest/mountain 7.5, river 5.5). They were regenerated in a painterly, dithered style when the Portland skyline was added, so they read as grainy next to the flat, clean 16-bit look of the other six zones. No amount of filtering fixes that — the art itself is the wrong style.
- **Text is soft** because the game canvas draws at a low internal resolution and is then blown up by the browser with nearest-neighbour upscaling (`image-rendering: pixelated`). Glyphs get resampled after they're drawn, so edges go chunky and fuzzy — worst in windowed mode, which is exactly where you're seeing it.
- **Labels crowd their icons** on the step/briefing screens: caption text sits directly beneath each icon with a fixed gap that doesn't grow when text scales up.

## The fixes

### 1. Rebuild Zone 4 and Zone 7 backdrops
Regenerate both at the same 1280x426 size, matching the flat, clean, high-contrast 16-bit style of the other six zones: crisp shapes, flat colour blocks, no painterly grain, no dithering. Same composition and content as today — Zone 4 keeps its town and notice board, Zone 7 keeps its market stalls, and both keep the distant Portland skyline with the yellow hospital flag. Detail-noise will be measured against the other zones after regeneration so they sit in the same range.

You'll get to approve the two new backdrops before they're swapped in.

### 2. Make all text crisp
- Render the canvas at its true on-screen resolution (actual CSS size x device pixel ratio) instead of a fixed low-resolution buffer that gets upscaled.
- Stop nearest-neighbour upscaling the canvas, so glyph edges are drawn sharp rather than stretched after the fact. Sprite art stays pixel-crisp through the engine's own crisp rendering.
- Re-check the HUD, help plaques, step screens, pause card, boss health, and end screens at: desktop windowed, desktop fullscreen, phone portrait, and phone landscape fullscreen.

### 3. Breathing room around icons
Give icon captions on the step/briefing screens padding that scales with the text size, so wording never sits tight against the icon or against the neighbouring column. Same for the Zone 1 method plaques and the Navigator name card.

## Technical notes

- `computePixelDensity()` in `game-scenes.ts` currently rounds to half-steps and caps at 2x; it will instead derive an exact device-pixel-accurate scale from the live canvas rect, recomputed on resize/fullscreen.
- Remove `imageRendering: "pixelated"` from the canvas element wrappers in `game-canvas.tsx` (kept where it's genuinely scaling sprite images, e.g. the score-entry overlay chrome).
- Caption gaps in `showStepScreen` and the plaque helpers switch from fixed pixel offsets to offsets multiplied by `UI_TEXT_SCALE`.
- All changes mirrored into `src/components/game/original/game-scenes.ts` so the Original Version stays in sync.
- Backgrounds replaced in place under `src/assets/game/`; no code change needed since both builds share the paths.
- No gameplay, scoring, database, or layout changes.
