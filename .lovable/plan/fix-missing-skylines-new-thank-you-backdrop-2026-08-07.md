# Fix missing skylines + new Thank You backdrop

## What's wrong

I checked the three background files actually shipping in the game:

- Zone 2 (`bg-signup.png`) — still the old campfire camp art, no skyline.
- Zone 3 (`bg-river.png`) — still the old canyon river, no skyline.
- Zone 6 (`bg-mountain.png`) — still the old storm cliffs, no city lights or skyline.

The approved artwork for all three still exists as drafts, so nothing needs to be re-designed — the swap simply didn't land in the game assets.

## Fix 1 — Actually install the approved backdrops

For each of Zones 2, 3, and 6:

1. Take the approved draft, resize to the game's 1280x426 backdrop frame, and quantize to a 256-color palette to match the other zone art.
2. Overwrite the shipping asset (`bg-signup.png`, `bg-river.png`, `bg-mountain.png`). Both the Current Version and Original Version builds import these same files, so both update at once.
3. Verify by re-rendering each installed file and visually confirming the Portland skyline and yellow hospital flag are present before I report done — this is the step that was missed last time.

## Fix 2 — Thank You screen backdrop

Replace the procedural night-sky/starfield behind the Thank You cutscene with a 16-bit interior of a doctor's office: exam room walls, cabinetry and clinic details, and a window showing the Portland skyline (with the yellow hospital flag for continuity).

Unchanged: the message text box, the MESC 2026 and MN DHS logos, the hero sprite, the fireworks/continue prompt, and all timing. The new art sits behind them as a full-bleed backdrop; I'll keep the panel behind the text opaque enough that copy stays readable against the busier scene.

## Technical notes

- Backgrounds: `src/assets/game/bg-signup.png`, `bg-river.png`, `bg-mountain.png` — shared by `src/components/game/game-scenes.ts` and `src/components/game/original/game-scenes.ts`.
- Thank You cutscene lives in the thank-you scene block of `game-scenes.ts` (the gradient bands + starfield drawing); a new asset `bg-thankyou-office.png` gets loaded alongside the other backdrops and drawn in place of that procedural sky. Mirrored into the original build.
