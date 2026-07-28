// ============================================================================
// Centralized gameplay managers.
//
// Rule for this file: this is the ONLY place that asks "is upgrade X on?".
// The scene code asks a manager a gameplay question ("how many lives?",
// "does this hit hurt?", "should the boss auto-clear?") and the manager
// consults the feature-flag store. No `if (flags.x)` should exist anywhere
// else in the engine.
// ============================================================================

import { FeatureFlags, type FeatureName, type GameFeatures } from "@/lib/game-features";

/** 0-based zone indices (Zone 1 in the UI == index 0). */
export const ZONE_INDEX = {
  gatherDocuments: 3, // "Zone 4 · Gather your documents"
  awaitDecision: 5, // "Zone 6 · Await a decision"
  choosePlan: 6, // "Zone 7 · Choose a health plan" (boss)
} as const;

export type PowerUpKind = "navigator" | "chat" | "email";

/** Where each power-up spawns, and which flag gates it. */
export const POWERUP_DEFS: Record<
  PowerUpKind,
  { feature: FeatureName; zone: number; offsetX: number; y: number; label: string }
> = {
  // Navigator appears early in the plan-choice zone, before the boss arena.
  navigator: { feature: "navigatorHelp", zone: ZONE_INDEX.choosePlan, offsetX: 150, y: 120, label: "NAVIGATOR" },
  chat: { feature: "liveChatAssistant", zone: ZONE_INDEX.gatherDocuments, offsetX: 200, y: 130, label: "LIVE CHAT" },
  email: { feature: "emailCaseWorker", zone: ZONE_INDEX.awaitDecision, offsetX: 180, y: 130, label: "EMAIL" },
};

export const POWERUP_KINDS = Object.keys(POWERUP_DEFS) as PowerUpKind[];

// ---------------------------------------------------------------- Player ---

export class PlayerManager {
  /** Lives the run starts with — and the cap the HUD renders. */
  startingLives(): number {
    return FeatureFlags.isOn("moreWaysToReachCaseWorker") ? 5 : 3;
  }

  /**
   * Applies a live toggle to an in-progress run. Turning the upgrade ON grants
   * the extra lives immediately; turning it OFF lowers the cap but never
   * kills the player mid-run (clamped to at least 1).
   */
  reconcileLives(state: { lives: number; maxLives: number }): boolean {
    const nextMax = this.startingLives();
    if (nextMax === state.maxLives) return false;
    const delta = nextMax - state.maxLives;
    state.maxLives = nextMax;
    state.lives = Math.max(1, Math.min(nextMax, state.lives + Math.max(0, delta)));
    return true;
  }
}

// --------------------------------------------------------------- PowerUps ---

export class PowerUpManager {
  private carried = new Set<PowerUpKind>();
  private used = new Set<PowerUpKind>();

  /** Should this pickup exist in the world right now? */
  shouldSpawn(kind: PowerUpKind): boolean {
    return (
      FeatureFlags.isOn(POWERUP_DEFS[kind].feature) &&
      !this.carried.has(kind) &&
      !this.used.has(kind)
    );
  }

  collect(kind: PowerUpKind): void {
    this.carried.add(kind);
  }

  has(kind: PowerUpKind): boolean {
    return this.carried.has(kind) && FeatureFlags.isOn(POWERUP_DEFS[kind].feature);
  }

  consume(kind: PowerUpKind): void {
    this.carried.delete(kind);
    this.used.add(kind);
  }

  /** Flag turned OFF: drop anything it granted so the benefit disappears. */
  revokeDisabled(): void {
    for (const kind of POWERUP_KINDS) {
      if (!FeatureFlags.isOn(POWERUP_DEFS[kind].feature)) this.carried.delete(kind);
    }
  }

  /** Live Chat shield: only inside the gather-documents zone. */
  shieldActive(zoneIdx: number): boolean {
    return this.has("chat") && zoneIdx === ZONE_INDEX.gatherDocuments;
  }

  /** Email umbrella: only inside the awaiting-decision zone. */
  umbrellaActive(zoneIdx: number): boolean {
    return this.has("email") && zoneIdx === ZONE_INDEX.awaitDecision;
  }

  navigatorReady(): boolean {
    return this.has("navigator");
  }

  snapshot(): { carried: PowerUpKind[]; used: PowerUpKind[] } {
    return { carried: [...this.carried], used: [...this.used] };
  }

  restore(snap: { carried: PowerUpKind[]; used: PowerUpKind[] }): void {
    this.carried = new Set(snap.carried);
    this.used = new Set(snap.used);
  }

  reset(): void {
    this.carried.clear();
    this.used.clear();
  }
}

// ---------------------------------------------------------------- Enemies ---

export type DamageSource = "monster" | "boulder" | "water" | "boss";

export class EnemyManager {
  constructor(private powerups: PowerUpManager) {}

  /**
   * Single arbitration point for "does this contact hurt the player?".
   * Falling calendars are blocked only by the umbrella; ground enemies are
   * blocked only by the chat shield; pits always hurt.
   */
  blocksDamage(source: DamageSource, zoneIdx: number): boolean {
    if (source === "water") return false;
    if (source === "boulder") return this.powerups.umbrellaActive(zoneIdx);
    return this.powerups.shieldActive(zoneIdx);
  }
}

// ------------------------------------------------------------------- Boss ---

export class BossManager {
  constructor(private powerups: PowerUpManager) {}

  /** Navigator clears the boss on first contact — single use. */
  shouldAutoDefeat(): boolean {
    return this.powerups.navigatorReady();
  }

  consumeNavigator(): void {
    this.powerups.consume("navigator");
  }
}

// ------------------------------------------------------------- Checkpoint ---

export type CheckpointSnapshot = {
  x: number;
  y: number;
  lives: number;
  maxLives: number;
  score: number;
  docs: string[];
  farthestZone: number;
  powerups: { carried: PowerUpKind[]; used: PowerUpKind[] };
  zoneState: Record<string, unknown>;
  doorsUnlocked: boolean[];
};

export class CheckpointManager {
  private snap: CheckpointSnapshot | null = null;
  private lastSaveAt = 0;

  enabled(): boolean {
    return FeatureFlags.isOn("checkStatusAnytime");
  }

  /** Called continuously; only records while the player is safe & grounded. */
  maybeSave(now: number, safe: boolean, build: () => CheckpointSnapshot): boolean {
    if (!this.enabled() || !safe) return false;
    if (now - this.lastSaveAt < 1) return false;
    this.lastSaveAt = now;
    this.snap = build();
    return true;
  }

  get(): CheckpointSnapshot | null {
    return this.enabled() ? this.snap : null;
  }

  clear(): void {
    this.snap = null;
    this.lastSaveAt = 0;
  }
}

// ------------------------------------------------------------------- HUD ----

export type ActiveUpgradeRow = { name: FeatureName; label: string; carried: boolean };

/** Small helper so the HUD panel never re-implements flag logic. */
export function activeUpgradeRows(
  features: GameFeatures,
  powerups: PowerUpManager,
): ActiveUpgradeRow[] {
  const rows: ActiveUpgradeRow[] = [];
  const push = (name: FeatureName, label: string, carried: boolean) => {
    if (features[name]) rows.push({ name, label, carried });
  };
  push("moreWaysToReachCaseWorker", "Portal", true);
  push("navigatorHelp", "Navigator", powerups.has("navigator"));
  push("liveChatAssistant", "Chat Bot", powerups.has("chat"));
  push("emailCaseWorker", "Email", powerups.has("email"));
  push("checkStatusAnytime", "Status Check", true);
  return rows;
}
