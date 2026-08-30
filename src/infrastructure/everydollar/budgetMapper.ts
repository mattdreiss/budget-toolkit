import {
  Allocation,
  Budget,
  BudgetGroup,
  BudgetItem,
  type CategoryKind,
} from "../../domain/budget/Budget.js";
import { Money } from "../../domain/shared/Money.js";
import { MonthKey } from "../../domain/shared/MonthKey.js";
import type {
  AllocationDto,
  BudgetGroupDto,
  BudgetItemDto,
} from "./budgetDetailDto.js";

/**
 * Anti-corruption layer: EveryDollar's wire format in, our domain out.
 *
 * This is the *only* place that knows EveryDollar's sign convention. Everything
 * downstream sees a uniform model — budgeted amounts as positive magnitudes,
 * allocations as signed cash flow — so no calculation ever has to re-derive
 * "does negative mean spent here?" and get a different answer than its
 * neighbour did.
 *
 * The payload is validated rather than trusted: it is a third party's private
 * API that can change without warning, and a clear throw that the caller can
 * skip beats a panel rendering `$NaN`.
 */
export function toBudget(payload: unknown): Budget {
  const dto = expectObject(payload, "budget");

  const groups = expectArray(dto["groups"], "budget.groups").map((group, index) =>
    toGroup(group, `budget.groups[${index}]`),
  );

  return new Budget(MonthKey.parse(expectString(dto["date"], "budget.date")), groups);
}

function toGroup(payload: unknown, path: string): BudgetGroup {
  const dto = expectObject(payload, path) as unknown as BudgetGroupDto;
  const kind = toKind(dto.type, "expense");

  const items = expectArray(dto.budgetItems, `${path}.budgetItems`).map((item, index) =>
    toItem(item, kind, `${path}.budgetItems[${index}]`),
  );

  return new BudgetGroup(expectString(dto.label, `${path}.label`), kind, items);
}

function toItem(payload: unknown, groupKind: CategoryKind, path: string): BudgetItem {
  const dto = expectObject(payload, path) as unknown as BudgetItemDto;

  const allocations = expectArray(dto.allocations, `${path}.allocations`).map(
    (allocation, index) => toAllocation(allocation, `${path}.allocations[${index}]`),
  );

  return new BudgetItem(
    expectString(dto.label, `${path}.label`),
    // An item's own type is authoritative, but it falls back to its group's so
    // that an unrecognised value cannot silently flip a line's sign.
    toKind(dto.type, groupKind),
    // Budgeted is stated as a positive magnitude for both kinds; the abs is
    // defensive, so a sign appearing upstream cannot invert a total.
    Money.fromCents(Math.abs(toCents(dto.amountBudgeted, `${path}.amountBudgeted`))),
    allocations,
  );
}

function toAllocation(payload: unknown, path: string): Allocation {
  const dto = expectObject(payload, path) as unknown as AllocationDto;

  return new Allocation(
    expectString(dto.id, `${path}.id`),
    expectString(dto.date, `${path}.date`),
    // Kept signed: this is the raw direction of the movement, and it is what
    // lets a refund read as a refund rather than as extra spending.
    Money.fromCents(toCents(dto.amount, `${path}.amount`)),
    typeof dto.label === "string" ? dto.label : "",
    typeof dto.merchant === "string" ? dto.merchant : null,
  );
}

function toKind(value: unknown, fallback: CategoryKind): CategoryKind {
  if (value === "income" || value === "expense") return value;
  return fallback;
}

function toCents(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`Expected ${path} to be a number, received ${JSON.stringify(value)}`);
  }
  // Cents should already be whole; rounding guards against a float creeping in
  // upstream, which `Money` would otherwise reject outright.
  return Math.round(value);
}

function expectObject(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`Expected ${path} to be an object`);
  }
  return value as Record<string, unknown>;
}

function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`Expected ${path} to be an array`);
  }
  return value;
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`Expected ${path} to be a string, received ${JSON.stringify(value)}`);
  }
  return value;
}
