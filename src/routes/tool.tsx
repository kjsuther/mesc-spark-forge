import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";
import { NowBuildingBanner } from "@/components/now-building-banner";
import { SectionHeading } from "@/components/trail/section-heading";
import { MountainScape } from "@/components/trail/mountain-scape";
import { ACTIONS } from "@/data/actions";
import { nowBuildingQuery, versionsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/tool")({
  head: () => ({
    meta: [
      { title: "The tool — [Your State] DHS Client Action Navigator" },
      {
        name: "description",
        content:
          "Pick what you're trying to do — apply, renew, or update — and get a plain-language roadmap and checklist for [Your State] Medical Assistance.",
      },
      { property: "og:title", content: "The tool — [Your State] DHS Client Action Navigator" },
      { property: "og:description", content: "Pick your action and see what's next, in plain language." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(nowBuildingQuery);
    context.queryClient.ensureQueryData(versionsQuery);
  },
  component: ToolPage,
});

function ToolPage() {
  const { data: nowBuilding } = useSuspenseQuery(nowBuildingQuery);
  const { data: versions } = useSuspenseQuery(versionsQuery);
  const qc = useQueryClient();

  const current = versions.find((v) => v.is_current) ?? versions[versions.length - 1];

  useEffect(() => {
    const channel = supabase
      .channel("tool-now-building")
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

      <main id="main-content" className="max-w-6xl w-full mx-auto py-12 px-6 flex-1">
        <NowBuildingBanner items={nowBuilding} currentSemver={current?.semver} variant="tool" />



        <header className="mb-10">
          <SectionHeading as="h1">What are you trying to do today?</SectionHeading>
          <p className="text-lg md:text-xl text-dark-gray/80 max-w-2xl mt-4">
            Pick an option below to get a personalized roadmap and checklist — in plain language.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ACTIONS.filter((a) => a.slug === "report-a-change" || a.slug === "check-documents").map((action) => {
            return (
              <Link
                key={action.slug}
                to="/actions/$slug"
                params={{ slug: action.slug }}
                className="relative p-6 bg-cream/40 border-2 border-mn-blue/40 rounded-xl hover:border-accent-orange hover:bg-white transition-all text-left group focus:outline-none focus:border-mn-blue shadow-[0_1px_0_0_rgba(31,51,72,0.1)]"
              >
                <span aria-hidden="true" className="absolute -top-2 -left-2 h-4 w-4 grid place-items-center rounded-full bg-cream text-accent-orange text-[10px] font-black ring-1 ring-mn-blue/40">★</span>
                <span aria-hidden="true" className="absolute -top-2 -right-2 h-4 w-4 grid place-items-center rounded-full bg-cream text-accent-orange text-[10px] font-black ring-1 ring-mn-blue/40">★</span>
                <div
                  className={`w-12 h-12 ${action.iconBg} ${action.iconFg} rounded-lg mb-4 grid place-items-center group-hover:scale-110 transition-transform text-2xl font-bold ring-2 ring-accent-gold/40`}
                >
                  {action.iconChar}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-mn-green mb-1">
                  ★ {action.category}
                </div>
                <h3 className="font-display uppercase tracking-wide text-mn-blue text-xl leading-tight">
                  {action.title}
                </h3>
                <p className="text-sm text-dark-gray/70 mt-2 leading-snug">{action.subtitle}</p>
              </Link>
            );
          })}
        </div>

        <div className="mt-16 opacity-70">
          <MountainScape variant="band" />
        </div>
      </main>


      <SiteFooter />
    </div>
  );
}
