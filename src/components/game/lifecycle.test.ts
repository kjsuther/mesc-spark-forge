import assert from "node:assert/strict";
import test from "node:test";
import {
  MOBILE_RESUME_RECOVERY_DELAY_MS,
  clampResumeZone,
  shouldRecoverGameAfterResume,
} from "./lifecycle.ts";

test("recovers a touch game after a meaningful background suspend", () => {
  assert.equal(
    shouldRecoverGameAfterResume({
      isTouch: true,
      hiddenAt: 1_000,
      visibleAt: 1_000 + MOBILE_RESUME_RECOVERY_DELAY_MS,
    }),
    true,
  );
});

test("does not restart desktop or momentarily hidden games without context loss", () => {
  assert.equal(
    shouldRecoverGameAfterResume({ isTouch: false, hiddenAt: 0, visibleAt: 30_000 }),
    false,
  );
  assert.equal(
    shouldRecoverGameAfterResume({
      isTouch: true,
      hiddenAt: 1_000,
      visibleAt: 1_000 + MOBILE_RESUME_RECOVERY_DELAY_MS - 1,
    }),
    false,
  );
});

test("always recovers an explicitly lost context or restored page", () => {
  assert.equal(
    shouldRecoverGameAfterResume({
      isTouch: false,
      hiddenAt: null,
      visibleAt: 0,
      contextWasLost: true,
    }),
    true,
  );
  assert.equal(
    shouldRecoverGameAfterResume({
      isTouch: false,
      hiddenAt: null,
      visibleAt: 0,
      pageWasRestored: true,
    }),
    true,
  );
});

test("clamps recovery to a valid stage", () => {
  assert.equal(clampResumeZone(-2), 0);
  assert.equal(clampResumeZone(3.9), 3);
  assert.equal(clampResumeZone(99), 7);
  assert.equal(clampResumeZone(Number.NaN), 0);
});
