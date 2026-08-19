# "Still Needed" checklist on the failure screen

When a run ends because all lives are gone, the failure screen keeps everything it shows today (title, message, sad hero, restart prompt) and gains one new 16-bit panel: a checklist of what the player still had left to do.

## What the panel shows

A framed pixel panel headed **STILL NEEDED AT THIS STEP**, listing:

1. **The unfinished parts of the step you died on**, with checkbox glyphs so finished sub-tasks read as done and unfinished ones stand out:
   - Step 1 (Apply): pick an application method
   - Step 2 (Create account): collect username / collect password (each ticked if already grabbed)
   - Step 3 (River): cross the river to the door
   - Step 4 (Documents): the remaining count, e.g. "2 of 3 verification documents"
   - Step 5 (Answer the call): remaining mailbox replies, e.g. "3 of 4 replies"
   - Step 6 (Await decision): survive the 10-second wait
   - Step 7 (Choose a plan): pick a plan / defeat the bear / grab the key — only the ones not yet done
   - Step 8 (Coverage begins): grab the medical ID card / slide down the pole
2. **The steps still ahead**, as a short "…then:" list of the remaining step names (Steps after the one you lost at), trimmed to the last few with a "+N more steps" tail if it would overflow.

If a player somehow dies with the current step complete, the panel shows only the road ahead.

## Look and feel

- Same pixel font, chunky 3px border, dark navy fill with a lighter inner edge — matching the existing briefing/step plaques.
- Header in warm yellow, unfinished items in white with a `☐`, already-done items dimmed with a `✓`.
- Sized with the same fitted UI scale the failure screen already uses, so it stays readable windowed, fullscreen and on mobile landscape.
- Placed on the right side of the failure screen (the sad hero stays bottom-left, untouched). On narrow screens it drops below the message instead, and the existing restart prompt shifts down just enough to clear it — no wording changes anywhere.
- Rebuilt on relayout with the rest of the screen, and cleared with it.

Full Spanish translations for every new label.

## Technical notes

All in `src/components/game/game-scenes.ts` plus new strings in `src/lib/i18n.ts`:

- New `remainingTasks(zone)` helper near the objective definitions, reading `zoneState`, `player.docs` and the existing `zoneObjectives[z].met()` so the checklist can never disagree with the HUD objective badge.
- New `STEP_NAMES` lookup (reusing the existing step/briefing titles) for the "steps ahead" list.
- `showEnd()`'s `render()` gains a `drawStillNeeded()` block that builds the panel from `remainingTasks(player.farthestZone)`; it only runs when `win === false`, so the WIN and thank-you screens are untouched.
- No change to scoring, `buildResult`, the failure message copy, the vote/score overlays, or any zone behavior.
