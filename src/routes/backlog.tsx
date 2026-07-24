import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";
import { BackToTop } from "@/components/back-to-top";
import {
  feedbackListQuery,
  votesListQuery,
  myVotesQuery,
  nowBuildingQuery,
  versionsQuery,
  type Feedback,
} from "@/lib/queries";
import { NowBuildingBanner } from "@/components/now-building-banner";
import { castVote, removeVote, type VoteBucket } from "@/lib/mutations";
import { getVoterId, MAX_VOTES_PER_ATTENDEE } from "@/lib/voter";
import { supabase } from "@/integrations/supabase/client";


type RankChange = { delta: number; isNew: boolean; at: number };

export const Route = createFileRoute("/backlog")({
  head: () => ({
    meta: [
      { title: "Backlog — [Your State] DHS Navigator" },
      {
        name: "description",
        content:
          "Live backlog of attendee ideas. Vote Must Have, Should Have, or Nice to Have. You have 5 votes total — stack them all on one item to push it higher, or spread across up to 5 different items.",
      },
      { property: "og:title", content: "Backlog — [Your State] DHS Navigator" },
      { property: "og:description", content: "Vote on live attendee ideas and watch them ship." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(feedbackListQuery);
    context.queryClient.ensureQueryData(votesListQuery);
    context.queryClient.ensureQueryData(nowBuildingQuery);
    context.queryClient.ensureQueryData(versionsQuery);
  },
  component: BacklogPage,
});

const BUCKET_WEIGHT: Record<VoteBucket, number> = { must: 3, should: 2, could: 1 };
const COLLAPSE_THRESHOLD = 280;

type VoteAgg = {
  total: number;
  weighted: number;
  must: number;
  should: number;
  could: number;
  mineMust: number;
  mineShould: number;
  mineCould: number;
  myBucket: VoteBucket | null;
};

function BacklogPage() {
  const { data: feedback } = useSuspenseQuery(feedbackListQuery);
  const { data: votes } = useSuspenseQuery(votesListQuery);
  const { data: nowBuilding } = useSuspenseQuery(nowBuildingQuery);
  const { data: versions } = useSuspenseQuery(versionsQuery);
  const qc = useQueryClient();
  const [voterId, setVoterId] = useState("");

  useEffect(() => {
    setVoterId(getVoterId());
  }, []);

  // My own votes (fetched separately with a fingerprint filter — voter_fingerprint
  // is not publicly readable, so we can't derive this from the aggregate list).
  const { data: myVoteRows = [] } = useSuspenseQuery(myVotesQuery(voterId));

  useEffect(() => {
    const channel = supabase
      .channel("backlog")
      .on("postgres_changes", { event: "*", schema: "public", table: "feedback" }, () => {
        qc.invalidateQueries({ queryKey: ["feedback"] });
        qc.invalidateQueries({ queryKey: ["now_building"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, () =>
        qc.invalidateQueries({ queryKey: ["votes"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const current = versions.find((v) => v.is_current) ?? versions[versions.length - 1];

  const myBucketByFeedback = useMemo(() => {
    const m = new Map<string, { must: number; should: number; could: number; last: VoteBucket | null }>();
    for (const v of myVoteRows) {
      const prev = m.get(v.feedback_id) ?? { must: 0, should: 0, could: 0, last: null };
      prev[v.bucket] = (prev[v.bucket] ?? 0) + 1;
      prev.last = v.bucket;
      m.set(v.feedback_id, prev);
    }
    return m;
  }, [myVoteRows]);

  const voteAgg = useMemo(() => {
    const m = new Map<string, VoteAgg>();
    for (const v of votes) {
      const prev: VoteAgg = m.get(v.feedback_id) ?? {
        total: 0, weighted: 0, must: 0, should: 0, could: 0,
        mineMust: 0, mineShould: 0, mineCould: 0, myBucket: null,
      };
      prev.total += 1;
      prev.weighted += BUCKET_WEIGHT[v.bucket] ?? 1;
      prev[v.bucket] = (prev[v.bucket] ?? 0) + 1;
      m.set(v.feedback_id, prev);
    }
    for (const [feedbackId, mine] of myBucketByFeedback) {
      const prev = m.get(feedbackId);
      if (!prev) continue;
      prev.mineMust = mine.must;
      prev.mineShould = mine.should;
      prev.mineCould = mine.could;
      prev.myBucket = mine.last;
    }
    return m;
  }, [votes, myBucketByFeedback]);

  const votesRemaining = Math.max(0, MAX_VOTES_PER_ATTENDEE - myVoteRows.length);

  const [shippedCollapsed, setShippedCollapsed] = useState(true);


  const buckets = useMemo(() => {
    const sortByWeighted = (a: Feedback, b: Feedback) =>
      (voteAgg.get(b.id)?.weighted ?? 0) - (voteAgg.get(a.id)?.weighted ?? 0);
    const newItems = [...feedback].filter((f) => f.status === "new").sort(sortByWeighted);
    const plannedItems = [...feedback]
      .filter((f) => f.status === "planned")
      .sort(sortByWeighted);
    const buildingItems = [...feedback]
      .filter((f) => f.status === "in_progress")
      .sort(sortByWeighted);
    const shippedItems = [...feedback]
      .filter((f) => f.status === "shipped")
      .sort((a, b) => {
        const at = a.shipped_at ? new Date(a.shipped_at).getTime() : 0;
        const bt = b.shipped_at ? new Date(b.shipped_at).getTime() : 0;
        return bt - at;
      });
    return { newItems, plannedItems, buildingItems, shippedItems };
  }, [feedback, voteAgg]);

  // Track rank changes in the New section so reorders are visually obvious.
  const prevRanksRef = useRef<Map<string, number>>(new Map());
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const [rankChanges, setRankChanges] = useState<Map<string, RankChange>>(new Map());
  const [lastChange, setLastChange] = useState<
    { wish: string; toRank: number; delta: number; isNew: boolean; at: number } | null
  >(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  useEffect(() => {
    const items = buckets.newItems;
    const nextRanks = new Map<string, number>();
    items.forEach((f, i) => nextRanks.set(f.id, i + 1));

    // First render: seed baseline, don't flag everything as new.
    if (!initializedRef.current) {
      prevRanksRef.current = nextRanks;
      items.forEach((f) => seenIdsRef.current.add(f.id));
      initializedRef.current = true;
      return;
    }

    const prev = prevRanksRef.current;
    const changes = new Map<string, RankChange>();
    let latest: typeof lastChange = null;
    const now = Date.now();

    items.forEach((f, i) => {
      const newRank = i + 1;
      const wasSeen = seenIdsRef.current.has(f.id);
      if (!wasSeen) {
        changes.set(f.id, { delta: 0, isNew: true, at: now });
        latest = { wish: f.wish, toRank: newRank, delta: 0, isNew: true, at: now };
        seenIdsRef.current.add(f.id);
        return;
      }
      const prevRank = prev.get(f.id);
      if (prevRank && prevRank !== newRank) {
        const delta = prevRank - newRank; // positive = moved up
        changes.set(f.id, { delta, isNew: false, at: now });
        latest = { wish: f.wish, toRank: newRank, delta, isNew: false, at: now };
      }
    });

    prevRanksRef.current = nextRanks;

    if (changes.size === 0) return;

    setRankChanges((current) => {
      const merged = new Map(current);
      changes.forEach((v, k) => merged.set(k, v));
      return merged;
    });
    if (latest) setLastChange(latest);

    const badgeTimer = setTimeout(() => {
      setRankChanges((current) => {
        const next = new Map(current);
        changes.forEach((_, k) => {
          const entry = next.get(k);
          if (entry && entry.at === now) next.delete(k);
        });
        return next;
      });
    }, 4500);
    const tickerTimer = setTimeout(() => {
      setLastChange((current) => (current && current.at === now ? null : current));
    }, 10000);
    return () => {
      clearTimeout(badgeTimer);
      clearTimeout(tickerTimer);
    };
  }, [buckets.newItems]);

  useEffect(() => {
    if (!flashId) return;
    const t = setTimeout(() => setFlashId(null), 1200);
    return () => clearTimeout(t);
  }, [flashId]);


  async function handleVote(id: string, bucket: VoteBucket) {
    if (votesRemaining === 0) {
      toast.error("You've used all 5 votes. Click a vote to give it back.");
      return;
    }
    const result = await castVote(id, bucket);
    if (!result.ok) {
      if (result.reason === "bucket_locked") {
        toast.error(
          `You already chose ${bucketLabel(result.lockedBucket ?? "should")} for this item. Remove that vote first to switch.`,
        );
      } else if (result.reason === "locked") {
        toast.error("Voting closed — this idea is already locked in.");
        qc.invalidateQueries({ queryKey: ["feedback"] });
      } else {
        toast.error("You've used all 5 votes.");
      }
      return;
    }
    toast.success(`Vote counted — ${bucketLabel(bucket)}.`);
    setFlashId(id);
    qc.invalidateQueries({ queryKey: ["votes"] });
  }

  async function handleUnvote(id: string, bucket: VoteBucket) {
    const result = await removeVote(id, bucket);
    if (!result.ok) {
      toast.error("Nothing to remove.");
      return;
    }
    toast.success("Vote refunded.");
    qc.invalidateQueries({ queryKey: ["votes"] });
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-dark-gray">
      <SiteChrome />
      <main id="main-content" className="max-w-6xl w-full mx-auto py-12 px-6 flex-1">
        <header className="mb-6">
          <div className="flex flex-wrap items-center justify-between border-b-2 border-mn-blue pb-4 gap-4">
            <div>
              <h1 className="font-display text-3xl md:text-4xl text-mn-blue uppercase tracking-wide">
                Backlog
              </h1>
              <p className="text-dark-gray/70 mt-2 max-w-2xl">
                Every attendee idea, live. Voting happens in <span className="font-bold">New</span> — you have {MAX_VOTES_PER_ATTENDEE} votes total,
                stack them on one item or spread across many. Once the team locks an idea into <span className="font-bold">Planned</span>,
                voting closes and it's queued to ship.

              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="inline-flex items-center gap-3 bg-accent-gold/20 border border-accent-gold/60 px-4 py-2 rounded-full">
                <span className="text-[10px] font-bold uppercase tracking-widest text-mn-blue">Votes remaining</span>
                <span className="text-2xl font-black text-mn-blue tabular-nums">
                  {votesRemaining}/{MAX_VOTES_PER_ATTENDEE}
                </span>
              </div>
              {current && (
                <p className="text-[10px] font-bold text-dark-gray/60 uppercase tracking-widest">
                  Live: <span className="text-mn-green">v{current.semver}</span>
                </p>
              )}
            </div>
          </div>
        </header>

        <nav
          aria-label="Jump to backlog status"
          className="sticky top-0 z-20 -mx-6 px-6 py-3 mb-8 bg-white/95 backdrop-blur border-b border-light-gray"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-dark-gray/70 mb-2">
            Jump to status — tap a pill to skip ahead
          </p>
          <div className="flex flex-wrap gap-2">
            <SubNavPill href="#new" label="New" count={buckets.newItems.length} color="bg-light-gray text-dark-gray" />
            <SubNavPill href="#planned" label="Planned" count={buckets.plannedItems.length} color="bg-accent-gold/40 text-mn-blue" />
            <SubNavPill href="#building" label="In-Progress" count={buckets.buildingItems.length} color="bg-accent-teal text-white" />
            <SubNavPill href="#implemented" label="Implemented" count={buckets.shippedItems.length} color="bg-mn-green text-white" />
          </div>
        </nav>


        <h2 className="font-display text-2xl md:text-3xl text-mn-blue uppercase tracking-wide border-b-2 border-mn-blue pb-2 mb-4">
          In-Progress
        </h2>

        <NowBuildingBanner items={nowBuilding} variant="backlog" />

        <h2 className="font-display text-2xl md:text-3xl text-mn-blue uppercase tracking-wide border-b-2 border-mn-blue pb-2 mt-12 mb-4">
          Backlog
        </h2>





        <StatusSection
          id="new"
          title="New"
          subtitle="Vote here to push ideas up. Highest-voted rise to the top — the team locks them in from here."
          badge="🆕"
          wrapper="bg-light-gray/20 border-2 border-light-gray"
          headerColor="text-dark-gray"
          items={buckets.newItems}
          voteAgg={voteAgg}
          votesRemaining={votesRemaining}
          onVote={handleVote}
          onUnvote={handleUnvote}
          showRank
          rankChanges={rankChanges}
          flashId={flashId}
          lastChange={lastChange}
        />


        <StatusSection
          id="planned"
          title="Planned — Next Up"
          subtitle="Voted up by attendees and locked in by the team. These are the ideas queued to be built into the live Demo Client Tool next."
          badge="📋"
          wrapper="bg-accent-gold/10 border-2 border-accent-gold"
          headerColor="text-mn-blue"
          items={buckets.plannedItems}
          voteAgg={voteAgg}
          votesRemaining={votesRemaining}
          onVote={handleVote}
          onUnvote={handleUnvote}
          readOnly
          collapsible
          defaultCollapsed
        />


        <StatusSection
          id="building"
          title="In-Progress Items"
          subtitle="Being built right now. These are the next improvements the Demo Client Tool will have once they're pushed live."
          badge="🛠️"
          wrapper="bg-accent-teal/10 border-2 border-accent-teal"
          headerColor="text-accent-teal"
          items={buckets.buildingItems}
          voteAgg={voteAgg}
          votesRemaining={votesRemaining}
          onVote={handleVote}
          onUnvote={handleUnvote}
          readOnly
          collapsible
          defaultCollapsed
        />



        <section id="implemented" className="mt-10 rounded-2xl border-2 border-mn-green bg-mn-green/5 p-6">
          <div className="flex items-end justify-between mb-4 border-b border-mn-green/30 pb-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <h2 className="font-display text-xl text-mn-green uppercase tracking-wide">
                  Implemented
                </h2>
                <p className="text-sm text-dark-gray/70 mt-1">
                  Shipped live during this session. Refresh the tool to see them.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-black text-mn-green tabular-nums">{buckets.shippedItems.length}</span>
              <button
                type="button"
                onClick={() => setShippedCollapsed((v) => !v)}
                aria-expanded={!shippedCollapsed}
                aria-controls="implemented-list"
                className="text-xs font-bold uppercase tracking-widest text-mn-green border-2 border-mn-green rounded-full px-3 py-1 hover:bg-mn-green hover:text-white transition"
              >
                {shippedCollapsed ? "Show" : "Hide"}
              </button>
            </div>
          </div>
          {shippedCollapsed ? null : buckets.shippedItems.length === 0 ? (
            <p className="text-sm text-dark-gray/60 italic py-6 text-center">
              Nothing shipped yet — vote on ideas above to help pick what's next.
            </p>
          ) : (
            <ul className="space-y-3">
              {buckets.shippedItems.map((f) => (
                <li key={f.id} className="bg-white border border-mn-green/30 rounded-lg p-4 flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <CollapsibleWish wish={f.wish} />
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-dark-gray/60">
                      {f.role && <span>{f.role}</span>}
                      {f.organization && <span>· {f.organization}</span>}
                      {f.state && <span>· {f.state}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-mn-green text-white px-2 py-1 rounded">
                      Shipped
                    </span>
                    {f.shipped_at && (
                      <p className="text-[11px] text-dark-gray/60 mt-1 tabular-nums">
                        {new Date(f.shipped_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                    {f.shipped_at && (
                      <p className="text-[11px] text-mn-green font-bold mt-0.5">
                        {formatElapsed(f.created_at, f.shipped_at)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <SiteFooter />
      <BackToTop />

    </div>
  );
}

function SubNavPill({ href, label, count, color }: { href: string; label: string; count: number; color: string }) {
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest ${color} hover:brightness-95 transition`}
    >
      {label}
      <span className="tabular-nums bg-black/10 rounded-full px-2 py-0.5 text-[11px]">{count}</span>
    </a>
  );
}

function CollapsibleWish({ wish }: { wish: string }) {
  const [open, setOpen] = useState(false);
  const long = wish.length > COLLAPSE_THRESHOLD;
  const shown = !long || open ? wish : wish.slice(0, COLLAPSE_THRESHOLD).trimEnd() + "…";
  return (
    <div>
      <p className="font-bold text-mn-blue leading-snug whitespace-pre-wrap">"{shown}"</p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1 text-xs font-bold text-accent-teal hover:underline"
        >
          {open ? "Show less" : `Show more (${wish.length - COLLAPSE_THRESHOLD} more chars)`}
        </button>
      )}
    </div>
  );
}

function StatusSection({
  id,
  title,
  subtitle,
  badge,
  wrapper,
  headerColor,
  items,
  voteAgg,
  votesRemaining,
  onVote,
  onUnvote,
  readOnly = false,
  showRank = false,
  rankChanges,
  flashId,
  lastChange,
  collapsible = false,
  defaultCollapsed = false,
}: {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  wrapper: string;
  headerColor: string;
  items: Feedback[];
  voteAgg: Map<string, VoteAgg>;
  votesRemaining: number;
  onVote: (id: string, bucket: VoteBucket) => void;
  onUnvote: (id: string, bucket: VoteBucket) => void;
  readOnly?: boolean;
  showRank?: boolean;
  rankChanges?: Map<string, RankChange>;
  flashId?: string | null;
  lastChange?: { wish: string; toRank: number; delta: number; isNew: boolean; at: number } | null;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const isCollapsed = collapsible && collapsed;
  return (
    <section id={id} className={`mb-8 rounded-2xl p-6 ${wrapper}`}>
      <div className="mb-4 flex items-end justify-between border-b border-dark-gray/10 pb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{badge}</span>
          <div>
            <h2 className={`font-display text-xl uppercase tracking-wide ${headerColor}`}>{title}</h2>
            <p className="text-sm text-dark-gray/60 mt-1">{subtitle}</p>
            {showRank && lastChange && (
              <p className="mt-2 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-mn-blue bg-white/80 border border-mn-blue/30 rounded-full px-3 py-1 animate-fade-in">
                {lastChange.isNew ? (
                  <>
                    <span className="text-accent-gold">NEW</span>
                    <span className="normal-case tracking-normal text-dark-gray/80 font-normal truncate max-w-[22rem]">
                      "{lastChange.wish}" just landed at #{lastChange.toRank}
                    </span>
                  </>
                ) : (
                  <>
                    <span className={lastChange.delta > 0 ? "text-mn-green" : "text-red-600"}>
                      {lastChange.delta > 0 ? `▲ ${lastChange.delta}` : `▼ ${Math.abs(lastChange.delta)}`}
                    </span>
                    <span className="normal-case tracking-normal text-dark-gray/80 font-normal truncate max-w-[22rem]">
                      "{lastChange.wish}" moved to #{lastChange.toRank}
                    </span>
                  </>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-3xl font-black tabular-nums ${headerColor}`}>{items.length}</span>
          {collapsible && (
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              aria-expanded={!isCollapsed}
              aria-controls={`${id}-list`}
              className="text-xs font-bold uppercase tracking-widest text-mn-blue border-2 border-mn-blue rounded-full px-3 py-1 hover:bg-mn-blue hover:text-white transition"
            >
              {isCollapsed ? "Show" : "Hide"}
            </button>
          )}
        </div>
      </div>
      {isCollapsed ? null : items.length === 0 ? (
        <p className="text-sm text-dark-gray/50 italic py-8 text-center border border-dashed border-light-gray rounded-xl bg-white/60">
          Nothing here yet.
        </p>
      ) : (
        <ul id={`${id}-list`} className="space-y-3">
          <AnimatePresence initial={false}>
            {items.map((f, i) => {
              const agg = voteAgg.get(f.id) ?? {
                total: 0, weighted: 0, must: 0, should: 0, could: 0,
                mineMust: 0, mineShould: 0, mineCould: 0, myBucket: null,
              };
              const change = rankChanges?.get(f.id);
              const isFlashing = flashId === f.id;
              const rank = i + 1;
              const borderClass = isFlashing
                ? "border-accent-gold ring-4 ring-accent-gold/40"
                : change && !change.isNew && change.delta !== 0
                  ? change.delta > 0
                    ? "border-mn-green"
                    : "border-red-400"
                  : change?.isNew
                    ? "border-accent-gold"
                    : i === 0 && agg.total > 0
                      ? "border-mn-green"
                      : "border-light-gray";
              return (
                <motion.li
                  key={f.id}
                  layout={showRank ? true : false}
                  initial={showRank ? { opacity: 0, y: -8 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  exit={showRank ? { opacity: 0, scale: 0.96 } : undefined}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className={`bg-white border-2 rounded-xl p-4 transition-colors ${borderClass}`}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {showRank && (
                          <span className="text-[11px] font-black tabular-nums text-mn-blue bg-mn-blue/10 rounded px-1.5 py-0.5">
                            #{rank}
                          </span>
                        )}
                        {change && (
                          <span
                            className={`text-[10px] font-black uppercase tracking-widest rounded px-1.5 py-0.5 animate-fade-in ${
                              change.isNew
                                ? "bg-accent-gold text-mn-blue"
                                : change.delta > 0
                                  ? "bg-mn-green text-white"
                                  : "bg-red-500 text-white"
                            }`}
                          >
                            {change.isNew
                              ? "NEW"
                              : change.delta > 0
                                ? `▲ ${change.delta}`
                                : `▼ ${Math.abs(change.delta)}`}
                          </span>
                        )}
                      </div>
                      <CollapsibleWish wish={f.wish} />
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-dark-gray/60">
                        {f.role && <span>{f.role}</span>}
                        {f.organization && <span>· {f.organization}</span>}
                        {f.state && <span>· {f.state}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-2xl font-black text-mn-blue tabular-nums">▲ {agg.total}</div>
                      <div className="text-[10px] font-bold text-dark-gray/60 uppercase tracking-wider">votes</div>
                    </div>
                  </div>
                  {readOnly ? (
                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-light-gray text-xs font-bold tabular-nums">
                      <span className="text-[10px] uppercase tracking-widest text-dark-gray/60 mr-1">
                        Votes earned in New:
                      </span>
                      <span className="bg-mn-green text-white rounded px-2 py-1">Must {agg.must}</span>
                      <span className="bg-accent-teal text-white rounded px-2 py-1">Should {agg.should}</span>
                      <span className="bg-dark-gray text-white rounded px-2 py-1">Nice {agg.could}</span>
                      <span className="ml-auto text-[10px] uppercase tracking-widest text-mn-blue/70">
                        🔒 Locked in — voting closed
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2 pt-3 border-t border-light-gray">
                        <VoteButton
                          bucket="must"
                          count={agg.must}
                          myCount={agg.mineMust}
                          myBucket={agg.myBucket}
                          votesRemaining={votesRemaining}
                          onVote={() => onVote(f.id, "must")}
                          onUnvote={() => onUnvote(f.id, "must")}
                        />
                        <VoteButton
                          bucket="should"
                          count={agg.should}
                          myCount={agg.mineShould}
                          myBucket={agg.myBucket}
                          votesRemaining={votesRemaining}
                          onVote={() => onVote(f.id, "should")}
                          onUnvote={() => onUnvote(f.id, "should")}
                        />
                        <VoteButton
                          bucket="could"
                          count={agg.could}
                          myCount={agg.mineCould}
                          myBucket={agg.myBucket}
                          votesRemaining={votesRemaining}
                          onVote={() => onVote(f.id, "could")}
                          onUnvote={() => onUnvote(f.id, "could")}
                        />
                      </div>
                      {agg.myBucket && (
                        <p className="text-[11px] text-dark-gray/70 mt-2">
                          Your pick for this item: <span className="font-bold text-mn-blue">{bucketLabel(agg.myBucket)}</span> — click your bucket to add another vote, or click again to take one back.
                        </p>
                      )}
                    </>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}

function VoteButton({
  bucket,
  count,
  myCount,
  myBucket,
  votesRemaining,
  onVote,
  onUnvote,
}: {
  bucket: VoteBucket;
  count: number;
  myCount: number;
  myBucket: VoteBucket | null;
  votesRemaining: number;
  onVote: () => void;
  onUnvote: () => void;
}) {
  const styles: Record<VoteBucket, { base: string; label: string }> = {
    must: { base: "bg-mn-green text-white", label: "Must Have" },
    should: { base: "bg-accent-teal text-white", label: "Should Have" },
    could: { base: "bg-dark-gray text-white", label: "Nice to Have" },
  };
  const s = styles[bucket];

  const lockedOut = myBucket !== null && myBucket !== bucket;
  const isMine = myCount > 0;
  const cannotAddMore = !isMine && votesRemaining === 0;
  const disabled = lockedOut || (cannotAddMore && !isMine);

  const title = lockedOut
    ? `You chose ${bucketLabel(myBucket!)} for this item. Remove that vote to switch.`
    : cannotAddMore
      ? "No votes remaining"
      : isMine
        ? "Click to add another vote. Click your ⓧ badge to take one back."
        : "Cast a vote";

  return (
    <div className="flex-1 min-w-[110px] flex flex-col gap-1">
      <button
        type="button"
        onClick={onVote}
        disabled={disabled}
        title={title}
        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-bold transition ${s.base} ${
          disabled ? "opacity-40 cursor-not-allowed" : "hover:brightness-110"
        } ${isMine ? "ring-2 ring-mn-blue ring-offset-1" : ""}`}
      >
        <span>{s.label}</span>
        <span className="tabular-nums text-xs bg-black/20 rounded px-1.5 py-0.5">{count}</span>
      </button>
      {isMine && (
        <button
          type="button"
          onClick={onUnvote}
          title="Remove one of your votes"
          className="text-[11px] font-bold text-mn-blue bg-white border border-mn-blue/40 rounded px-2 py-0.5 hover:bg-mn-blue hover:text-white transition self-start"
        >
          Yours: {myCount} ✕ take back
        </button>
      )}
    </div>
  );
}

function bucketLabel(b: VoteBucket) {
  return b === "must" ? "Must Have" : b === "should" ? "Should Have" : "Nice to Have";
}

function formatElapsed(from: string, to: string) {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (Number.isNaN(ms) || ms < 0) return "";
  const min = Math.round(ms / 60000);
  if (min < 60) return `Shipped ${min} min after submission`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  if (h < 24) return `Shipped ${h}h ${rest}m after submission`;
  const d = Math.floor(h / 24);
  return `Shipped ${d}d ${h % 24}h after submission`;
}


