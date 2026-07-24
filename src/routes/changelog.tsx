import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Flag } from "lucide-react";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";
import { BackToTop } from "@/components/back-to-top";
import { SectionHeading } from "@/components/trail/section-heading";
import { versionsQuery } from "@/lib/queries";


export const Route = createFileRoute("/changelog")({
  head: () => ({
    meta: [
      { title: "Version History — [Your State] DHS Navigator" },
      { name: "description", content: "Every version of the Navigator, built live during MESC 2026." },
      { property: "og:title", content: "Version History — [Your State] DHS Navigator" },
      { property: "og:description", content: "Every version of the Navigator, built live during MESC 2026." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(versionsQuery),
  component: Changelog,
});

function Changelog() {
  const { data: versions } = useSuspenseQuery(versionsQuery);
  const sorted = [...versions].sort(
    (a, b) => new Date(a.released_at).getTime() - new Date(b.released_at).getTime(),
  );
  const [idx, setIdx] = useState(Math.max(0, sorted.length - 1));
  const active = sorted[idx];

  return (
    <div className="min-h-screen flex flex-col bg-white text-dark-gray">
      <SiteChrome />
      <main id="main-content" className="max-w-4xl w-full mx-auto py-12 px-6 flex-1">
        <header className="mb-10">
          <SectionHeading as="h1">Version History</SectionHeading>
          <p className="text-dark-gray/70 mt-3">Every update pushed during the poster session.</p>
        </header>


        {sorted.length === 0 ? (
          <p className="text-dark-gray/60">No versions yet.</p>
        ) : (
          <>
            {/* Slider */}
            <div className="bg-cream/30 border border-accent-gold/40 rounded-2xl p-6 mb-10">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-mn-blue">Rewind</h3>
                <span className="text-[10px] font-bold text-dark-gray/60 tracking-widest uppercase">
                  {idx + 1} of {sorted.length}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(0, sorted.length - 1)}
                value={idx}
                onChange={(e) => setIdx(Number(e.target.value))}
                className="w-full accent-mn-green"
                aria-label="Version slider"
              />
              <div className="flex justify-between text-xs text-dark-gray/60 mt-2 font-mono">
                <span>v{sorted[0]?.semver}</span>
                <span>v{sorted[sorted.length - 1]?.semver}</span>
              </div>

              {active && (
                <div className="mt-6 bg-white rounded-xl border-2 border-light-gray p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-mn-green tabular-nums">v{active.semver}</span>
                    <span className="text-xs text-dark-gray/60">
                      {new Date(active.released_at).toLocaleString()}
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-mn-blue mb-1">{active.title}</h4>
                  {active.notes && <p className="text-sm text-dark-gray/80 leading-relaxed">{active.notes}</p>}
                  <Link
                    to="/version/$semver"
                    params={{ semver: active.semver }}
                    className="inline-flex items-center gap-2 mt-4 bg-mn-blue text-white font-bold py-2 px-4 rounded-xl hover:brightness-110 transition text-sm"
                  >
                    View this version →
                  </Link>
                </div>
              )}
            </div>

            {/* Full timeline — vertical dashed trail with flag markers */}
            <ol
              className="relative space-y-5 pl-10"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to bottom, var(--color-accent-orange) 0 6px, transparent 6px 14px)",
                backgroundRepeat: "no-repeat",
                backgroundSize: "3px 100%",
                backgroundPosition: "12px 0",
              }}
            >
              {[...sorted].reverse().map((v) => (
                <li key={v.id} className="relative">
                  <span
                    aria-hidden="true"
                    className={`absolute -left-[34px] top-3 w-7 h-7 rounded-full grid place-items-center ring-2 ring-cream ${
                      v.is_current ? "bg-mn-green text-cream" : "bg-mn-blue text-cream"
                    }`}
                  >
                    <Flag className="h-3.5 w-3.5" />
                  </span>
                  <Link
                    to="/version/$semver"
                    params={{ semver: v.semver }}
                    className="block bg-white rounded-xl border-2 border-mn-blue/30 p-4 hover:border-accent-orange hover:shadow-sm transition"
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-black text-mn-blue tabular-nums">v{v.semver}</span>
                      {v.is_current && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-mn-green text-white">
                          ★ Current
                        </span>
                      )}
                      <span className="ml-auto text-xs text-dark-gray/60">
                        {new Date(v.released_at).toLocaleString()}
                      </span>
                    </div>
                    <h4 className="font-bold text-mn-blue">{v.title}</h4>
                    {v.notes && <p className="text-sm text-dark-gray/70 mt-1">{v.notes}</p>}
                    <span className="inline-block mt-2 text-xs font-bold text-accent-orange">
                      View snapshot →
                    </span>
                  </Link>
                </li>
              ))}
            </ol>

          </>
        )}
      </main>
      <SiteFooter />
      <BackToTop />
    </div>
  );
}
