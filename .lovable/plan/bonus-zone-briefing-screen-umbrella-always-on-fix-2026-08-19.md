# Bonus Zone briefing screen + umbrella-always-on fix

## 1. Instruction screen for the secret bonus zone

Right now the player falls into the Zone 2 gap and lands in the Portland waterfront stage with no explanation. Every regular zone opens with a paused briefing card; the bonus stage should get the same treatment.

- When the player warps into the bonus stage, pause the run and show a briefing card in the same 16-bit style as the other steps.
- Content:
  - Title: "SECRET · PORTLAND WATERFRONT"
  - Subtitle: "You found the hidden trail!"
  - Lines: no enemies and nothing here can hurt you; grab the coffee, donuts and cart snacks for points; look for extra lives; when you're done, walk into the EXIT door on the right — it drops you at the start of Step 3.
  - Icons: the bonus treat sprite, the 1-UP heart, and the exit door.
- Shows once per run, dismissed with the same key/button/tap prompt as the other briefings, and it does not re-open if the player somehow re-enters.
- Spanish text for every line.

## 2. Defect: umbrella is up without holding Down

In the waiting/dates zone the umbrella currently appears (and blocks dates) even when the player never presses Down. Two things cause it:

- The Email power-up grants a permanent, always-open umbrella in that zone, independent of input.
- Controller/joystick vertical input can read as "held down" at rest, latching the manual umbrella on.

Fix:

- The umbrella — visual and protection — only exists while Down is actually held (keyboard Down/S, joystick pulled down, gamepad stick or D-pad down). Release it and the umbrella closes immediately.
- The Email power-up no longer opens the umbrella by itself; it stays a benefit in that zone (it removes the movement slow-down while sheltering), but the player still has to hold Down.
- Raise the controller's vertical threshold and require the stick to return near center before Down can re-trigger, so a resting stick never counts as a hold.

## Technical notes

- `src/components/game/game-scenes.ts`
  - Generalize `showStepScreen` (or add a sibling `showInfoScreen(data)`) so a briefing can be shown from a `StepScreen` object that is not indexed by zone number; call it at the end of the bonus-stage entry path (`bonusInterceptsFall` → enter), after the wipe.
  - Umbrella block near line 6794: keep `umbrellaState.up = downHeld && canUmbrella` as the single source of truth; change the visual at ~3809 from `powerUps.umbrellaActive(zoneNow) || umbrellaState.up` to `umbrellaState.up`, and pass only `umbrellaState.up` into the damage check at ~5758.
  - Movement slow factor becomes 1 when `powerUps.umbrellaActive(zoneNow)` is true, else 0.45 while up.
- `src/components/game/managers.ts`: `blocksDamage("boulder", …)` returns true only for the manual-umbrella argument in the waiting zone; the power-up alone no longer blocks.
- `src/lib/gamepad.ts` / `JoystickPad` in `game-canvas.tsx`: higher down threshold with hysteresis (re-arm near center).
- `src/lib/i18n.ts`: new Spanish strings for the bonus briefing.

No other zone content, scoring, or difficulty changes.
