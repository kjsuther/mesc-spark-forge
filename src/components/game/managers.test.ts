// Regression: lives, 1-UPs, power-ups, damage arbitration and checkpoints.
// These are the rules a new gameplay feature is most likely to break.
import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { FeatureFlags, type GameFeatures } from "../../lib/game-features.ts";
import {
  BossManager,
  CheckpointManager,
  EnemyManager,
  PlayerManager,
  POWERUP_DEFS,
  PowerUpManager,
  ZONE_INDEX,
  activeUpgradeRows,
} from "./managers.ts";

const ALL_OFF: GameFeatures = {
  moreWaysToReachCaseWorker: false,
  navigatorHelp: false,
  liveChatAssistant: false,
  emailCaseWorker: false,
  checkStatusAnytime: false,
};

beforeEach(() => FeatureFlags.set(ALL_OFF));

// ------------------------------------------------------------------ lives ---

test("base run starts with 3 lives, 5 with the portal upgrade", () => {
  const player = new PlayerManager();
  assert.equal(player.startingLives(), 3);
  FeatureFlags.set({ moreWaysToReachCaseWorker: true });
  assert.equal(player.startingLives(), 5);
});

test("a 1-UP always raises the cap, and the cap never passes 5", () => {
  const player = new PlayerManager();
  assert.equal(player.maxLivesFor(0), 3);
  assert.equal(player.maxLivesFor(1), 4);
  assert.equal(player.maxLivesFor(2), 5);
  assert.equal(player.maxLivesFor(9), PlayerManager.LIFE_CAP);
  FeatureFlags.set({ moreWaysToReachCaseWorker: true });
  assert.equal(player.maxLivesFor(3), PlayerManager.LIFE_CAP);
});

test("reconciling upgrades never takes back a life earned from a 1-UP", () => {
  const player = new PlayerManager();
  const state = { lives: 4, maxLives: 4, bonusLives: 1 };
  // The engine reconciles roughly once a second; it must be a no-op here.
  for (let i = 0; i < 5; i++) assert.equal(player.reconcileLives(state), false);
  assert.deepEqual(state, { lives: 4, maxLives: 4, bonusLives: 1 });
});

test("turning the portal upgrade on mid-run grants the extra lives immediately", () => {
  const player = new PlayerManager();
  const state = { lives: 2, maxLives: 3, bonusLives: 0 };
  FeatureFlags.set({ moreWaysToReachCaseWorker: true });
  assert.equal(player.reconcileLives(state), true);
  assert.equal(state.maxLives, 5);
  assert.equal(state.lives, 4);
});

test("turning it off lowers the cap but can never kill the player mid-run", () => {
  const player = new PlayerManager();
  FeatureFlags.set({ moreWaysToReachCaseWorker: true });
  const state = { lives: 1, maxLives: 5, bonusLives: 0 };
  FeatureFlags.set({ moreWaysToReachCaseWorker: false });
  player.reconcileLives(state);
  assert.equal(state.maxLives, 3);
  assert.ok(state.lives >= 1);
});

// -------------------------------------------------------------- power-ups ---

test("a pickup only spawns while its upgrade is on and it is not already held", () => {
  const powerups = new PowerUpManager();
  assert.equal(powerups.shouldSpawn("navigator"), false);
  FeatureFlags.set({ navigatorHelp: true });
  assert.equal(powerups.shouldSpawn("navigator"), true);
  powerups.collect("navigator");
  assert.equal(powerups.shouldSpawn("navigator"), false);
  powerups.consume("navigator");
  assert.equal(powerups.shouldSpawn("navigator"), false, "a used pickup must not respawn");
});

test("each pickup is pinned to its own zone", () => {
  assert.equal(POWERUP_DEFS.navigator.zone, ZONE_INDEX.choosePlan);
  assert.equal(POWERUP_DEFS.chat.zone, ZONE_INDEX.gatherDocuments);
  assert.equal(POWERUP_DEFS.email.zone, ZONE_INDEX.awaitDecision);
});

test("switching an upgrade off revokes the benefit it already granted", () => {
  const powerups = new PowerUpManager();
  FeatureFlags.set({ liveChatAssistant: true });
  powerups.collect("chat");
  assert.equal(powerups.has("chat"), true);
  FeatureFlags.set({ liveChatAssistant: false });
  assert.equal(powerups.has("chat"), false);
  powerups.revokeDisabled();
  FeatureFlags.set({ liveChatAssistant: true });
  assert.equal(powerups.has("chat"), false, "revoked pickups must not come back");
});

test("the chat shield only protects inside the gather-documents zone", () => {
  const powerups = new PowerUpManager();
  FeatureFlags.set({ liveChatAssistant: true });
  powerups.collect("chat");
  const enemies = new EnemyManager(powerups);
  assert.equal(enemies.blocksDamage("monster", ZONE_INDEX.gatherDocuments), true);
  assert.equal(enemies.blocksDamage("monster", ZONE_INDEX.awaitDecision), false);
});

test("the umbrella only blocks while Down is actually held, and only in its zone", () => {
  const powerups = new PowerUpManager();
  FeatureFlags.set({ emailCaseWorker: true });
  powerups.collect("email");
  const enemies = new EnemyManager(powerups);
  const zone = ZONE_INDEX.awaitDecision;
  assert.equal(enemies.blocksDamage("boulder", zone, false), false, "must not auto-block");
  assert.equal(enemies.blocksDamage("boulder", zone, true), true);
  assert.equal(enemies.blocksDamage("boulder", ZONE_INDEX.gatherDocuments, true), false);
});

test("pits always hurt, whatever the player is carrying", () => {
  const powerups = new PowerUpManager();
  FeatureFlags.set({ liveChatAssistant: true, emailCaseWorker: true });
  powerups.collect("chat");
  powerups.collect("email");
  const enemies = new EnemyManager(powerups);
  for (const zone of [0, ZONE_INDEX.gatherDocuments, ZONE_INDEX.awaitDecision]) {
    assert.equal(enemies.blocksDamage("water", zone, true), false);
  }
});

test("the Navigator clears the boss exactly once", () => {
  const powerups = new PowerUpManager();
  FeatureFlags.set({ navigatorHelp: true });
  powerups.collect("navigator");
  const boss = new BossManager(powerups);
  assert.equal(boss.shouldAutoDefeat(), true);
  boss.consumeNavigator();
  assert.equal(boss.shouldAutoDefeat(), false);
});

test("power-up state survives a checkpoint round-trip", () => {
  const powerups = new PowerUpManager();
  FeatureFlags.set({ navigatorHelp: true, liveChatAssistant: true });
  powerups.collect("chat");
  powerups.collect("navigator");
  powerups.consume("navigator");
  const snap = powerups.snapshot();
  const restored = new PowerUpManager();
  restored.restore(snap);
  assert.equal(restored.has("chat"), true);
  assert.equal(restored.shouldSpawn("navigator"), false);
});

// ------------------------------------------------------------ checkpoints ---

test("checkpoints only record while the upgrade is on and the player is safe", () => {
  const cp = new CheckpointManager();
  const build = () => ({ x: 10 }) as never;
  assert.equal(cp.enabled(), false);
  assert.equal(cp.maybeSave(1, true, build), false);
  FeatureFlags.set({ checkStatusAnytime: true });
  assert.equal(cp.maybeSave(1, false, build), false, "unsafe ground must not save");
  assert.equal(cp.maybeSave(1, true, build), true);
  assert.equal(cp.maybeSave(1.5, true, build), false, "throttled to once a second");
  assert.equal(cp.maybeSave(3, true, build), true);
});

test("a saved checkpoint disappears when the upgrade is switched off", () => {
  const cp = new CheckpointManager();
  FeatureFlags.set({ checkStatusAnytime: true });
  cp.maybeSave(1, true, () => ({ lives: 2 }) as never);
  assert.ok(cp.get());
  FeatureFlags.set({ checkStatusAnytime: false });
  assert.equal(cp.get(), null);
  FeatureFlags.set({ checkStatusAnytime: true });
  cp.clear();
  assert.equal(cp.get(), null);
});

// --------------------------------------------------------------------- HUD --

test("the HUD lists only the upgrades that are actually on", () => {
  const powerups = new PowerUpManager();
  assert.deepEqual(activeUpgradeRows(FeatureFlags.get(), powerups), []);
  FeatureFlags.set({ navigatorHelp: true, checkStatusAnytime: true });
  const rows = activeUpgradeRows(FeatureFlags.get(), powerups);
  assert.deepEqual(
    rows.map((r) => r.name),
    ["navigatorHelp", "checkStatusAnytime"],
  );
  assert.equal(rows[0].carried, false, "not carried until picked up");
  powerups.collect("navigator");
  assert.equal(activeUpgradeRows(FeatureFlags.get(), powerups)[0].carried, true);
});
