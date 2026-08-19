# Make the USB joystick feel instant

Goal: left/right and the jump button on the Trooper 2 stick should respond on the very same frame you move them, with no perceptible lag.

## What's causing the delay today

Controller input travels through an extra hop: a background loop samples the stick, then hands the reading to the game on the browser's own animation frame, which writes it into a shared input object that the game engine reads on *its* next frame. Every hop can cost a frame, and jump presses can wait an extra frame before the engine notices them. Directions are also treated as pure on/off with a fairly wide engage threshold, so small early stick movement does nothing at all.

## The fix

1. Read the controller directly inside the game's own update loop (a "pull" each frame) instead of waiting for an outside loop to push it in. This removes the extra frame(s) between physical movement and the character reacting.
2. Sample the pad one more time immediately before the engine reads it, so the reading is always the freshest possible.
3. Jump: capture button presses as a one-shot request that is guaranteed to be consumed on the next engine frame and never dropped, including when the button is tapped and released quickly, or pressed while the stick is held.
4. Lower the direction engage threshold slightly and keep a small release threshold so the stick starts moving the hero earlier without chattering at rest.
5. Optional feel improvement: scale walk speed with how far the stick is pushed (analog), while a full push matches today's top speed. Digital hats/D-pads still read as full speed.
6. Keep the existing safety behaviors: release movement on unplug, window blur, tab hide, and menu/prompt handling stays as it is.

## Scope

- `src/lib/gamepad.ts` — expose a synchronous "read current state now" function plus fresh sampling; tune thresholds.
- `src/components/game/game-canvas.tsx` — during a live run, drive movement/jump from the per-frame read instead of the subscription; keep the subscription for menus, demo mode and prompts.
- `src/components/game/game-scenes.ts` — hook the per-frame read into the engine update where the shared input object is consumed.

No visual, scoring, level design or website changes.

## Verification

Build passes, and a controller run shows immediate left/right start-stop and reliable jumps while steering. Keyboard, touch joystick and demo mode behave exactly as before.
