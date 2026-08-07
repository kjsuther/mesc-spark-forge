# Zone 2 bear placement + heart lives icons

## 1. Bear walks up by the campfire

Right now the bear patrols along the player's ground line, so he reads as being on the trail with the hero instead of back at the camp. Move him up onto the campsite terrace shown in the reference arrow — the grassy strip that runs past the boulder, lantern post, and campfire — and make him noticeably bigger so he's clearly the same bear who shows up as the Zone 7 boss.

- Raise his walking line to the camp terrace (roughly 80 px above the player's ground).
- Increase his size so he reads at a glance at that distance.
- Keep the existing behavior: pace left and right, pause to look around, pause to sniff, then keep hunting.
- Keep him behind the gameplay layer so he never blocks the player, signposts, or pickups.

## 2. Lives shown as hearts

The HUD currently draws small paper "application" cards for remaining lives, which isn't readable as health. Replace them with classic 16-bit pixel hearts: filled red heart for each life remaining, dimmed outline heart for lives you've lost (so the max-lives row still reads correctly with the extra-lives upgrade). Same position, same spacing, same count logic.

## Technical notes

- `src/components/game/game-scenes.ts`: adjust `bearGroundY` / `bearScale` in the Zone 2 cameo block; replace the `appIcons` rect-card HUD with a pixel-heart builder and update `updateHud()` to dim rather than hide spent hearts.
- Mirror only the heart HUD change into `src/components/game/original/game-scenes.ts` (readability fix); the bear cameo stays exclusive to the Current Version.
- Verify by playing into Zone 2 in a windowed (non-fullscreen) canvas and confirming the bear walks along the campfire terrace and the heart row updates on hit.
