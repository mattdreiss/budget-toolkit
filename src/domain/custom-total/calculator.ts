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
    const group = budget.findGroup(selection.groupLabel);
    if (!group) {
      missing.push(selection);
      continue;
    }

    if (selection.type === "group") {
      for (const item of group.items) {
        resolved.set(`${group.label}::${item.label}`, item);
      }
      continue;
    }

    const item = group.findItem(selection.itemLabel);
    if (!item) {
      missing.push(selection);
      continue;
    }
    resolved.set(`${group.label}::${item.label}`, item);
  }

  const items = [...resolved.values()];
  return {
    budgeted: Money.sum(items.map((item) => item.budgeted)),
    actual: Money.sum(items.map((item) => item.actual())),
    kinds: [...new Set(items.map((item) => item.kind))],
    missing,
  };
}
