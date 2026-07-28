import { Link } from "@tanstack/react-router";
import { useIsEmbedded } from "@/hooks/use-is-embedded";

const FOOTER_LINKS: ReadonlyArray<{ to: "/" | "/tool" | "/feedback" | "/backlog" | "/scores" | "/about"; label: string }> = [
  { to: "/", label: "Home" },
  { to: "/tool", label: "Play the Game" },
  { to: "/feedback", label: "Share Feedback" },
  { to: "/backlog", label: "Feedback Backlog" },
  { to: "/scores", label: "High Scores" },
  { to: "/about", label: "About" },
];

export function SiteFooter() {
  const embedded = useIsEmbedded();
  if (embedded) return null;
  return (
    <footer className="bg-dark-gray text-white mt-20 py-8 px-6 lg:px-8">
      <div className="max-w-6xl mx-auto flex flex-col items-center gap-6">
        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          {FOOTER_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-sm font-semibold text-white/80 hover:text-white transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-bold uppercase tracking-widest text-white hover:bg-white/15 hover:border-white/40 transition-colors"
        >
          🔒 Admin Site
        </Link>
      </div>
    </footer>
  );
}
