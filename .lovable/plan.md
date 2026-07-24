
## Goals

1. Do a full UAT pass on the game and fix visible bugs (character floating, running animation).
2. Make stage titles feel like a real video game (big banner card in the middle/top on entry, then fade).
3. Blend stages together with a quick transition (fade + subtitle card) instead of a hard cut.
4. Add a live High Score leaderboard (first name + last initial), auto-refreshing every 5s, shown on `/tool` and `/admin/poster`.
5. Keep current difficulty exactly as-is.

## UAT + gameplay fixes (`src/components/game/game-scenes.ts`)

- Character floating: player is added with `anchor("bot")` but positioned at `GROUND_Y - 64` (top-anchor math), so feet land ~64px above ground. Change spawn `y` to `GROUND_Y` so the bottom sits on the ground, and adjust the ranger helper the same way.
- Ground visibility: today `addGround` is invisible collision. Add a thin visible ground strip per biome (dirt/grass color tuned per zone: forest green, river banks, town cobble, mountain rock, clinic tile) so it reads as "true ground" instead of the character standing on nothing. Purely visual — collision shapes and gaps stay identical, so difficulty is unchanged.
- Running animation: `walk` currently plays frames 1→4 (which crosses into the jump row). Constrain to actual walk frames (1→3 or 1→2 depending on sheet layout) and only play `walk` when grounded AND moving; play `jump` while airborne; play `idle` when standing still. Flip sprite via `flipX` based on facing so he faces the direction he moves.
- General QA: verify each zone is reachable, gate unlock still works, boulders/monsters/water still kill, HUD updates, mobile buttons still fire jump/left/right. Fix any issues found (no difficulty tuning).

## Cinematic stage titles + transitions

- Remove the small always-on biome banner text baked into the world at the top of each biome.
- Track "current zone" from `player.pos.x`. When the player crosses into a new zone:
  - Play a short screen-space transition: a full-screen dark overlay fades in to ~60% opacity over ~250ms, a big centered title card renders (`"STAGE 2"` small + `"CROSSING THE RIVER"` large, SNES-style — bold, drop-shadow, letter-spaced), holds ~1.2s, then fades out over ~350ms.
  - Overlay uses `k.fixed()` + high `z` so it sits over the camera. Player input is soft-paused (movement suppressed) during the ~1.8s card so it reads as a scene transition. This is short enough not to affect completion difficulty.
- Also show the same card once on game start ("STAGE 1 — FINDING THE TRAIL") and a "COVERED!" victory card on win.

## Live High Score leaderboard

### Data model (new migration)
- New table `public.game_scores`:
  - `id uuid pk default gen_random_uuid()`
  - `display_name text not null` (already-formatted "First L.")
  - `score int not null` (see scoring below)
  - `duration_ms int not null`
  - `mode text not null` ('before' | 'after')
  - `created_at timestamptz not null default now()`
- RLS: enable. Policies: `SELECT` to anon+authenticated; `INSERT` to anon+authenticated with `check` that `display_name` length 1–40, `score >= 0`, `duration_ms > 0`, `mode in ('before','after')`. No UPDATE/DELETE.
- GRANTs: `SELECT, INSERT` to anon and authenticated; `ALL` to service_role.

### Scoring (simple, deterministic)
- On win: `score = max(0, 10000 - floor(duration_ms/100)) + docs_collected*250 + lives_left*500`. On loss: no submission.

### Submission flow (game → tool page)
- `startGame` gets an `onWin(result)` that reports `{ durationMs, docs, lives, mode }`.
- After a win, `tool.tsx` shows a small inline form: "Enter your first name and last initial" (two short inputs, e.g. "Jane" + "D"), a Submit button that inserts into `game_scores` via the browser Supabase client (anon INSERT policy). Persist the entered name in `localStorage` so repeat plays skip re-typing.

### Leaderboard component (`src/components/game/leaderboard.tsx`)
- Query top 10 by `score desc, created_at asc` using `@tanstack/react-query` with `refetchInterval: 5000` (fulfills "updated automatically every 5 seconds").
- Compact card list: rank, display name, score, mode chip, relative time.
- Two visual variants via props: `variant="panel"` (used on `/tool`) and `variant="poster"` (bigger type, higher contrast, for `/admin/poster`).

### Placement
- `/tool` (`src/routes/tool.tsx`): add leaderboard panel next to (or under) the vote panel.
- `/admin/poster` (`src/routes/admin.poster.tsx`): add a prominent "LIVE HIGH SCORES" section using the poster variant.

## Files touched

- `src/components/game/game-scenes.ts` — ground visuals, player anchor fix, walk/idle/jump animation + flip, stage transition overlay, `onWin` payload.
- `src/components/game/game-canvas.tsx` — pass through win payload to `onWin`.
- `src/components/game/leaderboard.tsx` — new.
- `src/components/game/score-submit.tsx` — new (name form + insert).
- `src/routes/tool.tsx` — wire win payload → submit form → leaderboard panel.
- `src/routes/admin.poster.tsx` — add leaderboard poster section.
- New migration for `game_scores` (table + RLS + grants).

## Out of scope

- No difficulty changes.
- No new art generation (reuse existing sheets; new ground is a colored rect strip per biome).
- No realtime channel — 5s polling is what was requested and is cheaper for a conference room of phones.
