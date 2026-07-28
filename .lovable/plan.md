## 1. Only show the in-canvas voting screen during a live round

Today `src/components/game/game-canvas.tsx` always shows `VoteOverlay` after score entry, and the overlay itself falls back to a "NO VOTE OPEN RIGHT NOW" panel.

- In `game-canvas.tsx`, subscribe to `activeRoundQuery` and treat a round as live only when it exists and its `endsAt` is still in the future.
- Skip the vote step entirely (go straight to the "tap screen or press R to try again" prompt) when no round is live.
- In `vote-overlay.tsx`, self-close if the round ends or all candidates are already implemented while the panel is open, so a stale panel never blocks restart. The "no vote open" empty state is removed since the overlay only mounts when a round is live.

## 2. Default the Before/After tab based on whether any upgrade has shipped

In `src/routes/tool.tsx` the mode currently defaults to the admin `before_after` setting, then `"before"`.

- Compute the default as `"after"` when at least one improvement is enabled, otherwise `"before"`.
- Keep the manual toggle authoritative: once the user clicks a tab, `localMode` wins and is never overridden, including when a new upgrade ships mid-session.
- Apply the same default to the `/embed` (poster) view so the projection matches.
