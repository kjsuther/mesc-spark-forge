## Goal

Move score-name entry out of the page below the game and into the game window itself, styled like an SNES name-entry screen.

## New in-window name entry

Add a `ScoreEntryOverlay` rendered by `src/components/game/game-canvas.tsx`, absolutely positioned over the canvas (inside the same wrapper that already handles fullscreen/faux-fullscreen), so it appears in normal, fullscreen, and mobile layouts alike. Never shown in `presentation` (poster) mode.

Look and behavior:
- Full-bleed dark translucent backdrop with a chunky pixel panel: thick double border, navy fill, gold "Press Start 2P" text with 1-px shadows — matching the existing title screen.
- Header line: `★ NEW HIGH SCORE ★` when the run lands in the current top 10, otherwise `RUN COMPLETE`; then the score, and a one-line stat row (zone reached, docs, time).
- Two retro fields: `FIRST NAME` (max 12 chars) and `LAST INITIAL` (1 char), auto-uppercased, drawn as pixel character slots with a blinking cursor. Standard hidden text inputs power them so phone keyboards and desktop typing both work.
- Buttons: `SAVE` and `SKIP`, styled as SNES pad buttons like the existing touch controls. Enter submits, Escape skips.
- Prefills from the existing `trailGame.name.v1` localStorage entry.
- While the overlay is open, game input is swallowed: `R`, taps, and the reset button can't restart underneath it. Closing it (save or skip) returns to normal restart behavior.
- After a successful save: brief `SCORE SAVED` confirmation inside the panel, then it closes on its own.

## Wiring

- Game canvas receives the end-of-run `WinResult` it already forwards through `onWin`/`onLose`, holds it in local state, and opens the overlay.
- Submission logic (insert into `game_scores`, localStorage persist, query invalidation) is lifted out of `score-submit.tsx` into a small shared hook/function so the leaderboard still refreshes live.
- "Is this a high score?" is decided from the already-cached top-10 leaderboard query.
- `src/routes/tool.tsx`: remove the `<ScoreSubmit>` block below the canvas. The leaderboard and vote panel stay where they are.
- `score-submit.tsx`: keep `computeScore` (used by the result), drop the now-unused form UI.

## Verification

In a headless browser at desktop and mobile viewports, force a run end, and confirm: the panel renders over the canvas, typing works, saving inserts and updates the leaderboard, skip closes cleanly, no restart fires while the overlay is up, and nothing renders below the game window anymore.
