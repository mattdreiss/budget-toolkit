/**
 * A signed amount of money, stored as integer cents.
 *
 * Cents are integers so that arithmetic here is exact — dollars as floats would
 * accumulate rounding error across a month of allocations. Sign is preserved
 * rather than normalised away: the direction of a movement is domain-meaningful
 * (a refund is a real thing that reduces spend), and collapsing it with
 * `Math.abs` is what made the two original spend calculations disagree.
 */
export class Money {
  private constructor(readonly cents: number) {}

  static fromCents(cents: number): Money {
    if (!Number.isInteger(cents)) {
      throw new RangeError(`Money requires integer cents, received ${cents}`);
    }
    return new Money(cents);
  }

  static zero(): Money {
    return new Money(0);
  }

  static sum(amounts: readonly Money[]): Money {
    return amounts.reduce<Money>((total, amount) => total.plus(amount), Money.zero());
  }

  plus(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  minus(other: Money): Money {
    return new Money(this.cents - other.cents);
  }

  negate(): Money {
    return new Money(-this.cents);
  }

  isZero(): boolean {
    return this.cents === 0;
  }

  isNegative(): boolean {
    return this.cents < 0;
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  toDollars(): number {
    return this.cents / 100;
  }

  format(): string {
    return this.toDollars().toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
  }
}
