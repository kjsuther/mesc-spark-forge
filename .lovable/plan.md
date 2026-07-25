
## 1. Remove Version History from the public site

- Delete `src/routes/changelog.tsx` and `src/routes/version.$semver.tsx`.
- In `src/components/site-header.tsx`, remove the `/changelog` nav entry and drop `"/changelog"` from the `to` type union.
- In `src/routes/tool.tsx`, drop the `versionsQuery` loader/read and the "Version History" mention (`current` derivation and any references) — currently used only for `currentSemver` on the `NowBuildingBanner`; pass `undefined` instead.
- Search-and-clean any remaining `changelog` / `versionsQuery` references (footer, root head links).

## 2. Poster view: game-only embed + exit control

- Add a new pure-canvas route `src/routes/tool.embed.tsx` (URL `/tool/embed`) that renders only `GameCanvas` (no header, no before/after toggle, no vote panel, no leaderboard, no footer). Full-bleed black background, `aspect-ratio: 16/9`, `noindex`.
- Update `src/routes/admin.poster.tsx` iframe `src` from `/tool?embed=1` to `/tool/embed`.
- Add a top-right "✕ Exit Poster View" button in the poster header that links back to `/admin/game`.

## 3. Replace improvements with the 5 new options

### Data model
- Add a migration that:
  - Deletes all rows from `game_improvement_votes`, `game_round_candidates`, `game_vote_rounds`, and `game_improvements`.
  - Inserts the 5 new rows below (all `enabled=false`, sort_order 1–5):

  | key | label | description |
  |---|---|---|
  | `extra_lives` | More Ways to Reach Your Case Worker | Start the game with 5 tries instead of 3. |
  | `navigator_helper` | Get Help from a Navigator | Navigator power-up in Zone 7 takes out the boss and unlocks the door to Zone 8. |
  | `chat_invincible` | Live Chat Assistant | Chat power-up makes you invincible to all enemies in Zone 4. |
  | `email_umbrella` | Email Your Case Worker | Email power-up in Zone 6 gives an umbrella that blocks falling calendar dates. |
  | `resume_checkpoint` | Check Your Status Anytime | When hit, respawn where you fell instead of at the zone start. |

### Code
- Rewrite `IMPROVEMENT_KEYS` in `src/lib/game.functions.ts` to the 5 new keys above.
- Rewrite `src/components/game/game-scenes.ts` improvement usages to map to the new keys:
  - `extra_lives` → starting lives 5 vs 3 (replace hardcoded starting lives).
  - `resume_checkpoint` → replaces current `save_progress` behavior in respawn logic (`player.checkpointX`).
  - `chat_invincible` → in Zone 4, skip damage from form-monsters when active.
  - `email_umbrella` → in Zone 6, ignore collisions with falling calendar pages when active (and drop a small "umbrella" pickup sprite when active for flavor — reuse an existing prop or a simple text label; no new asset generation required this pass).
  - `navigator_helper` → in Zone 7 boss battle, auto-defeat the boss on first contact (or a scripted 1-hit kill) and open the exit door.
  - Remove all references to the old keys (`clearer_directions`, `helper`, `documents_earlier`, `save_progress`, `bridge`, `plain_language`, `phone_support`, `translated_signs`) and their gameplay branches. Where an old branch made the game easier for a stage that isn't covered by the 5 new upgrades, revert to the current "before" difficulty.
- No changes needed to `startVoteRound` — it already caps candidates at `min(count, disabledCount)`, so as improvements get enabled the vote automatically shrinks from 5 → 4 → 3 → 2. Confirmed behavior; admin panel already exposes "Start round" and duration.

### Admin panel touch-ups (`src/routes/admin.game.tsx`)
- Update copy: "Auto-pick 5 & start" → "Start next round ({disabledCount} options)".
- Show a note under the round controls: "Rounds auto-pick from the remaining upgrades. As winners are applied, future rounds shrink."

## 4. Out of scope
- No changes to `/tool` public page layout beyond dropping version references.
- Header link "Play the Game" and admin unlock unchanged.
- No new art assets this pass; power-up pickups reuse existing sprites or simple HUD indicators.

## Technical notes
- Deleting a route file causes `src/routeTree.gen.ts` to regenerate automatically — do not hand-edit.
- The migration is destructive on votes/rounds because the old improvement keys no longer exist; this is intentional and matches "these should be only 5 options."
- `game_improvement_pool` table is untouched (read-only reference list, not used by the round system).
