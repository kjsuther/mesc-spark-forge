import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";

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
            A working prototype co-created by conference attendees during the poster session.
            Ideas in, features out — in minutes, not months.
          </p>
        </header>

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
