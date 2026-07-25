# Game polish pass — Zones 3 & 8, boss, background labels, music

All changes live in `src/components/game/game-scenes.ts` and `src/lib/game-music.ts`. No schema, routing, or non-game code touched.

## 1. Zone 3 — readable thought bubbles + platform labels

`spawnThoughtBubble` and the "About You / Household / Income / Signature" platform labels currently use `k.text(..., { size: 9-10, font: "sans-serif" })` with no pixel-font styling, so at the game's logical resolution they render as blurry sub-pixel text (image 1).

- Rewrite `spawnThoughtBubble` to use the "Press Start 2P" pixel font at size 8, with a 1-px black drop shadow (same technique as `pixelHudText`), a larger opaque white bubble sized to the actual text width, and a heavier navy outline. Keep the bob animation.
- Redraw the four river platform labels using the same pixel-font + shadow pair, size 8, kerned to fit on the 96-px platform. Increase platform width to 104 px if a label overflows (e.g. "SIGNATURE").

## 2. All zones — high-contrast pixel labels for background item text

Image 2 highlights "Blue Cross / Blue Shield", "HealthPartners", "Medica", "Pick ONE plan" as unreadable. Zone 1 signs are the good baseline (pixel font + dark plaque + gold text).

- Add a helper `pixelWorldLabel(k, x, y, text, opts)` in `game-scenes.ts` that draws: a dark rounded plaque (rgba 20/25/45, 85% opacity) sized to text, a 1-px black shadow layer, and a bright foreground (default gold `255,220,90`) in `"Press Start 2P"` at size 8. Anchored center, z = `LAYERS.PROP + 3`.
- Replace every `addSpeech(...)` / raw `k.text(...)` decorative label used to name a world item with `pixelWorldLabel`. Audit list:
  - Zone 1: brick method labels ("MAIL", "PHONE", "IN-PERSON", "ONLINE") if any use `addSpeech`.
  - Zone 3: doc labels ("ID", "Income", "Household") over each doc prop.
  - Zone 4: envelope-gremlin / mailbox hint text.
  - Zone 5: paper-airplane / RFI hint text.
  - Zone 6: calendar countdown caption near the top-center (keep HUD countdown separate but restyle its plaque).
  - Zone 7: plan card names + "Pick ONE plan" prompt + boss "STOMP 3×" hint.
  - Zone 8: "MEDICAL ID", "GRAB THE ID →", "★ COVERED! ★".
- Keep gameplay-critical HUD (`pixelHudText`) as-is — this only replaces in-world decorative captions.

## 3. Zone 8 — restore the fire pole (root cause: placed past level end)

`LEVEL_END = 8 * BIOME_W = 9600`. `topLandingX = cx0 + 260 + 6*140 + 20 = 9520`, so `poleX = topLandingX + 190 = 9710` — beyond `LEVEL_END`. The camera clamp `Math.min(player.pos.x, LEVEL_END - LOGICAL_W/2)` never scrolls past 9600, so the pole, its cap, and its trigger volumes all sit off-screen right — the player can never touch them and the finale never fires (image 3).

Fix:
- Move the whole finale left so it fits inside `LEVEL_END`. Concretely: reduce `STEP_GAP_X` from 140 to 110 for Zone 7's staircase (still requires a committed jump) and shorten the top-landing-to-pole offset from 190 to 120. That places `poleX ≈ cx0 + 260 + 6*110 + 20 + 40 (landing center offset) + 120 ≈ 9160`, well inside the 9600 bound with ~250 px of scroll headroom to see the slide.
- Verify the medical office building sprite / "COVERED" sign at `LEVEL_END - 100` still lines up; nudge if needed.
- Extend the Zone 7 ground so the pole base sits on solid floor (currently it just clears the lethal gap; recompute `Z7_GAP1` from the new `STEP_GAP_X`).
- Add an assertion-style dev log `console.warn` if `poleX > LEVEL_END - 40` so a future regression is loud.

## 4. Boss stomp — reliable head-hits, still lethal on contact

Current check requires `player.vel.y > 40` AND `player.pos.y < boss.pos.y - bh*0.4`. With both actors grounded at the same `GROUND_Y`, the player has to still be ~38 px above ground at collision instant — a very narrow window.

- Rewrite the collision check to be geometry-based, not velocity+position based:
  - Compute `playerFoot = player.pos.y + PLAYER_FOOT_PAD` (or the equivalent for the current anchor) and `bossTop = boss.pos.y - bh` (accounting for anchor).
  - Stomp iff `playerFoot <= bossTop + bh * 0.35` AND `player.vel.y >= 0` (i.e. not rising) at contact.
- Add a tiny grace: if the player's previous-frame foot was above `bossTop`, treat it as a stomp regardless of current vel (fixes fast-fall clipping past the top pixel).
- Otherwise (side/underside contact): `loseLife("monster")` with i-frames — unchanged behavior, just guaranteed to trigger.
- Keep the 3-hit requirement, hearts HUD, bounce, and key drop as-is.

## 5. Music — upbeat, adventurous royalty-free chiptune

`src/lib/game-music.ts` is procedural (no external files, always royalty-free). Rewrite the `MELODY` and `BASS` arrays to a faster, more adventurous progression:

- Tempo up: `bpm = 152` (from 132).
- New melody: an 8-bar D-major "quest" theme with dotted rhythms, arpeggiated runs, and a resolving cadence — square lead, triangle bass, plus a light noise-hat blip on the off-beat for drive.
- New bass: I–V–vi–IV walking pattern in D (D–A–Bm–G), one bar each, looping twice per melody cycle.
- Add a subtle percussion channel: a short white-noise burst (100 ms, exponential decay) every half beat via a `BufferSource` with a filtered noise buffer. Volume kept low (0.05) so it reads as a hi-hat, not a crash.
- No external asset — remains 100% generated at runtime, so licensing stays clean.

## 6. Verification

Playwright pass at desktop (1280×800) and mobile landscape (852×402):

- Zone 3: screenshot the river; confirm every bubble and every platform label is legible at 1×.
- Zones 1–8: screenshot each with world labels visible; confirm plaques are readable and don't clip sprites.
- Zone 7 (boss): scripted run — jump onto boss from directly above 3× → hearts decrement, key drops. Walk into boss side-on → loses a life. Confirm 3-hit KO reliably.
- Zone 8: play through to Medical ID → confirm pole is on-screen when standing on top landing, cutscene triggers, slide plays, WIN screen appears.
- Audio: toggle music, confirm new loop plays and loops cleanly at ~10 s cadence.

## Out of scope

- No changes to voting DB, admin panel, router, site chrome, or physics constants outside the boss check.
- No new imagegen assets — labels and music are code-only.
