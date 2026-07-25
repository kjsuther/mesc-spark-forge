## Goal

Reframe the site around the game + upgrade-voting loop, drop the client-tool framing (Backlog + Feedback), and rebuild the Admin around game operations (reset scores, poster view showing live game + high scores + live vote tally).

## 1. Remove Backlog

- Delete `src/routes/backlog.tsx`.
- Remove Backlog from `NAV_LINKS` in `src/components/site-header.tsx` (desktop + mobile menu).
- Remove any backlog-related step/CTA from `src/routes/index.tsx`.
- In `src/routes/admin.tsx`, remove "Feedback" nav entry and breadcrumb label. Redirect `/admin` index to `/admin/game`.
- Delete backlog-related server fns / queries only if unused elsewhere (leave DB tables and migrations alone; keep data intact but stop exposing it).

## 2. Remove Share Feedback

- Delete `src/routes/feedback.tsx`.
- Remove the "Share Feedback" CTA from `site-header.tsx` (desktop + mobile drawer).
- Remove the Feedback step from `src/routes/index.tsx`.
- Remove admin routes/nav tied purely to feedback triage:
  - Delete `src/routes/admin.index.tsx` (feedback triage board) and replace with a redirect route that sends `/admin` → `/admin/game`.
  - Delete `src/routes/admin.subscribers.tsx` (launch-email opt-ins gathered by the feedback form) and its nav link.
- Drop the feedback-count / "Now Building" summary bar in `admin.tsx` header (or keep only the game-relevant bits).
- Skip DB/table changes.

## 3. Homepage instructions

Rewrite `src/routes/index.tsx` STEPS to exactly four cards, all pointing at `/tool` (the game):

1. Play game and see how far you get
2. Vote on upgrade needed to try and complete the journey
3. Wait until voting timer gets to 0:00 (starts at 10 minutes to vote)
4. Play game again with new upgrade added based on number of votes

Update the route's `head()` title + description + og tags to match the new framing (no more "try the tool / share feedback / vote on the backlog").

## 4. Admin overhaul

### Nav (`src/routes/admin.tsx`)

New tabs only: **Demo Game**, **Poster View**, (keep Now Building + Versions if the user wants a changelog surface — otherwise drop; default: drop to keep admin focused on the game). Remove Feedback + Subscribers links. Remove the overview stats strip (feedback/votes counts).

### `/admin/game` — add high-score reset

- Add a **Reset High Scores** button that calls a new server fn `resetLeaderboard` in `src/lib/game.functions.ts` (requires admin; truncates `game_scores`). Confirm dialog before running.
- Change default round duration to **10 minutes** and default candidate count to **5** (`startVoteRound` inputs + the admin UI's `durationMin` initial value + auto-pick button label).

### `/admin/poster` — rebuild as the "game poster"

Replace the current feedback-oriented poster with a 3-panel layout:

```text
+--------------------------------------------+------------------+
|                                            |  HIGH SCORES     |
|          LIVE GAME (iframe /tool?embed=1)  |  (top 10, live)  |
|          takes ~70% width                  |------------------|
|                                            |  UPGRADE VOTES   |
|                                            |  (ranked, live)  |
+--------------------------------------------+------------------+
```

- Left: existing `<iframe src="/tool?embed=1">` at large size.
- Right top: `<Leaderboard />` (already realtime via `game_scores` subscription).
- Right bottom: live ranked upgrade list — reuse `activeRoundQuery` + Supabase realtime on `game_vote_rounds` / `game_improvement_votes` / `game_improvements`. Render candidates sorted by vote count desc; animate reorder with CSS transitions (`FLIP`-style using key + `transition-transform`). Show countdown `mm:ss` until round ends; when no round active, show the top 5 disabled improvements sorted by all-time votes with a "Waiting for next voting round" banner.
- Remove feedback/votes/nowBuilding/versions loaders from the poster route.

### Auto-apply on timer end (supports the homepage promise)

Add scheduling so a round auto-applies its winner when `ends_at` passes, so attendees don't need an admin click:

- Client-side safety net in `admin.poster.tsx` + `vote-panel.tsx`: when `secondsLeft <= 0` and status is still `active`, call `endAndApplyRound` (idempotent — already guards on active/most-recent-ended round).
- Optional server-side idempotency: keep as-is; `endAndApplyRound` already tolerates repeated calls.

## Technical notes

- Files added: none (all edits + one route deletion redirect).
- Files removed: `src/routes/backlog.tsx`, `src/routes/feedback.tsx`, `src/routes/admin.index.tsx`, `src/routes/admin.subscribers.tsx`.
- `src/routes/admin.tsx` will lose `getAdminOverview` usage; the server fn can stay defined (unused) or be removed later.
- New server fn `resetLeaderboard` in `src/lib/game.functions.ts` following existing `requireAdmin` pattern; deletes all rows from `game_scores`.
- Header no longer references `/backlog` or `/feedback` — TanStack route typing will fail until the routes are deleted and `routeTree.gen.ts` regenerates (auto).
- Homepage step CTAs all deep-link to `/tool` (single game page), so we can drop the multi-color step theme table or keep it for visual variety.

## Out of scope

- No DB migrations; existing feedback/votes/subscribers tables stay untouched.
- Game mechanics unchanged.
- No changes to `/about`, `/changelog`, `/tool` game canvas.
