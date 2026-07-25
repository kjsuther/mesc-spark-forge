
## Goal

Fix remaining sprite/rendering issues and expand the game from 5 zones to 8 zones matching the real Medicaid application journey. Add new backgrounds, prop sprites, obstacles, and collectibles to the art library.

## Part 1 — Comprehensive art audit

Inspect every existing asset in `src/assets/game/` (5 backgrounds + 2 sprite sheets) and verify:

- **Sheet grid math**: `character-sheet.png` is loaded as 3 cols × 2 rows (6 frames), `props-sheet.png` as 4 cols × 3 rows (12 frames). Re-open the actual PNGs and confirm each frame sits in its declared cell with transparent margins. If any frame bleeds into an adjacent cell, the alpha-trim pipeline will grab the wrong pixels and cause the "cut-off head / floating monster" class of bugs the user has been seeing.
- **Frame integrity**: for each sprite name in `DISPLAY_H`, render just that trimmed frame to a debug PNG and eyeball it (head, feet, and left/right edges present, no neighbor bleed).
- **Backgrounds**: confirm each biome PNG is a seamless 1200×540-ish parallax band, no watermark, no cropped subjects.

Any sheet that fails the audit gets regenerated (via `imagegen`) with an explicit uniform-cell prompt and clear inter-frame padding, then re-trimmed by the existing `loadTrimmedSheet` pipeline (no code change needed once the source PNG is clean).

## Part 2 — Zone restructure (5 → 8)

New `ZONES` array, in order, with themed labels:

1. `forest` — **Finding the Trail** (Step 1 · Learn you may qualify) — unchanged
2. `signup` — **Setting Up Camp** (Step 2 · Create your account) — NEW
3. `river` — **Crossing the River of Paperwork** (Step 3 · Start your application) — was Zone 2
4. `town` — **Gathering Supplies** (Step 4 · Gather your documents) — was Zone 3, relabeled
5. `relay` — **Answering the Call** (Step 5 · Respond to requests for information) — NEW
6. `mountain` — **Waiting Mountain** (Step 6 · Await a decision) — was Zone 4
7. `market` — **Choosing Your Path** (Step 7 · Pick a health plan) — NEW
8. `clinic` — **Coverage Begins** (Step 8 · Enroll in coverage) — was Zone 5

`LEVEL_END`, camera bounds, zone-index math, `FAILURE_MESSAGES`, `OVERLAY_TITLES`, and admin/leaderboard "farthestZone" copy all extend from 5 to 8 entries. Every new zone gets a continuous ground span (no impossible gaps) plus one small teaching obstacle so it's beatable on first try.

## Part 3 — New art assets

Generate three new backgrounds and one new props sheet (SNES 16-bit style, matching the existing palette and horizon line so parallax stitching is invisible):

- `src/assets/game/bg-signup.png` — dusk campsite with tents, lantern, laptop-on-log motif (account creation)
- `src/assets/game/bg-relay.png` — telephone-pole prairie with mailboxes and signal towers (requests for info)
- `src/assets/game/bg-market.png` — plan-selection market stalls with health-plan banners

New props sheet `src/assets/game/props-sheet-2.png` (4×3 grid, uniform cells, transparent gutters) with:

- `laptop` (collectible) — account setup
- `password-lock` (obstacle) — 2-factor block
- `phone-ring` (collectible) — respond to RFI
- `mailbox` (obstacle) — missed mail
- `clipboard-question` (enemy) — the RFI form-monster variant
- `plan-card-a`, `plan-card-b`, `plan-card-c` (collectibles) — pick a plan
- `nurse` (NPC decor)
- `insurance-card` (final collectible)
- 3 filler decor slots (fern, cactus, cloud) to fill the sheet

Loaded through the same `loadTrimmedSheet` call as the existing props sheet; each new name gets a `DISPLAY_H` entry and a spawn helper caller.

## Part 4 — New obstacles / collectibles per new zone

- **Zone 2 Setting Up Camp**: collect `laptop` icons (account fields), hop over `password-lock` blocks, one `clipboard-question` walker.
- **Zone 5 Answering the Call**: collect `phone-ring` bubbles that float on parabolas; avoid `mailbox` gaps and one boulder rolled from a telephone pole.
- **Zone 7 Choosing Your Path**: three `plan-card-*` collectibles on branching platforms — collecting any one unlocks the exit gate; `nurse` NPC at the end.

Scoring hooks into the existing `score += ...` accumulator (docs → points, plan choice → bonus).

## Part 5 — QA pass

- Playwright headless run through all 8 zones on desktop viewport, screenshot every zone entry, confirm ground alignment, enemy grounding, and no sprite clipping.
- Same on mobile viewport (390×844), verifying touch controls do not overlap gameplay across the longer level.
- Confirm HUD score/lives still correct after new zones added.

## Files touched

- `src/components/game/game-scenes.ts` — ZONES array, sprite specs, spawn calls for new zones, failure/overlay copy arrays extended.
- `src/assets/game/bg-signup.png`, `bg-relay.png`, `bg-market.png` — new (via imagegen).
- `src/assets/game/props-sheet-2.png` — new (via imagegen).
- `src/assets/game/character-sheet.png`, `props-sheet.png` — regenerated only if the audit flags them.
- `src/routes/tool.tsx` and any leaderboard/admin copy that hardcodes "5 zones" — updated to 8.
