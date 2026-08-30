import { describe, expect, it } from "vitest";
import { MonthKey } from "../../src/domain/shared/MonthKey.js";

describe("MonthKey", () => {
  it("parses the wire format's full date as well as a bare month", () => {
    expect(MonthKey.parse("2026-01-01").toString()).toBe("2026-01");
    expect(MonthKey.parse("2026-01").toString()).toBe("2026-01");
  });

  it("rejects values it cannot read a month from", () => {
    expect(() => MonthKey.parse("January 2026")).toThrow(RangeError);
    expect(() => MonthKey.fromParts(2026, 13)).toThrow(RangeError);
  });

  it("counts days per month, including leap years", () => {
    expect(MonthKey.parse("2026-01").daysInMonth).toBe(31);
    expect(MonthKey.parse("2026-04").daysInMonth).toBe(30);
    expect(MonthKey.parse("2026-02").daysInMonth).toBe(28);
    expect(MonthKey.parse("2024-02").daysInMonth).toBe(29);
    expect(MonthKey.parse("2000-02").daysInMonth).toBe(29);
    expect(MonthKey.parse("1900-02").daysInMonth).toBe(28);
  });

  it("enumerates every date in the month in order", () => {
    const dates = MonthKey.parse("2026-02").eachDate();
    expect(dates).toHaveLength(28);
    expect(dates[0]).toBe("2026-02-01");
    expect(dates.at(-1)).toBe("2026-02-28");
  });

  // Guards the reason this class avoids `Date` entirely: a UTC-parsed ISO
  // string read back in a negative-offset local timezone lands on the previous
  // day, which would shift spending onto the wrong date.
  it("does not shift dates across timezones", () => {
    expect(MonthKey.parse("2026-01-01").dateOfDay(1)).toBe("2026-01-01");
    expect(MonthKey.parse("2026-01-31").contains("2026-01-31")).toBe(true);
    expect(MonthKey.parse("2026-01").contains("2026-02-01")).toBe(false);
  });
});
