# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Manifest V3 browser extension that augments the EveryDollar budgeting app (`https://www.everydollar.com/app/budget`) with two features it doesn't provide natively: a daily spending line graph, and user-defined "custom totals" that roll up arbitrary budget groups/items into a named sum. It makes no network calls of its own — it observes the page's own API responses and renders a floating panel from that data. Everything (including custom totals) is stored locally via `chrome.storage.local`.

## Commands

There is no build step, package manager install, lint, or test suite yet — `mise.toml` pins `node`/`yarn` for future tooling, but nothing currently consumes them. To develop:

1. `chrome://extensions` → enable Developer mode → **Load unpacked** → select the repo root.
2. After editing files, reload the extension in `chrome://extensions`, then reload the EveryDollar budget page.

## Architecture

### Two-world script split (Manifest V3)

- `src/inject/fetch-interceptor.js` runs in the page's **MAIN** world at `document_start`. It monkey-patches `window.fetch`; whenever a response URL matches `/app/api/budgets/{uuid}`, it clones the response, parses the JSON, and redispatches it as a `budget-toolkit:budget-detail` `CustomEvent` on `window`.
- `src/content/*.js` run in the **isolated** content-script world at `document_idle`. They listen for that event and render the panel. The two worlds share `window` but not JS state or functions — the `CustomEvent` (carrying a structured-cloned JSON payload) is the only channel between them.

### Global namespace, no bundler

There are no ES modules and no build step. `manifest.json` lists content-script files in an explicit load order, and every file attaches its exports to a single shared `window.BudgetToolkit` object — later files assume earlier ones already ran, so **file order in `manifest.json` matters**. `src/shared/*.js` are pure, DOM-free helpers (`budget-model.js` math, `format.js` formatting, `storage.js` `chrome.storage.local` wrappers); `src/content/*.js` do DOM/rendering and pull from `window.BudgetToolkit`.

### Data model (EveryDollar's own API shape)

Budget detail: `{ date: "YYYY-MM-DD", groups: [{ label, type, budgetItems: [{ label, amountBudgeted, allocations: [{ date, amount, ... }] }] }] }`.

- All amounts are integer cents.
- Allocation `amount` is **negative** for expense spend and **positive** for income — `computeDailySpend` negates it to get a positive "spent" value; `computeTotalForSelections` takes `Math.abs`. Preserve this sign convention when touching `budget-model.js`.
- Group/item/allocation IDs are re-minted every month. Anything persisted across months (custom totals) therefore matches by category **label**, not ID — see `computeTotalForSelections` / `buildCategoryIndex` in `src/shared/budget-model.js`.
- `dev/sample-data/*.json` are fabricated fixtures matching this shape (not real financial data), useful for reasoning about the model without a live account.

### EveryDollar's frontend: React, not Shadow DOM

EveryDollar is a React SPA (confirmed via `__reactFiber$...` keys on its DOM nodes) using an internal component library whose elements are tagged with `data-eds-component="..."` attributes (e.g. `EDSPageLayout.Main`, `EDSAppLayout`, `EDSSideNavigation`) — those are useful, relatively stable selectors for locating anchor points in the rendered page. It does **not** use actual Shadow DOM (no element on the page has a `shadowRoot`), so there's no encapsulation boundary blocking our content scripts' CSS or DOM access.

The relevant mechanic is React's **virtual DOM reconciliation**, not Shadow DOM: React owns the real DOM subtree under any container it renders into, and on every re-render it diffs its virtual tree against what it last rendered and mutates the real DOM to match — it has no awareness of nodes a content script inserted by hand. That means any element we `appendChild`/`prepend` as a child of a React-managed container (e.g. `[data-eds-component="EDSPageLayout.Main"]`) is invisible to React's diff and can be silently removed or reordered the next time that component re-renders, regardless of when or how we inserted it.

### Panel mounting

`panel.js` locates EveryDollar's page container (`[data-eds-component="EDSPageLayout.Main"]`) and uses a `MutationObserver` to keep the panel pinned as its first child, re-prepending on every SPA re-render. This is fighting React's reconciliation on every render, which is inherently racy — the most recent commit (`4b6d637`) notes the panel still gets overwritten in some cases. If debugging panel placement, don't reach for Shadow DOM–style encapsulation fixes; the fix more likely to hold is mounting the panel **outside** any React-owned subtree entirely (e.g. as a sibling of React's root container, positioned with CSS to appear at the top of the page) rather than as a child inside one, so there's no React re-render that can ever touch it.

### Storage

Only `chrome.storage.local` is used (`permissions: ["storage"]`), only for the `customTotals` array.

## Project direction: TypeScript + DDD

The current codebase (plain JS, global `window.BudgetToolkit` namespace, no build step) is the `v0.1.0` baseline, not the intended end state. New and changed code should be TypeScript, organized by domain-driven design:

- **domain** — budget/category/custom-total concepts and pure logic (today's `src/shared/budget-model.js` is the closest existing analog). No DOM, no `chrome.*` APIs.
- **application** — use-cases that orchestrate domain logic against ports (e.g. "compute this month's custom totals," "persist a custom total").
- **infrastructure** — adapters to the outside world: the MAIN-world fetch interception, `chrome.storage.local`, DOM rendering.
- **presentation** — the panel UI itself.

The extension's scope is intentionally narrow — it only ever needs to work against `https://www.everydollar.com/app/budget` (see `host_permissions` / `content_scripts.matches` in `manifest.json`) — so don't generalize the design beyond that single page. When a build step (bundler, `tsconfig`, etc.) is introduced, keep it minimal and update this file and the README's "Contributing" section (which currently advertises "no build step or dependencies required") to match.

## Backlog

`features-ideas.md` tracks ideas explicitly deferred from the initial build (alternate chart views, a local dev sandbox, a real icon) — check it before proposing new features to avoid duplicating known plans.
