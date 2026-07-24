import { Link } from "@tanstack/react-router";
import { useIsEmbedded } from "@/hooks/use-is-embedded";

export function SiteFooter() {
  const embedded = useIsEmbedded();
  if (embedded) return null;
  return (
    <footer className="bg-dark-gray text-white mt-20 py-6 px-6 lg:px-8">
      <div className="max-w-6xl mx-auto flex justify-center">
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
