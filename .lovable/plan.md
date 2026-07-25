## Polish pass: "Blazing the Trail to Coverage"

All work is scoped to the game engine + canvas. No changes to voting, admin, leaderboard, or DB.

### 1. Fix player spawn / ground alignment (root-cause)

In `game-scenes.ts` the player is created with `k.anchor("bot")` at `y = GROUND_Y`, but `GROUND_Y = 470` is the *top of the soil rect*, while props (`spawnDecor` for signposts) use the same value via a helper that already accounts for its own baseline — the mismatch shows as the hero sitting a few pixels lower than the signs.

- Introduce `WORLD.groundTopY` (the pixel row where feet must sit) and use it uniformly for:
  - `addGround` (top edge of the grass strip)
  - `spawnGrounded` / `spawnDecor` default `groundY`
  - player spawn and every `player.pos = ...` respawn line
  - platform snap calculations and the water kill-plane offset
- Verify by asserting in dev-only that at rest `player.pos.y === WORLD.groundTopY` and the sign's `y + h === WORLD.groundTopY`.

### 2. Step 1 signage — four ways to apply

Replace the current cryptic signs (`?`, `??`, "River ahead") with four themed, evenly spaced signposts introducing application methods:

- 📬 Apply by Mail
- 📞 Apply by Phone
- 🏢 Apply In Person
- 💻 Apply Online

Implementation: extend `addSpeech` to accept an icon glyph rendered above the label, keep the wood-sign sprite, and color the callouts in the friendly cream/blue palette. Signs act as decorative teaching moments (no gameplay branching — the "path choice" is visual).

### 3. Step 2 environment — floating question bubbles

Add a new `spawnThoughtBubble(k, {x, y, text})` helper that renders a small pixel-art cloud (rounded rect + tail, drawn with `k.rect` + `k.circle`) at parallax layer `LAYERS.BG_NEAR`, gently bobbing via `onUpdate`. Populate Step 2 with 6–7 bubbles cycling through:

- "What documents do I need?"
- "Do I qualify?"
- "How long will this take?"
- "What income should I report?"
- "Who counts in my household?"
- "What if I'm missing information?"
- "Where do I upload documents?"

Bubbles sit high in the sky so they never overlap gameplay hitboxes.

### 4. Context-aware failure messages

Replace the single `reason` string with a `getFailureMessage(cause, zoneIndex)` lookup. Cause keys: `monster`, `boulder`, `water`, `timeout`, `noDocs`. Zone-specific copy:

- Step 1 (forest): "Pick a way to apply before moving forward." / "Every journey starts by choosing how you'll apply."
- Step 2 (river): "A missing answer is slowing your journey." / "Double-check your application before submitting."
- Step 3 (town): "Looks like some documents are still missing." / "Gather everything you need before continuing."
- Step 4 (mountain): "Your application is still under review." / "The agency needs a little more information."
- Step 5 (clinic): "One final step remains before coverage begins." / "Don't stop now — you're almost enrolled!"

Overlay title also changes per zone ("APPLICATION PAUSED" / "REVIEW IN PROGRESS" / etc.) instead of the blanket "APPLICATION BLOCKED".

### 5. Running animation

The current hero has 4 walk frames (`hero-walk-0..3`) advanced every ~10fps. Upgrade to a 6-frame cycle with SNES-style cadence:

- Add `hero-walk-4` and `hero-walk-5` by re-slicing the existing character sheet's walk row (frames already carry small pose variations; we'll duplicate + mirror-blend the two most distinct frames to synthesize the extra two through a canvas post-step in `loadTrimmedSheet`).
- Advance frames on distance travelled (`frame = floor(distancePx / 14) % 6`) rather than wallclock, so animation speed tracks actual movement and never "slides."
- Add a subtle 1px vertical bob on frames 1, 3, 5 via a `spriteOffsetY` field applied at draw time.
- Idle → walk transition uses a 100ms crossfade frame; jump keeps the single jump frame.

If the synthesized frames read poorly on QA screenshots, fall back to a smoother 4-frame loop with distance-based timing and the bob — the visible "slide" fix comes from distance-based frame advancement, not frame count.

### 6. General polish

- Title cards: raise contrast, add 1-frame screen flash on zone entry, delay player input for 200ms so the card reads.
- Speech bubbles: unify padding, drop shadow, and max-width. Reuse in signs + thought bubbles.
- Ground seams: assert integer coords in `addGround` and extend the last segment by +2px to hide sub-pixel gaps between biomes.
- Overlay: replace `font: "sans-serif"` with the loaded Press Start 2P where already available for HUD/end screens; keep sans for long paragraphs.
- Ranger helper: give a short greeting speech bubble on first proximity ("I'll walk you through this.").
- Camera: add a 6px vertical lookahead so the player isn't glued to the bottom third.

### Files touched

- `src/components/game/game-scenes.ts` — spawn/ground constant unification, new sign content, thought-bubble helper, failure-message map, distance-based animation, polish tweaks.
- `src/components/game/game-canvas.tsx` — none expected unless the overlay font swap needs a CSS class; small edit at most.

Nothing else (voting, leaderboard, admin, DB, routes) is modified.

### Verification

Headless Playwright walkthrough capturing `/tmp/browser/polish/*.png` at:
1. Spawn (feet flush with sign baseline)
2. Each of the 4 new Step 1 signs
3. Step 2 with visible thought bubbles
4. Deliberate death in each zone → screenshot the zone-specific failure message
5. Mid-run hero at 3 different X positions to confirm frame cadence changes with speed

Manual pass on desktop + mobile viewport (390×844).

### Intentionally out of scope

- New sprite art beyond re-slicing the existing sheet (no image generation this pass).
- Changing voting improvements list, DB schema, or scoring formula.
- New zones / new enemy types / new music.
