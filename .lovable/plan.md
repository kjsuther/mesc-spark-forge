## Changes

### 1. Homepage (`src/routes/index.tsx`)
- Update hero subtext to: "Play our game and see if you can tackle the journey of applying for Medicaid! You'll vote on upgrades that can assist you in your journey and see those upgrades be developed live based on your feedback."
- Under the hero "Play the game" button, add a second button "How this works" that scrolls to the How it Works section (anchor `#how-it-works`). Add `id="how-it-works"` to that section.
- In each step card of the How It Works section, remove the CTA button — leave the number, title, and body only.

### 2. Admin: remove Version History
- Delete `src/routes/admin.versions.tsx`.
- Confirm `src/routes/admin.tsx` no longer references it (already the case based on current nav).
- Leave the public `/changelog` route and the header "Version History" link alone (user asked to remove from Admin Site only).

### 3. About page (`src/routes/about.tsx`)
- Remove the entire "Impact Wall" section (lines ~102–190), including `StatCard`, `showStates`, `showRoles` state, feedback/votes queries, the realtime supabase subscription, and the `stats` memo tied to it.
- Remove now-unused imports (`useSuspenseQuery`, `useQueryClient`, `useEffect`, `useMemo`, `useState`, `feedbackListQuery`, `votesListQuery`, `supabase`, `UsContributorMap`, `normalizeStateCode`) and drop the route `loader`.

### 4. Admin unlock password
- The failing "Unable to unlock admin access…" message is the catch-all when the POST to `/admin/unlock` returns a server error — most likely because `ADMIN_PASSWORD` and/or `SESSION_SECRET` are not currently set on the deployed environment (the handler throws when they're missing).
- Re-set both secrets via the secrets tool so `ADMIN_PASSWORD = ME$C26MNDHs` and `SESSION_SECRET` has a valid 32+ char value, then verify sign-in.

## Out of scope
- No DB changes.
- No changes to the public `/changelog` page or the header link to it.
- No game/mechanics changes.