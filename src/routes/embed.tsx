import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { GameCanvas } from "@/components/game/game-canvas";
import { improvementsQuery, gameSettingsQuery } from "@/lib/game.queries";
import { IMPROVEMENT_KEYS, type ImprovementKey } from "@/lib/game.functions";

export const Route = createFileRoute("/embed")({
  head: () => ({
    meta: [
      { title: "Blazing the Trail — Embed" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(improvementsQuery);
    context.queryClient.ensureQueryData(gameSettingsQuery);
  },
  component: EmbedPage,
});

function EmbedPage() {
  const { data: improvements } = useSuspenseQuery(improvementsQuery);
  const { data: settings } = useQuery(gameSettingsQuery);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const mode: "before" | "after" =
    settings?.before_after ?? (improvements.some((i) => i.enabled) ? "after" : "before");

  // Upgrades only apply in the "after feedback" version.
  const flags = useMemo(() => {
    const base = Object.fromEntries(
      IMPROVEMENT_KEYS.map((k) => [k, false]),
    ) as Record<ImprovementKey, boolean>;
    if (mode !== "after") return base;
    for (const imp of improvements) base[imp.key] = imp.enabled;
    return base;
  }, [improvements, mode]);

  return (
    <div className="w-screen h-[100dvh] bg-black overflow-hidden">
      {mounted ? (
        <GameCanvas flags={flags} mode={mode} presentation />
      ) : (
        <div className="grid h-full w-full place-items-center text-white text-sm">Loading game…</div>
      )}
    </div>
  );
}
