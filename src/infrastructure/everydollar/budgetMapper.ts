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
  const label = expectString(dto.label, `${path}.label`);
  const wireKind = toKind(dto.type, "expense");
  // The label deliberately outranks `type` here — see `looksLikeSavings`. It
  // cannot turn income into savings, only an outflow into a savings outflow.
  const kind = wireKind !== "income" && looksLikeSavings(label) ? "savings" : wireKind;

  const items = expectArray(dto.budgetItems, `${path}.budgetItems`).map((item, index) =>
    toItem(item, kind, `${path}.budgetItems[${index}]`),
  );

  return new BudgetGroup(label, kind, items);
}

function toItem(payload: unknown, groupKind: CategoryKind, path: string): BudgetItem {
  const dto = expectObject(payload, path) as unknown as BudgetItemDto;

  const allocations = expectArray(dto.allocations, `${path}.allocations`).map(
    (allocation, index) => toAllocation(allocation, `${path}.allocations[${index}]`),
  );

  return new BudgetItem(
    expectString(dto.label, `${path}.label`),
    toItemKind(dto.type, groupKind),
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
    toIsoDate(dto.date, `${path}.date`),
    // Kept signed: this is the raw direction of the movement, and it is what
    // lets a refund read as a refund rather than as extra spending.
    Money.fromCents(toCents(dto.amount, `${path}.amount`)),
    typeof dto.label === "string" ? dto.label : "",
    typeof dto.merchant === "string" ? dto.merchant : null,
  );
}

/**
 * The calendar day an allocation falls on, as `YYYY-MM-DD`.
 *
 * Anything after the tenth character is dropped rather than parsed, which is
 * deliberate: `new Date("2026-01-15T00:00:00.000Z").getDate()` is the 14th for
 * anyone west of Greenwich, so parsing would silently move a transaction to the
 * previous day — the same trap `MonthKey` documents and avoids. EveryDollar
 * shows a transaction against the date it carries, not against the reader's
 * timezone, so the leading date *is* the answer and the time is noise.
 *
 * The daily-spend series buckets on exact string equality against the month's
 * own `YYYY-MM-DD` days, so a timestamp that reaches the domain un-normalised
 * matches nothing and silently plots a flat zero line. Normalising here keeps
 * that knowledge in the anti-corruption layer, where the rest of the wire
 * format's quirks already live.
 */
const ISO_DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})(?:[T\s].*)?$/;

function toIsoDate(value: unknown, path: string): string {
  const raw = expectString(value, path);
  const match = ISO_DATE_PREFIX.exec(raw.trim());
  if (!match?.[1]) {
    throw new TypeError(
      `Expected ${path} to be an ISO date, received ${JSON.stringify(raw)}`,
    );
  }
  return match[1];
}

/**
 * EveryDollar's own words for a category kind.
 *
 * `savings` is listed under several spellings because it is the one value we
 * have not been able to confirm against a live payload — every month we have
 * seen contains only `income` and `expense` groups. The spellings all collapse
 * to the same domain kind, so guessing wide costs nothing and guessing narrow
 * would put a savings transfer on the spending graph.
 */
const WIRE_KINDS = new Map<string, CategoryKind>([
  ["income", "income"],
  ["expense", "expense"],
  ["savings", "savings"],
  ["saving", "savings"],
  ["fund", "savings"],
  ["funds", "savings"],
  ["sinkingfund", "savings"],
]);

// A `Map`, not an object literal: a lookup of `constructor` or `toString` on a
// literal walks the prototype chain and returns a function instead of missing.
function toKind(value: unknown, fallback: CategoryKind): CategoryKind {
  if (typeof value !== "string") return fallback;
  return WIRE_KINDS.get(value.toLowerCase().replace(/[\s_-]/g, "")) ?? fallback;
}

/**
 * An item's kind: its own type where that says something, its group's otherwise.
 *
 * The exception is the one that makes savings work at all. EveryDollar types
 * every outgoing line `expense`, including the ones inside a savings group, so
 * an item saying "expense" does not contradict a group classified as savings —
 * it is just the wire's only word for "money going out", repeated. Letting it
 * win would undo the group's classification on every single item and put the
 * whole group back on the spending graph. An explicit `income` still flips the
 * line, because that genuinely is new information.
 */
function toItemKind(value: unknown, groupKind: CategoryKind): CategoryKind {
  const own = toKind(value, groupKind);
  return groupKind === "savings" && own === "expense" ? "savings" : own;
}

/**
 * Detects a savings group by name, because `type` alone cannot be relied on.
 *
 * EveryDollar's default template ships a group called "Savings", and every
 * payload we have been able to inspect types its groups only as `income` or
 * `expense` — so a savings group very likely arrives typed `expense`. Treating
 * `type` as the last word would then plot every transfer to a sinking fund as
 * spending, which is exactly the thing the graph is supposed to leave out.
 *
 * So for *groups only* the name wins over the type. The match is anchored, not
 * a substring, so "Savings" and "Saving" reclassify but "Savings Account Fees"
 * stays an ordinary expense. An item inside the group still inherits from it
 * and can still be typed individually.
 */
function looksLikeSavings(label: string): boolean {
  return /^savings?$/i.test(label.trim());
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
