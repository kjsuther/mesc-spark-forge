import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { GameCanvas } from "@/components/game/game-canvas";
import { improvementsQuery, gameSettingsQuery } from "@/lib/game.queries";
import { IMPROVEMENT_KEYS, type ImprovementKey } from "@/lib/game.functions";

export const Route = createFileRoute("/tool/embed")({
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

  const mode: "before" | "after" = settings?.before_after ?? "before";

  const flags = useMemo(() => {
    const base = Object.fromEntries(
      IMPROVEMENT_KEYS.map((k) => [k, false]),
    ) as Record<ImprovementKey, boolean>;
    for (const imp of improvements) base[imp.key] = imp.enabled;
    return base;
  }, [improvements]);

  return (
    <div className="w-screen h-screen bg-black grid place-items-center overflow-hidden">
      {mounted ? (
        <GameCanvas flags={flags} mode={mode} />
      ) : (
        <div className="text-white text-sm">Loading game…</div>
      )}
    </div>
  );
}
