# Code review follow-up: one version, coherent scoring, safer recovery, lighter assets

No new gameplay features. Five workstreams, in the order below.

## 1. Drop the two-version toggle

Confirmed: the "frozen original" build is not actually different — `src/components/game/original/game-scenes.ts` differs from the live file by 4 lines of import paths only. The Original/Current tabs present a distinction that does not exist.

- Delete `src/components/game/original/`.
- Remove the mode tabs from `/tool` (and the embed view); the page renders one game.
- Collapse `mode: "before" | "after"` out of `GameCanvas`, `game-scenes.ts`, and the score-entry overlay.
- Leaderboard: stop splitting/labelling by mode; show one board.
- Database: `game_scores.mode` stays in the table so existing rows are untouched. New submissions write a single constant value, and `score-validation.ts` keeps accepting the old values so nothing already saved breaks.

## 2. Recovery must preserve the whole run

Today recovery remembers only the last safe zone, so a player who backgrounds Safari mid-run restarts the scene with a fresh timer and an artificially fast finish.

- Keep a live run snapshot (elapsed ms, score, banked speed bonus, lives, documents, deaths, per-zone splits, farthest zone) updated at each zone boundary and on page-hide.
- On WebGL context loss / recovery, restore that snapshot into the new scene instead of only the zone index; the clock resumes from the saved elapsed time.
- If a snapshot is older than a few minutes or looks inconsistent, end the run rather than resume it — never award a finish time the player did not earn.

## 3. One coherent par model

Keep the two-layer design but make the numbers agree, and remove the duplicate reward.

- Whole-run par becomes 244s (the sum of the eight advertised zone pars) instead of 150s, so a player who hits every zone par lands on a neutral x1.0 multiplier rather than being penalised.
- Keep the per-zone pace bonuses exactly as advertised in the hint text.
- Remove the separate end-of-run finish bonus — finish speed is already paid by the multiplier.
- Keep the win bonus, per-life bonus, and the sub-point tiebreaker.
- Verify with representative runs: par run, fast win, slow win, early death, late death. A death can never out-score a finish.

## 4. iPhone memory pressure

Assets are ~15 MB and almost everything is decoded and re-processed up front, which is the likely cause of blacked-out text and lost WebGL context after returning to the tab.

- Load per-zone backgrounds on demand instead of all eight at boot; keep shared sprite sheets in the boot pass.
- Cache processed sprite frames so re-entering a scene reuses them instead of rebuilding canvases and data URLs.
- Convert the large backgrounds and the heaviest sprite sheets to WebP (the biggest offenders are ~0.7–1.2 MB each).
- Release textures, canvases, and data URLs for scenes that are no longer reachable.
- Add an iPhone-profile check (background/foreground the tab mid-run, force context loss) to the manual test pass.

## 5. Engineering baseline

- Add tests for: score computation across the five representative runs, zone-split timing, recovery snapshot restore, and score-submission validation.
- Make the `@tanstack/router-core` import in `src/routes/admin.tsx` explicit — add it as a direct dependency or replace `isServer` with a public re-export so a strict install resolves.
- Repair the lint baseline: run the formatter across the repo in one pass so the ~1,748 mostly-formatting issues clear, then keep lint clean.
- Leaderboard scores stay client-trusted for now (acceptable for the conference demo); noted, not addressed in this pass.

## Technical notes

- Files most affected: `src/components/game/game-scenes.ts`, `game-canvas.tsx`, `leaderboard.tsx`, `score-entry-overlay.tsx`, `src/routes/tool.tsx`, `src/routes/embed.tsx`, `src/lib/score-validation.ts`, `src/assets/game/*`.
- Existing leaderboard rows were scored under the old formula and stay as-is unless you want the board reset before the conference (an admin reset already exists).
