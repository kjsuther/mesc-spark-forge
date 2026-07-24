# QA Report — Blazing the Trail to Coverage

Verified 2026-07-24 via `tsgo --noEmit` (clean) and Playwright smoke at 1280×800 + 402×800 (no console errors).

## Fixes shipped

| Issue | Root cause | Fix | File |
|---|---|---|---|
| Player slid off / lagged behind moving river platforms | Static-body platforms translated via `onUpdate` don't transfer velocity to riders | Tag `"platform"`, track `platformSpeed` each frame, remember `player.riding` via top-collision, add carry `pos.x += platformSpeed.x * dt` and snap `pos.y` to platform top | `game-scenes.ts` |
| Player felt "sticky" jumping off edges | No coyote time / jump buffer | 90 ms coyote window after last-grounded, 120 ms buffered jump on landing | `game-scenes.ts` |
| Enemies, docs, campfire, signposts, gate stamp, backpack floated / clipped | Positioned via `y - height` with default (top-left) anchor and full-frame hitboxes | `anchor("bot")` at `GROUND_Y` everywhere; explicit trimmed `k.Rect` hitboxes per entity | `game-scenes.ts` |
| Form-monsters could over-shoot patrol edge and jitter | Reversed `dir` only after crossing, so they crept out one frame per turn | Clamp `pos.x` to `home ± range` before reversing; also `flipX` on turn | `game-scenes.ts` |
| Multi-hit death from one contact frame | No i-frames on player | 600 ms invulnerability window after `loseLife` | `game-scenes.ts` |
| Player could walk off the left edge | No world bounds | Invisible static walls at `x=-20` and `x=LEVEL_END` | `game-scenes.ts` |
| River kill-plane sat inside solid ground tiles | Global 60px slab at `GROUND_Y + 90` | Kill-plane scoped to river gap only, at `GROUND_Y + 40` | `game-scenes.ts` |
| Player hitbox off-center under `anchor("bot")` | Rect offset `(10, -58)` biased right | Rect `(-12, -58, 24, 58)` centered on sprite | `game-scenes.ts` |
| Mobile browser interference (long-press menu, pinch zoom, text selection, pull-to-refresh) | Container had no touch/user-select CSS or gesture handlers | `touch-action:none`, `user-select:none`, `-webkit-touch-callout:none`, `overscroll-behavior:contain`, `contextmenu` and `gesturestart` blocked | `game-canvas.tsx` |
| No fullscreen | Missing button | `⛶ Full` toggle with `webkitRequestFullscreen` fallback; touch controls overlay bottom with `env(safe-area-inset-bottom)` while fullscreen; canvas letterboxed 16:9 | `game-canvas.tsx` |
| Touch buttons could drop input on drag | No pointer capture | `setPointerCapture(pointerId)` on down | `game-canvas.tsx` |
| Camera clamp stale in fullscreen | (was already recomputing) | Verified `k.width()` called each frame | `game-scenes.ts` |

## Known limitations (out of scope for this pass)

- **Audio / SFX / music** — game has no audio system; not added here.
- **Gamepad / controller support** — not implemented.
- **Double jump** — mechanic intentionally single-jump.
- **New sprite art / animation frames** — using existing 6-frame character sheet (idle / walk×4 / jump).

## Regression checks

- Desktop 1280×800: game boots, player stands flush on ground, no console errors.
- Mobile 402×800: touch controls visible below canvas, reset (⟳) button present, fullscreen toggle present.
- Physics jump math (`gravity=1800`, `jumpVel=680`): max height ≈128 px, airtime ≈0.76 s → horizontal reach ≈180 px, still within river-platform spacing.
