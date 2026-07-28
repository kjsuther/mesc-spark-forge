## 1. WIN screen and Thank-you screen never appear (root cause confirmed)

The finale is a scripted cutscene: walk to the fire pole → slide down → walk to the medical office → WIN overlay.

There are two places that mark the slide finished:

- the fire-pole *base collider* handler (`game-scenes.ts` ~line 3112) sets `firePoleDone = true` and nothing else;
- the update-loop safety net (~line 3418) sets `firePoleDone = true` **and** advances `cutscenePhase` from `"slide"` to `"walk-to-office"`.

In a normal run the base collider fires first. Because it doesn't advance the phase, the update-loop branch is then skipped forever (`!firePoleDone` is false), so `cutscenePhase` stays `"slide"` and `cutscene` stays `true`. The win check requires `cutscenePhase === "done"`, so `tryWin()` is never called — the hero just stands at the bottom of the pole indefinitely, exactly as in the video.

Fix: extract one `completeSlide()` routine that sets `firePoleDone`, starts the fireworks, advances the phase to `walk-to-office`, sets the walk target and facing. Call it from both the collider and the update-loop safety net, guarded so it only runs once. Add a final backstop: if `firePoleDone` is true and the phase hasn't reached `done` within ~4 seconds, force `done` so the WIN overlay can never be blocked by a missed transition.

Same fix mirrored into the frozen original build (`src/components/game/original/game-scenes.ts`), which shares this defect.

## 2. Remove leftover Zone 8 background text

Delete the two floating labels next to the ID card in Zone 8 — "MEDICAL ID" and "GRAB THE ID →" — now that the paused Step 8 briefing screen covers it. Mirror in the original build.

## 3. Walking looks like gliding

The walk cycle currently advances one frame per 18 travelled pixels and the sprite has no vertical movement, so the body slides along a perfectly flat line.

Changes:
- Shorten the stride to ~12px so the legs turn over at a run-appropriate rate.
- Add a small distance-driven vertical bob (1–2px, peaking on the passing frames) and reset it to zero when idle, jumping, or sliding, so footfalls read as weight.
- Keep the contact/passing frame order alternating so the two contact poses never play back-to-back.
- Bob is visual only — it does not touch the collider or the ground line fixed earlier.

Mirror in the original build.

## 4. New Controls screen

Insert a "controls" step in the pre-game flow in `game-canvas.tsx`, after the Journey Map and before the run starts:

`title → explainer → trailmap → controls → game`

Content, in the same 16-bit panel style as the other menu screens:

```text
        HOW TO PLAY
  Desktop            Mobile
  ← →  Move          ◀ ▶ buttons
  Space / ↑  Jump    ⤒ Jump button
  R  Restart run     Tap Full Screen
  Esc  Pause
```

It detects a touch device and highlights the matching column. Continue works with Enter, Space, click, or tap anywhere (same handler the other pause screens use), plus a Back button to the Journey Map. `pickMode("standard")` moves from the Journey Map's Continue to this screen's Continue.

## Verification

Play a full run in the preview to the ID card and confirm: slide completes, hero walks to the office, WIN overlay appears, then the Thank-you screen. Also confirm Zone 8 has no leftover floating text, the walk reads as steps, and the Controls screen appears once before every run on both desktop and touch layouts.
