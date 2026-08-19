# Mosquito Swarm in the Backdrop

Add small pixel-art mosquitoes that drift back and forth in the background of the game, purely for atmosphere.

## Behavior

- 2-4 mosquitoes per zone, placed at varied heights in the sky/mid-background.
- Each one flies horizontally back and forth across a set stretch of the zone, flipping direction at the ends, with a gentle bobbing wobble so the motion feels alive.
- Slight speed and size variation per mosquito so the swarm doesn't look synchronized.
- Rapid wing flutter (2-frame flap) drawn from tiny pixel shapes, matching the 16-bit look.

## Rules

- Decorative only: no collision, no damage, no score effect, no interaction with the player.
- Drawn on the background layer, behind the player, platforms, hazards, and all UI/instruction text so nothing is obscured.
- Included in the warm-up zone and Zones 1-8 backdrops; skipped in the indoor Thank You screen and during the boss cinematic to avoid clutter.
- Zero impact on gameplay difficulty or timing/scoring.

## Technical Notes

- New `spawnMosquito(k, x, y, range)` helper in `src/components/game/game-scenes.ts`, modeled on the existing decorative helpers (thought bubbles, bear cameos).
- Built from small `k.rect`/`k.circle` primitives (body, wings, thin proboscis) grouped and moved together in a single `onUpdate`, using `LAYERS.BG_NEAR` z-ordering; no new image assets required.
- Called from the shared zone setup path so each zone gets a randomized swarm, with the mosquito count capped low on mobile/low-power devices to protect frame rate.
