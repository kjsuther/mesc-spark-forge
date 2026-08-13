# Zone 7 plan pickup fix + collectible labels that clear

## 1. Zone 7: touching a plan must always start the boss

Touching a plan card sometimes does nothing. Two things in the current pickup path can swallow it, and the first step is to confirm which (or both) by instrumenting the collision in a scripted run into Zone 7:

- The pickup hitbox on each plan card is built with a manual offset *and* a bottom anchor, so the collision box can end up shifted off the artwork (up and to one side) instead of sitting on the card.
- The pickup handler rejects the grab unless the hero's feet are above the island top plus a small margin. Landing slightly low, standing on the sloped edge, or touching while still rising can fail that check.

The fix:
- Give the plan card a hitbox that matches the drawn card exactly, so any contact with the visible card counts.
- Replace the strict height gate with a rule tied to what it was meant to prevent: only reject a touch when the hero is clearly down in the running lane below the island. Anything at or near island level counts as a pick.
- The instant a plan is taken, the pick is locked in: the other cards, their labels and the "pick ONE plan" prompt disappear, and the bear cinematic then the fight start exactly as they do now.

Verification: a scripted run into Zone 7 that climbs each of the three islands (from the left and from the right) and confirms every touch registers the pick and triggers the bear, plus one run that walks the ground lane under all three islands and confirms nothing is picked up by accident.

## 2. Labels that disappear when the item is collected

Today the world labels are drawn once and never removed, so a collected item leaves its sign floating.

- Zone 2: the USERNAME and PASSWORD signs vanish the moment their item is collected.
- Zone 4 (gather your documents): add matching signs above the three documents — ID, Income, Household — that vanish the same way when each is collected.
- Each collection plays a short bright 16-bit "collected" chime so the pickup is felt as well as seen, and it mutes with the existing sound toggle.

## Technical notes

- `src/components/game/game-scenes.ts`
  - Plan card: drop the double-offset `area({ shape })` on the `plan-pick` item so the box matches the sprite; loosen the `player.pos.y > PLAN_PLAT_TOP + 24` gate to a lane-level check.
  - Also destroy the plan labels and the prompt sign alongside `k.get("plan-pick")` on pick.
  - `addSpeech` returns the objects it creates (or tags them) so a label can be destroyed later; Zone 2 credentials and Zone 4 docs store their label handle on the item and destroy it in the `credential` / `doc` collide handlers.
- `src/lib/game-sfx.ts`: add a `pickup` effect (two-note rising square blip) and call `playSfx("pickup")` from the credential and doc handlers.

## What does not change

Zone layouts, plan names and bonus, boss health and attack pattern, briefing text, scoring, and all other zones.
