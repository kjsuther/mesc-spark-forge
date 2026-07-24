
## Goal

Replace the current Client Demo Tool at `/tool` with a 16-bit pixel-art side-scroller called **Blazing the Trail to Coverage**. The player walks a short trail from "I need health coverage" to "Covered!" Barriers represent real barriers to public assistance. Five preset UX improvements can be toggled to visibly smooth the journey, and attendees vote live in the app for which improvement should be applied next. A Before/After switch flips between the raw trail and the trail with all currently-enabled improvements applied.

## What replaces what

- `/tool` route: swap the entire Navigator UI for the game. Route keeps its path, so the admin **Poster View** iframe (`/tool?embed=1`) automatically shows the game with no changes to `admin.poster.tsx`.
- Nav label "Demo Client Tool" → **"Demo Game"** in `site-header.tsx` and any admin references.
- The Navigator action pages (`/actions/*`) are left alone — they are still linked from the changelog and elsewhere.
- Sitemap/head meta on `/tool` updated to the game.

## Game design

**Tech:** [Kaplay](https://kaplayjs.com/) (successor to kaboom.js), added via `bun add kaplay`. Rendered inside a client-only `<canvas>` component (dynamic import guarded by `<ClientOnly>` / `useEffect`, since Kaplay touches `window` at import time). Fixed 960×540 internal resolution scaled responsively.

**Structure — one continuous side-scrolling level with 5 named zones:**

1. **Finding the Trail** — spawn area with multiple confusing forks. Signs are blank unless "Add clearer directions" is on.
2. **Crossing the River** — a river gap with two tricky floating log platforms. "Add a bridge" replaces them with a solid bridge.
3. **Gathering What You Need** — 3 collectible pixel icons (ID card, income doc, household doc). Without the backpack improvement, they must be re-collected if the player dies. With it, they persist and a HUD strip shows what's still missing.
4. **Application Mountain** — a steep slope of small platforms. "Add clearer directions" adds trail markers + a gentler stepped path.
5. **Health Coverage** — a 🏥 flag; touching it triggers the win banner: *"You successfully found your path to coverage."*

**Controls:** Arrow keys / A-D to move, Space / W / Up to jump, R to reset. On-screen touch buttons for tablet demo.

**Aesthetic:** procedural pixel art drawn with Kaplay primitives — no external sprite sheets needed. Pacific-Northwest palette: pine green, river blue, mountain slate, cream sky, warm accent orange for the trail. Character is a simple 16×16 backpacker sprite drawn from rects.

## Five audience-votable improvements

Presented as UX-language options (per the user's tweak):

| Vote label | Internal flag | In-game effect |
|---|---|---|
| Add clearer directions | `clearer_directions` | Sign text becomes legible; Application Mountain gets stepped path + arrow markers |
| Add a helper | `helper` | Ranger NPC walks a few steps ahead of the player pointing to the next objective |
| Show required documents earlier | `documents_earlier` | Persistent HUD showing which of the 3 docs are still needed appears from spawn |
| Let users save progress | `save_progress` | Campfire checkpoint after River zone; death respawns there instead of level start |
| Add a bridge | `bridge` | Bridge planks appear over the river; log platforms hidden |

All five are independent toggles. Each is a small conditional inside the game's scene setup so improvements can be swapped in/out at runtime by re-mounting the scene.

## Live voting + realtime sync

Voting integrates with the existing `feedback` + `votes` tables, without polluting real user feedback:

**New migration** — a small dedicated table (kept separate from `feedback` so it doesn't appear in the triage board):

```sql
create table public.game_improvements (
  key text primary key,           -- 'bridge', 'helper', etc.
  label text not null,
  description text not null,
  enabled boolean not null default false,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);
grant select on public.game_improvements to anon, authenticated;
grant all on public.game_improvements to service_role;
alter table public.game_improvements enable row level security;
create policy "Public can read improvements" on public.game_improvements
  for select to anon, authenticated using (true);

create table public.game_improvement_votes (
  id uuid primary key default gen_random_uuid(),
  improvement_key text not null references public.game_improvements(key) on delete cascade,
  voter_fingerprint text not null,
  created_at timestamptz not null default now(),
  unique (improvement_key, voter_fingerprint)
);
grant select, insert, delete on public.game_improvement_votes to anon, authenticated;
grant all on public.game_improvement_votes to service_role;
alter table public.game_improvement_votes enable row level security;
create policy "Public can read votes" on public.game_improvement_votes
  for select to anon, authenticated using (true);
create policy "Anyone can vote" on public.game_improvement_votes
  for insert to anon, authenticated
  with check (length(voter_fingerprint) between 8 and 200);
create policy "Own vote can be removed" on public.game_improvement_votes
  for delete to anon, authenticated using (true);

alter publication supabase_realtime add table public.game_improvements;
alter publication supabase_realtime add table public.game_improvement_votes;
```

Seed the 5 improvements in the same migration (all `enabled=false`).

**Server functions** (`src/lib/game.functions.ts`):
- `listImprovements()` — public read; returns rows + vote counts.
- `castImprovementVote({ key })` — anon-safe insert using the existing `voter.ts` fingerprint; upsert-style (delete then insert).
- `setImprovementEnabled({ key, enabled })` — admin-only, gated by `requireAdmin()` from `admin-session.server.ts` (matches how the existing admin surfaces work).
- `applyTopVote()` — admin-only convenience: enables the improvement with the most votes.

**Frontend wiring:**
- On `/tool`, a compact **"What should we improve next?"** panel below the canvas lists the 5 options with vote counts and a single-select radio (one vote per fingerprint). Voting invalidates the query; Supabase realtime subscription on `game_improvement_votes` triggers refetch so counts update live.
- Realtime subscription on `game_improvements` triggers a game scene re-mount whenever a flag flips, so the trail visibly changes mid-demo.
- **Admin page** `admin.game.tsx` (new): table of improvements with enable/disable switches, live vote tallies, and an "Apply top vote" button. Added to the admin nav next to "Now Building."

## Before/After toggle

Single toggle rendered above the canvas (and mirrored to a persistent flag so the poster view respects it):
- **Before** — ignore all enabled improvements; player experiences the raw trail.
- **After** — apply every currently-enabled improvement.

Stored client-side in `localStorage` for the tool page; on the admin page a "Broadcast: Before/After" switch writes to a new `game_settings` singleton row (`before_after text`) also subscribed to via realtime so the poster view can be flipped from the podium.

Closing message shown on the win screen in After mode:
> "Every trail starts somewhere. Better trails are built by listening to the people who use them."

## File plan

New:
- `src/routes/tool.tsx` — rewritten. Renders `<GameCanvas />`, before/after toggle, live vote panel, closing message.
- `src/components/game/game-canvas.tsx` — client-only Kaplay mount; accepts `improvements`, `mode` props; remounts on prop change.
- `src/components/game/game-scenes.ts` — Kaplay scene definitions (spawn, river, docs, mountain, finish) with per-improvement branches.
- `src/components/game/vote-panel.tsx` — vote UI + realtime.
- `src/lib/game.functions.ts` — server fns above.
- `src/lib/game.queries.ts` — `queryOptions` for improvements and votes.
- `src/routes/admin.game.tsx` — admin control panel; linked from `admin.tsx` sub-nav.
- `supabase/migrations/<ts>_game_improvements.sql` — schema, grants, RLS, seed rows, realtime.

Edited:
- `src/components/site-header.tsx` — rename "Demo Client Tool" → "Demo Game".
- `src/routes/admin.tsx` — add "Demo Game" link to admin sub-nav.
- `src/routes/admin.poster.tsx` — update the iframe header label from "Live Demo — Client Tool" to "Live Demo — Trail to Coverage"; keep `/tool?embed=1` source.
- `src/data/actions.ts` — untouched (still used elsewhere).

Package: `bun add kaplay`.

## Non-goals

- No sprite sheets, no music, no sound effects in v1 (can be added later based on feedback — that's the point of the exercise).
- No per-user save games or leaderboards.
- No mobile-optimized layout beyond scaling the canvas + on-screen buttons.
- The existing Navigator action pages (`/actions/*`) stay in place; only `/tool` swaps.
