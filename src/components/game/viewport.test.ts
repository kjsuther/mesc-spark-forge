import assert from "node:assert/strict";
import test from "node:test";
import { selectViewportSnapshot } from "./viewport.ts";

test("Visual Viewport wins over stale smaller layout viewport values", () => {
  assert.deepEqual(
    selectViewportSnapshot(
      { width: 852, height: 393, offsetLeft: 7, offsetTop: 2 },
      { width: 852, height: 375 },
      { width: 837, height: 375 },
    ),
    { vw: 852, vh: 393, offsetLeft: 7, offsetTop: 2 },
  );
});

test("inner viewport is used when Visual Viewport is unavailable", () => {
  assert.deepEqual(
    selectViewportSnapshot(undefined, { width: 667, height: 375 }, { width: 640, height: 360 }),
    { vw: 667, vh: 375, offsetLeft: 0, offsetTop: 0 },
  );
});

test("invalid browser measurements receive a stable game-sized fallback", () => {
  assert.deepEqual(selectViewportSnapshot({}, {}, {}), {
    vw: 960,
    vh: 540,
    offsetLeft: 0,
    offsetTop: 0,
  });
});
