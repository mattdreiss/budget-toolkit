import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomTotal } from "../../src/domain/custom-total/CustomTotal.js";
import { ChromeStorageCustomTotalRepository } from "../../src/infrastructure/storage/chromeStorageRepository.js";

/** Just enough of `chrome.storage.StorageArea` for the repository to run against. */
function fakeStorage(initial: Record<string, unknown> = {}) {
  let contents = { ...initial };
  return {
    area: {
      get: async (key: string) => ({ [key]: contents[key] }),
      set: async (values: Record<string, unknown>) => {
        contents = { ...contents, ...values };
      },
    } as unknown as chrome.storage.StorageArea,
    read: () => contents,
  };
}

describe("ChromeStorageCustomTotalRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("round-trips totals through storage", async () => {
    const { area } = fakeStorage();
    const repository = new ChromeStorageCustomTotalRepository(area);

    const original = new CustomTotal("abc", "Discretionary", [
      { type: "group", groupLabel: "Lifestyle" },
      { type: "item", groupLabel: "Food", itemLabel: "Restaurants" },
    ]);
    await repository.save([original]);

    const [restored] = await repository.list();
    expect(restored?.id).toBe("abc");
    expect(restored?.name).toBe("Discretionary");
    expect(restored?.selections).toEqual(original.selections);
  });

  it("persists the shape earlier plain-JS versions wrote, so saved totals survive", async () => {
    const { area, read } = fakeStorage();
    await new ChromeStorageCustomTotalRepository(area).save([
      new CustomTotal("abc", "Food", [{ type: "group", groupLabel: "Food" }]),
    ]);

    expect(read()["customTotals"]).toEqual([
      { id: "abc", name: "Food", selections: [{ type: "group", groupLabel: "Food" }] },
    ]);
  });

  it("returns nothing when storage is empty or holds the wrong type", async () => {
    await expect(
      new ChromeStorageCustomTotalRepository(fakeStorage().area).list(),
    ).resolves.toEqual([]);

    await expect(
      new ChromeStorageCustomTotalRepository(
        fakeStorage({ customTotals: "corrupted" }).area,
      ).list(),
    ).resolves.toEqual([]);
  });

  it("drops unusable records instead of failing the whole read", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { area } = fakeStorage({
      customTotals: [
        { id: "good", name: "Keep me", selections: [{ type: "group", groupLabel: "Food" }] },
        { id: "no-selections", name: "Broken", selections: [] },
        { id: "bad-selection", name: "Broken", selections: [{ type: "item", groupLabel: "Food" }] },
        { name: "missing id", selections: [{ type: "group", groupLabel: "Food" }] },
        null,
      ],
    });

    const totals = await new ChromeStorageCustomTotalRepository(area).list();
    expect(totals.map((total) => total.id)).toEqual(["good"]);
  });
});
