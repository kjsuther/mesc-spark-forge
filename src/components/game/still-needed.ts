// ============================================================================
// "Still needed" checklist shown on the failure screen.
//
// Pure and engine-free on purpose: the scene passes a plain snapshot of the
// objective state it already tracks, so this logic can be regression-tested
// without booting Kaplay.
// ============================================================================

export type StillNeeded = { done: boolean; label: string };

/** Everything the checklist needs to know about the run, flattened. */
export type StillNeededState = {
  methodTouched: boolean;
  userGot: boolean;
  passGot: boolean;
  riverCrossed: boolean;
  docsInZone: number;
  repliesNeeded: number;
  repliesGot: number;
  waitSurvived: boolean;
  planPicked: boolean;
  bossDefeated: boolean;
  hasKey: boolean;
  idCardCollected: boolean;
  firePoleDone: boolean;
};

/** Documents required in the gather-documents zone. */
export const DOCS_REQUIRED = 3;

const t = (done: boolean, label: string): StillNeeded => ({ done, label });

/** Tasks for the step the player died on, ticked where already finished. */
export function stillNeededFor(zone: number, s: StillNeededState): StillNeeded[] {
  switch (zone) {
    case 0:
      return [t(s.methodTouched, "Pick how you want to apply")];
    case 1:
      return [
        t(s.userGot, "Collect your username"),
        t(s.passGot, "Collect your password"),
      ];
    case 2:
      return [t(s.riverCrossed, "Cross the river to the door")];
    case 3: {
      const left = Math.max(0, DOCS_REQUIRED - s.docsInZone);
      return [
        t(
          s.docsInZone >= DOCS_REQUIRED,
          `Gather ${left} more verification document${left === 1 ? "" : "s"}`,
        ),
      ];
    }
    case 4: {
      const left = Math.max(0, s.repliesNeeded - s.repliesGot);
      return [t(left === 0, `Send ${left} more repl${left === 1 ? "y" : "ies"} to the request`)];
    }
    case 5:
      return [t(s.waitSurvived, "Survive the 10-second wait")];
    case 6:
      return [
        t(s.planPicked, "Pick a health plan"),
        t(s.bossDefeated, "Get past the bear"),
        t(s.hasKey, "Grab the key"),
      ];
    case 7:
      return [
        t(s.idCardCollected, "Grab your medical ID card"),
        t(s.firePoleDone, "Slide down the pole to the clinic"),
      ];
    default:
      return [];
  }
}
