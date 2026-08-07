# Bear cameo redesign, boss timing, Thank You backdrop

## 1. Remove the bear shelves in Zones 1-6, redesign the sightings (mockups first)

Today each cameo draws a solid colored shelf (a "platform") under the bear so he has something to walk on. That reads as a gameplay platform floating in the sky — exactly what image 1 shows. Those drawn shelves get deleted entirely, along with the walking patrol that needed them.

Replacement approach: instead of a walking bear on invented terrain, each zone gets a **single, short, stationary sighting** placed on terrain that already exists in that zone's painted backdrop, hazed and scaled to the backdrop depth so he reads as part of the art.

Proposed sighting per zone:

| Zone | Sighting | Animation beat |
| --- | --- | --- |
| 1 Trailhead Forest | Half-hidden between two distant pines | Leans out, sniffs, ducks back behind the trunk (loop with long pause) |
| 2 Setting Up Camp | Behind the far campsite treeline | Head and shoulders rise above the brush, look left/right, sink down |
| 3 Plan Rapids | Low on the far riverbank in the painted bank line | Stands, dips head to the water, lifts head, holds |
| 4 Gathering Supplies | In a distant alley gap between two buildings | Slow silhouette cross of the gap, then gone until the next loop |
| 5 Relay Ridge | Ridge-crest silhouette on the painted hill line | Rises into silhouette, holds, turns head, drops out of view |
| 6 Awaiting Decision | In the storm haze behind the distant trees | Faint silhouette fades in, head turn, fades back into the haze |

No drawn ledges, no invented geometry, no horizontal patrol across empty sky. Everything stays on the DECOR_BACK layer with zone tint/opacity, no collision, no damage.

**Approval gate:** I will render each of the six as a screenshot of the actual zone (bear placed and animating) and show all six. Nothing installs into the game until you approve.

## 2. Boss cinematic moves after plan selection (Zone 7)

Currently the bear charge-in cinematic fires the moment the player enters Zone 7, before they have done anything. It moves to trigger **after a health plan is picked**:

- Enter Zone 7 -> normal briefing, no cinematic.
- Pick a plan -> hint line, then the bear-charges-in cinematic plays, then the READY prompt, then the fight starts.

## 3. Thank You screen

- Regenerate the Thank You backdrop with the exam bed removed from the art (clean floor/wall in that corner, everything else — window, skyline, clock, chair, picture — unchanged).
- Place the existing sitting-and-waving hero sprite in that spot at a natural size so he reads as the whole bed-and-hero element, matching image 2. Logos, bubble, text, and prompt stay where they are.

## Technical notes

- `src/components/game/game-scenes.ts`: delete the `GROUND_PAL` shelf rects and the walk/turn state machine in the `BEAR_CAMEOS` block; replace with a data-driven table of stationary sighting beats (peek/rise/cross/fade) driven by a small shared builder. Any new pose frames get added to `bear-scout-sheet.png` in the same 16-bit style.
- Move `playBossCinematic(...)` out of the `z === 6` zone-entry branch and into the `plan-pick` collide handler, chained before `showBossReadyPrompt`.
- Replace `src/assets/game/bg-thanks.png` in place (bed removed); adjust hero sprite pos/scale in the `thanks` scene.
- Current Version only for the cameos; Original Version stays the frozen baseline. Thank You art is a shared asset, so both builds pick it up.
- No database, scoring, or schema changes.
