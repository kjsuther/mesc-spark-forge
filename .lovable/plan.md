## 1. Controls screen — show only the player's device

In `ControlsScreen` (`src/components/game/game-canvas.tsx`), the existing coarse-pointer detection already runs but both columns always render. Change it to render a single column: mobile controls when `(pointer: coarse)` matches, desktop controls otherwise. Drop the "active/inactive" styling since only one column shows, widen it to full panel width, and label the heading accordingly ("DESKTOP / LAPTOP" vs "MOBILE"). Keep the same 16-bit frame, the closing tip line, and the Start Run / Back buttons.

## 2. Thank-you screen copy

In both `src/components/game/game-scenes.ts` and `src/components/game/original/game-scenes.ts` (the frozen original build), change the speech bubble text to:

"Thank you for helping make my journey easier.
Every fix you suggest makes the journey easier.

Have a great time at MESC 2026!"

Since the first line and the replacement now repeat "makes the journey easier", the bubble will read:
"Thank you for playing. Every fix you suggest makes the journey easier. Have a great time at MESC 2026!" — same message, no duplicated phrase. Bubble height/width adjusts for the shorter text.

## 3. MN DHS 16-bit logo on the Thank You screen

- Generate a 16-bit / pixel-art version of the Minnesota DHS logo (from the uploaded image: white "Minnesota Department of Human Services" wordmark with the green mark) as a new asset `src/assets/game/mn-dhs-logo-16bit.png`, rendered on a solid opaque panel (not transparent) with full color.
- Load it alongside the MESC badge in both game-scene files.
- Place it on the thank-you scene under/next to the MESC 2026 badge on the right side, sized to fit, drawn on an opaque backing rectangle so nothing shows through.

## 4. Readable instructional pause screens

In the `showStepScreen` panel of both game-scene files, the text currently uses small 13–17px sizes scaled by viewport. Changes:
- Increase base sizes: title 17→24, subtitle 13→17, body lines 15→19, icon captions 9→12, continue prompt 13→16.
- Enforce a minimum on-screen size so text never shrinks below readable on small phones (floor the scaled size, e.g. `max(scaled, 14px)` for body).
- Increase line spacing and panel padding, and grow the panel max height so the larger text still fits; body text wraps within the wider inner width.
- Keep the navy/gold panel styling but use the clean `sans-serif` font already in use (not pixel font) for all instructional copy so it stays crisp.

## Technical notes

- Files touched: `src/components/game/game-canvas.tsx`, `src/components/game/game-scenes.ts`, `src/components/game/original/game-scenes.ts`, plus one new generated image asset.
- No backend, data, or route changes.
