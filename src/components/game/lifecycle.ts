export const MOBILE_RESUME_RECOVERY_DELAY_MS = 750;

type ResumeRecoveryInput = {
  isTouch: boolean;
  hiddenAt: number | null;
  visibleAt: number;
  contextWasLost?: boolean;
  pageWasRestored?: boolean;
};

/**
 * Mobile Safari may keep a WebGL context alive while discarding its texture
 * atlas in the background. A short, touch-only restart is therefore safer
 * than trusting the first frame after a meaningful suspend.
 */
export function shouldRecoverGameAfterResume({
  isTouch,
  hiddenAt,
  visibleAt,
  contextWasLost = false,
  pageWasRestored = false,
}: ResumeRecoveryInput): boolean {
  if (contextWasLost || pageWasRestored) return true;
  if (!isTouch || hiddenAt === null) return false;
  return visibleAt - hiddenAt >= MOBILE_RESUME_RECOVERY_DELAY_MS;
}

export function clampResumeZone(zone: number, zoneCount = 8): number {
  if (!Number.isFinite(zone) || zoneCount <= 0) return 0;
  return Math.min(zoneCount - 1, Math.max(0, Math.floor(zone)));
}
