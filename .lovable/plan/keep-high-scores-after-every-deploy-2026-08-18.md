# Keep high scores after every deploy

## What I checked first

- Scores are stored in the backend table `game_scores`, not in the app bundle or browser storage. Publishing a new build does not touch that table, and no database migration in the project deletes, drops, or recreates it.
- The only code path that removes scores is the "Wipe leaderboard" button on Admin → Demo Game, which runs an admin-only server function that deletes every row.
- The table currently holds exactly **1 row**, created 18:34 UTC today. So rows really are disappearing — this is data loss, not a display filter or a per-version leaderboard.

Because nothing records who deleted what or when, I can't yet prove which path emptied the table. The plan therefore makes deletion recoverable and auditable first, so the next occurrence is explained instead of guessed at.

## What will change

### 1. Scores become recoverable instead of gone

Add an archive table that keeps a copy of every score row. A database trigger copies a row into the archive whenever it is deleted from the live leaderboard. Nothing about how scores are submitted or displayed changes — the public leaderboard reads exactly as it does now.

This means a future wipe (accidental or not) can be restored in full, and we can see the exact timestamp of the loss.

### 2. An audit record for every wipe

The admin wipe action will write a record: when it ran and how many rows it removed. Admin → Demo Game will show "Last wipe: <date/time> (<N> scores)" next to the button, plus a "Restore last wipe" action that pulls the archived rows back into the live leaderboard.

The wipe button itself stays where it is, as requested.

### 3. Close the accidental-activation path

The USB controller navigation currently runs on every page, and its confirm button clicks whatever element has focus — including admin buttons. Controller navigation will be disabled on `/admin/*` routes so a stray controller press can never reach destructive admin controls.

### 4. Make failed score saves visible

Right now, if a save fails (validation or the 5-second anti-spam cooldown between submissions on the same device), the in-game entry screen shows a generic "could not save" and the run is lost silently. Two fixes:
- Show the actual reason (for example "wait a few seconds and press save again") so a kiosk player can retry.
- Relax the shared cooldown so back-to-back players on the same kiosk device are not blocked from saving.

### 5. Confirm nothing in the deploy pipeline resets data

After the archive is in place, I'll verify by inserting a test row, and confirming it survives a rebuild — and that the archive captures anything that removes it.

## Technical notes

- New migration: `public.game_scores_archive` (same columns plus `deleted_at`), `GRANT` for `service_role` only, RLS enabled with no public policies; `AFTER DELETE` trigger on `game_scores` inserting into the archive.
- New migration: `public.leaderboard_wipes` (`id`, `wiped_at`, `row_count`), service_role only.
- `resetLeaderboard` in `src/lib/game.functions.ts`: count rows, delete, insert a wipe record; add `restoreLastWipe` (admin-only) that re-inserts archived rows from the most recent wipe window.
- `src/routes/admin.game.tsx`: show last-wipe info and a restore button.
- `src/hooks/use-gamepad-navigation.ts`: bail out when `location.pathname` starts with `/admin`.
- `src/components/game/score-entry-overlay.tsx`: surface the server error message; `src/lib/public-submission.server.ts`: reduce the score cooldown so consecutive players can submit.
