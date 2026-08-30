import { describe, expect, it } from "vitest";
import fixture from "../../dev/sample-data/budget-detail.json" with { type: "json" };
import { computeDailySpend } from "../../src/domain/budget/spendSeries.js";
import { computeCustomTotal } from "../../src/domain/custom-total/calculator.js";
import { CustomTotal } from "../../src/domain/custom-total/CustomTotal.js";
import { toBudget } from "../../src/infrastructure/everydollar/budgetMapper.js";
import { allocation, budgetDetail, group, item } from "../support/budgetBuilder.js";

const total = (name: string, selections: CustomTotal["selections"]) =>
  new CustomTotal("test-id", name, selections);

describe("CustomTotal", () => {
  it("rejects a total with no name", () => {
    expect(() => total("  ", [{ type: "group", groupLabel: "Food" }])).toThrow();
  });

  /**
   * The three sections are seeded empty on first run so the user has something
   * to click, so "no categories" has to be a legal state. It used to throw.
   */
  it("allows a total with no categories, and totals it as nothing", () => {
    const empty = total("Wants", []);
    const result = computeCustomTotal(toBudget(fixture), empty);

    expect(result.budgeted.format()).toBe("$0.00");
    expect(result.missing).toHaveLength(0);
  });

  it("drops duplicate selections on create", () => {
    const created = CustomTotal.create(
      "Food",
      [
        { type: "group", groupLabel: "Food" },
        { type: "group", groupLabel: "Food" },
      ],
      () => "id",
    );
    expect(created.selections).toHaveLength(1);
  });
});

describe("computeCustomTotal", () => {
  const budget = toBudget(fixture);

  it("rolls up a whole group", () => {
    const result = computeCustomTotal(budget, total("Food", [
      { type: "group", groupLabel: "Food" },
    ]));

    expect(result.budgeted.format()).toBe("$700.00");
    expect(result.actual.format()).toBe("$179.00");
    expect(result.missing).toHaveLength(0);
  });

  /**
   * Regression for the second original bug: totals summed `Math.abs(amount)`
   * while the graph summed signed amounts, so the two disagreed. They now share
   * `BudgetItem.actual()` and must agree on the same categories.
   */
  it("agrees with the spending graph over the same expense categories", () => {
    const everyExpenseGroup = budget.groups
      .filter((candidate) => candidate.kind === "expense")
      .map((candidate) => ({ type: "group" as const, groupLabel: candidate.label }));

    const result = computeCustomTotal(budget, total("Everything", everyExpenseGroup));

    expect(result.actual.cents).toBe(computeDailySpend(budget).total().cents);
  });

  it("reports income as received rather than spent", () => {
    const result = computeCustomTotal(budget, total("Paycheck", [
      { type: "group", groupLabel: "Income" },
    ]));

    expect(result.kinds).toEqual(["income"]);
    expect(result.actual.format()).toBe("$4,000.00");
  });

  it("counts an item once when it is also covered by a selected group", () => {
    const result = computeCustomTotal(budget, total("Overlapping", [
      { type: "group", groupLabel: "Food" },
      { type: "item", groupLabel: "Food", itemLabel: "Groceries" },
    ]));

    expect(result.budgeted.format()).toBe("$700.00");
    expect(result.actual.format()).toBe("$179.00");
  });

  describe("name-only selections", () => {
    it("resolves an item typed by name, with no group to go on", () => {
      const result = computeCustomTotal(budget, total("Needs", [
        { type: "itemByLabel", itemLabel: "Groceries" },
        { type: "itemByLabel", itemLabel: "Rent" },
      ]));

      expect(result.budgeted.format()).toBe("$2,000.00");
      expect(result.missing).toHaveLength(0);
    });

    /**
     * The reason a name-only selection is worth having: EveryDollar lets an item
     * be dragged into a different group, and the section should not quietly
     * empty itself when that happens.
     */
    it("keeps resolving after the item moves to another group", () => {
      const saved = total("Needs", [{ type: "itemByLabel", itemLabel: "Groceries" }]);

      const moved = toBudget(
        budgetDetail("2026-02-01", [
          group("Household", [
            item("Groceries", {
              amountBudgeted: 45000,
              allocations: [allocation("2026-02-03", -20000)],
            }),
          ]),
        ]),
      );

      const result = computeCustomTotal(moved, saved);
      expect(result.budgeted.format()).toBe("$450.00");
      expect(result.actual.format()).toBe("$200.00");
      expect(result.missing).toHaveLength(0);
    });

    it("counts the same line once when reached by name and by group", () => {
      const result = computeCustomTotal(budget, total("Overlapping", [
        { type: "group", groupLabel: "Food" },
        { type: "itemByLabel", itemLabel: "Groceries" },
      ]));

      expect(result.budgeted.format()).toBe("$700.00");
    });

    it("reports a name that is not in this month's budget", () => {
      const result = computeCustomTotal(budget, total("Needs", [
        { type: "itemByLabel", itemLabel: "Gym membership" },
      ]));

      expect(result.missing).toEqual([
        { type: "itemByLabel", itemLabel: "Gym membership" },
      ]);
      expect(result.budgeted.isZero()).toBe(true);
    });
  });

  it("reports selections that no longer resolve, and still totals the rest", () => {
    const result = computeCustomTotal(budget, total("Partly stale", [
      { type: "item", groupLabel: "Food", itemLabel: "Groceries" },
      { type: "item", groupLabel: "Food", itemLabel: "Renamed away" },
      { type: "group", groupLabel: "Deleted group" },
    ]));

    expect(result.missing).toHaveLength(2);
    expect(result.actual.isZero()).toBe(false);
  });

  /**
   * The whole reason selections are stored by label: EveryDollar mints new ids
   * every month, so a saved total has to resolve against a budget it has never
   * seen before.
   */
  it("keeps resolving in a later month, where every id has changed", () => {
    const saved = total("Groceries", [
      { type: "item", groupLabel: "Food", itemLabel: "Groceries" },
    ]);

    const nextMonth = toBudget(
      budgetDetail("2026-02-01", [
        group("Food", [
          item("Groceries", {
            amountBudgeted: 60000,
            allocations: [allocation("2026-02-03", -12345)],
          }),
        ]),
      ]),
    );

    const result = computeCustomTotal(nextMonth, saved);
    expect(result.missing).toHaveLength(0);
    expect(result.actual.format()).toBe("$123.45");
  });
});
