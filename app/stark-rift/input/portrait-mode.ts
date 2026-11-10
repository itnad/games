export const LANDSCAPE_QUERY = "(orientation: landscape)";
let owner: Window | undefined;
let media: MediaQueryList | undefined;
function landscapeMedia(): MediaQueryList {
  if(owner!==window||!media){owner=window;media=window.matchMedia(LANDSCAPE_QUERY);}
  return media;
}

/** Browser viewport policy, outside deterministic simulation and persistence. */
export function isPortraitViewport(): boolean {
  return typeof window === "undefined" || !landscapeMedia().matches;
}

export function subscribePortraitMode(changed: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const query = landscapeMedia();
  query.addEventListener("change", changed);
  return () => query.removeEventListener("change", changed);
}
