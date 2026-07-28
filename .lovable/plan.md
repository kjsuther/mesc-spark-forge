## Polish pass: alignment, clutter, Zone 6, music, mobile UAT

All gameplay changes land in **both** engines — `src/components/game/game-scenes.ts` (current) and `src/components/game/original/game-scenes.ts` (frozen "before" build) — so the two versions stay comparable. No mechanics, art, levels, or progression are removed.

### 1. Sprite depth / collision alignment (audit first)

The engine already places grounded actors with `spawnGrounded(...)` → `anchor("bot")` at the shared `GROUND_Y = 470`, so the misalignment in the video is not a single obvious constant; it needs measuring before fixing. Step one is instrumentation, not a guess:

- Add a temporary debug overlay (`area` outlines + a ground guideline) and walk each zone in the browser at desktop and mobile sizes, capturing the player's feet Y against every enemy, hazard, collectible, projectile, and moving obstacle.
- Record where the drawn sprite bottom differs from `GROUND_Y`, and where the `hitboxScale` rect is taller/shorter/wider than the visible pixels.

Then fix what the audit finds, expected to be some mix of:
- Sprites whose trimmed bounding box still carries transparent padding, so they render floating or sunk — corrected in the trim/`DISPLAY_H` table rather than by nudging positions.
- Hitboxes drawn from `DISPLAY_H` rather than the actual rendered width/height, which makes the hurt box overshoot the art.
- Airborne hazards (paper airplanes, falling calendars, boss projectiles) sitting at heights that read as "background" — raised or lowered so anything at player height is unmistakably dangerous and anything decorative sits clearly above/behind.
- Any actor drawn on a different z-layer than the plane it collides on.

Deliverable: for every interactive object, drawn silhouette and collision box match, ground actors' feet touch the same grass line as the hero, and the debug overlay is removed before finishing.

### 2. Remove instructional text painted into the levels

The pre-zone pause screens now carry all of this. Removing the redundant in-world speech plaques (`addSpeech` calls) in both engines:

- "Smash a brick and collect application", "Create an account", "Collect Username and Password and avoid account locks", "Use platforms to get to other side", "Gather 3 docs and avoid evil clipboards", "Collect all notice mailboxes and avoid confusing letters", "Avoid falling dates", "Pick your plan and defeat the boss", "Climb stairs and collect your medical card".

Keeping: item labels that identify a pickup (`USERNAME`, `PASSWORD`, plan pedestal names, `MEDICAL ID`, `GRAB THE ID →`), flavour text ("Awaiting a decision…", "Pick ONE plan", "★ COVERED! ★"), signposts, decorations, and all background art.

### 3. Zone 6 rebalance ("Awaiting Decision")

Objective stays "survive 10 seconds". Tuning only:
- Fewer falling calendar pages in flight at once, with a longer minimum interval between drops.
- Spawn X chosen from a shuffled bag with a minimum separation, so drops never stack into an unavoidable wall and repeats feel random rather than clustered.
- Guarantee a safe lane: no spawn within a set radius of the player's current column on consecutive drops.
- Modest fall-speed reduction and a slightly longer telegraph before each page starts falling.
- Verify by playing the zone repeatedly and confirming a clean run is reliably achievable.

### 4. Music variety

Extend the existing procedural chiptune engine in `src/lib/game-music.ts`:
- Add several new upbeat 16-bit themes alongside `adventure` (trail, town, forest/office, waiting-tension variant), each with its own melody, bass, harmony, tempo, and percussion style.
- Rotate themes by zone, with the starting theme picked at random from the exploration set so repeat runs differ.
- Add a short gain crossfade on theme change instead of a hard restart, and light per-loop variation (alternate turnaround bar / harmony voice) so the loop point is less obvious.
- `boss` and `victory` themes keep their current roles.

### 5. Mobile UAT and regression pass

Playwright run at common mobile sizes (390×844, 414×896, 360×800) plus desktop, covering: title → story → tutorial → each zone step screen → all 8 zones → boss → win → thanks → replay, plus death/restart, fullscreen, score entry, leaderboard, feedback form, admin feedback board, and Poster View.

Checks: no overlapping or invisible buttons, D-pad never covers gameplay, text does not clip, pause panels fit, safe-area insets respected, touch continue works on every paused screen, no soft locks, and no console errors. Defects found get fixed and re-verified in the same pass.

### Technical notes

- Touched files: `src/components/game/game-scenes.ts`, `src/components/game/original/game-scenes.ts`, `src/lib/game-music.ts`, and `src/components/game/game-canvas.tsx` only if the mobile UAT surfaces layout defects.
- No database changes, no changes to the feedback backlog system, leaderboard queries, or feature/achievement logic.
