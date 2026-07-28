## Problem

The Poster View embeds `/tool/embed`, but that page still renders extra UI from the shared game component:

- a keyboard hint line under the canvas ("← → to move · Space / ↑ to jump · R to reset · ⛶ for fullscreen")
- a "⛶ Full" toggle button in the corner
- the canvas is centered at a fixed 16:9 box inside a `grid place-items-center` wrapper, so it letterboxes instead of filling the projected area

## Fix

1. **`src/components/game/game-canvas.tsx`** — add an optional `presentation` (embed) prop:
   - hides the desktop keyboard hint text
   - hides the "⛶ Full" fullscreen button (irrelevant when already projected)
   - drops the rounded corners/ring border and makes the canvas wrapper fill 100% of its parent's width and height
   - keeps all gameplay, HUD, title/win screens, and touch controls untouched

2. **`src/routes/tool.embed.tsx`** — render the canvas in presentation mode inside a `w-screen h-screen` black container with no padding, so the game fills the iframe edge to edge.

3. **`src/routes/admin.poster.tsx`** — ensure the iframe panel has no inner padding/borders that shrink the game, so the left panel is purely the game.

## Verification

Drive the live app with a headless browser as an admin viewing `/admin/poster`, and screenshot it to confirm the left panel shows only the game canvas filling the panel — no hint text, no fullscreen button, no site chrome — plus a screenshot of `/tool/embed` on its own.
