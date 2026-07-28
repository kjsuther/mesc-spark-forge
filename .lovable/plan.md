## Problem

In the "★ THE TRAIL AHEAD ★" screen (the `TrailMap` component in `src/components/game/game-canvas.tsx`), the animated dashed line and the 8 numbered stops are generated mathematically — evenly spaced across the width with a sine-wave vertical offset. They have no relationship to the winding trail and numbered stops painted into the parchment background image (`trail-map-bg-v2.png`). The background is also drawn with `background-size: cover`, so it gets cropped differently at every screen size, which would break any alignment even if the coordinates matched today.

## Fix

Make the drawn trail the single source of truth so the two can never disagree:

1. **New background art** — generate a parchment/adventure-map background with terrain only (forest, river, mountains, coast, compass rose, decorative border) and **no painted trail or numbered stops**. This becomes the canvas the animation draws on.

2. **Rewrite the trail rendering in `TrailMap`**
   - Replace the straight sine-spaced line segments with a single hand-authored curved path (SVG cubic bezier) through 8 fixed waypoints laid out over the map's terrain — starting bottom-left, winding through forest and across the river, up over the mountains, ending top-right at "Coverage Begins!".
   - Animate the trail with the dash-offset technique (`stroke-dasharray` / `stroke-dashoffset`) so the dashed path draws itself smoothly along the curve instead of popping in per segment.
   - Numbered stop pins sit exactly on the path waypoints and pop in as the drawing reaches each one; the label caption below keeps updating to the current stop.

3. **Lock the coordinate space** — switch the background to `background-size: 100% 100%` inside the fixed `aspect-[2/1]` frame and use the same `0 0 800 400` viewBox for the SVG, so image pixels and SVG coordinates map 1:1 at every screen size and on mobile.

4. Respect reduced motion (show the completed trail immediately) and keep the existing "▶ Begin Journey" / "Back" buttons unchanged.

## Verification

Drive the live app with a headless browser on both desktop and a narrow mobile viewport, step to the Trail Map screen, and capture screenshots mid-animation and at completion to confirm the trail and pins sit on the map terrain and line up identically at both sizes.
