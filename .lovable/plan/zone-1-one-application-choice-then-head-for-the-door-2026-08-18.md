# Zone 1: One Application Choice, Then Head for the Door

Right now a player can smash every brick in Zone 1 and leave four application
icons lying on the trail, even after they have already picked one. The only
feedback is a brief "chosen — door unlocked!" flash.

## What changes

Once the player picks up an application method (Mail, Phone, In Person, or Online):

- The other three choices are switched off. Their bricks can no longer be
  smashed, and any application icon already knocked loose disappears.
- The unchosen signposts visibly fade back (dimmed), so the trail reads as
  "this one is yours, the others are closed."
- The chosen signpost stays bright and gets a small check mark, so the player
  can see what they picked.
- A plain-language message appears in the hint bar:
  "You picked Apply by Mail. Now walk right and go through the door."
  (with the picked method's name filled in)
- The zone's on-screen objective label continues to show the METHOD ✓ state as it does today.

Nothing else about Zone 1 changes: same brick heights, same jump, same scoring
(400 points for the pick), same door unlock behavior.

## Spanish

The new message is added to the game's Spanish dictionary so it reads
"Elegiste Solicitar por Correo. Ahora camina a la derecha y cruza la puerta."
in Spanish mode, with the four method names translated as well.

## Technical notes

All work is in `src/components/game/game-scenes.ts` plus dictionary entries in
`src/lib/i18n.ts`.

- Zone 0 brick creation keeps a list of the created bricks and their sign
  plaque objects; `addSignPlaque` returns the objects it creates so they can be
  dimmed later.
- The `player.onCollide("method", ...)` handler gains a lock-out step: mark the
  remaining bricks `hit = true` (so the head-bump handler exits early), destroy
  every remaining object tagged `method`, drop opacity on the unchosen plaques,
  and append a check mark to the chosen plaque's label.
- The hint uses a single template string routed through the existing `tr()`
  translation hook; a regex rule in `i18n.ts` handles the method-name
  substitution so only one dictionary entry is needed.
- Demo/attract mode already targets the nearest `method` object; after the lock
  out there are none left, which matches the existing "objective met" path, so
  autopilot continues to the door with no change.
