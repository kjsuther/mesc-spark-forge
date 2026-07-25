## Goal

When the player touches the Medical ID card in Zone 8, hand control to a scripted cutscene that walks the character to the pole, snaps them to the knob, slides them down, then walks them right to the medical office where the fireworks + WIN fire. The player has no input during the sequence.

## Changes (all in `src/components/game/game-scenes.ts`, Zone 8 block)

### 1. New `zoneState.cutscene` flag + input lockout

Add `cutscene: false` alongside the existing `firePoleAttached / firePoleDone / idCardCollected` flags. In the main `onUpdate` and the keyboard/touch input handlers, early-return when `zoneState.cutscene` is true so the player can't move, jump, or restart-cancel mid-scene. Also freeze horizontal velocity each frame while `cutscene && !firePoleAttached && !firePoleDone`, mirroring the existing slide freeze.

### 2. Rewrite the `id-card` collide handler as a scripted timeline

Replace the current "collect and print hint" handler (~line 1865) with:

1. Set `idCardCollected = true`, `cutscene = true`, award the existing 1500 score + sparkle burst, destroy the card.
2. Capture `pole = { poleX, poleTop, poleBaseY }` by looking up the `fire-pole` entity (already in-scene) so we don't depend on collision.
3. **Beat A — walk to pole**: each frame, move `player.pos.x` toward `pole.poleX` at `MOVE_SPEED * 0.9`, set `player.facing = "right"`, run the existing `run` animation. When within 2 px, snap to `poleX`.
4. **Beat B — grab knob**: teleport `player.pos.y = pole.poleTop + 6`, set `firePoleAttached = true`, switch to `slide` anim. The existing per-frame descent block at ~line 2111 already slides them to `GROUND_Y` and sets `firePoleDone`, so we reuse it unchanged.
5. **Beat C — walk to the office**: once `firePoleDone` fires, keep `cutscene = true`, swap back to `run`, and tween `player.pos.x` rightward until it reaches `LEVEL_END - 140` (just under the existing "★ COVERED! ★" speech at `LEVEL_END - 100`). Small step-based movement, not a jump.
6. **Beat D — arrive**: switch to `idle`, clear `cutscene`, then call the existing `tryWin()` path (which already runs from `firePoleDone`). Fireworks already trigger at slide-end via the current base handler; leave that intact.

Implement Beats A/C by pushing a small state object into a module-scoped `cutsceneStep` and driving it from the existing `onUpdate` (right next to the current fire-pole descent block) rather than nested `k.wait` chains — keeps timing frame-accurate and avoids double-updates when the tab is throttled.

### 3. Remove the now-dead fire-pole collide handler behavior

`player.onCollide("fire-pole", ...)` is no longer the trigger. Keep the collider so nothing else changes, but make the handler a no-op when `cutscene` or `firePoleAttached` is already set (the cutscene now owns attachment). This also removes the "Grab the Medical ID card first!" hint path since the ID pickup itself starts the sequence.

### 4. HUD label update

`zoneObjectives[7].hudLabel`: when `cutscene && !firePoleDone`, show `"FINISHING…"` so the "SLIDE DOWN →" prompt doesn't linger during the automated sequence.

## Out of scope

- No changes to Zones 0–6, scoring, or the win/lose screens.
- No physics/collision refactor.

## Verify

Playwright at 1280×1800 desktop and 844×390 mobile-landscape: force-advance to Zone 8, grab the ID, and confirm the character walks to the pole, snaps to the knob, slides the full pole length, walks to the office sign, and the WIN screen fires — with keyboard/touch input ignored for the entire sequence.