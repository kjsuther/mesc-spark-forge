import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";
import { NowBuildingBanner } from "@/components/now-building-banner";
import { SectionHeading } from "@/components/trail/section-heading";
import { GameCanvas } from "@/components/game/game-canvas";
import { VotePanel } from "@/components/game/vote-panel";
import { Leaderboard } from "@/components/game/leaderboard";
import { ScoreSubmit } from "@/components/game/score-submit";
import type { WinResult } from "@/components/game/game-scenes";
import { improvementsQuery, gameSettingsQuery, activeRoundQuery } from "@/lib/game.queries";
import { nowBuildingQuery, versionsQuery } from "@/lib/queries";
import { IMPROVEMENT_KEYS, type ImprovementKey } from "@/lib/game.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/tool")({
  head: () => ({
    meta: [
      { title: "Blazing the Trail to Coverage — MN DHS Demo" },
      {
        name: "description",
        content:
          "A tiny retro side-scroller about applying for health coverage. Barriers represent real UX problems — the audience votes on improvements and the trail visibly changes.",
      },
      { property: "og:title", content: "Blazing the Trail to Coverage" },
      {
        property: "og:description",
        content:
          "Vote on UX improvements and watch the trail to health coverage get easier in real time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(improvementsQuery);
    context.queryClient.ensureQueryData(gameSettingsQuery);
    context.queryClient.ensureQueryData(activeRoundQuery);
    context.queryClient.ensureQueryData(nowBuildingQuery);
    context.queryClient.ensureQueryData(versionsQuery);
  },
  component: ToolPage,
});

function ToolPage() {
  const { data: improvements } = useSuspenseQuery(improvementsQuery);
  const { data: nowBuilding } = useSuspenseQuery(nowBuildingQuery);
  const { data: versions } = useSuspenseQuery(versionsQuery);
  const { data: settings } = useQuery(gameSettingsQuery);
  const qc = useQueryClient();
  const [localMode, setLocalMode] = useState<"before" | "after" | null>(null);
  const [gameEnded, setGameEnded] = useState(false);
  const [winResult, setWinResult] = useState<WinResult | null>(null);

  const current = versions.find((v) => v.is_current) ?? versions[versions.length - 1];

  useEffect(() => {
    const channel = supabase
      .channel("tool-game-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_improvements" },
        () => qc.invalidateQueries({ queryKey: ["game_improvements"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_settings" },
        () => qc.invalidateQueries({ queryKey: ["game_settings"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_vote_rounds" },
        () => qc.invalidateQueries({ queryKey: ["game_round"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_improvement_votes" },
        () => qc.invalidateQueries({ queryKey: ["game_round"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "feedback" }, () =>
        qc.invalidateQueries({ queryKey: ["now_building"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const mode: "before" | "after" = localMode ?? settings?.before_after ?? "before";

  const flags = useMemo(() => {
    const base = Object.fromEntries(
      IMPROVEMENT_KEYS.map((k) => [k, false]),
    ) as Record<ImprovementKey, boolean>;
    for (const imp of improvements) base[imp.key] = imp.enabled;
    return base;
  }, [improvements]);

  const enabledCount = improvements.filter((i) => i.enabled).length;

  return (
    <div className="min-h-screen flex flex-col bg-white text-dark-gray font-sans">
      <SiteChrome />

      <main id="main-content" className="max-w-6xl w-full mx-auto py-10 px-4 sm:px-6 flex-1">
        <NowBuildingBanner items={nowBuilding} currentSemver={current?.semver} variant="tool" />

        <header className="mb-6">
          <SectionHeading as="h1">Blazing the Trail to Coverage</SectionHeading>
          <p className="text-lg text-dark-gray/80 max-w-2xl mt-3">
            A short 16-bit trail from <b>"I need health coverage"</b> to <b>Covered!</b> —
            complete with real barriers people hit when applying. The audience votes on UX
            improvements below and the trail visibly changes.
          </p>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div
            role="tablist"
            aria-label="Before / After feedback"
            className="inline-flex bg-cream border-2 border-mn-blue/40 rounded-full p-1"
          >
            <button
              role="tab"
              aria-selected={mode === "before"}
              onClick={() => setLocalMode("before")}
              className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide transition-colors ${
                mode === "before" ? "bg-accent-orange text-white" : "text-mn-blue"
              }`}
            >
              Before feedback
            </button>
            <button
              role="tab"
              aria-selected={mode === "after"}
              onClick={() => setLocalMode("after")}
              className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide transition-colors ${
                mode === "after" ? "bg-mn-green text-white" : "text-mn-blue"
              }`}
            >
              After feedback
            </button>
          </div>
          <span className="text-xs font-semibold text-dark-gray/70">
            {mode === "after"
              ? `${enabledCount} of ${IMPROVEMENT_KEYS.length} improvements applied`
              : "Raw experience — no improvements applied"}
          </span>
        </div>

        <ClientGameCanvas
          flags={flags}
          mode={mode}
          onWin={(r) => {
            setGameEnded(true);
            setWinResult(r);
          }}
          onLose={(r) => {
            setGameEnded(true);
            setWinResult(r);
          }}
        />

        {winResult && (
          <ScoreSubmit
            key={`${winResult.won}-${winResult.durationMs}`}
            result={winResult}
          />
        )}

        <VotePanel highlight={gameEnded} />

        <Leaderboard variant="panel" />


        <p className="mt-8 text-center text-sm text-dark-gray/70 italic max-w-2xl mx-auto">
          Every trail starts somewhere. Better trails are built by listening to the people who use
          them.
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}

function ClientGameCanvas(props: {
  flags: Record<ImprovementKey, boolean>;
  mode: "before" | "after";
  onWin?: (result: WinResult) => void;
  onLose?: (result: WinResult) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div
        className="w-full bg-black rounded-lg ring-2 ring-mn-blue/60 grid place-items-center text-white"
        style={{ aspectRatio: "16 / 9" }}
      >
        Loading game…
      </div>
    );
  }
  return <GameCanvas {...props} />;
}
