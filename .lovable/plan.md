## 1. Fix fire-pole slide animation (Zone 8)

The current `hero-slide-sheet.png` was generated separately and rendered as a different-looking, more 8-bit character than the in-game hero. Replace it so the existing 16-bit hero appears to grip and slide the pole.

- Regenerate `src/assets/game/hero-slide-sheet.png` via `imagegen--edit_image`, using the existing `character-sheet.png` (right-facing idle) as the source image reference so the palette, proportions, hair, overalls, and outline exactly match. Prompt describes a 2-frame pose: arms overhead gripping a vertical pole, body centered on the pole, alternating leg positions (frame 0 knees together, frame 1 legs offset for descent motion) — mirroring the pose in the user's reference image but rendered in the game's current 16-bit SNES style, not 8-bit NES style.
- Keep the sheet at the existing 2-column × 1-row layout and 66-px display height so the existing `safeLoadSheet` registration in `game-scenes.ts` (lines 504-562) needs no changes.
- After regeneration, run Playwright UAT on Zone 8: force-advance to the fire pole, verify the sprite that plays during descent visually matches the hero used everywhere else in the game. Screenshot at desktop 1280×1800 and mobile 844×390.

## 2. Ensure the gold key spawns for every plan choice (Zone 7)

Audit the `plan-pick` collision handler in `game-scenes.ts` (~lines 1760-1793): the key spawn currently reads `item.pos` immediately before the `k.get("plan-pick").forEach(destroy)` loop, but under some timings the collided pedestal can already be gone or `zoneState.planPicked` can short-circuit before the spawn. Guarantee:

- Capture `kx`/`ky` from the collided pedestal FIRST, then set `zoneState.planPicked = true`, then destroy the other pedestals by tag-filtering out the collided one explicitly (compare object identity), then spawn the key from the captured coords.
- Add a defensive fallback: if for any reason no key entity exists 200 ms after `planPicked` becomes true, spawn one at the last known pedestal position so the objective can never soft-lock.
- Verify with Playwright by picking each of the three plans in separate runs (Medical Assistance, MinnesotaCare, Private Plan) and confirming the gold key appears and homes to the player every time.

## 3. Make Zone 5 countdown timer prominent

Today the 30 s wait shows only inside the small HUD chip via `zoneObjectives[5].hudLabel` (~line 1187), which is easy to miss.

- Add a dedicated big countdown display that only renders while the player is inside Zone 5 (`Math.floor(player.pos.x / BIOME_W) === 5`) and `zoneState.waitStart > 0`.
- Anchor it top-center of the visible viewport (fixed to the camera, using the existing `fixed()` HUD pattern), around y ≈ 36 px, with `pixelLabel` at size ~28, high-contrast white fill on a dark rounded backdrop, showing `0:SS` and a short label like `AWAITING DECISION`.
- When the timer hits 0, briefly flash the display to `APPROVED!` in green for ~1 s before Zone 5 completes, then hide it.
- Verify with Playwright: force-warp into Zone 5, confirm the big timer is visible at top-center on both desktop and mobile viewports, counts down, and disappears after approval.

## Technical notes

- Files touched: `src/components/game/game-scenes.ts` (plan-pick handler, Zone 5 HUD overlay, no changes needed to slide anim wiring).
- Regenerated asset: `src/assets/game/hero-slide-sheet.png` (same dimensions, same `.asset.json` pointer).
- No schema, route, or server changes.
- Final UAT: Playwright at 1280×1800 desktop and 844×390 mobile-landscape covering (a) Zone 7 with each plan pick, (b) Zone 5 timer visibility and countdown, (c) Zone 8 fire-pole slide sprite parity with the rest of the game.
