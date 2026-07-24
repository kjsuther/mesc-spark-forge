## Overhaul: SNES-style "Blazing the Trail to Coverage" + live voting rounds + mobile

Rebuild the game with real 16-bit pixel art, biome-based backgrounds tied to the Medicaid journey phase, punishingly hard baseline difficulty, admin-triggered 5-minute voting rounds over a curated improvement pool, and full mobile support.

### 1. SNES-style art (AI-generated sprite sheets)

Generate pixel-art PNG assets with `imagegen--generate_image` (premium, transparent bg where appropriate) into `src/assets/game/`, then externalize each via `lovable-assets create` → `.asset.json` pointer.

Assets (all 16-bit, crisp pixel grid, SNES palette, no anti-aliasing):
- **Character sprite sheet** — client walking/jumping/idle (4-frame walk, 1 jump, 1 idle), facing right, transparent
- **Parallax backgrounds per biome** (1920×540, layered sky + midground + foreground):
  1. `forest` — "Finding the Trail" (Pacific NW pines, morning fog)
  2. `river` — "Crossing the River" (rushing blue river, mossy banks)
  3. `town` — "Gathering What You Need" (small town w/ county office, mailbox, forms blowing)
  4. `mountain` — "Application Mountain" (steep cliffs, switchbacks, storm clouds)
  5. `clinic` — "Health Coverage!" (sunny valley w/ clinic building, welcoming)
- **Tileset** — grass, dirt, stone, log platforms, water tiles, snow tiles
- **Barrier / hazard sprites** — signpost with 5 arrows, jagged rocks, "DENIED" stamp, confusing form-paper enemy, red-tape vines
- **Collectible icons** — ID card, paystub, household doc, insurance card
- **Improvement sprites** (revealed when enabled) — wooden bridge, guide NPC (park-ranger style), paper map, campfire save-point, backpack
- **UI chrome** — pixel HUD frame, heart/lives icon, timer digits

Render sprites in Kaplay via `loadSprite`; keep everything at a fixed internal resolution (e.g. 480×270) scaled up with `crisp: true` / `pixelDensity` and `imageRendering: pixelated` for that true SNES look.

### 2. Biome-driven scenes tied to the Medicaid journey

Rewrite `src/components/game/game-scenes.ts` as a horizontal level split into five biome segments; the camera scroll triggers a background/parallax swap plus a top-corner "phase label" banner:

```
[FOREST] Finding the trail  →  [RIVER] Crossing the river  →
[TOWN] Gathering documents  →  [MOUNTAIN] Application mountain  →  [CLINIC] Covered!
```

Each biome has its own parallax layers, tileset, ambient hazards, and a gate that blocks progress until solved.

### 3. Punishingly hard baseline (beatable only by a pro)

Baseline "before" experience — no improvements enabled:
- **Forest gate** — 5 signposts pointing 5 directions, 4 are dead-ends that reset the player to spawn. Only trial-and-error finds the path.
- **River gate** — 4 tiny 8px-wide platforms over deep water, spaced near max jump distance, moving up/down out of phase. Fall = full level restart.
- **Town gate** — 3 required documents scattered off the main path behind hazards; missing any means the mountain gate rejects you.
- **Mountain gate** — near-vertical climb with disappearing ledges, falling rocks, and a wind gust that pushes left. No checkpoints.
- **Clinic gate** — requires all 3 docs stamped; without the "clearer directions" improvement the stamp queue rejects randomly.
- **3 lives, no checkpoints, 3-minute timer.** Time out or lose all lives = "Application denied — try again."

Each enabled improvement removes exactly one of these teeth:
| Improvement | Baseline pain removed |
|---|---|
| `clearer_directions` | Correct signpost glows; stamp queue accepts on first try |
| `helper` | Guide NPC walks ahead and marks the safe river platforms |
| `documents_earlier` | Backpack HUD lists required docs from spawn; docs pulse |
| `save_progress` | Campfire checkpoints at each biome; deaths respawn at last fire |
| `bridge` | Solid bridge over the river gate |
| (admin-added pool items) | Each maps to a specific baseline tooth in code |

Beatable in theory, effectively impossible in practice without ≥3 improvements.

### 4. Live voting rounds (admin-triggered, 5-min countdown, curated pool)

**Schema changes** (migration):
- New table `game_improvement_pool` (curated pool the admin builds):
  `key text pk`, `label text`, `description text`, `baseline_pain text` (which tooth it removes), `code_hook text` (matches a switch in game code), `created_at`
- New table `game_vote_rounds`:
  `id uuid pk`, `started_at`, `ends_at`, `status text ('active'|'ended'|'applied')`, `winner_key text nullable`, `applied_at nullable`
- New table `game_round_candidates`:
  `round_id uuid`, `improvement_key text`, PK (round_id, improvement_key) — the subset the admin picked for this round
- Reuse existing `game_improvement_votes` but add nullable `round_id uuid` column so votes scope to the active round
- All tables: GRANT to anon/authenticated per policy, RLS on, realtime enabled

**Server functions** (`src/lib/game.functions.ts`):
- `createVoteRound({ candidate_keys, duration_seconds = 300 })` — admin only, closes any active round first
- `endActiveRound()` — sets status='ended', computes winner
- `applyRoundWinner()` — flips `game_improvements.enabled=true` for the winner, sets status='applied'
- `addPoolItem` / `removePoolItem` — admin curates the pool

**Voting rules** (RLS):
- Insert allowed only when an `active` round exists and `improvement_key` is in that round's candidates
- Enforced by a `SECURITY DEFINER` function `cast_round_vote(_key, _fingerprint)` that checks the round, dedupes per fingerprint, returns the new tally

**Client — `/tool`**:
- Voting panel is **hidden during play**; on player win/lose/timeout OR when an admin round is active, a **round overlay** appears with:
  - Biome-styled pixel card, 5-minute countdown ticker
  - The round's candidate improvements as vote cards
  - Live tallies via realtime; "You voted" state per fingerprint
  - When round ends: winner highlighted + "Applying to the trail…" animation, then game reloads with the new improvement enabled
- If no active round, panel shows: "Waiting for next round — presenter will start voting shortly."

**Client — `/admin/game`**:
- Existing improvement on/off table kept for manual control
- New **"Pool"** section: add/remove items (label, description, baseline pain, code hook select)
- New **"Round"** section: multi-select candidates from pool → "Start 5-min round" button; live countdown; "End early" and "Apply winner" buttons; history of past rounds

### 5. Mobile support (touch controls + responsive canvas)

- **Touch overlay** on the canvas: left/right D-pad on the bottom-left, jump button on the bottom-right, both semi-transparent pixel-art buttons. Detect via `useIsMobile()` (already exists) plus `pointer: coarse` media query.
- Kaplay: bind touch buttons to the same `player.move` / `player.jump` actions as keyboard. Prevent default touch scrolling on the canvas element.
- **Responsive scaling**: canvas keeps 16:9 aspect but internal resolution stays 480×270; CSS scales it to `100vw` with `max-height: 60vh` on mobile so the vote panel and controls stay visible.
- **Vote overlay**: full-width bottom sheet on mobile, side card on desktop; large tap targets (min 44px).
- **Portrait warning**: brief pixel banner suggesting landscape when portrait+narrow (dismissible).
- Set preview to mobile viewport when the build is done so the user can verify.

### 6. File changes

- **New**: `src/assets/game/*.png.asset.json` (all sprite pointers), `src/components/game/touch-controls.tsx`, `src/components/game/vote-round-overlay.tsx`, `src/components/game/phase-banner.tsx`, `src/lib/game-round.queries.ts`
- **Rewrite**: `src/components/game/game-scenes.ts` (biome scenes, sprite loading, hard mode logic, improvement hooks), `src/components/game/game-canvas.tsx` (touch input + responsive sizing), `src/routes/tool.tsx` (round-driven overlay, hide vote panel during play), `src/routes/admin.game.tsx` (pool + round controls), `src/lib/game.functions.ts` (round mutations), `src/lib/game.queries.ts` (round queries)
- **Migration**: new tables + realtime + RLS + seed pool with the 5 preset improvements

### 7. Verification

- Build clean, then Playwright: load `/tool` on desktop viewport → confirm sprites render, character moves, first signpost gate blocks; load on mobile viewport (390×844) → confirm touch buttons appear and jump works; `/admin/game` → start a 15-second test round, cast a vote from another session, confirm winner applies and canvas reloads with the improvement.

### Out of scope

- Sound effects / chiptune music (can add later on request)
- Multi-player synchronized play (each attendee plays their own session; voting is shared)
- Persistent leaderboards
