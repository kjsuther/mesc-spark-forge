# Zone 1: clear the unchosen application blocks and guide the player right

## What's happening now

Confirmed by watching a live run of Zone 1: after the player smashes a brick and
collects an application method, the unchosen signposts (MAIL / PHONE / IN PERSON /
ONLINE labels) do disappear, but the three unchosen brick blocks stay standing on
screen — they only turn grey and stop reacting. The only "go right" guidance is a
one-line hint that fades after about 3 seconds, so players keep bumping the dead
blocks instead of heading for the door.

## The fix

1. Remove the unchosen blocks entirely. When a method is collected, the other
   three bricks pop with a short 16-bit sparkle/dust puff and are destroyed, along
   with their signposts and any loose icons. The chosen station keeps its
   signpost with the checkmark so the player can see what they picked.
2. Add persistent "keep going right" guidance. A blinking yellow arrow appears
   near the player, pointing right toward the door, with a small caption such as
   "Go right to the door". It pulses until the player exits the zone, then
   disappears. It sits behind the HUD so it never covers score or lives.
3. Keep the existing short hint message ("You picked X. Now walk right and go
   through the door.") so the confirmation still reads clearly on selection.
4. Spanish translations for the new arrow caption.

## Technical notes

- `lockApplyMethods` in `src/components/game/game-scenes.ts` currently swaps the
  unchosen bricks to `brick-hit` and disables them; change it to destroy them
  (after a brief particle burst) and clear any leftover `method` icons.
- Add a small "exit guide" object group created on selection: a blinking arrow +
  caption anchored above the ground, following the player at a fixed offset (or
  parked near the door), destroyed on zone transition and on scene restart.
- New strings added to `src/lib/i18n.ts`.
- Verify with a demo-mode run: after selection, only the chosen signpost remains,
  no grey blocks are left, and the blinking arrow is visible until the door.
