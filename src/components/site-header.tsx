import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import mescLogo from "@/assets/mesc-2026-logo.png.asset.json";
import mnDhsLogo from "@/assets/mn-dhs-logo-new.png.asset.json";

const NAV_LINKS: ReadonlyArray<{
  to: "/" | "/about/poster" | "/about/team" | "/feedback" | "/backlog" | "/scores";
  label: string;
  exact?: boolean;
}> = [
  { to: "/", label: "Home", exact: true },
  { to: "/feedback", label: "Share Feedback" },
  { to: "/backlog", label: "Feedback Backlog" },
  { to: "/scores", label: "High Scores" },
  { to: "/about/poster", label: "About Our Poster" },
  { to: "/about/team", label: "About Us" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <nav
      className="sticky top-0 z-40 bg-mn-blue text-white px-4 sm:px-6 lg:px-8 py-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 shadow-sm border-b-2 border-dashed border-accent-orange/70"
      aria-label="Primary"
    >
      <Link to="/" className="flex items-center gap-3 group min-w-0">
        <div className="shrink-0 rounded-full bg-cream/95 grid place-items-center group-hover:scale-105 transition-transform ring-1 ring-cream/40 p-0.5">
          <img
            src={mescLogo.url}
            alt="MESC 2026"
            className="h-11 w-11 sm:h-12 sm:w-12 object-contain rounded-full"
          />
        </div>
        <div className="shrink-0 grid place-items-center">
          <img
            src={mnDhsLogo.url}
            alt="Minnesota Department of Human Services"
            className="h-11 sm:h-12 w-auto object-contain"
          />
        </div>
      </Link>

      {/* Desktop nav */}
      <div className="hidden lg:flex gap-1 xl:gap-3 text-sm font-medium items-center">
        {NAV_LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="px-3 py-2 rounded hover:bg-white/10 transition-colors min-h-11 inline-flex items-center"
            activeOptions={l.exact ? { exact: true } : undefined}
            activeProps={{ className: "bg-white/10" }}
          >
            {l.label}
          </Link>
        ))}
        <Link
          to="/tool"
          className="bg-accent-orange text-white px-4 py-2 rounded font-semibold hover:brightness-105 transition ml-2 min-h-11 inline-flex items-center ring-1 ring-accent-gold/60"
          activeProps={{ className: "brightness-110 ring-2 ring-accent-gold" }}
        >
          Play the Game
        </Link>
      </div>

      {/* Mobile / tablet: CTA + hamburger */}
      <div className="lg:hidden flex items-center gap-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            aria-label="Open menu"
            className="inline-flex items-center justify-center w-11 h-11 rounded hover:bg-white/10 transition-colors"
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </SheetTrigger>
          <SheetContent
            side="right"
            className="bg-mn-blue text-white border-none w-[80vw] max-w-sm flex flex-col p-0"
          >
            <SheetTitle className="sr-only">Site navigation</SheetTitle>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <span className="font-bold uppercase tracking-widest text-xs">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="inline-flex items-center justify-center w-11 h-11 rounded hover:bg-white/10"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <ul className="flex-1 px-3 py-4 space-y-1">
              {NAV_LINKS.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 rounded-lg text-base font-semibold hover:bg-white/10 min-h-11"
                    activeOptions={l.exact ? { exact: true } : undefined}
                    activeProps={{ className: "bg-white/15 text-sky-blue" }}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="p-4 border-t border-white/10 space-y-2">
              <Link
                to="/tool"
                onClick={() => setOpen(false)}
                className="block text-center bg-accent-orange text-white px-4 py-3 rounded-lg font-bold hover:brightness-105 transition min-h-11 ring-1 ring-accent-gold/60"
              >
                Play the Game
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
