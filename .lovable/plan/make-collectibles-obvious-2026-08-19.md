# Make Collectibles Obvious

Goal: at a glance, a player should know which objects on screen they are supposed to pick up — and which ones they are not.

## What players will see

One consistent "collect me" treatment applied to every required pickup:

- A soft pulsing glow ring behind the item plus a few twinkling sparkles.
- A gentle floating bob so the item visibly stands apart from static scenery.
- A small blinking green chevron arrow above the item pointing down at it.
- A short green label under the arrow (e.g. GRAB, COLLECT) so intent is unmistakable.
- A quick sparkle pop and score pop on pickup so the reward reads clearly.

Hazards keep their existing red AVOID styling, so green = take it, red = dodge it. The Controls screen gets a one-line legend: green glow means collect, red means avoid.

## Where it applies

- Zone 1: the application-method choices from the brick.
- Zone 2: username and password credentials.
- Zone 4: the three verification documents.
- Zone 5: the mailbox replies.
- Zone 7: the plan cards on the elevated platforms, and the gold key.
- Zone 8: the medical ID card.
- 1-UP hearts and bonus-stage pickups wherever they appear.
- Warm-up zone: one practice collectible with the same styling so the visual language is taught before it matters.

## Technical notes

- Add a `markCollectible(k, obj, { label })` helper in `src/components/game/game-scenes.ts` that attaches the glow ring, sparkles, bob, chevron, and label as child objects on the `BG_NEAR`/`EFFECT` layers, and cleans them up when the item is destroyed.
- Call it at each existing spawn site (doc, credential, reply, plan-pick, gold-key, id card, oneup) rather than duplicating decoration code.
- Label strings go through `tr()` and get Spanish entries in `src/lib/i18n.ts`.
- Reduce chevron/sparkle counts on touch devices via the existing device profile so mobile performance is unchanged.
- No gameplay, hitbox, scoring, or difficulty changes — visual and text only.
