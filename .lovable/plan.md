# Readability, background clarity, mobile spawn, and leaderboard split

## 1. Text readability everywhere

Every piece of in-game and on-page text gets a single, shared typography system instead of the current mix of hardcoded sizes.

- Introduce one text helper in the game that all text goes through: chooses size from the canvas's real on-screen pixel size (not the logical 960-wide box), enforces a readable minimum, and always draws crisp at device pixel ratio.
- Instructional/body text (step screens, help plaques, tutorials, dialogs, pause card, confirmations, errors, mobile control labels) uses the clean modern sans already loaded on the site. Decorative headers (title, zone names, WIN / GAME OVER) keep the retro display look.
- Every text block gets an opaque high-contrast backing plate (navy plate + gold rule, as already used for plaques) so nothing sits directly on busy artwork.
- HUD (score, timer, lives, docs counter, zone name) gets the same treatment: larger, outlined, with a subtle dark backing so it reads on bright skies — as seen in the Zone 4 screenshot where the docs counter disappears into the clouds.
- No stretched or upscaled bitmap text anywhere; sizes are chosen, never scaled up after render.

### Responsive rules
Text sizing is driven by breakpoints on rendered canvas width, tuned and checked at: desktop windowed, desktop fullscreen, tablet portrait/landscape, phone portrait/landscape, and phone fullscreen. Long strings get explicit wrap widths and auto-shrink so nothing clips, overlaps, or breaks mid-word.

## 2. Zone background clean-up

All eight zone backdrops (`bg-forest`, `bg-signup`, `bg-river`, `bg-town`, `bg-relay`, `bg-mountain`, `bg-market`, `bg-clinic`) get a fidelity pass only: sharper edges, less grain, fewer compression artifacts, slightly stronger contrast and colour definition. Same composition, same objects, same palette, same file paths and dimensions — no redesign. The two attached screenshots are the quality reference.

## 3. Mobile hero spawn

On touch devices only, the hero starts farther right so the on-screen D-pad and buttons never cover him at the start of a run — roughly a phone-inch and a half, expressed as a proportion of the visible viewport width so it holds on small and large phones alike. Applies to run start and to checkpoint respawns at the left edge of a zone. Desktop spawn is untouched. Camera framing adjusts so the hero is fully visible above the controls immediately.

## 4. High scores: two views

- **Poster view and in-game leaderboard:** top 3 only, with medal, name, and score. Clean and legible from across a room.
- **High Scores page (`/scores`):** shows every score ever submitted, newest data included, sorted highest first, with rank numbers. Adds a name search box and paged / lazy-loaded listing so a long list stays fast. Existing rows are untouched — nothing is discarded, and the current validation and anti-cheat checks stay exactly as they are.
- **"View all scores"** link appears under the top-3 leaderboard everywhere it's shown (in-game end screen and the scores page header), opening the full list.
- Every finisher can enter a name, not just qualifying scores — this already works and stays.
- Both leaderboards get responsive layout: no horizontal scroll, names truncate rather than collide with scores, compact stacked rows on narrow phones.

## Technical notes

- New shared module `src/components/game/ui-text.ts` exporting a scale resolver and a `uiText()` factory; `game-scenes.ts` and `original/game-scenes.ts` route all `k.text(...)` calls through it.
- Canvas is rendered at devicePixelRatio with crisp letterboxing so glyphs are never resampled.
- Spawn offset added in `game-scenes.ts` as a `touchSpawnOffset` derived from viewport width, passed in from `game-canvas.tsx` which already knows the input mode.
- `leaderboard.tsx` gains a `limit` prop (3 for `poster`/in-game) plus a new `variant="full"` with search + pagination used by `src/routes/scores.tsx`; the query keys stay separate so poster polling is unchanged.
- Background images are replaced in place under `src/assets/game/`; no code changes needed since both builds share the paths.
- No database, schema, scoring, or gameplay-mechanic changes.
