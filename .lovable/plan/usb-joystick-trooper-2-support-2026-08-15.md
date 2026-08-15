# USB Joystick (Trooper 2) Support

Make the arcade-style USB controller work everywhere: in the game and for navigating the website pages, without changing any gameplay tuning or existing keyboard/touch controls.

## How it will work

A single shared "gamepad service" polls the browser Gamepad API each frame while any pad is connected. Because the Trooper 2 exposes itself as a standard HID gamepad, it can drive both surfaces:

- **In the game** — the joystick feeds the same input bridge the on-screen buttons already use, so movement, jumping and restart behave identically to keyboard/touch play (including the existing "don't auto-run on restart" guard).
- **On the website** — stick/D-pad moves focus between links and buttons, the main button activates the focused item, and a back button returns to the previous page. This uses real browser focus, so it stays accessible and works with the existing keyboard behavior.

## Default mapping

| Control | Game | Website |
|---|---|---|
| Stick / D-pad left-right | Move hero | Move focus previous/next |
| Stick / D-pad up-down | (up = jump) | Move focus previous/next |
| Button 0 (main / A) | Jump | Activate focused element |
| Button 1 (B) | Continue / dismiss | Go back |
| Button 2 or 3 | — | — |
| Start (button 9) | Continue / start / confirm on menu screens | Jump to Play Game |
| Select (button 8) | Restart run | — |

Values are read with a dead zone so a slightly off-center stick never causes drift, and each direction repeats on a short interval when held (website only) so navigation feels natural rather than racing.

## Menus, briefings and score entry

Pre-game screens (title, story, trail map, controls), zone briefings, pause and win/lose prompts currently listen for Enter/Space/click. The gamepad will trigger the same handlers directly rather than faking key events, so every screen that can be continued with a key can be continued with the joystick. On the high-score name entry, the joystick will move between the field and the submit button; typing still needs a keyboard or the on-screen keyboard.

## Discoverability

- The in-game Controls screen gains a third variant: when a gamepad is connected it shows joystick instructions instead of keyboard or touch instructions.
- A small, quiet "Controller connected" confirmation appears once on connect so the player knows it was detected.

## Technical notes

- New `src/lib/gamepad.ts`: connection tracking (`gamepadconnected` / `gamepaddisconnected`), a rAF poll loop that only runs while a pad is present, edge-detected button presses, dead-zone/axis normalization, and a subscribe API.
- Game wiring: write to the existing `window.__gameInput` bridge (`left`, `right`, `jumpReq`, `resetReq`) from `src/components/game/game-canvas.tsx`, so `game-scenes.ts` gameplay logic is untouched apart from routing menu/continue presses.
- Website wiring: a `useGamepadNavigation()` hook mounted once in `src/routes/__root.tsx`, operating over focusable elements in document order, skipping hidden ones, with scroll-into-view on focus change.
- Controls screen: extend the device branch in `game-canvas.tsx` with a gamepad case, driven by the same service.
- No changes to physics, difficulty, scoring, zone content, or existing input paths.

## Verification

Since the physical controller can't be plugged into the build environment, the polling layer will be exercised with a mocked `navigator.getGamepads` in an automated browser run covering: connect, hold left, jump, start-to-continue on the title screen, and website focus movement. You then confirm the real Trooper 2 button numbering; if any button lands differently, the mapping table is one small edit.
