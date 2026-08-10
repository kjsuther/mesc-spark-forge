# Pre-game screens that fit the window, and Zone 3 platforms that really drop you

## 1. Title / explainer / trail map / controls screens get cut off in windowed desktop

Confirmed cause: the menu overlay scales itself with a factor that is hard-coded to `1` on any non-touch device that is not in fullscreen (`game-canvas.tsx`, `uiScale`). Touch devices already fit their cards to the visible canvas box; desktop windowed play does not, so at a 948x533 canvas the title card plus the three buttons are taller than the box and the "Full Screen" button is clipped, exactly as in the screenshot. The container also clips overflow, so nothing can spill out into view.

Changes:

- Use the same fit-to-box math on desktop windowed play that touch already uses: derive the scale from the live canvas box against the menu design box, clamped so text never becomes unreadably small and never grows past its current size in large windows.
- Measure per screen, not one global number. The title card, explainer, trail map, controls, and high-scores screens have different natural heights; each fits itself to the available box so nothing is clipped on any of them.
- Recompute whenever the box changes: window resize, browser zoom, entering and leaving fullscreen, so a screen already open re-fits immediately instead of keeping its old sizing.
- Keep the buttons reachable: menu content stays vertically centered, and if a screen is still taller than the box at the minimum comfortable scale, it scrolls inside the frame rather than being cut off.
- Fullscreen and mobile behavior stays as it is today.

Verification: headless browser passes at several desktop window sizes (small, medium, large), toggling fullscreen while each menu screen is open, plus a phone-landscape re-check for no regression, with screenshots of the title, explainer, trail map, controls, and high-score screens at each size.

## 2. Zone 3 — falling through a collapsed platform

Reported behavior: when a river platform drops away, the hero stays in the air as if the platform were still there.

The exact cause is not yet confirmed, so the first step is to reproduce it in a scripted play-through of Zone 3 and log what the hero is standing on frame by frame. Two candidates are already visible in the code and will be checked first:

- The "am I riding this platform" bookkeeping stores a freshly built copy of the platform each frame, so the collapse code's check for "the player is riding me" can never match. The ride is therefore never released when the platform lets go.
- The collapse also strips the platform's collision and body components mid-frame; if that throws, the platform's update loop dies and it silently stays solid forever.

Fix direction once reproduced: when a platform enters its falling phase it must stop being ground in every sense — released from the player's ride, removed from the standing-surface search, and no longer collidable — so the hero immediately falls into the gap and hits the water death that already exists. Landing on the next platform, the shake telegraph timing, and the respawn-on-life-loss behavior stay exactly as they are.

Verification: scripted Zone 3 runs covering standing still on a platform until it drops (must lose a life to the water), hopping platform to platform at pace (must cross), and a life loss followed by a retry (all four platforms back at their start).

## Technical notes

- Files touched: `src/components/game/game-canvas.tsx` (menu scale + per-screen fit and re-measure) and `src/components/game/game-scenes.ts` (Zone 3 platform collapse / ride release).
- No gameplay constants, scoring, routes, or database changes.
