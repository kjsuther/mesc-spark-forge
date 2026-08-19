# Demo Mode: 30-Second Trigger and a Reliable Full Playthrough

Two goals: start the attract/demo run sooner, and make the auto-played run reach the end of the trail every time instead of stalling with a closed door.

## 1. Start demo after 30 seconds idle

- Reduce the idle timer from 60 seconds to 30 seconds.
- Count idle time on any pre-game menu screen (title, journey map, controls), not only the title screen, so an abandoned session still rolls into the demo.
- Any real input (key, tap, click, controller button, mouse move) resets the timer and, once the demo is running, exits it back to the title as it does today.

## 2. Make every zone finish in demo mode

Current behavior: the bot only force-opens a stuck zone's door after a full 60 seconds, so a passer-by sees the hero pinned against a closed door for a minute. Fix in three layers:

- **Shorter safety valve.** In demo mode only, if the zone objective has not been met after roughly 15 seconds in that zone, complete the objective the honest way (mark the zone's requirement satisfied) and open the door. Cap it so no zone can hold the demo longer than that.
- **Smarter objectives per zone.** Give the bot explicit targets for the zones it currently has none for: crossing the river in Zone 3 (aim for the door side, hop the moving platforms), and waiting out the approval clock in Zone 6 without the anti-stuck logic teleporting it away.
- **Head for the door.** Once a zone's door is unlocked and nothing is left to collect, the bot walks directly to the door position instead of drifting right, so the walk-through always triggers.

## 3. Remove the glitchy nudges

- The current "wedged" recovery teleports the hero 70px to the right, which can drop it into a pit or past a required pickup. Replace it with a jump-then-short-hop recovery, and only fall back to a position reset that lands the hero on solid ground inside the current zone.
- Keep the existing demo invulnerability (the bot never loses a life) and the pit rescue that returns it to the zone entrance.
- Shorten briefing auto-close slightly in demo so the pacing keeps moving, while text remains readable.

## Technical Notes

- `src/components/game/game-canvas.tsx`: `DEMO_IDLE_MS` 60000 -> 30000; broaden the idle effect's screen condition beyond `menuScreen === "title"`.
- `src/components/game/game-scenes.ts` attract-mode block (`demoAutopilot`, `demoTarget`, `demoBoss`): add Zone 3 river and Zone 6 wait targeting, add a `DEMO_ZONE_TIMEOUT` of ~15s driving `unlockDoor` plus the matching `zoneState` flags so the HUD/objective stay consistent, add door-seeking when `doors[currentZone].unlocked`, and replace the `player.pos.x += 70` nudge with a grounded, in-zone recovery.
- No changes to normal (human) play, scoring, or difficulty; all new logic is gated behind the existing `DEMO` flag.
