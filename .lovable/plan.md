# Fixes: Zone 4 sprites, visibility, trail map, boss

All edits are in `src/components/game/game-scenes.ts`, `src/components/game/game-canvas.tsx`, plus regenerated art assets under `src/assets/game/`.

## 1. Rebuild Zone 4 form-monster from scratch
- Regenerate `form-monster` art as a brand-new standalone 128×128 opaque pixel sprite: a menacing but readable "paperwork clipboard creature" with clear silhouette, dark outline, saturated palette (red/black/white), and cartoon-monster face — no reuse of the current one.
- Save as new file `src/assets/game/form-monster-v2.png` (new asset, so the old library entry is bypassed). Old `form-monster` frame from `props-sheet` is no longer referenced.
- In `loadAllSprites`, load `form-monster` via `safeLoadSheet` from the new PNG (single frame), the same way `doc-id`/`doc-paystub` are loaded — remove the `props-sheet` frame entry named `form-monster` at line 542.
- Keep `DISPLAY_H["form-monster"] = 36` (already sized for Zone 4). Verify the Zone 4 spawn at line ~1292 renders on the ground with no clipping.

## 2. Paper airplanes opaque + higher-contrast
- Regenerate `src/assets/game/paper-airplane.png` as a fully filled-in, saturated white/red pixel-art paper airplane with a bold black outline on a transparent background (transparent = outside silhouette, not the plane body).
- In Zone 5 airplane spawn (~line 1369), remove `k.opacity(0.9)` so planes render fully opaque, and bump display size (`DISPLAY_H["paper-airplane"]` from 26 → 32).

## 3. Trail-map background matches the uploaded reference
- Regenerate `src/assets/game/trail-map-bg.png` as a top-down illustrated parchment map (cream background, dashed trail, forest/river/mountain/hospital icons, numbered stops 1–8) closely matching the uploaded reference image.
- In `TrailMap` (`game-canvas.tsx` line 714), replace the CSS gradient background with `backgroundImage: url(trailMapBg)` (imported), `backgroundSize: cover`. Keep the SVG dashed-line reveal overlay on top so the 8 nodes still animate in sequence over the illustrated map.

## 4. Zone 4 door-unlock docs opaque + brighter
- Regenerate the three Zone 4 pickup icons (`doc-id.png`, `doc-paystub.png`, `doc-envelope.png`) as fully filled-in, high-saturation pixel-art cards with thick black outlines and a bright inner fill (teal, green, cream). No translucent regions inside the silhouette.
- Overwrite the existing lovable-asset entries so the URLs stay valid.
- Confirm no `k.opacity(...)` is applied to the doc pickups (currently none — leave as is).

## 5. Boss fight rebalance (Zone 7 / code Zone 6)
Spawn position + mechanics changes in `spawnPlanBoss()` (~line 2153):

- **Spawn location**: change `bx = BIOME_W * 6 + 560` → `bx = BIOME_W * 6 + 1050` so the boss appears past the "Medica" pedestal (x=860) and closer to the exit door, not on top of the middle "HealthPartners" plan.
- **Reduce required hits**: 3 → **2** stomps.
- **Easier stomp detection**: widen the stomp window — accept a stomp when `playerFoot <= bossTop + bh * 0.75` (up from 0.55) and `vy >= -80` (was -20), OR the previous-frame foot was above the boss. This makes glancing top-hits count.
- **Alternate kill path — projectile stomp assist**: give the player a one-shot "paperwork shield" — when the boss is active, spawn a floating **stapler power-up** (`plan-boss-stapler`, reuse `gold-key` sprite tinted red or a small new 64×64 asset) above a nearby platform. Picking it up grants `player.canThrow = true`. Pressing Jump while holding it (or an on-screen "THROW" button on mobile) throws a projectile that counts as one boss hit and consumes the power-up. This gives players who can't land stomps a guaranteed second path.
  - New tag `"boss-projectile"` with a simple rightward-moving `k.area`; on collide with `"boss"` → same hit path as a stomp (increment `boss.hits`, brief `hurtUntil`, destroy projectile). On collide with any solid or off-screen → destroy.
  - HUD shows `"THROW READY"` when `canThrow` is true.
- **Clearer hearts HUD**: keep the ♥♥ (now 2) but also raise it to `GROUND_Y - bh - 40` so it doesn't overlap the boss sprite.
- Keep the loseLife path unchanged for side/underside contact.

## 6. Verification (Playwright, desktop 1280×800 + mobile 852×402)
- Zone 4: new monster renders, three docs are visibly opaque, level is completable.
- Zone 5: airplanes are fully opaque and easy to see against the sky.
- Trail map screen: illustrated parchment map background renders; dashed reveal animation still works over it.
- Zone 7 boss: appears near the right side past the Medica pedestal; two stomps kill him; stapler pickup + throw also works.

## Out of scope
- Other zones, HUD layout, music, physics constants, or scoring.
