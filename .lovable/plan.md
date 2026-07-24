## Goals

1. Let mobile players restart the game (no keyboard = no "R").
2. Make stage title cards clearly represent the Medicaid application journey.
3. Full UAT pass on physics + playability (keep difficulty).

---

## 1. Mobile restart

- Add a `resetReq` boolean to the `window.__gameInput` bridge shared between the canvas wrapper and the Kaplay scene.
- Add a small "⟳ RESET" button to the mobile touch controls (next to left/right/JUMP in `game-canvas.tsx`) that flips `resetReq = true`.
- In `game-scenes.ts`, in the `onUpdate` loop, read `resetReq` and call `k.go("trail", 40, 1)` when true, then clear the flag. Same behavior as pressing "R".
- On the game-over overlay (win or lose), add a large touch-friendly "TAP TO PLAY AGAIN" hint and make the whole overlay respond to a click/tap by triggering the same reset (via `k.onClick` on the fullscreen overlay rect, or by exposing the reset through the same `resetReq` flag so tapping the button works too). Desktop copy stays "Press R to try again".

## 2. Stage names tied to Medicaid journey

Update the `ZONES` array so each biome carries two labels: a `phase` (Medicaid step) and a `label` (game-flavored name). The title card uses the phase as the small line and the game name as the big line.

- Stage 1 — "STEP 1 · LEARN YOU MAY QUALIFY" · "FINDING THE TRAIL"
- Stage 2 — "STEP 2 · START YOUR APPLICATION" · "CROSSING THE RIVER"
- Stage 3 — "STEP 3 · SUBMIT YOUR DOCUMENTS" · "AT THE COUNTY OFFICE"
- Stage 4 — "STEP 4 · WAIT FOR REVIEW" · "APPLICATION MOUNTAIN"
- Stage 5 — "STEP 5 · ENROLL IN COVERAGE" · "HEALTH COVERAGE"

Also update the gate/finish/HUD copy where it references generic wording so it reads as Medicaid-flavored subtext (e.g., docs HUD: "Docs needed for your application: ID, Income, Household"; gate: "COUNTY OFFICE — DOCS REQUIRED"; win: "★ ENROLLED IN COVERAGE ★"). The `<h1>` and body copy on `/tool` stay as-is.

## 3. Full UAT — physics and playability

Pass through the level with the current settings and fix anything that's off, while preserving the "punishingly hard" difficulty:

- **Anchor / feet alignment.** Player uses `anchor("bot")` at `y=GROUND_Y` and the ground rect starts at `y=GROUND_Y` — geometry is correct. Verify visually with a Playwright screenshot on the first frame and again mid-jump; adjust the area shape offset if the hitbox is not centered on the sprite feet.
- **Ranger helper.** Currently drawn without an anchor, `pos.y = GROUND_Y - 60` with `height=60`. Switch to `anchor("bot")` at `GROUND_Y` for consistency with the player so it can never look floating regardless of sprite trim.
- **Signposts / docs / campfire / backpack.** All use `GROUND_Y - height`; keep as-is but re-check via screenshot per biome.
- **Bridge deck.** Physics rect top sits at `GROUND_Y - 8`; player will stand 8px above the surrounding ground, which reads correctly. Verify in screenshot; if it looks awkward, lower to `GROUND_Y - 2`.
- **Moving river platforms.** With gravity 1800 and jump 680, max jump height ≈ 128px and airtime ≈ 0.75s → horizontal reach ≈ 180px. Current gaps (~140px) and vertical deltas (≤60px) are within reach. Confirm platforms don't drift outside jump range at the sine extremes; clamp `amp` if needed.
- **Mountain sparse ledges.** Vertical deltas 70/60/60/40 and horizontal 140 — reachable. Confirm boulders can't pin the player at the entry ledge (spawn boulder x offsets already start at `mx0 + 300`, past first ledge).
- **Kill-plane / water.** Currently at `GROUND_Y + 90` with height 60. Since ground blocks are 80 tall from `GROUND_Y`, the kill-plane sits inside the ground on non-gap tiles — harmless there because you can't reach it, but confirm on the river gap that falling triggers the water reset before landing on nothing.
- **Gate unlock.** Confirm collecting all 3 docs destroys the gate & stamp, and that respawning in Town without `documents_earlier` correctly clears docs (already implemented; verify by dying after collecting 2).
- **Camera bounds.** Uses `Math.max(width/2, Math.min(x, LEVEL_END - width/2))` — good. Verify on the final clinic that the finish is fully visible.
- **HUD legibility on mobile.** With `letterbox: true` the canvas scales; verify HUD text (size 14) is readable at 402px width. Bump to size 16 if needed.
- **Touch responsiveness.** Confirm holding left/right + tapping JUMP works during a single gesture (multi-touch). If not, split the buttons into separate pointer-capture zones (already done — each button has its own pointer handlers).

Verification: run Playwright against `http://localhost:8080/tool` at both desktop (1280×800) and mobile (402×800) viewports; screenshot start-of-level, mid-river, town gate with 0 docs, mountain peak, and clinic. Then simulate a death and tap the new mobile reset button to confirm the level restarts.

## Out of scope

- No changes to voting rounds, leaderboard, admin panel, or sprite art.
- No difficulty tuning beyond fixing physics bugs.

## Technical notes

- Files touched: `src/components/game/game-canvas.tsx` (add reset button + `resetReq`), `src/components/game/game-scenes.ts` (consume `resetReq`, rename zones with `phase`, update title card + end-screen copy, ranger anchor tweak, any physics tweaks the UAT surfaces).
- No new dependencies, no schema changes.
