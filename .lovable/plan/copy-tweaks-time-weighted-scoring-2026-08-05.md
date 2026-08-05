# Copy tweaks + time-weighted scoring

## 1. Homepage copy (src/routes/index.tsx)

- Hero paragraph: "Then tell us what to fix" -> "Then tell us what to improve".
- Concept headline: "Start with a real player. Listen to the feedback. Make the change today. Ship it while they wait."
- Loop card 2: "Say what's broken" -> "Suggest improvements".
- How-it-works step 2 title: "Tell us what to fix" -> "Suggest improvements".

Matching phrasing on the related pages (`/tool` intro line and the page descriptions on `/feedback` and `/tool`) is updated the same way so the site reads consistently.

## 2. Make finish time matter a lot more

Today the only time-based term is a small `4000 - durationMs/100` bonus on a win, so a 1:36 run and a 3:16 run land within ~1,000 points of each other while base points (distance, jumps, docs, enemies) dominate.

New end-of-run model, applied in `buildResult()` in `src/components/game/game-scenes.ts` (and mirrored in the frozen original build so both versions score the same way):

- Keep the accumulated play score as the base.
- Replace the flat time bonus with a **speed multiplier** on the whole run score, based on finish time against a par time (~2:30 for a full run, scaled by how many of the 8 zones were reached so partial runs are judged fairly):
  - at or under ~60s of par: x2.0
  - at par: x1.0
  - well over par (2x par or slower): floors at x0.5
  - interpolated smoothly in between
- Keep the win bonus (2000) and remaining-lives bonus (500 each) as flat additions after the multiplier, so finishing still clearly beats not finishing.

Effect on the reported example: the 1:36 run scores roughly 1.6-1.8x the 3:16 run instead of being effectively tied.

## Technical notes

- `src/lib/score-validation.ts` caps score at 250,000; the multiplier keeps typical runs well under that, and the cap stays as an anti-tamper guard.
- Leaderboard display and the in-canvas score entry need no changes — they read the final score.
- Existing rows in the leaderboard were scored under the old formula; they stay as-is unless you want the board cleared (there is already an admin reset).
