# Budget Toolkit

A browser extension that adds two things to [EveryDollar](https://www.everydollar.com/app/budget) that the app doesn't provide natively:

1. **A spending graph** — a line chart of net amount spent per day for the month you're currently viewing.
2. **Custom totals** — roll up any combination of budget groups/items into a named total (e.g. "Discretionary" = Restaurants + Entertainment + Clothing) that's saved locally and automatically reappears every time you log in, even as your budget moves into a new month.

## How it works

EveryDollar is a single-page app. When you view a budget it calls its own internal API (`/app/api/budgets/{uuid}`) to fetch that month's groups, items, and transactions. Budget Toolkit doesn't call any API on its own or send your data anywhere — instead, a content script observes the same network responses the page already loads, and renders a small floating panel using that data.

Everything — including your saved custom totals — is stored in your browser via `chrome.storage.local`. Nothing leaves your machine.

Because EveryDollar mints a new internal ID for every budget item each month, custom totals are matched by **category name** (e.g. "Groceries"), not by ID, so a saved total keeps working automatically as you move from month to month.

## Installing (unpacked, for now)

This isn't published to the Chrome Web Store. To use it:

1. Clone this repo.
2. Go to `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the repo folder.
4. Visit https://www.everydollar.com/app/budget — the panel appears full-width at the top of the budget page.

## Project structure

- `manifest.json` — Manifest V3 extension definition.
- `src/inject/` — a script that runs in the page's own JS context to observe EveryDollar's API responses.
- `src/content/` — the injected panel UI (graph, custom totals, styling).
- `src/shared/` — pure data-transformation helpers, independent of the DOM.
- `dev/sample-data/` — fabricated example API responses (not real financial data) matching EveryDollar's response shape, useful for understanding the data model.
- `features-ideas.md` — backlog of ideas not yet built.

## Contributing

Issues and PRs welcome. No build step or dependencies are required — it's plain JS/CSS, load the folder as an unpacked extension and reload the extension after making changes.

## License

GPL-3.0 — see [LICENSE](LICENSE).
