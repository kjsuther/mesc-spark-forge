# Four defect fixes: Zone 7 controls, warm-up text, 1-UP icon and extra lives

## 1. Extra life is silently taken back (confirmed cause)

Picking up a 1-UP raises max lives from 3 to 4. But the feature-flag reconciler
recomputes max lives from the upgrade settings (3 normally, 5 with the extra-lives
upgrade) and it runs at boot, on every settings change, and defensively about once a
second. So a few frames after you grab the 1-UP, max drops back to 3 and the extra
life you just earned is clamped away.

Fix: track 1-UP pickups as a separate bonus on the player and have the reconciler
compute `base (3 or 5) + bonus lives earned` instead of the flat base, so an earned
life survives every reconcile and the HUD keeps showing it. Cap stays at 5.

## 2. 1-UP icon should be the green plus

In the world the 1-UP is drawn as a red rounded box with "1UP" text, which does not
match the green health "+" shown on the instruction/briefing screens.

Fix: redraw the pickup as a chunky 16-bit green cross badge (dark green outline,
bright green fill, soft white shine pixel) with the small "1UP" caption kept
underneath. Same size, float animation, collect label and hitbox.

## 3. Warm-up level text overlaps

The coaching plaques use hardcoded x positions, but their width scales with the
mobile UI text scale — so on a phone the wider plaques (COLLECT, ENEMY, DOUBLE JUMP,
READY) run into each other, and the checklist card collides with the SKIP/EXIT
buttons in the top corners.

Fix:
- Lay the warm-up plaques out on a small vertical-lane system: measure each plaque's
  scaled width and push overlapping neighbours to a different height (or shift them
  along the trail) so no two ever cross.
- Clamp the right-most plaques so they cannot extend past the stage/door area.
- Move the warm-up checklist card down/in so it clears the SKIP WARM-UP, sound and
  EXIT controls at phone sizes.

## 4. Zone 7 mobile controls stop responding (diagnose first)

Cause not yet confirmed, so step one is reproduction, not a blind fix. Two suspects
worth testing in order, both in the Zone 7 plan-pickup sequence:

- The boss cinematic and the "get ready" card each pause and resume the whole scene.
  Pausing while already paused is ignored, so an overlapping pause/resume pair can
  leave the player object still frozen while the cards are gone — controls look dead.
- Both cards clear the "movement armed" flags on close. Touch input is only sent when
  the joystick *changes*, so a thumb already holding a direction never re-arms until
  it is fully lifted and moved again.

Plan: reproduce on a touch-emulated run into Zone 7 (pick a plan, watch the cinematic
and the ready card, then try to move), confirm which of the two is firing, then fix
that one — pause depth counting for the first, re-sending the joystick's current
direction after a card closes for the second — and re-test the same path.

## Technical notes

- `src/components/game/managers.ts`: `PlayerManager.startingLives`/`reconcileLives`
  gain an earned-bonus term; `src/components/game/game-scenes.ts` increments that
  bonus in the `oneup` collision instead of raising `maxLives` directly, and includes
  it in the checkpoint snapshot/restore.
- `src/components/game/game-scenes.ts`: `spawn1UP` visual swap; warm-up scene plaque
  layout; Zone 7 pause/resume and input re-arm once diagnosed.
- Verification: Playwright run with touch emulation through the warm-up screen at
  phone width, plus a run to a 1-UP to confirm the fourth heart stays lit.
