// ============================================================================
// Scripted "live build" content for the poster session.
//
// When a vote round ends we play a ~30s sequence that looks like Lovable is
// building the winning upgrade right there on stage. The upgrade already
// exists in the codebase — the sequence is theatre, and the real work at the
// end is simply flipping the feature flag.
//
// Each upgrade gets its own prompt line, touched-file list and diff so the
// sequence reads as genuine to anyone reading closely.
// ============================================================================

import type { ImprovementKey } from "./game.functions";

export const BUILD_DURATION_SEC = 30;

export type BuildScript = {
  /** Chat prompt typed out in the first beat. */
  prompt: string;
  /** Streaming "thinking" lines. */
  thinking: string[];
  /** Files that tick over to "modified" while code streams. */
  files: string[];
  /** Diff lines. Prefix: "+" added, "-" removed, " " context. */
  diff: string[];
};

const SCRIPTS: Record<ImprovementKey, BuildScript> = {
  extra_lives: {
    prompt:
      "The audience voted for the Self-Service Portal. Start the run with 5 tries instead of 3, behind the feature flag.",
    thinking: [
      "Reading src/lib/game-features.ts to find the flag store…",
      "Flag `moreWaysToReachCaseWorker` maps to `extra_lives`.",
      "Lives are initialised in the LivesManager on scene start.",
      "Plan: read the flag at run start and seed 5 lives instead of 3.",
    ],
    files: [
      "src/lib/game-features.ts",
      "src/components/game/managers.ts",
      "src/components/game/game-scenes.ts",
    ],
    diff: [
      " export class LivesManager {",
      "-  private lives = 3;",
      "+  private lives = feat(\"moreWaysToReachCaseWorker\") ? 5 : 3;",
      " ",
      "   reset() {",
      "-    this.lives = 3;",
      "+    this.lives = feat(\"moreWaysToReachCaseWorker\") ? 5 : 3;",
      "     this.renderHud();",
      "   }",
      " }",
    ],
  },
  resume_checkpoint: {
    prompt:
      "Ship the Case Status Checker: when the player is hit, resume at the current zone checkpoint instead of restarting the journey.",
    thinking: [
      "Locating loseLife() in src/components/game/game-scenes.ts…",
      "Checkpoint flags already exist per zone (zone entry positions).",
      "Plan: on death, respawn at the last checkpoint when the flag is on.",
    ],
    files: [
      "src/lib/game-features.ts",
      "src/components/game/game-scenes.ts",
      "src/components/game/managers.ts",
    ],
    diff: [
      " function loseLife() {",
      "-  restartZone(1);",
      "+  const resume = feat(\"checkStatusAnytime\");",
      "+  restartZone(resume ? checkpoints.currentZone : 1);",
      "+  grantInvincibility(2000);",
      "   hud.renderLives();",
      " }",
    ],
  },
  chat_invincible: {
    prompt:
      "Add the Live Chat Bot upgrade: spawn a Chat power-up that makes the player invincible to all enemies.",
    thinking: [
      "Reading the power-up spawner and collision handlers…",
      "Invincibility already exists for respawn i-frames — reuse it.",
      "Plan: spawn the chat pickup when the flag is on, grant invincibility on collect.",
    ],
    files: [
      "src/lib/game-features.ts",
      "src/components/game/managers.ts",
      "src/components/game/game-scenes.ts",
    ],
    diff: [
      " if (feat(\"liveChatAssistant\")) {",
      "+  const chat = spawnPowerUp(\"chat-bot\", zone.powerUpSpot);",
      "+  player.onCollide(\"chat-bot\", () => {",
      "+    destroy(chat);",
      "+    powerUps.grantInvincible();",
      "+    hud.flash(\"CHAT BOT — INVINCIBLE\");",
      "+  });",
      " }",
    ],
  },
  navigator_helper: {
    prompt:
      "Add the Navigator Locator: a Navigator power-up that brings a helper in to assist the player.",
    thinking: [
      "Reading the zone 7 boss encounter…",
      "Navigator sprite + name plaque already registered in the atlas.",
      "Plan: spawn the pickup behind the flag, then have the Navigator assist.",
    ],
    files: [
      "src/lib/game-features.ts",
      "src/components/game/managers.ts",
      "src/components/game/game-scenes.ts",
    ],
    diff: [
      " if (feat(\"navigatorHelp\")) {",
      "+  const pickup = spawnPowerUp(\"navigator\", zone.powerUpSpot);",
      "+  player.onCollide(\"navigator\", () => {",
      "+    destroy(pickup);",
      "+    navigator.summon(player.pos);",
      "+    hud.flash(\"NAVIGATOR IS HELPING\");",
      "+  });",
      " }",
    ],
  },
  email_umbrella: {
    prompt:
      "Ship Email Communication: an Email power-up that gives the player an umbrella shielding them from falling obstacles.",
    thinking: [
      "Reading zone 6 falling calendar-date logic…",
      "Falling hazards all carry the `falling` tag — one guard covers them.",
      "Plan: spawn the email pickup, attach an umbrella sprite, ignore falling hits.",
    ],
    files: [
      "src/lib/game-features.ts",
      "src/components/game/managers.ts",
      "src/components/game/game-scenes.ts",
    ],
    diff: [
      " player.onCollide(\"falling\", (hazard) => {",
      "+  if (umbrella.active) {",
      "+    destroy(hazard);",
      "+    return;",
      "+  }",
      "   loseLife();",
      " });",
    ],
  },
};

export function buildScriptFor(key: string): BuildScript {
  return (
    SCRIPTS[key as ImprovementKey] ?? {
      prompt: "The audience voted. Ship the winning upgrade.",
      thinking: ["Reading the feature flag store…", "Planning the change…"],
      files: ["src/lib/game-features.ts", "src/components/game/game-scenes.ts"],
      diff: [" // upgrade enabled behind its feature flag", "+ FeatureFlags.enable(winner);"],
    }
  );
}

export const BUILD_STEPS = [
  "Typecheck",
  "Build",
  "Deploy",
  "Live",
] as const;
