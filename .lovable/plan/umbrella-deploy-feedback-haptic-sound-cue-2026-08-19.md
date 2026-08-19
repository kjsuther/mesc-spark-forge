# Umbrella deploy feedback: haptic + sound cue

When the umbrella actually opens (Down held in the waiting zone), give a short, subtle confirmation: a soft 16-bit "canopy pop" sound plus a light vibration on phones and on a connected controller. Fires only on the moment of deploy, never repeatedly while held, and stays silent if the sound toggle is off (vibration still allowed, since it is a separate channel).

## What changes

- New shared haptics helper: one small function that triggers a short buzz using the phone's vibration support and, when a gamepad is connected, its rumble support. Silently does nothing where unsupported (iOS Safari, most keyboards-only setups).
- New "umbrella" sound effect in the existing procedural sound engine: a very short airy whoosh plus a soft click, quieter than pickups so it doesn't compete with music.
- Umbrella logic: on the transition from not-deployed to deployed, play the sound and fire the haptic pulse. Also a tiny, even softer cue on close (optional, off by default — no extra noise).
- No changes to how the umbrella blocks damage, the slow-down, or the existing first-time hint.

## Technical notes

- `src/lib/haptics.ts` (new): `pulse(ms, strength)` wrapping `navigator.vibrate` and `gamepad.vibrationActuator.playEffect("dual-rumble", …)`; feature-detected, wrapped in try/catch, no-ops during SSR.
- `src/lib/game-sfx.ts`: add `"umbrella"` to `SfxKind` and a case in `playSfx` (short bandpassed noise burst ~90ms + light triangle blip), respecting the existing `enabled` flag.
- `src/components/game/game-scenes.ts` (~line 6985): in the umbrella update block, detect `nowUp && !umbrellaState.up` and call `playSfx("umbrella")` + `pulse(35, 0.35)`. Keeps the existing `taught` hint behaviour intact.
- Gamepad access for rumble comes from the current connected pad via `navigator.getGamepads()`; no change to `src/lib/gamepad.ts` input handling.
