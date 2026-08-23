window.BudgetToolkit = window.BudgetToolkit || {};

window.BudgetToolkit.createPanel = function createPanel() {
  const panel = document.createElement("div");
  panel.id = "budget-toolkit-panel";

  const header = document.createElement("div");
  header.className = "budget-toolkit-header";

  const title = document.createElement("span");
  title.textContent = "Budget Toolkit";

  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className = "budget-toolkit-toggle";
  toggleButton.textContent = "–";
  toggleButton.addEventListener("click", () => {
    panel.classList.toggle("budget-toolkit-collapsed");
    toggleButton.textContent = panel.classList.contains("budget-toolkit-collapsed") ? "+" : "–";
  });

  header.append(title, toggleButton);

  const body = document.createElement("div");
  body.className = "budget-toolkit-body";

  const graphSection = document.createElement("section");
  const graphHeading = document.createElement("h3");
  graphHeading.textContent = "Spending this month";
  const graphContainer = document.createElement("div");
  graphContainer.className = "budget-toolkit-graph";
  graphSection.append(graphHeading, graphContainer);

  const totalsSection = document.createElement("section");
  const totalsHeading = document.createElement("h3");
  totalsHeading.textContent = "Custom Totals";
  const totalsContainer = document.createElement("div");
  totalsSection.append(totalsHeading, totalsContainer);

  body.append(graphSection, totalsSection);
  panel.append(header, body);
  document.body.appendChild(panel);

  return { panel, graphContainer, totalsContainer };
};
