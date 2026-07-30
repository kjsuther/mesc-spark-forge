import { getCookie, setCookie } from "@tanstack/react-start/server";

export function enforceSubmissionCooldown(kind: "feedback" | "score", cooldownMs: number) {
  const cookieName = `mesc-${kind}-cooldown`;
  const now = Date.now();
  const previous = Number(getCookie(cookieName));
  if (Number.isFinite(previous) && now - previous < cooldownMs) {
    throw new Error("Please wait a few seconds before submitting again.");
  }

  setCookie(cookieName, String(now), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(1, Math.ceil(cooldownMs / 1000)),
  });
}
