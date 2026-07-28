## Goal

Use one consistent name + subtext for each of the 5 upgrades everywhere (game HUD, in-canvas vote panel, page vote panel, admin, poster), and show the subtext in the in-game vote overlay, which currently shows only the name.

## New copy

| key | Name | Subtext |
|---|---|---|
| extra_lives | Self-Service Portal | Start game with 5 tries instead of 3. |
| resume_checkpoint | Case Status Checker | If you're hit, restart right where you left off. |
| chat_invincible | Live Chat Bot | Pick up the Chat power-up and become invincible to all enemies. |
| navigator_helper | Navigator Locator | Pick up the Navigator power-up to have Navigator appear to assist. |
| email_umbrella | Email Communication | Pick up the Email power-up for an umbrella to protect you. |

## Changes

1. Database: update `label` and `description` on the 5 rows in `game_improvements` (this feeds the public vote panel, admin game page, poster view, and round candidates).
2. `src/lib/game-features.ts`: update `FEATURE_META` `adminLabel` and `description` to the exact same strings; shorten HUD labels to match the new names (Portal, Status Check, Chat Bot, Navigator, Email).
3. `src/components/game/vote-overlay.tsx`: render each option's description as a second line under the name (small pixel text, high contrast), keeping arrow/enter + tap behavior and the vote count.
4. Spot-check the in-game HUD "active upgrades" panel text and any other place labels are hardcoded, so nothing shows the old names.

No schema or voting-logic changes; vote counts and rounds are unaffected.
