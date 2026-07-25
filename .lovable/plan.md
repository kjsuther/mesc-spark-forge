# Polish pass — walk cycle, pole slide, label legibility

## 1. Left-facing walk animation

Today the hero uses a single right-facing sheet and `player.flipX = dir < 0` for leftward motion. That works mechanically but the frames were drawn with directional lighting/hair-fringe, so mirroring reads oddly.

- Generate a dedicated left-facing sheet `hero-walk-left-sheet.png` (4 frames + idle) via `imagegen`, matching the current sprite's palette, silhouette, and 66-px display height.
- Load it through `safeLoadSheet` alongside the existing sheet, registering `hero-idle-left`, `hero-walk-left-0..3`.
- In `setSprite` / `setAnim`, pick the sheet based on `player.facing` and drop `flipX` for the hero (keeps art authored, no mirror artifacts). Enemies keep their existing flipX behavior.

## 2. Slow the walk cycle

Legs currently advance every 9 px (`STRIDE_PX = 9`), which reads as a sprint at current `MOVE_SPEED`.

- Raise `STRIDE_PX` to ~18 (roughly half speed) so a full 4-frame cycle spans a longer real distance.
- Keep it distance-based (not timer-based) so the animation still tracks true velocity — no floaty legs.

## 3. Fire-pole slide animation

Right now attaching to the pole just freezes X and drops Y with the idle sprite still on screen.

- Generate `hero-slide-sheet.png` (2 frames: arms overhead gripping pole, alternating leg positions) via `imagegen`, same 66-px height.
- Load via `safeLoadSheet` as `hero-slide-0`, `hero-slide-1`.
- Extend the anim state machine with a `"slide"` state. When `zoneState.firePoleAttached` is true, force `setAnim("slide")` and alternate frames every ~120 ms.
- Add a small downward motion-blur / spark particle at the player's feet during the slide for readability.
- On `pole-base` (or the y-safety-net), swap back to `hero-idle` before the fireworks trigger so the win pose isn't the slide frame.

## 4. Legible pixel labels everywhere

`addSignPlaque`, `addSpeech`, thought bubbles, HUD, and hint text all render with kaplay's default `sans-serif` and no dark stroke. Against bright biomes (mountain snow, river, market) they wash out.

- Add a shared `pixelLabel(k, text, opts)` helper that:
  - Uses `size: 12` minimum (bump 10/11 callsites to 12).
  - Emits a 1-px black text-outline by rendering the same string 4× at ±1 offsets in black behind the fg draw (Kaplay text doesn't ship outlines).
  - Uses high-contrast fg colors (`rgb(255,255,255)` for dark plaques, `rgb(20,20,20)` for cream plaques) chosen from the plaque bg.
- Retrofit `addSignPlaque` (badge + label), `addSpeech`, `spawnThoughtBubble`, the HUD `SCORE/OBJECTIVE/HINT` texts, and title-card `k.text` calls to use it.
- Bump plaque background opacity/outline width from 2→3 px so text has a guaranteed backdrop across every biome.

## Technical notes

- Files touched: `src/components/game/game-scenes.ts` only for logic + label helper wiring. New assets: `src/assets/game/hero-walk-left-sheet.png.asset.json`, `src/assets/game/hero-slide-sheet.png.asset.json`.
- No schema / route / server changes.
- Verify with Playwright at 1280×1800 desktop and 844×390 mobile-landscape: walk left in Zone 1, slide the pole in Zone 8, and screenshot Zone 1 signs + Zone 5 mailbox hints for label contrast.
