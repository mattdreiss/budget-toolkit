export interface Panel {
  readonly root: HTMLElement;
  readonly chartContainer: HTMLElement;
  readonly totalsContainer: HTMLElement;
}

/** Builds the panel shell: a collapsible header and the two feature sections. */
export function createPanel(): Panel {
  const root = document.createElement("div");
  root.id = "budget-toolkit-panel";

  const body = document.createElement("div");
  body.className = "budget-toolkit-body";

  const chart = section("Spending this month", "budget-toolkit-graph");
  const totals = section("Custom Totals");

  body.append(chart.element, totals.element);
  root.append(createHeader(root), body);

  return {
    root,
    chartContainer: chart.content,
    totalsContainer: totals.content,
  };
}

function createHeader(root: HTMLElement): HTMLElement {
  const header = document.createElement("div");
  header.className = "budget-toolkit-header";

  const title = document.createElement("span");
  title.textContent = "Budget Toolkit";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "budget-toolkit-toggle";
  toggle.textContent = "–";
  toggle.setAttribute("aria-label", "Collapse Budget Toolkit");
  toggle.addEventListener("click", () => {
    const collapsed = root.classList.toggle("budget-toolkit-collapsed");
    toggle.textContent = collapsed ? "+" : "–";
    toggle.setAttribute(
      "aria-label",
      collapsed ? "Expand Budget Toolkit" : "Collapse Budget Toolkit",
    );
  });

  header.append(title, toggle);
  return header;
}

function section(
  heading: string,
  contentClass?: string,
): { element: HTMLElement; content: HTMLElement } {
  const element = document.createElement("section");

  const title = document.createElement("h3");
  title.textContent = heading;

  const content = document.createElement("div");
  if (contentClass) content.className = contentClass;

  element.append(title, content);
  return { element, content };
}
