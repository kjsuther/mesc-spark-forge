# Fix: game stuck on the loading screen

## What I checked

I ran the full boot path locally (title → journey map → controls → START RUN → Zone 1 briefing). It loaded fine in a clean browser with no console errors and no failed requests, so the code path itself is not broken — the freeze is happening on your device/session. Two things in the current code let a hiccup turn into a permanent freeze:

1. **The loading overlay has no timeout or escape hatch.** In the boot effect, `setLoading(false)` runs only on success, and `setError(...)` only when `startGame` actually throws. If any asset fetch or image decode hangs instead of failing (a stalled network, a paused background tab, an interrupted response), the promise never settles: no error card, no retry button, spinner forever. That matches "frozen on the loading screen" exactly.
2. **The offline service worker is cache-first and never revalidates.** `public/sw.js` (`mesc-trail-v4`) serves any cached script/style/image straight from the cache with no network check, and the cache is only cleared when `CACHE_NAME` is bumped. A device that cached assets from an older build keeps serving them after a new deploy, so its JS and its asset URLs can disagree — a classic permanent stall on returning visitors and installed home-screen copies.

## Immediate workaround (no deploy needed)

Hard-refresh the page, or on a phone close the tab and reopen. If it was launched from a saved home-screen icon, that copy is the most likely to be holding stale cache.

## The fix

### 1. Never let the loader hang silently
- Add a watchdog to the boot effect: if the run has not booted within ~15s, cancel the in-flight boot, release the canvas context, and show the existing error card with a Retry button instead of the spinner.
- Give the loading overlay a visible progress/status line ("Loading art…", "Starting engine…") so a slow load reads as progress rather than a freeze.
- Show a "Skip / Retry" affordance on the overlay after ~8s so a player at a conference is never trapped.

### 2. Make asset loading fail loudly instead of hanging
- Wrap the sprite/backdrop loads in `game-scenes.ts` with a per-asset timeout so a stalled fetch rejects rather than pending forever, and surface which asset failed in the error message.
- Keep the existing retry path, which already replaces the canvas element for a fresh graphics context.

### 3. Fix the stale-cache trap in the service worker
- Switch script/style/asset handling from cache-first to stale-while-revalidate: serve the cache immediately but fetch in the background and update it, so the next load is always current.
- Never cache hashed `/assets/*` responses across builds without revalidation; drop entries that 404 on revalidate.
- Bump `CACHE_NAME` so every existing device discards the current cache once on next visit.

### 4. Verify
Playwright runs at desktop, iPhone SE and Pixel 7 viewports: cold load, reload, and a simulated stalled-asset run to confirm the watchdog produces the error card with Retry instead of a permanent spinner. Also verify a second visit after a cache bump loads the new build.

## Technical notes

- Files touched: `src/components/game/game-canvas.tsx` (boot watchdog, loading overlay states), `src/components/game/game-scenes.ts` (per-asset load timeouts and error attribution), `public/sw.js` (stale-while-revalidate + cache version bump).
- No gameplay, physics, scoring, zone content, or control changes.
