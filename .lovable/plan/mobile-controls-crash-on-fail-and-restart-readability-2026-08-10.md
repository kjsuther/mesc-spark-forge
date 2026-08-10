# Mobile controls, crash-on-fail, and restart readability

Three separate mobile bugs. One has a confirmed cause; the other two get a short verify step before the fix, so we don't patch the wrong layer.

## 1. Left/Right stop while still held (confirmed cause)

The on-screen pad buttons release movement on `onPointerLeave`. Because the button uses pointer capture and also shifts down 2px while pressed (`active:translate-y-[2px]`), a finger that drifts a few pixels — or the button moving under a stationary finger — fires a leave event and clears the direction, so the hero takes a few steps and stops.

Fix:
- Stop treating `pointerleave` as a release. Track the active `pointerId` per button and release only on `pointerup`, `pointercancel`, or `lostpointercapture` for that same pointer.
- Add a window-level safety net (`pointerup`/`pointercancel`/`blur`/tab hidden) that clears any still-held direction, so a button can never stick if the browser eats the up event.
- Drop the press-time translate on the pad buttons (keep a color/inset press state instead) so the control never moves out from under the finger.
- Keep multi-touch working: holding LEFT while tapping JUMP must continue to move.

## 2. "Game failed to load" (shader error) after failing a run

Verify first: reproduce a losing run in a simulated mobile browser, capture the exact console error and whether a second engine boot happens on the same page. Likely source is a new WebGL context being created for a fresh canvas while the previous engine's context is still alive (browsers cap live contexts, and the next boot then fails at shader compile).

Fix once confirmed:
- Guarantee the previous engine is fully torn down (engine quit + context release) before a new canvas/engine is created, and never boot two engines concurrently.
- Make the failure path reuse the existing engine instead of re-booting where a reboot isn't needed.
- If a boot does fail, show a recoverable "Tap to retry" state that retries a clean boot rather than a dead-end error card.

## 3. Text unreadable (covered in black) after restart

Verify first: fail a run, restart from the in-game prompt, and screenshot the next zone to confirm whether the black is a leftover full-screen overlay rect from the game-over screen, a stale transition fade, or corrupted glyph rendering.

Fix by cause:
- Leftover overlay/fade: explicitly destroy the game-over overlay and cancel any running fade controllers before the scene restart, and clear fixed-layer objects on scene entry.
- Glyph/atlas corruption: rebuild text rendering on restart (fresh engine boot for that path) so the label atlas is regenerated.

## Verification

Playwright runs at iPhone SE, iPhone 15 landscape, and Pixel 7: hold LEFT for 3+ seconds and assert continuous movement; hold LEFT + tap JUMP; complete a losing run and assert no error card and a clean console; restart from the fail screen and screenshot the next zone to confirm readable text. Desktop keyboard path re-checked for no regression.

## Technical notes

- Files touched: `src/components/game/game-canvas.tsx` (pad buttons, engine boot/teardown, error state) and `src/components/game/game-scenes.ts` (overlay/fade cleanup on restart).
- No gameplay constants, scoring, or zone content change.
