# Telling savings apart from spending

**Status:** implemented, with one assumption that needs confirming against a live
payload. See "What to check" at the bottom.

The spending graph plots expenses only. Income was already excluded; savings now
is too, because a transfer to a sinking fund is money *moved*, not money gone,
and counting it makes the line answer a different question than the one it asks.

## The problem

On the wire, a savings transfer and an expense are indistinguishable by shape:

| | `amountBudgeted` | allocation `amount` |
|---|---|---|
| income | positive | positive |
| expense | positive | negative |
| savings | positive | negative |

Only the category's `type` could separate the last two — and in every payload we
have been able to inspect (`dev/sample-data/`, plus the months seen in the live
app), groups and items are typed only `income` or `expense`. There is no
`savings` in the data we have.

That leaves two possibilities, and we cannot currently tell which is true:

1. EveryDollar does emit a savings-ish `type`, and our fixtures just have no
   savings group in them.
2. EveryDollar types a savings group `expense`, and the only thing marking it as
   savings is its label.

## What the mapper does

`budgetMapper.ts` covers both, because covering only (1) fails silently and
expensively — every fund transfer would land on the spending line, which is the
exact bug this feature exists to avoid.

1. **`type` is read generously.** `savings`, `saving`, `fund`, `funds` and
   `sinking fund` (case- and separator-insensitive) all map to the `savings`
   kind. Guessing wide costs nothing: if EveryDollar never sends any of them,
   these entries are simply never hit.
2. **A group's label outranks its `type`.** A group named exactly "Savings" or
   "Saving" is classified `savings` even when the wire says `expense`. It cannot
   override `income`, so the paycheck group is never at risk.
3. **The group's items inherit that, and `expense` cannot undo it.** An item
   inside a savings group arrives typed `expense` like everything else outgoing,
   so letting an item's own type win would reverse the group's classification on
   every single line. An explicit `income` on an item still wins, because that
   genuinely is new information.

The label match is anchored (`/^savings?$/i`), so "Savings" reclassifies while
"Savings Account Fees" stays an ordinary expense.

## Why the label is allowed to win

It reads backwards — an anti-corruption layer preferring a display string over a
declared type — so the reasoning is worth stating plainly.

`type` here is not a rich field. On the evidence we have it carries exactly one
bit: money in, or money out. A savings group saying `expense` is not contradicting
the label; it is repeating the wire's only available word for "outgoing". The
label is the higher-information signal, so it is the one we act on.

The cost of each mistake is also asymmetric. Misclassifying a savings group as an
expense corrupts the headline number the whole feature exists to show.
Misclassifying an expense group as savings requires the user to have named a
spending group precisely "Savings", in which case excluding it from *spending* is
very likely what they meant anyway.

## Downstream

`CategoryKind` gained a third value, so `BudgetItem.actual()` negates for both
outflow kinds (`isOutflow`) and the orientation rule is unchanged: positive still
means "the expected direction for this kind", i.e. money set aside on a savings
line. `Budget.expenseItems()` — what `computeDailySpend` iterates — now means
precisely "the lines the spending graph plots".

Covered by `test/infrastructure/budgetMapper.test.ts` (classification, including
item inheritance) and `test/domain/spendSeries.test.ts` (the graph actually
leaving savings out, via both routes).

## What to check

The one open question is whether EveryDollar sends a savings `type` at all. To
settle it, paste this in the DevTools console on the budget page, then switch
month so a fetch happens. It reports shape only — no amounts, labels or
merchants:

```js
addEventListener("budget-toolkit:budget-detail", (e) => {
  const allocations = e.detail.groups.flatMap((g) =>
    g.budgetItems.flatMap((i) => i.allocations));
  console.log({
    groupTypes: [...new Set(e.detail.groups.map((g) => g.type))],
    itemTypes: [...new Set(e.detail.groups.flatMap((g) =>
      g.budgetItems.map((i) => i.type)))],
    groupLabels: e.detail.groups.map((g) => g.label),
    sampleDates: allocations.slice(0, 3).map((a) => a.date),
  });
}, { once: true });
```

`groupTypes`/`itemTypes` settle the savings question; `sampleDates` confirms the
allocation date format (see `docs/allocation-dates.md`).

- If it is `expense`, rule 2 is doing the real work and rule 1 is dead code that
  can be trimmed to just `income`/`expense`/`savings`.
- If it is something else, add that spelling to `WIRE_KINDS` — and the label
  heuristic becomes a backstop for renamed groups rather than the primary path.
