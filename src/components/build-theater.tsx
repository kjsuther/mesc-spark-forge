import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { activeBuildRunQuery, improvementsQuery } from "@/lib/game.queries";
import { finalizeBuildRun } from "@/lib/game.functions";
import { buildScriptFor, BUILD_STEPS } from "@/lib/build-scripts";

// ---------------------------------------------------------------------------
// "Live build" theatre.
//
// When a vote round ends, every screen plays this ~30s sequence: a prompt is
// typed, reasoning streams, files change, a diff scrolls, the build steps tick
// green, and the upgrade ships. It is driven entirely off the shared
// `startedAt` timestamp, so the projector and every phone stay in lockstep.
// ---------------------------------------------------------------------------

const BEATS = {
  prompt: [0, 4],
  thinking: [4, 9],
  code: [9, 20],
  build: [20, 27],
  shipped: [27, 30],
} as const;

function useTick(active: boolean) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setN((n) => n + 1), 80);
    return () => clearInterval(id);
  }, [active]);
}

export function BuildTheater({ variant = "page" }: { variant?: "page" | "poster" }) {
  const qc = useQueryClient();
  const { data: run } = useQuery(activeBuildRunQuery);
  const { data: improvements = [] } = useQuery(improvementsQuery);
  const finalize = useServerFn(finalizeBuildRun);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const finalizedRef = useRef<string | null>(null);

  useEffect(() => {
    const ch = supabase
      .channel("build-theater")
      .on("postgres_changes", { event: "*", schema: "public", table: "game_build_runs" }, () => {
        qc.invalidateQueries({ queryKey: ["game_build_run"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const visible = !!run && run.id !== dismissedId;
  useTick(visible);

  const elapsed = run ? (Date.now() - new Date(run.startedAt).getTime()) / 1000 : 0;
  const duration = run?.durationSec ?? 30;

  // Once the scripted sequence has played out, actually flip the flag.
  useEffect(() => {
    if (!run) return;
    if (elapsed < duration) return;
    if (finalizedRef.current === run.id) return;
    finalizedRef.current = run.id;
    void (async () => {
      try {
        await finalize({ data: { id: run.id } });
      } catch {
        /* another screen got there first */
      }
      qc.invalidateQueries({ queryKey: ["game_build_run"] });
      qc.invalidateQueries({ queryKey: ["game_improvements"] });
      qc.invalidateQueries({ queryKey: ["game_settings"] });
    })();
  }, [run, elapsed, duration, finalize, qc]);

  const meta = useMemo(
    () => improvements.find((i) => i.key === run?.improvementKey),
    [improvements, run?.improvementKey],
  );

  if (!visible || !run) return null;

  const script = buildScriptFor(run.improvementKey);
  const label = meta?.label ?? run.improvementKey;
  const description = meta?.description ?? "";
  const t = Math.max(0, Math.min(elapsed, duration));

  // ---- beat content -------------------------------------------------------
  const promptChars = Math.floor(
    (Math.min(t, BEATS.prompt[1]) / BEATS.prompt[1]) * script.prompt.length,
  );
  const typedPrompt = script.prompt.slice(0, promptChars);

  const thinkingShown =
    t < BEATS.thinking[0]
      ? 0
      : Math.ceil(
          ((Math.min(t, BEATS.thinking[1]) - BEATS.thinking[0]) /
            (BEATS.thinking[1] - BEATS.thinking[0])) *
            script.thinking.length,
        );

  const codeProgress =
    t < BEATS.code[0]
      ? 0
      : Math.min(1, (t - BEATS.code[0]) / (BEATS.code[1] - BEATS.code[0]));
  const diffShown = Math.ceil(codeProgress * script.diff.length);
  const filesDone = Math.ceil(codeProgress * script.files.length);

  const stepProgress =
    t < BEATS.build[0]
      ? 0
      : Math.min(1, (t - BEATS.build[0]) / (BEATS.build[1] - BEATS.build[0]));
  const stepsDone = Math.floor(stepProgress * (BUILD_STEPS.length + 0.001));

  const shipped = t >= BEATS.shipped[0];
  const pct = Math.round((t / duration) * 100);

  const scale = variant === "poster" ? "text-base" : "text-[13px]";

  return (
    <div
      className="fixed inset-0 z-[999] bg-[#0b0e17]/95 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-label="Building the winning upgrade"
    >
      <div
        className={`w-full max-w-5xl max-h-full overflow-hidden rounded-xl border border-white/10 bg-[#11131c] shadow-2xl flex flex-col ${scale}`}
      >
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-[#161927]">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <span className="w-3 h-3 rounded-full bg-[#28c840]" />
          <span className="ml-3 text-white/60 text-xs font-medium tracking-wide">
            Lovable — blazing-the-trail
          </span>
          <span className="ml-auto flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Building live
          </span>
          {variant === "page" && (
            <button
              onClick={() => setDismissedId(run.id)}
              className="ml-3 text-white/40 hover:text-white text-sm"
              aria-label="Hide build view"
            >
              ✕
            </button>
          )}
        </div>

        {/* Vote banner */}
        <div className="px-4 py-2 bg-[#1b2033] border-b border-white/10 flex items-center gap-3 flex-wrap">
          <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">
            Audience voted
          </span>
          <span className="text-white font-bold">{label}</span>
          <span className="text-white/50 text-xs tabular-nums">{run.votes} votes</span>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-4 space-y-3 font-mono">
          {/* Prompt */}
          <div className="rounded-lg border border-white/10 bg-[#0e1119] px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-widest text-white/35 mb-1">Prompt</div>
            <p className="text-white/90 leading-relaxed">
              {typedPrompt}
              {t < BEATS.prompt[1] && <span className="text-amber-400">▍</span>}
            </p>
          </div>

          {/* Thinking */}
          {thinkingShown > 0 && (
            <ul className="space-y-1">
              {script.thinking.slice(0, thinkingShown).map((line, i) => (
                <li key={i} className="flex gap-2 text-white/55">
                  <span className="text-sky-400">›</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Code */}
          {codeProgress > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
              <div className="rounded-lg border border-white/10 bg-[#0e1119] p-2.5">
                <div className="text-[10px] uppercase tracking-widest text-white/35 mb-2">
                  Files
                </div>
                <ul className="space-y-1.5">
                  {script.files.map((f, i) => (
                    <li
                      key={f}
                      className={`flex items-center gap-2 truncate ${
                        i < filesDone ? "text-emerald-300" : "text-white/30"
                      }`}
                    >
                      <span>{i < filesDone ? "✓" : "•"}</span>
                      <span className="truncate">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#0e1119] p-2.5 overflow-hidden">
                <div className="text-[10px] uppercase tracking-widest text-white/35 mb-2">
                  Diff
                </div>
                <pre className="whitespace-pre-wrap leading-relaxed">
                  {script.diff.slice(0, diffShown).map((line, i) => {
                    const added = line.startsWith("+");
                    const removed = line.startsWith("-");
                    return (
                      <div
                        key={i}
                        className={
                          added
                            ? "text-emerald-300 bg-emerald-400/10"
                            : removed
                              ? "text-rose-300 bg-rose-400/10"
                              : "text-white/45"
                        }
                      >
                        {line}
                      </div>
                    );
                  })}
                  {codeProgress < 1 && <span className="text-amber-400">▍</span>}
                </pre>
              </div>
            </div>
          )}

          {/* Build steps */}
          {stepProgress > 0 && (
            <div className="flex flex-wrap gap-2">
              {BUILD_STEPS.map((s, i) => (
                <span
                  key={s}
                  className={`px-2.5 py-1 rounded border text-xs font-semibold ${
                    i < stepsDone
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                      : "border-white/10 text-white/30"
                  }`}
                >
                  {i < stepsDone ? "✓ " : "… "}
                  {s}
                </span>
              ))}
            </div>
          )}

          {/* Shipped */}
          {shipped && (
            <div className="rounded-lg border-2 border-emerald-400/50 bg-emerald-400/10 px-4 py-3">
              <div className="text-[11px] font-black uppercase tracking-widest text-emerald-300">
                Shipped
              </div>
              <div className="text-white font-bold text-lg">{label} is live</div>
              {description && <p className="text-white/70 text-sm mt-0.5">{description}</p>}
              <p className="text-emerald-300/80 text-xs mt-1">
                Now active in the game — no reload needed.
              </p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-sky-400 via-emerald-400 to-amber-300 transition-[width] duration-100"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
