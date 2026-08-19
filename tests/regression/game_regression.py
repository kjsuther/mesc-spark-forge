#!/usr/bin/env python3
"""
Layer 2 of the regression suite: real-browser playthrough checks.

Run with:  npm run test:regression   (or: python3 tests/regression/game_regression.py)

Each case is small, named, and independent. A failure prints why and writes a
screenshot into tests/regression/results/ so the break is obvious.

The suite drives the live game through the debug hooks the game already
exposes:
  window.__gameDebug  -> k, player, zoneState, zoneObjectives, gates(), BIOME_W
  window.__gameInput   -> the shared input object (left/right/jumpReq/down)
  window.__gamePrompt  -> true while a step/briefing screen is waiting
"""

import asyncio
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE = os.environ.get("REGRESSION_BASE_URL", "http://localhost:8080")
RESULTS = Path(__file__).parent / "results"
RESULTS.mkdir(parents=True, exist_ok=True)

DESKTOP = {"width": 1280, "height": 800}
MOBILE_LANDSCAPE = {"width": 844, "height": 390}

ROUTES = ["/", "/about", "/about/poster", "/about/team", "/feedback", "/backlog", "/scores"]

results = []


def record(name, ok, detail=""):
    results.append((name, ok, detail))
    print(("PASS  " if ok else "FAIL  ") + name + (f"  — {detail}" if detail else ""))


async def shot(page, name):
    try:
        await page.screenshot(path=str(RESULTS / f"{name}.png"))
    except Exception:
        pass


async def boot_game(page, timeout_s=45):
    """Open the game and press through the title until the scene is live."""
    await page.goto(f"{BASE}/tool", wait_until="domcontentloaded")
    for _ in range(timeout_s):
        if await page.evaluate("!!window.__gameDebug"):
            return True
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(1000)
    return False


async def dismiss_prompts(page, tries=8):
    """Clear any briefing / step screen that is holding the game paused."""
    for _ in range(tries):
        if not await page.evaluate("window.__gamePrompt === true"):
            return True
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(700)
    return not await page.evaluate("window.__gamePrompt === true")


async def hold(page, key, ms):
    await page.evaluate(f"window.__gameInput.{key} = true")
    await page.wait_for_timeout(ms)
    await page.evaluate(f"window.__gameInput.{key} = false")


async def clear_overlay(page):
    """Dismiss the post-run score / feedback overlay if it is covering the game.

    Warping around a run can end it (win screen, score entry); that overlay eats
    keyboard input, so a case that follows must clear it or it reads as a freeze.
    """
    try:
        again = page.get_by_role("button", name="PLAY AGAIN")
        if await again.count() and await again.first.is_visible():
            await again.first.click()
            await page.wait_for_timeout(1500)
            # PLAY AGAIN can land on the title card; press through it.
            for _ in range(6):
                if await page.evaluate("!!window.__gameDebug"):
                    break
                await page.keyboard.press("Enter")
                await page.wait_for_timeout(800)
            await dismiss_prompts(page)
            return True
    except Exception:
        pass
    return False


async def warp_to_zone(page, zone):
    await clear_overlay(page)
    await page.evaluate(
        """(z) => { const d = window.__gameDebug;
             d.player.pos.x = d.BIOME_W * z + 80;
             d.player.pos.y = d.GROUND_Y; }""",
        zone,
    )
    await page.wait_for_timeout(1200)
    await dismiss_prompts(page)


async def can_move(page, ms=1200):
    """Try to walk. Either direction counts — a wall or arena edge can block one."""
    best = 0.0
    for key in ("right", "left"):
        await dismiss_prompts(page)
        before = await page.evaluate("window.__gameDebug.player.pos.x")
        await hold(page, key, ms)
        after = await page.evaluate("window.__gameDebug.player.pos.x")
        delta = abs(after - before)
        best = max(best, delta)
        if delta > 5:
            break
    return best, best > 5




# ------------------------------------------------------------------ cases ---


async def case_routes(page, errors):
    bad = []
    for route in ROUTES:
        before = len(errors)
        resp = await page.goto(f"{BASE}{route}", wait_until="domcontentloaded")
        await page.wait_for_timeout(1200)
        if resp is not None and resp.status >= 400:
            bad.append(f"{route} -> HTTP {resp.status}")
        if len(errors) > before:
            bad.append(f"{route} -> {errors[-1][:120]}")
    record("site routes load without console errors", not bad, "; ".join(bad))


async def case_boot(page, errors):
    before = len(errors)
    booted = await boot_game(page)
    if not booted:
        await shot(page, "fail-boot")
    record("game boots and exposes its debug hook", booted)
    record("no console errors during boot", len(errors) == before, "; ".join(errors[before:])[:200])
    return booted


async def case_physics_guard(page):
    patched = await page.evaluate("String(window.__gameDebug.k.body).includes('options')")
    record("physics crash guard is installed", bool(patched))


async def case_warmup_plaques(page):
    """No two coaching plaques may overlap — this is a readability regression."""
    await dismiss_prompts(page)
    boxes = await page.evaluate(
        """() => window.__gameDebug.k.get('signplaque')
              .filter(o => o.width && o.height)
              .map(o => ({x:o.pos.x, y:o.pos.y, w:o.width, h:o.height}))"""
    )
    overlaps = 0
    for i, a in enumerate(boxes):
        for b in boxes[i + 1 :]:
            # Same plaque stacks badge over label on purpose; only flag signs
            # whose columns are clearly different yet still collide.
            if abs(a["x"] - b["x"]) < 4:
                continue
            ax0, ax1 = a["x"] - a["w"] / 2, a["x"] + a["w"] / 2
            bx0, bx1 = b["x"] - b["w"] / 2, b["x"] + b["w"] / 2
            ay0, ay1 = a["y"] - a["h"] / 2, a["y"] + a["h"] / 2
            by0, by1 = b["y"] - b["h"] / 2, b["y"] + b["h"] / 2
            if ax0 < bx1 and bx0 < ax1 and ay0 < by1 and by0 < ay1:
                overlaps += 1
    if overlaps:
        await shot(page, "fail-warmup-plaques")
    record(
        "warm-up coaching plaques do not overlap",
        overlaps == 0,
        f"{overlaps} overlapping pairs of {len(boxes)} parts",
    )


async def case_movement(page):
    delta, moved = await can_move(page)
    if not moved:
        await shot(page, "fail-movement")
    record("hero walks in the warm-up zone", moved, f"moved {delta:.0f}px")

    y0 = await page.evaluate("window.__gameDebug.player.pos.y")
    await page.evaluate("window.__gameInput.jumpReq = true")
    await page.wait_for_timeout(250)
    y1 = await page.evaluate("window.__gameDebug.player.pos.y")
    record("hero jumps", y1 < y0 - 5, f"{y0:.0f} -> {y1:.0f}")
    await page.wait_for_timeout(900)


async def case_zone_walkthrough(page):
    """Every zone must accept input after the step screen for it opens.

    The final zone is excluded once the finale takes over: reaching the clinic
    hands control to the win cutscene, where a frozen hero is correct.
    """
    zones = await page.evaluate("window.__gameDebug.ZONES_LEN")
    stuck = []
    for zone in range(zones):
        await warp_to_zone(page, zone)
        _, moved = await can_move(page, 900)
        if not moved and await clear_overlay(page):
            # The run ended while warping; start a fresh one and retry the zone.
            await warp_to_zone(page, zone)
            _, moved = await can_move(page, 900)
        finale = await page.evaluate(
            "!!(window.__gameDebug.player.won || window.__gameDebug.zoneState.cutscene)"
        )
        if not moved and not finale:
            stuck.append(zone + 1)
            await shot(page, f"fail-zone-{zone + 1}")
    record("every zone accepts input after its step screen", not stuck, f"frozen zones: {stuck}")




async def case_boss_cinematic(page):
    """The Zone 7 boss intro must not kill the frame loop (past regression)."""
    await warp_to_zone(page, 6)
    cards = await page.evaluate(
        "() => window.__gameDebug.k.get('plan-pick').map(o => ({x:o.pos.x, y:o.pos.y}))"
    )
    if cards:
        await page.evaluate(
            """(c) => { const d = window.__gameDebug;
                 d.player.pos.x = c.x; d.player.pos.y = c.y; d.player.vel = d.k.vec2(0, 0); }""",
            cards[0],
        )
    for _ in range(14):
        if await page.evaluate("window.__gamePrompt === true"):
            await page.keyboard.press("Enter")
        if not await page.evaluate("window.__gameDebug.zoneState.cutscene"):
            break
        await page.wait_for_timeout(1000)
    await dismiss_prompts(page)

    t1 = await page.evaluate("window.__gameDebug.k.time()")
    await page.wait_for_timeout(700)
    t2 = await page.evaluate("window.__gameDebug.k.time()")
    record("game clock keeps running after the boss cinematic", t2 > t1, f"{t1:.1f} -> {t2:.1f}")

    delta, moved = await can_move(page)
    if not moved and await clear_overlay(page):
        await warp_to_zone(page, 6)
        delta, moved = await can_move(page)
    if not moved:
        await shot(page, "fail-boss-controls")
    record("controls respond after the boss cinematic", moved, f"moved {delta:.0f}px")


async def case_lives_and_failure(page):
    """Losing every life must show the failure screen with its checklist."""
    await clear_overlay(page)
    await page.evaluate(
        """() => { const d = window.__gameDebug; d.player.lives = 1; }"""
    )
    for _ in range(12):
        await page.evaluate(
            """() => { const d = window.__gameDebug; d.player.pos.y = d.GROUND_Y + 400; }"""
        )
        await page.wait_for_timeout(700)
        if await page.evaluate("window.__gameDebug.player.dead === true"):
            break
    dead = await page.evaluate("window.__gameDebug.player.dead === true")
    await shot(page, "failure-screen")
    record("losing the last life ends the run", bool(dead))

    texts = await page.evaluate(
        "() => window.__gameDebug.k.get('*', {recursive:true}).map(o => o.text).filter(Boolean).join(' | ')"
    )
    record(
        "failure screen lists what was still needed",
        "STILL NEEDED" in (texts or "").upper(),
        (texts or "")[:120],
    )


async def case_restart(page):
    """Acknowledge the failure screen, then reset — a full fresh run must boot."""
    fresh = False
    for attempt in range(3):
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(900)
        await clear_overlay(page)
        await page.evaluate("window.__gameInput.resetReq = true")
        for _ in range(8):
            await page.wait_for_timeout(900)
            fresh = await page.evaluate(
                """() => { const p = window.__gameDebug && window.__gameDebug.player;
                     return !!p && p.dead !== true && p.lives === p.maxLives && p.lives >= 3; }"""
            )
            if fresh:
                break
        if fresh:
            break
    if not fresh:
        await shot(page, "fail-restart")
    record("restart after a failure starts a fresh run with full lives", bool(fresh))




async def run_profile(browser, label, viewport, full):
    context = await browser.new_context(viewport=viewport)
    page = await context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on(
        "console",
        lambda m: errors.append(m.text) if m.type == "error" else None,
    )

    print(f"\n=== {label} ({viewport['width']}x{viewport['height']}) ===")
    if full:
        await case_routes(page, errors)
    if await case_boot(page, errors):
        await case_physics_guard(page)
        await case_warmup_plaques(page)
        await case_movement(page)
        if full:
            await case_zone_walkthrough(page)
            await case_boss_cinematic(page)
            await case_lives_and_failure(page)
            await case_restart(page)
    await context.close()


async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        await run_profile(browser, "desktop", DESKTOP, full=True)
        await run_profile(browser, "mobile landscape", MOBILE_LANDSCAPE, full=False)
        await browser.close()

    failed = [name for name, ok, _ in results if not ok]
    print("\n================ REGRESSION SUMMARY ================")
    for name, ok, detail in results:
        print(f"{'PASS' if ok else 'FAIL'}  {name}{('  — ' + detail) if detail and not ok else ''}")
    print(f"{len(results) - len(failed)}/{len(results)} passed")
    if failed:
        print("Screenshots for failures: tests/regression/results/")
        sys.exit(1)


asyncio.run(main())
