import {
  selectedItemLabel,
  type CategorySelection,
} from "../domain/custom-total/CustomTotal.js";

export interface SectionEditorOptions {
  /** The section being edited, shown in the dialog's title. */
  readonly name: string;
  readonly selections: readonly CategorySelection[];
  /** Every item label in the month on screen: autocomplete, and the "unknown name" check. */
  readonly availableItemLabels: readonly string[];
  readonly onSave: (selections: CategorySelection[]) => void;
}

let open = false;

/**
 * The edit window for one section: one text row per budget item, a delete
 * button to the left of each, and a button that adds another empty row.
 *
 * Built on `<dialog>` + `showModal()` rather than a hand-rolled overlay because
 * this is injected into someone else's page. The top layer sits above every
 * stacking context EveryDollar could create, so there is no z-index to lose,
 * and focus trapping, inertness of the page behind, and Escape-to-close all
 * come from the platform instead of from code we would have to maintain.
 *
 * The dialog is appended to `<body>`, deliberately outside the panel: it must
 * not be inside the container React intermittently replaces (see
 * docs/panel-mounting.md), and it must not inherit the panel's card styling.
 */
export function openSectionEditor(options: SectionEditorOptions): void {
  // One at a time. Without this, a double-click on a section name stacks two
  // dialogs and the second Save silently overwrites the first.
  if (open) return;
  open = true;

  const dialog = document.createElement("dialog");
  dialog.id = "budget-toolkit-section-editor";
  dialog.addEventListener("close", () => {
    open = false;
    dialog.remove();
  });

  const known = new Map(
    options.availableItemLabels.map((label) => [label.toLowerCase(), label]),
  );

  const datalist = document.createElement("datalist");
  datalist.id = "budget-toolkit-item-names";
  for (const label of options.availableItemLabels) {
    const option = document.createElement("option");
    option.value = label;
    datalist.append(option);
  }

  const form = document.createElement("form");
  form.className = "budget-toolkit-editor-form";

  const rows = document.createElement("div");
  rows.className = "budget-toolkit-editor-rows";

  const empty = document.createElement("p");
  empty.className = "budget-toolkit-editor-empty";
  empty.textContent = "No budget items yet. Add one below.";

  const addRow = (value: string): HTMLInputElement => {
    empty.remove();
    const row = createRow(value, datalist.id, known, () => syncEmpty());
    rows.append(row.element);
    return row.input;
  };

  const syncEmpty = () => {
    if (rows.childElementCount === 0) rows.append(empty);
  };

  // Existing membership, as names. A whole-group selection saved by an older
  // version has no single name to show, so it is expanded into the item names
  // it currently covers — what the user sees is then exactly what Save writes.
  for (const selection of options.selections) {
    const label = selectedItemLabel(selection);
    if (label !== null) addRow(label);
  }
  syncEmpty();

  const add = document.createElement("button");
  add.type = "button";
  add.className = "budget-toolkit-editor-add";
  add.textContent = "+ Add item";
  // Focused straight away: the button's whole job is "let me type another name",
  // and a new empty box that needs a second click to use is just a chore.
  add.addEventListener("click", () => addRow("").focus());

  const actions = document.createElement("div");
  actions.className = "budget-toolkit-editor-actions";

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "budget-toolkit-editor-cancel";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => dialog.close());

  const save = document.createElement("button");
  save.type = "submit";
  save.className = "budget-toolkit-editor-save";
  save.textContent = "Save";

  actions.append(cancel, save);
  form.append(rows, add, actions);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    options.onSave(readSelections(rows, known));
    dialog.close();
  });

  dialog.append(createTitle(options.name), form, datalist);
  document.body.append(dialog);
  dialog.showModal();
}

function createTitle(name: string): HTMLElement {
  const title = document.createElement("h2");
  title.className = "budget-toolkit-editor-title";
  title.textContent = `Edit ${name}`;
  return title;
}

function createRow(
  value: string,
  datalistId: string,
  known: ReadonlyMap<string, string>,
  onRemove: () => void,
): { element: HTMLElement; input: HTMLInputElement } {
  const row = document.createElement("div");
  row.className = "budget-toolkit-editor-row";

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "budget-toolkit-editor-delete";
  remove.setAttribute("aria-label", "Remove this budget item");
  remove.title = "Remove this budget item";
  remove.append(trashIcon());
  remove.addEventListener("click", () => {
    row.remove();
    onRemove();
  });

  const input = document.createElement("input");
  input.type = "text";
  input.className = "budget-toolkit-editor-input";
  input.placeholder = "Budget item name";
  input.value = value;
  input.setAttribute("list", datalistId);
  input.autocomplete = "off";

  // Warn, but never block: a name that is absent this month may well be back
  // next month, and a saved section is meant to survive exactly that.
  const flag = () => {
    const typed = input.value.trim();
    input.classList.toggle(
      "budget-toolkit-editor-unknown",
      typed !== "" && !known.has(typed.toLowerCase()),
    );
  };
  input.addEventListener("input", flag);
  flag();

  row.append(remove, input);
  return { element: row, input };
}

/**
 * Reads the rows back as selections.
 *
 * Names are snapped to the budget's own capitalisation when they match
 * case-insensitively, so "groceries" typed by hand resolves to the "Groceries"
 * line rather than silently totalling nothing. A name that matches nothing is
 * kept verbatim — it is stored, flagged in the section row, and starts working
 * again the month the category reappears.
 */
function readSelections(
  rows: HTMLElement,
  known: ReadonlyMap<string, string>,
): CategorySelection[] {
  return [...rows.querySelectorAll<HTMLInputElement>("input")]
    .map((input) => input.value.trim())
    .filter((value) => value !== "")
    .map((value) => ({
      type: "itemByLabel" as const,
      itemLabel: known.get(value.toLowerCase()) ?? value,
    }));
}

function trashIcon(): SVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  for (const d of [
    "M3 6h18",
    "M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2",
    "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
    "M10 11v6",
    "M14 11v6",
  ]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.append(path);
  }

  return svg;
}
