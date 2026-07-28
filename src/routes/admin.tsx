import { createFileRoute, Outlet, Link, redirect, useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isServer } from "@tanstack/router-core/isServer";
import { useEffect } from "react";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";
import { getAdminStatus } from "@/lib/admin.functions";
import { clearAdminAccessToken } from "@/lib/admin-auth-attacher";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Blazing the Trail to Coverage" },
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

function AdminLayout() {
  const { unlocked } = Route.useRouteContext();
  const router = useRouter();
  const queryClient = useQueryClient();
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

  async function handleLock() {
    clearAdminAccessToken();
    queryClient.setQueryData(["admin-status"], { unlocked: false });
    try {
      await Promise.race([
        fetch("/admin/lock", { method: "POST", headers: { Accept: "application/json" } }),
        new Promise((resolve) => window.setTimeout(resolve, 800)),
      ]);
    } finally {
      window.location.replace("/admin/unlock?reason=expired");
    }
  }

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
        <div className="bg-mn-blue text-white px-6 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-2 items-center flex-wrap">
            <span className="uppercase tracking-widest text-[10px] font-black bg-accent-gold text-mn-blue px-2 py-1 rounded mr-2">
              Admin
            </span>
            <Link to="/admin/game" activeProps={navActive} inactiveProps={navInactive}>
              Game
            </Link>
            <Link to="/admin/feedback" activeProps={navActive} inactiveProps={navInactive}>
              Player Feedback
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
