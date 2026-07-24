import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";
import { SectionHeading } from "@/components/trail/section-heading";
import { versionsQuery } from "@/lib/queries";

export const Route = createFileRoute("/version/$semver")({
  head: ({ params }) => ({
    meta: [
      { title: `v${params.semver} snapshot — Blazing Better Trails` },
      { name: "description", content: `A read-only snapshot of the Demo Client Tool as of v${params.semver}.` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(versionsQuery),
  component: VersionSnapshotPage,
  notFoundComponent: () => (
    <div className="min-h-screen flex flex-col">
      <SiteChrome />
      <main className="flex-1 max-w-3xl mx-auto py-20 px-6 text-center">
        <h1 className="text-3xl font-bold text-mn-blue mb-3">Version not found</h1>
        <Link to="/changelog" className="text-mn-blue font-semibold underline">
          Back to Version History
        </Link>
      </main>
      <SiteFooter />
    </div>
  ),
});

function VersionSnapshotPage() {
  const { semver } = Route.useParams();
  const { data: versions } = useSuspenseQuery(versionsQuery);
  const version = versions.find((v) => v.semver === semver);
  if (!version) throw notFound();

  const snapshot = version.snapshot;

  return (
    <div className="min-h-screen flex flex-col bg-white text-dark-gray">
      <SiteChrome />
      <main id="main-content" className="max-w-6xl w-full mx-auto py-8 px-6 flex-1">
        {/* Snapshot banner */}
        <div className="mb-8 rounded-2xl border-2 border-accent-gold/70 bg-accent-gold/15 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-mn-blue/70">
                Read-only snapshot
              </div>
              <p className="text-mn-blue font-bold text-lg mt-1">
                You're viewing <span className="tabular-nums">v{version.semver}</span> as it was on{" "}
                {new Date(version.released_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                .
              </p>
              <p className="text-sm text-dark-gray/70 mt-1">
                Voting, feedback, and interactive wizards are disabled in historical views.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link
                to="/changelog"
                className="inline-flex items-center gap-2 bg-white border-2 border-mn-blue text-mn-blue font-bold py-2 px-4 rounded-xl hover:bg-mn-blue hover:text-white transition text-sm"
              >
                ← Version History
              </Link>
              <Link
                to="/tool"
                className="inline-flex items-center gap-2 bg-mn-green text-white font-bold py-2 px-4 rounded-xl hover:brightness-105 transition text-sm"
              >
                See current tool →
              </Link>
            </div>
          </div>
        </div>

        <header className="mb-8">
          <SectionHeading as="h1">{version.title}</SectionHeading>
          {version.notes && <p className="text-dark-gray/80 mt-3 max-w-2xl whitespace-pre-line">{version.notes}</p>}
        </header>

        {!snapshot || snapshot.actions.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-dark-gray/30 bg-cream/40 p-8 text-center">
            <p className="font-bold text-mn-blue">Snapshot not available for this version.</p>
            <p className="text-sm text-dark-gray/70 mt-2">
              Older releases may not have a captured snapshot. Newer versions will show the exact tool state.
            </p>
          </div>
        ) : (
          <>
            <h2 className="font-display uppercase tracking-wide text-mn-blue text-xl mb-4">
              What the tool looked like
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {snapshot.actions.map((action) => (
                <Link
                  key={action.slug}
                  to="/actions/$slug"
                  params={{ slug: action.slug }}
                  search={{ version: version.semver }}
                  className="relative p-6 bg-cream/40 border-2 border-mn-blue/40 rounded-xl hover:border-accent-orange hover:bg-white transition-all text-left group"
                >
                  <span aria-hidden="true" className="absolute -top-2 -left-2 h-4 w-4 grid place-items-center rounded-full bg-cream text-accent-orange text-[10px] font-black ring-1 ring-mn-blue/40">★</span>
                  <div
                    className={`w-12 h-12 ${action.iconBg} ${action.iconFg} rounded-lg mb-4 grid place-items-center text-2xl font-bold ring-2 ring-accent-gold/40`}
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
              ))}
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
