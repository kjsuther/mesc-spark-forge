# Bear placement, endgame order, harder Zone 6 and boss

## 1. Bear sightings sit where the backdrop supports them (Zones 1-6)

Each zone's backdrop gets reviewed at full size, the bear anchored to a real object in that art, and scaled up so he's easy to spot and clearly foreshadows the Zone 7 boss.

| Zone | Anchor in the art | Beat |
| --- | --- | --- |
| 1 Trailhead Forest | Draped along an actual painted pine limb | Limb sway, paws hanging |
| 2 Setting Up Camp | Directly behind the "Look Out for Bears!" signboard | Pops up over the sign, ducks, pops up again |
| 3 Plan Rapids | On the far riverbank where it meets the water | Head dips to drink, snaps up alert |
| 4 Gathering Supplies | In a real gap between two painted buildings | Leans out of the gap, pulls back |
| 5 Relay Ridge | On the painted hill crest line | Rears into silhouette, drops away |
| 6 Awaiting Decision | Half-behind a distant trunk in the storm haze | Slow lean out, head turn, back into the haze |

Sizes go up roughly 60-80% from today, with haze/opacity raised slightly so he stays background art but is unmistakable. Still no collision, no damage.

## 2. High score / suggestion screen waits for the Thank You screen

Today the score-entry overlay opens the moment the win fires, so it lands on top of the WIN card and the Thank You cutscene. It moves to the end: win card, then Thank You screen, and only when the player presses Continue does the score entry / feedback prompt appear.

## 3. Zone 7 cinematic plays once

The bear currently charges in twice — once as the post-plan cinematic and again when the READY card is dismissed. The duplicate entrance is removed. Final order: pick a plan, cinematic charge-in, READY card, fight. Never before plan selection, never twice.

## 4. Zone 6 harder

More pages in flight, shorter gaps between drops, faster fall speed, and full-width coverage so there's no safe lane. Telegraph markers stay so it remains fair.

## 5. Boss battle harder

- Faster and more frequent jumps, shorter landing recovery.
- Faster projectiles, fired in short bursts on the way up and down of each jump.
- Shorter gap between attack cycles and a rage phase at low health.
- Hit count stays at 6 so the fight still ends on the same beat.

## Technical notes

- `src/components/game/game-scenes.ts`: retune `BEAR_SIGHTINGS` entries (x, rise, scale, opacity) against measured backdrop features; remove the `playBossEntrance(onReady)` call from `showBossReadyPrompt`'s close so only `playBossCinematic` runs; bump `CAL_COUNT` / `CAL_MIN_GAP` / fall speed / spawn range; tighten boss jump and projectile constants and add a low-HP rage multiplier.
- Deferred score entry: `tryWin()` stops calling `opts.onWin` directly; the result is held and fired from the `thanks` scene's continue handler, wired through `src/components/game/game-canvas.tsx`.
- Current Version only for bear/difficulty; the endgame ordering fix also applies to `src/components/game/original/game-scenes.ts` since it is a flow bug.
- No database or schema changes.
