## Plan

1. **Fix fullscreen/mobile controls so they don’t cover gameplay**
   - Move touch controls out of the playfield where possible and make fullscreen controls a compact safe-area HUD below/over the lower edge, not giant circles over the character.
   - Use smaller responsive button sizes on narrow screens, keep labels readable, and prevent the labels/buttons from covering the ground line or player.
   - Keep restart, left, right, and jump available in both standard and fullscreen modes.

2. **Repair platform landing and moving-platform physics in Area 2**
   - Rework player/platform collision so the player lands reliably on the river stones.
   - Stop relying on fragile bottom-collision detection only; detect top-surface contact with a small tolerance and snap the player’s visible feet to the platform top.
   - Keep the intended difficulty, but make missed jumps feel fair and predictable instead of caused by collision bugs.

3. **Align all sprites to the same visible path line**
   - Recalculate visible-foot offsets for player, helper, monsters, documents, and gate props.
   - Apply those offsets consistently to ground spawn, patrol updates, respawn, platform snapping, and hitboxes.
   - Adjust enemy hitboxes so they match the visible body, not transparent sprite padding.

4. **Add an SNES-style intro screen**
   - Before the game starts, show a pixel-art title screen for **Blazing the Trail to Coverage**.
   - Include two menu options: **Start Game** and **View High Scores**.
   - Preserve the Standard vs Fullscreen choice, but fold it into the launch flow so mobile users can enter fullscreen before the game mounts.
   - Let **View High Scores** open the live leaderboard without starting gameplay.

5. **Improve end-of-session flow**
   - Confirm the high-score submission screen appears after every win or loss.
   - Keep the leaderboard live-refresh behavior visible after submission and from the intro high-score view.
   - Ensure scoring still rewards every step/progress increment, collected items, zones reached, platform landings, enemies passed, and completion bonuses.

6. **Full mobile UAT pass**
   - Test on a mobile viewport as a real attendee: start screen, fullscreen entry, standard mode, controls, restart, Area 2 river platforms, enemy path alignment, death/retry, score submission, leaderboard view.
   - Also spot-check desktop controls and fullscreen.
   - Make any small playability corrections discovered during UAT while preserving the requested hard baseline difficulty.

## Technical notes

- Main files to update: `src/components/game/game-canvas.tsx`, `src/components/game/game-scenes.ts`, `src/components/game/score-submit.tsx`, and likely `src/routes/tool.tsx` for the intro/high-score flow.
- I’ll avoid changing backend schema unless UAT reveals the leaderboard data path itself is broken.