# Explorer Gear Makeover for the Hero

Restyle the main character so he's outfitted with the gear from the reference photo: khaki bucket/boonie hat, black aviator sunglasses, red bandana at the neck, tan crossbody satchel, green binoculars on a strap, and the black whistle/compass lanyard.

## What changes

Three hero images carry the character, and all three get regenerated with the same outfit so he stays consistent:

1. **Walk/idle/jump sheet** (`character-sheet.png`) — 6 frames: idle, four walk poses, jump. Used for every in-game movement, including the mirrored left-facing frames the engine generates automatically.
2. **Victory/celebration sheet** (`hero-slide-sheet.png`) — 2 arms-raised frames used in the win sequence.
3. **Portrait** (`hero-portrait.png`) — the waving close-up shown on the Thank You screen. Hat, shades, bandana, and lanyard need to read clearly at portrait scale.

Both the Current Version and the Original Version of the game import these same files, so the makeover applies everywhere at once with no code changes.

## Design direction

- Keep the existing 16-bit SNES pixel style, palette weight, black outline, and silhouette proportions so animation timing and collision boxes stay valid.
- Layer the gear over the current green jacket / cream shirt / blue jeans / brown boots base rather than replacing the outfit wholesale — the red bandana and khaki hat become the new color accents.
- Swap the current brown backpack straps for the tan crossbody satchel strap; binoculars hang at chest, whistle/compass lanyard beside them.

## Approval flow

Generate all three images first, show them for review, and make no code or file swaps until you approve. If any frame looks off, that image gets regenerated before anything ships.

## Technical notes

- Sheets stay 1024x1024 with the existing 3x2 (character) and 2-across (slide) frame layout; frames must sit in the same cells and keep the same feet baseline, or the sprite trimming/grounding logic shifts.
- Frame-to-cell mapping in `game-scenes.ts` (`heroFrames`, `hero-slide-*`) and the 66px display height stay unchanged.
- Left-facing frames are auto-mirrored at load, so asymmetric gear (satchel strap direction) will flip with the sprite — that's expected and matches current behavior.
