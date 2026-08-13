# Zone 7: make the plan choice a deliberate climb

Right now the three managed care plans sit directly on the ground in the hero's running path, so the first one (Blue Cross / Blue Shield) gets collected by accident before the player registers there was a choice.

## What changes

- The three plan pedestals move up onto a single raised ledge above the running path, spaced apart so they read as three distinct options side by side.
- A smaller stepping platform sits below and before the ledge, so the player has to jump up to it and then onto the ledge to reach any plan.
- Because the ledge is above head height, simply running forward no longer touches a plan — the player must stop, jump, and walk to the one they want.
- The plans stay far enough apart on the ledge that landing near one doesn't brush another; picking any one still ends the choice and starts the boss exactly as it does today.
- The "Pick ONE plan" prompt and the per-plan name labels reposition with the ledge so they stay readable above the cards.

## What does not change

Plan names, the bonus, the key, the boss trigger and battle, the briefing screen, scoring, and every other zone stay exactly as they are.

## Technical notes

- File: `src/components/game/game-scenes.ts`, the Zone 7 block starting at `const kx0 = BIOME_W * 6`.
- Add a static ledge (`platform` tag, `body({ isStatic: true })`, zero `platformSpeed`) plus one smaller step platform, then anchor each `plan-pick` item and its wooden base to the ledge top instead of `GROUND_Y`.
- Ledge height set so a single jump from the step clears it, using the existing hero jump values; step height set so it is reachable from the ground.
- Verification: Playwright run into Zone 7 confirming the hero can run past the plans without triggering a pick, then climb step → ledge and select a plan, with the boss battle starting normally.
