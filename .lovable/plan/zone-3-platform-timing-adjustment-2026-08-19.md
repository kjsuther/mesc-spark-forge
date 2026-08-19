# Zone 3 platform timing adjustment

## User-facing summary
Increase the warning window for the collapsing river platforms in **Zone 3 (Crossing River of Paperwork)** so the player has more time standing on a platform before it begins to fall.

## Technical details
- File: `src/components/game/game-scenes.ts`
- The river platforms are the four labeled sections of the application crossing (`ABOUT YOU`, `HOUSEHOLD`, `INCOME`, `SIGNATURE`) near line 2471.
- They currently shake/warn for `SHAKE_S = 0.28` seconds before dropping.
- Change the constant `SHAKE_S` from `0.28` to a longer value (e.g. `0.55` or `0.6`) so the platform stays up longer.
- No other behavior changes (fall speed, fall gravity, platform positions, bridge option, etc.).
- Verify by playing Zone 3 and confirming the platforms remain solid for a noticeably longer beat before the collapse/fade animation starts.
