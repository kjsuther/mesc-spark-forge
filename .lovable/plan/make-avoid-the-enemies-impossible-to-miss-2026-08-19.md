# Make "avoid the enemies" impossible to miss

Players are walking straight into the locks, clipboards and envelopes because nothing tells them contact costs a life. The fix is consistent, repeated messaging: on the how-to-play screen, on every zone briefing that has an enemy, on the enemy icons themselves, and once in-game at the first enemy encounter.

## 1. How to Play (controls) screen

Add a highlighted warning line under the control list, in all three control variants (keyboard, touch, joystick):

"Touching an enemy costs a life — JUMP over them!"

Styled as a call-out (gold border/red text) rather than another body line, so it reads as a rule and not flavor text.

## 2. Zone briefings

Rewrite the enemy lines so the consequence is stated, not implied:

- Step 2: "Account Locks hurt — jump over them or you lose a life."
- Step 4: "Evil Clipboards hurt — jump over them or you lose a life."
- Step 5: "Monster Envelopes hurt — jump over them or you lose a life."
- Step 6: keep the 10-second rule, and state falling dates cost your progress on contact.
- Step 7: keep as is (boss briefing intentionally hides the bear).

Also add a shared bottom line to every briefing that contains an enemy: "Never touch a red-marked enemy."

## 3. Enemy icons on the briefing

Enemy icons in the briefing icon row get an "AVOID" tag with a red/danger tint, so the visual separates collectibles (collect) from enemies (avoid) at a glance.

## 4. First encounter coaching

In the warm-up zone, add a harmless practice enemy that walks a short patrol with a floating "PRACTICE: JUMP OVER ME" sign, so the first enemy a player meets is one that cannot kill them and the jump-over behavior is learned before Zone 2.

In Zone 2, add a small blinking "JUMP!" caption above the first real enemy that disappears once the player clears it.

## 5. Spanish

Every new or reworded string gets its Spanish translation added to the phrase dictionary so the Spanish mode stays complete.

## Technical notes

- `src/components/game/game-canvas.tsx` — controls screen warning call-out.
- `src/components/game/game-scenes.ts` — `STEP_SCREENS` copy, danger tag on enemy icons, warm-up practice enemy + sign, Zone 2 first-enemy caption.
- `src/lib/i18n.ts` — new Spanish strings.

No difficulty, scoring, layout or website changes.
