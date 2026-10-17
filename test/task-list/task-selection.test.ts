import { describe, expect, it } from "vitest";
import type { Task } from "../../src/tasks/domain";
import { TaskSelection } from "../../src/task-list/task-selection";

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

function ids(selection: TaskSelection): string[] {
  return [...selection.selectedIds()].sort();
}

describe("task selection", () => {
  it("starts inactive and empty", () => {
    const selection = new TaskSelection();

    expect(selection.isActive()).toBe(false);
    expect(selection.selectedCount()).toBe(0);
    expect(selection.scopeSize()).toBe(0);
  });

  it("starts with the visible scope and nothing selected", () => {
    const selection = new TaskSelection();
    selection.start(["a"]);
    selection.toggle("a");

    selection.start(["a", "b", "c"]);

    expect(selection.isActive()).toBe(true);
    expect(selection.scopeSize()).toBe(3);
    expect(ids(selection)).toEqual([]);
  });

  it("toggles one Task on and off", () => {
    const selection = new TaskSelection();
    selection.start(["a", "b"]);

    selection.toggle("a");
    expect(ids(selection)).toEqual(["a"]);
    selection.toggle("a");
    expect(ids(selection)).toEqual([]);
  });

  it("selects the whole scope, then clears it when everything is already selected", () => {
    const selection = new TaskSelection();
    selection.start(["a", "b", "c"]);
    selection.toggle("a");

    selection.toggleAll();
    expect(ids(selection)).toEqual(["a", "b", "c"]);
    selection.toggleAll();
    expect(ids(selection)).toEqual([]);
  });

  it("drops Tasks that no longer exist and selections outside the scope", () => {
    const selection = new TaskSelection();
    selection.start(["a", "b", "c"]);
    selection.toggle("a");
    selection.toggle("c");
    selection.toggle("outside");

    selection.retainExisting(["a", "b", "outside"]);

    expect(selection.scopeSize()).toBe(2);
    expect(ids(selection)).toEqual(["a"]);
  });

  it("keeps only failed Tasks selected and in scope after a partial failure", () => {
    const selection = new TaskSelection();
    selection.start(["a", "b", "c"]);
    selection.toggleAll();

    selection.restrictTo(["b"]);

    expect(selection.isActive()).toBe(true);
    expect(selection.scopeSize()).toBe(1);
    expect(ids(selection)).toEqual(["b"]);
  });

  it("returns selected Tasks in their original order", () => {
    const selection = new TaskSelection();
    selection.start(["a", "b", "c"]);
    selection.toggle("c");
    selection.toggle("a");

    expect(selection.selectedTasks([task("a"), task("b"), task("c")]).map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("clears scope and selection on exit", () => {
    const selection = new TaskSelection();
    selection.start(["a", "b"]);
    selection.toggleAll();

    selection.exit();

    expect(selection.isActive()).toBe(false);
    expect(selection.scopeSize()).toBe(0);
    expect(selection.selectedCount()).toBe(0);
  });
});
