import { describe, expect, it } from "vitest";
import { filterTasks } from "../src/domain";
import type { Task } from "../src/domain";
import { TaskFilterState } from "../src/task-filter-state";

function task(id: string, overrides: Partial<Task> = {}): Task {
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

describe("shared task filter state", () => {
  it("persists the same criteria across date, search, and project task sets", () => {
    const state = new TaskFilterState();
    state.replace({ priorities: [1], labels: ["work"], search: "ignored", includeCompleted: false });
    const matching = task("matching", { date: "2026-09-20", priority: 1, labels: ["work"], projectId: "p1" });
    const other = task("other", { date: "2026-09-20", priority: 2, labels: ["work"], projectId: "p1" });

    expect(filterTasks([matching, other], "scheduled", state.value()).map((item) => item.id)).toEqual(["matching"]);
    expect(filterTasks([matching, other], "all", state.value()).map((item) => item.id)).toEqual(["matching"]);
    expect(filterTasks([matching, other].filter((item) => item.projectId === "p1"), "all", state.value()).map((item) => item.id)).toEqual(["matching"]);
    expect(state.count()).toBe(2);
  });

  it("clears every criterion without retaining mutable arrays", () => {
    const state = new TaskFilterState();
    const priorities: Array<1 | 2 | 3> = [1];
    state.replace({ priorities, labels: ["work"], search: "", includeCompleted: true });
    priorities.push(2);
    state.clear();

    expect(state.value()).toEqual({ priorities: [], labels: [], search: "", includeCompleted: false });
    expect(state.count()).toBe(0);
  });
});
