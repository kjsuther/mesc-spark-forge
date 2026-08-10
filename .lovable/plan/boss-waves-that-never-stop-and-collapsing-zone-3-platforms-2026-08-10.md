# Boss waves that never stop, and collapsing Zone 3 platforms

## 1. The bear throws until he's beaten

Right now a wave only fires when two things line up: the boss has to be near the top of a jump, and he must not be in his post-hit invulnerability window. Every time you land a hit he goes quiet for over a second, and if his hop rhythm drifts the wave gate slips too — which is why the barrage stops after a couple of waves.

Change: the throw becomes a pure timer. Every 1.2-1.6 seconds (tighter in the rage phase) he releases a wave, no matter what he's doing — mid-jump, on the ground, or flashing from a hit. Jump height still varies where the shots come from, so waves arrive at different heights, but the height no longer gates whether a wave happens. Spacing inside a wave stays as it is so a well-timed jump still clears it, and all shots still vanish the moment he's defeated.

## 2. Zone 3 platforms collapse instead of bobbing

The four river platforms stop moving up and down. They sit at fixed, jumpable heights across the gap and behave like this:

- Step on one and it holds briefly (a short wobble/shake telegraph), then drops away, accelerating to the bottom of the screen.
- You have to hop to the next platform before the one under you is gone; miss it and you fall into the water below and lose a life, exactly as today.
- Once a platform falls it's gone for that attempt — the crossing has to be done in one quick run.
- Losing a life restores all four platforms to their starting positions so the next attempt is fully winnable; the same reset happens if you re-enter the zone.

Heights and spacing are set so a normal jump clears platform to platform, and the collapse delay is tuned so a player moving steadily makes it while a hesitating one doesn't.

## Technical notes

- `src/components/game/game-scenes.ts`, Zone 7 boss `onUpdate`: drop the `nearApex` / `armedShot` / `hurtUntil` conditions from the throw gate; keep only `now >= boss.nextShot`, reschedule `nextShot = now + (1.2 + rand*0.4) / rage` on every wave. Jump logic untouched.
- Same file, Zone 3 block: replace the `amp`/`spd` bobbing `onUpdate` with per-platform state (`idle` -> `shaking` -> `falling`), triggered when the player rides or lands on it. Falling platforms drop with gravity, lose their `area()`/riding eligibility, and carry their plaque/label objects down with them.
- Reset: keep a zone-3 platform registry with home positions; call a `resetRiverPlatforms()` from `loseLife` (and on zone re-entry) that restores position, visibility, collision and state. Clear `player.riding` when the ridden platform starts falling.
- Existing water plane already handles the fall death (`loseLife("water")`), so no new death path.
- No database or schema changes.
