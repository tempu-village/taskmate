import { describe, expect, it } from "vitest";
import { buildBulkTaskPatch, failedBulkTasks } from "../src/bulk-task-actions";
import type { Task } from "../src/domain";

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    path: `TaskMate/Tasks/${id}.md`,
    id,
    title: id,
    completed: false,
    date: "2026-09-19",
    priority: 1,
    labels: ["existing", "remove"],
    projectId: "project-old",
    rank: 1024,
    createdAt: "2026-09-19T00:00:00.000Z",
    updatedAt: "2026-09-19T00:00:00.000Z",
    completedAt: null,
    sourceNote: null,
    steps: [],
    stepSectionRemainder: "",
    notes: "",
    ...overrides
  };
}

describe("bulk task actions", () => {
  it("preserves omitted fields while clearing, replacing, adding, and removing explicit values", () => {
    expect(buildBulkTaskPatch(task("one"), {
      projectId: null,
      priority: 3,
      addLabels: ["added"],
      removeLabels: ["remove"]
    })).toEqual({
      projectId: null,
      priority: 3,
      labels: ["existing", "added"]
    });
  });

  it("reports no failed tasks after a fully successful bulk action", () => {
    const tasks = [task("one"), task("two")];
    expect(failedBulkTasks(tasks, [
      { status: "fulfilled", value: undefined },
      { status: "fulfilled", value: undefined }
    ])).toEqual([]);
  });

  it("retains only failed tasks after a partially successful update or deletion", () => {
    const tasks = [task("one"), task("two"), task("three")];
    expect(failedBulkTasks(tasks, [
      { status: "fulfilled", value: undefined },
      { status: "rejected", reason: new Error("write failed") },
      { status: "fulfilled", value: undefined }
    ]).map((item) => item.id)).toEqual(["two"]);
  });
});
