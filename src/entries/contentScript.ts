import { ManageCustomTotals } from "../application/manageCustomTotals.js";
import { WatchBudget } from "../application/watchBudget.js";
import { BudgetDetailEventSource } from "../infrastructure/everydollar/eventSource.js";
import { ChromeStorageCustomTotalRepository } from "../infrastructure/storage/chromeStorageRepository.js";
import { CustomTotalsView } from "../presentation/customTotalsView.js";
import { createPanel } from "../presentation/panel.js";
import { mountPanel } from "../presentation/mountPanel.js";
import { renderSpendChart } from "../presentation/spendChart.js";

/**
 * Composition root for the content script: the one place that picks concrete
 * adapters. Everything below this file depends on interfaces, which is what
 * keeps the domain and use cases testable without a browser.
 */
const panel = createPanel();
const customTotals = new ManageCustomTotals(new ChromeStorageCustomTotalRepository());

const watch: WatchBudget = new WatchBudget(
  new BudgetDetailEventSource(),
  customTotals,
  (snapshot) => {
    renderSpendChart(panel.chartContainer, snapshot.spend);
    totalsView.update(snapshot.budget, snapshot.totals);
  },
);

// Editing persists, then hands the new list back to the watcher so the panel
// re-renders from what was actually saved rather than from local state.
const totalsView = new CustomTotalsView(panel.totalsContainer, {
  update: async (id, draft) => watch.totalsChanged(await customTotals.update(id, draft)),
});

mountPanel(panel.root);
watch.start();
