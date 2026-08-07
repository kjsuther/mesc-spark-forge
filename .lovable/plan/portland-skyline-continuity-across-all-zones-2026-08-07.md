# Portland skyline continuity across all zones

Zones 4 (town), 7 (market), and 8 (clinic) already carry the distant Portland skyline with the yellow hospital flag. Add the same motif to the four remaining zone backdrops so the skyline visibly grows closer as the player advances.

## Zones to update

| Zone | Backdrop | Skyline treatment |
| --- | --- | --- |
| 1 · Finding the Trail | `bg-forest` | Faintest and smallest — a barely-there haze silhouette on the far horizon, tiny yellow flag speck |
| 2 · Setting Up Camp | `bg-signup` | Very distant, slightly more defined than Zone 1 |
| 3 · Crossing the River of Paperwork | `bg-river` | Distant, a touch larger, still hazy |
| 5 · Answering the Call | `bg-relay` | Between Zone 4 and Zone 6 in scale — clearly visible but still background |
| 6 · Waiting Mountain | `bg-mountain` | Larger than Zone 5, sitting behind the mountain ridgeline |

Zones 4, 7, 8 stay as they are and anchor the near end of the progression.

## Style rules for every regenerated backdrop

- Flat, clean 16-bit pixel art matching the current backdrops — no dithering, no painterly grain.
- Skyline tinted toward each zone's own sky/atmosphere palette so it reads as distance haze, never as foreground.
- Yellow pennant flag on the tallest hospital tower in every zone, sized to that zone's skyline scale.
- Same composition and content as today otherwise; same dimensions and same file paths.

## Approval flow

One zone at a time, in order: Zone 1, then 2, then 3, then 5, then 6. For each, the proposed image is shown for approval before anything is swapped in; only after approval does the file get replaced, then the next zone is drafted.

## Technical notes

- Files replaced in place under `src/assets/game/`: `bg-forest.png`, `bg-signup.png`, `bg-river.png`, `bg-relay.png`, `bg-mountain.png`.
- No code changes — `src/components/game/game-scenes.ts` and `src/components/game/original/game-scenes.ts` share these asset paths, so both the Current and Original builds pick up the new art automatically.
- After each swap, detail-noise is measured against the existing clean backdrops to confirm the new art sits in the same sharpness range.
- No gameplay, scoring, or layout changes.
