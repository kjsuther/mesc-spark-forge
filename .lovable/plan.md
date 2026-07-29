## 1. Homepage heading

In `src/routes/index.tsx` (line 145), change the eyebrow text "A practical path forward" to "What's the Concept?". No other homepage copy changes.

## 2. About page — connect the game to real Medicaid pain points

Insert a new section immediately after the "Why a video game?" block in `src/routes/about.tsx`, keeping every existing section intact.

The new section ("From the game to the real front door") does three things:
- A short lead paragraph stating that every obstacle in the game is a stand-in for a real barrier applicants hit, and that fixing it in the game is a fast, cheap rehearsal for fixing it in the actual system.
- A mapping grid: each row pairs a game moment with the real-world pain point and the kind of real tool/change it points at. Examples drawn from the existing zones:
  - Smashing bricks to find the right application → applicants don't know which channel to use → one clear front door with guided intake
  - Account lockouts → password/identity friction blocks people before they start → simpler identity and account recovery
  - Missing documents → verification churn and repeated document requests → data-matching and reuse of documents already on file
  - Waiting for a decision (falling calendar pages) → silence during processing drives calls and churn → proactive status updates and self-service status checks
  - The "Denied" boss → notices people can't act on → plain-language notices with next steps
- A closing paragraph on why this elevates real outcomes: faster alignment on concepts, testable ideas before procurement, and changes that trace back to a named person's feedback.

Styling reuses existing tokens (cream/navy cards, `border-mn-blue/20`, `font-display` heading) so it matches the surrounding page.

## 3. Poster View — three balanced panels

In `src/routes/admin.poster.tsx`, replace the current 2-row sidebar with a 3-row sidebar: High Scores, Implemented, Feedback Backlog. Grid rows become `minmax(0,0.85fr) minmax(0,1fr) minmax(0,1fr)` so High Scores is slightly smaller and the other two are equal.

- **High Scores**: already limited to top 3; make the poster variant more compact (tighter padding/row height) so it fits the smaller panel.
- **Implemented (new)**: add an `"poster-implemented"` variant to `src/components/game/feedback-board.tsx` showing the 3 most recent implemented items (already sorted newest-first by `splitFeedback`), with a green header, a ✓ marker per item, a total count badge, and a footer line like "+N more · see the full list at mesc.mn-dhs.online/backlog" when there are more than 3.
- **Feedback Backlog**: limit the existing poster variant to the top 3 ranked items, keep the numbered gold badges, and add the same "+N more on the main site" footer line.

Both feedback panels share one presentational sub-component so their sizing, type scale, and footer treatment are identical.

## Technical notes

- Files touched: `src/routes/index.tsx`, `src/routes/about.tsx`, `src/routes/admin.poster.tsx`, `src/components/game/feedback-board.tsx`, `src/components/game/leaderboard.tsx` (poster variant density only).
- No database, query, or server-function changes — `gameFeedbackQuery` and `splitFeedback` already return everything needed; slicing happens in the poster components so the public `/backlog` page still shows the full lists.
