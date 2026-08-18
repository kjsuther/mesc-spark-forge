# Poster-mode end screen + clear feedback confirmation

## 1. Poster View: show the score/feedback screen when a run ends

Today the in-canvas end screen is explicitly suppressed whenever the game runs in poster/embed mode, so a death or a win drops straight back to the title screen with no chance to enter a name or get to the feedback link.

Change:
- Show the end-of-run name entry + feedback overlay in poster mode too, exactly as it appears on the normal Play page.
- Keep attract/demo runs unscored: while demo mode is playing itself, a death or win still just loops the demo (no overlay).
- In poster mode the overlay's "TELL US WHAT TO FIX" link opens the feedback page in a new tab, so the poster iframe itself never navigates away from the game.
- Existing behavior kept: "Play Again" restarts in place, "Skip"/"Title Screen" returns to the title, and the idle timer then resumes demo mode after 60s.

## 2. Feedback submission confirmation

Today submitting shows only a small corner toast while the list underneath re-fetches, which reads as "the page just refreshed."

Change:
- After a successful submit, replace the form with a clear confirmation panel: "Feedback received" headline, a short line that the poster team reviews it live, and buttons to add another idea, view the backlog, and go back to the game.
- Keep the success toast as a secondary signal, keep errors inline as they are today.

## Technical notes

- `src/components/game/game-canvas.tsx`: drop the `!presentation` condition gating `ScoreEntryOverlay`; pass a flag so the feedback link uses `target="_blank"` in presentation mode.
- `src/components/game/score-entry-overlay.tsx`: accept an optional `externalFeedbackLink` prop for the new-tab behavior.
- `src/components/game/feedback-form.tsx`: add a `submitted` state rendering the confirmation panel with a "Submit another" reset.
- No database, server function, or scoring changes.
