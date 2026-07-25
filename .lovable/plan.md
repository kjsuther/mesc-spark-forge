## Goal

Play the game as a real user would — on a phone and on a desktop — and fix everything that hurts playability. Concrete targets from the screenshot and your notes:

1. The hero's feet must sit on the **green grass strip**, not the brown soil below it.
2. The character must **look like he's running** when moving (right now the legs barely change).
3. Sprites (monsters, boulders, envelopes, signs) are **too big** — the player can't get around them. Shrink them so there is real room to dodge and jump.
4. Overall difficulty needs to come **down** — the first playthrough should feel possible, not punishing.

## How I'll test (this is the part that has been missing)

I will drive a real browser against the running preview with Playwright and actually play, not just read code. Two full passes:

**Pass A — Desktop (1280×800, keyboard)**
Play from title screen → each zone → win/lose overlay, using ←/→/Space. Screenshot on entry to each zone, mid-zone, at every obstacle, at every death, and at the end overlay. Log where I get stuck, what feels unfair, what looks wrong.

**Pass B — Mobile (iPhone-class viewport, touch)**
Same run using only the on-screen touch buttons. Test: reachability of controls, fullscreen behavior, tap-to-restart, thumb obstruction, whether jumps land on the platforms in Zone 2, whether monsters in Zone 3 can actually be avoided.

For each pass I record:
- A screenshot timeline (`/tmp/browser/uat/{desktop,mobile}/NN_label.png`)
- Frame-by-frame observation: character Y vs. grass Y, sprite footprint vs. corridor width, jump arc vs. platform gap, enemy density, time-to-first-death, time-to-first-win.

Findings go into `UAT-FINDINGS.md` — one row per issue with severity, evidence screenshot, and the exact fix.

## Fixes I already know I'll make (and will confirm/adjust from the playtest)

### 1. Ground alignment — feet on grass, not soil
The grass strip is drawn above `GROUND_Y` as a thin band; the player's `anchor("bot")` currently lands on the soil rectangle's top. I'll:
- Move `GROUND_Y` up by the grass-strip height so `anchor("bot")` lands the feet on the green line, and adjust the soil rect + grass strip so they still meet with no seam.
- Verify against a pixel-diff of hero-bottom-Y vs. grass-top-Y — must be equal.

### 2. Running animation that actually reads as running
Current cycle is `[0,1,2,3,2,1]` every 12px. Problem is the trimmed hero-walk frames only differ by a few pixels of leg lift, so at any speed it looks like a glide. I'll:
- Increase per-frame leg contrast by using a taller crop tolerance in the trim step so leg-lift is visible.
- Add a small vertical bob (±1–2 px) tied to the same stride counter so the whole silhouette moves the way a runner does.
- Tighten stride to ~9 px so the cadence matches the higher move speed we'll set below.
- If two of the walk frames are near-identical after trim, drop them and drive the cycle from the 2 most distinct frames plus interstitials, so the eye sees clear alternation.

### 3. Shrink sprites and open corridors
- Reduce `DISPLAY_H` for `form-monster`, `denied`, `envelope`, `boulder` by ~25–30% so they no longer choke the lane.
- Shrink signposts likewise so the forest doesn't feel walled in.
- Widen the vertical clearance under floating platforms in Zone 2 and Zone 4 so a normal jump clears them.
- Recompute each entity's collider from the new trimmed size (helpers already do this — I just verify).

### 4. Make the first playthrough winnable
- Reduce monster density per zone (fewer spawns, wider spacing).
- Reduce boulder frequency and speed in Zone 4.
- Give the player 3 lives baseline (was effectively 1–2 without `phone_support`).
- Widen Zone 2 platform tops by ~20% and shorten gaps.
- Loosen coyote time from 90ms → 130ms and jump buffer from 120ms → 160ms so mistimed inputs still feel fair.
- Keep the "before feedback" experience harder than "after," but not impossible. Target: a focused player finishes in ~2–3 minutes on the first or second attempt.

### 5. Mobile-specific corrections (driven by Pass B)
- Verify the touch buttons don't cover the play area in fullscreen; if they do, shrink or reposition.
- Confirm tap-to-restart works from the game-over overlay on iOS-class viewports.
- Confirm the score-submit form is reachable and the keyboard doesn't hide the Submit button.

## Deliverables

- `UAT-FINDINGS.md` — every issue observed, with screenshots and severity.
- Fixes applied to `src/components/game/game-scenes.ts` (and `game-canvas.tsx` only if mobile controls need moving).
- A second Playwright pass after the fixes on both desktop and mobile, with before/after screenshots proving:
  - Hero feet sit on the green grass line in every zone.
  - Running animation is visibly a run (multi-frame leg lift + subtle bob).
  - Every obstacle can be dodged or jumped with the standard controls.
  - A first-attempt playthrough reaches the "Covered!" overlay.
- Short written summary of what changed and what the playtest showed before vs. after.

## Files expected to change

- `src/components/game/game-scenes.ts` — ground constants, sprite sizes, monster/boulder spawns, walk animation, difficulty tuning.
- `src/components/game/game-canvas.tsx` — only if mobile controls need repositioning or the fullscreen frame needs adjustment.
- `UAT-FINDINGS.md` — new file with the playtest report.

Nothing about voting, leaderboard, routing, or admin panels is touched — this pass is purely playability.

## What I won't do unless you say so

- Redesign the art style or generate new sprite sheets.
- Change the 5-zone structure or the Medicaid-journey narrative.
- Rework the voting/round system.

If you'd rather I focus this pass on **mobile only** (since most attendees will be on phones), say the word and I'll skip the desktop pass to move faster.
