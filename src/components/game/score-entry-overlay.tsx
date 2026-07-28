// SNES-style in-canvas name entry shown the moment a run ends.
// Rendered on top of the game canvas (never below the game window) so the
// player can't miss that they scored.
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

function Slots({ value, len, focused }: { value: string; len: number; focused: boolean }) {
  const [blink, setBlink] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setBlink((b) => !b), 450);
    return () => clearInterval(t);
  }, []);
  const chars = Array.from({ length: len }, (_, i) => value[i] ?? "");
  const cursorAt = Math.min(value.length, len - 1);
  return (
    <div className="flex gap-[3px]">
      {chars.map((c, i) => {
        const isCursor = focused && blink && i === cursorAt && value.length < len + 1;
        return (
          <span
            key={i}
            className="grid h-6 w-[15px] place-items-center border-2 text-[10px]"
            style={{
              fontFamily: PIXEL_FONT,
              color: "var(--color-accent-gold)",
              background: isCursor ? "rgba(255,220,90,0.25)" : "rgba(10,20,45,0.9)",
              borderColor: focused ? "var(--color-accent-gold)" : "rgba(255,220,90,0.35)",
            }}
          >
            {c}
          </span>
        );
      })}
    </div>
  );
}

export function ScoreEntryOverlay({
  result,
  onClose,
}: {
  result: WinResult;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: top = [] } = useQuery(topScoresQuery);
  const [first, setFirst] = useState("");
  const [initial, setInitial] = useState("");
  const [field, setField] = useState<"first" | "initial">("first");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement | null>(null);
  const initialRef = useRef<HTMLInputElement | null>(null);

  const score = result.score;
  const isHighScore = top.length < 10 || score > (top[top.length - 1]?.score ?? 0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const j = JSON.parse(raw) as { first?: string; initial?: string };
        if (j.first) setFirst(j.first.toUpperCase().slice(0, 12));
        if (j.initial) setInitial(j.initial.toUpperCase().slice(0, 1));
      }
    } catch {
      // ignore
    }
    const t = setTimeout(() => firstRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  // Swallow game keys (R restarts the run) while the panel is open.
  useEffect(() => {
    const block = (e: KeyboardEvent) => {
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
    const { error } = await supabase.from("game_scores").insert({
      display_name: `${f.slice(0, 12)} ${i}.`,
      score,
      duration_ms: Math.max(1, result.durationMs),
      mode: result.mode,
    });
    setSaving(false);
    if (error) {
      setErr("COULD NOT SAVE — TRY AGAIN");
      return;
    }
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ first: f, initial: i }));
    } catch {
      // ignore
    }
    setSaved(true);
    qc.invalidateQueries({ queryKey: ["game_scores"] });
    setTimeout(onClose, 1400);
  }

  const secs = Math.round(result.durationMs / 1000);
  const stats = `ZONE ${result.farthestZone + 1}/8 · DOCS ${result.docs}/3 · ${secs}S`;

  return (
    <div
      className="absolute inset-0 z-50 grid place-items-center p-3"
      style={{ background: "rgba(6,12,28,0.86)", touchAction: "manipulation" }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="w-full max-w-md border-[5px] bg-mn-blue px-4 py-4 text-center"
        style={{
          borderColor: "var(--color-cream)",
          imageRendering: "pixelated",
          boxShadow:
            "0 0 0 5px var(--color-mn-blue), 0 0 0 10px var(--color-accent-gold), 0 0 0 15px var(--color-mn-blue)",
          fontFamily: PIXEL_FONT,
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

        {saved ? (
          <p
            className="mt-5 mb-2 text-[10px] tracking-widest"
            style={{ color: "var(--color-accent-gold)", textShadow: "1px 1px 0 #000" }}
          >
            SCORE SAVED!
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-col items-center gap-3">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[7px] tracking-widest" style={{ color: "var(--color-accent-gold)" }}>
                  FIRST NAME
                </span>
                <div onPointerUp={() => firstRef.current?.focus()}>
                  <Slots value={first} len={12} focused={field === "first"} />
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[7px] tracking-widest" style={{ color: "var(--color-accent-gold)" }}>
                  LAST INITIAL
                </span>
                <div onPointerUp={() => initialRef.current?.focus()}>
                  <Slots value={initial} len={1} focused={field === "initial"} />
                </div>
              </div>
            </div>

            {/* Hidden real inputs drive the pixel slots so phone + desktop keyboards work. */}
            <input
              ref={firstRef}
              value={first}
              inputMode="text"
              autoCapitalize="characters"
              aria-label="First name"
              onFocus={() => setField("first")}
              onChange={(e) => setFirst(e.target.value.toUpperCase().replace(/[^A-Z '-]/g, "").slice(0, 12))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  initialRef.current?.focus();
                }
              }}
              className="absolute h-px w-px opacity-0"
              style={{ left: -9999 }}
            />
            <input
              ref={initialRef}
              value={initial}
              inputMode="text"
              autoCapitalize="characters"
              aria-label="Last initial"
              onFocus={() => setField("initial")}
              onChange={(e) => setInitial(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 1))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void save();
                }
              }}
              className="absolute h-px w-px opacity-0"
              style={{ left: -9999 }}
            />

            {err && (
              <p className="mt-3 text-[7px] tracking-widest" style={{ color: "#ff8a8a" }}>
                {err}
              </p>
            )}

            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={saving}
                onPointerUp={(e) => {
                  e.preventDefault();
                  void save();
                }}
                className="border-4 px-4 py-2 text-[9px] tracking-widest disabled:opacity-60"
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
                onPointerUp={(e) => {
                  e.preventDefault();
                  onClose();
                }}
                className="border-4 px-4 py-2 text-[9px] tracking-widest"
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
          </>
        )}
      </div>
    </div>
  );
}
