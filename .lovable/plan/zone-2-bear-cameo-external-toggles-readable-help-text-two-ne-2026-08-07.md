# Zone 2 bear cameo, external toggles, readable help text, two new backdrops

## 1. Searching bear in Zone 2

Add a background-only bear — the same brown bear with the red scarf that becomes the Zone 7 boss — pacing near the campground in Zone 2 (Setting Up Camp). New 16-bit sprite sheet with enough frames to read as "searching": two walk frames each direction, a stop-and-look-left frame, a stop-and-look-right frame, and a sniff/peer-forward frame.

Behavior: he walks a short patrol behind the play plane at reduced scale and dimmed/atmospheric tint so he reads as distant background, pauses every few seconds to look around, then resumes. Purely decorative — no collision, no damage, no interaction. Zone 2 only.

## 2. Sound and fullscreen toggles moved out of the canvas

In windowed (non-fullscreen) play the mute button and the "Full" button currently float on top of the canvas near the top-right corner. Move both into a small control row rendered **below** the canvas, right-aligned under the lower-right corner, with clear spacing so they never overlap each other and never cover gameplay. Labels stay compact ("Sound on/off", "Full screen").

In fullscreen there is no outside-the-canvas space, so the buttons stay as overlay buttons there, kept in the top-right safe area away from the HUD.

## 3. Help/step screen readability at windowed size

Right now the briefing panel sizes its type off the logical 960-wide game box, so when the canvas is displayed smaller than that (windowed desktop, small laptop, phone) all the text shrinks below comfortable reading size. Fix by sizing the panel type off the canvas's actual on-screen pixel size, with a minimum readable floor, so the briefing text stays the same physical size whether or not the player is fullscreen. Applies to the step/briefing screens, the pause card, and the in-zone help plaques. Then re-check every zone briefing at windowed size and confirm no line overflows the panel and no caption wraps mid-word.

## 4 & 5. Portland skyline in Zone 4 and Zone 7 backdrops (approval required)

- **Zone 4 (Gathering Supplies, town backdrop):** blend a small, far-off Portland skyline into the distant horizon with a yellow pennant flag atop the hospital tower, kept muted and hazy so it stays background.
- **Zone 7 (Choosing Your Path, market backdrop):** same treatment — Portland skyline in the distance plus the yellow flag on the hospital — matched to that zone's palette.

Both images match the Zone 8 clinic treatment already in the game, keep their exact current dimensions and file paths, and will be shown to you as mockups for approval before anything is swapped in.

## Technical notes

- New asset `src/assets/game/bear-scout-sheet.png` registered in the sprite loader and drawn from `src/components/game/game-scenes.ts` as a Zone 2 background actor.
- Toggle relocation is in `src/components/game/game-canvas.tsx` only (windowed branch of the music and fullscreen buttons).
- Text scale fix: derive the step-screen scale factor `S` from the canvas element's rendered CSS width rather than `k.width() / LOGICAL_W`, with a minimum font floor.
- Backgrounds replaced in place: `src/assets/game/bg-town.png`, `src/assets/game/bg-market.png` — no code change, both game builds inherit them.
- Readability and the Zone 4 / Zone 7 backdrops also land in `src/components/game/original/game-scenes.ts` (shared assets); the Zone 2 bear stays in the current version only, so the Original Version remains the frozen baseline.
