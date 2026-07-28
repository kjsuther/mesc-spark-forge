## Goal

Make the site read clearly as "play a video game → give feedback → we build it → replay". Break the Play Game page into focused subpages, add top-level navigation, and wire in-game links to feedback.

## 1. New routes (top-level nav)

Create three subpages, each with its own `head()` metadata, shared header/footer:

- `/feedback` — **Share Feedback**: intro copy explaining you're giving feedback on the game, the existing feedback form, plus a prominent link to the Backlog page and a "Back to the game" link.
- `/backlog` — **Feedback Backlog**: the existing backlog board (open items in team-ranked order + already-implemented list), with a link to Share Feedback and Play Game.
- `/scores` — **High Scores**: the existing top-3 leaderboard panel, with a link to Play Game.

Add all three to `NAV_LINKS` in the site header (desktop + mobile sheet), keeping "Play the Game" as the orange CTA. Also add them to the site footer links.

## 2. Play Game page (`/tool`) slimmed down

- Rename the version tab **"After feedback" → "Current Version"** (the other stays "Original Version"). Update the helper text and any other wording that says "After Feedback" on the public site (backlog board copy).
- Make the intro copy explicitly say this is a retro **video game** you play and give feedback on.
- Keep only: intro, version toggle, "best played on desktop/laptop" notice, game canvas.
- Remove the inline feedback form, backlog board, and leaderboard from this page.
- Below the canvas add a button row: **Share feedback**, **View backlog**, **High scores**.

## 3. In-game links to feedback

- In the end-of-run overlay (shown after a win or a death), add a clearly styled 16-bit-looking **"Tell us what to fix →"** action that navigates to `/feedback`, alongside the existing name-entry / close actions. Works with both click and touch.
- Note: the "Thank You" finale is drawn inside the game canvas engine, so the link will be surfaced by the same end-of-run overlay that appears on completion (it fires on win as well as loss). If you'd rather have a link painted inside the canvas art itself, that's a bigger engine change — say the word.

## 4. Home page

Below the hero and above the steps, add a dark navy "practical path forward" band styled like the reference image: small gold eyebrow label, large two-line headline, and a row of small cards — reworded for this project (e.g. "Play it", "Tell us what's broken", "We build it live", "Play the better version", "Repeat").

Reduce the steps from four to three, each with a button:

1. **Play the game** → button to `/tool`
2. **Tell us what to fix** → button to `/feedback`
3. **Come back and replay the new version** → button to `/tool`

Mention "View the backlog" as an optional aside with a link to `/backlog`. Rewrite hero and section copy to drop the removed voting/timer/5-upgrade language.

## 5. About page

Rewrite the copy around the game loop: attendees play the game, submit feedback, the poster team implements it during the session, and players re-test live — showing how fast teams can align on concepts when the feedback loop is minutes instead of months. Keep the AI-transparency and "today vs. possible" sections but re-word them to the game context; fix the "[Your State]" placeholders in the metadata.

## Technical notes

- New route files: `src/routes/feedback.tsx`, `src/routes/backlog.tsx`, `src/routes/scores.tsx`, reusing `FeedbackForm`, `FeedbackBoard`, and `Leaderboard` components as-is.
- Loaders prime `gameFeedbackQuery` where needed; the existing realtime subscription moves to the pages that show feedback data.
- No database or admin-site changes — the admin backlog ranking/status flow stays as it is.
