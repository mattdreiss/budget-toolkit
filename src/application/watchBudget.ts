import type { BudgetSource } from "./ports.js";
import { viewCustomTotals, type CustomTotalView } from "./manageCustomTotals.js";
import type { ManageCustomTotals } from "./manageCustomTotals.js";
import type { Budget } from "../domain/budget/Budget.js";
import { computeDailySpend, type SpendSeries } from "../domain/budget/spendSeries.js";
import type { CustomTotal } from "../domain/custom-total/CustomTotal.js";

export interface BudgetSnapshot {
  readonly budget: Budget;
  readonly spend: SpendSeries;
  readonly totals: readonly CustomTotalView[];
}

/**
 * Keeps the panel in step with whatever month the user is looking at.
 *
 * Holds the most recent budget so a change to the saved totals can be
 * re-rendered immediately, rather than sitting stale until EveryDollar happens
 * to refetch. Both entry points into a render — a new budget, or edited totals
 * — end up in the same `emit`, so there is one code path that builds a snapshot.
 */
export class WatchBudget {
  private budget: Budget | null = null;
  private totals: CustomTotal[] = [];

  constructor(
    private readonly source: BudgetSource,
    private readonly customTotals: ManageCustomTotals,
    private readonly onSnapshot: (snapshot: BudgetSnapshot) => void,
  ) {}

  /** Begins observing. Returns a function that stops it. */
  start(): () => void {
    const detach = this.source.onBudget((budget) => {
      this.budget = budget;
      this.emit();
    });

    void this.customTotals.list().then((totals) => {
      this.totals = totals;
      this.emit();
    });

    return detach;
  }

  /** Called after the user creates, edits or deletes a total. */
  totalsChanged(totals: readonly CustomTotal[]): void {
    this.totals = [...totals];
    this.emit();
  }

  private emit(): void {
    if (!this.budget) return;
    this.onSnapshot({
      budget: this.budget,
      spend: computeDailySpend(this.budget),
      totals: viewCustomTotals(this.budget, this.totals),
    });
  }
}
