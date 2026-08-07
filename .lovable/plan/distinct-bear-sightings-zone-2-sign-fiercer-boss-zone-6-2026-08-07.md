# Distinct bear sightings, Zone 2 sign, fiercer boss + Zone 6

## 1. A different bear moment in every zone (1-6)

Today all six sightings run the same script: fade in, sniff/look or slow drift, fade out — only the position and tint change. Each zone gets its own behavior and its own spot, chosen to match what that backdrop actually shows.

| Zone | Where | What he does |
| --- | --- | --- |
| 1 Trailhead Forest | Draped along a high pine limb | Lies on the branch, paws hanging, head swings side to side, tail/leg sway |
| 2 Setting Up Camp | Behind the campsite sign / brush | Pops head up over the sign, ducks, pops up on the other side |
| 3 Plan Rapids | Far riverbank, at the water | Crouches, dips head to drink, snaps head up alert, holds, sinks away |
| 4 Gathering Supplies | Distant alley gap between buildings | Nose-first peek around the corner, pulls back, then a quick full cross |
| 5 Relay Ridge | Painted hill crest | Rises into silhouette, rears up on hind legs, drops back below the ridge |
| 6 Awaiting Decision | Storm haze behind distant trees | Half-body behind a trunk, slow lean out, head turn, lean back into the haze |

New pose frames are added to the bear sheet in the same 16-bit style so these read correctly: hanging-on-limb, drinking/head-down, reared-up, corner-nose-peek, and a behind-trunk lean pose. No drawn platforms, no ledges — everything stays on the background layer with zone haze/scale, no collision.

## 2. Zone 2 sign reads "Look Out for Bears!"

The Zone 2 backdrop is repainted so the campsite signboard carries the text "Look Out for Bears!" in the game's 16-bit signage lettering. Everything else in the art stays identical.

## 3. Boss music hits harder

The Zone 7 battle theme gets rebuilt to feel more intense: faster tempo, driving low-end pulse on every beat, heavier snare/kick pattern, a snarling detuned lead, and a short rising sting at the moment the fight starts. Exploration themes are untouched.

## 4. Zone 6 is harsher

Calendar pages fall faster, drop more often, and cover the whole zone instead of the current middle band — with more pages in flight at once. The short telegraph marker before each drop stays so it remains fair.

## 5. Bear boss fight is harder

- Faster, more frequent jumps with less recovery time on landing.
- Projectiles fly faster and are fired in bursts from varied heights on the way up and down.
- Shorter window between attack cycles, and a rage phase at low health where the pattern speeds up further.
- Hit count stays at 5 so the fight still ends on the same beat.

## Technical notes

- `src/components/game/game-scenes.ts`: replace the single shared sighting script in the `BEAR_SIGHTINGS` block with per-zone beat types (`limb`, `sign-peek`, `drink`, `corner-peek`, `rear-up`, `trunk-lean`); add the new frames to `src/assets/game/bear-scout-sheet.png` and register them in the sprite loader.
- `src/assets/game/bg-signup.png` repainted in place with the sign text.
- `src/lib/game-music.ts`: rewrite the `boss` theme entry (tempo, drums, lead, volume) plus an entry sting.
- Zone 6 tuning constants (`CAL_COUNT`, `CAL_MIN_GAP`, `CAL_L`/`CAL_R`, fall speed) and the boss jump/projectile constants in the Zone 7 block.
- Current Version only — `src/components/game/original/game-scenes.ts` stays the frozen baseline, except it inherits the repainted Zone 2 backdrop since art is shared.
- No database or schema changes.
