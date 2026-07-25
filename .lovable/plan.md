## Goal

Restructure every zone around a **door-based progression gate**: each zone ends at a locked door that only opens once the player has satisfied that zone's Medicaid-themed objective. Add a shared door-unlock animation, generate the new imagery required, and rework Zones 5–8 with brand new mechanics.

## New art to generate (into `src/assets/game/`)

Use `imagegen` (SNES 16-bit, matching existing palette/scale):

1. `door-sheet.png` — 4-frame horizontal sprite sheet: closed → unlocking (key inserted, glow) → half-open → fully open (portal glow). Shared across all zones, tinted per-zone at runtime.
2. `credentials-sheet.png` — two collectibles: a floating **Username** card (ID badge) and a **Password** token (key with asterisks).
3. `plan-cards-sheet.png` — 3 selectable plan cards: **Medical Assistance** (blue), **MinnesotaCare** (green), **Private Plan** (orange). Existing `props-sheet-2` cards are decorative; these are UI-sized pickable cards with clear labels.
4. `key-sheet.png` — 2-frame shiny golden key (post-plan-selection reward).
5. `flagpole-sheet.png` — Zone 8 fire pole + platform steps + medical ID card at top + flag base.
6. `fireworks-sheet.png` — 6-frame fireworks burst (looped/staggered for the finale).
7. `hud-timer.png` — small clock icon for Zone 6 countdown badge (optional; can also be pure text).

## Zone-by-zone changes (`src/components/game/game-scenes.ts`)

Add a shared `spawnDoor(x, zoneIndex, opts)` helper that:
- spawns a closed door sprite at the zone's end
- exposes `door.unlock()` which plays the 4-frame unlock animation, plays a chime, then sets `door.isOpen = true`
- on player overlap when `isOpen`, transitions to the next zone (replaces current "reach x position" progression)
- when locked and touched, shows a floating hint ("Find username & password to unlock", etc.)

Per zone:

- **Zone 1 — Finding the Trail:** player must jump and touch any one application-method plaque (Mail / Phone / In-Person / Office). On first touch, door at zone end unlocks. Existing small teaching gap stays.
- **Zone 2 — Setting Up Camp (Create account):** spawn a floating **Username** card and a **Password** token as required collectibles. HUD shows `USER ☐  PASS ☐`. When both collected, door unlocks.
- **Zone 3 — Crossing River of Paperwork:** no mechanic change. Add door at end; touching it triggers unlock animation, then transitions.
- **Zone 4 — Gathering Supplies (Gather Documents):** require **3 verification pickups** (reuse doc collectible) while avoiding paperwork form-monster. Door stays locked until `docsCollectedInZone >= 3`; HUD shows `DOCS 0/3`.
- **Zone 5 — Answering the Call:** fix background — currently leaves whitespace at the right edge. Make `bg-relay` tile/repeat across the zone's full pixel length (same tiling helper other zones use, or `repeat: true` on the bg sprite). Require **all mailboxes collected** and no hit taken from obstacles to unlock the door; HUD shows `REPLIES x/N`.
- **Zone 6 — Waiting Mountain:** add a 30-second countdown timer badge in the HUD. During the wait, existing falling boulders continue. Door is visibly locked with a padlock overlay; at t=0 the padlock breaks, unlock animation plays, and a floating "Decision approved — door open!" banner appears. Player must still walk to the door to advance.
- **Zone 7 — Choosing Your Path:** spawn **3 plan card pedestals** (Medical Assistance / MinnesotaCare / Private Plan). Player jumps onto/into one to select. Selection spawns a golden **key** that auto-attaches to the player and marks the door as unlockable; touching the door plays unlock animation and advances.
- **Zone 8 — Coverage Begins:** replace flat run with a **staircase of platforms** rising to a **medical ID card** at the top. Touching the card attaches player to a **fire pole**; player slides down (locked horizontal, controlled vertical descent). On reaching the pole base, trigger `fireworks-sheet` bursts across the background on a loop and show the existing "★ ENROLLED IN COVERAGE ★" win overlay.

## Shared systems

- **Door unlock animation:** 4-frame sprite advanced on a 90ms timer, with a brief camera shake + chime SFX (reuse existing collect chime, pitched up).
- **HUD:** extend existing HUD renderer with per-zone objective row (e.g. `USER ✓ PASS ☐`, `DOCS 2/3`, `REPLIES 3/4`, `WAIT 0:23`, `PLAN ☐`, `KEY ✓`). Reuse pixel font.
- **Zone transitions:** replace the current "cross x position ⇒ next zone" trigger with "overlap open door ⇒ next zone". Locked door blocks passage with a soft push-back + hint bubble.
- **Progression state:** add `zoneObjectiveState` object reset on every zone enter; drives both HUD and door-unlock check each frame.

## Files touched

- `src/components/game/game-scenes.ts` — door system, per-zone objective logic, HUD extension, Zone 5 bg tiling fix, Zone 6 timer, Zone 7 plan-select, Zone 8 stairs + fire pole + fireworks.
- `src/components/game/game-canvas.tsx` — no structural change; may add a small overlay for Zone 6 countdown if easier than in-canvas HUD.
- `src/assets/game/*` — new sprite sheets listed above (+ `.asset.json` pointers via `lovable-assets`).
- Register new sheets in `loadAllSprites` using the existing `loadTrimmedSheet` pipeline so anchors stay pixel-truthful.

## QA

After build, run a Playwright pass (desktop + mobile viewport) that plays through all 8 zones, screenshots each door unlock, verifies Zone 5 has no background whitespace, Zone 6 timer counts to 0 and unlocks, Zone 7 grants a key on plan selection, and Zone 8 fireworks trigger at pole base.
