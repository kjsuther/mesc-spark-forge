# Umbrella Block in the Awaiting-Decision Zone

Add a hold-to-block umbrella move in the falling-dates zone (the "Step 7 / Awaiting Decision" waiting zone with the calendar rain). While the player holds Down, the hero raises an umbrella and falling dates bounce off harmlessly instead of costing a life and restarting the 10-second countdown.

## How it plays

- Hold Down (keyboard Down Arrow / S, USB controller stick-down or D-pad down, mobile joystick pulled down) and an umbrella pops open above the hero.
- Falling calendar dates that hit the umbrella ping away with a sparkle; no life lost, countdown keeps running.
- Only active in the waiting zone. Anywhere else, pressing Down does nothing.
- While the umbrella is up the hero moves slower (holding still to shelter should be a real choice), and it does not block ground enemies, pits, or boss shots.

## Instructions and coaching

- Controls screen: new row in all three legends — keyboard ("↓ / S — Hold to raise umbrella"), touch ("Pull joystick down"), gamepad ("Stick down / D-pad down").
- Waiting-zone briefing screen: add a line saying you can hold Down to shelter under the umbrella while the 10 seconds run out.
- In-zone hint the first time dates start falling.
- Spanish strings for every new label.

## Technical notes

- `src/components/game/game-scenes.ts`: track a `duckHeld` input each frame (keyboard `isKeyDown`, gamepad pump, touch flag); expose `umbrellaManual` state. Reuse the existing umbrella visual at ~line 3790 so both the power-up umbrella and the manual one render the same, driven by `umbrellaActive(zone) || manualUmbrellaUp`.
- `src/components/game/managers.ts`: extend `EnemyManager.blocksDamage("boulder", zoneIdx)` to also accept a manual-block argument, keeping arbitration in one place. The existing boulder-bounce branch in the collide handler already does the right thing.
- `src/components/game/game-canvas.tsx`: add `down` to the `__gameInput` touch input object; extend `JoystickPad` to report a downward pull (vertical threshold, returns a separate `down` flag while still reporting -1/0/1 horizontally); forward gamepad `down` from the existing frame snapshot; add the new legend rows.
- `src/lib/i18n.ts`: new Spanish entries for the legend rows, briefing line and hint.

Nothing else about zone difficulty, scoring or other zones changes.
