import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/about")({
  component: AboutLayout,
});

const TABS = [
  { to: "/about/poster", label: "About Our Poster" },
  { to: "/about/team", label: "About Us" },
] as const;

function AboutLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-dark-gray">
      <SiteChrome />
      <div className="border-b border-mn-blue/10 bg-cream/50">
        <nav
          aria-label="About sections"
          className="max-w-5xl mx-auto flex gap-2 overflow-x-auto px-6 py-3"
        >
          {TABS.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              className="shrink-0 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide transition sm:text-sm border border-mn-blue/20 bg-white text-mn-blue hover:bg-mn-blue/10 data-[status=active]:border-mn-blue data-[status=active]:bg-mn-blue data-[status=active]:text-white data-[status=active]:shadow-sm"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
      <Outlet />
      <SiteFooter />
    </div>
  );
}
