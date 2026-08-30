/** EveryDollar's main content column, from their internal component library. */
export const PAGE_CONTAINER_SELECTOR = '[data-eds-component="EDSPageLayout.Main"]';

/**
 * Keeps the panel as the first child of EveryDollar's main content column.
 *
 * What goes wrong when you inject into a React app is narrower than it looks,
 * and the earlier version of this file misdiagnosed it. React does not walk a
 * container evicting children it doesn't recognise — it only removes DOM nodes
 * belonging to fibers it is deleting — so a node prepended into
 * `EDSPageLayout.Main` survives ordinary re-renders, and month-to-month
 * navigation, untouched. That was measured against the live app, not assumed
 * (see docs/panel-mounting.md).
 *
 * What React does do, intermittently, is throw away the whole
 * `EDSPageLayout.Main` element and mount a fresh one. The panel is not removed
 * in that case — it is still the first child of an element that is no longer in
 * the document. That is what actually broke the old code: it captured the
 * container in a closure and observed *that node*, so the moment React swapped
 * it the observer was watching a detached element and never fired again. The
 * panel was then gone for good, which is why it looked like it was being
 * "overwritten" on every render.
 *
 * Hence the two rules here: resolve the container by selector every time rather
 * than holding one, and observe a node React cannot replace.
 *
 * There is deliberately no delay and no "wait until React is finished" gate,
 * because a MutationObserver already is one. Its callback is delivered at the
 * microtask checkpoint after the task that mutated the DOM, and React's commit
 * phase is synchronous — so we always run after a complete commit, and always
 * before the browser paints. Re-placing the panel here can neither interleave
 * with a render nor produce a visible flicker.
 */
export function mountPanel(panel: HTMLElement): void {
  const place = () => {
    // The fast path is two property reads, which is what the vast majority of
    // callbacks cost: if the panel still leads a container that is still in the
    // document, there is nothing to do.
    const container = panel.parentElement;
    if (container?.isConnected && container.firstElementChild === panel) return;

    const target = document.querySelector(PAGE_CONTAINER_SELECTOR);
    if (target && target.firstElementChild !== panel) target.prepend(panel);
  };

  place();

  // <body> outlives everything React owns — its root container, #app-container,
  // is a child of it — so this observer can never go stale. It also covers the
  // main column not existing yet when the content script runs at document_idle,
  // which makes the "find it first, then watch it" split unnecessary.
  new MutationObserver(place).observe(document.body, { childList: true, subtree: true });
}
