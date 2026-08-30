import type { Budget } from "./Budget.js";
import { Money } from "../shared/Money.js";
import type { IsoDate } from "../shared/MonthKey.js";

export interface DailySpend {
  readonly date: IsoDate;
  readonly amount: Money;
}

/** Spend for every day of a budget's month, in date order. */
export class SpendSeries {
  constructor(readonly days: readonly DailySpend[]) {}

  total(): Money {
    return Money.sum(this.days.map((day) => day.amount));
  }
}

/**
 * Net expense spending per day, across the whole month.
 *
 * Only expense items count. Income is excluded rather than netted off: this is
 * a *spending* graph, and folding a paycheck in produced a huge negative spike
 * on payday and a monthly total that was understated by total income.
 *
 * Every day of the month is present, including days with no activity, so the
 * chart's x-axis is a real calendar rather than only the days that happen to
 * have transactions.
 */
export function computeDailySpend(budget: Budget): SpendSeries {
  const totals = new Map<IsoDate, Money>(
    budget.month.eachDate().map((date) => [date, Money.zero()]),
  );

  for (const item of budget.expenseItems()) {
    for (const allocation of item.allocations) {
      const running = totals.get(allocation.date);
      // Allocations dated outside the budget's own month are ignored rather
      // than clamped — they would otherwise pile onto an unrelated day.
      if (running === undefined) continue;
      totals.set(allocation.date, running.minus(allocation.amount));
    }
  }

  return new SpendSeries(
    [...totals].map(([date, amount]) => ({ date, amount })),
  );
}
