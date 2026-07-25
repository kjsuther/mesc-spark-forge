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
          "Play a 16-bit retro platformer about applying for Medicaid, vote on the next upgrade, and watch the trail get easier when the timer hits 0:00.",
      },
      { property: "og:title", content: "Blazing the Trail to Coverage — MESC 2026 Demo" },
      {
        property: "og:description",
        content:
          "Play the game, vote on the upgrade you want next, wait for the 10-minute timer, then replay with the winning upgrade live in the game.",
      },
    ],
  }),
  component: WelcomePage,
});

type Step = {
  num: number;
  title: string;
  body: string;
  cta: string;
  theme: {
    ring: string;
    border: string;
    bg: string;
    hoverBorder: string;
    cta: string;
  };
};

const THEMES = {
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
} as const;

const STEPS: Step[] = [
  {
    num: 1,
    title: "Play the game and see how far you get",
    body: "Jump in and try to reach the end of the trail. The first run is intentionally hard — most players won't finish. That's the point.",
    cta: "Play the game",
    theme: THEMES.green,
  },
  {
    num: 2,
    title: "Vote on the upgrade you want next",
    body: "After playing, pick one of five upgrades that would help you finish the journey. One vote per attendee, per round.",
    cta: "Cast your vote",
    theme: THEMES.gold,
  },
  {
    num: 3,
    title: "Wait for the timer to reach 0:00",
    body: "Each voting round runs for 10 minutes. Watch the poster board or the game page to see the votes stack up live.",
    cta: "Watch the round",
    theme: THEMES.teal,
  },
  {
    num: 4,
    title: "Play again with the new upgrade active",
    body: "When the timer ends, the top-voted upgrade turns on for everyone. Replay the game and see if the trail is a little easier.",
    cta: "Play the next round",
    theme: THEMES.orange,
  },
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
              <span aria-hidden="true" className="text-accent-orange mr-2 sm:mr-3">★</span>
              Blazing the Trail to Coverage
              <span aria-hidden="true" className="text-accent-orange ml-2 sm:ml-3">★</span>
            </h1>
            <p className="text-cream/90 text-base sm:text-lg md:text-xl mt-5 sm:mt-6 max-w-2xl">
              A 16-bit retro platformer about applying for Medicaid — where the audience votes on
              the next upgrade and the trail visibly gets easier.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/tool"
                className="inline-flex items-center gap-2 bg-accent-orange text-white font-bold py-3 px-6 rounded-xl hover:brightness-105 transition ring-1 ring-accent-gold/70"
              >
                ▶ Play the game
              </Link>
            </div>
          </div>
        </section>

        <section className="max-w-6xl w-full mx-auto py-12 sm:py-16 px-5 sm:px-6">
          <SectionHeading>How it works</SectionHeading>
          <p className="text-dark-gray/80 mt-3 max-w-2xl text-sm sm:text-base leading-relaxed">
            Every attendee plays the same game, votes on the same five upgrades, and watches the
            trail change together. Four steps, one big feedback loop.
          </p>

          <ol className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            {STEPS.map((step) => (
              <li
                key={step.num}
                className={`relative rounded-2xl border-2 ${step.theme.border} ${step.theme.bg} p-6 flex flex-col ${step.theme.hoverBorder} hover:shadow-[0_2px_0_0_rgba(180,67,43,0.35)] transition-all`}
              >
                <span
                  aria-hidden="true"
                  className="absolute -top-2 -left-2 h-4 w-4 grid place-items-center rounded-full bg-cream text-accent-orange text-[10px] font-black ring-1 ring-mn-blue/40"
                >
                  ★
                </span>
                <div className="flex items-start gap-4 mb-4">
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
                <div className="mt-auto pt-2">
                  <Link
                    to="/tool"
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
