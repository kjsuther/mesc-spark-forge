// ============================================================================
// Feature-flag core for the Medicaid journey game.
//
// Every upgrade the conference audience votes on is a *feature flag*. Nothing
// about an upgrade is hardcoded into the game: the engine reads this store at
// runtime (every frame where it matters), and the admin dashboard writes to
// the database, which streams back here over realtime.
//
// Adding a sixth upgrade later = add one entry to `GameFeatures`,
// `FEATURE_DB_KEY` and `FEATURE_META`. No engine changes required beyond the
// manager that consumes it.
// ============================================================================

import type { ImprovementKey } from "./game.functions";

/** Friendly, product-level names for the five upgrades. */
export interface GameFeatures {
  moreWaysToReachCaseWorker: boolean;
  navigatorHelp: boolean;
  liveChatAssistant: boolean;
  emailCaseWorker: boolean;
  checkStatusAnytime: boolean;
}

export type FeatureName = keyof GameFeatures;

/** Maps each product-level feature to the row key stored in the database. */
export const FEATURE_DB_KEY: Record<FeatureName, ImprovementKey> = {
  moreWaysToReachCaseWorker: "extra_lives",
  navigatorHelp: "navigator_helper",
  liveChatAssistant: "chat_invincible",
  emailCaseWorker: "email_umbrella",
  checkStatusAnytime: "resume_checkpoint",
};

export const DB_KEY_FEATURE: Record<string, FeatureName> = Object.fromEntries(
  Object.entries(FEATURE_DB_KEY).map(([f, k]) => [k, f as FeatureName]),
) as Record<string, FeatureName>;

/** Display metadata used by the admin dashboard and the in-game HUD. */
export const FEATURE_META: Record<
  FeatureName,
  { adminLabel: string; hudLabel: string; description: string }
> = {
  moreWaysToReachCaseWorker: {
    adminLabel: "More Ways to Reach Your Case Worker",
    hudLabel: "5 Lives",
    description: "Start every run with 5 lives instead of 3.",
  },
  navigatorHelp: {
    adminLabel: "Get Help from a Navigator",
    hudLabel: "Navigator",
    description: "A navigator power-up appears and clears the Zone 7 boss for you (single use).",
  },
  liveChatAssistant: {
    adminLabel: "Live Chat Assistant",
    hudLabel: "Live Chat",
    description: "A chat power-up in Zone 4 makes you invincible while you stay in that zone.",
  },
  emailCaseWorker: {
    adminLabel: "Email Your Case Worker",
    hudLabel: "Email Shield",
    description: "An email power-up in Zone 6 grants an umbrella that blocks falling calendar dates.",
  },
  checkStatusAnytime: {
    adminLabel: "Check Your Status Anytime",
    hudLabel: "Checkpoint Resume",
    description: "Losing a life resumes from your last checkpoint with progress intact.",
  },
};

export const FEATURE_NAMES = Object.keys(FEATURE_DB_KEY) as FeatureName[];

export const DEFAULT_FEATURES: GameFeatures = {
  moreWaysToReachCaseWorker: false,
  navigatorHelp: false,
  liveChatAssistant: false,
  emailCaseWorker: false,
  checkStatusAnytime: false,
};

type Listener = (features: GameFeatures) => void;

/**
 * Process-wide singleton the game engine and React tree both talk to.
 * React pushes updates in (`setFromDbFlags`), the engine reads them out
 * (`get` / `isOn`) — so a toggle change is felt live without a remount.
 */
class FeatureFlagStore {
  private features: GameFeatures = { ...DEFAULT_FEATURES };
  private listeners = new Set<Listener>();

  get(): GameFeatures {
    return this.features;
  }

  isOn(name: FeatureName): boolean {
    return this.features[name] === true;
  }

  /** Read by database key (`extra_lives`, …) — used by legacy call sites. */
  isDbKeyOn(dbKey: string): boolean {
    const name = DB_KEY_FEATURE[dbKey];
    return name ? this.features[name] === true : false;
  }

  set(partial: Partial<GameFeatures>): void {
    const next = { ...this.features, ...partial };
    const changed = FEATURE_NAMES.some((n) => next[n] !== this.features[n]);
    if (!changed) return;
    this.features = next;
    for (const l of this.listeners) l(next);
  }

  /** Accepts the `{ extra_lives: true, … }` shape produced by the database. */
  setFromDbFlags(flags: Record<string, boolean | undefined>): void {
    const partial: Partial<GameFeatures> = {};
    for (const name of FEATURE_NAMES) {
      partial[name] = flags[FEATURE_DB_KEY[name]] === true;
    }
    this.set(partial);
  }

  toDbFlags(): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const name of FEATURE_NAMES) out[FEATURE_DB_KEY[name]] = this.features[name];
    return out;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
}

export const FeatureFlags = new FeatureFlagStore();

/** Convenience for engine code: `feat("navigatorHelp")`. */
export const feat = (name: FeatureName): boolean => FeatureFlags.isOn(name);
