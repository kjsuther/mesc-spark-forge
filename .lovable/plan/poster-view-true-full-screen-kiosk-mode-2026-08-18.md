# Poster View: true full-screen kiosk mode

Goal: on a poster/kiosk machine, the Poster View fills the entire monitor with no Windows taskbar and no browser toolbars.

Important constraint: a web page cannot hide the OS taskbar or browser chrome on its own. The only way to do it is the browser Fullscreen API, which requires one user gesture (a click or key press) to enter. So the plan is to make entering that state instant and obvious, and to keep it sticky.

## What changes

1. **Enter Fullscreen button on Poster View**
   A prominent "Go Fullscreen" control in the poster header. One click puts the whole page (`document.documentElement`) into fullscreen — taskbar and browser menu disappear, poster fills the monitor.

2. **Auto-enter on first interaction**
   If the poster page is not already fullscreen, the first click, tap, or key press anywhere on the page requests fullscreen automatically. So whoever opens the poster in the morning just clicks once.

3. **Sticky and self-healing**
   Track fullscreen state. If someone presses Esc or the browser drops out of fullscreen, show a small unobtrusive "Fullscreen" prompt again instead of leaving the kiosk in a half state.

4. **Chrome-free layout while fullscreen**
   While fullscreen is active, hide the header controls that only matter to an operator (the fullscreen button and the "Exit Poster" link) behind a hover/edge reveal, so the screen is pure poster content: game, leaderboard, implemented feedback, feedback log. Moving the mouse to the top of the screen brings them back.

5. **No layout shift when entering fullscreen**
   The poster grid is already height-driven; verify at full monitor height that the three top scores and four truncated feedback items still fit and the game iframe keeps its aspect.

## Truly zero-click alternative (optional, if you want it)

If the poster machine should boot straight into a chrome-free screen with no click at all, launch the browser in kiosk mode from a desktop shortcut:

```text
chrome.exe --kiosk --edge-kiosk-type=fullscreen "https://<site>/admin/poster"
```

That is an OS/shortcut setting, not a code change. I can add a short "Kiosk setup" note on the admin page with the exact command if useful.

## Technical notes

- Files touched: `src/routes/admin.poster.tsx` only (fullscreen request/exit helpers, state, header reveal). The game canvas already has its own fullscreen helpers; the poster page gets its own page-level one so the whole poster — not just the game iframe — goes fullscreen.
- Uses `requestFullscreen` with the `webkit` fallback, mirroring the existing pattern in `src/components/game/game-canvas.tsx`.
- No change to the game, scoring, feedback data, or any other route.
