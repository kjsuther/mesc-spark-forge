# Split About into two subpages + editable team profiles

## What you'll get

**About Our Poster** — the current About page content (the loop, why a game, real front door, responsible AI, today vs. future, path forward), unchanged, now living at `/about/poster`.

**About Us** — a new page at `/about/team` with profile cards for the MN DHS crew attending MESC 2026. Each card shows a photo (or colored initials if no photo), name, title, and optional short bio.

Both pages sit under an "About" section with a small tab switcher at the top, and the header "About" link lands on About Our Poster by default.

## Starting roster

Seeded with the nine people listed, using the five photos provided (Kevin, Lauren, PJ, Becky, Matt); the other four show initials until a photo is added:

1. Kevin Sutherland — Founder & Chief Value Officer, Strategic Innovation Consulting (photo)
2. Lauren Siegel — Medicaid Systems Transformation Coordinator (photo)
3. Pamela "PJ" Weiner — Deputy Assistant Commissioner, Health Care Administration (MN DHS) (photo)
4. Nekheti Nefer-Ra — MES Modernization and Implementation Manager, Health Care Administration (MN DHS)
5. Dustin "Dusty" Letica — Deputy Director of Public Health & Human Services (St. Louis County, MN)
6. Rebecca "Becky" Melang — Enterprise Technology Manager, Business Solutions Office (MN DHS) (photo)
7. Matthew "Matt" Woods — Director of Medicaid Business Integration, Payments and Provider Services, Health Care Administration (MN DHS) (photo)
8. Donald "Don" Ortega — Business Analysis Supervisor, Minnesota IT Services (MNIT)
9. Ryan Smith — Modernization Consultant, Health Care Administration (MN DHS)

## Admin editing

A new "Team" tab in the Admin site where you can:

- Add a person (name, title, optional bio, optional photo upload)
- Edit any field, replace or remove a photo
- Reorder people (move up / down) — controls the display order on About Us
- Hide a person from the public page without deleting them
- Delete a person

Photo uploads accept common image types up to ~5 MB and are stored in the app's file storage.

## Technical notes

- Routes: `src/routes/about.tsx` becomes a layout (section header + tabs + `<Outlet />`); `about.index.tsx` redirects to `/about/poster`; `about.poster.tsx` holds today's About content; `about.team.tsx` is the new page. Each leaf route gets its own `head()` metadata.
- Database migration: `public.team_members` (id, full_name, title, bio, photo_path, sort_order, hidden, timestamps) with `GRANT SELECT TO anon, authenticated`, RLS enabled, a public read policy limited to `hidden = false`, and `GRANT ALL TO service_role`. Seed INSERTs for the nine people in the same migration.
- Storage: public bucket `team-photos` created via the storage tool; the five provided headshots uploaded and referenced by the seed rows.
- Server functions in `src/lib/team.functions.ts`: public `listTeamMembers`, and admin `listTeamMembersAdmin` / `upsertTeamMember` / `deleteTeamMember` / `reorderTeamMembers` / `uploadTeamPhoto`, all behind the existing `requireAdmin()` session check and using `supabaseAdmin` loaded inside handlers.
- Admin UI: `src/routes/admin.team.tsx`, added to the admin nav in `src/routes/admin.tsx`.
- Initials fallback rendered client-side from the person's name (first + last initial) on a themed tile — no image request when no photo exists.
