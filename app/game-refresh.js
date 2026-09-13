/**
 * Menu-only panels opt into native pull-to-refresh with data-game-menu.
 * Read the current DOM on each gesture so start/back transitions take effect
 * without changing the selected game or interfering with its saved state.
 * @param {Document} document
 * @param {Window} window
 */
export function installGameRefreshGuard(document, window) {
  const root = document.documentElement;
  root.classList.add("paperoid-game-active");
  let touchStartY = null;
  const clearTouchStart = () => { touchStartY = null; };
  const rememberTouchStart = (event) => {
    touchStartY = event.touches.length === 1 ? event.touches[0]?.clientY ?? null : null;
  };
  const blockPullToRefresh = (event) => {
    if (document.querySelector(".game-readability-scope [data-game-menu]")) return;
    if (event.touches.length !== 1) { clearTouchStart(); return; }
    const touchY = event.touches[0]?.clientY;
    const pageAtTop = window.scrollY <= 0 && root.scrollTop <= 0;
    if (event.cancelable && touchStartY !== null && touchY !== undefined && pageAtTop && touchY > touchStartY) event.preventDefault();
  };
  window.addEventListener("touchstart", rememberTouchStart, { passive: true });
  window.addEventListener("touchmove", blockPullToRefresh, { passive: false });
  window.addEventListener("touchend", clearTouchStart, { passive: true });
  window.addEventListener("touchcancel", clearTouchStart, { passive: true });
  return () => {
    root.classList.remove("paperoid-game-active");
    window.removeEventListener("touchstart", rememberTouchStart);
    window.removeEventListener("touchmove", blockPullToRefresh);
    window.removeEventListener("touchend", clearTouchStart);
    window.removeEventListener("touchcancel", clearTouchStart);
  };
}
