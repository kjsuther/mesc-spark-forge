export type GameScoreSubmission = {
  displayName: string;
  score: number;
  durationMs: number;
  mode: "before" | "after";
};

const NAME_PATTERN = /^[A-Z][A-Z '-]{0,23} [A-Z]\.$/i;

function finiteInteger(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} is invalid.`);
  }
  const integer = Math.round(value);
  if (integer < min || integer > max) {
    throw new Error(`${label} is outside the expected range.`);
  }
  return integer;
}

export function validateGameScoreSubmission(input: unknown): GameScoreSubmission {
  const value = input as Partial<GameScoreSubmission> | null;
  const displayName =
    typeof value?.displayName === "string"
      ? value.displayName.trim().replace(/\s+/g, " ").slice(0, 28)
      : "";
  if (!NAME_PATTERN.test(displayName)) {
    throw new Error("Enter a first name and one last initial.");
  }

  if (value?.mode !== "before" && value?.mode !== "after") {
    throw new Error("Game mode is invalid.");
  }

  return {
    displayName,
    score: finiteInteger(value.score, 0, 250_000, "Score"),
    durationMs: finiteInteger(value.durationMs, 1_000, 7_200_000, "Run time"),
    mode: value.mode,
  };
}
