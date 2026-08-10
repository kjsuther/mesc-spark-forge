# Mobile header cleanup + poster view fit

## 1. Mobile top nav (src/components/site-header.tsx)

The mobile/tablet header currently shows the logos, an orange "Play the Game" button, and the hamburger — which squeezes the MN DHS logo so it clips mid-word.

- Remove the orange "Play the Game" button from the mobile/tablet header row, leaving just the two logos and the hamburger.
- Keep it inside the hamburger menu (already there) and keep the desktop header button unchanged.
- Homepage "Play the game" hero button is untouched.

## 2. Poster view fits 3 scores + 4 items per panel

Currently the sidebar's three panels are sized so the third high score is cut in half, and each feedback panel shows only 3 long, wrapping entries.

- Sidebar row sizing (`src/routes/admin.poster.tsx`): give the leaderboard a fixed height sized to header + 3 rows + footer so all three scores are always fully visible, and split the remaining height evenly between Implemented and Feedback Backlog.
- Poster panels (`src/components/game/feedback-board.tsx`): show up to 4 items instead of 3.
- Keep long submissions from pushing items off-screen: clamp each poster entry's description to 2 lines with an ellipsis, tighten row padding and text size slightly, and move the submitter name onto the same clamped block so row height is predictable.
- Leaderboard poster rows (`src/components/game/leaderboard.tsx`): slightly tighter padding/leading so three rows fit comfortably in the fixed panel.
- The "+N more · see the full list" footer keeps reporting anything beyond the 4 shown.

## Technical notes

- Only presentation changes: no query, schema, or scoring changes. Full descriptions remain intact on `/backlog` and the admin feedback page; the clamp is display-only in the poster panels.
