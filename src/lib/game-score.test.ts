import assert from "node:assert/strict";
import test from "node:test";
import {
  RUN_PAR_MS,
  ZONE_PAR_S,
  computeFinalScore,
  runSpeedMultiplier,
  zoneSpeedBonus,
} from "./game-score.ts";

test("whole-run par is the sum of the advertised zone pars", () => {
  assert.equal(RUN_PAR_MS, ZONE_PAR_S.reduce((a, b) => a + b, 0) * 1000);
  // A run that hits every zone par lands on a neutral multiplier.
  assert.equal(Math.round(runSpeedMultiplier(true, RUN_PAR_MS) * 100), 100);
});

test("zone speed bonus rewards clearing under par and floors at 2x par", () => {
  const par = ZONE_PAR_S[0];
  const fast = zoneSpeedBonus(0, par / 2);
  const atPar = zoneSpeedBonus(0, par);
  assert.ok(fast > atPar, "faster clear must pay more");
  assert.equal(zoneSpeedBonus(0, par * 2), 0);
  assert.equal(zoneSpeedBonus(0, par * 10), 0);
});

test("dying quickly can never out-score a slower completed run", () => {
  const quickDeath = computeFinalScore({
    won: false,
    playScore: 1_200,
    durationMs: 7_000,
    lives: 0,
  });
  const slowWin = computeFinalScore({
    won: true,
    playScore: 1_200,
    durationMs: RUN_PAR_MS * 2,
    lives: 0,
  });
  assert.ok(slowWin > quickDeath);
});

test("a faster win beats an identical slower win", () => {
  const base = { won: true, playScore: 8_000, lives: 2 };
  const fast = computeFinalScore({ ...base, durationMs: 96_000 });
  const slow = computeFinalScore({ ...base, durationMs: 196_000 });
  assert.ok(fast > slow * 1.3, `expected a clear gap, got ${fast} vs ${slow}`);
});

test("the multiplier is clamped and losses never get one", () => {
  assert.equal(runSpeedMultiplier(false, 1_000), 1);
  assert.ok(runSpeedMultiplier(true, 1_000) <= 2.2);
  assert.ok(runSpeedMultiplier(true, 60 * 60_000) >= 0.5);
});

test("scores stay inside the anti-tamper cap for realistic runs", () => {
  const best = computeFinalScore({
    won: true,
    playScore: 40_000,
    durationMs: 90_000,
    lives: 5,
  });
  assert.ok(best < 250_000, `expected under the cap, got ${best}`);
});
