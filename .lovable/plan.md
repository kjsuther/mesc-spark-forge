## 1. Remove the pole from the slide sprite

The current `src/assets/game/hero-slide-sheet.png` bakes a yellow pole down the middle of both frames. When the sprite plays it double-draws the pole on top of the real in-scene pole. Regenerate the sheet via `imagegen--edit_image` from the existing file with `transparent_background: true`, prompting for the same 2-frame character-on-pole poses but with the pole removed — only the character (arms up gripping an invisible pole, alternating leg positions) on a transparent PNG. Keep the same file path, dimensions, and 66-px display height so no code changes are needed for asset wiring.

## 2. Attach at the knob, then slide the entire pole

Today the `fire-pole` trigger is a tall column that spans `poleTop → poleBaseY`, so the slide starts wherever the player first brushes the pole. Change Zone 8 in `src/components/game/game-scenes.ts` so touching the pole always plays the full Mario-flagpole slide from the top knob down:

- Replace the tall column trigger with the same tall area but on attach:
  - Snap `player.pos.x = poleX` (already done) AND `player.pos.y = poleTop + <small offset>` so the character starts at the knob.
  - Zero velocity, disable input, set `firePoleAttached = true`.
- Keep the existing per-frame descent (`player.pos.y += 220 * dt`) so the character slides the full pole length to `GROUND_Y`, then triggers `firePoleDone` + fireworks at the base (existing safety-net stays).
- Ensure the character sprite anchors so the hands appear at the knob at attach (visually correct start), and the feet reach the ground at the end (existing `anchor("bot")` handles this).
- After the base is reached, briefly swap back to `hero-idle` for the celebration pose (already implicit — `firePoleAttached` becomes false via `firePoleDone` gate in the anim state machine — verify it does).

## 3. Verify

Playwright UAT at 1280×1800 desktop and 844×390 mobile-landscape: force-advance to Zone 8, collect the Medical ID, touch the pole at various heights (mid-air jump, walking into the base, jumping onto the knob) and confirm every attach snaps the character to the knob, slides them down the full pole, and shows only the character over the yellow pole (no doubled sprite pole). Screenshot mid-slide and at the base.

## Technical notes

- Files touched: `src/components/game/game-scenes.ts` (Zone 8 fire-pole attach handler ~line 1896), regenerated `src/assets/game/hero-slide-sheet.png` (transparent PNG, same dimensions).
- No schema, route, or server changes.
