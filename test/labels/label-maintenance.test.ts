import { describe, expect, it, vi } from "vitest";
import type { Task } from "../../src/tasks/domain";
import { removeLabelAcrossTasks, renameLabelAcrossTasks } from "../../src/labels/label-maintenance";

function task(id: string, labels: string[]): Task {
  return {
    path: `TaskMate/Tasks/${id}.md`,
    id,
    title: id,
    completed: false,
    date: null,
    priority: null,
    labels,
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

const preferences = { recentLabels: ["old", "home"], favoriteLabels: ["old"] };

describe("Label maintenance", () => {
  it("renames the Label on affected Tasks only and in preferences, merging duplicates", async () => {
    const update = vi.fn(async (item: Task, _patch: Partial<Task>) => item);
    const tasks = [task("one", ["old", "new"]), task("two", ["home"]), task("three", ["old"])];

    const result = await renameLabelAcrossTasks({ update }, tasks, preferences, "old", "new");

    expect(update.mock.calls.map(([item, patch]) => [item.id, patch])).toEqual([
      ["one", { labels: ["new"] }],
      ["three", { labels: ["new"] }]
    ]);
    expect(result).toEqual({
      kind: "applied",
      affected: 2,
      preferences: { recentLabels: ["new", "home"], favoriteLabels: ["new"] }
    });
  });

  it("removes the Label from affected Tasks and preferences", async () => {
    const update = vi.fn(async (item: Task, _patch: Partial<Task>) => item);

    const result = await removeLabelAcrossTasks({ update }, [task("one", ["old", "home"]), task("two", ["home"])], preferences, "old");

    expect(update.mock.calls.map(([item, patch]) => [item.id, patch])).toEqual([["one", { labels: ["home"] }]]);
    expect(result).toEqual({ kind: "applied", affected: 1, preferences: { recentLabels: ["home"], favoriteLabels: [] } });
  });

  it("still updates preferences when no Task carries the Label", async () => {
    const update = vi.fn(async (item: Task, _patch: Partial<Task>) => item);

    const result = await removeLabelAcrossTasks({ update }, [task("one", ["home"])], preferences, "old");

    expect(update).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: "applied", affected: 0, preferences: { recentLabels: ["home"], favoriteLabels: [] } });
  });

  it("reports failed Tasks and leaves preferences to the caller when a write fails", async () => {
    const update = vi.fn(async (item: Task, _patch: Partial<Task>) => {
      if (item.id === "three") throw new Error("write failed");
      return item;
    });

    const result = await renameLabelAcrossTasks({ update }, [task("one", ["old"]), task("three", ["old"])], preferences, "old", "new");

    expect(result.kind).toBe("partial-failure");
    if (result.kind !== "partial-failure") return;
    expect(result.affected).toBe(2);
    expect(result.failed.map((item) => item.id)).toEqual(["three"]);
  });
});
