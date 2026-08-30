import type { Budget } from "../domain/budget/Budget.js";
import type { CustomTotal } from "../domain/custom-total/CustomTotal.js";

/**
 * Where budgets come from. The only implementation observes EveryDollar's own
 * network traffic, but the domain and use cases never learn that — which is
 * what lets them be tested against plain fixtures.
 */
export interface BudgetSource {
  /** Registers a listener; returns a function that detaches it. */
  onBudget(listener: (budget: Budget) => void): () => void;
}

/** Persistence for the user's saved totals. */
export interface CustomTotalRepository {
  list(): Promise<CustomTotal[]>;
  save(totals: readonly CustomTotal[]): Promise<void>;
}
