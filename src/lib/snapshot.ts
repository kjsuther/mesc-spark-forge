// Point-in-time snapshot of the Demo Client Tool for a shipped version.
import { ACTIONS, VISIBLE_ACTION_SLUGS, type NavigatorAction } from "@/data/actions";

export type ToolSnapshot = {
  capturedAt: string;
  actions: NavigatorAction[];
};

export function buildToolSnapshot(): ToolSnapshot {
  const visible = ACTIONS.filter((a) => VISIBLE_ACTION_SLUGS.includes(a.slug));
  // Deep-clone via JSON so future edits to ACTIONS never mutate stored snapshots.
  return {
    capturedAt: new Date().toISOString(),
    actions: JSON.parse(JSON.stringify(visible)) as NavigatorAction[],
  };
}

export function getSnapshotAction(
  snapshot: ToolSnapshot | null | undefined,
  slug: string,
): NavigatorAction | undefined {
  if (!snapshot) return undefined;
  return snapshot.actions.find((a) => a.slug === slug);
}
