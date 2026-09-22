import { describe, expect, it } from "vitest";
import type { Project, Task } from "../src/domain";
import { buildTaskListModel } from "../src/task-list-model";

function task(overrides: Partial<Task> = {}): Task {
  return {
    path: "TaskMate/Tasks/one.md",
    id: "one",
    title: "One",
    completed: false,
    date: null,
    priority: null,
    labels: [],
    projectId: null,
    rank: 1024,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    completedAt: null,
    sourceNote: null,
    notes: "",
    ...overrides
  };
}

const project: Project = {
  path: "TaskMate/Projects/work.md",
  id: "work",
  name: "Work",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  lastUsedAt: null
};

describe("task-list presentation model", () => {
  it("builds sorted flat rows with display-only project and label metadata", () => {
    const model = buildTaskListModel({
      tasks: [
        task({ id: "later", rank: 20 }),
        task({ id: "first", rank: 10, projectId: "work", labels: ["a", "b", "c", "hidden"] })
      ],
      projects: [project],
      grouping: "flat",
      sortMode: "manual",
      sortDirection: "asc",
      allowReorder: true
    });

    expect(model.reorderEnabled).toBe(true);
    expect(model.grouping).toBe("flat");
    expect(model.sections).toEqual([{
      id: "default",
      rows: [
        expect.objectContaining({ id: "first", projectName: "Work", labels: ["a", "b", "c", "hidden"] }),
        expect.objectContaining({ id: "later", projectName: null })
      ]
    }]);
  });

  it("keeps scheduled sections fixed while reversing date order within each section", () => {
    const model = buildTaskListModel({
      tasks: [
        task({ id: "later-near", date: "2026-09-20" }),
        task({ id: "later-far", date: "2026-09-21" }),
        task({ id: "overdue-old", date: "2026-09-17" }),
        task({ id: "overdue-new", date: "2026-09-18" }),
        task({ id: "today", date: "2026-09-19" })
      ],
      projects: [],
      grouping: "scheduled",
      sortMode: "date",
      sortDirection: "desc",
      allowReorder: true,
      today: "2026-09-19"
    });

    expect(model.reorderEnabled).toBe(false);
    expect(model.grouping).toBe("scheduled");
    expect(model.sections.map((section) => [section.id, section.rows.map((row) => row.id)])).toEqual([
      ["overdue", ["overdue-new", "overdue-old"]],
      ["today", ["today"]],
      ["later", ["later-far", "later-near"]]
    ]);
  });

  it("marks selected rows and disables manual reordering in selection mode", () => {
    const model = buildTaskListModel({
      tasks: [task({ id: "selected" }), task({ id: "other" })],
      projects: [],
      grouping: "flat",
      sortMode: "manual",
      sortDirection: "asc",
      allowReorder: true,
      selectionMode: true,
      selectedIds: new Set(["selected"])
    });
    expect(model.reorderEnabled).toBe(false);
    expect(model.selectionMode).toBe(true);
    expect(model.sections[0].rows.map((row) => [row.id, row.selected])).toEqual([
      ["selected", true],
      ["other", false]
    ]);
  });
});
