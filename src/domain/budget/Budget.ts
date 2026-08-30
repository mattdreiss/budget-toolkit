import { Money } from "../shared/Money.js";
import { MonthKey, type IsoDate } from "../shared/MonthKey.js";

/**
 * Whether a category takes money in or pays it out. This drives the sign rule
 * below, so it has to survive the trip through the mapper — it is not cosmetic.
 */
export type CategoryKind = "income" | "expense";

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
   * expense, money received on an income.
   *
   * This is the single definition of "actual" in the app. Both the spending
   * graph and custom totals go through it, which is what stops them from
   * disagreeing — and it makes a refund (a positive movement on an expense)
   * correctly *reduce* spend instead of inflating it.
   */
  actual(): Money {
    const net = Money.sum(this.allocations.map((allocation) => allocation.amount));
    return this.kind === "expense" ? net.negate() : net;
  }

  /** `actual()` restricted to one day. */
  actualOn(date: IsoDate): Money {
    const net = Money.sum(
      this.allocations
        .filter((allocation) => allocation.date === date)
        .map((allocation) => allocation.amount),
    );
    return this.kind === "expense" ? net.negate() : net;
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

  expenseItems(): BudgetItem[] {
    return this.items().filter((item) => item.kind === "expense");
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
