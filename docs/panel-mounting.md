# Panel mounting: why it disappeared, and what actually fixes it

**Status:** implemented. Supersedes the "it races reconciliation" explanation that
was previously in `CLAUDE.md`, which was wrong.

The panel is mounted where it was always meant to be: prepended into
`[data-eds-component="EDSPageLayout.Main"]`, styled as one of EveryDollar's own
cards. This document records what was actually breaking that, because the
obvious explanation is wrong and led to an unnecessary redesign.

## What was measured

Diagnosed against the live app (`https://www.everydollar.com/app/budget`) by
injecting a probe element into `EDSPageLayout.Main` and recording what happened to
it with a `MutationObserver` on the React root:

| Observation | Result |
|---|---|
| React root container | `div#app-container`, a direct child of `<body>` |
| Is `<body>` React-owned? | No — no `__reactContainer$…` key on it |
| Probe prepended into `Main`, page left idle 20s | Survives, still first child |
| Probe prepended, month navigated back and forward | Survives, `Main` is the same node |
| Same again, other runs | Probe gone — and `Main` was **a different element** |
| Probe removed *directly* from a surviving `Main` | **Never observed, in any run** |
| App-published readiness flag (`aria-busy`, `data-ready`, …) | None; the only `data-state`/`aria-busy` nodes are buttons and menus |
| `window.__REACT_DEVTOOLS_GLOBAL_HOOK__` | Absent (DevTools not installed) |

## What that means

**React was never evicting our node.** React removes DOM nodes only for fibers it
is deleting; it does not enumerate a container and discard children it doesn't
recognise. A node prepended into `Main` is invisible to reconciliation and stays
put through ordinary re-renders — which the probe confirms.

**What happens instead is that `EDSPageLayout.Main` itself gets replaced.**
Intermittently — it appears to depend on whether the data for the view is already
cached — React discards the whole main-column element and mounts a fresh one. Our
panel is not removed by this. It is still the first child of an element that is no
longer in the document.

**That is what killed the old implementation.** It did:

```js
const existing = document.querySelector(selector);
if (existing) { attach(existing); return; }   // captures the container…
// …and attach() observed *that node*, after findObserver.disconnect()
```

Once React swapped the element, the observer was watching a detached node, so it
never fired again, and the code had already disconnected the only observer that
knew how to find a new container. The panel was gone permanently. Because the loss
was intermittent and irreversible, it read as "React overwrites it on every
render" — hence the wrong diagnosis.

## The fix

Two rules, both in `src/presentation/mountPanel.ts`:

1. **Never hold a reference to the container.** Re-resolve it with
   `document.querySelector` whenever placement needs fixing. A container that has
   been swapped out is then simply not the one we find.
2. **Observe a node React cannot replace.** `<body>` outlives `#app-container`,
   which outlives everything else, so the observer can never go stale. This also
   subsumes the "container might not exist at `document_idle`" case, so the old
   find-then-watch split disappears.

The callback's fast path is two property reads — is the panel's parent still in the
document, and is the panel still its first child — so the cost of watching
`<body>` with `subtree: true` on a busy React app stays negligible.

## On waiting for React to "finish rendering"

The tempting fix is a `setTimeout` before mounting. It is not needed, and neither
is any readiness signal, for a reason worth stating precisely:

**A `MutationObserver` callback already is a "React has finished rendering"
signal.** Records are delivered at the microtask checkpoint after the *task* that
mutated the DOM. React's commit phase is synchronous, so every DOM mutation in a
commit lands in one task and our callback runs once, after the commit is complete
and before the browser paints. Re-placing the panel there cannot interleave with a
render, and cannot produce a visible frame without the panel.

Three alternatives were considered and rejected:

- **A delay before mounting.** Picks an arbitrary number, mounts late, and does
  nothing about the swap happening later anyway — the failure recurs whenever
  React replaces `Main` after the timer has fired.
- **`__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot`.** This is the literal
  answer to "does React announce that it is done": React invokes this hook after
  every commit, and we *could* install it, because `mainWorld.ts` already runs in
  the MAIN world at `document_start` — the one moment early enough, since React
  captures the hook when its module initialises. Rejected because it is strictly
  worse information for our purpose: it fires for every commit anywhere in the
  app, including the vast majority that don't touch our column, whereas the
  MutationObserver is edge-triggered on the DOM we actually care about. It also
  makes us depend on a React internal and on cooperating with the real DevTools
  extension for the same global. The hook is absent on the page today.
- **An app-level readiness flag.** There isn't one. EveryDollar publishes no
  `data-ready`/`aria-busy` on the page container, and even if it did, the swap we
  care about happens well after any first-load "ready" moment.

## Styling

Since the panel lives inside their column, it is styled to pass as one of their
cards, from values sampled off the live page: white on the `#F5F7F8` page,
`border-radius: 16px`, no border or shadow, text `#1F2426`, secondary text
`#495257`, interactive text `#0073B9` (also the chart's line colour). The typeface
is `inherit`ed rather than declared, which picks up their `canada-type-gibson` and
stays correct if they change it.
