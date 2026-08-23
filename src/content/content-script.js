(function () {
  const { createPanel, renderGraph, renderTotals, computeDailySpend } = window.BudgetToolkit;
  const { graphContainer, totalsContainer } = createPanel();

  window.addEventListener("budget-toolkit:budget-detail", (event) => {
    const budgetDetail = event.detail;
    renderGraph(graphContainer, computeDailySpend(budgetDetail));
    renderTotals(totalsContainer, budgetDetail);
  });
})();
