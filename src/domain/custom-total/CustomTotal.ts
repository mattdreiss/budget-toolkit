/**
 * A pointer at part of a budget, by name.
 *
 * Labels rather than ids, because EveryDollar re-mints every group/item id each
 * month and a custom total is meant to keep working as the budget rolls over.
 * The shape is also what already lives in `chrome.storage.local`, so totals
 * saved by earlier versions keep resolving.
 */
export type CategorySelection =
  | { readonly type: "group"; readonly groupLabel: string }
  | { readonly type: "item"; readonly groupLabel: string; readonly itemLabel: string };

export function selectionKey(selection: CategorySelection): string {
  return selection.type === "group"
    ? `group::${selection.groupLabel}`
    : `item::${selection.groupLabel}::${selection.itemLabel}`;
}

export function describeSelection(selection: CategorySelection): string {
  return selection.type === "group"
    ? `${selection.groupLabel} (whole group)`
    : `${selection.groupLabel} › ${selection.itemLabel}`;
}

/** A user-defined roll-up of budget categories, e.g. "Discretionary". */
export class CustomTotal {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly selections: readonly CategorySelection[],
  ) {
    if (name.trim() === "") {
      throw new Error("A custom total needs a name");
    }
    if (selections.length === 0) {
      throw new Error(`Custom total ${JSON.stringify(name)} needs at least one category`);
    }
  }

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
