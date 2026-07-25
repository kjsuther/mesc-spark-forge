# Full QA Audit & Fix Plan — "Blazing the Trail to Coverage"

Goal: run a real, evidence-based QA pass (code + runtime) across every system, then land fixes in prioritized waves with regression re-tests between them. No assumptions — every claim backed by a code read or a Playwright observation.

## Phase 1 — Instrumented exploration (read-only)

1. **Code inventory.** Re-read the full engine and its neighbors so nothing is inferred:
   - `src/components/game/game-scenes.ts` (all ~2330 lines)
   - `src/components/game/game-canvas.tsx`
   - `src/components/game/leaderboard.tsx`, `score-submit.tsx`
   - `src/routes/tool.tsx`, `src/routes/admin.game.tsx`, `src/routes/admin.poster.tsx`
   - Asset pointers under `src/assets/game/*`
2. **Static defect sweep.** Grep for known risk patterns: `onCollide`, `add([`, `anchor(`, `z(LAYERS`, `GROUND_Y`, `BIOME_W`, `spawnGrounded`, `spawnAirborne`, `spawnDoor`, `zoneObjectives`, `zoneState`, `startFireworks`, every `showHint`, all `door` / `id-card` / `fire-pole` / `pole-base` tags. Log any dangling tags, unhandled collisions, or unreachable branches.
3. **Asset ledger.** Enumerate every `.asset.json` under `src/assets/game/`, cross-check each is loaded via `safeLoadSheet` / `safeLoadBackground` and referenced by at least one zone. Flag orphans and missing frames.

## Phase 2 — Runtime UAT via Playwright

Two viewports, headless Chromium, screenshots at every checkpoint into `/tmp/browser/qa/`:
- Desktop 1280×1800
- Mobile 390×844 landscape 844×390

For each zone (1→8), scripted playthrough exercises:

| System | Checks |
|---|---|
| Player | idle, run cycle (leg tracking), jump arc, coyote/buffer window, landing snap, i-frames blink, sprite flip, foot-on-grass alignment |
| Physics | gravity constant, terminal fall, platform inheritance, no floating/sinking, no clipping through door barrier (jump-over test at 560 px) |
| Collision | player↔ground, ↔platform, ↔enemy, ↔collectible, ↔door (locked & unlocked), ↔id-card, ↔fire-pole (gated & un-gated), ↔pole-base |
| Objectives | Zone 1 method touch, Zone 2 user+pass, Zone 3 far-bank gate, Zone 4 3 docs, Zone 5 all mailboxes, Zone 6 30 s timer under boulders, Zone 7 plan pick → key, Zone 8 ID card → slide → fireworks |
| Camera | follow, no exposed void at biome seams, integer snap, no jitter at high speed |
| Rendering | background scale/aspect per biome, no seams at BIOME_W boundaries, layer order (BG < GROUND < PROP < ACTOR < HUD < EFFECT), no z-fighting, no sub-pixel shimmer |
| HUD | live SCORE accumulation, 3 application-card lives, objective label per zone, hint fade, debug overlay (`D` / `?debug=assets`) |
| Mobile | touch buttons don't overlap gameplay in fullscreen, restart button, tap-to-restart overlays, no gesture hijack |
| Post-game | ScoreSubmit appears on both win & loss, leaderboard auto-refresh 5 s, name persistence |
| Perf | FPS sample per zone, GC pauses, asset load count, no runtime `safeLoad` fallbacks |

Each defect logged with: Severity · Category · Description · Expected · Actual · Root cause · File+line · Fix · Regression risk · Retest.

## Phase 3 — Fix waves (priority-ordered, re-test between waves)

**Wave A — Critical (blockers to completion):** any zone that can't be finished, any crash, any door skipped, any objective that auto-satisfies, any missing collide handler, any sprite that renders as magenta fallback.

**Wave B — High (progression / correctness):** wrong HUD state, wrong life/score math, respawn to wrong zone, i-frame gaps, camera exposing void, background seam gaps, sprite hitbox mismatch >4 px.

**Wave C — Medium (feel & polish):** animation phase glitches, jitter, hint timing, control latency, mobile control ergonomics in fullscreen, leaderboard refresh edge cases.

**Wave D — Low (art direction):** palette drift, decor spacing, speech-bubble contrast, missing parallax layers.

After each wave: re-run the full zone-by-zone Playwright script and diff screenshots against the previous pass to catch regressions in movement, rendering, physics, animation, UI, and post-game flow.

## Phase 4 — Final QA report (delivered in chat)

- Executive summary (completion %, defect counts by severity, pass rate)
- Gameplay / Technical / Art-direction scores
- Requirement compliance table (every previously-stated requirement → PASS / PARTIAL / FAIL + evidence)
- Ordered bug list (Critical → Low), each in the defect-report format above
- Prioritized remediation list of anything not fixed this pass, with regression-risk notes
- Explicit "cannot test" callouts for anything blocked by missing tooling (e.g. audio isn't implemented — will be marked N/A rather than PASS)

## Technical notes

- All exploration and Playwright runs stay under `/tmp/browser/qa/`; no repo writes during Phase 1–2.
- Fixes edit `src/components/game/game-scenes.ts` primarily; UI-only fixes stay in `game-canvas.tsx`. Asset regenerations use `imagegen` only when a real asset defect is confirmed (not speculatively).
- Any DB schema touch (unlikely) goes through a migration with GRANTs + RLS.
- Kaplay init constants (`LOGICAL_W/H`, `PIXEL_DENSITY`) are treated as invariants — no changes without an explicit rendering defect tied to them.

## Scope confirmation

This is a large pass — expect several build-mode turns: one for Phase 1+2 (audit + report of findings), then one turn per fix wave with re-test. If you'd rather I fix as I go in a single long turn instead of pausing for a mid-audit report, say "fix as you go" when approving.
