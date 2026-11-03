import { describe, expect, it } from "vitest";
import type { Task } from "../../src/tasks/domain";
import { evaluateReminders } from "../../src/tasks/reminders";

function task(overrides: Partial<Task> = {}): Task {
  return {
    path: "TaskMate/Tasks/One.md", id: "one", title: "One", completed: false,
    date: "2026-10-14", deadline: null, time: "09:00", repeat: null, reminder: 0,
    priority: null, labels: [], projectId: null, rank: 1024,
    createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
    completedAt: null, sourceNote: null, steps: [], stepSectionRemainder: "", notes: "",
    ...overrides
  };
}

const at = (time: string) => new Date(`2026-10-14T${time}`);

describe("reminder evaluation", () => {
  it("does nothing before the reminder moment", () => {
    const result = evaluateReminders([task()], {}, at("08:59:59"));
    expect(result.due).toEqual([]);
    expect(result.delivered).toEqual({});
  });

  it("delivers a due reminder once on this device", () => {
    const first = evaluateReminders([task()], {}, at("09:00:30"));
    expect(first.due.map((item) => item.key)).toEqual(["one|2026-10-14T09:00|0"]);
    const second = evaluateReminders([task()], first.delivered, at("09:01:00"));
    expect(second.due).toEqual([]);
    expect(second.missed).toEqual([]);
  });

  it("reports reminders that came due while TaskMate was not running as missed", () => {
    const result = evaluateReminders([task(), task({ id: "two", time: "10:00", reminder: 30 })], {}, at("12:00:00"));
    expect(result.due).toEqual([]);
    expect(result.missed.map((item) => item.task.id)).toEqual(["one", "two"]);
  });

  it("skips completed Tasks, Tasks without a time, and reminders that had passed before the last save", () => {
    const result = evaluateReminders([
      task({ completed: true }),
      task({ id: "untimed", time: null }),
      task({ id: "late-edit", updatedAt: at("09:30:00").toISOString() })
    ], {}, at("10:00:00"));
    expect(result.due).toEqual([]);
    expect(result.missed).toEqual([]);
    expect(Object.keys(result.delivered)).toEqual(["late-edit|2026-10-14T09:00|0"]);
  });

  it("delivers again for a new occurrence or a changed reminder", () => {
    const first = evaluateReminders([task()], {}, at("09:00:10"));
    const moved = evaluateReminders([task({ time: "09:05" })], first.delivered, at("09:05:10"));
    expect(moved.due).toHaveLength(1);
  });

  it("forgets delivered keys after the retention period", () => {
    const result = evaluateReminders([], { "old|2026-08-01T09:00|0": new Date("2026-08-01T09:00:00").getTime() }, at("09:00:00"));
    expect(result.delivered).toEqual({});
  });
});
