import { describe, expect, it, vi } from "vitest";
import type { BudgetSource, CustomTotalRepository } from "../../src/application/ports.js";
import {
  DEFAULT_SECTION_NAMES,
  ManageCustomTotals,
} from "../../src/application/manageCustomTotals.js";
import { WatchBudget, type BudgetSnapshot } from "../../src/application/watchBudget.js";
import type { Budget } from "../../src/domain/budget/Budget.js";
import { CustomTotal } from "../../src/domain/custom-total/CustomTotal.js";
import { toBudget } from "../../src/infrastructure/everydollar/budgetMapper.js";
import { allocation, budgetDetail, group, item } from "../support/budgetBuilder.js";

function inMemoryRepository(initial: CustomTotal[] = []): CustomTotalRepository {
  let totals = [...initial];
  return {
    list: async () => [...totals],
    save: async (next) => {
      totals = [...next];
    },
  };
}

function manualSource(): BudgetSource & { emit: (budget: Budget) => void } {
  const listeners = new Set<(budget: Budget) => void>();
  return {
    onBudget(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit(budget) {
      for (const listener of listeners) listener(budget);
    },
  };
}

const januaryBudget = () =>
  toBudget(
    budgetDetail("2026-01-01", [
      group("Food", [
        item("Groceries", {
          amountBudgeted: 50000,
          allocations: [allocation("2026-01-05", -10000)],
        }),
      ]),
    ]),
  );

/** Lets the repository's pending `list()` promise settle before asserting. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("WatchBudget", () => {
  it("emits nothing until a budget arrives", async () => {
    const onSnapshot = vi.fn();
    const source = manualSource();
    new WatchBudget(source, new ManageCustomTotals(inMemoryRepository()), onSnapshot).start();

    // Loading the saved totals resolves first; that alone must not paint a
    // panel, because there is no budget to compute against yet.
    await flush();
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  it("emits a snapshot with spend and totals once a budget arrives", async () => {
    const snapshots: BudgetSnapshot[] = [];
    const source = manualSource();
    const totals = new ManageCustomTotals(
      inMemoryRepository([
        new CustomTotal("t1", "Food", [{ type: "group", groupLabel: "Food" }]),
      ]),
    );

    new WatchBudget(source, totals, (snapshot) => snapshots.push(snapshot)).start();
    source.emit(januaryBudget());

    await vi.waitFor(() => {
      const latest = snapshots.at(-1);
      expect(latest?.spend.total().format()).toBe("$100.00");
      expect(latest?.totals[0]?.result.actual.format()).toBe("$100.00");
    });
  });

  /**
   * Editing a total must repaint immediately against the budget already on
   * screen, rather than waiting for EveryDollar to happen to refetch.
   */
  it("re-renders against the budget it already has when totals change", async () => {
    const snapshots: BudgetSnapshot[] = [];
    const source = manualSource();
    const repository = inMemoryRepository();
    const totals = new ManageCustomTotals(repository);

    const watch = new WatchBudget(source, totals, (snapshot) => snapshots.push(snapshot));
    watch.start();
    source.emit(januaryBudget());
    await vi.waitFor(() => expect(snapshots.length).toBeGreaterThan(0));

    const before = snapshots.length;
    watch.totalsChanged(
      await totals.create({
        name: "Groceries",
        selections: [{ type: "item", groupLabel: "Food", itemLabel: "Groceries" }],
      }),
    );

    expect(snapshots.length).toBeGreaterThan(before);
    // Alongside the three sections `start()` seeded, so this looks itself up by
    // name rather than assuming it is the only total in the snapshot.
    const groceries = snapshots
      .at(-1)
      ?.totals.find((view) => view.total.name === "Groceries");
    expect(groceries?.result.budgeted.format()).toBe("$500.00");
  });

  /** The panel must have the three sections to show on a profile that has never used it. */
  it("seeds the default sections on first run", async () => {
    const snapshots: BudgetSnapshot[] = [];
    const source = manualSource();
    const repository = inMemoryRepository();

    new WatchBudget(source, new ManageCustomTotals(repository), (snapshot) =>
      snapshots.push(snapshot),
    ).start();
    source.emit(januaryBudget());

    await vi.waitFor(() => {
      const names = snapshots.at(-1)?.totals.map((view) => view.total.name);
      expect(names).toEqual([...DEFAULT_SECTION_NAMES]);
    });
    // Seeded once and persisted, so a reload does not stack duplicates.
    expect((await repository.list()).map((total) => total.name)).toEqual([
      ...DEFAULT_SECTION_NAMES,
    ]);
  });

  it("stops emitting once detached", async () => {
    const onSnapshot = vi.fn();
    const source = manualSource();
    const stop = new WatchBudget(
      source,
      new ManageCustomTotals(inMemoryRepository()),
      onSnapshot,
    ).start();

    stop();
    source.emit(januaryBudget());
    await flush();
    expect(onSnapshot).not.toHaveBeenCalled();
  });
});

describe("ManageCustomTotals", () => {
  it("only seeds the default sections that are actually missing", async () => {
    const repository = inMemoryRepository([
      new CustomTotal("kept", "Needs", [{ type: "itemByLabel", itemLabel: "Rent" }]),
    ]);
    const totals = new ManageCustomTotals(repository);

    const first = await totals.listWithDefaults();
    expect(first.map((total) => total.name)).toEqual(["Needs", "Savings", "Wants"]);
    // The user's existing section is untouched, not replaced by an empty one.
    expect(first[0]?.id).toBe("kept");
    expect(first[0]?.selections).toHaveLength(1);

    // Idempotent: a second run adds nothing.
    const second = await totals.listWithDefaults();
    expect(second.map((total) => total.id)).toEqual(first.map((total) => total.id));
  });

  it("creates, updates and removes, persisting each change", async () => {
    const repository = inMemoryRepository();
    const totals = new ManageCustomTotals(repository);

    const created = await totals.create({
      name: "Discretionary",
      selections: [{ type: "group", groupLabel: "Lifestyle" }],
    });
    expect(created).toHaveLength(1);

    const id = created[0]!.id;
    const updated = await totals.update(id, {
      name: "Fun money",
      selections: [{ type: "group", groupLabel: "Food" }],
    });
    expect(updated[0]?.name).toBe("Fun money");
    expect(updated[0]?.id).toBe(id);
    // The change reached storage, not just the returned array.
    expect((await repository.list())[0]?.name).toBe("Fun money");

    expect(await totals.remove(id)).toHaveLength(0);
    expect(await repository.list()).toHaveLength(0);
  });
});
