import { describe, expect, it } from "vitest";
import fixture from "../../dev/sample-data/budget-detail.json" with { type: "json" };
import { computeDailySpend } from "../../src/domain/budget/spendSeries.js";
import { toBudget } from "../../src/infrastructure/everydollar/budgetMapper.js";
import { allocation, budgetDetail, group, item } from "../support/budgetBuilder.js";

const spendFor = (payload: unknown) => computeDailySpend(toBudget(payload));

describe("computeDailySpend", () => {
  /**
   * Regression for the original bug: the loop ran over every group, including
   * income, and subtracted each allocation. Income allocations are positive, so
   * payday landed as -$4,000 on the spending chart and the month totalled
   * -$2,276.00 instead of the $1,724.00 actually spent.
   */
  it("excludes income, so a paycheck is not counted as spending", () => {
    const spend = spendFor(fixture);
    const payday = spend.days.find((day) => day.date === "2026-01-15");

    expect(payday?.amount.format()).toBe("$0.00");
    expect(spend.total().format()).toBe("$1,724.00");
  });

  it("covers every day of the month, including days with no activity", () => {
    const spend = spendFor(fixture);

    expect(spend.days).toHaveLength(31);
    expect(spend.days[0]?.date).toBe("2026-01-01");
    expect(spend.days.at(-1)?.date).toBe("2026-01-31");
    expect(spend.days.find((day) => day.date === "2026-01-20")?.amount.isZero()).toBe(true);
  });

  it("sums multiple expenses landing on the same day", () => {
    const spend = spendFor(
      budgetDetail("2026-03-01", [
        group("Food", [
          item("Groceries", {
            allocations: [
              allocation("2026-03-04", -2500),
              allocation("2026-03-04", -1000),
            ],
          }),
        ]),
      ]),
    );

    expect(spend.days.find((day) => day.date === "2026-03-04")?.amount.format()).toBe("$35.00");
  });

  /**
   * A refund is a positive amount on an expense item. It has to reduce that
   * day's spend; `Math.abs` would have made it increase it.
   */
  it("lets a refund reduce spending rather than inflate it", () => {
    const spend = spendFor(
      budgetDetail("2026-03-01", [
        group("Lifestyle", [
          item("Clothing", {
            allocations: [
              allocation("2026-03-10", -8000, "Jacket"),
              allocation("2026-03-10", 3000, "Jacket returned"),
            ],
          }),
        ]),
      ]),
    );

    expect(spend.days.find((day) => day.date === "2026-03-10")?.amount.format()).toBe("$50.00");
    expect(spend.total().format()).toBe("$50.00");
  });

  it("ignores allocations dated outside the budget's own month", () => {
    const spend = spendFor(
      budgetDetail("2026-03-01", [
        group("Food", [
          item("Groceries", {
            allocations: [allocation("2026-03-02", -1000), allocation("2026-04-02", -9999)],
          }),
        ]),
      ]),
    );

    expect(spend.total().format()).toBe("$10.00");
  });
});
