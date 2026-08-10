import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useEffect, useRef, useState } from "react";

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

const SECTIONS: { id: string; label: string }[] = [
  { id: "loop", label: "The loop" },
  { id: "why-game", label: "Why a game?" },
  { id: "real-world", label: "Real front door" },
  { id: "ai", label: "Responsible AI" },
  { id: "today-future", label: "Today vs. Future" },
  { id: "path-forward", label: "Path forward" },
];

function SectionJumpNav() {
  const [activeId, setActiveId] = useState<string>(SECTIONS[0]!.id);
  const navRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) {
          setActiveId(visible.target.id);
        }
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const activeButton = buttonRefs.current[activeId];
    const nav = navRef.current;
    if (activeButton && nav) {
      const scrollLeft =
        activeButton.offsetLeft -
        nav.clientWidth / 2 +
        activeButton.clientWidth / 2;
      nav.scrollTo({ left: scrollLeft, behavior: "smooth" });
    }
  }, [activeId]);

  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(id);
    }
  };

  return (
    <nav
      ref={navRef}
      aria-label="About page sections"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      className="sticky top-14 sm:top-16 z-30 -mx-6 mb-8 flex gap-2 overflow-x-auto border-b border-mn-blue/10 bg-white/95 px-6 py-3 shadow-sm backdrop-blur-sm sm:-mx-0 sm:mx-0 sm:flex-wrap sm:justify-center sm:rounded-2xl sm:border-2 sm:border-mn-blue/10 sm:bg-cream/60 sm:px-4 sm:py-3 sm:shadow-none"
    >
      {SECTIONS.map(({ id, label }) => {
        const active = id === activeId;
        return (
          <button
            key={id}
            ref={(el) => {
              buttonRefs.current[id] = el;
            }}
            onClick={() => handleClick(id)}
            aria-current={active ? "true" : undefined}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide transition whitespace-nowrap sm:text-sm ${
              active
                ? "bg-mn-blue text-white shadow-sm"
                : "bg-white text-mn-blue hover:bg-mn-blue/10 border border-mn-blue/20"
            }`}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}

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
            We built a 16-bit video game about applying for health coverage — every barrier in it is
            one real applicants hit. Attendees play it, tell us what's broken, and we build that
            feedback into the game during the session. Then they play it again. Ideas in, working
            software out — in minutes, not months.
          </p>
        </header>

        <SectionJumpNav />

        {/* The loop */}
        <section id="loop">
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
        <section id="why-game" className="bg-accent-gold/10 border-2 border-accent-gold/50 rounded-3xl p-8">
          <h2 className="text-2xl font-bold text-mn-blue mb-4">Why a video game?</h2>
          <p className="text-dark-gray/80 max-w-3xl leading-relaxed">
            Because a game gets people to a shared understanding fast. Instead of debating a
            requirements document, everyone experiences the same obstacle course — missing
            documents, account lockouts, waiting for a decision — and then argues about how to fix
            it with something concrete in front of them. Playing, reacting, changing it, and
            re-testing in the same hour is the fastest way we've found to align on a concept.
          </p>
        </section>

        {/* Game → real world */}
        <section id="real-world">
          <h2 className="font-display text-2xl text-mn-blue uppercase tracking-wide border-b-2 border-mn-blue pb-3 mb-6">
            From the game to the real front door
          </h2>
          <p className="text-dark-gray/80 max-w-3xl leading-relaxed mb-6">
            Every obstacle in the game is a stand-in for a barrier real applicants hit when they try
            to get health coverage. That's the point of building it: changing an obstacle in a game
            takes an afternoon, and it's a cheap, honest rehearsal for changing the same thing in
            the actual system. When a player says "this part is unfair," they're usually telling us
            something true about the real process — and the fix they describe usually maps to a real
            product change.
          </p>

          <Accordion type="multiple" className="grid gap-3">
            {[
              {
                g: "Smashing bricks to find the right application",
                p: "People don't know which channel to use — mail, phone, county office, or online.",
                f: "One clear front door with guided intake.",
              },
              {
                g: "Account lockouts",
                p: "Password and identity friction stops people before they ever start.",
                f: "Simpler identity proofing and account recovery.",
              },
              {
                g: "Hunting for missing documents",
                p: "Verification churn means sending the same paperwork over and over.",
                f: "Data matching and reuse of documents already on file.",
              },
              {
                g: "Waiting while the calendar pages fall",
                p: "Silence during processing drives anxiety, phone calls, and churn.",
                f: "Proactive status updates and a self-service status checker.",
              },
              {
                g: 'The "Denied" boss fight',
                p: "Notices arrive in language people can't act on.",
                f: "Plain-language notices with clear next steps and appeal paths.",
              },
            ].map((r) => (
              <AccordionItem
                key={r.g}
                value={r.g}
                className="rounded-2xl border-2 border-mn-blue/20 bg-cream/60 px-5"
              >
                <AccordionTrigger className="hover:no-underline text-left">
                  <span>
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-accent-orange mb-1">
                      In the game
                    </span>
                    <span className="block text-sm font-bold text-mn-blue">{r.g}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid md:grid-cols-2 gap-4 pb-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-dark-gray/60 mb-1">
                        Real-world pain point
                      </p>
                      <p className="text-sm text-dark-gray/80">{r.p}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-mn-green mb-1">
                        What it points at
                      </p>
                      <p className="text-sm text-dark-gray/80">{r.f}</p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <p className="text-dark-gray/80 max-w-3xl leading-relaxed mt-6">
            This is how a game becomes more than a game. Playing it surfaces the friction faster
            than a requirements workshop. Fixing it live proves a concept is buildable before anyone
            writes a procurement document. And because every change traces back to a named person's
            feedback, the people closest to the problem stay visible in the solution — which is
            exactly the habit we want carried into the tools that real Medicaid clients depend on.
          </p>
        </section>

        {/* AI Transparency */}
        <section id="ai" className="bg-sky-blue/10 border border-sky-blue/30 rounded-3xl p-8">
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
        <section id="today-future">
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
        <section id="path-forward" className="bg-mn-blue text-white rounded-3xl p-8 md:p-12">
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
