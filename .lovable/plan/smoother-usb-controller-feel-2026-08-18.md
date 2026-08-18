# Smoother USB controller feel

Reviewed `src/lib/gamepad.ts` (the shared poll service), the controller bridge in `src/components/game/game-canvas.tsx`, and how the engine consumes movement in `src/components/game/game-scenes.ts`. Keyboard and the mobile joystick feed the engine directly every frame; the controller path goes through a separate polling loop with settings that make it feel stiff and occasionally drop inputs. Four concrete causes, four fixes. No gameplay values, physics, or level content change.

## 1. Dead zone is far too large, and only one axis pair is read

`DEAD_ZONE = 0.45` means nearly half the stick throw does nothing before the hero moves — that alone reads as "laggy and stiff" compared to keyboard. The poll also only reads `axes[0]`/`axes[1]` plus D-pad buttons 12–15. Many arcade sticks (the Trooper 2 included, depending on its switch position) report direction on a hat axis (`axes[9]`) or on `axes[6]/[7]`, so on those modes directions register erratically or not at all.

Fix:
- Drop the movement dead zone to ~0.20 with a small hysteresis (release at ~0.15) so direction doesn't flicker at the threshold.
- Read the hat axis (`axes[9]`, decoded to the 8 compass directions) and `axes[6]/[7]` in addition to `axes[0]/[1]` and D-pad buttons, and merge all sources.
- Keep the larger dead zone only for the menu/tap navigation path, where an over-sensitive stick would over-scroll.

## 2. Presses shorter than one poll frame are lost

Edge detection compares the current pressed set against the previous frame's set. A quick jump tap that goes down and up between two polls never registers — the classic "I pressed jump and nothing happened" on a stick.

Fix: latch button presses. Any button seen pressed since the last frame counts as a press for that frame, even if it is already released, and use each pad's `timestamp` to detect fresh state. Track edges per pad rather than one merged set, so two connected devices can't cancel each other's edges.

## 3. The confirm button fires a fake Enter into the canvas during play

Every confirm press dispatches a synthetic `Enter` keydown/keyup at the game canvas. During an actual run that can trip in-game "press Enter to continue" and pause/advance handling at the same moment it jumps — pauses and skipped prompts that feel like input jitter.

Fix: only forward the synthetic Enter while a prompt/briefing/pause screen is actually showing, not during live play. Also accept jump on the common face buttons (0, 1, 2, 3) plus stick-up, so whichever button the player presses on an arcade stick works.

## 4. Held direction can stick, and input stops when the loop stalls

`input.left/right` is written only when the poll loop ticks. If the pad is unplugged, the tab is backgrounded, or the loop stops while a direction is held, the flags stay set and the hero keeps running.

Fix: clear the movement flags on disconnect, on `visibilitychange`, on blur, and when the poll loop stops; and re-arm the direction cleanly when the pad reconnects.

## Verification

Test with an emulated standard gamepad in the preview: sweep the stick slowly to confirm movement starts near the edge of the dead zone and stops cleanly; rapid alternating left/right taps all register; short jump taps register while a direction is held; a jump during a briefing screen advances the prompt without also jumping; unplugging mid-run stops the hero instead of leaving him running. Keyboard and touch paths re-checked for no regression.

## Technical notes

- Files touched: `src/lib/gamepad.ts` (dead zone + hysteresis, hat/extra axes, per-pad latched edges, stop/disconnect reset) and `src/components/game/game-canvas.tsx` (jump buttons, prompt-only Enter forwarding, movement-flag clearing on blur/visibility/disconnect).
- `src/hooks/use-gamepad-navigation.ts` keeps its current higher dead zone for menu navigation.
