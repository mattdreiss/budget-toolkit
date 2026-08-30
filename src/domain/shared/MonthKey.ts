/** An ISO calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;

const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-\d{2}$/;

/**
 * The month a budget covers, e.g. `2026-01`.
 *
 * All arithmetic here is on the string parts rather than `Date`. A `Date` built
 * from an ISO string is parsed as UTC but read back in local time, so for
 * anyone west of Greenwich `new Date("2026-01-01").getDate()` is 31 December —
 * which would silently drop or misplace a day's spending on the graph.
 */
export class MonthKey {
  private constructor(
    readonly year: number,
    readonly month: number,
  ) {}

  static fromParts(year: number, month: number): MonthKey {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new RangeError(`Month must be 1-12, received ${month}`);
    }
    return new MonthKey(year, month);
  }

  /** Accepts either `YYYY-MM` or a full `YYYY-MM-DD` (the wire format's `date`). */
  static parse(value: string): MonthKey {
    const match = MONTH_KEY_PATTERN.exec(value) ?? ISO_DATE_PATTERN.exec(value);
    if (!match?.[1] || !match[2]) {
      throw new RangeError(`Cannot read a month from ${JSON.stringify(value)}`);
    }
    return MonthKey.fromParts(Number(match[1]), Number(match[2]));
  }

  /** Whether an ISO date falls inside this month. */
  contains(date: IsoDate): boolean {
    const match = ISO_DATE_PATTERN.exec(date);
    return (
      match?.[1] !== undefined &&
      Number(match[1]) === this.year &&
      Number(match[2]) === this.month
    );
  }

  get daysInMonth(): number {
    if (this.month === 2) {
      const leap =
        (this.year % 4 === 0 && this.year % 100 !== 0) || this.year % 400 === 0;
      return leap ? 29 : 28;
    }
    return [4, 6, 9, 11].includes(this.month) ? 30 : 31;
  }

  /** Every date in the month, in order, as `YYYY-MM-DD`. */
  eachDate(): IsoDate[] {
    return Array.from({ length: this.daysInMonth }, (_, index) =>
      this.dateOfDay(index + 1),
    );
  }

  dateOfDay(day: number): IsoDate {
    return `${this.toString()}-${String(day).padStart(2, "0")}`;
  }

  toString(): string {
    return `${String(this.year).padStart(4, "0")}-${String(this.month).padStart(2, "0")}`;
  }
}
