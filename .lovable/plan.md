# Game tuning: controls, Zone 7 surprise boss, continuous waves, harder Zone 3

## 1. On-screen controls only on real phones/tablets

Today the pad buttons are gated on a general "touch" profile, and the Controls screen does its own separate `(pointer: coarse)` check — so a touchscreen laptop or a browser that reports coarse pointer can get mobile buttons and mobile instructions on a desktop.

- Make one shared decision: on-screen pads render only when the device is a real mobile device (iOS/iPadOS/Android detection plus touch points), never on desktop/laptop even if the screen is touch-capable.
- The Controls screen reads that same decision instead of its own media query, so the instruction card always matches the device: arrow keys / space / R / Esc on desktop and laptop, on-screen ◀ ▶ / JUMP / tap on mobile.
- In-game prompts (jump hint, continue, restart) already route through the shared helper; they inherit the tightened check automatically.

## 2. Zone 7 briefing keeps the bear a surprise

The Step 7 briefing currently spells out the bear, his paperwork, and the five hits needed.

- Trim it to the plan choice only: pick one of the three managed care plans, and that unlocks the way forward. Icons reduced to the three plans — boss sprite and "your shot" icon removed.
- No other Zone 7 text changes; the charge-in cinematic still delivers the reveal.

## 3. Boss throws continuous waves

Right now the boss only throws at the apex of a jump, and at most three shots can be alive at once, so there are long silent stretches and it can read as a single wave.

- Add a ground-level throw on its own cooldown so waves keep coming between jumps, while jump throws still vary the height.
- Keep the pacing dodgeable: a wave every ~1.2-1.6s (a bit tighter in the rage phase), with spacing inside each wave so a single well-timed jump clears it. Raise the live-shot cap modestly to match the new cadence.
- Waves continue until he is defeated; all shots are still cleared on defeat.

## 4. Zone 3 platforms faster and taller

- Increase the bobbing speed of the four river platforms and widen their travel so they rise close to the top of the canvas and drop near the ground line, making the crossing demand real timing.
- Amplitude clamped so no platform leaves the visible play area or sinks into the water plane; labels and rider physics follow as they do now.

## Technical notes

- Files touched: `src/lib/device.ts` (stricter mobile check), `src/components/game/game-canvas.tsx` (pad gating, Controls screen), `src/components/game/game-scenes.ts` (Step 7 briefing copy, boss shot cadence, Zone 3 platform `amp`/`spd`).
- No scoring, par time, or other zone content changes.
- Verification: Playwright at a desktop viewport (no pads, desktop instruction card), iPhone and Pixel viewports (pads present, mobile card), plus a Zone 3 crossing and a Zone 7 boss run to confirm dodgeable repeat waves.
