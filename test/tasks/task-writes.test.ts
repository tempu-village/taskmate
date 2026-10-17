import { describe, expect, it, vi } from "vitest";
import type { Task } from "../../src/tasks/domain";
import { failedTaskWrites } from "../../src/tasks/task-writes";

function task(id: string): Task {
  return {
    path: `TaskMate/Tasks/${id}.md`,
    id,
    title: id,
    completed: false,
    date: null,
    priority: null,
    labels: [],
    projectId: null,
    rank: 1024,
    createdAt: "2026-10-17T00:00:00.000Z",
    updatedAt: "2026-10-17T00:00:00.000Z",
    completedAt: null,
    sourceNote: null,
    steps: [],
    stepSectionRemainder: "",
    notes: ""
  };
}

describe("Task writes", () => {
  it("reports no failed Tasks after every write succeeds", async () => {
    expect(await failedTaskWrites([task("one"), task("two")], async () => undefined)).toEqual([]);
  });

  it("attempts every write and returns failed Tasks in input order", async () => {
    const write = vi.fn(async (item: Task) => {
      if (item.id !== "two") throw new Error("write failed");
    });

    const failed = await failedTaskWrites([task("one"), task("two"), task("three")], write);

    expect(write).toHaveBeenCalledTimes(3);
    expect(failed.map((item) => item.id)).toEqual(["one", "three"]);
  });
});
