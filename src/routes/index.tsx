import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";
import { MountainScape } from "@/components/trail/mountain-scape";
import { SectionHeading } from "@/components/trail/section-heading";
import { PixelLevelStrip } from "@/components/pixel/pixel-art";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";



export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ideas to Working Software, Live — MESC 2026 Demo" },
      {
        name: "description",
        content:
          "A MESC 2026 demonstration of AI-assisted development and rapid feedback loops. A 16-bit Medicaid journey game is the example; faster alignment between business and technology teams is the point.",
      },
      { property: "og:title", content: "Ideas to Working Software, Live — MESC 2026 Demo" },
      {
        property: "og:description",
        content:
          "See how rapid prototyping and continuous feedback close the gap between business intent and delivered technology — demonstrated live through a 16-bit game.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WelcomePage,
});


type Step = {
  num: number;
  title: string;
  body: string;
  cta: string;
  to: "/tool" | "/feedback";
  theme: {
    ring: string;
    border: string;
    bg: string;
    cta: string;
  };
};

const THEMES = {
  green: {
    ring: "bg-mn-green",
    border: "border-mn-green/40",
    bg: "bg-mn-green/5",
    cta: "bg-mn-green hover:bg-mn-green/90 text-white",
  },
  gold: {
    ring: "bg-accent-gold text-mn-blue",
    border: "border-accent-gold/60",
    bg: "bg-accent-gold/10",
    cta: "bg-accent-gold text-mn-blue hover:brightness-105",
  },
  orange: {
    ring: "bg-accent-orange",
    border: "border-accent-orange/50",
    bg: "bg-accent-orange/5",
    cta: "bg-accent-orange hover:brightness-105 text-white",
  },
} as const;

const STEPS: Step[] = [
  {
    num: 1,
    title: "Experience the first version",
    body: "Play the 16-bit game about the journey to health coverage. Like any early build, it has rough edges — you'll feel exactly where the experience falls short of the intent.",
    cta: "▶ Play the game",
    to: "/tool",
    theme: THEMES.green,
  },
  {
    num: 2,
    title: "Tell us what should change",
    body: "Describe the gap in your own words instead of writing a requirement. Every note lands on a public backlog the team works from during the session.",
    cta: "✎ Share feedback",
    to: "/feedback",
    theme: THEMES.gold,
  },
  {
    num: 3,
    title: "See your feedback in the product",
    body: "We build the change with AI-assisted development tools while you're here, then you interact with the updated version and tell us whether it hit the mark.",
    cta: "▶ Replay the game",
    to: "/tool",
    theme: THEMES.orange,
  },
];

const LOOP_CARDS = [
  "Define the idea",
  "Rapidly build something tangible",
  "Gather real feedback",
  "Improve and re-test",
];




function WelcomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-transparent text-dark-gray font-sans">
      <SiteChrome />

      <main id="main-content" className="flex-1">
        <section className="relative overflow-hidden bg-mn-blue text-white px-5 sm:px-6 lg:px-8 pt-10 sm:pt-16 pb-20 sm:pb-28">
          <div className="absolute inset-x-0 bottom-0 pointer-events-none">
            <MountainScape variant="hero" />
          </div>
          <div className="relative max-w-6xl mx-auto">
            <p className="text-accent-gold text-[11px] sm:text-xs font-bold uppercase tracking-widest mb-3">
              ★ MESC 2026 · Ideas to working software, live ★
            </p>
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl uppercase tracking-wide max-w-4xl leading-[1.05] drop-shadow-[0_2px_0_rgba(0,0,0,0.25)]">
              <span aria-hidden="true" className="text-accent-orange mr-2 sm:mr-3">
                ★
              </span>
              Blazing the Trail to Coverage
              <span aria-hidden="true" className="text-accent-orange ml-2 sm:ml-3">
                ★
              </span>
            </h1>
            <p className="text-cream/90 text-base sm:text-lg md:text-xl mt-5 sm:mt-6 max-w-2xl">
              This 16-bit game is the example — not the point. The point is what happens around it:
              an idea becomes something you can actually use, you tell us where it misses, and the
              change is built and back in your hands during the session. Play it, shape it, and see
              how quickly business and technology teams can align when there is a real product to
              react to.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/tool"
                className="inline-flex items-center gap-2 bg-accent-orange text-white font-bold py-3 px-6 rounded-xl hover:brightness-105 transition ring-1 ring-accent-gold/70"
              >
                ▶ Play the game
              </Link>
              <a
                href="#concept"
                className="inline-flex items-center gap-2 bg-white/10 text-white font-bold py-3 px-6 rounded-xl hover:bg-white/20 transition ring-1 ring-white/40"
              >
                What's the concept?
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 bg-white/10 text-white font-bold py-3 px-6 rounded-xl hover:bg-white/20 transition ring-1 ring-white/40"
              >
                How this Works?
              </a>
            </div>
          </div>
        </section>

        {/* The concept, stated plainly */}
        <section
          id="concept"
          className="max-w-6xl w-full mx-auto px-5 sm:px-6 -mt-8 sm:-mt-12 relative z-10 scroll-mt-24"
        >
          <div className="rounded-2xl bg-mn-blue text-white p-5 sm:p-7 shadow-xl">
            <p className="text-accent-gold text-[10px] sm:text-[11px] font-bold uppercase tracking-widest mb-2">
              What's the Concept?
            </p>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold leading-snug max-w-3xl">
              AI-assisted development can turn ideas into working software fast — and that speed is
              most valuable because of how quickly it lets business and technology teams learn from
              real feedback.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-cream/85 max-w-3xl leading-relaxed">
              Requirements are interpretations. A working product is not. When stakeholders can use
              something real early, gaps show up in minutes instead of after months of build, and
              the next version reflects what people actually meant.
            </p>
            <ul className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              {LOOP_CARDS.map((item, i) => (
                <li key={item} className="bg-white/10 rounded-lg px-3 py-2 border border-white/10">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-accent-gold">
                    Step {i + 1}
                  </p>
                  <p className="text-xs sm:text-sm font-bold leading-snug">{item}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* The takeaway: visible first, before the tiles */}
          <div className="mt-6 rounded-xl border-l-4 border-accent-gold bg-accent-gold/20 px-5 py-5 shadow-sm">
            <p className="text-sm sm:text-lg font-bold text-mn-blue leading-relaxed">
              <span className="text-accent-orange mr-1" aria-hidden="true">★</span>
              The takeaway: this isn't "we used AI to make a video game." It's a demonstration that
              faster building plus continuous human feedback leads to faster alignment, less rework,
              and better outcomes. The people in the loop still decide what "better" means.
            </p>
          </div>

          {/* The Broader Application — collapsible tile */}
          <Collapsible defaultOpen={false} className="mt-6 rounded-2xl border border-mn-blue/20 bg-cream/95 shadow-sm overflow-hidden">
            <CollapsibleTrigger className="w-full flex items-start justify-between gap-3 p-5 sm:p-6 text-left group">
              <div>
                <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-accent-orange mb-1">
                  The Broader Application
                </p>
                <h3 className="text-base sm:text-lg font-bold text-mn-blue leading-snug">
                  The same approach fits work that matters more
                </h3>
              </div>
              <ChevronDown className="mt-1 w-5 h-5 text-mn-blue transition-transform duration-200 group-data-[state=open]:rotate-180 flex-shrink-0" />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-5 sm:px-6 pb-5 sm:pb-6 text-sm sm:text-base text-dark-gray/80 leading-relaxed">
              If a game can be improved this fast, so can the tools people use to access health coverage and services. Working prototypes, early feedback, and rapid iteration create better outcomes.
            </CollapsibleContent>
          </Collapsible>
        </section>


        <PixelLevelStrip className="mt-12 h-12 sm:h-16 opacity-70" />

        <section
          id="how-it-works"
          className="max-w-6xl w-full mx-auto py-12 sm:py-16 px-5 sm:px-6 scroll-mt-24"
        >
          <SectionHeading>How the demonstration works</SectionHeading>
          <p className="text-dark-gray/80 mt-3 max-w-2xl text-sm sm:text-base leading-relaxed">
            Three steps, running the whole session. You use the product, you say what's wrong, and
            you experience the improved version — the same loop we'd want on real Medicaid
            technology.
          </p>

          <ol className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((step) => (
              <li
                key={step.num}
                className={`relative rounded-2xl border-2 ${step.theme.border} ${step.theme.bg} p-6 flex flex-col`}
              >
                <span
                  aria-hidden="true"
                  className="absolute -top-2 -left-2 h-4 w-4 grid place-items-center rounded-full bg-cream text-accent-orange text-[10px] font-black ring-1 ring-mn-blue/40"
                >
                  ★
                </span>
                <div className="flex items-start gap-4">
                  <span
                    className={`flex-shrink-0 w-12 h-12 rounded-full ${step.theme.ring} text-cream grid place-items-center font-black text-xl ring-2 ring-accent-gold/70`}
                  >
                    {step.num}
                  </span>
                  <div className="flex-1">
                    <h3 className="font-bold text-mn-blue text-lg leading-tight">{step.title}</h3>
                    <p className="text-sm text-dark-gray/80 mt-2 leading-relaxed">{step.body}</p>
                  </div>
                </div>
                <Link
                  to={step.to}
                  className={`mt-5 inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-bold uppercase tracking-wide transition ${step.theme.cta}`}
                >
                  {step.cta}
                </Link>
              </li>
            ))}
          </ol>

          <p className="mt-8 text-sm text-dark-gray/80">
            Want the evidence?{" "}
            <Link to="/backlog" className="font-bold text-mn-blue underline underline-offset-4">
              View the feedback backlog
            </Link>{" "}
            to see what people asked for and what has already shipped, read{" "}
            <Link
              to="/about/poster"
              className="font-bold text-mn-blue underline underline-offset-4"
            >
              about our poster
            </Link>{" "}
            for how this maps to real Medicaid work, or{" "}
            <Link to="/scores" className="font-bold text-mn-blue underline underline-offset-4">
              check the high scores
            </Link>
            .
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
