// SNES-style in-canvas name entry shown the moment a run ends.
// Rendered on top of the game canvas (never below the game window) so the
// player can't miss that they scored.
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { submitGameScore } from "@/lib/game.functions";
import type { WinResult } from "./game-scenes";

const LS_KEY = "trailGame.name.v1";
const PIXEL_FONT = '"Press Start 2P", ui-monospace, monospace';

const topScoresQuery = {
  queryKey: ["game_scores", "top"] as const,
  queryFn: async (): Promise<{ score: number }[]> => {
    const { data, error } = await supabase
      .from("game_scores")
      .select("score")
      .order("score", { ascending: false })
      .limit(10);
    if (error) throw error;
    return (data ?? []) as { score: number }[];
  },
  staleTime: 4000,
};

const fieldStyle: React.CSSProperties = {
  fontFamily: PIXEL_FONT,
  color: "var(--color-accent-gold)",
  background: "rgba(10,20,45,0.95)",
  borderColor: "var(--color-accent-gold)",
  caretColor: "var(--color-accent-gold)",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  touchAction: "manipulation",
  WebkitAppearance: "none",
  borderRadius: 0,
};

export function ScoreEntryOverlay({
  result,
  onClose,
  onRestart,
  uiScale = 1,
  openFeedbackInNewTab = false,
}: {
  result: WinResult;
  onClose: () => void;
  onRestart?: () => void;
  uiScale?: number;
  openFeedbackInNewTab?: boolean;
}) {
  const qc = useQueryClient();
  const submitScore = useServerFn(submitGameScore);
  const { data: top = [] } = useQuery(topScoresQuery);
  const [first, setFirst] = useState("");
  const [initial, setInitial] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement | null>(null);
  const initialRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const score = result.score;
  const isHighScore = top.length < 10 || score > (top[top.length - 1]?.score ?? 0);

  useEffect(() => {
    // Kiosk: always start blank so the next player never sees the previous
    // player's name already filled in.
    // Focus after mount, and again on the next frame: entering/leaving
    // fullscreen re-parents the canvas host and can drop the caret.
    const focus = () => firstRef.current?.focus();
    const t = setTimeout(focus, 60);
    const raf = requestAnimationFrame(focus);
    document.addEventListener("fullscreenchange", focus);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
      document.removeEventListener("fullscreenchange", focus);
    };
  }, []);

  // Keep game keys (R restarts the run) from firing while the panel is open,
  // but never swallow keystrokes aimed at our own inputs.
  useEffect(() => {
    const block = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target === firstRef.current || target === initialRef.current)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      e.stopPropagation();
    };
    window.addEventListener("keydown", block, true);
    window.addEventListener("keyup", block, true);
    return () => {
      window.removeEventListener("keydown", block, true);
      window.removeEventListener("keyup", block, true);
    };
  }, [onClose]);

  // When the on-screen keyboard opens on a short landscape phone, keep the
  // Save / Skip buttons scrolled into view.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      panelRef.current?.scrollIntoView({ block: "center" });
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  async function save() {
    const f = first.trim();
    const i = initial.trim().slice(0, 1).toUpperCase();
    if (!f) {
      setErr("ENTER FIRST NAME");
      firstRef.current?.focus();
      return;
    }
    if (!i) {
      setErr("ENTER LAST INITIAL");
      initialRef.current?.focus();
      return;
    }
    setErr(null);
    setSaving(true);
    try {
      await submitScore({
        data: {
          displayName: `${f.slice(0, 12)} ${i}.`,
          score,
          durationMs: Math.max(1, result.durationMs),
          mode: "after" as const,
        },
      });
    } catch (e) {
      setSaving(false);
      const msg = e instanceof Error ? e.message : "";
      setErr(
        /wait a few seconds/i.test(msg)
          ? "WAIT A MOMENT — PRESS SAVE AGAIN"
          : msg
            ? msg.toUpperCase().slice(0, 48)
            : "COULD NOT SAVE — TRY AGAIN",
      );
      return;
    }

    setSaving(false);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ first: f, initial: i }));
    } catch {
      // ignore
    }
    setSaved(true);
    qc.invalidateQueries({ queryKey: ["game_scores"] });
  }

  const secs = Math.round(result.durationMs / 1000);
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  const speedBonus = result.timeBonus ?? 0;
  const stats =
    `ZONE ${result.farthestZone + 1}/8 · DOCS ${result.docs}/3 · TIME ${clock}` +
    (speedBonus > 0 ? ` · SPEED +${speedBonus.toLocaleString()}` : "");

  const scale = Math.max(0.62, Math.min(1.35, uiScale));

  return (
    <div
      className="absolute inset-0 z-50 overflow-y-auto"
      style={{
        background: "rgba(6,12,28,0.86)",
        touchAction: "manipulation",
        padding: [
          "calc(env(safe-area-inset-top, 0px) + 8px)",
          "calc(env(safe-area-inset-right, 0px) + 8px)",
          "calc(env(safe-area-inset-bottom, 0px) + 16px)",
          "calc(env(safe-area-inset-left, 0px) + 8px)",
        ].join(" "),
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex min-h-full w-full items-center justify-center">
        <div
          ref={panelRef}
          className="w-full max-w-md border-[5px] bg-mn-blue px-4 py-4 text-center"
          style={{
            borderColor: "var(--color-cream)",
            imageRendering: "pixelated",
            boxShadow:
              "0 0 0 5px var(--color-mn-blue), 0 0 0 10px var(--color-accent-gold), 0 0 0 15px var(--color-mn-blue)",
            fontFamily: PIXEL_FONT,
            transform: `scale(${scale})`,
            transformOrigin: "center",
          }}
        >
          <p
            className="text-[10px] tracking-widest"
            style={{
              color: isHighScore ? "var(--color-accent-gold)" : "var(--color-cream)",
              textShadow: "1px 1px 0 #000",
            }}
          >
            {isHighScore ? "★ NEW HIGH SCORE ★" : "RUN COMPLETE"}
          </p>
          <p
            className="mt-2 text-[18px]"
            style={{ color: "var(--color-cream)", textShadow: "2px 2px 0 #000" }}
          >
            {score.toLocaleString()}
          </p>
          <p className="mt-1 text-[7px] tracking-wider" style={{ color: "rgba(255,255,255,0.7)" }}>
            {stats}
          </p>
          <p
            className="mt-2 text-[8px] tracking-widest"
            style={{ color: "var(--color-accent-gold)", textShadow: "1px 1px 0 #000" }}
          >
            ★ TOP 3 SCORES WIN A PRIZE ★
          </p>

          {saved ? (
            <>
              <p
                className="mt-5 mb-2 text-[10px] tracking-widest"
                style={{ color: "var(--color-accent-gold)", textShadow: "1px 1px 0 #000" }}
              >
                SCORE SAVED!
              </p>
              <div className="mt-2 flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onRestart?.();
                  }}
                  className="min-h-[44px] border-4 px-5 py-3 text-[9px] tracking-widest"
                  style={{
                    fontFamily: PIXEL_FONT,
                    color: "var(--color-mn-blue)",
                    background: "var(--color-cream)",
                    borderColor: "var(--color-accent-gold)",
                    touchAction: "manipulation",
                  }}
                >
                  ⟳ PLAY AGAIN
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onClose();
                  }}
                  className="min-h-[44px] border-4 px-5 py-3 text-[9px] tracking-widest"
                  style={{
                    fontFamily: PIXEL_FONT,
                    color: "var(--color-cream)",
                    background: "rgba(0,0,0,0.35)",
                    borderColor: "rgba(255,255,255,0.5)",
                    textShadow: "1px 1px 0 #000",
                    touchAction: "manipulation",
                  }}
                >
                  TITLE SCREEN
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mt-4 flex flex-col items-center gap-3">
                <label className="flex w-full flex-col items-center gap-1">
                  <span
                    className="text-[7px] tracking-widest"
                    style={{ color: "var(--color-accent-gold)" }}
                  >
                    FIRST NAME
                  </span>
                  <input
                    ref={firstRef}
                    value={first}
                    inputMode="text"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="next"
                    maxLength={12}
                    aria-label="First name"
                    placeholder="NAME"
                    onChange={(e) =>
                      setFirst(
                        e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z '-]/g, "")
                          .slice(0, 12),
                      )
                    }
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") {
                        e.preventDefault();
                        initialRef.current?.focus();
                      }
                    }}
                    onKeyUp={(e) => e.stopPropagation()}
                    className="h-11 w-full max-w-[280px] border-[3px] px-2 text-center text-[11px] outline-none"
                    style={fieldStyle}
                  />
                </label>
                <label className="flex flex-col items-center gap-1">
                  <span
                    className="text-[7px] tracking-widest"
                    style={{ color: "var(--color-accent-gold)" }}
                  >
                    LAST INITIAL
                  </span>
                  <input
                    ref={initialRef}
                    value={initial}
                    inputMode="text"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="done"
                    maxLength={1}
                    aria-label="Last initial"
                    placeholder="X"
                    onChange={(e) =>
                      setInitial(
                        e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z]/g, "")
                          .slice(0, 1),
                      )
                    }
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void save();
                      }
                    }}
                    onKeyUp={(e) => e.stopPropagation()}
                    className="h-11 w-14 border-[3px] px-1 text-center text-[13px] outline-none"
                    style={fieldStyle}
                  />
                </label>
              </div>

              {err && (
                <p className="mt-3 text-[7px] tracking-widest" style={{ color: "#ff8a8a" }}>
                  {err}
                </p>
              )}

              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={(e) => {
                    e.preventDefault();
                    void save();
                  }}
                  className="min-h-[44px] border-4 px-5 py-3 text-[9px] tracking-widest disabled:opacity-60"
                  style={{
                    fontFamily: PIXEL_FONT,
                    color: "var(--color-cream)",
                    background: "var(--color-mn-green)",
                    borderColor: "var(--color-accent-gold)",
                    textShadow: "1px 1px 0 #000",
                    touchAction: "manipulation",
                  }}
                >
                  {saving ? "SAVING…" : "SAVE"}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onClose();
                  }}
                  className="min-h-[44px] border-4 px-5 py-3 text-[9px] tracking-widest"
                  style={{
                    fontFamily: PIXEL_FONT,
                    color: "var(--color-cream)",
                    background: "rgba(0,0,0,0.35)",
                    borderColor: "rgba(255,255,255,0.5)",
                    textShadow: "1px 1px 0 #000",
                    touchAction: "manipulation",
                  }}
                >
                  SKIP
                </button>
              </div>
              <div className="mt-3 flex items-center justify-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onRestart?.();
                  }}
                  className="min-h-[44px] border-4 px-5 py-3 text-[9px] tracking-widest"
                  style={{
                    fontFamily: PIXEL_FONT,
                    color: "var(--color-mn-blue)",
                    background: "var(--color-cream)",
                    borderColor: "var(--color-accent-gold)",
                    touchAction: "manipulation",
                  }}
                >
                  ⟳ PLAY AGAIN
                </button>
              </div>
            </>
          )}

          <Link
            to="/feedback"
            className="mt-5 inline-flex min-h-[44px] items-center justify-center border-4 px-4 py-3 text-[8px] leading-relaxed tracking-widest"
            style={{
              fontFamily: PIXEL_FONT,
              color: "var(--color-mn-blue)",
              background: "var(--color-accent-gold)",
              borderColor: "var(--color-cream)",
              touchAction: "manipulation",
            }}
            onPointerUp={(e) => e.stopPropagation()}
          >
            ✎ TELL US WHAT TO FIX →
          </Link>
        </div>
      </div>
    </div>
  );
}
