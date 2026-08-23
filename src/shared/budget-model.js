window.BudgetToolkit = window.BudgetToolkit || {};

window.BudgetToolkit.computeDailySpend = function computeDailySpend(budgetDetail) {
  const [yearStr, monthStr] = budgetDetail.date.split("-");
  const daysInMonth = new Date(Number(yearStr), Number(monthStr), 0).getDate();

  const dailyCents = {};
  for (let day = 1; day <= daysInMonth; day++) {
    dailyCents[`${yearStr}-${monthStr}-${String(day).padStart(2, "0")}`] = 0;
  }

  for (const group of budgetDetail.groups) {
    for (const item of group.budgetItems) {
      for (const allocation of item.allocations) {
        if (dailyCents[allocation.date] === undefined) continue;
        // Allocation amounts are negative for money spent, so negating
        // turns a normal expense into a positive "spent" value and a
        // refund/credit correctly reduces that day's total.
        dailyCents[allocation.date] -= allocation.amount;
      }
    }
  }

  return dailyCents;
};

window.BudgetToolkit.buildCategoryIndex = function buildCategoryIndex(budgetDetail) {
  return budgetDetail.groups.map((group) => ({
    groupLabel: group.label,
    items: group.budgetItems.map((item) => item.label),
  }));
};

window.BudgetToolkit.computeTotalForSelections = function computeTotalForSelections(
  budgetDetail,
  selections
) {
  let budgetedCents = 0;
  let spentCents = 0;
  const missing = [];

  for (const selection of selections) {
    const group = budgetDetail.groups.find((g) => g.label === selection.groupLabel);
    if (!group) {
      missing.push(selection);
      continue;
    }

    const items =
      selection.type === "group"
        ? group.budgetItems
        : group.budgetItems.filter((item) => item.label === selection.itemLabel);

    if (selection.type === "item" && items.length === 0) {
      missing.push(selection);
      continue;
    }

    for (const item of items) {
      budgetedCents += Math.abs(item.amountBudgeted);
      for (const allocation of item.allocations) {
        spentCents += Math.abs(allocation.amount);
      }
    }
  }

  return { budgetedCents, spentCents, missing };
};
