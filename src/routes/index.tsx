import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";
import { MountainScape } from "@/components/trail/mountain-scape";
import { SectionHeading } from "@/components/trail/section-heading";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Blazing the Trail to Coverage — MESC 2026 Demo" },
      {
        name: "description",
        content:
          "Play a 16-bit retro video game about applying for Medicaid, tell us what to improve, and come back to play the version built from your feedback.",
      },
      { property: "og:title", content: "Blazing the Trail to Coverage — MESC 2026 Demo" },
      {
        property: "og:description",
        content:
          "Play the game, share your feedback, and replay the version we build from it — live during the session.",
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
    title: "Play the game",
    body: "A short 16-bit video game about the trail from “I need health coverage” to “Covered!”. The first run is intentionally rough — most players hit a wall. That's the point.",
    cta: "▶ Play the game",
    to: "/tool",
    theme: THEMES.green,
  },
  {
    num: 2,
    title: "Suggest improvements",
    body: "What tripped you up? What was unclear or unfair? Leave a short note with your first name and last initial. It lands on the public backlog immediately.",
    cta: "✎ Share feedback",
    to: "/feedback",
    theme: THEMES.gold,
  },
  {
    num: 3,
    title: "Come back and replay it",
    body: "The poster team builds your feedback into the game during the session. Reload the Current Version and see your idea running in the game you just played.",
    cta: "▶ Replay the game",
    to: "/tool",
    theme: THEMES.orange,
  },
];

const LOOP_CARDS = [
  "Play the game",
  "Suggest improvements",
  "We build it live",
  "Replay the better version",
];

function WelcomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-dark-gray font-sans">
      <SiteChrome />

      <main id="main-content" className="flex-1">
        <section className="relative overflow-hidden bg-mn-blue text-white px-5 sm:px-6 lg:px-8 pt-10 sm:pt-16 pb-20 sm:pb-28">
          <div className="absolute inset-x-0 bottom-0 pointer-events-none">
            <MountainScape variant="hero" />
          </div>
          <div className="relative max-w-6xl mx-auto">
            <p className="text-accent-gold text-[11px] sm:text-xs font-bold uppercase tracking-widest mb-3">
              ★ MESC 2026 · Live co-creation session ★
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
              Play our retro video game and see if you can survive the journey of applying for
              Medicaid. Then tell us what to improve — we build your feedback into the game during
              the session, and you come back to play the improved version.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/tool"
                className="inline-flex items-center gap-2 bg-accent-orange text-white font-bold py-3 px-6 rounded-xl hover:brightness-105 transition ring-1 ring-accent-gold/70"
              >
                ▶ Play the game
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 bg-white/10 text-white font-bold py-3 px-6 rounded-xl hover:bg-white/20 transition ring-1 ring-white/40"
              >
                How this works
              </a>
            </div>
          </div>
        </section>

        {/* The loop, stated plainly */}
        <section className="max-w-6xl w-full mx-auto px-5 sm:px-6 -mt-8 sm:-mt-12 relative z-10">
          <div className="rounded-2xl bg-mn-blue text-white p-5 sm:p-7 shadow-xl">
            <p className="text-accent-gold text-[10px] sm:text-[11px] font-bold uppercase tracking-widest mb-2">
              What's the Concept?
            </p>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold leading-snug max-w-3xl">
              Start with a real player. Listen to the feedback.
              <br className="hidden sm:block" /> Make the change today. Ship it while they wait.
            </h2>
            <ul className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              {LOOP_CARDS.map((item) => (
                <li key={item} className="bg-white/10 rounded-lg px-3 py-2 border border-white/10">
                  <p className="text-xs sm:text-sm font-bold leading-snug">{item}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="how-it-works"
          className="max-w-6xl w-full mx-auto py-12 sm:py-16 px-5 sm:px-6 scroll-mt-24"
        >
          <SectionHeading>How it works</SectionHeading>
          <p className="text-dark-gray/80 mt-3 max-w-2xl text-sm sm:text-base leading-relaxed">
            Three steps. Everyone plays the same game, everyone's feedback goes on the same public
            backlog, and the game changes in front of you.
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
            Curious what's queued up next?{" "}
            <Link to="/backlog" className="font-bold text-mn-blue underline underline-offset-4">
              View the feedback backlog
            </Link>{" "}
            to see what players have asked for and what we've already built. Or{" "}
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
