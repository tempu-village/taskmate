import { describe, expect, it } from "vitest";
import type { Task, TaskDraft } from "../src/domain";
import { applyTaskConflictChoices, compareTaskEdit } from "../src/task-edit-merge";

function task(overrides: Partial<Task> = {}): Task {
  return {
    path: "TaskMate/Tasks/one.md",
    id: "one",
    title: "One",
    completed: false,
    date: null,
    priority: null,
    labels: ["work"],
    projectId: null,
    rank: 1024,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    completedAt: null,
    sourceNote: null,
    steps: [],
    stepSectionRemainder: "",
    notes: "Original notes",
    ...overrides
  };
}

function draft(base: Task, overrides: Partial<TaskDraft> = {}): TaskDraft {
  return {
    title: base.title,
    date: base.date,
    priority: base.priority,
    labels: [...base.labels],
    projectId: base.projectId,
    steps: base.steps.map((step) => ({ ...step })),
    notes: base.notes,
    sourceNote: base.sourceNote,
    ...overrides
  };
}

describe("task edit three-way comparison", () => {
  it("merges disjoint draft and external changes", () => {
    const base = task();
    const result = compareTaskEdit(
      base,
      draft(base, { date: "2026-09-22" }),
      task({ notes: "Changed externally" })
    );

    expect(result.conflicts).toEqual([]);
    expect(result.merged.date).toBe("2026-09-22");
    expect(result.merged.notes).toBe("Changed externally");
    expect(result.externalChangesPreserved).toBe(true);
  });

  it("accepts the same result from both sides without a conflict", () => {
    const base = task();
    const result = compareTaskEdit(
      base,
      draft(base, { priority: 1 }),
      task({ priority: 1 })
    );

    expect(result.conflicts).toEqual([]);
    expect(result.merged.priority).toBe(1);
  });

  it("treats an entire multi-value field as one conflict", () => {
    const base = task();
    const result = compareTaskEdit(
      base,
      draft(base, { labels: ["work", "mine"] }),
      task({ labels: ["work", "external"] })
    );

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toEqual(expect.objectContaining({
      field: "labels",
      currentValue: ["work", "external"],
      draftValue: ["work", "mine"]
    }));
    expect(result.merged.labels).toEqual(["work", "external"]);
  });

  it("resolves only conflicting fields while preserving disjoint changes", () => {
    const base = task();
    const comparison = compareTaskEdit(
      base,
      draft(base, { title: "My title", date: "2026-09-22" }),
      task({ title: "External title", notes: "External notes" })
    );
    const resolved = applyTaskConflictChoices(comparison, { title: "draft" });

    expect(resolved.title).toBe("My title");
    expect(resolved.date).toBe("2026-09-22");
    expect(resolved.notes).toBe("External notes");
  });

  it("keeps the base source note when an editor does not expose a draft value", () => {
    const base = task({ sourceNote: "Source.md" });
    const current = task({ sourceNote: "Renamed source.md" });
    const input = draft(base);
    delete input.sourceNote;

    const result = compareTaskEdit(base, input, current);

    expect(result.conflicts).toEqual([]);
    expect(result.merged.sourceNote).toBe("Renamed source.md");
  });
});
