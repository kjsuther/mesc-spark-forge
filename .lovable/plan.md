# Bear cameos in Zones 1-6, boss intro cutscene, Thank You layout, clearer door arrow

## 1. Bear cameo in Zones 1-6 (approval before install)

Today the scarf bear only appears as a background cameo in Zone 2, walking a patrol on the campsite terrace. Extend that idea so he shows up once in each of Zones 1 through 6, each time with a short, zone-appropriate animation, always clearly *behind* the play plane so he never reads as an obstacle.

Rules applied to every cameo:

- Drawn on the background layer, well above the player's ground line (on a distant terrace, ridge, riverbank, rooftop line, or treeline), never on the walkable path.
- Scaled down and colour-shifted toward that zone's backdrop palette (haze/tint) so he blends into the art.
- No collision, no damage, no interaction. Purely atmospheric.
- Each cameo is a short loop or one-shot beat, not a full patrol, so he reads as a glimpse.

Proposed beat per zone:

| Zone | Where he appears | Short animation |
| --- | --- | --- |
| 1 Trailhead Forest | Far treeline behind the pines | Peeks out between two trees, sniffs, ducks back |
| 2 Setting Up Camp | Campfire terrace (existing) | Existing pace + look + sniff loop, kept |
| 3 Plan Rapids | Far riverbank ledge across the water | Paces the bank, stops to stare at the river |
| 4 Gathering Supplies | Rooftop / alley gap in the distant town | Crosses a gap left to right, pauses mid-crossing |
| 5 Relay Ridge | Upper ridge silhouette | Climbs the ridge line, stops and looks back |
| 6 Awaiting Decision | Distant storm cliff | Stands still, head-turn scan, then walks off |

Frames come from the existing `bear-scout-sheet.png` (two walk frames, look, sniff); any additional pose needed (peek, climb, silhouette) gets added as a new sheet in the same 16-bit style.

**Approval gate:** I will render each of the six cameos as a screenshot of the actual zone with the bear placed and animating, and show all six for your approval. Nothing is installed into the game until you approve.

## 2. Zone 7 boss entrance + ready gate

- **Ready prompt:** when the player reaches the boss arena, the run pauses on a briefing card ("The bear is close. Ready?") that requires an explicit input (Enter / A / tap READY) before the fight begins. No more sudden start.
- **Entrance cutscene:** after confirming, a brief in-engine cutscene (about 3 seconds) plays — camera holds on the arena, the bear charges in from the woods on the right, skids to a stop, roars, scarf flaring, then the health bar appears and control returns. Built as a scripted scene using the existing bear/boss sprites and camera so it stays pixel-consistent with the game (rather than an embedded video file, which would clash with the 16-bit look and add load time).

## 3. Boss fight rebalance

- Your "+" projectiles no longer destroy the bear's incoming projectiles — they pass through, so his shots must be dodged.
- The bear fires **less often** than today.
- His shots now fire **on his jumps**, released at the apex/arc, so they arrive from varying heights and force high and low dodges instead of one repeated pattern.
- Boss HP, contact damage, and your auto-fire cadence stay as they are.

## 4. Thank You screen

- The hero sitting-and-waving sprite is repositioned and scaled to sit **on the exam bed drawn in the backdrop**, so he's genuinely on the bed rather than floating in front of it (the backdrop bed is covered by his sprite).
- The MESC 2026 and MN DHS logos move from the right side to the **left** side of the screen, stacked, clear of the hero and the message bubble — matching your screenshot.
- Message text, bubble, timing, and continue prompt stay unchanged.

## 5. Door arrow

Replace the current blocky rectangle cluster with a proper arrow shape: a solid chevron head plus a tapered shaft, in gold with a dark outline and a soft glow, rendered noticeably larger and pointing right. Keeps the existing flash/bob and disappears once the player passes through.

## Technical notes

- Cameos live in `src/components/game/game-scenes.ts` as a small data-driven table (zone index, x range, ground offset, scale, tint, beat type) driving one shared background-actor builder, replacing the hand-written Zone 2 block. Current Version only; the Original Version stays the frozen baseline.
- Boss changes: remove the `shot.onCollide("boss-shot", ...)` interception, lengthen the boss fire interval, and move fire triggering into the boss jump handler. Ready gate reuses the existing `showStepScreen` pattern; the entrance is a temporary camera/AI-locked sequence before `zoneState.bossSpawned` hands over control.
- Thank You changes are in the `thanks` scene block: hero sprite pos/scale, and the logo stack x-anchor flipped from `W - ...` to a left margin.
- Arrow rebuild is in the `unlockDoor()` indicator block.
- No database, scoring, or schema changes.
