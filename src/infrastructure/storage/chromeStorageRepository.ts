import type { CustomTotalRepository } from "../../application/ports.js";
import {
  CustomTotal,
  type CategorySelection,
} from "../../domain/custom-total/CustomTotal.js";

const STORAGE_KEY = "customTotals";

/** The persisted shape. Matches what pre-TypeScript versions wrote, so saved totals survive. */
interface StoredCustomTotal {
  id: string;
  name: string;
  selections: CategorySelection[];
}

/**
 * Custom totals in `chrome.storage.local`.
 *
 * Storage holds plain JSON, so domain objects are serialised on the way out and
 * rebuilt on the way in — the aggregate's invariants are re-checked at that
 * boundary rather than assumed. Records that no longer satisfy them are dropped
 * with a warning instead of failing the whole read, so one bad entry cannot
 * lock the user out of the rest of their totals.
 */
export class ChromeStorageCustomTotalRepository implements CustomTotalRepository {
  constructor(private readonly storage: chrome.storage.StorageArea = chrome.storage.local) {}

  async list(): Promise<CustomTotal[]> {
    const stored = await this.storage.get(STORAGE_KEY);
    const raw: unknown = stored[STORAGE_KEY];
    if (!Array.isArray(raw)) return [];

    const totals: CustomTotal[] = [];
    for (const record of raw) {
      const total = deserialize(record);
      if (total) totals.push(total);
    }
    return totals;
  }

  async save(totals: readonly CustomTotal[]): Promise<void> {
    await this.storage.set({ [STORAGE_KEY]: totals.map(serialize) });
  }
}

function serialize(total: CustomTotal): StoredCustomTotal {
  return {
    id: total.id,
    name: total.name,
    selections: [...total.selections],
  };
}

function deserialize(record: unknown): CustomTotal | null {
  if (typeof record !== "object" || record === null) return null;
  const { id, name, selections } = record as Partial<StoredCustomTotal>;

  if (typeof id !== "string" || typeof name !== "string" || !Array.isArray(selections)) {
    return null;
  }

  const valid = selections.filter(isSelection);
  try {
    return new CustomTotal(id, name, valid);
  } catch (error) {
    console.warn(`[budget-toolkit] dropping unusable saved total ${id}:`, error);
    return null;
  }
}

function isSelection(value: unknown): value is CategorySelection {
  if (typeof value !== "object" || value === null) return false;
  const selection = value as Partial<CategorySelection>;
  if (typeof selection.groupLabel !== "string") return false;

  return selection.type === "group"
    ? true
    : selection.type === "item" &&
        typeof (selection as { itemLabel?: unknown }).itemLabel === "string";
}
