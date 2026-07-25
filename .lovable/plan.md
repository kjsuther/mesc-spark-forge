Comprehensive UAT pass on the 8-zone journey. Below is the confirmed defect list (each traced to a specific line in `src/components/game/game-scenes.ts`) and the corresponding fix.

## Defects Found

### Critical — finale can't complete
1. **Medical ID card is not collectible.** The `"id-card"` sprite is spawned at lines 1170–1181 but there is no `player.onCollide("id-card", …)` handler anywhere. Nothing happens when the player touches it, and no state is tracked.
2. **Fire pole is not gated on the ID card.** `player.onCollide("fire-pole", …)` at line 1664 attaches the player to the pole regardless of whether the ID card was collected, so the requirement "collect card → slide down" is bypassable and, more importantly, the finale objective (`met: () => zoneState.firePoleDone`) can trigger without the card ever being touched.
3. **Game "never ends" report.** Root cause is that on mobile the ID card sits above the top landing (`topLandingX + 40`, y ≈ `topLandingY - idH/2 - 8`) and the fire pole is 130 px past that. Players wander to the ID card, nothing acknowledges the touch, they don't realize they must proceed to the pole, and if they fall off the platforms there is no way back up (staircase gaps + no checkpoint), so they die or wander indefinitely.

### Critical — door gating is broken across zones 0, 1, 3, 4, 6
4. **Players can jump over every locked door.** The invisible barrier at line 812 is only 120 px tall, but with `JUMP_VEL = 720` and gravity `1800` the peak jump height is 720²/(2·1800) = **144 px** — taller than the barrier. Any player who jumps at the door clears it and skips the objective entirely. This is the biggest defect: none of the objectives actually gate progression on desktop or mobile.
5. **Zone 2 door pre-unlocks on spawn.** `zoneObjectives[2].met` is hard-coded to `true` (line 1000), so the door for "Crossing River of Paperwork" unlocks the instant the level loads. Player never has to reach the far bank before it opens.

### Medium — polish / feedback
6. **Locked-door hint for Zone 7 is missing** from the `hints` map (lines 1686–1694), because Zone 7 uses the fire pole instead of a door. That's fine, but there is no in-world hint telling the player they must collect the ID card before the pole activates.
7. **No visual "collected" feedback for the ID card.** Without a pickup effect, players don't realize the card matters.
8. **Fire-pole slide can miss the base collider on a fast frame.** During the slide the player's Y is clamped with `Math.min(GROUND_Y, player.pos.y + 220 * dt)`. At 220 px/s that's fine, but if the browser tab drops frames the single-frame delta could jump past the 30 px-tall `pole-base` rect. Should also trigger `firePoleDone` when Y reaches `GROUND_Y` regardless of collision.
9. **Zone-7 respawn trap.** If the player falls off the staircase mid-climb, `loseLife` respawns them at the zone start (`BIOME_W * 7`), but the staircase is 280 px in and requires jumps from ground level to reach — that's still doable; not a defect, but the ID-card requirement needs a way for a re-spawned player to know what to do (handled by fix 11).

## Fixes

All edits are in `src/components/game/game-scenes.ts` unless noted.

10. **Extend door barriers to full playfield height.** Change the barrier rect (line 813) from `k.rect(14, 120)` to `k.rect(14, 560)` and anchor so it spans from above the ceiling to the floor. Players can no longer jump over. The door sprite stays unchanged; only the invisible physics wall grows.

11. **Add `idCardCollected` state and gate the fire pole on it.**
    - Add `idCardCollected: false` to the `zoneState` object (near line 790).
    - Add `player.onCollide("id-card", (c) => { … })` that sets `zoneState.idCardCollected = true`, plays a sparkle burst + score bump, destroys the card, and shows a hint "You got your Medical ID — slide down the pole!".
    - In `player.onCollide("fire-pole", …)` (line 1664), early-return when `!zoneState.idCardCollected` and show a hint "Grab the Medical ID card first!".

12. **Zone 7 HUD reflects new sub-objective.** Update `zoneObjectives[7].hudLabel` (line 1217) so it reads `ID CARD ☐` before pickup, `SLIDE DOWN →` after pickup, `COVERED!` after the slide.

13. **Zone 2 door requires reaching the far bank.** Replace `met: () => true` (line 1000) with `met: () => player.pos.x >= BIOME_W * 3 - 120` so the door only unlocks when the player is within ~120 px of it (i.e., they actually crossed the paperwork river).

14. **Fire-pole slide auto-completes at ground.** In the slide branch (lines 1868–1871) add: after clamping Y, if `player.pos.y >= GROUND_Y && !zoneState.firePoleDone`, set `zoneState.firePoleDone = true` and call `startFireworks(…)` — same as the `pole-base` handler. This guards against frame drops and against the collider being missed.

15. **Add a "REACH THE ID CARD" arrow sign at the top of the stairs.** Reuse `addSpeech(k, topLandingX, topLandingY - 40, "GRAB THE ID →", …)` above the landing so the objective is obvious.

16. **Regression sweep** using Playwright + the existing debug overlay (`?debug=assets`):
    - Verify each zone's door stays locked when the objective is unmet (attempt to jump over — should hit the extended barrier).
    - Verify each door unlocks with animation the moment the objective completes.
    - Verify Zone 2 door only opens after crossing the river gaps.
    - Verify Zone 7: (a) touching the pole before the ID card shows the "grab ID first" hint, (b) collecting the ID card enables the pole, (c) sliding to the ground triggers fireworks + "ENROLLED IN COVERAGE" + score-submit screen on both desktop and mobile.
    - Verify lose→respawn keeps zone objectives progressed (already true — `zoneState` persists across `loseLife`, only position resets).

## Out of scope

- No changes to art assets, backgrounds, physics tuning, or leaderboard.
- No changes to the intro/title screen.
- No changes to enemy/boulder behavior beyond what's needed to confirm the gates work.

## Test plan

After the fixes, I'll run a scripted Playwright pass at 1280×900 (desktop) and 390×844 (mobile) that:
1. Attempts to jump each locked door in zones 0, 1, 3, 4, 6 — expect to be blocked.
2. Completes each objective and confirms door unlock animation + passage.
3. In Zone 7: touches the pole first (blocked), collects the ID card, slides down, verifies fireworks + win overlay + score submit.
4. Screenshots each step to `/tmp/browser/uat/` for the QA report.
