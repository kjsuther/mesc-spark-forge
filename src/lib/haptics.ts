// ============================================================================
// Tiny haptics helper: short vibration on phones, light rumble on a connected
// gamepad. Everything is feature-detected and wrapped in try/catch so this is
// always safe to call (including where unsupported, e.g. iOS Safari).
// ============================================================================

/** Fire a short haptic pulse. `strength` is 0..1, `ms` the duration. */
export function pulse(ms = 35, strength = 0.35) {
  if (typeof navigator === "undefined") return;

  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }

  try {
    const pads = navigator.getGamepads?.() ?? [];
    for (const pad of pads) {
      if (!pad) continue;
      const actuator = (
        pad as Gamepad & {
          vibrationActuator?: {
            playEffect?: (type: string, params: Record<string, number>) => Promise<unknown>;
          };
        }
      ).vibrationActuator;
      void actuator?.playEffect?.("dual-rumble", {
        startDelay: 0,
        duration: ms,
        weakMagnitude: Math.min(1, Math.max(0, strength)),
        strongMagnitude: Math.min(1, Math.max(0, strength * 0.5)),
      })?.catch(() => {});
    }
  } catch {
    /* ignore */
  }
}
