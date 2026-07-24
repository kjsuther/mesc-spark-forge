## Problem

The Poster View (`/admin/poster`) is currently rendered inside the shared `/admin` layout, which always renders `<SiteChrome />`. Because `SiteChrome` has `z-40`, it appears on top of the Poster View’s full-screen iframe, so the public site navigation (Home, Backlog, Version History, About, Demo Client Tool, Share Feedback) remains visible. The user wants that top-level navigation fully hidden **only** while Poster View is selected, and restored when exiting Poster View.

## Plan

1. Update the `/admin` layout (`src/routes/admin.tsx`) to recognize the Poster View route (`pathname === "/admin/poster"`).
2. When on Poster View, suppress all chrome that belongs to the regular admin/site experience:
   - `<SiteChrome />` (public site header + demo banner)
   - `<SiteFooter />` (admin footer link)
   - The admin sub-navigation bar (Feedback / Now Building / Versions / Subscribers / Poster View)
   - The section-label breadcrumb
   - The live overview stats bar
3. Remove the `max-w-6xl mx-auto py-10 px-6` wrapper on `<main>` for Poster View so the fixed full-screen Poster View can extend edge-to-edge without competing layout padding.
4. Keep the Poster View’s own top bar with "Blazing Better Trails · Live Poster Board" and the "Exit poster view" button that returns to `/admin`.
5. When "Exit poster view" navigates to `/admin`, the normal layout re-evaluates, and the site header/admin chrome reappears automatically.

No route structure changes are needed; the Poster View stays protected by the existing `/admin` `beforeLoad` auth check.

## Files to edit

- `src/routes/admin.tsx`