import { describe, expect, it } from "vitest";
import { nextRecurringDeadline } from "./operationsPolicy";

describe("ricorrenze calendario Europa/Rome", () => {
  it("mantiene le 09:00 anche oltre il cambio dell'ora legale", () => {
    expect(new Date(nextRecurringDeadline(Date.parse("2026-03-22T08:00:00Z"), Date.parse("2026-03-23T00:00:00Z"), "weekly")).toISOString())
      .toBe("2026-03-29T07:00:00.000Z");
  });
  it("ripristina il 31 dopo febbraio", () => {
    const origin = Date.parse("2027-01-31T08:00:00Z");
    const feb = nextRecurringDeadline(origin, origin, "monthly", origin);
    expect(new Date(feb).toISOString()).toBe("2027-02-28T08:00:00.000Z");
    expect(new Date(nextRecurringDeadline(feb, feb, "monthly", origin)).toISOString())
      .toBe("2027-03-31T07:00:00.000Z");
  });
  it("gestisce il 29 febbraio conservando l'anno bisestile come riferimento", () => {
    const origin = Date.parse("2024-02-29T08:00:00Z");
    let current = origin;
    for (let year = 2025; year <= 2028; year++) {
      current = nextRecurringDeadline(current, current, "yearly", origin);
      expect(new Date(current).toISOString()).toBe(
        year === 2028 ? "2028-02-29T08:00:00.000Z" : `${year}-02-28T08:00:00.000Z`,
      );
    }
  });
  it("salta scadenze già trascorse", () => {
    const origin = Date.parse("2026-01-15T08:00:00Z");
    expect(new Date(nextRecurringDeadline(origin, Date.parse("2026-05-22T12:00:00Z"), "monthly", origin)).toISOString())
      .toBe("2026-06-15T07:00:00.000Z");
  });
});
