# Mobile-First Playability Fixes

## Problems observed

1. **Portrait mode looks broken on mobile.** The rotate-to-landscape prompt is gated behind `!!launchMode && isTouch && portrait`, so before you tap Start there is no message and no visible way to know what to do. On a 402×852 phone the title card renders but the "Start Game" buttons sit inside a 16:9 canvas box that is only ~226px tall, so tap targets are cramped and the game never launches.
2. **Fullscreen wastes screen space.** In faux-fullscreen, the touch controls live in a separate 96px row *below* the canvas (`calc(100dvh - 96px)`), shrinking the game. The controls themselves are plain circles with tiny labels — they don't read as game buttons.
3. **Buttons don't feel like game buttons.** Flat circles, thin labels, no D-pad grouping, no visual affordance for press state.

## Fix plan — all in `src/components/game/game-canvas.tsx`

### 1. Portrait handling on mobile (before AND after start)

- Show the rotate overlay whenever `isTouch && portrait`, regardless of `launchMode`. This means a mobile user in portrait sees the rotate hint immediately on page load and cannot get stuck on a squished title screen.
- Overlay copy: pixel-art phone icon that rotates, "TURN YOUR PHONE" headline, subtitle "Blazing the Trail is a landscape adventure." Remove the Exit button in the pre-launch state (nothing to exit from yet); keep it once a game is running.
- Overlay uses `position: fixed; inset: 0; z-index: 10000` and a solid MN-blue background so nothing behind it shows through.

### 2. Fullscreen layout maximizes the canvas

- Drop the separate control row. Canvas box becomes `width: 100vw; height: 100dvh` with `aspect-ratio: 16/9` + `object-fit: contain` so the game fills the viewport, letterboxed only where the phone isn't 16:9.
- Render touch controls as **absolutely-positioned overlays on top of the canvas** in the bottom-left (D-pad: ◀ ▶) and bottom-right (⟳ small, JUMP large). They use `env(safe-area-inset-*)` padding so they clear iPhone notch/home indicator.
- Overlay controls only appear when `isTouch` — desktop fullscreen stays keyboard-only and clean.
- Exit (✕) stays top-right; add a small ⛶ toggle only in non-fullscreen mode (unchanged).

### 3. Buttons that look like game buttons

Rework `LabeledTouch` for the overlay use case:

- Chunky rounded-square (not circle) with a 3-4px cream border, gold inner ring, and a `box-shadow` "chiselled" bevel that inverts on `:active` — reads as a physical SNES-style button.
- Semi-transparent MN-blue fill (`bg-mn-blue/70` + `backdrop-blur-sm`) so gameplay is still faintly visible behind them.
- Jump: ~92×92 px, bold "JUMP" text with orange accent. D-pad arrows: ~72×72 px, grouped tight (4px gap) so they read as a pair. Restart: ~56×56 px, dimmer.
- Labels: keep the tiny pixel-font caption *inside* the button (top-left corner mini badge), not below, so they don't add vertical space.

### 4. Small polish

- Portrait overlay listens to `orientationchange` / `resize` (already in `useOrientation`) — verify it clears the moment the user rotates.
- Reduce the "faux-fullscreen bottom padding" leftover (no longer needed).
- Keep `touch-action: none` on canvas and buttons so scrolling never fights the game.

## Out of scope

- No changes to `game-scenes.ts`, physics, art, Supabase, or voting.
- No layout changes to the non-game parts of the page.

## Verification

- Playwright at 402×852 (portrait): rotate overlay visible on page load, no title card fighting for space.
- Playwright at 852×402 (landscape, touch emulation): title → Start → game fills the viewport, D-pad + JUMP overlaid at the bottom corners, canvas is ~vh tall (not `vh − 96px`).
- Playwright at desktop 1280×800: no overlay controls, keyboard hint present.
