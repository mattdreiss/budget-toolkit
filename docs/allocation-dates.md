# Allocation dates: why they are normalised in the mapper

**Status:** implemented. The format assumption behind the original code was never
verified, and it fails silently — which is the interesting part.

## The failure

`computeDailySpend` buckets by **exact string equality**: it builds a map keyed
by the month's own `YYYY-MM-DD` days and looks each allocation up by its `date`.
An allocation whose date is not in the map is skipped, on the reasoning that it
belongs to another month.

That reasoning is right, but it makes the lookup unforgiving. If real payloads
carry `2026-01-15T00:00:00.000Z` rather than `2026-01-15`, *every* allocation
misses, every day totals zero, and the chart draws a flat line at the bottom with
a caption reading `$0.00`. Nothing throws. Nothing logs. The feature simply
reports that you spent nothing all month.

The assumption came from `dev/sample-data/*.json`, which is **fabricated** — it
was written to match EveryDollar's shape, so it confirms our belief about the
format rather than testing it.

## The fix

`toAllocation` in the mapper reduces the date to its leading `YYYY-MM-DD`, and
throws a typed error naming the field and value if it cannot find one. So:

- `2026-03-05` → `2026-03-05`
- `2026-03-05T00:00:00.000Z` → `2026-03-05`
- `2026-03-05T13:45:10-05:00` → `2026-03-05`
- `03/05/2026` → throws

The mapper is the right home for this: it is the anti-corruption layer, and the
date format is EveryDollar's wire concern, not the domain's. Downstream, `IsoDate`
now genuinely means what it says.

## Why the string is sliced, not parsed

Parsing looks more principled and is wrong here.
`new Date("2026-03-05T00:00:00.000Z").getDate()` is **the 4th** for anyone west
of Greenwich — the same trap `MonthKey` already documents and avoids by doing all
its arithmetic on string parts. Reparsing would move a midnight-UTC transaction
to the previous day, and, at a month boundary, into the previous month.

A transaction's date in EveryDollar is a wall-clock calendar day, not an instant.
The leading date *is* the answer; any time component is noise.

## Why it now throws

Failing loudly is a deliberate trade. An unreadable payload is dropped by
`BudgetDetailEventSource`, which logs
`[budget-toolkit] ignoring unreadable budget payload:` with the error — so an
unexpected format produces a message naming the exact field and value, instead of
a plausible-looking chart that is quietly wrong. A chart that is visibly absent
gets reported; a chart that reads `$0.00` gets believed.

Covered in `test/infrastructure/budgetMapper.test.ts` ("allocation dates"),
including the midnight-UTC case asserted through `computeDailySpend` so the
regression is pinned at the level where it actually hurt.
