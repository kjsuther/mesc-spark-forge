## Goal

In Stage 3 (Crossing the River of Paperwork), make the water gap wide enough that all four moving platforms — including "SIGNATURE" — sit fully over the gap, then increase difficulty: longer jumps between platforms, and platforms that travel higher and move faster.

## What's wrong today

The river gap spans 480px (`RIVER_GAP_X0` = base+320 to `RIVER_GAP_X1` = base+800). The four platforms start at +20, +165, +310, +455 relative to the gap start and are 108px wide, so the last one ("SIGNATURE") ends 83px past the far bank — it visually overhangs solid ground, which is what the video shows.

## Changes (all in `src/components/game/game-scenes.ts`)

1. **Widen the water gap** — move `RIVER_GAP_X1` from base+800 to roughly base+1010, giving a ~690px gap. The ground segments and the water rectangle already derive from these constants, so the bank art and the drown zone follow automatically. The bridge upgrade path (`active.bridge`) also derives its width from the same constants and stays correct.

2. **Respace the four platforms so every one floats over water** — positions become about gap start +30, +200, +370, +540. With a 108px platform, the last platform's right edge lands ~40px short of the far bank, so all four are clearly over the river.

3. **Longer jumps** — edge-to-edge spacing rises from ~37px to ~62px, so each hop demands real commitment while staying inside the hero's jump arc (verified against the existing jump height/run speed, plus coyote time and jump buffering).

4. **Higher, faster oscillation** — bump each platform's vertical amplitude from 46-62 up to roughly 70-90, and increase the speeds by about 20-25% (e.g. 3.6 → 4.4, 3.1 → 3.9, 4.0 → 4.8, 3.4 → 4.2). Base Y positions get nudged up slightly so the taller swing never dips a platform below the bank line or pushes it off the top of the view.

5. **Keep the labels glued on** — the plaque, shadow, and gold text already track `plat.pos.y` each frame; they move with the new amplitudes with no extra work.

## Verification

Run the game through Stage 3 in the preview at desktop and mobile widths, screenshot the crossing, and confirm: no platform overlaps a bank, the swing stays fully on screen, and the crossing is completable (harder, not impossible) with the current jump tuning.
