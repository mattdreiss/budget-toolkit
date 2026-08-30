# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Manifest V3 browser extension that augments the EveryDollar budgeting app (`https://www.everydollar.com/app/budget`) with two features it doesn't provide natively: a daily spending line graph, and user-defined "custom totals" that roll up arbitrary budget groups/items into a named sum. It makes no network calls of its own — it observes the page's own API responses and renders a floating panel from that data. Everything (including custom totals) is stored locally via `chrome.storage.local`.

TypeScript throughout, arranged by domain-driven design. The scope is intentionally narrow — it only ever needs to work against one page (see `host_permissions` / `content_scripts.matches` in `manifest.json`) — so don't generalize the design beyond that.

## Commands

```sh
yarn install
yarn build      # esbuild -> dist/ (what manifest.json actually loads)
yarn dev        # same, watching
yarn test       # vitest
yarn typecheck  # tsc --noEmit
```

Load unpacked from the **repo root** (`manifest.json` is there), not `dist/`. `yarn build` must have run at least once or there is nothing to load. After a rebuild, reload the extension in `chrome://extensions`, then reload the EveryDollar tab.

Yarn 4 is pinned via `packageManager`, with `nodeLinker: node-modules` in `.yarnrc.yml` (PnP needs extra wiring for tsc/vitest). esbuild is allowlisted in `dependenciesMeta` so its postinstall can fetch the platform binary — without that, `yarn build` fails on a fresh clone.

## Architecture

Dependencies point inward: `presentation` and `infrastructure` → `application` → `domain`. The domain layer imports nothing from the others, and no layer but `infrastructure` touches `chrome.*` or EveryDollar's wire format. `src/entries/contentScript.ts` is the composition root — the only file that picks concrete adapters.

### Two-world script split (Manifest V3)

This is the constraint that shapes the boundaries, and it's a hard one.

- `src/entries/mainWorld.ts` → `dist/main-world.js` runs in the page's **MAIN** world at `document_start`. It patches `window.fetch` and, on a response matching `/app/api/budgets/{uuid}`, redispatches the raw JSON as a `budget-toolkit:budget-detail` `CustomEvent`.
- `src/entries/contentScript.ts` → `dist/content.js` runs in the **isolated** world at `document_idle`. It listens, maps to domain, and renders.

The two worlds share `window` but **no JS state or module instances** — they are separate bundles, and the `CustomEvent` payload is the only channel. It crosses as a structured clone, so it must stay plain JSON: raw DTO only, never domain objects. Keep the MAIN-world bundle dumb; anything richer there can't reach the content script anyway.

### The sign convention (read before touching any calculation)

EveryDollar's wire format signs amounts by direction:

| field | income | expense |
|---|---|---|
| `amountBudgeted` | positive | positive |
| allocation `amount` | positive | **negative** |

`src/infrastructure/everydollar/budgetMapper.ts` is the anti-corruption layer and the **only** place that knows this. It normalizes budgeted to a positive magnitude and keeps allocations as signed cash flow. Downstream, one accessor defines what actually happened:

```
BudgetItem.actual()  =  expense ? negate(sum(allocations)) : sum(allocations)
```

Positive always means "the expected direction for this kind" — spent for an expense, received for an income — and a refund (positive on an expense) correctly *reduces* spend.

This matters because the pre-TypeScript build got it wrong twice: `computeDailySpend` summed *all* groups including income, so payday plotted as −$4,000 and the month totalled −$2,276 instead of $1,724; and custom totals used `Math.abs` while the graph used signed values, so the two disagreed about the same categories. Both are now regression-tested (`test/domain/spendSeries.test.ts`, `test/domain/customTotal.test.ts`). If you add a calculation, route it through `actual()` rather than re-deriving signs.

### Identity is by label, not ID

EveryDollar re-mints every group/item/allocation ID each month (`urn:everydollar:budget:{uuid}:item:{n}`). Anything that outlives a month boundary — i.e. a saved `CustomTotal` — matches on the category **label**. Never persist an EveryDollar ID.

`CategorySelection`'s shape is also the persisted storage shape, unchanged from the pre-TypeScript build, so totals saved by older versions still resolve. Don't change it without a migration.

### EveryDollar's frontend: React, not Shadow DOM

EveryDollar is a React SPA (confirmed via `__reactFiber$...` keys on its DOM nodes) using an internal component library whose elements are tagged `data-eds-component="..."` (e.g. `EDSPageLayout.Main`, `EDSAppLayout`, `EDSSideNavigation`) — useful, relatively stable selectors for anchoring to the page. It does **not** use Shadow DOM (no element on the page has a `shadowRoot`), so nothing blocks our CSS or DOM access.

The relevant mechanic is React's **virtual DOM reconciliation**, but the danger is not where you'd expect. React removes DOM nodes only for fibers it is deleting — it does not walk a container discarding children it doesn't recognise — so a node we `prepend` into a React-managed container is invisible to reconciliation and survives ordinary re-renders. What it does *not* survive is React replacing that container element outright, which EveryDollar does intermittently. See `docs/panel-mounting.md`.

### Panel mounting

`src/presentation/mountPanel.ts` prepends the panel into `[data-eds-component="EDSPageLayout.Main"]`, and `styles.css` makes it look like one of EveryDollar's own cards. Two rules keep it there, and both matter:

- **Never cache the container.** Re-resolve it by selector each time. React intermittently discards the whole `EDSPageLayout.Main` element and mounts a replacement; the panel isn't removed, it's just left in a detached node. An observer bound to that node is dead, which is exactly how the panel used to vanish permanently (commit `4b6d637`).
- **Observe `<body>`, which React can't replace.** Its root container, `#app-container`, is a child of it. This also covers the column not existing yet at `document_idle`.

Contrary to what this file used to say, React does *not* evict foreign children from a container it renders into — verified against the live app, along with everything else in `docs/panel-mounting.md`. Read that before changing any of this.

No delay or readiness gate is needed, and adding one is a step backwards: a `MutationObserver` callback is delivered after the task that mutated the DOM, React's commit phase is synchronous, and microtasks run before paint — so the callback already means "React finished this commit" and re-placing there can't flicker.

## Testing

Vitest over `domain`, `application` and `infrastructure` — all DOM-free, so they run in plain Node. Presentation has no automated coverage; verify it in the real app.

Tests go in through `toBudget` with wire-shaped payloads (`test/support/budgetBuilder.ts`) rather than constructing domain objects directly, so the sign conventions under test are the ones real payloads exercise. `dev/sample-data/*.json` are fabricated fixtures (not real financial data) matching EveryDollar's response shape, and double as the realistic test case.

## Documentation lives in `docs/`

`docs/` is the home for **all** project-specific documentation: feature plans, testing plans, architecture decision records, investigation write-ups, API notes — anything worth keeping that isn't code.

When you produce a document of that kind, write it to `docs/` as Markdown rather than leaving it in the conversation or scattering it at the repo root. Read what's already there before planning a change; an existing document may already record the decision or constraint you're about to re-derive.

`CLAUDE.md` and `README.md` stay at the root — they're entry points, not project documents. Keep `CLAUDE.md` about how to work in the repo and let `docs/` hold the depth.

Currently: `docs/features-ideas.md` tracks ideas explicitly deferred (alternate chart views, a local dev sandbox, a real icon) — check it before proposing new features.

## Do not commit

**Never run `git commit` or `git push` in this repo.** The user will handle app commit operations.
