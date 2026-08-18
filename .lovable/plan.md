# Demo Mode: Full End-to-End Playthrough

Today the attract-mode bot just runs right, hops at anything nearby, and if it hasn't finished a zone's task within 22 seconds the door is force-unlocked so the demo can move on. Viewers therefore see doors popping open without the hero actually collecting anything, and the boss fight can be skipped.

Goal: the demo plays the game the way a competent player would — collects every required item, beats the bear, and reaches the WIN screen — without ever dying, at a watchable pace.

## What changes

**Objective-aware autopilot.** Instead of "always walk right", the bot gets a per-zone target list built from the same objects the real objectives check:

- Zone 1: touch the chosen application method
- Zone 2: grab Username and Password
- Zone 3: cross the river
- Zone 4: collect all 3 documents
- Zone 5: collect all 4 mailbox replies
- Zone 6: survive the wait (falling calendars) while dodging
- Zone 7: jump the step-up block, take a plan card, fight the bear, grab the key
- Zone 8: climb the stairs, take the ID card, ride the pole

The bot walks toward the nearest uncollected target, jumps when the target sits above it (platform/pedestal pickups), and only heads for the door once the zone objective reports met.

**Boss fight is played, not skipped.** During the bear battle the bot holds mid-arena range, keeps its auto-fire "+" shots landing on the bear, and prioritizes dodging his jump-fired paperwork over advancing. It stays until all 5 hits land, then collects the key.

**No more cheap door unlocks.** The 22-second force-unlock becomes a much longer, silent safety net (only used if the bot is genuinely wedged), so the normal demo shows real collection.

**Still unloseable.** Existing demo invincibility stays; falls into pits still respawn on solid ground, and the anti-stuck nudge stays as a last resort.

**Watchable pace.** Briefing screens keep auto-closing as they do now, and the Zone 6 wait timer is trimmed in demo mode only so the loop doesn't stall on a countdown.

## Technical notes

All changes live in `src/components/game/game-scenes.ts`, inside the existing `DEMO` branches:

- Replace `demoAutopilot()` with a target-seeking version: query tags (`pickup`/`doc`/`reply`/`plan-pick`/`gold-key`/`id-card`, per zone), pick nearest unclaimed by x, steer toward it, jump when `dy` indicates it's on a platform or pedestal.
- Add a boss sub-state: when `currentZone === 6 && zoneState.planPicked && !zoneState.bossDefeated`, hold position band, jump on `boss-shot` proximity, do not path to the door.
- Keep `takePlan()`'s existing `!DEMO` height bypass so pedestal pickups are reliable.
- Change the zone-entry force-unlock from 22s to a long backstop (~60s) and keep it silent.
- Demo-only reduction of `zoneState.waitDur`.

No changes to real-player mechanics, difficulty, scoring, or UI outside demo mode.
