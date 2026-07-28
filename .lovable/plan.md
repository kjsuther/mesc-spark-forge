## Goal

When a vote round ends, the audience sees what looks like Lovable building the winning upgrade in real time — prompt typing, code streaming, files changing, deploy — and at the end the upgrade "goes live" in the game. Under the hood nothing is being built: the upgrade already exists and we simply flip its feature flag when the animation finishes.

## How it behaves

1. Admin clicks **End round & apply winner** (unchanged button).
2. Instead of enabling the winner immediately, the app records a *pending build*: the winning upgrade key plus a start timestamp.
3. Every connected screen — the Poster View and every attendee on `/tool` — receives that over realtime and plays the same ~30s sequence, in sync, since it's driven off the shared start timestamp.
4. When the sequence finishes, the winning improvement is enabled for real, the game switches to "After feedback" mode as it does today, and the overlay resolves into a short "Shipped — <Upgrade name> is live" card before fading out.

## The build sequence (~30 seconds, 5 beats)

Styled as a Lovable session, not as the retro game UI — that contrast is the point.

```text
[ 0-4s  ] Prompt beat   "The audience voted: Self-Service Portal (42 votes).
                         Ship it." typed character-by-character into a chat box.
[ 4-9s  ] Thinking beat Streaming reasoning lines: reading the feature flag store,
                         locating the lives manager, planning the change.
[ 9-20s ] Code beat     Split view: file list on the left with edited files
                         ticking to "modified", a code pane on the right
                         streaming a real diff for that upgrade (green +
                         lines, syntax-highlighted, auto-scrolling).
[20-27s ] Build beat    Progress steps: Typecheck OK → Build OK → Deploying →
                         Live, each with a check as it lands.
[27-30s ] Shipped card  Upgrade name, its description, "Now live in the game."
```

Each of the five upgrades gets its own scripted content — its own prompt line, file list, and diff snippet — written to reference the actual files and flags for that upgrade so it reads as genuine to anyone who looks closely.

## Where it appears

- **Poster View**: full-bleed overlay across the whole poster layout (game, leaderboard, votes dim behind it), since this is the screen you narrate.
- **/tool**: the same overlay, scaled down, over the page content so phone viewers see it too.
- Overlay is dismissible on `/tool` (small ✕) so a player mid-run isn't trapped; the poster screen plays it through.

## Admin controls

On the Game & Voting admin page:
- **Replay build sequence** — replays it for the last applied upgrade without changing any flags. Useful for rehearsal or a second showing.
- **Skip / finish now** — ends the sequence immediately and applies the flag, in case you're short on time.
- A small status line: "Building <Upgrade> — 12s remaining" while it's running.

## Technical notes

- New `game_build_runs` table (or equivalent columns on `game_settings`): winner key, started_at, duration, status. Realtime-subscribed by both routes, so all screens play the same beat at the same second and a late-joining phone jumps in at the correct point.
- Flag application moves from "immediately at round end" to a server function called when the timer completes (with the admin skip path calling the same function), so the game state and the theater can never disagree. Existing manual per-upgrade toggles in admin are untouched.
- New component `src/components/build-theater.tsx` plus a per-upgrade script file with the prompt/file/diff content; mounted in `src/routes/admin.poster.tsx` and `src/routes/tool.tsx`.
- Purely additive to the game engine — `src/lib/game-features.ts`, `managers.ts`, and `game-scenes.ts` are not modified.
