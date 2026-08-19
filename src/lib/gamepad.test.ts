// Regression: arcade-stick input rules. Drift must never move the hero or
// open the umbrella, and every hardware flavour (stick / hat / D-pad) must
// produce the same directions.
import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

type FakePad = { axes: number[]; buttons: { pressed: boolean; value: number }[] };

const pad = (over: Partial<{ axes: number[]; pressed: number[] }> = {}): FakePad => ({
  axes: over.axes ?? [0, 0, 0, 0, 0, 0, 0, 0, 0, 3.28],
  buttons: Array.from({ length: 16 }, (_, i) => ({
    pressed: (over.pressed ?? []).includes(i),
    value: (over.pressed ?? []).includes(i) ? 1 : 0,
  })),
});

let pads: FakePad[] = [];
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { getGamepads: () => pads },
});

const { pumpGamepadInput } = await import("./gamepad.ts");

const input = () => ({ left: false, right: false, jumpReq: false, down: false });

function pump(p: FakePad[]) {
  pads = p;
  const target = input();
  pumpGamepadInput(target);
  return target;
}

beforeEach(() => {
  // Release everything so hysteresis from the previous case can't leak.
  pump([pad()]);
  pump([pad()]);
});

test("a centred stick moves nothing", () => {
  const out = pump([pad()]);
  assert.deepEqual(out, { left: false, right: false, jumpReq: false, down: false });
});

test("light resting drift never moves the hero", () => {
  const out = pump([pad({ axes: [0.1, 0.1, 0, 0, 0, 0, 0, 0, 0, 3.28] })]);
  assert.equal(out.left, false);
  assert.equal(out.right, false);
});

test("a real push moves the hero, and releasing stops it", () => {
  assert.equal(pump([pad({ axes: [1, 0, 0, 0, 0, 0, 0, 0, 0, 3.28] })]).right, true);
  assert.equal(pump([pad()]).right, false);
  assert.equal(pump([pad({ axes: [-1, 0, 0, 0, 0, 0, 0, 0, 0, 3.28] })]).left, true);
});

test("opposite directions can never both win", () => {
  const out = pump([pad({ pressed: [14, 15] })]);
  assert.ok(!(out.left && out.right));
});

test("the D-pad and the secondary axis pair drive the same directions", () => {
  assert.equal(pump([pad({ pressed: [15] })]).right, true);
  pump([pad()]);
  assert.equal(pump([pad({ axes: [0, 0, 0, 0, 0, 0, -1, 0, 0, 3.28] })]).left, true);
});

test("drift down never opens the umbrella, a deliberate pull does", () => {
  assert.equal(pump([pad({ axes: [0, 0.4, 0, 0, 0, 0, 0, 0, 0, 3.28] })]).down, false);
  assert.equal(pump([pad({ axes: [0, 1, 0, 0, 0, 0, 0, 0, 0, 3.28] })]).down, true);
});

test("the umbrella stays open through minor wobble, then closes on release", () => {
  pump([pad({ axes: [0, 1, 0, 0, 0, 0, 0, 0, 0, 3.28] })]);
  assert.equal(pump([pad({ axes: [0, 0.45, 0, 0, 0, 0, 0, 0, 0, 3.28] })]).down, true);
  assert.equal(pump([pad({ axes: [0, 0.05, 0, 0, 0, 0, 0, 0, 0, 3.28] })]).down, false);
});

test("every face button jumps, once per press", () => {
  for (const button of [0, 1, 2, 3]) {
    pump([pad()]);
    assert.equal(pump([pad({ pressed: [button] })]).jumpReq, true, `button ${button}`);
    assert.equal(
      pump([pad({ pressed: [button] })]).jumpReq,
      false,
      "held buttons must not auto-fire",
    );
  }
});

test("no pad connected leaves keyboard and touch input alone", () => {
  pads = [];
  const target = { left: true, right: false, jumpReq: false, down: true };
  pumpGamepadInput(target);
  assert.equal(target.left, true, "pad must not clear a key the player is holding");
  assert.equal(target.down, true);
});
