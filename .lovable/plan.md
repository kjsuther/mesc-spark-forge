# Improve "Blazing the Trail to Coverage"

Targeted improvements to the existing Kaplay engine. No architecture rewrite; all art, sprites, music, HUD, achievements, feedback system and scoring stay as-is. Changes land in **both** engines — the current build (`src/components/game/game-scenes.ts`) and the frozen original (`src/components/game/original/game-scenes.ts`) — plus the shared React shell.

## 1. Auto-run fix

Cause to eliminate: the shared `window.__gameInput` object (`left/right/jumpReq`) persists across scene restarts, so a held touch button or a stale flag keeps `dir = +1` on the next run, and keys held during `R`/restart still read as down.

- Clear `__gameInput` at the start of every `trail` scene entry (and on win/lose/thanks scene entry).
- Add an "input arm" gate: after a scene starts, movement stays at zero until a fresh press is observed (a key-down transition or a touch button press that began after the scene loaded). Held-over input is ignored until released.
- The React shell already resets `__gameInput` on launch; also reset it on pointerup/pointercancel/blur/visibilitychange so a finger sliding off the D-pad can never latch.
- Verify after: reset button, `R` restart, lose-all-lives, win → thanks → replay, and return to title.

## 2. Full Screen button on the title screen

- Add a retro pixel-styled **FULL SCREEN** button to the title menu in `game-canvas.tsx`, sized for comfortable tapping (min ~48px tall) and visible on both layouts.
- Uses the existing `requestNativeFullscreen` helper with the existing faux-fullscreen fallback for iOS Safari.

## 3. Universal continue input

Introduce one shared helper (`awaitContinue`) used by every paused screen: title, story/explainer, tutorial, zone step screens, win, lose, credits/thanks.

- Desktop: Enter, Space, or mouse click.
- Mobile/touch: tap anywhere on the canvas or overlay.
- Prompt text adapts: `Press Enter, Space, or Click to Continue` vs `Tap Anywhere to Continue`.
- Removes any remaining Enter-only path.

## 4. Interactive step screens replace fading title cards

Replace `showTitleCard` on zone entry with a true pause panel:

- Freeze player movement, enemy updates, timers (including the Zone 6 countdown), and projectiles while shown.
- Centered pixel panel: step number, step name, subtitle, instruction lines, sprite thumbnails of the enemies/collectibles named, and the continue prompt.
- Sprites are drawn from the already-loaded atlas frames (application, username/password, account lock, platform, three documents, evil clipboard, mailbox, monster envelope, calendar, plan pedestals, boss, "+" projectile, stairs, medical ID card).
- Shown the **first time per run** for each zone; respawns re-enter without interruption.
- Content per zone exactly as specified in Steps 1–8.
- The end-of-game "STEP 8 · ENROLLED" flourish card stays as a celebration card.

## 5. Difficulty rebalance (~20–30% easier, same pace)

Data-only edits to spawn tables — movement speed, jump velocity, and gravity untouched:

- Remove roughly a quarter of enemy placements per zone, preferring duplicates and clustered pairs.
- Widen minimum spacing between consecutive hazards so each requires a single clean jump.
- Slightly widen the tightest gap/platform windows so jump timing is forgiving.
- Eliminate overlaps where a falling hazard and a ground enemy occupy the same landing spot.

## 6. Boss fight redesign (Zone 7)

Replace the stomp mechanic entirely.

- **Boss**: patrols back and forth, occasional hop, and fires themed projectiles on a timer (paperwork / denial letter / bill sprites drawn from existing art, tinted variants where needed). Projectiles travel horizontally at moderate speed at a height clearable by a normal jump, with a guaranteed minimum gap between shots so nothing is unavoidable.
- **Player**: selecting a managed care plan grants an automatic power-up — the player continuously auto-fires `+` cross projectiles toward the boss. No fire button.
- **Health**: exactly 3 hits. Each hit flashes the boss, grants brief invulnerability, then it resumes attacking. Heart HUD above the boss shows 3.
- **Defeat**: defeat animation, boss disappears, gold key drops, exit door unlocks and the player proceeds.
- Body contact with the boss and being hit by a boss projectile cost a life as usual; the Navigator auto-defeat path is preserved in the original build where that upgrade exists.

## 7. Leaderboards show top 3 only

- `src/components/game/leaderboard.tsx`: limit 3, ordered by score descending then earliest `created_at`; columns show rank, name, score only.
- Same top-3 treatment in the in-game high-score display and the Poster View leaderboard.

## 8. Regression pass

Playwright run against the preview at desktop and mobile viewports covering: launch → title → step screen → zone 1 clear, death/restart with no auto-run, boss defeat, win → thanks → replay, high-score entry, feedback form, and the admin feedback board.

## Technical notes

- Touched files: `src/components/game/game-scenes.ts`, `src/components/game/original/game-scenes.ts`, `src/components/game/game-canvas.tsx`, `src/components/game/leaderboard.tsx`, `src/routes/admin.poster.tsx` (leaderboard limit), plus a small shared `step-screens` data module for the eight panels.
- No database migrations and no changes to the feedback backlog system.
