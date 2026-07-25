# Blazing the Trail — Intro Flow, Music, and Zone Overhaul

All work is scoped to the game module. Outside the game (site chrome, voting DB, admin panel) is untouched unless noted.

## 1. New pre-game flow (Title → Explainer → Trail Map → Game)

Files: `src/components/game/game-canvas.tsx` (state machine), new `src/components/game/intro-explainer.tsx`, new `src/components/game/trail-map.tsx`.

- Extend the launch state machine from `title → game` to `title → explainer → trailmap → game`. Keyboard (Enter/Space) and touch ("Continue") advance each step; each step is skippable with a small "Skip" affordance.
- **Explainer screen** (SNES-style, matches title): scrolling pixel-frame with copy roughly:
  > "The trail to health coverage is long. Without the right tools, many travelers give up before the end. Your goal: make it as far as you can. If you fail to complete the process, vote on the tool that would have helped you most from the options listed below the game screen — after the voting timer ends, the winning tool is added to the trail for everyone."  
  > Bottom prompt: blinking **▶ CONTINUE**. Reuses the same pixel border, gold accents, MN-blue palette, and "Press Start 2P" font as the title screen.
- **Trail map screen**: an animated 16-bit overworld map (think Super Mario World map). Static illustrated map background (generated via imagegen, 1280×720, SNES cartography style: rivers, mountains, forests, city). Eight numbered nodes (Zone 1–8) connected by dashed trail segments. Animation: dashes fill in sequentially (interpolated over ~2.5s) then the hero sprite hops between nodes to signal the full journey. "▶ CONTINUE" once the animation finishes (also tappable to skip). New asset: `src/assets/game/trail-map-bg.png`.

## 2. Background music with toggle

Files: `src/components/game/game-canvas.tsx`, new `src/components/game/audio-controller.ts`, new asset `src/assets/game/music-loop.mp3` (royalty-free chiptune ~20s, e.g. from Pixabay/OpenGameArt CC0 — will pick a specific track during build and cite source).

- HTML `<audio loop>` element mounted at canvas root, autoplays after the first user gesture (title's Start button counts, satisfying iOS autoplay policy).
- 🔊 / 🔇 toggle button in the top-left of the game HUD row (mirrors the ✕ and ⛶ buttons). Persist preference in `localStorage` (`btc:music`).
- Music plays across explainer, trail map, and gameplay. Paused on Exit.

## 3. Zone-by-zone changes (`src/components/game/game-scenes.ts`)

**Zone 1 — Learn how to apply**

- Convert the 4 method sign plaques into `?`-style **brick blocks** floating at jump height (mail / phone / in-person / online). Hitting a brick from below pops out a collectible icon (existing method icons repurposed / new `brick-block.png` sheet with idle + hit frames). Collecting the icon sets the chosen method and unlocks the door.
- Door starts **locked** with a visible padlock overlay until an icon is collected.
- Add **2 additional gaps** in the ground between the bricks and the door, positioned so no brick sits over a gap (player can always reach every brick without a risky jump; the gaps only affect traversal toward the door).

**Zone 2 — Create your account**

- Add **2 extra form-monster villains** on the left side of the river gap. Both patrol short overlapping ranges moving in opposite directions (one left→right, one right→left), so they cross and overlap visually.

**Zone 3 — River of Paperwork**

- Each floating platform gets a pixel label baked on top ("ABOUT YOU", "HOUSEHOLD", "INCOME", "SIGNATURE"). Rendered via `pixelHudText` with the same shadow/legibility treatment used elsewhere.

**Zone 5 — Respond to Requests for Info**

- Replace current villain sprite with a zone-appropriate one: an **"Envelope Gremlin"** (a hostile letter with legs). New asset `src/assets/game/envelope-gremlin-sheet.png` (imagegen, SNES 16-bit, 2–3 walk frames, transparent bg). Same collision/AI as the existing villain — pure art swap plus new sprite key.

**Zone 6 — Awaiting a Decision**

- Falling calendar pages: randomize spawn X across the full zone width and randomize spawn interval within a range each cycle, so no two runs have the same drop pattern.

**Zone 7 — Choose a Health Plan**

- Rename plan cards to **Blue Cross/Blue Shield**, **HealthPartners**, **Medica**. Regenerate `src/assets/game/plan-cards-sheet.png` with new labels and updated color coding, and refresh any background signage referencing plan names.
- After selecting a plan, spawn a **zone boss** ("Paperwork Ogre" themed to insurance bureaucracy — new asset `boss-sheet.png` with idle, hurt, and defeat frames). Boss has a 3-heart health bar rendered top-center. Player must jump-stomp the boss 3 times; each stomp plays hurt anim + brief i-frames + knockback, then boss respawns from a random side. After the 3rd stomp, boss plays defeat anim and vanishes, and the door unlocks. Gold key path from before is replaced by this boss gate.

**Zone 8 — Coverage Begins**

- Widen platform spacing so several jumps require max jump distance. Introduce 2–3 actual bottomless gaps between platforms; falling into one costs a life (respawn at zone start via existing `loseLife`).

## 4. Asset generation plan (imagegen)

New PNGs to generate before wiring:

- `trail-map-bg.png` (1280×720, SNES overworld map)
- `brick-block.png` (32×32, idle + hit, transparent)
- `envelope-gremlin-sheet.png` (walk frames, transparent)
- `plan-cards-sheet.png` (regen with new insurer names)
- `boss-sheet.png` (idle / hurt / defeat frames, transparent)
- Padlock icon overlay for locked doors (`door-lock.png`)

Music: one royalty-free CC0 chiptune loop (~20s) sourced from Pixabay/OpenGameArt, saved as `music-loop.mp3`. Source URL logged in commit notes.

## 5. Out of scope

- No changes to Supabase schema, voting logic, admin panel, leaderboard, site chrome, or router.
- No changes to zones not listed (Zone 4 unchanged).
- Physics constants (speed, jump height, coyote/buffer) unchanged unless a Zone 8 gap requires a tiny tuning pass.

## 6. Verification

- Playwright desktop (1280×800) and mobile landscape (852×402): full run through Title → Explainer → Trail Map → Zone 1..8 → Win.
- Confirm: music toggle persists, bricks pop icons, door stays locked without an icon, Zone 2 has 4 villains total with overlap, Zone 3 platform labels legible, Zone 5 uses new gremlin, Zone 6 calendar spawns vary run-to-run, Zone 7 boss takes exactly 3 hits, Zone 8 has at least one lethal gap.