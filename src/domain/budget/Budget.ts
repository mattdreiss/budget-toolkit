import { Money } from "../shared/Money.js";
import { MonthKey, type IsoDate } from "../shared/MonthKey.js";

/**
 * What a category does with money. This drives the sign rule below, so it has
 * to survive the trip through the mapper — it is not cosmetic.
 *
 * `savings` is money moving out of the checking account exactly like an expense
 * — same negative allocations, same "positive means it happened" orientation —
 * but it is not *spending*, so the graph leaves it out. Keeping it as its own
 * kind rather than a flag on `expense` is what lets `expenseItems()` mean
 * precisely "the lines the spending graph plots".
 */
export type CategoryKind = "income" | "expense" | "savings";

/** Kinds whose allocations are money leaving the account, and so arrive negative. */
export function isOutflow(kind: CategoryKind): boolean {
  return kind === "expense" || kind === "savings";
}

/** A single dated movement of money against a budget item. */
export class Allocation {
  constructor(
    readonly id: string,
    readonly date: IsoDate,
    /** Signed cash flow: negative is money leaving, positive is money arriving. */
    readonly amount: Money,
    readonly label: string,
    readonly merchant: string | null,
  ) {}
}

/**
 * One budget line, e.g. "Groceries".
 *
 * Identity is deliberately the *label*, not `id`: EveryDollar mints a new id for
 * every item each month, so anything that has to outlive a month boundary — a
 * saved custom total — can only match on the name.
 */
export class BudgetItem {
  constructor(
    readonly label: string,
    readonly kind: CategoryKind,
    /** Planned amount, always a positive magnitude. */
    readonly budgeted: Money,
    readonly allocations: readonly Allocation[],
  ) {}

  /**
   * What actually happened on this line, oriented so that positive always means
   * "the expected direction for this kind of category": money spent on an
   * expense, money set aside on a savings line, money received on an income.
   *
   * This is the single definition of "actual" in the app. Both the spending
   * graph and custom totals go through it, which is what stops them from
   * disagreeing — and it makes a refund (a positive movement on an expense)
   * correctly *reduce* spend instead of inflating it.
   */
  actual(): Money {
    const net = Money.sum(this.allocations.map((allocation) => allocation.amount));
    return isOutflow(this.kind) ? net.negate() : net;
  }

  /** `actual()` restricted to one day. */
  actualOn(date: IsoDate): Money {
    const net = Money.sum(
      this.allocations
        .filter((allocation) => allocation.date === date)
        .map((allocation) => allocation.amount),
    );
    return isOutflow(this.kind) ? net.negate() : net;
  }
}

/** A named collection of budget items, e.g. "Food". Matched by label, as items are. */
export class BudgetGroup {
  constructor(
    readonly label: string,
    readonly kind: CategoryKind,
    readonly items: readonly BudgetItem[],
  ) {}

  findItem(itemLabel: string): BudgetItem | undefined {
    return this.items.find((item) => item.label === itemLabel);
  }
}

/** One month's budget: the aggregate root. */
export class Budget {
  constructor(
    readonly month: MonthKey,
    readonly groups: readonly BudgetGroup[],
  ) {}

  findGroup(groupLabel: string): BudgetGroup | undefined {
    return this.groups.find((group) => group.label === groupLabel);
  }

  items(): BudgetItem[] {
    return this.groups.flatMap((group) => [...group.items]);
  }

  /**
   * The lines that count as spending: expenses only. Income is not spending,
   * and neither is savings — money moved to a fund has not left the household.
   */
  expenseItems(): BudgetItem[] {
    return this.items().filter((item) => item.kind === "expense");
  }

  /** Every distinct item label in the budget, for the section editor's autocomplete. */
  itemLabels(): string[] {
    return [...new Set(this.items().map((item) => item.label))];
  }

  /** Group and item labels, for building the custom-total picker. */
  categoryIndex(): { groupLabel: string; kind: CategoryKind; itemLabels: string[] }[] {
    return this.groups.map((group) => ({
      groupLabel: group.label,
      kind: group.kind,
      itemLabels: group.items.map((item) => item.label),
    }));
  }
}
