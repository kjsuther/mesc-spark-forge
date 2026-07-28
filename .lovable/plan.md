## Zone hint text

All in `src/components/game/game-scenes.ts`, using the existing gold-on-navy `addSpeech` plaque so every label matches and stays legible.

- **Zone 1** — move the "Smash a brick →" plaque from x 1080 (far right, past the last brick) to the left of the first "Apply by Mail" brick (~x 90, at brick height), reworded "Smash a brick and collect application".
- **Zone 2** — new plaque near the account area: "Collect Username and Password and avoid account locks".
- **Zone 3** — new plaque at the near edge of the river gap: "Use platforms to get to other side".
- **Zone 4** — existing "GATHER 3 DOCS" becomes "Gather 3 docs and avoid evil clipboards".
- **Zone 5** — existing "Answer every request!" becomes "Collect all notice mailboxes and avoid confusing letters".
- **Zone 6** — new plaque: "Avoid falling dates".
- **Zone 7** — new plaque: "Pick your plan and defeat the boss".
- **Zone 8** — new plaque: "Climb stairs and collect your medical card".

Each new plaque sits above head height near the start of its zone so it never overlaps enemies, doors, or platforms, and is placed within the zone's own screen width so it scrolls into view with the stage.

## Navigator name card

The companion's "I'll help!" label is currently plain white text with no backdrop, so it disappears against bright skies. Replace it with the same navy plaque + gold text treatment used elsewhere (a small floating version that tracks the companion each frame), labeled "Navigator — I'll help!".

## Campfire cleanup

The campfires are the "Check Your Status Anytime" checkpoint markers, spawned at the start of zones 2 through 8. Keeping the zone 2 one and simply deleting the others would also delete those checkpoints, so instead:

- Zone 2 keeps the campfire sprite exactly as-is.
- Zones 3–8 keep working checkpoints, but the marker is drawn as a slim navy/gold checkpoint flag (simple rect + pole primitives, no new art) placed flush to the ground — small and unobtrusive rather than a repeated campfire.

If you'd rather the other zones have no checkpoint at all, say so and I'll remove those markers entirely instead.

## Verification

Load each zone in a headless browser at both desktop and mobile viewports, screenshot the zone entry, and confirm: each hint plaque is on-screen and readable, the Navigator card is readable while walking, and only zone 2 shows a campfire.
