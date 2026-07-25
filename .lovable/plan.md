## Difficulty pass: Zones 2–6

All edits in `src/components/game/game-scenes.ts`. User-facing zones 2–6 map to code zones 1–5 (Zone 1 = code 0).

### Zone 2 (code Zone 1) — Setting Up Camp — faster padlocks, longer patrols
In the "two padlocks left of Z1 gap" block (~line 1153):
- Bump `speed` 55 → 90.
- Bump `range` 90 → 220 so both padlocks travel further across the zone (past the gap).
- Keep the single right-side padlock at `sx0+900` unchanged.

### Zone 3 (code Zone 2) — River of Paperwork — faster, taller-swinging platforms
In the `platforms` array (~line 1204):
- Multiply each `amp` by ~2x (12→26, 18→38, 14→30, 12→26).
- Multiply each `spd` by ~1.8x (1.4→2.6, 1.2→2.2, 1.6→2.9, 1.4→2.6).
- Leave X positions and platform width alone so the crossing is still geometrically possible.

### Zone 4 (code Zone 3) — Gathering Documents — +2 more monsters
After the existing form-monster block (~line 1290):
- Spawn 2 additional `form-monster` patrols at `tx0+380` and `tx0+1000`, each with `range: 90`, `speed: 34`, respecting `active.plain_language` slowdown for parity with the existing one. Placed between the docs so the player must time each pickup.

### Zone 5 (code Zone 4) — Answering the Call — +1 gremlin, wide unpredictable patrols
- Refactor the single envelope-gremlin (~line 1329) into a loop of 2 gremlins at `relayBase+300` and `relayBase+820`.
- Replace the fixed `home ± range` bounce with a wandering pattern across the full zone (`relayBase+80 … relayBase+BIOME_W-80`): each gremlin re-rolls a new random target X and a new speed (35–75 px/s) every 1.2–2.2s, plus small vertical bob (`sin(time*3+phase)*8`) so movement is less predictable. Flip sprite based on current direction.
- Keep hitbox + animation frame swap identical to today.

### Zone 6 (code Zone 5) — Waiting Mountain — 10s timer, dense fast calendar rain
- `zoneState.waitDur = 30` → `10` (line 940).
- HUD default label "WAIT 0:30" → "WAIT 0:10" (line 1424).
- In the falling-calendar block (~line 1395):
  - Increase count from 6 → 14 pages.
  - Raise fall speed by boosting gravity/vy on respawn (double current fall rate) and shorten respawn X reroll delay so pages hit ground more frequently.
  - Keep zone-wide X reroll on each cycle.

### Zones 7 & 8
No changes.

### Verification
Playwright desktop 1280×800 + mobile 852×402:
- Zone 2: two left padlocks visibly sweep across most of the zone and are noticeably faster.
- Zone 3: platforms bob higher/faster but the 4-hop crossing still completes.
- Zone 4: 3 total form-monsters between docs; run is completable with careful timing.
- Zone 5: 2 gremlins roaming the entire zone with irregular direction changes.
- Zone 6: HUD counts down from 0:10; calendar pages fall thick and fast.
