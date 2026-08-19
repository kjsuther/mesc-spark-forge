# Double Jump

Add a mid-air second jump: press/tap jump again while airborne to gain extra height and clear hazards. Works the same on keyboard, touch joystick pad, and USB controller, since all three funnel into one jump routine.

## Behavior

- One extra jump per airborne trip. It resets the moment the hero touches the ground or rides a moving platform.
- The second jump is slightly weaker than the first (about 85% of the normal launch) so it feels like a boost, not a flight cheat, and it zeroes any downward speed first so it works even while falling.
- Coyote time and the existing jump buffer stay as they are; the air jump only kicks in when the hero truly has no ground under them.
- A small puff of pixel sparkles fires at the hero's feet on the air jump so the player sees it triggered.
- Attract/demo mode autopilot is untouched.

## Where players learn about it

- Controls screen: add a "Double Jump" row to all three control lists (desktop `Space / ↑ ×2`, mobile `⤒ ⤒ (tap twice)`, gamepad `BUTTON 1 ×2`).
- Warm-up zone: add a fourth checklist item `☐ DOUBLE JUMP`, a coaching banner explaining the tap-again-in-mid-air move, and a raised ledge/high collectible only reachable with the double jump. The door still opens on the 20-second fallback so nobody gets stuck.
- Spanish strings added for every new label and banner.

## Technical notes

- `src/components/game/game-scenes.ts`: add `AIR_JUMP_VEL` and an `airJumpsLeft` counter on the player; extend `tryJump()` to spend it when not grounded and outside coyote time; reset the counter in the update loop when `groundedNow` is true and on respawn/zone restore. Mirror the same logic in the separate warm-up scene's `tryJump()` plus its checklist HUD and ready condition.
- `src/components/game/game-canvas.tsx`: extend the `desktop`, `mobile`, and `gamepad` rows in the controls screen.
- `src/lib/i18n.ts`: Spanish entries for the new control row and warm-up copy.
