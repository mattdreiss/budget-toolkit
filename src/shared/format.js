window.BudgetToolkit = window.BudgetToolkit || {};

window.BudgetToolkit.centsToDollars = function centsToDollars(cents) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
};
