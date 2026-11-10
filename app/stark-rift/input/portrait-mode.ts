export const LANDSCAPE_QUERY = "(orientation: landscape)";

/** Browser viewport policy, outside deterministic simulation and persistence. */
export function isPortraitViewport(): boolean {
  return typeof window === "undefined" || !window.matchMedia(LANDSCAPE_QUERY).matches;
}

export function subscribePortraitMode(changed: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const query = window.matchMedia(LANDSCAPE_QUERY);
  query.addEventListener("change", changed);
  return () => query.removeEventListener("change", changed);
}
