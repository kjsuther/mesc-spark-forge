# Mobile controls: smaller footprint + reliable jump while steering

Two touch-only problems, no gameplay/physics/level changes and no desktop changes.

## 1. Controls take up too much screen

Today the pad sizes come from one number (`padUnit`, 20% of stage height, min 52 / max 84) and the joystick is drawn at 1.55x that — up to ~130px across, with JUMP at 1.15x. On a windowed phone canvas that is a large share of the play area, and the same numbers are reused in fullscreen, so the controls don't feel different between the two modes.

Changes:
- Size the controls from the *smaller* of the visible stage width and height, so a short windowed canvas gets small controls and a fullscreen landscape phone gets comfortable ones.
- Separate windowed and fullscreen scale factors: windowed play gets a noticeably more compact set (stick and JUMP both shrink), fullscreen gets today's roomier feel but capped so it never dominates.
- Lower the ceiling on all three controls (stick, JUMP, RESET) and shrink RESET further — it is used rarely and does not need a gameplay-sized target.
- Reduce the stick's own multiplier so it is close to the footprint of the two buttons it replaced rather than larger.
- Keep a minimum comfortable tap target (~44px) so the compact windowed set is still reliably pressable, keep safe-area anchoring, and keep the current 16-bit styling.

## 2. JUMP doesn't register while the stick is held

Reproduce first with a real two-finger sequence (touch emulation: finger 1 holds the stick, finger 2 taps JUMP mid-hold) and confirm the engine's jump request actually fires, before changing behavior. Likely contributors to check and fix in that run:

- The second touch being swallowed by the browser's own gesture handling (pinch/double-tap zoom) so JUMP never receives a `pointerdown`.
- The stick's pointer capture and `preventDefault` interfering with the second pointer's delivery.
- The jump request being cleared in the same frame it is set by another input path.

Fixes will be applied to whichever of these the reproduction shows, with the intent that:
- A JUMP tap during a held stick always sets the jump request, on the first tap.
- Holding a direction across the jump is uninterrupted — the hero keeps moving while airborne.
- Releasing either finger only affects its own control.

## Technical notes

- Files touched: `src/components/game/game-canvas.tsx` only (pad sizing constants, `JoystickPad`, `PadButton`), plus a touch-action / gesture rule in `src/styles.css` if the reproduction shows the browser is eating the second touch.
- No changes to `game-scenes.ts` input consumption unless the test proves the jump flag is being cleared there.

## Verification

Playwright with touch emulation and multi-touch dispatch, at a windowed phone viewport and a fullscreen phone-landscape viewport:
- Measure the rendered control sizes in both modes and confirm the compact windowed set.
- Hold the stick left, tap JUMP mid-hold, assert the hero leaves the ground while still moving; repeat holding right; repeat several taps in one hold.
- Screenshots of both modes for the visual footprint.
