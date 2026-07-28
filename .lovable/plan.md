## What changes

Out: the 5 preset enhancements + toggles, live vote rounds (vote panel, in-game vote overlay, poster vote chart), and the live-coding "Build Theater" animation.

In: a real feedback backlog that players write to, admins rank and ship, and both the public site and Poster View display.

## 1. Feedback backlog (new data)

New table `game_feedback`:
- `description` (short text, required)
- `submitter_name` (first name + last initial, e.g. "Kevin S.")
- `status`: `backlog` | `implemented`
- `rank` (admin-controlled ordering)
- `implemented_at`, `created_at`, `updated_at`
- Public may read all rows (nothing sensitive stored) and insert new ones; only the admin session can update, reorder, delete.

The existing site-feedback table stays untouched.

## 2. Player-facing (tool page)

- **Submit form** below the game: short description + first name + last initial, with a thank-you confirmation. Light rate/length validation.
- **Feedback board** below the form, in two columns:
  - *In the backlog* — ordered by the admin's rank.
  - *Implemented* — newest first, with a count badge.
- **Before / After tabs**:
  - "After Feedback" is now the **default**.
  - "Before Feedback (Original Version)" is a manual click and runs the frozen original game.
  - The counter next to the tabs becomes "N player suggestions implemented" (no longer capped at 5), and the After view lists the implemented items.
- Remove the vote panel, the in-game vote overlay, and the Build Theater from this page.

## 3. Frozen original build

Today's game code is copied once into `src/components/game/original/` and wired to the "before" tab. That copy is never edited again; all future feedback changes go into the live game used by "After Feedback". The feature-flag plumbing (`game-features.ts`, flags props) is deleted from both.

## 4. Admin site

New **Feedback** admin page (and a card on the admin index):
- Backlog list with drag-or-arrow reordering that writes `rank` — this order is exactly what players and the Poster View see.
- Per item: edit description/name, **Mark Implemented**, **Move back to Backlog**, delete.
- Implemented list with the date shipped.
- Counts at the top (backlog / implemented).
- The old Game admin page loses the upgrade toggles, round controls, and build-run controls; it keeps the leaderboard/settings pieces.

## 5. Poster View

- Vote chart and build animation removed.
- Shows the ranked backlog and the implemented list side by side with the leaderboard, live-updating.

## Technical notes

- Data access follows the existing pattern: public reads via the browser client with RLS + grants; all admin writes through `createServerFn` in a new `src/lib/feedback.functions.ts` guarded by `requireAdmin()`.
- Realtime subscription on `game_feedback` so the tool page and Poster View update instantly when an admin ships an item.
- Files removed: `src/components/game/vote-panel.tsx`, `vote-overlay.tsx`, `src/components/build-theater.tsx`, `src/lib/build-scripts.ts`, `src/lib/game-features.ts`, plus the vote/build server functions and queries.
- Old tables (`game_improvements`, `game_improvement_votes`, `game_vote_rounds`, `game_round_candidates`, `game_improvement_pool`, `game_build_runs`) are dropped in the same migration once the code no longer reads them.
- `embed.tsx` follows the same default-to-After behavior.
