## Fixes

### 1. Character floating above surfaces (sprite trim)
The player and prop sprites have transparent padding below their visible feet, so `anchor("bot")` puts the sprite's frame bottom on the ground while the drawn feet hover a few pixels above. Fix per-sprite with an offset applied to `pos.y` (e.g., `GROUND_Y + FOOT_OFFSET`), tuned per sprite:

- Player: shift down ~8px so feet meet the ground/platform strip.
- Ranger helper: same treatment.
- Form-monster: shift down ~6px so the visible body sits on the ground.
- Doc pickups, backpack, campfire, signpost, denied stamp: verify and offset as needed via screenshot check.

Also apply the same offset when snapping to moving-platform tops (`player.pos.y = platform.pos.y + FOOT_OFFSET`) and to the ranger's follow logic. Center collision boxes on the visible pixels of each sprite after the offset.

### 2. Villains not on the same vertical line
Same root cause as #1 (sprite trim + wrong anchor snap). After the offset fix, monsters will sit on the same ground strip as the player. Also constrain their `pos.y` to `GROUND_Y + FOOT_OFFSET` every frame so they can't drift.

### 3. End-of-game screen always shows leaderboard + score submit
Currently `<ScoreSubmit>` renders only when `winResult` is truthy (win only). Change so a game-over payload is produced on lose too:

- Extend `WinResult` (rename mental model to `GameResult`) with `won: boolean` and `farthestZone: number` (0-4).
- `onLose` fires with a full `GameResult` (docs collected, farthest zone reached, elapsed time, lives=0, `won:false`).
- In `/tool`, always render `<ScoreSubmit result={result}>` after either callback, and show the live `<Leaderboard>` immediately below (auto-refreshes every 5s already).
- ScoreSubmit copy adapts: "You made it to Step X — score N" (loss) vs. "You covered the trail — score N" (win).

### 4. Scoring rewards collectibles + progress
Update `computeScore` in `src/components/game/score-submit.tsx`:

```
base   = won ? 5000 : 0
docs   = docsCollected * 750
progress = farthestZone * 1000       // 0..4000 for reaching each new biome
lives  = livesRemaining * 500        // only meaningful on win
speed  = won ? max(0, 4000 - floor(duration_ms / 100)) : 0
score  = base + docs + progress + lives + speed
```

This makes every step of the journey worth points even on a loss — collecting a doc, reaching the town gate, reaching the mountain, etc. — which is what "further you make it gives more points" implies.

Track `farthestZone` in the scene: update it every frame from the current zone index and pass it into the callback.

## Files touched
- `src/components/game/game-scenes.ts` — foot offsets, monster y-lock, farthestZone tracking, onLose payload
- `src/components/game/score-submit.tsx` — new scoring formula, adaptive copy
- `src/routes/tool.tsx` — render ScoreSubmit + Leaderboard on both win and lose

## Verification
Playwright screenshots at desktop and mobile of: forest start (feet on ground), river with player on a moving stone (feet on stone), town with form-monsters (feet on same line as player), and a forced game-over with the leaderboard visible and a computed score reflecting docs + progress.

## Out of scope
No new art or sprite sheets; the offsets fix the visible-feet problem without re-slicing sprites. No changes to voting, backend, or the improvement system.
