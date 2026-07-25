# Zone 4 (Gathering Documents) — redo items and rescale

The user's zone 4 is code Zone 3 (`BIOME_W * 3`, "Gathering Documents"). Current sprites were bumped to `DISPLAY_H = 48` (docs) and `56` (form-monster), which now clip against the 66-px hero, overlap the ground plaques, and make the level unplayable. All edits live in `src/components/game/game-scenes.ts` plus three new tiny asset files.

## 1. New document art (replace the existing 3 frames)

Generate three standalone 128×128 PNGs with transparent backgrounds, drawn as clean 16-bit icons on a solid white card so they read at small sizes:

- `src/assets/game/doc-id.png` — teal ID card with a portrait square and two data lines.
- `src/assets/game/doc-paystub.png` — folded pay stub with `$` and stripes.
- `src/assets/game/doc-envelope.png` — cream envelope with a red wax seal.

Load each via `safeLoadSprite` (single-frame) instead of pulling `id`/`paystub`/`envelope` frames from `props-sheet`. Keep the old sheet imports for other zones untouched.

## 2. Rescale in `DISPLAY_H`

- `id`, `paystub`, `envelope`: **48 → 28** (matches key/lock scale, sits cleanly on ground, no HUD clipping).
- `form-monster`: **56 → 34** (roughly hero-torso height, clears low platforms).

`displaySize()` derives width from the trimmed aspect ratio automatically. Doc `hitboxScale` uses `dh` so it updates for free. Update the `form-monster` `mh`/`mw` reads — they already pull from `DISPLAY_H` / `displaySize`, so no extra math.

## 3. Zone layout tweaks so the level is completable

In the Zone 3 block (lines 1264–1299):

- Space the three docs further apart and lift the middle one so it's not stacked under a monster patrol:
  - `id` at `tx0 + 220` (ground)
  - `paystub` at `tx0 + 520` (ground)
  - `envelope` at `tx0 + 900` (ground)
- Reduce to **one** patrolling `form-monster` at `tx0 + 700`, `range: 90`, speed `40` (still `24` when `plain_language` is on). Two overlapping patrols on a short strip is what makes the zone impossible at the new hero size.
- Add a short "safe pocket" plaque near `tx0 + 120` reading `GATHER 3 DOCS` via existing `addSpeech` so the objective reads on entry.

## 4. Verification (Playwright, 1280×800 and 852×402)

- Load Zone 3, screenshot: confirm docs sit flush on the grass, are visibly icon-shaped (not cropped), and the monster clears them without overlap.
- Run through the zone: collect all 3 docs, reach the door with the key drop — no forced life loss from geometry.
- HUD `DOCS x/3` increments; zone advances after 3.

## Out of scope

- No other zones, HUD, music, or physics changes.
- No new enemy types — only rescaling the existing `form-monster` and swapping the 3 doc sprites.
