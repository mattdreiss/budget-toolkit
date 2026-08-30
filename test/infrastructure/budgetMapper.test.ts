import { describe, expect, it } from "vitest";
import fixture from "../../dev/sample-data/budget-detail.json" with { type: "json" };
import { computeDailySpend } from "../../src/domain/budget/spendSeries.js";
import { toBudget } from "../../src/infrastructure/everydollar/budgetMapper.js";
import {
  allocation,
  budgetDetail,
  group,
  item,
  type WireKind,
} from "../support/budgetBuilder.js";

describe("toBudget", () => {
  it("maps the recorded fixture into the domain", () => {
    const budget = toBudget(fixture);

    expect(budget.month.toString()).toBe("2026-01");
    expect(budget.groups.map((g) => g.label)).toEqual([
      "Income",
      "Housing & Utilities",
      "Food",
      "Lifestyle",
    ]);
    expect(budget.expenseItems()).toHaveLength(4);
  });

  /**
   * The fixtures are fabricated, so `YYYY-MM-DD` was our assumption about the
   * wire rather than an observation of it. The daily-spend series buckets on
   * exact string equality, so a timestamp reaching the domain intact matches no
   * day at all and plots a flat zero line — silently. Normalising in the mapper
   * is what stops that; throwing on a shape we cannot read is what stops it
   * being silent.
   */
  describe("allocation dates", () => {
    const dated = (date: string) =>
      toBudget(
        budgetDetail("2026-03-01", [
          group("Food", [
            item("Groceries", { allocations: [{ ...allocation("x", -1000), date }] }),
          ]),
        ]),
      );

    const dateOf = (date: string) =>
      dated(date).findGroup("Food")?.findItem("Groceries")?.allocations[0]?.date;

    it("keeps a plain calendar date as it is", () => {
      expect(dateOf("2026-03-05")).toBe("2026-03-05");
    });

    it("reduces a timestamp to the day it names, without reparsing it", () => {
      expect(dateOf("2026-03-05T00:00:00.000Z")).toBe("2026-03-05");
      expect(dateOf("2026-03-05T13:45:10-05:00")).toBe("2026-03-05");
      expect(dateOf("2026-03-05 13:45:10")).toBe("2026-03-05");
    });

    /**
     * Specifically the midnight-UTC case: `new Date(...).getDate()` would give
     * the 4th anywhere west of Greenwich, moving the transaction a day earlier.
     */
    it("still lands on the right day, and so on the right daily total", () => {
      const spend = computeDailySpend(dated("2026-03-05T00:00:00.000Z"));
      expect(spend.days.find((day) => day.date === "2026-03-05")?.amount.format()).toBe("$10.00");
      expect(spend.days.find((day) => day.date === "2026-03-04")?.amount.isZero()).toBe(true);
    });

    it("throws on a date shape it cannot read, rather than bucketing it nowhere", () => {
      expect(() => dated("03/05/2026")).toThrow(/ISO date/);
    });
  });

  describe("classifying savings", () => {
    const savingsBudget = (groupType: WireKind, itemType: WireKind = "expense") =>
      toBudget(
        budgetDetail("2026-03-01", [
          group("Savings", [item("Emergency Fund", { type: itemType })], groupType),
        ]),
      );

    it("takes the wire's word for it when it names savings", () => {
      expect(savingsBudget("savings").groups[0]?.kind).toBe("savings");
    });

    /**
     * The case that matters in practice: EveryDollar types every outgoing group
     * `expense`, so the group's *name* is the only signal that it is savings.
     */
    it("falls back to the group's name when the wire only says expense", () => {
      expect(savingsBudget("expense").groups[0]?.kind).toBe("savings");
    });

    /**
     * And the items have to follow, or the classification is undone one line at
     * a time — every item inside also arrives typed `expense`.
     */
    it("carries the classification down to the group's items", () => {
      const item = savingsBudget("expense").groups[0]?.items[0];
      expect(item?.kind).toBe("savings");
    });

    it("still lets an item declare itself income", () => {
      const item = savingsBudget("expense", "income").groups[0]?.items[0];
      expect(item?.kind).toBe("income");
    });

    it("leaves an ordinary group that merely mentions savings alone", () => {
      const budget = toBudget(
        budgetDetail("2026-03-01", [group("Savings Account Fees", [item("Monthly fee")])]),
      );
      expect(budget.groups[0]?.kind).toBe("expense");
    });
  });

  it("keeps allocation signs as cash flow while normalising budgeted to a magnitude", () => {
    const budget = toBudget(fixture);
    const groceries = budget.findGroup("Food")?.findItem("Groceries");

    expect(groceries?.budgeted.isNegative()).toBe(false);
    // Expenses arrive negative on the wire and stay negative in the domain.
    expect(groceries?.allocations.every((a) => a.amount.isNegative())).toBe(true);
    // ...but read as positive spend.
    expect(groceries?.actual().isNegative()).toBe(false);
  });

  it("orients actual by category kind", () => {
    const budget = toBudget(
      budgetDetail("2026-05-01", [
        group("Income", [
          item("Employer", { type: "income", allocations: [allocation("2026-05-01", 500000)] }),
        ], "income"),
        group("Food", [
          item("Groceries", { allocations: [allocation("2026-05-02", -7500)] }),
        ]),
      ]),
    );

    expect(budget.findGroup("Income")?.findItem("Employer")?.actual().format()).toBe("$5,000.00");
    expect(budget.findGroup("Food")?.findItem("Groceries")?.actual().format()).toBe("$75.00");
  });

  it("falls back to the group's kind when an item's type is unrecognised", () => {
    const payload = budgetDetail("2026-05-01", [
      { ...group("Income", [item("Bonus", { allocations: [allocation("2026-05-01", 1000)] })], "income") },
    ]);
    // Simulate a type EveryDollar might add later.
    const mutated = structuredClone(payload) as typeof payload;
    (mutated.groups[0]!.budgetItems[0] as { type: string }).type = "something-new";

    expect(toBudget(mutated).findGroup("Income")?.findItem("Bonus")?.kind).toBe("income");
  });

  it("defends against a payload that is not the shape we expect", () => {
    expect(() => toBudget(null)).toThrow(TypeError);
    expect(() => toBudget({ date: "2026-01-01" })).toThrow(TypeError);
    expect(() => toBudget({ date: 42, groups: [] })).toThrow(TypeError);
    expect(() =>
      toBudget(
        budgetDetail("2026-01-01", [
          group("Food", [{ ...item("Groceries"), amountBudgeted: "lots" as never }]),
        ]),
      ),
    ).toThrow(TypeError);
  });
});
