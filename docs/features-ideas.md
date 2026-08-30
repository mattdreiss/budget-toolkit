# Feature Ideas

Backlog of ideas explicitly deferred from the initial build — not yet implemented.

- **Stacked bar chart view**: an alternate visualization for the Spending section, broken down by budget group (or item), shown alongside the daily line chart.
- **Local dev sandbox**: a static HTML page that mocks `fetch` with the fixtures in `dev/sample-data/`, so contributors can iterate on the UI without an EveryDollar account. Confirmed viable — a throwaway version was used to verify the panel and the section editor. It needs three stubs and nothing else: a `chrome.storage.local` shim (`get`/`set` over a plain object), a `fetch` wrapper that answers `/app/api/budgets/…` from the fixture, and a container with `data-eds-component="EDSPageLayout.Main"`. The stubs have to be installed *before* `main-world.js` loads, since it wraps whatever `fetch` it finds, and the page must be served over HTTP — `file://` blocks the fixture fetch.
- **Custom icon/logo** for the extension (currently uses Chrome's default placeholder icon).
