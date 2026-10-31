import Phaser from "phaser";

/** How long the window has to stay the same size before the canvas is fitted again. */
export const RESIZE_SETTLE_MS = 150;

/**
 * Fits the canvas again once a resize or a phone rotation has ended.
 *
 * Phaser's own check can miss a rotation: its orientation handler refreshes before the page has its new size, and a later
 * bounds read stores the new size without refreshing, so the canvas keeps the old size. Re-reading the parent and refreshing
 * after the size settles fixes that. Returns a function that removes the listeners.
 */
export function fitOnResize(
  game: Phaser.Game,
  settleMs = RESIZE_SETTLE_MS,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const fit = () => {
    game.scale.getParentBounds();
    game.scale.refresh();
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(fit, settleMs);
  };

  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  window.visualViewport?.addEventListener("resize", schedule);
  screen.orientation?.addEventListener?.("change", schedule);

  const stop = () => {
    clearTimeout(timer);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("orientationchange", schedule);
    window.visualViewport?.removeEventListener("resize", schedule);
    screen.orientation?.removeEventListener?.("change", schedule);
  };
  game.events.once(Phaser.Core.Events.DESTROY, stop);
  return stop;
}
