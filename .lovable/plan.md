# Zone 7 playability pass: platforms, dodging lane, and boss facing

Findings from reading the current Zone 7 layout (`game-scenes.ts`, block at `kx0 = BIOME_W * 6`):

- Plan platforms sit at x = kx0+420 / 680 / 940, and the bear patrols kx0+840 to kx0+1260. The third plan and its step-up sit inside the fight arena, so the player dodges paperwork directly under low platforms.
- The step-up platforms are at `GROUND_Y - 132`, underside about `GROUND_Y - 146`. A full jump puts the hero's head near `GROUND_Y - 210`, so any jump under a step-up bonks the ceiling — that is the "can't clear projectiles / get stuck" case.
- Each step-up sits 110 px left of a plan platform whose 128 px width overhangs toward it, so approaching from the right you clip the plan platform's underside/corner and wedge between the two.

## What changes

- Move the whole plan-choice area out of the bear's patrol range so no plan or step platform overlaps the fight lane. The choice happens before the bear arrives; the arena stays a clean floor for dodging.
- Raise the step-up platforms and shrink them so nothing hangs at head height in the running lane, and give each step-up clear air on both sides.
- Re-space each step relative to its plan platform so the two-hop climb works from either direction: running right-to-left you land on the step cleanly and hop up, with no overhang to snag on.
- Verify the hero can complete a full jump anywhere in the arena and anywhere along the run-up without hitting a ceiling.
- During the bear's charge-in animation and for the first moment of the fight, force the hero to face right (toward the bear) instead of keeping whichever direction he was facing when he grabbed the plan.

## What does not change

Plan names and bonus, the key, boss health and attack pattern, briefing text, scoring, and all other zones.

## Technical notes

- File: `src/components/game/game-scenes.ts`.
- Shift `planDefs` x positions left (roughly kx0+300 / 500 / 700) so the rightmost plan platform's right edge clears the bear's leftmost patrol point (`home - range` = kx0+840) with margin.
- Step platform top moves from `GROUND_Y - 132` to about `GROUND_Y - 96` (underside ~`GROUND_Y - 108`) only if it stays reachable and out of the peak-head band; where a step would still sit in a walking lane, offset it so its footprint does not sit under the plan platform's overhang. Target invariant: no static surface underside between `GROUND_Y - 40` and `GROUND_Y - 215` anywhere the hero runs or dodges.
- Step width and gap tuned so the horizontal distance step-edge to plan-platform-edge is jumpable in both directions, with the step no longer tucked under the plan platform's 128 px span.
- In `playBossCinematic` / `playBossEntrance` and at `spawnPlanBoss`, set `player.flipX = false` (and hold it through the cinematic frames) so the hero watches the bear.

## Verification

Playwright run into Zone 7 that:
1. Climbs each of the three plan platforms from the left and again from the right, asserting no stuck state and successful pick.
2. Jumps repeatedly while standing under every platform and step, asserting full apex rise (no early ceiling stop).
3. Runs the boss fight and asserts a shot can be jumped from every x position in the arena.
4. Screenshots the cinematic to confirm the hero faces the bear.
