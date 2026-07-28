// 16-bit vote panel shown inside the game canvas after a run ends.
// Casts into the same round as the page-level panel (same fingerprint), so a
// person gets exactly one vote per round no matter where they cast it.
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { activeRoundQuery, improvementsQuery, myRoundVoteQuery } from "@/lib/game.queries";
import { castRoundVote as castRoundVoteFn } from "@/lib/game.functions";
import { getVoterId } from "@/lib/voter";

const PIXEL_FONT = '"Press Start 2P", ui-monospace, monospace';

export function VoteOverlay({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const castVote = useServerFn(castRoundVoteFn);
  const [voterId, setVoterId] = useState("");
  useEffect(() => setVoterId(getVoterId()), []);

  const { data: round, isLoading: roundLoading } = useQuery(activeRoundQuery);
  const { data: improvements = [] } = useQuery(improvementsQuery);
  const { data: myVote } = useQuery(myRoundVoteQuery(voterId, round?.id ?? null));

  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Only options that haven't shipped yet are votable.
  const options = useMemo(() => {
    const enabled = new Set(improvements.filter((i) => i.enabled).map((i) => i.key));
    return (round?.candidates ?? []).filter((c) => !enabled.has(c.key as never));
  }, [round, improvements]);

  const votedLabel = useMemo(
    () => round?.candidates.find((c) => c.key === myVote)?.label ?? null,
    [round, myVote],
  );

  const canPick = !!round && !myVote && options.length > 0 && !busy;

  async function cast(key: string) {
    if (!canPick || !voterId) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await castVote({ data: { improvementKey: key, voterFingerprint: voterId } });
      if (!res.ok) {
        setMsg((res.message ?? "VOTE REJECTED").toUpperCase());
      } else {
        setMsg("VOTE COUNTED!");
        qc.invalidateQueries({ queryKey: ["game_round"] });
        qc.invalidateQueries({ queryKey: ["game_improvements"] });
        setTimeout(() => closeRef.current(), 1400);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "VOTE FAILED");
    } finally {
      setBusy(false);
    }
  }

  // Keyboard: arrows highlight, Enter votes. Swallow the game's R restart key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === "ArrowDown" || k === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        setCursor((c) => (options.length ? (c + 1) % options.length : 0));
      } else if (k === "ArrowUp" || k === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        setCursor((c) => (options.length ? (c - 1 + options.length) % options.length : 0));
      } else if (k === "Enter" || k === " ") {
        e.preventDefault();
        e.stopPropagation();
        const opt = options[cursor];
        if (opt) void cast(opt.key);
      } else if (k === "Escape" || k.toLowerCase() === "r") {
        e.preventDefault();
        e.stopPropagation();
        closeRef.current();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, cursor, canPick, voterId]);

  const noRound = !roundLoading && (!round || options.length === 0);

  return (
    <div
      className="absolute inset-0 z-50 grid place-items-center overflow-y-auto p-3"
      style={{ background: "rgba(6,12,28,0.9)", touchAction: "manipulation" }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="w-full max-w-lg border-[5px] bg-mn-blue px-3 py-4 text-center"
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
          style={{ color: "var(--color-accent-gold)", textShadow: "1px 1px 0 #000" }}
        >
          ★ VOTE: WHAT SHOULD WE FIX? ★
        </p>

        {roundLoading ? (
          <p className="mt-6 mb-4 text-[8px]" style={{ color: "var(--color-cream)" }}>
            LOADING…
          </p>
        ) : noRound ? (
          <p className="mt-5 mb-2 text-[8px] leading-relaxed" style={{ color: "var(--color-cream)" }}>
            NO VOTE OPEN RIGHT NOW.
          </p>
        ) : myVote ? (
          <p
            className="mt-5 mb-2 text-[8px] leading-relaxed"
            style={{ color: "var(--color-accent-gold)", textShadow: "1px 1px 0 #000" }}
          >
            YOU VOTED: {votedLabel?.toUpperCase()}
          </p>
        ) : (
          <>
            <ul className="mt-4 flex flex-col gap-2">
              {options.map((o, i) => {
                const active = i === cursor;
                return (
                  <li key={o.key}>
                    <button
                      type="button"
                      disabled={busy}
                      onPointerEnter={() => setCursor(i)}
                      onPointerUp={(e) => {
                        e.preventDefault();
                        setCursor(i);
                        void cast(o.key);
                      }}
                      className="flex min-h-[46px] w-full items-start gap-2 border-4 px-2 py-2 text-left disabled:opacity-60"
                      style={{
                        borderColor: active ? "var(--color-accent-gold)" : "rgba(255,255,255,0.35)",
                        background: active ? "rgba(255,220,90,0.18)" : "rgba(0,0,0,0.3)",
                        touchAction: "manipulation",
                      }}
                    >
                      <span
                        className="text-[9px]"
                        style={{ color: "var(--color-accent-gold)", width: 14 }}
                      >
                        {active ? "▶" : " "}
                      </span>
                      <span className="flex-1">
                        <span
                          className="block text-[8px] leading-relaxed"
                          style={{ color: "var(--color-cream)", textShadow: "1px 1px 0 #000" }}
                        >
                          {o.label.toUpperCase()}
                        </span>
                        {o.description && (
                          <span
                            className="mt-1 block text-[7px] leading-relaxed"
                            style={{ color: "rgba(255,255,255,0.8)", textShadow: "1px 1px 0 #000" }}
                          >
                            {o.description.toUpperCase()}
                          </span>
                        )}
                      </span>
                      <span
                        className="text-[9px] tabular-nums"
                        style={{ color: "var(--color-accent-gold)" }}
                      >
                        {o.votes}
                      </span>

                    </button>
                  </li>
                );
              })}
            </ul>
            <p
              className="mt-3 text-[7px] leading-relaxed"
              style={{ color: "rgba(255,255,255,0.75)" }}
            >
              ARROWS TO HIGHLIGHT · PRESS ENTER TO VOTE
              <br />
              (OR TAP AN OPTION)
            </p>
          </>
        )}

        {msg && (
          <p className="mt-3 text-[8px] tracking-widest" style={{ color: "var(--color-accent-gold)" }}>
            {msg}
          </p>
        )}

        <button
          type="button"
          onPointerUp={(e) => {
            e.preventDefault();
            onClose();
          }}
          className="mt-5 min-h-[44px] border-4 px-4 py-2 text-[9px] tracking-widest"
          style={{
            fontFamily: PIXEL_FONT,
            color: "var(--color-cream)",
            background: "rgba(0,0,0,0.35)",
            borderColor: "rgba(255,255,255,0.5)",
            textShadow: "1px 1px 0 #000",
            touchAction: "manipulation",
          }}
        >
          {myVote || noRound ? "CONTINUE" : "SKIP VOTE"}
        </button>
      </div>
    </div>
  );
}
