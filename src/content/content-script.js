(function () {
  const { createPanel, mountPanel, renderGraph, renderTotals, computeDailySpend } =
    window.BudgetToolkit;
  const { panel, graphContainer, totalsContainer } = createPanel();
  mountPanel(panel);

  window.addEventListener("budget-toolkit:budget-detail", (event) => {
    const budgetDetail = event.detail;
    renderGraph(graphContainer, computeDailySpend(budgetDetail));
    renderTotals(totalsContainer, budgetDetail);
  });
})();
