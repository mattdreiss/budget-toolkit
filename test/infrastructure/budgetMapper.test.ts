import { describe, expect, it } from "vitest";
import fixture from "../../dev/sample-data/budget-detail.json" with { type: "json" };
import { toBudget } from "../../src/infrastructure/everydollar/budgetMapper.js";
import { allocation, budgetDetail, group, item } from "../support/budgetBuilder.js";

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
