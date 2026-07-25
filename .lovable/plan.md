## Goal
Make it much harder to reach Zone 8 without upgrades, so the voting/upgrade mechanic feels essential. Leave Zone 1, 7, and 8 untouched.

Note on zone numbering: the "countdown + falling calendar dates" zone is Zone 6 in code ("Awaiting a Decision"). I'm treating your Zone 7 timer-reset request as applying to that zone (the only one with a countdown + calendar rain). If you actually meant a different zone, tell me and I'll adjust.

## Changes in `src/components/game/game-scenes.ts`

### Zone 2 — Create Your Account
- Increase padlock speed further (90 → 130) and widen patrol (220 → 300) so both padlocks fully sweep the gap.
- Add a third padlock patrolling the right approach to the door.
- Narrow the mid-zone safe ledge slightly so mistimed jumps fall.

### Zone 3 — Crossing the River of Paperwork
- Increase gap between river platforms (~30% wider spacing).
- Raise vertical amplitude again (higher highs / lower lows) and increase oscillation speed ~1.4×.
- Desync platform phases so you can't rely on a rhythm.
- Add one extra "dropping" platform that briefly falls when stepped on before returning.

### Zone 4 — Gathering Documents
- Bump form-monster count from 3 → 4 and slightly increase their patrol speed.
- Add two small pits between document pickups (survivable with a normal jump, punishing if mistimed).
- Slightly stagger monster spawn Y so at least one patrols a raised ledge.

### Zone 5 — Respond to Requests
- Add a third Envelope Gremlin.
- Increase max wander speed and reduce re-roll interval so movement is more erratic.
- Introduce brief "dive" behavior: occasionally a gremlin accelerates toward the player's current X for ~0.6s before resuming wander.

### Zone 6 — Awaiting a Decision (the countdown/calendar-rain zone)
- **Getting hit by a falling calendar date resets the countdown back to 10 seconds** (in addition to costing a life / i-frames as today).
- Increase calendar rain density (14 → 20) and fall speed further.
- Add small horizontal drift to some calendars so straight-line dodging fails.
- Keep the 10-second base timer.

### Zones intentionally unchanged
- Zone 1 (Choosing How to Apply)
- Zone 7 (Choose a Health Plan / boss)
- Zone 8 (Coverage Begins / pole finale)

## Out of scope
- No changes to physics constants, HUD, controls, art assets, or upgrade/voting logic.
- No changes to win/lose screens or scoring formulas.

## Verification
- Playwright smoke run through zones 2–6 on desktop viewport: confirm each zone is beatable but clearly harder, timer resets on calendar hit in Zone 6, and Zones 1/7/8 render identically to current build.
