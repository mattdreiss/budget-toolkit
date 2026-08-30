import type {
  AllocationDto,
  BudgetDetailDto,
  BudgetGroupDto,
  BudgetItemDto,
} from "../../src/infrastructure/everydollar/budgetDetailDto.js";

/**
 * Builds wire-shaped payloads for cases the recorded fixture does not cover
 * (refunds, renamed categories, a second month).
 *
 * Tests go in through the mapper rather than constructing domain objects
 * directly, so the sign conventions under test are the ones real payloads
 * actually exercise.
 */
let sequence = 0;
const nextId = (kind: string) => `urn:everydollar:test:${kind}:${++sequence}`;

export function allocation(
  date: string,
  amount: number,
  label = "Test transaction",
): AllocationDto {
  return { id: nextId("allocation"), date, amount, label, merchant: label };
}

export function item(
  label: string,
  options: {
    type?: "income" | "expense";
    amountBudgeted?: number;
    allocations?: AllocationDto[];
  } = {},
): BudgetItemDto {
  return {
    id: nextId("item"),
    label,
    type: options.type ?? "expense",
    amountBudgeted: options.amountBudgeted ?? 0,
    carryOverBalance: 0,
    allocations: options.allocations ?? [],
  };
}

export function group(
  label: string,
  items: BudgetItemDto[],
  type: "income" | "expense" = "expense",
): BudgetGroupDto {
  return { id: nextId("group"), label, type, budgetItems: items };
}

export function budgetDetail(date: string, groups: BudgetGroupDto[]): BudgetDetailDto {
  return { id: nextId("budget"), date, bufferAmountCents: 0, groups };
}
