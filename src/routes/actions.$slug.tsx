import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";
import { TrailPath } from "@/components/trail/trail-path";
import { SectionHeading } from "@/components/trail/section-heading";
import { getActionBySlug, type NavigatorAction } from "@/data/actions";
import { versionsQuery } from "@/lib/queries";
import { getSnapshotAction } from "@/lib/snapshot";
import supportWorker from "@/assets/support-worker.jpg";

type SearchParams = { version?: string };

export const Route = createFileRoute("/actions/$slug")({
  validateSearch: (raw: Record<string, unknown>): SearchParams => ({
    version: typeof raw.version === "string" ? raw.version : undefined,
  }),
  loaderDeps: ({ search }) => ({ version: search.version }),
  loader: async ({
    params,
    deps,
    context,
  }): Promise<{ action: NavigatorAction; snapshotSemver: string | null; snapshotReleasedAt: string | null }> => {
    if (deps.version) {
      const versions = await context.queryClient.ensureQueryData(versionsQuery);
      const v = versions.find((x) => x.semver === deps.version);
      const snap = getSnapshotAction(v?.snapshot ?? null, params.slug);
      if (!v || !snap) throw notFound();
      return { action: snap, snapshotSemver: v.semver, snapshotReleasedAt: v.released_at };
    }
    const action = getActionBySlug(params.slug);
    if (!action) throw notFound();
    return { action, snapshotSemver: null, snapshotReleasedAt: null };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.action.title} — [Your State] DHS Navigator` },
          { name: "description", content: loaderData.action.subtitle },
          { property: "og:title", content: `${loaderData.action.title} — [Your State] DHS Navigator` },
          { property: "og:description", content: loaderData.action.subtitle },
          ...(loaderData.snapshotSemver ? [{ name: "robots", content: "noindex" }] : []),
        ]
      : [{ title: "Not found" }, { name: "robots", content: "noindex" }],
  }),
  notFoundComponent: () => (
    <div className="min-h-screen flex flex-col">
      <SiteChrome />
      <main className="flex-1 max-w-3xl mx-auto py-20 px-6 text-center">
        <h1 className="text-3xl font-bold text-mn-blue mb-3">We couldn't find that action</h1>
        <p className="text-dark-gray/80 mb-6">Head back home and pick from the list.</p>
        <Link to="/" className="text-mn-blue font-semibold underline">
          Back to home
        </Link>
      </main>
      <SiteFooter />
    </div>
  ),
  component: ActionDetail,
});

function ActionDetail() {
  const { action, snapshotSemver, snapshotReleasedAt } = Route.useLoaderData();
  const isSnapshot = !!snapshotSemver;

  return (
    <div className="min-h-screen flex flex-col bg-white text-dark-gray">
      <SiteChrome />

      <main id="main-content" className="max-w-6xl w-full mx-auto py-12 px-6 flex-1">
        <div className="mb-4">
          {isSnapshot ? (
            <Link to="/tool" className="text-sm text-mn-blue font-semibold hover:underline">
              ← Back from v{snapshotSemver} snapshot
            </Link>
          ) : (
            <Link to="/tool" className="text-sm text-mn-blue font-semibold hover:underline">
              ← All actions
            </Link>
          )}
        </div>

        {isSnapshot && (
          <div className="mb-6 rounded-2xl border-2 border-accent-gold/70 bg-accent-gold/15 p-4">
            <p className="text-sm text-mn-blue">
              <strong>Read-only snapshot.</strong> This is how this action looked in{" "}
              <span className="tabular-nums font-bold">v{snapshotSemver}</span>
              {snapshotReleasedAt && (
                <> ({new Date(snapshotReleasedAt).toLocaleDateString()})</>
              )}
              . Interactive steps are disabled.
            </p>
          </div>
        )}

        <header className="mb-10">
          <div className="text-[10px] font-bold uppercase tracking-widest text-mn-green mb-2">
            ★ {action.category} ★
          </div>
          <h1 className="font-display text-3xl md:text-4xl uppercase tracking-wide text-mn-blue mb-3">{action.title}</h1>
          <p className="text-xl text-dark-gray/80 max-w-2xl">{action.subtitle}</p>

          <div className="mt-6 flex flex-col items-start gap-3">
            {isSnapshot ? (
              <button
                type="button"
                disabled
                className="inline-block text-center bg-light-gray/50 text-dark-gray/60 font-bold py-3 px-6 rounded-2xl cursor-not-allowed"
              >
                Preview only
              </button>
            ) : action.slug === "report-a-change" ? (
              <Link
                to="/actions/report-a-change/start"
                className="inline-block text-center bg-mn-green text-white font-bold py-3 px-6 rounded-2xl hover:bg-mn-green/90 transition-colors"
              >
                Start this now →
              </Link>
            ) : action.slug === "check-documents" ? (
              <Link
                to="/actions/check-documents/start"
                className="inline-block text-center bg-mn-green text-white font-bold py-3 px-6 rounded-2xl hover:bg-mn-green/90 transition-colors"
              >
                Start this now →
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="inline-block text-center bg-light-gray/50 text-dark-gray/60 font-bold py-3 px-6 rounded-2xl cursor-not-allowed"
              >
                Coming soon
              </button>
            )}
            <span className="inline-block bg-accent-gold/20 text-mn-blue px-4 py-1 rounded-full text-sm font-bold border border-accent-gold/40">
              Estimated time to complete this tool: {action.totalEstimate}
            </span>
          </div>
        </header>

        <section className="bg-sky-blue/10 border border-sky-blue/30 rounded-3xl p-6 md:p-8 mb-12">
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <div className="flex-1 w-full min-w-0">
              {/* How this tool works */}
              <div className="relative bg-white rounded-2xl p-6 shadow-sm border-2 border-mn-blue/30 mb-10">
                <span aria-hidden="true" className="absolute -top-2 -left-2 h-4 w-4 grid place-items-center rounded-full bg-cream text-accent-orange text-[10px] font-black ring-1 ring-mn-blue/40">★</span>
                <span aria-hidden="true" className="absolute -top-2 -right-2 h-4 w-4 grid place-items-center rounded-full bg-cream text-accent-orange text-[10px] font-black ring-1 ring-mn-blue/40">★</span>
                <h3 className="font-display uppercase tracking-wider text-mn-blue mb-4 text-lg">
                  <span className="text-accent-orange mr-2" aria-hidden="true">★</span>
                  How this tool works
                </h3>
                <ol className="space-y-3">
                  {action.checklist.map((item: import("@/data/actions").ChecklistItem, i: number) => (
                    <li key={i} className="flex gap-4 items-start p-2">
                      <div className="w-9 h-9 rounded-full bg-mn-blue text-cream grid place-items-center font-bold text-sm flex-shrink-0 ring-2 ring-accent-gold/70">
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-bold text-mn-blue">{item.title}</p>
                        <p className="text-sm text-dark-gray/70 leading-relaxed">{item.description}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <SectionHeading as="h2" className="mb-6">Your roadmap</SectionHeading>

              {/* Trail-path roadmap */}
              <TrailPath
                milestones={action.roadmap.map((s: import("@/data/actions").RoadmapStep) => ({ label: s.label, sub: s.estimate }))}
                className="mt-2"
              />
            </div>


            {/* Sidebar */}
            <aside className="w-full lg:w-80 space-y-4 lg:sticky lg:top-4">
              <div className="bg-mn-blue text-white p-6 rounded-2xl">
                <h5 className="text-sky-blue font-bold text-xs uppercase mb-2 tracking-widest">Pro-tip</h5>
                <p className="text-sm leading-relaxed">{action.proTip}</p>
              </div>
              <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden border border-light-gray bg-cream">
                <img
                  src={action.heroImage ?? supportWorker}
                  alt={
                    action.slug === "report-a-change"
                      ? "Updating your address from home."
                      : action.slug === "check-documents"
                        ? "Getting your documents organized."
                        : "A friendly DHS eligibility worker ready to help."
                  }
                  width={800}
                  height={600}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </div>
            </aside>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
