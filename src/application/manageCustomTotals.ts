import type { CustomTotalRepository } from "./ports.js";
import type { Budget } from "../domain/budget/Budget.js";
import {
  CustomTotal,
  type CategorySelection,
} from "../domain/custom-total/CustomTotal.js";
import {
  computeCustomTotal,
  type CustomTotalResult,
} from "../domain/custom-total/calculator.js";

export interface CustomTotalView {
  readonly total: CustomTotal;
  readonly result: CustomTotalResult;
}

export interface CustomTotalDraft {
  readonly name: string;
  readonly selections: readonly CategorySelection[];
}

/**
 * The write side of custom totals. Every mutation returns the full new list so
 * callers re-render from one source of truth instead of patching local state
 * and drifting from what was persisted.
 */
export class ManageCustomTotals {
  constructor(private readonly repository: CustomTotalRepository) {}

  list(): Promise<CustomTotal[]> {
    return this.repository.list();
  }

  async create(draft: CustomTotalDraft): Promise<CustomTotal[]> {
    const existing = await this.repository.list();
    const next = [...existing, CustomTotal.create(draft.name, draft.selections)];
    await this.repository.save(next);
    return next;
  }

  async update(id: string, draft: CustomTotalDraft): Promise<CustomTotal[]> {
    const existing = await this.repository.list();
    const next = existing.map((total) =>
      total.id === id
        ? total.with({ name: draft.name, selections: draft.selections })
        : total,
    );
    await this.repository.save(next);
    return next;
  }

  async remove(id: string): Promise<CustomTotal[]> {
    const existing = await this.repository.list();
    const next = existing.filter((total) => total.id !== id);
    await this.repository.save(next);
    return next;
  }
}

/** Pairs each saved total with its amounts for the month currently on screen. */
export function viewCustomTotals(
  budget: Budget,
  totals: readonly CustomTotal[],
): CustomTotalView[] {
  return totals.map((total) => ({
    total,
    result: computeCustomTotal(budget, total),
  }));
}
