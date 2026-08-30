import type { CustomTotalDraft, CustomTotalView } from "../application/manageCustomTotals.js";
import type { Budget } from "../domain/budget/Budget.js";
import type { CustomTotalResult } from "../domain/custom-total/calculator.js";
import { describeSelection } from "../domain/custom-total/CustomTotal.js";
import { openSectionEditor } from "./sectionEditor.js";

/** What the view needs from the outside world to persist a change. */
export interface CustomTotalActions {
  update(id: string, draft: CustomTotalDraft): Promise<void>;
}

/**
 * The totals section: one row per saved section, name hard left and planned
 * total hard right, with the name itself opening the editor.
 *
 * The amount shown is the *planned* (budgeted) total, not what has been spent —
 * these sections exist to answer "how much of this month's plan is Needs?",
 * which is a question about the plan. `result.actual` is computed either way and
 * rides along in the row's tooltip.
 *
 * There is no local editing state here any more: the editor is a modal that
 * owns its own draft and hands back a finished set of selections. A re-render
 * from fresh budget data therefore cannot disturb a half-typed form, because
 * the form is not part of what gets re-rendered.
 */
export class CustomTotalsView {
  private budget: Budget | null = null;
  private totals: readonly CustomTotalView[] = [];

  constructor(
    private readonly container: HTMLElement,
    private readonly actions: CustomTotalActions,
  ) {}

  update(budget: Budget, totals: readonly CustomTotalView[]): void {
    this.budget = budget;
    this.totals = totals;
    this.render();
  }

  private render(): void {
    if (!this.budget) return;
    this.container.replaceChildren(
      ...this.totals.map((view) => this.renderRow(view)),
    );
  }

  private renderRow({ total, result }: CustomTotalView): HTMLElement {
    const section = document.createElement("div");
    section.className = "budget-toolkit-section";

    // Name and amount are the only things on this line, so `space-between` puts
    // one against each edge however wide the panel gets.
    const row = document.createElement("div");
    row.className = "budget-toolkit-section-row";

    const name = document.createElement("button");
    name.type = "button";
    name.className = "budget-toolkit-section-name";
    name.textContent = total.name;
    name.title = `Edit which budget items make up ${total.name}`;
    name.addEventListener("click", () => this.edit(total.id));

    const amount = document.createElement("span");
    amount.className = "budget-toolkit-section-amount";
    amount.textContent = result.budgeted.format();
    amount.title = `Planned this month · ${actualLabel(result)} so far ${result.actual.format()}`;

    row.append(name, amount);
    section.append(row);

    // The note is a line of its own rather than a third flex child, so it
    // cannot squeeze the amount away from the right-hand edge.
    const note = describeProblem(total.selections.length, result);
    if (note) {
      const hint = document.createElement("p");
      hint.className = "budget-toolkit-section-note";
      hint.textContent = note;
      if (result.missing.length > 0) {
        hint.classList.add("budget-toolkit-has-missing");
      }
      section.append(hint);
    }

    return section;
  }

  private edit(id: string): void {
    const budget = this.budget;
    const total = this.totals.find((view) => view.total.id === id)?.total;
    if (!budget || !total) return;

    openSectionEditor({
      name: total.name,
      selections: total.selections,
      availableItemLabels: budget.itemLabels(),
      onSave: (selections) => {
        void this.actions.update(total.id, { name: total.name, selections });
      },
    });
  }
}

/**
 * The row's second line, when there is something to say: either the section is
 * empty and needs setting up, or some of its items are not in this month.
 */
function describeProblem(
  selectionCount: number,
  result: CustomTotalResult,
): string | null {
  if (selectionCount === 0) return "No budget items yet — click the name to add some";
  if (result.missing.length === 0) return null;

  const names = result.missing.map(describeSelection).join(", ");
  return `Not in this month's budget: ${names}`;
}

/** How to read `result.actual` for what this section turned out to contain. */
function actualLabel(result: CustomTotalResult): string {
  if (result.kinds.length !== 1) return "Net";
  switch (result.kinds[0]) {
    case "income":
      return "Received";
    case "savings":
      return "Saved";
    default:
      return "Spent";
  }
}
