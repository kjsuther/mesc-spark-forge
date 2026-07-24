import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";
import { feedbackListQuery, votesListQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { UsContributorMap, normalizeStateCode } from "@/components/us-contributor-map";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About this poster session — [Your State] DHS Navigator" },
      {
        name: "description",
        content:
          "How this MESC 2026 poster session works: attendee-driven rapid prototyping with responsible AI-assisted development.",
      },
      { property: "og:title", content: "About this poster session — [Your State] DHS Navigator" },
      {
        property: "og:description",
        content: "Attendee-driven rapid prototyping with responsible AI-assisted development.",
      },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(feedbackListQuery);
    context.queryClient.ensureQueryData(votesListQuery);
  },
  component: AboutPage,
});

function AboutPage() {
  const { data: feedback } = useSuspenseQuery(feedbackListQuery);
  const { data: votes } = useSuspenseQuery(votesListQuery);
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("about-impact")
      .on("postgres_changes", { event: "*", schema: "public", table: "feedback" }, () =>
        qc.invalidateQueries({ queryKey: ["feedback"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, () =>
        qc.invalidateQueries({ queryKey: ["votes"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const stats = useMemo(() => {
    const stateCodes = new Set<string>();
    for (const f of feedback) {
      const code = normalizeStateCode(f.state);
      if (code) stateCodes.add(code);
    }
    const roleCounts = new Map<string, number>();
    const roleDisplay = new Map<string, string>();
    for (const f of feedback) {
      const raw = f.role?.trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      roleCounts.set(key, (roleCounts.get(key) ?? 0) + 1);
      if (!roleDisplay.has(key)) roleDisplay.set(key, raw);
    }
    const roles = [...roleCounts.entries()]
      .map(([k, count]) => ({ label: roleDisplay.get(k) ?? k, count }))
      .sort((a, b) => b.count - a.count);
    const shipped = feedback.filter((f) => f.status === "shipped").length;
    return {
      totalFeedback: feedback.length,
      totalVotes: votes.length,
      stateCodes,
      states: stateCodes.size,
      roles,
      shipped,
    };
  }, [feedback, votes]);

  const [showStates, setShowStates] = useState(false);
  const [showRoles, setShowRoles] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-white text-dark-gray">
      <SiteChrome />
      <main id="main-content" className="max-w-5xl w-full mx-auto py-12 px-6 flex-1 space-y-16">
        <header>
          <p className="text-[10px] font-bold uppercase tracking-widest text-mn-green mb-2">
            MESC 2026 Poster Session
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-mn-blue tracking-tight mb-4">
            Trailblazing Medicaid, Live
          </h1>
          <p className="text-xl text-dark-gray/80 max-w-3xl">
            A working prototype co-created by conference attendees during the poster session.
            Ideas in, features out — in minutes, not months.
          </p>
        </header>

        {/* Impact Wall */}
        <section>
          <h2 className="font-display text-2xl text-mn-blue uppercase tracking-wide border-b-2 border-mn-blue pb-3 mb-2">
            Impact Wall
          </h2>
          <p className="text-dark-gray/70 mb-6 max-w-2xl">
            A live snapshot of how attendees are shaping this tool — ideas received, votes cast,
            and where feedback is coming from.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard bg="bg-mn-blue" fg="text-white" hint="text-sky-blue" label="Ideas Received" value={stats.totalFeedback} />
            <StatCard bg="bg-accent-teal" fg="text-white" hint="text-white/80" label="Total Votes" value={stats.totalVotes} />
            <StatCard bg="bg-mn-green" fg="text-white" hint="text-white/80" label="Ideas Shipped" value={stats.shipped} />
            <StatCard
              bg="bg-cream"
              fg="text-mn-blue"
              hint="text-mn-blue/60"
              label="States Contributing"
              value={stats.states}
              onClick={() => setShowStates((v) => !v)}
              active={showStates}
              hintSuffix={showStates ? "Hide map" : "Tap for map"}
            />
            <StatCard
              bg="bg-accent-gold/70"
              fg="text-mn-blue"
              hint="text-mn-blue/70"
              label="Roles Contributing"
              value={stats.roles.length}
              onClick={() => setShowRoles((v) => !v)}
              active={showRoles}
              hintSuffix={showRoles ? "Hide list" : "Tap for list"}
            />
          </div>

          {showStates && (
            <div className="mt-4 rounded-2xl border-2 border-cream bg-cream/40 p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black uppercase tracking-widest text-mn-blue">
                  Where feedback is coming from
                </h3>
                <button
                  type="button"
                  onClick={() => setShowStates(false)}
                  className="text-xs font-bold text-mn-blue hover:underline"
                >
                  Close
                </button>
              </div>
              <div className="mx-auto max-w-[260px] sm:max-w-md md:max-w-lg">
                <UsContributorMap codes={stats.stateCodes} />
              </div>
            </div>
          )}

          {showRoles && (
            <div className="mt-4 rounded-2xl border-2 border-accent-gold/60 bg-accent-gold/10 p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black uppercase tracking-widest text-mn-blue">
                  Roles that contributed feedback
                </h3>
                <button
                  type="button"
                  onClick={() => setShowRoles(false)}
                  className="text-xs font-bold text-mn-blue hover:underline"
                >
                  Close
                </button>
              </div>
              {stats.roles.length === 0 ? (
                <p className="text-sm text-dark-gray/60 italic">No roles submitted yet.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {stats.roles.map((r) => (
                    <li
                      key={r.label}
                      className="inline-flex items-center gap-2 bg-white border border-accent-gold/60 rounded-full px-3 py-1.5 text-sm text-mn-blue"
                    >
                      <span className="font-semibold">{r.label}</span>
                      <span className="tabular-nums bg-mn-blue text-white text-[11px] font-bold rounded-full px-2 py-0.5">
                        {r.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* AI Transparency */}
        <section className="bg-sky-blue/10 border border-sky-blue/30 rounded-3xl p-8">
          <h2 className="text-2xl font-bold text-mn-blue mb-4">Responsible AI — how we're using it</h2>
          <p className="text-dark-gray/80 mb-6 max-w-3xl leading-relaxed">
            AI accelerates prototyping. It does <strong>not</strong> determine policy and does{" "}
            <strong>not</strong> make eligibility decisions. DHS staff remain the humans in the loop.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { t: "Determine priorities", d: "Staff decide which ideas to build, guided by your votes." },
              { t: "Validate functionality", d: "Every change is reviewed before it goes live." },
              { t: "Ensure policy accuracy", d: "Policy experts confirm nothing misrepresents Medicaid rules." },
            ].map((c) => (
              <div key={c.t} className="bg-white p-5 rounded-xl border border-sky-blue/30">
                <h3 className="font-bold text-mn-blue mb-1">{c.t}</h3>
                <p className="text-sm text-dark-gray/70">{c.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Today vs Future */}
        <section>
          <h2 className="font-display text-2xl text-mn-blue uppercase tracking-wide border-b-2 border-mn-blue pb-3 mb-6">
            Today vs. What's possible
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl border-2 border-light-gray bg-light-gray/20">
              <h3 className="font-bold text-dark-gray uppercase text-xs tracking-widest mb-3">Today, most agencies</h3>
              <ul className="space-y-3 text-sm text-dark-gray/80">
                <li>• Multi-year RFPs before a single feature ships</li>
                <li>• Jargon-heavy notices and forms</li>
                <li>• Feedback loops measured in months</li>
                <li>• Users guess at "what happens next"</li>
              </ul>
            </div>
            <div className="p-6 rounded-2xl border-2 border-mn-green bg-mn-green/5">
              <h3 className="font-bold text-mn-green uppercase text-xs tracking-widest mb-3">What this shows is possible</h3>
              <ul className="space-y-3 text-sm text-dark-gray">
                <li>• Ship changes in the same session they were requested</li>
                <li>• Plain language, always</li>
                <li>• A visible roadmap and priority queue</li>
                <li>• Users and workers shape the tool together</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Practical path forward */}
        <section className="bg-mn-blue text-white rounded-3xl p-8 md:p-12">
          <p className="text-sky-blue text-xs font-bold uppercase tracking-widest mb-3">
            A practical path forward
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-8 leading-tight">
            Start with outcomes. Design for people.
            <br />
            Build for change. Deliver what matters.
          </h2>
          <div className="grid md:grid-cols-5 gap-4">
            {[
              "Clear vision",
              "Focused use case",
              "Small empowered team",
              "Policy & procurement flexibility",
              "Learn, adapt, scale",
            ].map((item) => (
              <div key={item} className="bg-white/10 rounded-xl p-4 border border-white/10">
                <p className="text-sm font-bold leading-snug">{item}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function StatCard({
  bg,
  fg,
  hint,
  label,
  value,
  onClick,
  active,
  hintSuffix,
}: {
  bg: string;
  fg: string;
  hint: string;
  label: string;
  value: number;
  onClick?: () => void;
  active?: boolean;
  hintSuffix?: string;
}) {
  const base = `${bg} ${fg} p-4 rounded-xl text-center transition ${
    onClick ? "cursor-pointer hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-mn-blue" : ""
  } ${active ? "ring-2 ring-mn-blue" : ""}`;
  const content = (
    <>
      <div className="text-3xl font-black tabular-nums">{value}</div>
      <div className={`text-xs font-bold uppercase tracking-widest mt-1 ${hint}`}>{label}</div>
      {hintSuffix && <div className={`text-[10px] mt-1 ${hint}`}>{hintSuffix}</div>}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={base}>
      {content}
    </button>
  ) : (
    <div className={base}>{content}</div>
  );
}
