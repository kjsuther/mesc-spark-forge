// ============================================================================
// Feature-flag core for the Medicaid journey game.
//
// These capability hooks remain after the curated improvement ballot was
// replaced by the free-form feedback backlog. The host supplies one explicit
// build snapshot at run start; there is no longer a database toggle stream.
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
    adminLabel: "Self-Service Portal",
    hudLabel: "Portal",
    description: "Start game with 5 tries instead of 3.",
  },
  navigatorHelp: {
    adminLabel: "Navigator Locator",
    hudLabel: "Navigator",
    description: "Pick up the Navigator power-up to have Navigator appear to assist.",
  },
  liveChatAssistant: {
    adminLabel: "Live Chat Bot",
    hudLabel: "Chat Bot",
    description: "Pick up the Chat power-up and become invincible to all enemies.",
  },
  emailCaseWorker: {
    adminLabel: "Email Communication",
    hudLabel: "Email",
    description: "Pick up the Email power-up for an umbrella to protect you.",
  },
  checkStatusAnytime: {
    adminLabel: "Case Status Checker",
    hudLabel: "Status Check",
    description: "If you're hit, restart right where you left off.",
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
 * Process-wide store shared by the game managers during one run.
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
