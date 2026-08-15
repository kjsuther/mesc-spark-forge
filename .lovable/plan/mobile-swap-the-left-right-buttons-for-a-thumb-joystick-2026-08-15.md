# Mobile: swap the left/right buttons for a thumb joystick

On touch devices only, replace the two separate LEFT / RIGHT pad buttons with a single compact digital joystick. Direction changes then happen inside one continuous touch, so sliding the thumb from left to right flips movement instantly instead of requiring a release-and-retap.

Desktop keyboard, gamepad, JUMP and RESET stay exactly as they are today. No gameplay, physics, or level changes.

## How it feels

- A small round pad sits where the D-pad is now (bottom-left, inside the safe area) — roughly the footprint of the two buttons it replaces, so it takes no extra room.
- Press anywhere on the pad: a knob appears under the thumb and tracks it.
- Push left or right past a small dead zone to move; slide across the center to reverse direction with no gap in input.
- The thumb can drift outside the pad and still keep steering (no dropped input at the edge); lifting, cancelling, or losing the pointer returns it to neutral.
- Only left/right are used — vertical thumb movement is ignored, so jumping stays a separate button and can be held at the same time (multi-touch preserved).
- Subtle 16-bit styling matching the existing pad buttons: dark ring, gold knob, no new colors.

## Technical notes

- New `JoystickPad` component in `src/components/game/game-canvas.tsx`, rendered in place of the two `PadButton`s inside the existing `launchMode && isTouch` overlay block. `PadButton` stays for JUMP/RESET.
- Pointer handling: `pointerdown` sets the origin and calls `setPointerCapture`; `pointermove` computes horizontal offset; `pointerup` / `pointercancel` / `lostpointercapture` / blur reset to neutral. Same stale-pointer takeover guard already used by `PadButton`.
- Writes to the existing `window.__gameInput` bridge (`left` / `right` booleans) via the current `setBtn` helper — engine code in `game-scenes.ts` is untouched.
- Dead zone ~18% of the pad radius; setting one direction always clears the other in the same update so both can never be true.
- `touch-action: none` and non-passive handlers to stop scroll/gesture interference.
- Sized from the existing `padUnit` value so it scales the same way across phone / tablet / landscape.
- The in-game Controls screen's touch variant is updated to describe the joystick instead of the left/right buttons.

## Verification

Playwright touch-emulation run on a phone-landscape viewport: press-and-hold left moves the hero left, slide across to the right in one gesture reverses movement without a neutral gap, lift returns to idle, and holding the stick while tapping JUMP still jumps.
