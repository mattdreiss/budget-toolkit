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
 * The sections every budget starts with, in the order they are shown.
 *
 * They are seeded rather than hard-coded into the view so that they are
 * ordinary totals once created: they persist, they are edited through the same
 * `update` path as anything else, and the view has no notion of a "built-in"
 * section it has to treat differently.
 */
export const DEFAULT_SECTION_NAMES = ["Savings", "Needs", "Wants"] as const;

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

  /**
   * The saved totals, with any missing default section created and persisted.
   *
   * Matching on name (case-insensitively) rather than on a marker id is what
   * makes this idempotent across reloads without inventing a second identity
   * for a total. Seeded sections start empty — the user fills them in — and
   * only the ones actually absent are added, so a section the user has renamed
   * is left alone rather than resurrected alongside its replacement.
   */
  async listWithDefaults(): Promise<CustomTotal[]> {
    const existing = await this.repository.list();
    const present = new Set(existing.map((total) => total.name.trim().toLowerCase()));

    const seeded = DEFAULT_SECTION_NAMES.filter(
      (name) => !present.has(name.toLowerCase()),
    ).map((name) => CustomTotal.create(name, []));

    if (seeded.length === 0) return existing;

    const next = [...existing, ...seeded];
    await this.repository.save(next);
    return next;
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
