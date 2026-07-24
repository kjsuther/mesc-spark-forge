## Fixes

### 1. Sprite padding (character/villains still misaligned)
Re-measure per-sprite transparent padding from the actual PNGs and re-derive `FOOT_PAD` constants in `game-scenes.ts` at the exact render size used (player 64px, monsters 48px, props 40px, ranger 56px). Instead of hand-tuned numbers, compute:

```
FOOT_PAD = round(renderHeight * (transparentBottomPx / frameHeightPx))
```

Apply the pad consistently everywhere the entity is positioned:
- initial spawn `pos.y = GROUND_Y + pad`
- moving-platform snap `pos.y = platform.pos.y + pad`
- ranger follow / monster patrol clamp
- respawn after death

Also shrink each `area()` hitbox to sit over the visible pixels (top offset = `-visibleHeight - pad`, height = `visibleHeight`) so collisions match what the eye sees. Verify with a Playwright screenshot in forest, river (on a moving stone), and town (monsters on same ground line).

### 2. Fullscreen prompt before game starts
Fullscreen currently only works via the in-canvas `⛶ Full` button and fails on iOS Safari because `requestFullscreen` must be called from a user gesture on the container element, not after async work.

Change:
- Add a pre-game modal in `game-canvas.tsx` (renders instead of the canvas until dismissed): "How do you want to play?" with two big buttons — **Standard** and **Fullscreen**.
- Clicking a button is the user gesture: if Fullscreen, call `requestFullscreen` / `webkitRequestFullscreen` synchronously on the container ref before mounting the game, then start the game.
- On iOS Safari (no Fullscreen API on `<div>`), fall back to `webkitEnterFullscreen` on the canvas if available; otherwise apply a CSS "faux-fullscreen" mode (fixed inset-0, `100dvh`, hide site chrome) so mobile users get the same experience.
- Keep the existing in-game `⛶`/`✕ Exit` toggle for switching mid-session.
- Persist the choice for the session (not across reloads) so restart doesn't re-prompt.

### 3. Mobile button labels
Add a small text label under each touch button in `game-canvas.tsx` so first-time users know what they do:
- ◀ "Left"
- ▶ "Right"
- ⟳ "Restart"
- JUMP (already labeled)

Labels appear both in the inline (non-fullscreen) mobile control row and the fullscreen overlay row. Keep buttons the same size; label sits directly beneath in a tiny uppercase caption. Also add a one-line hint above the controls on first mount: "Tap and hold ◀ ▶ to move · JUMP to hop · ⟳ to restart" that auto-hides after 6 seconds or first input.

### 4. Per-step scoring for more varied high scores
Right now score is only computed once at game-over from summary stats (docs, farthestZone, lives, time). Every player who reaches the same zone with the same docs gets the same score, so the top 3 rarely differ.

Change to continuous scoring accumulated during play in `game-scenes.ts`, exposed via the `WinResult`:
- +1 per in-game frame the player is alive and moving forward (rewards distance, penalises standing still)
- +25 per pixel of new rightmost-x reached (one-time per pixel; players who backtrack don't farm it)
- +250 per successful jump that lands on a platform (not ground)
- +100 per enemy avoided (crossed its x without taking damage)
- +750 per doc collected (kept)
- +1000 per zone entered (kept, replaces `farthestZone * 1000`)
- +500 per life remaining at end (win only)
- +2000 win bonus + up to +4000 speed bonus (win only)
- -500 per death (keeps risk meaningful)

Track `runningScore` on the scene and pass it through `WinResult.score`. `score-submit.tsx` uses that value directly instead of recomputing; the "how it breaks down" copy shows a short summary ("Distance 3,412 · Docs 3 · Zones 4 · …"). Because distance and jumps are measured in pixels/counts, two runs will almost always differ.

## Files touched
- `src/components/game/game-scenes.ts` — foot-pad recompute, per-frame scoring, expose `score` on `WinResult`, new `rightmostX` / `jumpsLanded` / `enemiesPassed` counters
- `src/components/game/game-canvas.tsx` — pre-game Standard/Fullscreen modal, synchronous fullscreen request on gesture, iOS fallback, button captions, first-run hint
- `src/components/game/score-submit.tsx` — consume `result.score` directly, updated breakdown copy
- `src/routes/tool.tsx` — no logic change; verify modal renders in place of canvas before start

## Verification
Playwright at 402×600 (mobile) and 1280×800 (desktop):
1. Load `/tool` → modal visible with Standard / Fullscreen buttons.
2. Tap Fullscreen → viewport enters fullscreen (or faux-fullscreen on iOS), game starts.
3. Screenshot forest, river (character on moving stone), town (monsters) — feet flush with ground/platform, no float.
4. Mobile control row shows "Left / Right / Restart / JUMP" captions.
5. Play two short runs with different behaviour → confirm scores differ and leaderboard reflects it.

## Out of scope
No new sprite art, no audio, no changes to voting/backend/admin.
