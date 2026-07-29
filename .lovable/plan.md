## Goal

When a run ends in fullscreen (mobile or desktop), the player can actually type their first name and last initial into the high-score panel.

## What's in the code today (verified)

`src/components/game/score-entry-overlay.tsx` doesn't use real visible fields. It draws fake "pixel slots" and keeps two real `<input>` elements pushed off-screen (`left: -9999`, 1px, opacity 0), focused only when the player taps a slot area. It also installs a capture-phase `keydown`/`keyup` listener on `window` that calls `stopPropagation()` on every key, to stop the game's `R` restart from firing.

Both of those break down in fullscreen:
- The off-screen inputs sit outside the fullscreen element's visible area, so mobile keyboards often don't open or the caret focus is dropped, and taps on the fake slots race with the canvas' own pointer handling.
- The window-level capture blocker intercepts keys before they reach the input, so desktop key handling in the panel is fragile too.

## The fix

1. **Use real inputs as the visible fields.** Replace the fake `Slots` + hidden-input pair with two actual `<input>` elements styled in the same 16-bit look (Press Start 2P, navy fill, gold border, blocky caret, uppercase, letter-spaced). Keep the same limits: 12 chars for first name, 1 char for the last initial. This makes tap-to-focus native, so it works identically in windowed, faux-fullscreen, and native fullscreen.
2. **Scope the key blocker.** Stop swallowing keys at the window; instead keep the game from acting on keys while the panel is open (guard the game's key handling on an "overlay open" flag), and keep Escape closing the panel. Typing then reaches the inputs normally.
3. **Autofocus reliably in fullscreen.** Focus the first-name input after the overlay mounts, and re-focus on the next frame after any fullscreen transition, so the keyboard opens with the panel.
4. **Keep the panel inside the visible fullscreen box.** Ensure the overlay scales with the same UI scale used by the fullscreen menus, and that the panel + Save/Skip buttons stay above the on-screen keyboard on short landscape screens (scrollable container, keyboard-aware padding).
5. **Verify** in an emulated mobile landscape fullscreen run and on desktop: type a name, save, confirm the score lands on the board.

## Technical notes

- Files: `src/components/game/score-entry-overlay.tsx` (main rewrite of the input layer), `src/components/game/game-canvas.tsx` (overlay-open flag passed to the game / key guard and UI scaling for the overlay).
- No database, schema, or scoring-logic changes — this is presentation and input handling only.
