import { describe, expect, it } from "vitest";
import { Money } from "../../src/domain/shared/Money.js";

describe("Money", () => {
  it("adds, subtracts and negates without losing precision", () => {
    const total = Money.sum([
      Money.fromCents(1999),
      Money.fromCents(-500),
      Money.fromCents(1),
    ]);
    expect(total.cents).toBe(1500);
    expect(total.negate().cents).toBe(-1500);
    expect(total.minus(Money.fromCents(1500)).isZero()).toBe(true);
  });

  it("sums an empty list to zero", () => {
    expect(Money.sum([]).isZero()).toBe(true);
  });

  it("refuses fractional cents rather than silently rounding money", () => {
    expect(() => Money.fromCents(10.5)).toThrow(RangeError);
  });

  it("formats as US currency, including negatives", () => {
    expect(Money.fromCents(172400).format()).toBe("$1,724.00");
    expect(Money.fromCents(-227600).format()).toBe("-$2,276.00");
    expect(Money.zero().format()).toBe("$0.00");
  });
});
