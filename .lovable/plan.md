## Goal

On phones and tablets, the game should take over the whole screen as soon as the player taps into it — menus included — instead of only after the launch step.

## Current behavior

The game canvas already has two fullscreen paths: the browser's native fullscreen and an in-page overlay that stretches the game across the viewport. Today both only kick in when the player reaches the launch step (or manually presses the "Full Screen" button on the title card), so the title, story, trail map, and controls screens still render inside the small in-page box on mobile.

## Change

On touch devices only:

1. The first tap on the title screen ("Start Game", "High Scores", or tapping the card) immediately turns on the in-page fullscreen overlay, so every menu screen and the game itself use the entire viewport.
2. That same tap also attempts real browser fullscreen (to hide the address bar). If the browser refuses — iOS Safari does — the in-page overlay still covers the screen, so nothing regresses.
3. The existing "Full Screen / Exit Full Screen" title-screen button stays, and still lets the player drop back out; leaving fullscreen won't be undone by the auto-behavior.
4. Desktop behavior is unchanged: fullscreen stays opt-in via the button or the fullscreen launch option.

While the overlay is active, page scrolling behind the game stays locked (already implemented) and the existing safe-area insets, UI scaling, and rotate-to-landscape prompt continue to apply, so the menus stay legible at overlay size.

## Technical notes

- In `src/components/game/game-canvas.tsx`: add a touch-only `enterFullscreenOnFirstTap` helper that sets `fsIntentRef`, `setFauxFullscreen(true)`, and fires `requestNativeFullscreen()` fire-and-forget; guard it with a ref so it runs once and never re-triggers after a manual exit.
- Call it from the title-screen menu button handlers and the "tap anywhere continues" handler on the menu layer.
- Verify the menu scale factor (`uiScale`) and the rotate prompt render correctly with `overlayFs` true while `launchMode` is still null — the menu layer currently assumes the small box on mobile.
- No changes to game logic, scenes, or the original frozen build.
</content>
<summary>Auto-fullscreen the game on mobile from the player's first tap</summary>
</invoke>
