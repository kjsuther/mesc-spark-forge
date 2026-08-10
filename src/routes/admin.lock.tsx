import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/lock")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const wantsJson = request.headers.get("accept")?.includes("application/json");
        const { createAdminClearCookieHeader } = await import("@/lib/admin-session.server");
        const headers = new Headers({ "Set-Cookie": createAdminClearCookieHeader() });

        if (wantsJson) {
          return Response.json({ ok: true, redirectTo: "/admin/unlock" }, { headers });
        }

        headers.set("Location", "/admin/unlock");
        return new Response(null, { status: 303, headers });
      },
    },
  },
});
