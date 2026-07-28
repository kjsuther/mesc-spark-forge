## Goal

Rebuild the five upgrades as a clean feature-flag system: admin toggles change gameplay live, every mechanic reads flags from one place, and any combination of the five works safely.

## Current state (verified in code)

- Five flags already exist in the database and admin UI (`extra_lives`, `navigator_helper`, `chat_invincible`, `email_umbrella`, `resume_checkpoint`), and the player page already subscribes to realtime changes on `game_improvements`.
- But the game only honors flags when the admin broadcast mode is "after" (`game-scenes.ts` line 808: `const active = opts.mode === "after" ? {...opts.flags} : {}`).
- Flags are snapshotted once at scene start, and any toggle change remounts the canvas via a `key` string in `game-canvas.tsx` — which restarts the run instead of updating it live.
- Upgrade logic is scattered as inline `active.x ? … : …` checks in ~8 places; there are no collectible power-ups for Navigator/Chat/Email, no active-upgrades HUD panel, and checkpoint resume is just a campfire prop with a saved X coordinate (no inventory/door/boss state).

## What we'll build

### 1. Feature-flag core (`src/lib/game-features.ts`)

- `GameFeatures` interface with the five friendly names (`moreWaysToReachCaseWorker`, `navigatorHelp`, `liveChatAssistant`, `emailCaseWorker`, `checkStatusAnytime`) plus a mapping to the existing database keys, so no migration is needed.
- A `FeatureFlags` singleton store: `get()`, `subscribe()`, `set(partial)`. The React layer pushes updates into it; the game engine reads from it every frame. Adding a sixth upgrade later = one entry in the map.
- Realtime: keep the existing `postgres_changes` subscription and add a 5s polling fallback, both feeding the store.
- Flags apply regardless of the Before/After broadcast switch (Before/After stays only as a visual/presentation mode), so an admin toggle is always immediately felt.

### 2. Remove the remount

`game-canvas.tsx` drops flags from its restart `key` and instead pushes flag changes into the store. The running game reacts live; no reload, no lost progress.

### 3. Centralized managers (inside `src/components/game/`)

Each consults `FeatureFlags` and owns all logic for its area — no flag checks anywhere else:

- **PlayerManager** — lives (3 vs 5, HUD updates immediately when toggled mid-run, clamped so an OFF toggle never kills the player), invulnerability, respawn.
- **PowerUpManager** — spawning/collection of the Navigator, Live Chat and Email pickups; despawns them instantly if a flag goes OFF, spawns them on the fly if it goes ON while the player is in the right zone.
- **EnemyManager** — damage arbitration: Chat shield ignores enemy contact inside Zone 4 only; Email umbrella blocks only falling calendars in Zone 6; ground enemies still hurt.
- **BossManager** — Zone 7. Normal 3-hit fight by default; with a collected Navigator, a single-use scripted takedown (helper animation, boss defeat, exit unlock into Zone 8), after which the Navigator is consumed.
- **CheckpointManager** — full save state: position, lives, docs/inventory, active power-ups, boss defeated, doors unlocked, objectives met. Saved continuously at safe intervals; restored on death when Check Status is ON; cleared on New Game, admin reset, or game over.

### 4. Power-up behavior and effects

- **Navigator** — spawns late in Zone 6/early Zone 7, helper sprite trails the player with sparkles, HUD shows it, single-use boss skip.
- **Live Chat** — spawns in Zone 4, blue shield + glowing/flashing player, effect expires the moment the player leaves Zone 4.
- **Email** — spawns in Zone 6, umbrella opens over the player, calendars bounce away instead of damaging, umbrella icon in HUD.
- **Checkpoint** — checkpoint flag animation at save points, brief resume flash on respawn.

### 5. HUD "ACTIVE UPGRADES" panel

Compact pixel panel listing the enabled upgrades (5 Lives / Navigator / Live Chat / Email Shield / Checkpoint Resume), appearing and disappearing as toggles flip, plus per-run state (e.g. Navigator "carried" vs "used").

### 6. Admin dashboard

`/admin/game` keeps its five independent switches, relabeled to the exact wording requested (More Ways to Reach Your Case Worker, Get Help from a Navigator, Live Chat Assistant, Email Your Case Worker, Check Your Status Anytime), all defaulting OFF, plus the existing reset control which also clears saved checkpoints.

## Verification

Playwright pass on desktop and mobile viewports: all five OFF (baseline difficulty intact), each one ON individually, and all five ON simultaneously — toggling live mid-run each time to confirm the game updates without a refresh and never crashes.
