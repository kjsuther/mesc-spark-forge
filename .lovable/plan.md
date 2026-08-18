# Make the Zone 7 bear boss fight about 30% easier

The plan-choice/boss step (shown in game as STEP 7) is the hardest part of the run.
Current tuning: the bear takes 6 hits, paces at 132 px/s, hops every ~0.22-0.40s,
throws a wave of paperwork every 1.2-1.6s (extra shot in the rage phase, which
starts with 2 hits left), shots travel 470 px/s with up to 8 in flight, and the
player auto-fires a healing "+" every 0.5s.

## Changes

- Fewer hits to win: bear health drops from 6 to 4 hearts.
- Slower paperwork: projectile speed 470 -> 380 px/s, and at most 5 in flight
  instead of 8, so there are real gaps to run through.
- Fewer waves: time between throws goes from every 1.2-1.6s to every 1.8-2.3s.
- Calmer bear: pacing speed 132 -> 110 px/s and hops spaced further apart, so his
  jump-throws are easier to read and dodge.
- Gentler rage phase: kicks in only at the final heart instead of the last two,
  and the speed-up multiplier is reduced from 1.32x to 1.15x.
- Faster player offense: the auto-fired "+" goes off every 0.4s instead of 0.5s,
  so hits land sooner and the fight is shorter.
- Slightly longer invulnerability window after the bear damages you, so a single
  unlucky hit doesn't chain into a second.

Nothing else about Zone 7 changes: the elevated plan platforms, plan selection,
the charge-in cinematic, hearts display, and scoring all stay as they are.

## Technical notes

All edits are tuning constants in `src/components/game/game-scenes.ts` inside
`spawnPlanBoss`, `spawnBossShot`, and the auto-fire loop. After the change, run a
demo-mode playthrough to confirm the bear still spawns, the heart counter reads
4, and the fight resolves cleanly into the finale zone.
