# Demo loop vs. real-run ending

Goal: attract mode replays itself cleanly with no score prompts; a real player's finished run ends the way it always has — score/feedback screen, then back to the start screen (never an automatic replay).

## Current behavior

- When the Thank You screen is left, the game engine reports the win and immediately jumps back into gameplay at Zone 1.
- Demo mode auto-leaves the Thank You screen after 9 seconds, so it both restarts gameplay inside the engine *and* schedules a full engine reboot 4 seconds later — two restarts fighting each other, which can flash a partial run or a stale screen.
- Demo mode already skips scoring and the voting/feedback overlays; that stays as is.

## Changes

1. Demo mode ending
   - After the Thank You screen holds long enough to read, the demo reports the finish once and does a single clean reboot back to the attract-mode title/run — no in-engine jump to Zone 1, no score entry, no vote screen.
   - Any input during that window still exits the demo straight to the title screen.

2. Real-run ending (not demo)
   - Leaving the Thank You screen reports the win exactly as today and shows the high-score / feedback end screen.
   - Instead of silently restarting gameplay behind that screen, the engine parks on the finale so the player returns to the normal title/start screen when they close it. No automatic loop.

## Technical notes

- `src/components/game/game-scenes.ts`, `thanks` scene: split `leaveThanks` into demo and normal paths — demo flushes the win and stops (letting `GameCanvas` reboot the engine); normal flushes the win and stays on a static finale instead of `k.go("trail", ...)`.
- `src/components/game/game-canvas.tsx` already routes `onWin` to `restartDemoRef` in demo and to `setEndResult` otherwise; no change expected beyond confirming the single-reboot path.
- Verify with an automated pass: full demo run loops twice with no overlays, and a manual run ends on the score screen and returns to the title.
