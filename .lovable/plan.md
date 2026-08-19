# Bonus Zone: Real Exit Door + Safe Landing in Zone 3

Two changes to the hidden Portland waterfront bonus stage (reached by falling into the Zone 2 gap the first time).

## 1. A visible exit door

Today the only exit cue is a small floating "EXIT →" text, and the player leaves by walking off the right edge of the stage — which reads like falling.

- Place an open exit door sprite (the same art the trail doors use) near the right end of the waterfront, standing on the bonus ground.
- Keep a short sign above it: "EXIT" plus a line telling players to walk into the door to return to the trail.
- Walking into the door triggers the exit, with the usual chime and sparkle.
- Walking off the right edge or falling below the bonus ground still exits as a safety net, so nobody can get stuck.

## 2. Leaving the bonus zone starts you in Zone 3

Today the exit drops the player back into the middle of Zone 2, just past the gap — right into the account-lock enemies with no run-up, which frequently costs a life.

- The exit now places the player at the start of Zone 3 (Step 3), on solid ground, with the usual brief invulnerability window.
- Because Zone 2 is being skipped, its progress is marked as satisfied on the way out (username/password credited, Zone 2 door unlocked) so the HUD, checkpoints, and door state stay consistent.
- The normal zone-change handling still runs: Zone 2's split time closes, the Zone 3 briefing screen opens, Zone 3 music starts, and the "new zone" points are awarded once.
- The existing bonus completion points and "BONUS COMPLETE!" message are kept.

## Technical notes

All edits are in `src/components/game/game-scenes.ts` inside the `trail` scene:

- `buildBonusStage()` — add the door object (sprite `door-open`, anchored to `BONUS_GROUND_Y` near `BONUS_X1 - 90`) and replace the bare "EXIT →" sign with the door-side signage.
- `updateBonusStage()` — trigger `exitBonusStage()` on overlap with the door x-range, keeping the existing right-edge and fall-through fallbacks.
- `exitBonusStage()` — spawn at `BIOME_W * 2 + 70`, `GROUND_Y - 60`; set `zoneState.userGot` / `zoneState.passGot` and call `unlockDoor(1)` before the position change so the per-frame zone-transition logic sees a coherent state.
- New Spanish strings for the door signage added to `src/lib/i18n.ts`.

No difficulty, scoring curve, or other zone behavior changes.
