import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";
import { NowBuildingBanner } from "@/components/now-building-banner";
import { MountainScape } from "@/components/trail/mountain-scape";

import { SectionHeading } from "@/components/trail/section-heading";
import { nowBuildingQuery, versionsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MESC 2026 Poster Session Demo" },
      {
        name: "description",
        content:
          "A guided 4-step walkthrough for MESC 2026 attendees: try the tool, share feedback, vote on the backlog, and watch it ship live.",
      },
      { property: "og:title", content: "MESC 2026 Poster Session Demo" },
      { property: "og:description", content: "A guided 4-step walkthrough for MESC 2026 attendees: try the tool, share feedback, vote on the backlog, and watch it ship live." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(nowBuildingQuery);
    context.queryClient.ensureQueryData(versionsQuery);
  },
  component: WelcomePage,
});

type StepTheme = {
  ring: string;      // number circle bg
  border: string;    // card border
  bg: string;        // card background tint
  hoverBorder: string;
  cta: string;       // CTA button bg
};

type Step = {
  num: number;
  title: string;
  body: string;
  cta: string;
  to: "/tool" | "/feedback" | "/backlog" | "/changelog";
  optional?: boolean;
  theme: StepTheme;
};

const THEMES: Record<string, StepTheme> = {
  green: {
    ring: "bg-mn-green",
    border: "border-mn-green/40",
    bg: "bg-mn-green/5",
    hoverBorder: "hover:border-mn-green",
    cta: "bg-mn-green hover:bg-mn-green/90",
  },
  gold: {
    ring: "bg-accent-gold text-mn-blue",
    border: "border-accent-gold/60",
    bg: "bg-accent-gold/10",
    hoverBorder: "hover:border-accent-gold",
    cta: "bg-accent-gold text-mn-blue hover:brightness-105",
  },
  teal: {
    ring: "bg-accent-teal",
    border: "border-accent-teal/40",
    bg: "bg-accent-teal/5",
    hoverBorder: "hover:border-accent-teal",
    cta: "bg-accent-teal hover:brightness-105",
  },
  orange: {
    ring: "bg-accent-orange",
    border: "border-accent-orange/50",
    bg: "bg-accent-orange/5",
    hoverBorder: "hover:border-accent-orange",
    cta: "bg-accent-orange hover:brightness-105",
  },
};

const STEPS: Step[] = [
  {
    num: 1,
    title: "Review the current version of the tool",
    body: "See what's live right now. Try picking an action and walking through the roadmap the way an applicant would.",
    cta: "Open the tool",
    to: "/tool",
    theme: THEMES.green,
  },
  {
    num: 2,
    title: "Add any feedback",
    body: "Spotted something confusing or missing? Tell us what you'd change. Takes about 30 seconds.",
    cta: "Share feedback",
    to: "/feedback",
    optional: true,
    theme: THEMES.gold,
  },
  {
    num: 3,
    title: "Review the backlog and vote",
    body: "Vote Must Have, Should Have, or Nice to Have on ideas already submitted. You have 5 votes total — stack them all on one item to push it higher, or spread them across up to 5 different items.",
    cta: "Open the backlog",
    to: "/backlog",
    theme: THEMES.teal,
  },
  {
    num: 4,
    title: "Check back for real-time updates",
    body: "Top-voted ideas get built live during the session. Rewind through past versions to see how the tool evolved.",
    cta: "See Version History",
    to: "/changelog",
    theme: THEMES.orange,
  },
];

function WelcomePage() {
  const { data: nowBuilding } = useSuspenseQuery(nowBuildingQuery);
  const { data: versions } = useSuspenseQuery(versionsQuery);
  const qc = useQueryClient();
  const current = versions.find((v) => v.is_current) ?? versions[versions.length - 1];

  useEffect(() => {
    const channel = supabase
      .channel("welcome")
      .on("postgres_changes", { event: "*", schema: "public", table: "feedback" }, () =>
        qc.invalidateQueries({ queryKey: ["now_building"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "versions" }, () =>
        qc.invalidateQueries({ queryKey: ["versions"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-dark-gray font-sans">
      <SiteChrome />

      <main id="main-content" className="flex-1">
        <section className="relative overflow-hidden bg-mn-blue text-white px-5 sm:px-6 lg:px-8 pt-10 sm:pt-16 pb-20 sm:pb-28">
          {/* Decorative mountains behind hero content */}
          <div className="absolute inset-x-0 bottom-0 pointer-events-none">
            <MountainScape variant="hero" />
          </div>
          <div className="relative max-w-6xl mx-auto">
            <p className="text-accent-gold text-[11px] sm:text-xs font-bold uppercase tracking-widest mb-3">
              ★ MESC 2026 · Live co-creation session ★
            </p>
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl uppercase tracking-wide max-w-4xl leading-[1.05] drop-shadow-[0_2px_0_rgba(0,0,0,0.25)]">
              <span aria-hidden="true" className="text-accent-orange mr-2 sm:mr-3">★</span>
              Blazing Better Trails
              <span aria-hidden="true" className="text-accent-orange ml-2 sm:ml-3">★</span>
            </h1>
            <p className="text-cream/90 text-base sm:text-lg md:text-xl mt-5 sm:mt-6 max-w-2xl">
              Help us build a Medicaid Client Assister tool, LIVE, right now.
            </p>

            <div className="mt-6 inline-flex items-center gap-2 bg-accent-gold/95 text-mn-blue px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-black uppercase tracking-widest ring-1 ring-cream/40">
              <span aria-hidden="true">●</span>
              Proof of Concept · MVP
            </div>
            <p className="text-cream/90 text-sm sm:text-base mt-4 max-w-2xl leading-relaxed">
              What you're reviewing is a <strong>proof-of-concept client self-service tool</strong> in a
              <strong> Minimum Viable Product</strong> state — intentionally basic. During this poster session,
              your feedback and votes set the priority, and the top-ranked ideas get built into the tool
              <strong> live, in real time</strong>.
            </p>
          </div>
        </section>

        <section className="max-w-6xl w-full mx-auto py-12 sm:py-16 px-5 sm:px-6">
          <SectionHeading>How to participate</SectionHeading>
          <p className="text-dark-gray/80 mt-3 max-w-2xl text-sm sm:text-base leading-relaxed">
            Follow the four steps below. The tool starts intentionally simple — every idea you leave gets voted on by other attendees, and the top-voted changes get shipped into the tool during this session.
          </p>


          <ol className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            {STEPS.map((step) => (
              <li
                key={step.num}
                className={`relative rounded-2xl border-2 ${step.theme.border} ${step.theme.bg} p-6 flex flex-col ${step.theme.hoverBorder} hover:shadow-[0_2px_0_0_rgba(180,67,43,0.35)] transition-all`}
              >
                <span aria-hidden="true" className="absolute -top-2 -left-2 h-4 w-4 grid place-items-center rounded-full bg-cream text-accent-orange text-[10px] font-black ring-1 ring-mn-blue/40">★</span>
                <div className="flex items-start gap-4 mb-4">
                  <span className={`flex-shrink-0 w-12 h-12 rounded-full ${step.theme.ring} text-cream grid place-items-center font-black text-xl ring-2 ring-accent-gold/70`}>
                    {step.num}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-mn-blue text-lg leading-tight">{step.title}</h3>
                      {step.optional && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-mn-blue/70 bg-accent-gold/40 px-2 py-0.5 rounded">
                          Optional
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-dark-gray/80 mt-2 leading-relaxed">{step.body}</p>
                  </div>
                </div>
                <div className="mt-auto pt-2">
                  <Link
                    to={step.to}
                    className={`inline-flex items-center gap-2 ${step.theme.cta} text-white font-bold py-3 px-5 rounded-xl transition`}
                  >
                    {step.cta} →
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </section>

      </main>

      <SiteFooter />
    </div>
  );
}
