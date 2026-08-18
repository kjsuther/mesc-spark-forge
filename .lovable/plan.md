# Calendar zone: clear goal, and the rain stops when you survive it

The falling-calendar stage is the "Awaiting Decision / Waiting Mountain" zone (shown in game as STEP 6). This plan applies there — that is the only zone with calendar-date hazards.

Two things change:

## 1. Make the goal unmistakable

- Briefing screen copy becomes explicit: avoid the falling dates for 10 seconds, if a date hits you the 10 seconds start over, and once you make it the dates stop falling and the door opens.
- Add an in-zone signpost right at the zone entrance with the same short instruction, so a player who skipped past the briefing still sees it.
- Keep the existing big on-screen countdown, and show a brief on-screen message the moment a date hits you ("Hit! The 10 seconds start over") so the reset is understood rather than confusing.

## 2. Stop the calendars once the 10 seconds are survived

Today the pages keep raining for as long as you stand in the zone, even after you've been approved, so a player can still die after clearing the objective. After this change:

- The instant the 10-second timer completes, no new pages are scheduled.
- Any page still in the air is cleared immediately (small sparkle/fade), along with its ground shadow marker, so nothing already falling can kill you.
- The "APPROVED!" flash stays, followed by a short message: "Approved — the calendar stops. Head right to the door."
- The rest of the walk to the exit door is completely hazard-free.

If the player dies before finishing the 10 seconds and restarts the zone, the rain resumes normally until the timer is cleared again.

## Technical notes

- `src/components/game/game-scenes.ts`
  - Zone 5 (`mx0`) calendar block: add a `calDone` flag set from the same condition used by `zoneObjectives[5].met()` (`zoneState.waitStart > 0 && time - waitStart >= waitDur`). In each page's `onUpdate`, return early when `calDone`; on the transition to done, park all pages off-screen, destroy their telegraph markers, and emit a sparkle burst.
  - Add the entrance sign plaque via the existing `addSignPlaque` helper and the "start over" hint via the existing `showHint` path in the `boulder` collision handler (where `zoneState.waitStart` is already reset).
  - Update the STEP 6 entry in the step-screen definitions with the clarified lines.
- `src/lib/i18n.ts`: add Spanish strings for the new/changed lines.
- No changes to difficulty (drop rate, speed, column sweep) before the timer completes, and no changes to any other zone.
