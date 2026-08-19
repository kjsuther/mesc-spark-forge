// Regression: the failure-screen "still needed" checklist must always match
// the objective state of the zone the player died on.
import assert from "node:assert/strict";
import test from "node:test";
import { stillNeededFor, type StillNeededState } from "./still-needed.ts";

const fresh = (over: Partial<StillNeededState> = {}): StillNeededState => ({
  methodTouched: false,
  userGot: false,
  passGot: false,
  riverCrossed: false,
  docsInZone: 0,
  repliesNeeded: 3,
  repliesGot: 0,
  waitSurvived: false,
  planPicked: false,
  bossDefeated: false,
  hasKey: false,
  idCardCollected: false,
  firePoleDone: false,
  ...over,
});

test("every playable zone lists at least one task", () => {
  for (let zone = 0; zone < 8; zone++) {
    assert.ok(stillNeededFor(zone, fresh()).length > 0, `zone ${zone} has no tasks`);
  }
  assert.deepEqual(stillNeededFor(99, fresh()), []);
});

test("nothing is ticked on a fresh run, everything ticks once done", () => {
  for (let zone = 0; zone < 8; zone++) {
    assert.ok(
      stillNeededFor(zone, fresh()).every((task) => !task.done),
      `zone ${zone} pre-ticked a task`,
    );
  }
  const finished = fresh({
    methodTouched: true,
    userGot: true,
    passGot: true,
    riverCrossed: true,
    docsInZone: 3,
    repliesGot: 3,
    waitSurvived: true,
    planPicked: true,
    bossDefeated: true,
    hasKey: true,
    idCardCollected: true,
    firePoleDone: true,
  });
  for (let zone = 0; zone < 8; zone++) {
    assert.ok(
      stillNeededFor(zone, finished).every((task) => task.done),
      `zone ${zone} kept a task open after completion`,
    );
  }
});

test("counted tasks report how many are left, with correct plurals", () => {
  assert.equal(stillNeededFor(3, fresh({ docsInZone: 0 }))[0].label, "Gather 3 more verification documents");
  assert.equal(stillNeededFor(3, fresh({ docsInZone: 2 }))[0].label, "Gather 1 more verification document");
  assert.equal(stillNeededFor(4, fresh({ repliesGot: 2 }))[0].label, "Send 1 more reply to the request");
  assert.equal(stillNeededFor(4, fresh({ repliesGot: 0 }))[0].label, "Send 3 more replies to the request");
});

test("over-collecting never produces a negative count", () => {
  const docs = stillNeededFor(3, fresh({ docsInZone: 9 }))[0];
  assert.equal(docs.done, true);
  assert.ok(!docs.label.includes("-"));
  const replies = stillNeededFor(4, fresh({ repliesGot: 9 }))[0];
  assert.equal(replies.done, true);
  assert.ok(!replies.label.includes("-"));
});

test("the plan-choice zone tracks all three sub-goals independently", () => {
  const tasks = stillNeededFor(6, fresh({ planPicked: true }));
  assert.deepEqual(
    tasks.map((task) => task.done),
    [true, false, false],
  );
});
