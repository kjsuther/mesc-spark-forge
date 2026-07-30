## Problem

On the Thank You screen the speech bubble is a fixed 145px tall box (`src/components/game/game-scenes.ts`, `k.scene("thanks")`, and the mirrored copy in `src/components/game/original/game-scenes.ts`), but the message is 8 lines of 15px text with 4px line spacing — roughly 155-170px tall. The text overflows past the cream panel, so the last lines sit on the night sky and the block reads as cut off. On short/landscape phone canvases it's worse, because the bubble also competes with the logo stack and the continue prompt for vertical space.

## Fix

1. **Measure, then draw.** Add the text object first, read its rendered `height`/`width`, and build the cream panel + black border rect around those measurements with fixed padding (about 16px vertical, 14px horizontal). No more hardcoded `bh = 145`.
2. **Fit to the canvas.** Choose the font size from available height: start at 17px on roomy canvases, step down (16 → 15 → 14) only if the measured block plus logos plus the continue prompt would exceed the canvas height. Never go below 14px.
3. **Tighten the copy slightly** so it wraps to fewer lines while keeping the same meaning and the required closing line:

   "Thanks for blazing the trail with me!
   Every idea you share makes the next journey smoother.

   If this ride made you smile, vote for our poster session!

   Have a great time at MESC 2026!"
4. **Re-flow what's below.** Recompute the logo stack top and the bubble tail from the real bubble bottom instead of the old constant, and shrink the MESC/DHS badges proportionally when remaining height is tight, so nothing overlaps the continue prompt.
5. **Center the block** vertically between the top margin and the logo stack so it looks deliberate on both tall and short viewports.

## Verification

Render the thanks scene at a few canvas sizes (desktop wide, mobile landscape short, mobile portrait) via a browser check and screenshot the panel to confirm every line sits inside the cream box with clear margins.

## Technical notes

- Files touched: `src/components/game/game-scenes.ts` and `src/components/game/original/game-scenes.ts` (identical change, keeping the frozen original build visually in sync).
- No backend, route, or data changes.
