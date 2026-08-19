# Regression suite — Blazing the Trail to Coverage

Run this before shipping any change to the game or the site. It exists so a new
feature can't quietly break something that already worked.

```bash
npm run test:regression     # logic tests + real-browser playthrough
npm run test                # logic tests only (fast, ~1s, no browser)
```

The browser layer needs the dev server running on `http://localhost:8080`
(override with `REGRESSION_BASE_URL`). Failures write a screenshot into
`tests/regression/results/`.

**Rule for new work:** any new gameplay feature, upgrade, zone or mechanic adds
its own case here in the same change.

---

## Layer 1 — logic tests (no browser)

Node's built-in test runner over the pure modules.

| File | Covers |
|---|---|
| `src/components/game/managers.test.ts` | Starting lives (3 / 5 with the portal upgrade); 1-UPs always add a life and cap at 5; an upgrade reconcile can never take an earned life back; turning an upgrade on mid-run grants lives immediately and turning it off never kills the player; each pickup only spawns in its own zone while its upgrade is on and never respawns once used; switching an upgrade off revokes what it granted; the chat shield and umbrella only block in their own zone; the umbrella only blocks while Down is actually held; pits always hurt; the Navigator clears the boss exactly once; power-ups survive a checkpoint round-trip; checkpoints only save while safe, grounded and enabled, and vanish when the upgrade is switched off; the HUD lists only active upgrades. |
| `src/components/game/still-needed.test.ts` | The failure-screen checklist for every zone: one task minimum per zone, nothing pre-ticked, everything ticks when done, counted tasks show the right remaining number and plural, and over-collecting never yields a negative count. |
| `src/lib/gamepad.test.ts` | Arcade-stick rules: centred stick moves nothing; resting drift never moves the hero and never opens the umbrella; a real push moves and releasing stops; opposite directions can't both win; stick, secondary axis pair and D-pad agree; umbrella hysteresis holds through wobble and closes on release; every face button jumps once per press; with no pad connected, keyboard/touch input is left untouched. |
| `src/lib/i18n.test.ts` | English passes through unchanged; Spanish never returns blank; unknown strings fall back to English; multi-line blocks keep their line count; number-carrying strings keep their numbers. |
| `src/components/game/viewport.test.ts` | Canvas sizing / letterboxing math. |
| `src/components/game/lifecycle.test.ts` | Backgrounding, context loss and snapshot resume rules. |
| `src/lib/game-score.test.ts` | Final score, time weighting and zone bonuses. |
| `src/lib/score-validation.test.ts` | High-score submission validation. |
| `src/lib/security-headers.test.ts` | Response headers and the poster iframe allowance. |

## Layer 2 — browser playthrough (`tests/regression/game_regression.py`)

Playwright drives the live game through the hooks it already exposes
(`window.__gameDebug`, `window.__gameInput`, `window.__gamePrompt`), at desktop
1280×800 (full pass) and mobile landscape 844×390 (boot + controls pass).

| Case | Guards against |
|---|---|
| Site routes load without console errors | A broken route or runtime error on home / about / poster / team / feedback / backlog / scores |
| Game boots and exposes its debug hook | The canvas failing to start (WebGL, asset, bundling regressions) |
| No console errors during boot | New errors sneaking in at start-up |
| Physics crash guard is installed | Losing the guard that keeps a pause-related engine error from killing the frame loop |
| Warm-up coaching plaques do not overlap | Unreadable overlapping signs on small/landscape screens |
| Hero walks / hero jumps | Input pipeline or physics regressions |
| Every zone accepts input after its step screen | A zone that boots frozen (the finale cutscene is excluded on purpose) |
| Game clock keeps running after the boss cinematic | The Zone 7 freeze regression |
| Controls respond after the boss cinematic | Same, from the player's side |
| Losing the last life ends the run | Death handling |
| Failure screen lists what was still needed | The "still needed" checklist disappearing |
| Restart after a failure starts a fresh run with full lives | A stuck end screen or lives not resetting |

## Interpreting a run

The suite prints a `PASS`/`FAIL` line per case and a summary table, and exits
non-zero if anything failed. Fix the failure or, if the behaviour changed on
purpose, update the case in the same change so the suite keeps telling the
truth.
