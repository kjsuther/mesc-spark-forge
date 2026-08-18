# Spanish support, a secret Portland bonus level, and Zone 2 fixes

Six changes, all inside the game. Website pages stay English.

## 1. English / Español

- New central dictionary (`src/lib/i18n.ts`) holding every player-facing string as an id with English and Spanish text: title and menu, controls screen, journey map, all eight step/briefing screens, HUD (score, time, lives, objectives), collectible and enemy labels, power-up names and descriptions, pause text, hint plaques, game-over and victory text, the thank-you screen, name entry, and all new bonus-level and 1-UP text.
- Every hard-coded string in the game engine and the game overlays is replaced by a lookup. Spanish is written to read naturally to a native speaker, not word-for-word — and kept short enough to fit the existing plaques, with wrapping verified at both windowed and fullscreen sizes.
- A clear **ENGLISH / ESPAÑOL** toggle on the title screen, styled in the same 16-bit button language. The choice is remembered on the device and applies to the whole run.
- Acceptance check: play through in Spanish and confirm no English leaks anywhere the player can see.

## 2. Secret Portland bonus level (Zone 2 → bonus → Zone 3)

- The existing Zone 2 gap becomes the secret entrance. Falling into it no longer costs a life; instead a brief 16-bit "¡SECRETO! / SECRET FOUND!" flash and a warp chime play, the screen wipes, and the player drops into the bonus stage.
- The bonus stage is a hidden pocket of the world (built off the main trail), so entry and exit are instant scene-free warps — no separate loading and no way to get stuck.
- No enemies, no hazards, no death plane: a short, generous, highly collectible run. A timer-free exit portal at the end warps the player straight to the start of Zone 3 with score and lives intact. Standing still or backtracking still lets them reach the exit.
- The ordinary route is untouched: skip the gap and Zone 2's door leads to Zone 3 exactly as today. Only that one gap triggers the secret; every other pit stays lethal.

**Art (all new pixel art, drawn to match the existing zones):**
- Backdrop: the iconic white-outlined "PORTLAND OREGON" sign with the leaping stag and neon glow, a Willamette riverfront with a bridge silhouette, a compact skyline, and Douglas fir treeline — limited palette, crisp edges, parallax layers like the other zones.
- Foreground: food-cart pod row, lamp posts, and river planks used as platforms.
- Collectibles: coffee cups, donuts, and food-cart snacks with a pop animation, coin-style chime, and floating score numbers.

## 3. Zone 2 laptops

Remove the decorative laptops that sit on the player's running lane. Other Zone 2 scenery (signage, camp props, backdrop detail) stays, with a couple of the removed laptops re-placed well behind the play plane so the zone keeps its density without reading as an obstacle.

## 4. Lock placement at the end of Zone 2

Rebalance the pair around the end gap to **two locks left, one lock right**, with the right-hand lock's patrol shortened so there is clear landing room on the far ledge. Verified against the current jump arc: the crossing stays challenging but is reliably makeable.

## 5. Extra lives

- A 16-bit **1-UP** collectible (a small pixel heart/application badge in the existing HUD style) appears at a hidden-but-reachable spot in a few zones and several times in the bonus level.
- Collecting it: +1 life, a distinct jingle, the HUD life row updating, and a brief "+1 LIFE / +1 VIDA" pop.
- Capped at the existing maximum life count so it can't be farmed; bonus-level 1-UPs are limited so the stage rewards recovery without erasing the challenge.

## 6. Feedback and game feel

All new events reuse the existing sound and visual language: score pops on pickup, a subtle sparkle when the secret gap is entered, a wipe transition in and out of the bonus stage, and the life notification. No new persistent HUD clutter.

## Verification

Playwright and manual passes on desktop: full run in English and in Spanish; Zone 2 normal route to Zone 3; secret gap entry, bonus completion, and arrival in Zone 3; life gain and cap; score increments; no console errors; controls, pause, score entry and feedback links all still working.

## Technical notes

- Files touched: `src/lib/i18n.ts` (new), `src/components/game/game-scenes.ts` (bonus area, Zone 2 layout, 1-UP, all strings), `src/components/game/game-canvas.tsx` (language toggle on title, string lookups), the score/vote overlays for their strings, plus new pixel-art assets under `src/assets/game/`.
- No change to scoring formulas, par times, zone order, or any other zone's content.
