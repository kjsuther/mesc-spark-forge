export type ViewportCandidate = {
  width?: number;
  height?: number;
  offsetLeft?: number;
  offsetTop?: number;
};

export type ViewportSnapshot = {
  vw: number;
  vh: number;
  offsetLeft: number;
  offsetTop: number;
};

const positive = (value: number | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const finiteOrZero = (value: number | undefined): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

/**
 * Pick the dimensions of the viewport the player can currently see.
 *
 * Safari may leave `innerHeight` or `documentElement.clientHeight` stale while
 * its browser bars animate. When Visual Viewport is available it is therefore
 * authoritative rather than one candidate in a minimum-size calculation.
 */
export function selectViewportSnapshot(
  visual: ViewportCandidate | undefined,
  inner: ViewportCandidate,
  client: ViewportCandidate,
): ViewportSnapshot {
  const source =
    visual && positive(visual.width) && positive(visual.height)
      ? visual
      : positive(inner.width) && positive(inner.height)
        ? inner
        : client;

  return {
    vw: Math.round(positive(source.width) ? source.width : 960),
    vh: Math.round(positive(source.height) ? source.height : 540),
    offsetLeft: Math.round(finiteOrZero(source === visual ? visual.offsetLeft : 0)),
    offsetTop: Math.round(finiteOrZero(source === visual ? visual.offsetTop : 0)),
  };
}
