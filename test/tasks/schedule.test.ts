import { afterEach, describe, expect, it } from "vitest";
import type { Task } from "../../src/tasks/domain";
import { sortTasks } from "../../src/tasks/domain";
import { encodeTask, encodeTaskPreservingProperties, parseTaskMarkdown } from "../../src/tasks/markdown";
import { addRepeat, formatRepeat, nextOccurrence, parseReminder, parseRepeat, parseTime, reminderInstant, reminderKey } from "../../src/tasks/schedule";

function task(overrides: Partial<Task> = {}): Task {
  return {
    path: "TaskMate/Tasks/One.md",
    id: "one",
    title: "One",
    completed: false,
    date: null,
    deadline: null,
    time: null,
    repeat: null,
    reminder: null,
    priority: 2,
    labels: ["home"],
    projectId: "project",
    rank: 2048,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    completedAt: null,
    sourceNote: "Notes/source.md",
    steps: [{ text: "Step", completed: true, date: null }],
    stepSectionRemainder: "",
    notes: "Keep these notes",
    ...overrides
  };
}

const originalTimeZone = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTimeZone;
});

describe("schedule values", () => {
  it("accepts only valid local times, bounded repeats and listed reminder offsets", () => {
    expect(parseTime("09:30")).toBe("09:30");
    for (const invalid of ["9:30", "24:00", "12:60", 930, null]) expect(parseTime(invalid)).toBeNull();
    expect(parseRepeat("weekly")).toEqual({ interval: 1, unit: "week" });
    expect(parseRepeat("every 3 days")).toEqual({ interval: 3, unit: "day" });
    expect(parseRepeat("every 1 month")).toEqual({ interval: 1, unit: "month" });
    for (const invalid of ["every 0 days", "every 100 days", "every weekday", "hourly", 7]) expect(parseRepeat(invalid)).toBeNull();
    expect(formatRepeat({ interval: 1, unit: "year" })).toBe("yearly");
    expect(formatRepeat({ interval: 2, unit: "week" })).toBe("every 2 weeks");
    expect(parseReminder(15)).toBe(15);
    expect(parseReminder(10)).toBeNull();
    expect(parseReminder("15")).toBeNull();
  });

  it("adds calendar intervals and clamps month ends", () => {
    expect(addRepeat("2026-10-30", { interval: 3, unit: "day" })).toBe("2026-11-02");
    expect(addRepeat("2026-12-29", { interval: 1, unit: "week" })).toBe("2027-01-05");
    expect(addRepeat("2026-01-31", { interval: 1, unit: "month" })).toBe("2026-02-28");
    expect(addRepeat("2027-11-30", { interval: 3, unit: "month" })).toBe("2028-02-29");
    expect(addRepeat("2028-02-29", { interval: 1, unit: "year" })).toBe("2029-02-28");
  });

  it("keeps calendar days across a daylight-saving change", () => {
    process.env.TZ = "America/New_York";
    expect(addRepeat("2026-11-01", { interval: 1, unit: "day" })).toBe("2026-11-02");
    expect(addRepeat("2026-03-07", { interval: 1, unit: "day" })).toBe("2026-03-08");
    const before = reminderInstant(task({ date: "2026-10-31", time: "09:00", reminder: 0 }))!;
    const after = reminderInstant(task({ date: "2026-11-01", time: "09:00", reminder: 0 }))!;
    expect(after.getTime() - before.getTime()).toBe(25 * 3_600_000);
    expect(after.getHours()).toBe(9);
  });

  it("fires a reminder at a skipped local time at the next valid instant", () => {
    process.env.TZ = "America/New_York";
    const skipped = reminderInstant(task({ date: "2026-03-08", time: "02:30", reminder: 0 }))!;
    expect(skipped.getHours()).toBe(3);
    expect(skipped.getMinutes()).toBe(30);
  });

  it("computes a reminder only for a dated, timed Task with an offset", () => {
    expect(reminderInstant(task({ date: "2026-10-14", time: "09:00" }))).toBeNull();
    expect(reminderInstant(task({ time: "09:00", reminder: 0 }))).toBeNull();
    const instant = reminderInstant(task({ date: "2026-10-14", time: "09:00", reminder: 1440 }))!;
    expect(instant.getDate()).toBe(13);
    expect(reminderKey(task({ date: "2026-10-14", time: "09:00", reminder: 15 }))).toBe("one|2026-10-14T09:00|15");
  });
});

describe("recurring completion", () => {
  it("advances the date, shifts the deadline and reopens Steps while keeping the rest", () => {
    const current = task({ date: "2026-10-14", deadline: "2026-10-16", repeat: { interval: 1, unit: "week" } });
    expect(nextOccurrence(current)).toEqual({
      date: "2026-10-21",
      deadline: "2026-10-23",
      steps: [{ text: "Step", completed: false, date: null }]
    });
  });

  it("does not recur without a repeat rule or a date", () => {
    expect(nextOccurrence(task({ date: "2026-10-14" }))).toBeNull();
    expect(nextOccurrence(task({ repeat: { interval: 1, unit: "day" } }))).toBeNull();
  });
});

describe("schedule Markdown", () => {
  it("writes no schedule lines for a date-only Task", () => {
    const encoded = encodeTask(task({ date: "2026-10-14" }));
    expect(encoded).not.toMatch(/^(time|repeat|reminder):/m);
  });

  it("round trips time, repeat and reminder", () => {
    const original = task({ date: "2026-10-14", time: "07:45", repeat: { interval: 2, unit: "month" }, reminder: 30 });
    const encoded = encodeTask(original);
    expect(encoded).toContain('time: "07:45"\nrepeat: "every 2 months"\nreminder: 30');
    expect(parseTaskMarkdown(original.path, encoded)).toEqual(original);
  });

  it("removes a cleared value and keeps an unreadable value as written", () => {
    const content = encodeTask(task({ date: "2026-10-14", time: "07:45" })).replace('time: "07:45"', 'time: "07:45"\nrepeat: "every weekday"\nreminder: 10');
    const parsed = parseTaskMarkdown("TaskMate/Tasks/One.md", content)!;
    expect(parsed).toMatchObject({ time: "07:45", repeat: null, reminder: null });
    const written = encodeTaskPreservingProperties({ ...parsed, time: null }, content);
    expect(written).not.toContain("time:");
    expect(written).toContain('repeat: "every weekday"');
    expect(written).toContain("reminder: 10");
  });
});

describe("time ordering", () => {
  it("puts untimed Tasks first within a date, then timed Tasks by time, without changing rank", () => {
    const tasks = [
      task({ id: "late", date: "2026-10-14", time: "18:00", rank: 1 }),
      task({ id: "untimed", date: "2026-10-14", rank: 3 }),
      task({ id: "early", date: "2026-10-14", time: "08:00", rank: 2 }),
      task({ id: "next-day", date: "2026-10-15", time: "07:00", rank: 4 })
    ];
    expect(sortTasks(tasks, "date").map((item) => item.id)).toEqual(["untimed", "early", "late", "next-day"]);
    expect(sortTasks(tasks, "date", "desc").map((item) => item.id)).toEqual(["next-day", "late", "early", "untimed"]);
    expect(tasks.map((item) => item.rank)).toEqual([1, 3, 2, 4]);
  });
});
