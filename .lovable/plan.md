# Windowed-mode readability + Zone 8 flag slide

## 1. Desktop canvas adapts between windowed and fullscreen

What the code does today (confirmed by reading `game-scenes.ts`):

- The engine picks its logical viewport width once, at engine start (`computeViewW`), from the canvas box at that moment.
- The UI text scale (`UI_TEXT_SCALE`) is recomputed only when a step/briefing screen is opened, not when the window resizes or the player enters/leaves fullscreen.
- So any screen already on-screen keeps the sizing it was built with: enter fullscreen mid-briefing and text stays small; leave fullscreen and panels/buttons stay oversized and can overflow the smaller box.

Changes:

- Recompute the text scale on every layout-changing event (window resize, fullscreen enter/exit, device-pixel-ratio change) instead of only at screen-open time, and re-layout whatever screen is currently displayed so titles, body copy, icon captions, and prompt buttons resize immediately.
- Rebuild the UI screens (title/controls/step-briefing/pause/game-over/win, HUD, help plaques) from a single layout pass driven by the live canvas size, so panels, wrapped text, and buttons always fit inside the visible box instead of being clipped at the edges.
- Constrain panel width/height to a fraction of the visible viewport and let font size derive from that box, so windowed play never produces text larger than the panel that holds it.
- Keep the logical viewport width in sync when the aspect ratio changes (windowed 16:9 vs fullscreen wider displays), rather than freezing it at boot.
- Leave the gameplay world scale, physics, spawn positions, and scoring untouched — this is presentation only.

Verification: Playwright at desktop windowed (small, medium, and large browser windows) and fullscreen, toggling fullscreen while a briefing screen is open, plus phone landscape re-check for no regression. Screenshots of title, controls, a zone briefing, pause, and the win screen at each size.

## 2. Yellow flag rides down the pole in Zone 8

At the end of Zone 8 the hero grabs the fire pole and descends at a fixed speed until the base. Today the pole has only a static yellow cap at the top.

Change:

- Add a yellow pennant flag at the top of the pole when the zone loads (visible before the slide, flying from the pole cap).
- When the slide starts, the flag detaches from the top and descends with the hero, held just above the character, matching the hero's descent speed for the whole slide.
- The flag stops at the pole base with the hero and stays planted there through the walk-to-office beat and the win overlay.
- Slide timing, win detection, and the pole colliders are unchanged.

## Technical notes

- Files touched: `src/components/game/game-scenes.ts` (scale recompute + UI layout pass, Zone 8 pole flag) and `src/components/game/game-canvas.tsx` (notify the engine on resize/fullscreen change).
- No database, scoring, or route changes.
