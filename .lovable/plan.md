## Goal

The soundtrack should react to what's happening on the trail:

- **Zone 7 boss appears** → switch to a darker, tense "boss battle" theme.
- **Boss defeated** (or the player leaves/dies) → return to the normal adventure theme.
- **Zone 8 pole slide + WIN screen** → switch to a triumphant victory fanfare.

Yes, this is very doable — the music is generated procedurally in code, so new themes are just new note data plus a way for the game to request a theme change.

## What changes

### 1. Multi-theme music engine (`src/lib/game-music.ts`)

Today the file hardcodes one melody/bass pair and loops it. Restructure it into a small theme table:

- `adventure` — the current upbeat D-major quest theme (unchanged).
- `boss` — tense battle theme: D minor, slower/heavier feel, driving low triangle bass on eighth notes, dissonant square lead with a snarling detuned second oscillator, noise hits on the downbeat instead of light off-beat hats.
- `victory` — triumphant fanfare: bright major, held brass-like square chords, ascending run resolving on a big sustained tonic; loops as a short celebratory vamp so the WIN screen keeps playing.

Add to the `GameMusic` class:

- `setTheme(name)` — cancels the pending loop timer, briefly ramps the master gain down and back up (~150 ms) so the swap doesn't click, then restarts the loop with the new theme. No-ops when muted or when the theme is already active.
- `getTheme()` and a per-theme `bpm`/`volume` so the boss theme can sit slightly louder and the fanfare brighter.
- The mute toggle keeps working exactly as it does now, and the currently selected theme is remembered across mute/unmute.

### 2. Let the game scene request themes

`startGame` currently has no way to talk to the music (music lives in the React canvas). Add an optional callback to `StartGameOpts`:

```ts
onMusicTheme?: (theme: "adventure" | "boss" | "victory") => void;
```

`src/components/game/game-canvas.tsx` passes a handler that calls `music.setTheme(theme)`, and resets to `adventure` whenever a run restarts or the player returns to the title screen.

### 3. Trigger points in `src/components/game/game-scenes.ts`

- **Boss on** — when the Zone 7 ogre is spawned / first becomes active: `→ "boss"`.
- **Boss off** — on `zoneState.bossDefeated = true` (both the stomp path and the Navigator auto-defeat path): `→ "adventure"`. Also revert if the player loses a life during the fight or walks back out of Zone 7, so the tense music never gets stuck on.
- **Victory** — the moment the medical ID is collected and the Zone 8 cutscene starts (the pole slide): `→ "victory"`. The theme carries straight through the slide into the WIN screen, so there is no second switch.
- **Game over (lose)** — returns to `adventure` behind the high-score screen (no change in feel from today).

## Verification

Play through in a headless browser: confirm no console errors, the boss theme starts when the ogre spawns, reverts on defeat, and the fanfare kicks in at the pole slide and continues on the WIN screen. Audio itself can't be heard in the harness, so I'll also assert the theme-change calls fire at the right moments via instrumentation.
