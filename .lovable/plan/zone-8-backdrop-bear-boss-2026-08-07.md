# Zone 8 backdrop + bear boss

## What changes

**Zone 8 background (Coverage Begins)**

- Add a Portland, Oregon skyline into the existing 16-bit clinic backdrop: recognizable downtown towers, a bridge silhouette across the river, and Mt. Hood on the horizon, all kept in the current muted pixel palette so it reads as background, not foreground clutter.
- Add a yellow pennant flag on a pole at the very top of the hospital building.
- Same image size (1280x426) and same file path, so no code changes are needed and both the Current Version and Original Version pick it up automatically.

Show the proposed image before moving on and require approval of the drafted replacement image

**Boss redesign**

- Replace the green paperwork ogre with a mean-looking brown bear wearing a red scarf: snarling muzzle, bared teeth, angry brow, 16-bit SNES shading.
- Rebuild the existing 3-frame boss sheet in place (same 1536x512 sheet, 3 columns):
  1. idle — bear standing tall, menacing
  2. hurt — same bear flinching, red flash tint
  3. defeat — the shrunken, deflated bear (matches the current "gets small" beat, which is driven by the shorter defeat-frame height already configured in code)
- No gameplay changes: hop cadence, projectile pattern, 3-hit health, hearts HUD, and the shrink-then-poof defeat sequence all stay exactly as they are.

## Technical notes

- Files replaced in place: `src/assets/game/bg-clinic.png`, `src/assets/game/boss-sheet.png`.
- `DISPLAY_H` entries (`boss-idle` 96, `boss-hurt` 96, `boss-defeat` 54) stay unchanged — the defeat frame's smaller draw height is what produces the shrink.
- `src/components/game/original/game-scenes.ts` imports the same assets, so the frozen baseline build inherits the new art with no edits.
- Verification: load `/tool`, reach Zone 8, and confirm the skyline, flag, bear idle/hurt/defeat frames, and that ground alignment of the boss sprite is unchanged.