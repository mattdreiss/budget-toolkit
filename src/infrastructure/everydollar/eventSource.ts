import type { BudgetSource } from "../../application/ports.js";
import type { Budget } from "../../domain/budget/Budget.js";
import { BUDGET_DETAIL_EVENT } from "./channel.js";
import { toBudget } from "./budgetMapper.js";

/**
 * The content-script end of the channel: raw payloads in, domain budgets out.
 *
 * A payload that fails to map is logged and dropped rather than thrown, because
 * this runs inside someone else's page — a shape change in EveryDollar's API
 * should leave the panel showing the last good month, not break the listener
 * and take the rest of the extension down with it.
 */
export class BudgetDetailEventSource implements BudgetSource {
  constructor(private readonly target: EventTarget = window) {}

  onBudget(listener: (budget: Budget) => void): () => void {
    const handler = (event: Event) => {
      const budget = this.read(event);
      if (budget) listener(budget);
    };

    this.target.addEventListener(BUDGET_DETAIL_EVENT, handler);
    return () => this.target.removeEventListener(BUDGET_DETAIL_EVENT, handler);
  }

  private read(event: Event): Budget | null {
    try {
      return toBudget((event as CustomEvent<unknown>).detail);
    } catch (error) {
      console.warn("[budget-toolkit] ignoring unreadable budget payload:", error);
      return null;
    }
  }
}
