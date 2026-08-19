# Make "No Stomping" Rule Obvious

Players still try to squash enemies Mario-style. Every coaching surface should say the same thing: landing on an enemy costs a life — jump *over*, never *on*.

## Changes

1. **Controls screen warning box** (currently "Touching an enemy costs a life — JUMP over them!")
   - Rewrite to two lines: "You CANNOT stomp enemies." / "Landing on one costs a life — jump OVER them, not on them."

2. **Warm-Up zone practice enemy**
   - Sign plaque text becomes: "You can't squash me — jump OVER, not on me!"
   - Contact banner becomes: "No stomping! That would have cost a life — jump over enemies."
   - Add a head-contact case: if the hero lands on top of the practice enemy, show "Jumping ON an enemy still hurts — clear it with a full jump."
   - Success banner stays, tightened to "Perfect — over the top, never on top."

3. **Zone 2 first-enemy floating caption**
   - Change "JUMP OVER ME!" to "JUMP OVER — NO STOMPING!".

4. **Hazard briefing captions**
   - Enemy lines ("Account Locks hurt — jump over them or you lose a life.", Evil Clipboards, Monster Envelopes) become "... — jump OVER them; stomping does not work."

5. **Spanish strings**
   - Add matching translations for every new/changed phrase in `src/lib/i18n.ts` so the Spanish run reads identically.

## Technical notes

- Copy lives in `src/components/game/game-canvas.tsx` (Controls screen) and `src/components/game/game-scenes.ts` (warm-up sign/banners, Zone 2 caption, hazard briefing captions).
- Head-contact detection in warm-up reuses the existing overlap check plus a downward-velocity/height test; the practice enemy stays harmless — it only shows the banner.
- No gameplay balance, difficulty, or collision-damage behavior changes.
