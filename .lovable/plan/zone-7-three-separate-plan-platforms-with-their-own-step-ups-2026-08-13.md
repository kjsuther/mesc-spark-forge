# Zone 7: three separate plan platforms with their own step-ups

Today the three plans share one long ledge whose underside sits right at head height, so the hero bumps it while dodging the bear's paperwork.

## What changes

- Each plan gets its own small floating platform instead of one shared ledge — three distinct islands, clearly separated.
- Each plan platform gets its own smaller stepping platform below and in front of it, so reaching a plan is always a two-hop climb: ground → step → plan.
- The plan platforms move up high enough that their underside is above the hero's maximum jump height. You can run and jump freely underneath any of them while dodging projectiles without ever hitting your head.
- The step platforms stay low enough to be reachable in one jump from the ground, and are placed in the gaps between plan platforms so they never sit over the main dodging lane.
- Plan name labels and the "pick ONE plan" prompt reposition with the new platforms.

## What does not change

Plan names, the bonus, the key, the boss trigger, the battle itself, briefing text, and every other zone stay as they are.

## Technical notes

File: `src/components/game/game-scenes.ts`, Zone 7 block starting at `const kx0 = BIOME_W * 6`.

Physics budget (gravity 1800, `JUMP_VEL` 720):
- Max jump rise = 720² / (2 × 1800) = 144 px, so peak feet at `GROUND_Y - 144`, peak head at `GROUND_Y - 210` (hero display height 66).
- Boss shots ride a lane at `GROUND_Y - 26`; clearing one needs feet at roughly `GROUND_Y - 45`, head then at about `GROUND_Y - 111`.

Layout:
- Plan platform top surface at `GROUND_Y - 240` (underside ≈ `GROUND_Y - 252`), which is above the `GROUND_Y - 210` peak head — no head bumps at any point of a full jump.
- Step platform top at `GROUND_Y - 132` (reachable from ground; underside ≈ `GROUND_Y - 146`, still ~35 px above the head position needed to clear a shot).
- Jump from a step reaches feet at `GROUND_Y - 276`, comfortably above the `GROUND_Y - 240` plan surface.
- All platforms static (`body({ isStatic: true })`, zero `platformSpeed`), plan item + wooden base anchored to each platform's top.

Verification after build: Playwright run into Zone 7 that (1) jumps repeatedly while standing directly under each plan platform and asserts the hero reaches full apex (no early ceiling stop), (2) confirms a boss shot can be jumped while under a platform, and (3) climbs step → platform and selects a plan, with the boss battle starting normally.
