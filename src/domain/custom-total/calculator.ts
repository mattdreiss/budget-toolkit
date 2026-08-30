import type { Budget, BudgetItem, CategoryKind } from "../budget/Budget.js";
import { Money } from "../shared/Money.js";
import type { CategorySelection, CustomTotal } from "./CustomTotal.js";

export interface CustomTotalResult {
  readonly budgeted: Money;
  /** Same orientation as `BudgetItem.actual()`: positive means spent, or received. */
  readonly actual: Money;
  /**
   * Which kinds of category the total resolved to. A total is normally all
   * expense, but nothing stops the user mixing in income, and the two read
   * differently enough ("spent" vs "received") that the view needs to know.
   */
  readonly kinds: readonly CategoryKind[];
  /** Selections that no longer resolve — a category renamed or removed this month. */
  readonly missing: readonly CategorySelection[];
}

/**
 * Roll a custom total up against one month's budget.
 *
 * Selections are resolved to a *set* of items before summing, so overlapping
 * selections — a whole group plus one of its own items — count that item once
 * rather than twice.
 */
export function computeCustomTotal(
  budget: Budget,
  customTotal: CustomTotal,
): CustomTotalResult {
  const resolved = new Map<string, BudgetItem>();
  const missing: CategorySelection[] = [];

  for (const selection of customTotal.selections) {
    // Keyed by group *and* item so the same name appearing under two groups is
    // two lines, while the same line reached two ways is still one.
    const matches = resolve(budget, selection);
    if (matches === null) {
      missing.push(selection);
      continue;
    }
    for (const [key, item] of matches) resolved.set(key, item);
  }

  const items = [...resolved.values()];
  return {
    budgeted: Money.sum(items.map((item) => item.budgeted)),
    actual: Money.sum(items.map((item) => item.actual())),
    kinds: [...new Set(items.map((item) => item.kind))],
    missing,
  };
}

/**
 * Every budget line a selection points at, keyed for de-duplication, or `null`
 * if the selection does not resolve at all this month.
 *
 * `null` and `[]` are deliberately different answers: a group that exists but
 * happens to be empty contributes nothing and is *not* a stale selection, while
 * a group or item that has been renamed away is.
 */
function resolve(
  budget: Budget,
  selection: CategorySelection,
): [string, BudgetItem][] | null {
  // A name-only selection has no group to look in, so it sweeps the budget and
  // picks up every line with that name — which is also what makes it survive
  // the user moving an item from one group to another.
  if (selection.type === "itemByLabel") {
    const matches = budget.groups.flatMap((group) =>
      group.items
        .filter((item) => item.label === selection.itemLabel)
        .map((item): [string, BudgetItem] => [`${group.label}::${item.label}`, item]),
    );
    return matches.length > 0 ? matches : null;
  }

  const group = budget.findGroup(selection.groupLabel);
  if (!group) return null;

  if (selection.type === "group") {
    return group.items.map((item): [string, BudgetItem] => [
      `${group.label}::${item.label}`,
      item,
    ]);
  }

  const item = group.findItem(selection.itemLabel);
  return item ? [[`${group.label}::${item.label}`, item]] : null;
}
