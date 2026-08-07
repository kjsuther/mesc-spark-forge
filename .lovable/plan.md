# Game polish pass: sprites, readability, difficulty, zone icons, music

## 1. Remove the white box around the hero

The three hero images (`character-sheet.png`, `hero-slide-sheet.png`, `hero-portrait.png`) are fully opaque — their corners read as solid white, which is why a white rectangle shows behind him in gameplay and on the Thank You screen. Key out the white background on all three (alpha-threshold with edge cleanup so the hat/bandana outlines stay crisp) and re-save as transparent PNGs. No code changes needed; both game versions share the art.

## 2. Step-screen help text fits on one line

On the briefing screens the icon captions wrap mid-word ("APPLICATIO / N"). Fix by widening the per-icon cell, auto-shrinking the caption font when the label is long, and allowing a clean two-word wrap instead of a mid-word break. Also re-check the body lines so nothing overflows the panel at small viewport widths.

## 3. Clearer in-zone help plaques

Increase plaque size and text scale, raise the contrast (deeper navy fill, thicker gold outline, stronger text shadow), and scale the plaque with the viewport so it stays legible when the game is not full screen.

## 4. Bear boss is tougher

- Health: 3 hits to 5 hits (hearts row updates automatically).
- Jumps more often (shorter interval between hops).
- Fires projectiles more frequently.

## 5. Falling calendar dates hit harder

In the awaiting-decision zone, increase page fall speed and reduce the gap between drops so the sky is busier. Keep the telegraph marker so drops stay fair.

## 6. Zone 1 drops a real icon per application method

Today every brick drops the same generic pickup. Create four 16-bit icons — letter/envelope (by mail), cell phone (by phone), office building (in person), laptop (online) — and drop the icon matching the brick the player smashed. Same physics, pickup, and door-unlock behavior; only the sprite changes.

## 7. Unique music per zone

The music module currently rotates three exploration themes across zones. Compose six new distinct procedural chiptune themes (all original/royalty-free, generated in-app via Web Audio — no licensed samples) so zones 1-7 exploration each get their own theme, and map one theme per zone. Boss music and the Zone 8 theme stay exactly as they are.

## Technical notes

- Art: `src/assets/game/character-sheet.png`, `hero-slide-sheet.png`, `hero-portrait.png` alpha-keyed in place; four new method icons added to `src/assets/game/` and registered in the sprite loader.
- Code: `src/components/game/game-scenes.ts` (step screens, hint plaques, boss constants, calendar tuning, zone-1 method icons) and `src/lib/game-music.ts` (new themes + `ZONE_THEMES` map).
- Every gameplay change is mirrored into `src/components/game/original/game-scenes.ts` only where it is a bug/readability fix (white box, text wrap, plaque contrast). Difficulty, zone-1 icons, and new music stay in the current version so the Original Version remains the frozen baseline.
