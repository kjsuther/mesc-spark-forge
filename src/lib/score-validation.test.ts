import assert from "node:assert/strict";
import test from "node:test";
import { validateGameScoreSubmission } from "./score-validation.ts";

test("normalizes a valid score submission", () => {
  assert.deepEqual(
    validateGameScoreSubmission({
      displayName: "  Jane   D. ",
      score: 12_345.4,
      durationMs: 91_200.2,
      mode: "after",
    }),
    {
      displayName: "Jane D.",
      score: 12_345,
      durationMs: 91_200,
      mode: "after",
    },
  );
});

test("rejects malformed names and implausible telemetry", () => {
  assert.throws(
    () =>
      validateGameScoreSubmission({
        displayName: "<script> X.",
        score: 100,
        durationMs: 5_000,
        mode: "after",
      }),
    /first name/i,
  );
  assert.throws(
    () =>
      validateGameScoreSubmission({
        displayName: "Jane D.",
        score: 999_999,
        durationMs: 5_000,
        mode: "after",
      }),
    /expected range/i,
  );
});
