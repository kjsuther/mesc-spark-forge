import { useEffect } from "react";
import { subscribeGamepad } from "@/lib/gamepad";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function visible(el: HTMLElement): boolean {
  if (el.hidden || el.getAttribute("aria-hidden") === "true") return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none";
}

function focusables(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(visible);
}

/**
 * Lets a USB controller drive the marketing site: stick/D-pad moves focus
 * between links and buttons, the main button activates, B goes back.
 *
 * Focus is real browser focus, so keyboard and screen-reader behavior are
 * untouched. While the game has capture (a run or its menus are on screen)
 * this hook stands down so the stick only drives the hero.
 */
export function useGamepadNavigation() {
  useEffect(() => {
    const captured = () =>
      (window as unknown as { __gamepadGameCapture?: boolean }).__gamepadGameCapture === true;

    const move = (delta: number) => {
      const items = focusables();
      if (items.length === 0) return;
      const active = document.activeElement as HTMLElement | null;
      const idx = active ? items.indexOf(active) : -1;
      const base = idx === -1 ? (delta > 0 ? -1 : 0) : idx;
      const next = items[(((base + delta) % items.length) + items.length) % items.length];
      if (!next) return;
      active?.classList.remove("gamepad-focus");
      next.focus({ preventScroll: true });
      next.classList.add("gamepad-focus");
      next.addEventListener("blur", () => next.classList.remove("gamepad-focus"), { once: true });
      next.scrollIntoView({ block: "center", behavior: "smooth" });
    };


    return subscribeGamepad((f) => {
      if (captured()) return;
      // Never let a stray controller press reach destructive admin controls.
      if (window.location.pathname.startsWith("/admin")) return;
      const typing =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement instanceof HTMLSelectElement;

      // While someone is filling in a field, the stick stays out of the way:
      // no focus hopping mid-answer.
      if (typing) {
        if (f.back) (document.activeElement as HTMLElement).blur();
        return;
      }

      if (f.tapDown || f.tapRight) move(1);
      else if (f.tapUp || f.tapLeft) move(-1);

      if (f.confirm && !typing) {
        const el = document.activeElement as HTMLElement | null;
        if (el && el !== document.body) el.click();
      }
      if (f.back) window.history.back();
      if (f.start) window.location.assign("/tool");
    });
  }, []);
}
