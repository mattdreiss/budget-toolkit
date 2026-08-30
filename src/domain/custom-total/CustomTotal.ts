/**
 * A pointer at part of a budget, by name.
 *
 * Labels rather than ids, because EveryDollar re-mints every group/item id each
 * month and a custom total is meant to keep working as the budget rolls over.
 *
 * The three variants are all still live, and the shape is append-only on
 * purpose: `group` and `item` are what earlier versions wrote into
 * `chrome.storage.local`, so changing or dropping them would strand totals the
 * user already has. `itemByLabel` is what the section editor writes now — the
 * user types an item's name and nothing else, so there is no group to record,
 * and an item that moves between groups keeps resolving.
 */
export type CategorySelection =
  | { readonly type: "group"; readonly groupLabel: string }
  | { readonly type: "item"; readonly groupLabel: string; readonly itemLabel: string }
  | { readonly type: "itemByLabel"; readonly itemLabel: string };

export function selectionKey(selection: CategorySelection): string {
  switch (selection.type) {
    case "group":
      return `group::${selection.groupLabel}`;
    case "item":
      return `item::${selection.groupLabel}::${selection.itemLabel}`;
    case "itemByLabel":
      return `itemByLabel::${selection.itemLabel}`;
  }
}

export function describeSelection(selection: CategorySelection): string {
  switch (selection.type) {
    case "group":
      return `${selection.groupLabel} (whole group)`;
    case "item":
      return `${selection.groupLabel} › ${selection.itemLabel}`;
    case "itemByLabel":
      return selection.itemLabel;
  }
}

/** The item name a selection is about, or null for a whole-group selection. */
export function selectedItemLabel(selection: CategorySelection): string | null {
  return selection.type === "group" ? null : selection.itemLabel;
}

/** A user-defined roll-up of budget categories, e.g. "Needs". */
export class CustomTotal {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly selections: readonly CategorySelection[],
  ) {
    if (name.trim() === "") {
      throw new Error("A custom total needs a name");
    }
  }

  /**
   * A total with no categories is allowed, and is the normal starting state:
   * the three sections are seeded on first run so the user has something to
   * click, and they are empty until they fill them in. An earlier version threw
   * here, which is why the constraint is called out rather than just absent.
   */
  static create(
    name: string,
    selections: readonly CategorySelection[],
    newId: () => string = () => crypto.randomUUID(),
  ): CustomTotal {
    return new CustomTotal(newId(), name.trim(), dedupe(selections));
  }

  with(changes: { name?: string; selections?: readonly CategorySelection[] }): CustomTotal {
    return new CustomTotal(
      this.id,
      (changes.name ?? this.name).trim(),
      dedupe(changes.selections ?? this.selections),
    );
  }
}

function dedupe(selections: readonly CategorySelection[]): CategorySelection[] {
  const seen = new Map<string, CategorySelection>();
  for (const selection of selections) {
    seen.set(selectionKey(selection), selection);
  }
  return [...seen.values()];
}
