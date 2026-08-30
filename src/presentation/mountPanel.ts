/** EveryDollar's main content column, from their internal component library. */
export const PAGE_CONTAINER_SELECTOR = '[data-eds-component="EDSPageLayout.Main"]';

/**
 * Inserts the panel at the top of EveryDollar's main column, and keeps it there.
 *
 * EveryDollar is a React app, and this mounts *inside* a container React owns.
 * React reconciles that subtree against its own virtual tree on every render and
 * has no idea our node exists, so it will periodically remove it — hence the
 * observer that puts it back. This is a known-imperfect approach (see commit
 * 4b6d637): re-prepending races the very renders it is reacting to, so the panel
 * can still flicker or vanish. The durable fix is to mount outside React's root
 * entirely and position with CSS, which is deliberately left as its own change.
 */
export function mountPanel(panel: HTMLElement): void {
  const attach = (container: Element) => {
    const pin = () => {
      if (container.firstElementChild !== panel) container.prepend(panel);
    };
    pin();
    new MutationObserver(pin).observe(container, { childList: true });
  };

  const existing = document.querySelector(PAGE_CONTAINER_SELECTOR);
  if (existing) {
    attach(existing);
    return;
  }

  // The container is rendered by the SPA, so it may not exist at document_idle.
  const observer = new MutationObserver(() => {
    const container = document.querySelector(PAGE_CONTAINER_SELECTOR);
    if (!container) return;
    observer.disconnect();
    attach(container);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
