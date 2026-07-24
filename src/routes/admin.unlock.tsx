import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { saveAdminAccessToken } from "@/lib/admin-auth-attacher";
import { getAdminStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/unlock")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const formData = await request.formData();
        const password = String(formData.get("password") ?? "");
        const wantsJson = request.headers.get("accept")?.includes("application/json");
        const expected = process.env.ADMIN_PASSWORD;
        if (!expected) throw new Error("ADMIN_PASSWORD not set");

        const { createAdminAccessToken, createAdminUnlockCookieHeader, passwordMatches } = await import("@/lib/admin-session.server");
        if (!passwordMatches(password, expected)) {
          if (wantsJson) {
            return Response.json({ ok: false });
          }

          return new Response(null, {
            status: 303,
            headers: { Location: "/admin/unlock?error=1" },
          });
        }

        const token = createAdminAccessToken();
        const headers = new Headers({
          "Set-Cookie": createAdminUnlockCookieHeader(token),
        });

        if (wantsJson) {
          return Response.json({ ok: true, redirectTo: "/admin", token }, { headers });
        }

        const redirectHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="1;url=/admin" />
    <title>Opening admin…</title>
  </head>
  <body>
    <p>Opening admin…</p>
    <script>
      window.sessionStorage.setItem("mn-dhs-admin-token", ${JSON.stringify(token)});
      window.location.replace("/admin");
    </script>
  </body>
</html>`;

        return new Response(redirectHtml, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Set-Cookie": createAdminUnlockCookieHeader(token),
          },
        });
      },
    },
  },
  validateSearch: (search: Record<string, unknown>) => {
    const parsed: { error?: boolean; reason?: string } = {};
    if (search.error === "1" || search.error === 1 || search.error === true) parsed.error = true;
    if (typeof search.reason === "string") parsed.reason = search.reason;
    return parsed;
  },
  head: () => ({
    meta: [
      { title: "Admin Sign In — [Your State] DHS Navigator" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: UnlockPage,
});

function UnlockPage() {
  const { error, reason } = Route.useSearch();
  const router = useRouter();
  const queryClient = useQueryClient();
  const checkAdminStatus = useServerFn(getAdminStatus);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [message, setMessage] = useState<string | null>(error ? "Incorrect password." : null);

  useEffect(() => {
    if (error) {
      setMessage("Incorrect password.");
      toast.error("Incorrect password.");
    }
  }, [error]);

  useEffect(() => {
    let cancelled = false;

    checkAdminStatus()
      .then((status) => {
        if (!cancelled && status.unlocked) {
          router.navigate({ to: "/admin", replace: true });
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [checkAdminStatus, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    setBusy(true);
    setMessage(null);

    try {
      const body = new FormData();
      body.set("password", password);
      const response = await fetch("/admin/unlock", {
        method: "POST",
        body,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) throw new Error("Unlock request failed");
      const result = (await response.json()) as { ok: boolean; redirectTo?: string; token?: string };

      if (!result.ok) {
        setMessage("Incorrect password.");
        toast.error("Incorrect password.");
        return;
      }

      toast.dismiss();
      if (result.token) saveAdminAccessToken(result.token);
      setMessage("Unlocked. Opening admin…");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-status"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
        router.invalidate(),
      ]);
      await router.navigate({ to: result.redirectTo ?? "/admin", replace: true });

      window.setTimeout(() => {
        if (window.location.pathname === "/admin/unlock") {
          window.location.replace(result.redirectTo ?? "/admin");
        }
      }, 900);
    } catch {
      setMessage("Unable to unlock admin access. Please try again.");
      toast.error("Unable to unlock admin access.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto py-16">
      <h1 className="font-display text-3xl text-mn-blue uppercase tracking-wide mb-2">Admin sign in</h1>
      <p className="text-sm text-dark-gray/70 mb-6">
        For MN DHS presenters. Enter the shared admin password to manage feedback status,
        Now Building, and version releases.
      </p>
      {reason === "expired" && !error && (
        <p
          aria-live="polite"
          className="mb-4 rounded-lg border border-mn-blue/30 bg-mn-blue/5 px-3 py-2 text-sm font-semibold text-mn-blue"
        >
          Your admin session ended. Sign in again to continue.
        </p>
      )}
      <form method="post" action="/admin/unlock" onSubmit={handleSubmit} className="space-y-4">
        <div className="block">
          <label htmlFor="admin-password" className="text-xs font-bold uppercase tracking-widest text-mn-blue">
            Password
          </label>
          <span className="relative mt-1 block">
            <input
              id="admin-password"
              type={showPassword ? "text" : "password"}
              name="password"
              autoFocus
              autoComplete="current-password"
              onKeyDown={(e) => setCapsOn(e.getModifierState("CapsLock"))}
              onKeyUp={(e) => setCapsOn(e.getModifierState("CapsLock"))}
              className="w-full border-2 border-light-gray focus:border-mn-blue rounded-lg px-4 py-3 pr-20 outline-none"
              required
              disabled={busy}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold uppercase tracking-wide text-mn-blue hover:underline disabled:opacity-50"
              disabled={busy}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </span>
          {capsOn && (
            <p className="text-[11px] font-semibold text-accent-gold mt-1">⚠ Caps Lock is on</p>
          )}
        </div>
        {message && (
          <p aria-live="polite" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {message}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-mn-blue text-white font-bold py-3 rounded-lg hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
