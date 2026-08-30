# Budget Toolkit

A browser extension that adds two things to [EveryDollar](https://www.everydollar.com/app/budget) that the app doesn't provide natively:

1. **A spending graph** — a full-width line chart of the amount spent per day for the month you're currently viewing. Income and savings are left out, so it shows what you actually spent rather than everything that moved.
2. **Sections** — "Savings", "Needs" and "Wants" to start with, each totalling up what you've *planned* across a set of budget items (e.g. Needs = Rent + Groceries + Utilities). Click a section's name to type in the items it contains. Sections are saved locally and reappear every time you log in, even as your budget moves into a new month.

## How it works

EveryDollar is a single-page app. When you view a budget it calls its own internal API (`/app/api/budgets/{uuid}`) to fetch that month's groups, items, and transactions. Budget Toolkit doesn't call any API on its own or send your data anywhere — instead, a content script observes the same network responses the page already loads, and renders a small floating panel using that data.

Everything — including your sections — is stored in your browser via `chrome.storage.local`. Nothing leaves your machine.

Because EveryDollar mints a new internal ID for every budget item each month, sections are matched by **item name** (e.g. "Groceries"), not by ID, so a section keeps working automatically as you move from month to month. If an item you listed isn't in the month you're looking at, the section says so under its name and still totals the rest — it starts counting again the month that item comes back.

## Installing (unpacked, for now)

This isn't published to the Chrome Web Store. To use it:

1. Clone this repo.
2. `yarn install && yarn build` — this writes the loadable extension into `dist/`.
3. Go to `chrome://extensions`, enable **Developer mode**.
4. Click **Load unpacked** and select the repo folder (not `dist/` — `manifest.json` lives at the root).
5. Visit https://www.everydollar.com/app/budget — the panel appears full-width at the top of the budget page.

## Project structure

The source is TypeScript, arranged in domain-driven layers:

- `src/domain/` — the budget and custom-total model, and the calculations over them. Pure; no DOM, no `chrome.*`.
- `src/application/` — use cases, and the ports (interfaces) they depend on.
- `src/infrastructure/` — adapters: observing EveryDollar's API, and `chrome.storage.local`.
- `src/presentation/` — the panel UI and stylesheet.
- `src/entries/` — the two bundle entry points, one per JS world (see below).
- `test/` — Vitest coverage of the domain, application and infrastructure layers.
- `dev/sample-data/` — fabricated example API responses (not real financial data) matching EveryDollar's response shape, also used as test fixtures.
- `docs/` — project documentation: feature and testing plans, architecture decision records, and [`features-ideas.md`](docs/features-ideas.md), a backlog of ideas not yet built.

The extension ships as two independent bundles because its two content scripts run in different JavaScript worlds: `dist/main-world.js` runs in the page's own context, where it can observe `fetch`, and `dist/content.js` runs in the isolated extension context, where it can reach `chrome.storage`. They share no state and communicate only by a `CustomEvent` carrying the raw API payload.

### A note on amounts

EveryDollar reports every amount in integer cents, and signs them by direction: allocations are negative for money spent and positive for money received, while budgeted amounts are always positive. That convention is translated in exactly one place — `src/infrastructure/everydollar/budgetMapper.ts` — so the rest of the code never has to reason about it.

The same file also decides which categories count as savings rather than spending, which is less obvious than it sounds: on the wire a transfer to a sinking fund is indistinguishable from an expense. See [`docs/savings-classification.md`](docs/savings-classification.md).

## Contributing

Issues and PRs welcome.

```sh
yarn install
yarn dev        # rebuild into dist/ on change
yarn test       # vitest
yarn typecheck  # tsc --noEmit
yarn build      # production bundles
```

After rebuilding, reload the extension in `chrome://extensions` and reload the EveryDollar tab.

## License

GPL-3.0 — see [LICENSE](LICENSE).
