# Regression suite for the game

Goal: one stored, repeatable set of checks that runs on every future update, so a new feature can't quietly break something that already worked (Zone 7 freeze, lost 1-UPs, unreadable warm-up plaques, broken scoring, etc.).

Two layers, both stored in the repo and both run by a single command.

## Layer 1 — Logic regression tests (fast, no browser)

Extends the existing `node --test` suite already in the project (viewport, lifecycle, scoring, score validation, security headers). New test files:

- **Lives and 1-UPs** — starting lives with/without the extra-lives upgrade, a 1-UP always adds a life (including when already at full), the hard cap of 5 holds, and an upgrade toggle mid-run can never take an earned life back.
- **Power-ups** — each pickup only spawns in its own zone while its upgrade is on, the chat shield and umbrella only block in the zone they belong to, the umbrella only blocks while Down is actually held, and the Navigator clears the boss exactly once.
- **Checkpoints** — snapshot saves only while safe and grounded, resume restores lives/docs/score/zone, and checkpoints are ignored when the upgrade is off.
- **Failure-screen checklist** — for each zone, the "still needed" list matches the objectives of that zone and the steps still ahead.
- **Controller input** — dead-zone and hysteresis rules: light drift never moves the hero, drift never opens the umbrella, D-pad / hat / stick all produce the same directions, and blur releases everything.
- **Translations** — every English string key has a Spanish counterpart and no key is missing on either side.

## Layer 2 — Playthrough smoke tests (real browser)

A stored Playwright script (`tests/regression/play.spec` plus a small helper) that drives the real game through a scripted run using the existing `window.__gameDebug` hook, at desktop 1280×800 and mobile landscape 844×390:

1. Home page and game canvas boot with zero console errors.
2. Warm-up briefing renders, and no two coaching plaques overlap (measured, not eyeballed — this catches the current warm-up defect and any future one).
3. Each step screen opens and dismisses, and gameplay resumes with the hero actually moving afterwards.
4. Zone-by-zone advance: the hero can move, jump, double jump, collect, and reach the door in every zone.
5. Zone 7 boss cinematic → after it ends, controls still respond (the exact freeze we just fixed) and the game clock is still advancing.
6. Bonus zone briefing opens and exits back into the main trail.
7. Death path: lose all lives, failure screen shows the "still needed" panel, restart works.
8. Win path: finish, high-score name entry accepts typed input in both windowed and fullscreen, and the thank-you screen renders.
9. Site routes (home, about, poster, team, feedback, backlog, scores) load without console errors.

Every failure writes a screenshot into a results folder so the break is obvious.

## Running it

- `npm run test:regression` — runs Layer 1 then Layer 2 and prints a pass/fail summary table.
- `npm run test` — unchanged, stays the fast logic-only run.
- The suite is documented in `REGRESSION.md`: what each case covers, how to run it, and the rule that any new gameplay feature adds its own case to this file in the same change.

I will run the full suite once after building it, fix anything it legitimately catches (including the warm-up plaque overlap still outstanding), and report the results.

## Technical notes

- Layer 1 uses the existing `node --experimental-strip-types --test` runner and targets the pure modules (`managers.ts`, `game-score.ts`, `gamepad.ts`, `i18n.ts`, `lifecycle.ts`) — no Kaplay instance needed.
- Gameplay logic that currently only lives inside the `game-scenes.ts` scene closure (the remaining-tasks checklist) gets extracted into a small pure helper module so it can be tested without booting the engine; behaviour is unchanged.
- Layer 2 uses Playwright against the dev server, driving input via real key events and reading state through `window.__gameDebug` (player position, zone, lives, gates). Where a full manual playthrough is too slow, the script warps via the debug hook to the zone under test, then plays that zone for real.
