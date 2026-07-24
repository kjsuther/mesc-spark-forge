import { createFileRoute, Outlet, Link, redirect, useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isServer } from "@tanstack/router-core/isServer";
import { useEffect, useState } from "react";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";
import { getAdminStatus, getAdminOverview } from "@/lib/admin.functions";
import { clearAdminAccessToken } from "@/lib/admin-auth-attacher";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — [Your State] DHS Navigator" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  beforeLoad: async ({ location }) => {
    const status = await getAdminStatus();
    if (!status.unlocked && location.pathname !== "/admin/unlock") {
      if (isServer) return { unlocked: false };
      throw redirect({ to: "/admin/unlock" });
    }
    return { unlocked: status.unlocked };
  },
  component: AdminLayout,
});

function useRelativeTime(date: Date | null) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (!date) return "never";
  const s = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function AdminLayout() {
  const { unlocked } = Route.useRouteContext();
  const router = useRouter();
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(getAdminOverview);
  const fetchStatus = useServerFn(getAdminStatus);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isPosterView = pathname === "/admin/poster";
  const showAdminChrome = pathname !== "/admin/unlock" && !isPosterView;

  const { data: status, isFetching: isCheckingStatus } = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => fetchStatus(),
    initialData: unlocked ? { unlocked } : undefined,
  });

  const isUnlocked = unlocked || !!status?.unlocked;

  useEffect(() => {
    if (showAdminChrome && !unlocked && status && !status.unlocked && !isCheckingStatus) {
      router.navigate({ to: "/admin/unlock", search: { reason: "expired" }, replace: true });
    }
  }, [isCheckingStatus, router, showAdminChrome, status, unlocked]);

  const { data: overview, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview(),
    enabled: showAdminChrome && isUnlocked,
    refetchInterval: 15_000,
  });

  const updatedRel = useRelativeTime(dataUpdatedAt ? new Date(dataUpdatedAt) : null);

  async function handleLock() {
    clearAdminAccessToken();
    queryClient.setQueryData(["admin-status"], { unlocked: false });
    queryClient.removeQueries({ queryKey: ["admin-overview"] });
    try {
      await Promise.race([
        fetch("/admin/lock", { method: "POST", headers: { Accept: "application/json" } }),
        new Promise((resolve) => window.setTimeout(resolve, 800)),
      ]);
    } finally {
      window.location.replace("/admin/unlock?reason=expired");
    }
  }

  const sectionLabel =
    pathname.startsWith("/admin/now-building")
      ? "Now Building"
      : pathname.startsWith("/admin/versions")
      ? "Versions"
      : pathname.startsWith("/admin/subscribers")
      ? "Launch Subscribers"
      : pathname === "/admin" || pathname === "/admin/"
      ? "Feedback triage"
      : null;

  const navItemBase = "text-sm font-semibold px-2 py-1 rounded transition-colors hover:bg-white/15";
  const navActive = { className: `${navItemBase} bg-white/20 underline underline-offset-4` };
  const navInactive = { className: navItemBase };

  if (isPosterView) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-dark-gray">
      <SiteChrome />
      {showAdminChrome && (
        <>
          <div className="bg-mn-blue text-white px-6 py-3 flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-2 items-center flex-wrap">
              <span className="uppercase tracking-widest text-[10px] font-black bg-accent-gold text-mn-blue px-2 py-1 rounded mr-2">
                Admin
              </span>
              <Link to="/admin" activeOptions={{ exact: true }} activeProps={navActive} inactiveProps={navInactive}>
                Feedback
              </Link>
              <Link to="/admin/now-building" activeProps={navActive} inactiveProps={navInactive}>
                Now Building
              </Link>
              <Link to="/admin/versions" activeProps={navActive} inactiveProps={navInactive}>
                Versions
              </Link>
              <Link to="/admin/subscribers" activeProps={navActive} inactiveProps={navInactive}>
                Subscribers
              </Link>
              <Link to="/admin/poster" activeProps={navActive} inactiveProps={navInactive}>
                Poster View
              </Link>
            </div>

            <button
              onClick={handleLock}
              className="text-xs font-bold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded"
              title="Sign out of admin"
            >
              Lock
            </button>
          </div>
          {sectionLabel && (
            <div className="bg-white border-b border-light-gray px-6 py-1.5 text-[11px] text-dark-gray/70">
              <Link to="/admin" className="hover:underline">Admin</Link>
              <span className="mx-1.5">·</span>
              <span className="font-semibold text-dark-gray">{sectionLabel}</span>
            </div>
          )}
          {overview && (
            <div className="bg-cream border-b border-light-gray px-6 py-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs font-semibold text-dark-gray">
              <span>
                Live:{" "}
                <span className="font-black text-mn-green">
                  {overview.currentVersion ? `v${overview.currentVersion}` : "none"}
                </span>
              </span>
              <span>
                Now Building:{" "}
                <span
                  className={`font-black ${overview.nowBuilding.length ? "text-mn-blue" : "text-dark-gray/50"}`}
                  title={overview.nowBuilding.join(" • ") || undefined}
                >
                  {overview.nowBuilding.length === 0
                    ? "None set"
                    : overview.nowBuilding.length === 1
                    ? overview.nowBuilding[0]
                    : `${overview.nowBuilding.length} items — ${overview.nowBuilding[0]}${overview.nowBuilding.length > 1 ? ", …" : ""}`}
                </span>
              </span>
              <span>
                Ideas: <span className="font-black text-mn-blue tabular-nums">{overview.totalFeedback}</span>
              </span>
              <span>
                New to triage:{" "}
                <span className="font-black text-mn-blue tabular-nums">{overview.newCount}</span>
              </span>
              <span>
                Votes: <span className="font-black text-mn-blue tabular-nums">{overview.totalVotes}</span>
              </span>
              {overview.hiddenCount > 0 && (
                <span className="text-red-700">
                  Hidden: <span className="font-black tabular-nums">{overview.hiddenCount}</span>
                </span>
              )}
              <span className="ml-auto flex items-center gap-1.5 text-dark-gray/60 font-normal">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    isFetching ? "bg-mn-green animate-pulse" : "bg-dark-gray/30"
                  }`}
                  aria-hidden
                />
                Updated {updatedRel}
              </span>
            </div>
          )}
        </>
      )}
      <main className="flex-1 w-full max-w-6xl mx-auto py-10 px-6">
        {showAdminChrome && !isUnlocked ? (
          <div className="max-w-md mx-auto py-16 text-center">
            <h1 className="font-display text-2xl text-mn-blue uppercase tracking-wide">Checking admin access…</h1>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
