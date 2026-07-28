## 1. Upgrades only apply in "After feedback"

Today the flags come straight from the database in `src/routes/tool.tsx` and are pushed into the feature store in `src/components/game/game-canvas.tsx` regardless of the Before/After tab, so both versions get live upgrades.

- In `src/routes/tool.tsx`, build the flags map as all-`false` when `mode === "before"`, and from the enabled improvements only when `mode === "after"`.
- In `game-canvas.tsx`, the effect that calls `FeatureFlags.setFromDbFlags(...)` (and the realtime re-apply path) will pass an all-false map while in `before` mode, so a live vote landing mid-run never upgrades the "before" run.
- Same gating for the `/embed` route so the poster view matches.
- The "N of 5 improvements applied" counter stays as-is; the before tab keeps showing "Raw experience".

## 2. "Best on desktop" notice

On `/tool`, add a short high-contrast note near the game (above the canvas, visible on all screen sizes): best experienced on a desktop or laptop; mobile is playable but controls are cramped and the phone should be rotated to landscape. Also surface a compact version of that line inside the pre-game title screen area on touch devices.

## 3. Touch-enable the in-canvas high-score entry

`src/components/game/score-entry-overlay.tsx` currently relies on hidden inputs focused by taps, which is unreliable on iOS.

- Make the name/initial slot rows real tappable buttons that focus the hidden input (larger hit areas, `touchAction: manipulation`).
- Add visible SAVE and SKIP buttons sized for touch (min 44px tall) rather than keyboard-only flow.
- Ensure the overlay's pointer handlers don't swallow taps on its own controls, and that the on-screen keyboard doesn't push the panel out of the canvas (scrollable panel, centered).

## 4. Vote from inside the game canvas after a run ends

After the score entry step (save or skip), show a 16-bit vote panel inside the canvas whenever a voting round is active:

- Lists only round candidates whose improvement is not yet enabled (already-implemented upgrades are filtered out).
- Desktop: Up/Down (or Left/Right) arrows move a highlighted selection, Enter casts the vote; on-screen instruction line reads "Use ↑ ↓ to highlight · press ENTER to vote". Mouse click also votes.
- Mobile: each option is a large tappable row.
- Votes go through the existing `castRoundVote` server function with the same `getVoterId()` fingerprint used by the page-level panel, so a person gets one vote per round no matter where they cast it, and all votes are tallied together in the leaderboard/poster views.
- If the player already voted this round, show "YOU VOTED: <label>" instead of the picker; if no round is active, show a short "no vote open right now" line and skip straight to restart.
- After voting (or skipping), the normal "tap screen or press R to try again" flow resumes.
- The existing vote panel below the game (`src/components/game/vote-panel.tsx`) stays unchanged; both surfaces invalidate the same queries so counts update live in both places.

### Technical notes

- New component `src/components/game/vote-overlay.tsx`, rendered by `game-canvas.tsx` in the same overlay slot as `ScoreEntryOverlay`, sequenced: run ends → score entry → vote overlay → restart prompt. Disabled in `presentation` mode.
- Reuses `activeRoundQuery`, `improvementsQuery`, `myRoundVoteQuery`, and `castRoundVote`; no database or schema changes needed.
- Keyboard handling is scoped to the overlay and swallows the game's `R` restart key while open.
