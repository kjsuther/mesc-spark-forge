# Feedback role/location capture + backlog dashboard

## What changes

### 1. Share Feedback page
Two new required fields on the feedback form, next to the existing name field:

- **Role** — dropdown of common conference roles (State agency staff, County/local agency staff, Eligibility worker, Navigator/assister, Policy, IT/technical, Vendor/partner, Advocate/community, Researcher/academic, Other) with a short free-text box when "Other" is picked.
- **Where you're from** — dropdown of all 50 US states + DC + territories, plus an "Outside the US" option that reveals a country text box.

Submissions still land on the public backlog exactly as they do now.

### 2. Feedback Backlog page — small dashboard above the list

A compact stats strip, live-updating (it already subscribes to feedback changes in real time):

- Total feedback received
- Total implemented
- Number of states/countries represented

Below the strip, two collapsed toggles (closed by default):

- **Roles represented** — each role with a count and a proportional bar, sorted by count.
- **Where feedback came from** — an inline SVG map of the US with states shaded by feedback volume, hover/tap tooltip showing state + count, and a short list of non-US countries underneath when any exist.

Both toggles use the existing accordion styling from the About page so it matches the rest of the site.

## Technical notes

- **Migration** on `public.game_feedback`: add `role text`, `role_other text`, `location_state text`, `location_country text` (all nullable so existing rows stay valid). Public insert policy updated to allow the new columns with length limits; public read policy already exposes the row, and these fields are non-identifying so they stay readable for the dashboard.
- `src/lib/feedback.functions.ts` — `submitGameFeedback` validator gains role/state/country with allow-list checks against a shared constants module (`src/lib/feedback-options.ts`) so client and server agree.
- `src/lib/feedback.queries.ts` — `GameFeedback` type + select list gain the new columns; add a `summarizeFeedback()` helper computing totals, role counts and state/country counts.
- `src/components/game/feedback-form.tsx` — new selects + conditional text inputs.
- New `src/components/game/feedback-stats.tsx` — the dashboard strip, roles panel, and map, rendered above `<FeedbackBoard />` on `/backlog`.
- New `src/components/game/us-map.tsx` — self-contained SVG state paths (no external map library or network calls), shaded from the counts.
- Admin feedback view gains a small role/state line per item so the team can see context; poster view is untouched.
- Service worker cache name bumped so returning visitors get the new page.
