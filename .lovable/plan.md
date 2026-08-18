# Warm-Up Zone (Practice Trail) Before Zone 1

Add a short, safe practice stage that runs before the Zone 1 briefing so players can learn movement, jumping and collecting with no way to lose, and leave through a door when they feel ready.

## What the player experiences

1. Start a run (Play, or Play Again) → the game opens on **WARM-UP · PRACTICE TRAIL** instead of dropping straight into Zone 1.
2. A calm forest clearing, roughly one screen and a half wide, with:
   - No enemies, no hazards, no pits — falling is impossible, timer and score are not running.
   - A ground-level sign: "Practice here. Nothing can hurt you."
   - Coach plaques placed along the trail, keyed to the player's device: keyboard/controller text on desktop, joystick + jump-button text on touch.
   - Two low platforms to practice jumping onto, one gap-free hop, and one question brick that pops a practice item so pickups feel familiar.
3. Small checklist HUD in the corner tracks three optional actions: MOVE, JUMP, COLLECT. Each ticks off as it is done.
4. Once all three tick (or after ~20 seconds either way), the exit door at the right lights up, a chime plays and a plaque reads **"You're ready — go through the door to start."** The door stays visibly locked/dim before then, with a nudge line: "Try moving, jumping and grabbing the item."
5. Entering the door starts Zone 1 exactly as today: Step 1 briefing screen, then normal play with lives, timer and scoring beginning at Zone 1.

## Behaviour rules

- Warm-up is shown only when a run starts at Zone 1. Resuming at a later stage (Case Status Checker upgrade) skips it.
- A "SKIP WARM-UP" prompt is on screen the whole time (Enter / Start / tap) for repeat players.
- Demo/attract mode skips the warm-up entirely and starts on Zone 1, so watchers see real gameplay.
- Warm-up time is excluded from run time, so pace scoring and the leaderboard are unaffected.
- All new on-screen strings get Spanish entries so the language toggle keeps working.

## Technical notes

- The main level is one continuous `trail` scene where zone index is derived from `x / BIOME_W`, so the warm-up will not be inserted into that world (it would shift every hardcoded zone coordinate). Instead it is a separate lightweight Kaplay scene, `warmup`, in `src/components/game/game-scenes.ts`, reusing the existing hero sprite, ground/platform helpers, sign-plaque helper, door object and pickup sfx.
- Boot flow at the end of `startGame` changes from always `k.go("trail", ...)` to `k.go("warmup")` when `resumeZone === 0`, no boot snapshot exists and demo mode is off; the door handler then calls the same `k.go("trail", START_X(), lives, null)` used today.
- The warm-up scene reuses the existing device-detection helper for control copy and the same touch-control mounting used by `trail`, so the mobile joystick and jump button behave identically.
- New strings are added to `src/lib/i18n.ts`.

## Out of scope

No changes to Zones 1-8, scoring formula, high scores, admin, or the website.
