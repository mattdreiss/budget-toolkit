window.BudgetToolkit = window.BudgetToolkit || {};

window.BudgetToolkit.getCustomTotals = function getCustomTotals() {
  return chrome.storage.local.get("customTotals").then((result) => result.customTotals || []);
};

window.BudgetToolkit.saveCustomTotals = function saveCustomTotals(customTotals) {
  return chrome.storage.local.set({ customTotals });
};
