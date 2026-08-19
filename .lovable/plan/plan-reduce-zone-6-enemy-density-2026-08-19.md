# Plan: Reduce Zone 6 enemy density

## Goal
Make Zone 6 (Step 6 · Awaiting Decision — the falling-calendar hazard zone) slightly easier by removing one of the calendar-page enemies from the level.

## What I found
- Zone 6 in the game corresponds to code zone 5 (`BIOME_W * 5`) and the briefings label it "STEP 6 · AWAITING DECISION".
- The only enemies in this zone are the falling calendar pages (`CAL_COUNT = 20` reusable objects that rain down during the 10-second wait).
- There are no patrolling enemies or bosses in this zone.

## Change
In `src/components/game/game-scenes.ts`, reduce the calendar-page enemy pool by one:

```text
CAL_COUNT: 20 -> 19
```

This is a literal, minimal change that removes one enemy from the zone while keeping the existing hazard behavior, timing, and visual effects unchanged.

## Verification
- Run a local typecheck / build check.
- Start the game, reach Zone 6, and confirm the calendar rain still works and the zone feels slightly less crowded.
