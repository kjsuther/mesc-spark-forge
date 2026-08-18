# Attract / demo mode on the title screen

If the title screen sits untouched for 60 seconds, the game starts playing itself so passers-by see real gameplay instead of a static menu. A banner across the top says it is demo mode and how to take over.

## How it behaves

- After 60s with no input (no key, tap, click, or controller input) on the title screen, the game boots a run in demo mode.
- An autopilot plays the hero: runs right, jumps gaps, enemies, and onto platforms, collects the required items, picks a plan in Zone 7 and fights the bear. It is invincible, so the demo keeps rolling through the zones and loops back to Zone 1 after the finale.
- A persistent overlay strip shows: "DEMO MODE — Press ESC (keyboard) or the left stick button (controller) to play" — with the touch wording "Tap the screen to play" on phones/tablets.
- Any of these exits instantly back to the title menu, with the run discarded: Escape key, controller left-stick click (also accepts Start/any face button), a tap/click on the canvas, or any keyboard key.
- Demo runs never post a score, never count for the leaderboard, never show the vote or feedback end screens, and never touch saved progress or the resume snapshot.
- Music follows the demo zones as normal; the existing sound toggle still applies.

## Technical notes

- `game-canvas.tsx`
  - Idle timer: a 60s timer, reset on `keydown`, `pointerdown`, and any gamepad frame with input, running only while `launchMode === null` and `menuScreen === "title"`. On fire, set a new `demo` launch mode.
  - New `demoMode` state passed into `startGame({ demo: true, ... })`; while active, `onWin`/`onLose` route to "exit to title" instead of `setEndResult`, and score entry / vote overlays are suppressed.
  - Exit handler clears `__gameInput`, tears down the engine (same path as the existing exit-to-title flow), and returns to `menuScreen: "title"`.
  - Controller: read the existing `subscribeGamepad` frames; treat button 10 (left-stick click) plus Start as the demo-exit signal. `src/lib/gamepad.ts` gains an `exit` (button 10/11) edge flag in `GamepadFrame` alongside `start`/`select` — no change to existing fields.
  - Demo banner rendered in the existing overlay layer above the canvas, styled like the other 16-bit cards, device-aware copy from `src/lib/device.ts`.
- `game-scenes.ts`
  - `StartGameOpts` gains `demo?: boolean`.
  - When set: player takes no damage (hit handlers no-op, hazards/pits respawn on the last safe ground rather than losing a life), instructional pause screens auto-advance after ~2.5s, and the finale auto-returns via a new `onDemoLoop` callback.
  - Autopilot writes into the same `window.__gameInput` bridge each frame so no movement/physics code changes: hold right; jump when a gap, hazard, or enemy is detected within a short look-ahead in front of the hero, or when the hero has not moved horizontally for ~0.4s (unstick); brief left nudge when blocked; press the action inputs when standing on a required pickup/door. Boss fight: strafe under the bear and fire on a fixed cadence.
  - Nothing in the scoring, snapshot, or high-score paths is called while `demo` is true.

## Verification

Playwright: load the game page, wait out the idle timer, confirm the demo boots and the hero advances through Zone 1 without dying; press Escape and confirm the title menu is back with a fresh idle timer; repeat the exit with a simulated controller button-10 press.
