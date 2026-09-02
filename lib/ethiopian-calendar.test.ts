import { describe, it, expect } from "vitest";
import { gregorianToEthiopian, ethiopianToGregorian, formatEthiopianDate } from "./ethiopian-calendar";

// Reference values cross-checked against the published "kenat" library
// (github: kenat) and, for the two 2007 dates, the well-documented
// Ethiopian Millennium (celebrated as Meskerem 1, 2000 E.C.).
describe("gregorianToEthiopian", () => {
  it("matches the well-known Ethiopian Millennium anchor", () => {
    // The Ethiopian Millennium (Meskerem 1, 2000 E.C.) fell on
    // September 12, 2007 — widely documented and celebrated as such.
    expect(gregorianToEthiopian({ year: 2007, month: 9, day: 12 })).toEqual({ year: 2000, month: 1, day: 1 });
    expect(gregorianToEthiopian({ year: 2007, month: 9, day: 11 })).toEqual({ year: 1999, month: 13, day: 6 });
  });

  it("matches reference conversions across a spread of dates, including a Gregorian leap day", () => {
    const cases: [[number, number, number], [number, number, number]][] = [
      [[2015, 9, 11], [2007, 13, 6]],
      [[2015, 9, 12], [2008, 1, 1]],
      [[2016, 9, 11], [2009, 1, 1]],
      [[2020, 1, 1], [2012, 4, 22]],
      [[2020, 2, 29], [2012, 6, 21]], // Gregorian leap day
      [[2024, 12, 31], [2017, 4, 22]],
      [[1990, 5, 15], [1982, 9, 7]],
    ];
    for (const [[gy, gm, gd], [ey, em, ed]] of cases) {
      expect(gregorianToEthiopian({ year: gy, month: gm, day: gd })).toEqual({ year: ey, month: em, day: ed });
    }
  });

  it("handles the 2100 non-leap century boundary correctly", () => {
    // 2100 is NOT a Gregorian leap year (divisible by 100, not by 400), so
    // February has only 28 days that year. This is exactly the kind of
    // edge case hand-rolled day-of-year arithmetic tends to get wrong.
    expect(gregorianToEthiopian({ year: 2100, month: 2, day: 28 })).toEqual({ year: 2092, month: 6, day: 20 });
    expect(gregorianToEthiopian({ year: 2100, month: 3, day: 1 })).toEqual({ year: 2092, month: 6, day: 21 });
  });
});

describe("ethiopianToGregorian", () => {
  it("is the exact inverse of gregorianToEthiopian across a wide range of dates", () => {
    const samples: [number, number, number][] = [
      [2007, 9, 10], [2007, 9, 11], [2007, 9, 12], [2007, 9, 13],
      [2015, 9, 11], [2015, 9, 12], [2016, 9, 11],
      [2020, 1, 1], [2020, 2, 29], [2024, 12, 31],
      [2026, 1, 5], [2026, 8, 31], [1990, 5, 15],
      [2100, 2, 28], [2100, 3, 1],
    ];
    for (const [year, month, day] of samples) {
      const ethiopian = gregorianToEthiopian({ year, month, day });
      const roundTripped = ethiopianToGregorian(ethiopian);
      expect(roundTripped, `round trip failed for ${year}-${month}-${day}`).toEqual({ year, month, day });
    }
  });

  it("correctly resolves the 2100 boundary in the Ethiopian-to-Gregorian direction too", () => {
    // This is the specific case where the reference library ("kenat") was
    // found to have an internal round-trip inconsistency at this exact
    // century boundary — this test pins down the correct behavior here.
    expect(ethiopianToGregorian({ year: 2092, month: 6, day: 20 })).toEqual({ year: 2100, month: 2, day: 28 });
    expect(ethiopianToGregorian({ year: 2092, month: 6, day: 21 })).toEqual({ year: 2100, month: 3, day: 1 });
  });
});

describe("formatEthiopianDate", () => {
  it("formats using the Ethiopian month name and 'E.C.' suffix", () => {
    expect(formatEthiopianDate({ year: 2007, month: 9, day: 12 })).toBe("1 Meskerem 2000 E.C.");
  });
});
