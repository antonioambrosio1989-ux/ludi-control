import { describe, it, expect } from "vitest";
import {
  nextWeeklyDeadline,
  reminderTimes,
  reminderStillValid,
} from "./operationsPolicy";
describe("operational reminders", () => {
  it("keeps the same Rome hour across the spring DST change", () => {
    const next = nextWeeklyDeadline(
      Date.parse("2026-03-22T09:00:00Z"),
      Date.parse("2026-03-23T00:00:00Z"),
    );
    expect(new Date(next).toISOString()).toBe("2026-03-29T08:00:00.000Z");
  });
  it("keeps the same Rome hour across the autumn DST change", () => {
    expect(
      new Date(
        nextWeeklyDeadline(
          Date.parse("2026-10-18T08:00:00Z"),
          Date.parse("2026-10-19T00:00:00Z"),
        ),
      ).toISOString(),
    ).toBe("2026-10-25T09:00:00.000Z");
  });
  it("skips missed weekly occurrences instead of creating many overdue copies", () => {
    expect(
      nextWeeklyDeadline(
        Date.parse("2026-09-01T10:00:00Z"),
        Date.parse("2026-10-02T12:00:00Z"),
      ),
    ).toBe(Date.parse("2026-10-06T10:00:00Z"));
  });
  it("does not notify an advance that was already in the past when a task was saved", () => {
    expect(reminderTimes(100000000, [0, 60, 60, 1440], 99900000)).toEqual([
      { offset: 0, sendAtMs: 100000000 },
    ]);
  });
  it("cancels stale reminders after completion, rescheduling or admin removal", () => {
    const reminder = { ownerId: "admin-a", taskRevision: 1 };
    expect(
      reminderStillValid(
        reminder,
        { ownerId: "admin-a", revision: 1, status: "open" },
        true,
      ),
    ).toBe(true);
    expect(
      reminderStillValid(
        reminder,
        { ownerId: "admin-a", revision: 2, status: "open" },
        true,
      ),
    ).toBe(false);
    expect(
      reminderStillValid(
        reminder,
        { ownerId: "admin-a", revision: 1, status: "done" },
        true,
      ),
    ).toBe(false);
    expect(
      reminderStillValid(
        reminder,
        { ownerId: "admin-b", revision: 1, status: "open" },
        true,
      ),
    ).toBe(false);
    expect(
      reminderStillValid(
        reminder,
        { ownerId: "admin-a", revision: 1, status: "open" },
        false,
      ),
    ).toBe(false);
  });
});
