import type { CustomTotalDraft, CustomTotalView } from "../application/manageCustomTotals.js";
import type { Budget } from "../domain/budget/Budget.js";
import type { CustomTotalResult } from "../domain/custom-total/calculator.js";
import {
  selectionKey,
  type CategorySelection,
} from "../domain/custom-total/CustomTotal.js";

/** What the view needs from the outside world to persist a change. */
export interface CustomTotalActions {
  create(draft: CustomTotalDraft): Promise<void>;
  update(id: string, draft: CustomTotalDraft): Promise<void>;
  remove(id: string): Promise<void>;
}

const NEW_TOTAL = Symbol("new custom total");
type Editing = string | typeof NEW_TOTAL | null;

/**
 * The custom totals section: a list of saved totals with their amounts, and an
 * inline form for adding or editing one.
 *
 * Editing state lives here rather than in the application layer because it is
 * pure UI — a half-filled form is not something the rest of the app, or storage,
 * has any business knowing about. Keeping it on the instance means a re-render
 * triggered by fresh budget data does not close the form the user is typing in.
 */
export class CustomTotalsView {
  private editing: Editing = null;
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
    this.container.replaceChildren(this.renderList());

    if (this.editing === null) {
      this.container.append(this.renderAddButton());
    } else {
      this.container.append(this.renderForm());
    }
  }

  private renderList(): HTMLElement {
    const list = document.createElement("div");
    list.className = "budget-toolkit-totals-list";

    if (this.totals.length === 0) {
      const empty = document.createElement("p");
      empty.className = "budget-toolkit-empty";
      empty.textContent = "No custom totals yet.";
      list.append(empty);
      return list;
    }

    for (const { total, result } of this.totals) {
      const row = document.createElement("div");
      row.className = "budget-toolkit-total-row";

      const name = document.createElement("span");
      name.className = "budget-toolkit-total-name";
      name.textContent = total.name;

      const amounts = document.createElement("span");
      amounts.className = "budget-toolkit-total-amounts";
      amounts.textContent = `Budgeted ${result.budgeted.format()} · ${actualLabel(result)} ${result.actual.format()}`;
      if (result.missing.length > 0) {
        amounts.classList.add("budget-toolkit-has-missing");
        amounts.title = describeMissing(result);
      }

      row.append(name, amounts, this.editButton(total.id), this.deleteButton(total.id));
      list.append(row);
    }

    return list;
  }

  private editButton(id: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Edit";
    button.addEventListener("click", () => {
      this.editing = id;
      this.render();
    });
    return button;
  }

  private deleteButton(id: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Delete";
    button.addEventListener("click", () => {
      button.disabled = true;
      void this.actions.remove(id);
    });
    return button;
  }

  private renderAddButton(): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "budget-toolkit-add-total";
    button.textContent = "+ New Total";
    button.addEventListener("click", () => {
      this.editing = NEW_TOTAL;
      this.render();
    });
    return button;
  }

  private renderForm(): HTMLFormElement {
    const budget = this.budget;
    const existing =
      typeof this.editing === "string"
        ? (this.totals.find((view) => view.total.id === this.editing)?.total ?? null)
        : null;

    const form = document.createElement("form");
    form.className = "budget-toolkit-total-form";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Total name";
    nameInput.value = existing?.name ?? "";
    form.append(nameInput);

    const selected = new Set(
      (existing?.selections ?? []).map((selection) => selectionKey(selection)),
    );
    const checklist = buildChecklist(budget, selected);
    form.append(checklist);

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = existing ? "Save changes" : "Create total";
    form.append(submit);

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => {
      this.editing = null;
      this.render();
    });
    form.append(cancel);

    const error = document.createElement("p");
    error.className = "budget-toolkit-form-error";
    error.hidden = true;
    form.append(error);

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const draft: CustomTotalDraft = {
        name: nameInput.value.trim(),
        selections: readSelections(checklist),
      };

      // The old build silently did nothing here, which read as a broken button.
      if (draft.name === "") return fail(error, "Give the total a name.");
      if (draft.selections.length === 0) return fail(error, "Pick at least one category.");

      error.hidden = true;
      submit.disabled = true;
      this.editing = null;

      void (existing
        ? this.actions.update(existing.id, draft)
        : this.actions.create(draft));
    });

    return form;
  }
}

function fail(error: HTMLElement, message: string): void {
  error.textContent = message;
  error.hidden = false;
}

function buildChecklist(budget: Budget | null, selected: ReadonlySet<string>): HTMLElement {
  const checklist = document.createElement("div");
  checklist.className = "budget-toolkit-checklist";
  if (!budget) return checklist;

  for (const { groupLabel, itemLabels } of budget.categoryIndex()) {
    checklist.append(
      checkbox(
        { type: "group", groupLabel },
        `${groupLabel} (whole group)`,
        selected,
        false,
      ),
    );

    for (const itemLabel of itemLabels) {
      checklist.append(
        checkbox({ type: "item", groupLabel, itemLabel }, itemLabel, selected, true),
      );
    }
  }

  return checklist;
}

function checkbox(
  selection: CategorySelection,
  text: string,
  selected: ReadonlySet<string>,
  nested: boolean,
): HTMLLabelElement {
  const label = document.createElement("label");
  if (nested) label.className = "budget-toolkit-checklist-item";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = selected.has(selectionKey(selection));
  // Stashed as JSON so reading the form back needs no parallel bookkeeping.
  input.dataset["selection"] = JSON.stringify(selection);

  label.append(input, ` ${text}`);
  return label;
}

function readSelections(checklist: HTMLElement): CategorySelection[] {
  const checked = checklist.querySelectorAll<HTMLInputElement>(
    "input[type=checkbox]:checked",
  );
  return [...checked].flatMap((input) => {
    const raw = input.dataset["selection"];
    return raw ? [JSON.parse(raw) as CategorySelection] : [];
  });
}

function actualLabel(result: CustomTotalResult): string {
  if (result.kinds.length !== 1) return "Net";
  return result.kinds[0] === "income" ? "Received" : "Spent";
}

function describeMissing(result: CustomTotalResult): string {
  const count = result.missing.length;
  const noun = count === 1 ? "category" : "categories";
  return `${count} selected ${noun} not found in this month's budget`;
}
