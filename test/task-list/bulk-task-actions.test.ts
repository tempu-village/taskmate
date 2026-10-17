import { describe, expect, it, vi } from "vitest";
import { applyBulkTaskChanges, buildBulkTaskPatch } from "../../src/task-list/bulk-task-actions";
import type { Project } from "../../src/tasks/domain";
import type { Task } from "../../src/tasks/domain";

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

  it("adds a partially assigned Label only to selected tasks that do not already have it", () => {
    const changes = { addLabels: ["partial"], removeLabels: [] };
    expect(buildBulkTaskPatch(task("with", { labels: ["partial"] }), changes)).toEqual({ labels: ["partial"] });
    expect(buildBulkTaskPatch(task("without", { labels: [] }), changes)).toEqual({ labels: ["partial"] });
  });

  it("writes each Task's patch and returns the Tasks whose write failed", async () => {
    const tasks = [task("one"), task("two"), task("three")];
    const update = vi.fn(async (item: Task, _patch: Partial<Task>) => {
      if (item.id === "two") throw new Error("write failed");
      return item;
    });
    const projects = { list: vi.fn(async (): Promise<Project[]> => []), touch: vi.fn() };

    const failed = await applyBulkTaskChanges({ tasks: { update }, projects }, tasks, { priority: 2, addLabels: [], removeLabels: [] });

    expect(update).toHaveBeenCalledTimes(3);
    expect(update.mock.calls[0][1]).toEqual({ priority: 2, labels: ["existing", "remove"] });
    expect(failed.map((item) => item.id)).toEqual(["two"]);
    expect(projects.touch).not.toHaveBeenCalled();
  });

  it("touches an assigned Project even when some writes fail", async () => {
    const project: Project = { path: "TaskMate/Projects/new.md", id: "project-new", name: "New", createdAt: "2026-10-17T00:00:00.000Z", updatedAt: "2026-10-17T00:00:00.000Z", lastUsedAt: null };
    const update = vi.fn(async () => { throw new Error("write failed"); });
    const projects = { list: vi.fn(async () => [project]), touch: vi.fn(async () => project) };

    const failed = await applyBulkTaskChanges({ tasks: { update }, projects }, [task("one")], { projectId: "project-new", addLabels: [], removeLabels: [] });

    expect(failed.map((item) => item.id)).toEqual(["one"]);
    expect(projects.touch).toHaveBeenCalledWith(project);
  });

  it("does not look up a Project when the change clears or keeps it", async () => {
    const update = vi.fn(async (item: Task, _patch: Partial<Task>) => item);
    const projects = { list: vi.fn(async (): Promise<Project[]> => []), touch: vi.fn() };

    await applyBulkTaskChanges({ tasks: { update }, projects }, [task("one")], { projectId: null, addLabels: [], removeLabels: [] });
    await applyBulkTaskChanges({ tasks: { update }, projects }, [task("one")], { addLabels: [], removeLabels: [] });

    expect(projects.list).not.toHaveBeenCalled();
  });
});
