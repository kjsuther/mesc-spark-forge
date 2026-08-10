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

/** A run snapshot older than this is treated as a new session, not a resume. */
export const SNAPSHOT_MAX_AGE_MS = 30 * 60_000;

type SnapshotLike = {
  savedAt: number;
  elapsedMs: number;
  zone: number;
  score: number;
} | null;

/**
 * Decides whether a stored run snapshot may be used to resume. A resumed run
 * must carry its full elapsed clock forward — otherwise a player who
 * backgrounds Safari mid-run would report an artificially fast finish.
 */
export function isResumableSnapshot(snap: SnapshotLike, now = Date.now()): boolean {
  if (!snap) return false;
  if (!Number.isFinite(snap.savedAt) || !Number.isFinite(snap.elapsedMs)) return false;
  if (snap.elapsedMs < 0 || snap.score < 0) return false;
  if (snap.zone < 0 || snap.zone > 7) return false;
  const age = now - snap.savedAt;
  return age >= 0 && age <= SNAPSHOT_MAX_AGE_MS;
}
