# Fix Zone 3 sprite scale, boss stomp reliability, and Zone 8 fire pole slide

All edits stay in `src/components/game/game-scenes.ts`.

## 1. Zone 3 (labeled "Zone 4" by the user — the Documents zone) — enlarge villains and collectibles

The doc collectibles (`id`, `paystub`, `envelope`) render at `DISPLAY_H = 30` and the form-monster at `38`. Against the 66-px hero and the busy autumn/mailroom background they read as broken pixel noise (frames 07–10 of video 1).

- Bump `DISPLAY_H` values: `id`, `paystub`, `envelope` → **48**; `form-monster` → **56**. `displaySize()` already derives width from the trimmed aspect ratio, so widths scale proportionally with no clipping.
- Keep the ground-based `spawnGrounded` calls in Zone 3 — the taller sprites will still snap flush because their trimmed bounds drive the foot offset.
- Recompute the doc `hitboxScale` (uses `-dh/2` / `dh`) automatically via the new `DISPLAY_H` — no per-call changes needed.

## 2. Zone 7 boss (labeled "Zone 7" by the user — the Ogre boss) — reliable stomp, lethal on side/underside

Current check in `player.onCollide("boss")`:

```
playerFoot <= bossTop + bh * 0.4 && vy >= -10
```

Fails often because the collision fires on the very first overlap pixel — the player's foot has usually only reached `bossTop + bh * 0.6..0.9` when contact first triggers. Rewrite to also credit a stomp when the player was above the boss on the previous frame:

- Track `player.lastY` in the shared `onUpdate` (set at end of frame).
- In the boss collide handler, compute:
  - `playerFootPrev = player.lastY + PLAYER_FOOT_PAD`
  - `stomp = (playerFootPrev <= bossTop + 4) || (playerFoot <= bossTop + bh * 0.55 && vy >= -20)`
- On stomp: existing bounce, hits++, hurt frame, key drop at 3 hits (unchanged).
- Otherwise: `loseLife("monster")` (unchanged, but now consistently fires on side/underside contact because the geometric window is well-defined).
- Add a small post-stomp bounce (`player.vel.y = -260`) — currently missing, so the player often bounces once and then immediately re-collides side-on for a life loss.
- Keep a 200 ms boss i-frame (`boss.hurtUntil` already exists) but also gate collisions with `if (k.time() < boss.hurtUntil) return;` so a single frame of overlap never double-counts.

## 3. Zone 8 fire pole — separate pole from landing so the slide actually plays

Video 3 shows the pole sitting flush against the right edge of the top landing (`poleX = topLandingX + 120`, landing width `120`). The pole's grab column overlaps the landing's static body, so the "walk-to-pole" cutscene either (a) never advances past `player.pos.x >= cutscenePoleX` cleanly because the landing keeps solid-body contact right up to that x, or (b) attaches for one frame and immediately re-lands on the still-solid landing body.

- Shrink the top landing width from **120 → 72** and move the pole right: `poleX = topLandingX + 96` (24 px of empty air between landing edge and pole).
- Keep `poleX <= LEVEL_END - 40` (still ~9160, well inside 9600). Update the existing dev warning threshold — no change needed to the value, just verify.
- Raise the pole cap: `poleTop = topLandingY - 60` (was `-40`) so the yellow knob sits clearly above the landing and reads as a grab target.
- In the `walk-to-pole` cutscene branch, before setting `firePoleAttached`, `unuse("body")` AND `unuse("area")` on the top landing (already done) AND destroy the landing after attach so it can never re-collide during the slide.
- Extend the slide: since `poleTop` is higher, the descent distance grows by ~20 px — visibly more Mario-flagpole-like. The 220 px/s slide speed stays the same.
- Move the `medical-id` card left by 10 px (`idX = topLandingX + 30`) so it still sits on the narrower landing.
- Move `GRAB THE ID →` label to align with the new ID position.

## 4. Verification

Playwright pass at 1280×800 and 852×402:

- Zone 3: screenshot mid-zone; confirm form-monsters and each doc collectible are unmistakably visible against the background.
- Zone 7 boss: scripted jumps from directly above → hearts decrement 3× and key drops. Walk into boss side-on → life lost. Repeat 5× to confirm no misfires.
- Zone 8: play through to Medical ID → pole is visibly detached from landing, cutscene walks hero to pole, hero snaps to cap, slides all the way to ground, fireworks fire, WIN screen shows.

## Out of scope

- No music, HUD, or non-game code changes.
- No new sprite art — only display-size and geometry tweaks.
