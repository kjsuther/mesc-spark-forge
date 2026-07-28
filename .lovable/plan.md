## Goal

Keep the current map artwork exactly as is. Rework the animated overlay in the "THE TRAIL AHEAD" screen so the animated line traces the trail actually painted on that image and its stops land on the printed 1–8 markers.

## Current problem

The overlay in `TrailMap` (`src/components/game/game-canvas.tsx`) places 8 nodes on a math-generated sine wave evenly spread left→right, then draws straight dashed lines between them. That geometry has nothing to do with the artwork, so colored dots land in trees/water and the lines cut across the map.

## Approach

1. **Measure the artwork once.** The background is 1280×640 (2:1), and the SVG overlay already uses a `0 0 800 400` viewBox with `background-size: cover` on a fixed `aspect-[2/1]` frame, so image pixels map 1:1 to viewBox units. Traced marker centers (viewBox units):

   ```text
   1 (92,275)  2 (163,192)  3 (261,213)  4 (383,138)
   5 (333,268) 6 (570,299)  7 (638,193)  8 (726,193)
   ```

2. **Hand-author the path.** Replace the generated line segments with a single SVG `<path>` of cubic bezier segments running 1→2→3→4→5→6→7→8, with control points tuned to hug the painted dashed trail (dips around the bridge at 3, the loop up to the farmhouse at 4 and back down to 5, the long curve past the mountain tunnel to 6).

3. **Animate the draw, not the dots.** Use `getTotalLength()` on the path with `stroke-dasharray`/`stroke-dashoffset` so the highlight line draws smoothly along the trail. A small traveling marker (hero-colored dot with pixel outline) rides the path via `getPointAtLength()`.

4. **Stops read as highlights, not new pins.** Instead of drawing opaque colored circles over the printed numbers, each stop gets a pulsing gold ring + soft glow centered on the printed marker, activated as the line reaches it. Numbers stay legible.

5. **Caption sync.** The existing bottom caption keeps updating to the current stop's label; add a dark plaque behind it for the same readability treatment used elsewhere in the game.

6. **Scaling safety.** Frame stays `aspect-[2/1]` with `background-size: 100% 100%` (instead of `cover`) so the image can never crop and de-sync from the overlay at any container width; the SVG keeps `preserveAspectRatio="none"` matched to that.

## Technical notes

- Only `src/components/game/game-canvas.tsx` (the `TrailMap` component) changes. No asset changes; `trail-map-terrain.png` is not used.
- Animation driven by a `requestAnimationFrame` progress value (0→1) rather than the current 60ms interval tick, for a smooth draw; respects reduced-motion by snapping to full path.
- Verification: run the intro flow in the preview at desktop and mobile widths and screenshot the map screen to confirm the animated line sits on the painted trail and rings land on stops 1–8.
