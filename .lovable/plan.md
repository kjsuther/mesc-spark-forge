# Door indicator, ranger guide, homepage + Thank You tweaks

## 1. Flashing "door is open" arrow

When a zone's exit door unlocks, add a pulsing gold right-arrow above the door (drawn from pixel blocks, matching the 16-bit look) that keeps flashing until the player passes through. It appears right after the existing unlock sparkle burst, sits above the doorway, and bobs/fades on a loop so it reads as "go this way now."

Also flash a brief on-screen cue with the same arrow at the right edge of the HUD area so the player knows even when the door is off-screen — it fades out after a few seconds.

## 2. Homepage: drop the "Repeat the loop" box

Remove the fifth loop card ("Repeat the loop") from the What's the Concept? section on the home page, leaving the four remaining cards evenly laid out.

## 3. Park ranger on every help/instruction screen

Add a new 16-bit park-ranger/navigator sprite (matching the hero's explorer-gear art style — ranger hat, uniform, friendly pose, one arm gesturing) shown on the left side of the briefing/step screens, so the panel reads as the ranger explaining the zone. The panel text column shifts slightly right to make room; sizing scales with the existing responsive text scale so it never overlaps copy on small windows.

Applies to the zone step/briefing screens in both the Current Version and the Original Version.

## 4. Thank You screen: hero sitting on the exam bed

Replace the close-up waving portrait with a full-body 16-bit hero sitting on the doctor's-office exam bed, waving. He sits in the lower-left of the office backdrop at a scale that matches the room, so it reads as one scene rather than a pasted portrait. The speech bubble copy becomes a thanks-for-playing message, and the bubble tail points at the seated hero. Logos, timing, and the continue prompt stay as they are.

## Technical notes

- `unlockDoor()` in `src/components/game/game-scenes.ts` gains the arrow indicator object, destroyed when the player collides with that door; mirrored into `src/components/game/original/game-scenes.ts`.
- New assets: `src/assets/game/ranger-guide.png` (briefing portrait) and `src/assets/game/hero-sitting.png` (seated wave), registered in the sprite loader alongside the existing backgrounds.
- `showStepScreen()` gets a left-side sprite slot and adjusted text `cx`/width math.
- Thank You scene swaps the `hero-portrait` sprite draw for `hero-sitting`, repositioned to the bed in `bg-thankyou-office.png`.
- New art will be shown for approval before it is wired in.
