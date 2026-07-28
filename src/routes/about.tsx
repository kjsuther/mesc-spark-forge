import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About this poster session — Blazing the Trail to Coverage" },
      {
        name: "description",
        content:
          "How this MESC 2026 poster session works: attendees play a game about applying for coverage, give feedback, and watch that feedback ship into the game live.",
      },
      {
        property: "og:title",
        content: "About this poster session — Blazing the Trail to Coverage",
      },
      {
        property: "og:description",
        content:
          "Play the game, give feedback, watch it ship, replay it — aligning on concepts in minutes instead of months.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
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
            We built a 16-bit video game about applying for health coverage — every barrier in it
            is one real applicants hit. Attendees play it, tell us what's broken, and we build that
            feedback into the game during the session. Then they play it again. Ideas in, working
            software out — in minutes, not months.
          </p>
        </header>

        {/* The loop */}
        <section>
          <h2 className="font-display text-2xl text-mn-blue uppercase tracking-wide border-b-2 border-mn-blue pb-3 mb-6">
            The loop we're running
          </h2>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              {
                t: "1 · Play",
                d: "Anyone can play the game at the poster, or on their own phone or laptop. The first run is deliberately frustrating — just like the real process.",
              },
              {
                t: "2 · Give feedback",
                d: "A short note and a first name plus last initial. It goes straight onto a public backlog everyone can see and the team ranks in build order.",
              },
              {
                t: "3 · We build it",
                d: "The poster team implements items from the backlog on the spot and marks them implemented, which updates the Current Version of the game.",
              },
              {
                t: "4 · Replay and re-test",
                d: "Players come back, play the Current Version, and can compare it against the Original Version to see exactly what their feedback changed.",
              },
            ].map((c) => (
              <div key={c.t} className="bg-cream/60 p-5 rounded-xl border-2 border-mn-blue/20">
                <h3 className="font-bold text-mn-blue mb-1">{c.t}</h3>
                <p className="text-sm text-dark-gray/70">{c.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/tool"
              className="inline-flex items-center gap-2 rounded-lg bg-accent-orange px-5 py-3 text-sm font-bold uppercase tracking-wide text-white hover:brightness-110 transition ring-1 ring-accent-gold/60"
            >
              ▶ Play the game
            </Link>
            <Link
              to="/feedback"
              className="inline-flex items-center gap-2 rounded-lg bg-mn-blue px-5 py-3 text-sm font-bold uppercase tracking-wide text-white hover:brightness-110 transition"
            >
              ✎ Share feedback
            </Link>
            <Link
              to="/backlog"
              className="inline-flex items-center gap-2 rounded-lg border-2 border-mn-blue/30 px-5 py-3 text-sm font-bold uppercase tracking-wide text-mn-blue hover:bg-cream transition"
            >
              📋 View the backlog
            </Link>
          </div>
        </section>

        {/* Why a game */}
        <section className="bg-accent-gold/10 border-2 border-accent-gold/50 rounded-3xl p-8">
          <h2 className="text-2xl font-bold text-mn-blue mb-4">Why a video game?</h2>
          <p className="text-dark-gray/80 max-w-3xl leading-relaxed">
            Because a game gets people to a shared understanding fast. Instead of debating a
            requirements document, everyone experiences the same obstacle course — missing
            documents, account lockouts, waiting for a decision — and then argues about how to fix
            it with something concrete in front of them. Playing, reacting, changing it, and
            re-testing in the same hour is the fastest way we've found to align on a concept.
          </p>
        </section>

        {/* AI Transparency */}
        <section className="bg-sky-blue/10 border border-sky-blue/30 rounded-3xl p-8">
          <h2 className="text-2xl font-bold text-mn-blue mb-4">
            Responsible AI — how we're using it
          </h2>
          <p className="text-dark-gray/80 mb-6 max-w-3xl leading-relaxed">
            AI helps us turn your feedback into working game changes quickly. It does{" "}
            <strong>not</strong> determine policy and does <strong>not</strong> make eligibility
            decisions. Staff remain the humans in the loop on every change.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                t: "Determine priorities",
                d: "Staff decide which backlog items get built next, and in what order.",
              },
              {
                t: "Validate functionality",
                d: "Every game change is reviewed and played before it goes live for attendees.",
              },
              {
                t: "Ensure policy accuracy",
                d: "Policy experts confirm nothing in the game misrepresents Medicaid rules.",
              },
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
              <h3 className="font-bold text-dark-gray uppercase text-xs tracking-widest mb-3">
                Today, most agencies
              </h3>
              <ul className="space-y-3 text-sm text-dark-gray/80">
                <li>• Multi-year RFPs before a single feature ships</li>
                <li>• Concepts argued over in documents nobody can try</li>
                <li>• Feedback loops measured in months</li>
                <li>• Users never see what happened to their input</li>
              </ul>
            </div>
            <div className="p-6 rounded-2xl border-2 border-mn-green bg-mn-green/5">
              <h3 className="font-bold text-mn-green uppercase text-xs tracking-widest mb-3">
                What this game shows is possible
              </h3>
              <ul className="space-y-3 text-sm text-dark-gray">
                <li>• Ship changes in the same session they were requested</li>
                <li>• Align on a concept by playing it, not describing it</li>
                <li>• A visible backlog with names attached to every idea</li>
                <li>• Re-test live and compare before vs. after on the spot</li>
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
