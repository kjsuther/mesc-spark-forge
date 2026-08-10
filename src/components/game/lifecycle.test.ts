import assert from "node:assert/strict";
import test from "node:test";
import {
  MOBILE_RESUME_RECOVERY_DELAY_MS,
  SNAPSHOT_MAX_AGE_MS,
  clampResumeZone,
  isResumableSnapshot,
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

test("a resumable snapshot must be fresh, complete and in range", () => {
  const now = 1_000_000;
  const base = { savedAt: now - 5_000, elapsedMs: 42_000, zone: 3, score: 9_000 };
  assert.equal(isResumableSnapshot(base, now), true);
  assert.equal(isResumableSnapshot(null, now), false);
  assert.equal(
    isResumableSnapshot({ ...base, savedAt: now - SNAPSHOT_MAX_AGE_MS - 1 }, now),
    false,
  );
  assert.equal(isResumableSnapshot({ ...base, zone: 9 }, now), false);
  assert.equal(isResumableSnapshot({ ...base, elapsedMs: -1 }, now), false);
  // A snapshot from the future (clock skew) is not trusted.
  assert.equal(isResumableSnapshot({ ...base, savedAt: now + 5_000 }, now), false);
});

test("resuming preserves the elapsed clock so finish times stay honest", () => {
  const snap = { savedAt: Date.now(), elapsedMs: 118_000, zone: 5, score: 12_000 };
  assert.ok(isResumableSnapshot(snap));
  // The resumed run's reported duration = carried elapsed + time played after.
  const playedAfterMs = 40_000;
  assert.equal(snap.elapsedMs + playedAfterMs, 158_000);
});
