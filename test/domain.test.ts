import { describe, expect, it } from "vitest";
import { filterTasks, groupScheduledTasks, sortTasks, taskMatchesView } from "../src/domain";
import type { Project, Task } from "../src/domain";
import { encodeTask, legacyTaskFileName, nextAvailableTaskFileName, parseTaskMarkdown, taskFileName } from "../src/markdown";
import { encodeProject, parseProjectMarkdown, projectFileName } from "../src/project-markdown";
import { filterLabelSuggestions, recordRecentLabels, recentLabelSuggestions, taskDateSuggestions } from "../src/task-input-suggestions";

function task(overrides: Partial<Task> = {}): Task {
  return {
    path: "Todo/Tasks/one.md",
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

describe("smart views", () => {
  const today = "2026-09-06";

  it("puts every dated incomplete task in Scheduled", () => {
    expect(taskMatchesView(task({ date: "2026-09-04" }), "scheduled", today)).toBe(true);
    expect(taskMatchesView(task({ date: today }), "scheduled", today)).toBe(true);
    expect(taskMatchesView(task({ date: "2026-09-12" }), "scheduled", today)).toBe(true);
    expect(taskMatchesView(task(), "scheduled", today)).toBe(false);
    expect(taskMatchesView(task({ date: today, completed: true }), "scheduled", today)).toBe(false);
  });

  it("puts only incomplete undated tasks in Unplanned", () => {
    expect(taskMatchesView(task(), "unplanned", today)).toBe(true);
    expect(taskMatchesView(task({ completed: true }), "unplanned", today)).toBe(false);
  });

  it("groups Scheduled into overdue, today, and later", () => {
    const groups = groupScheduledTasks([
      task({ id: "overdue", date: "2026-09-05" }),
      task({ id: "today", date: today }),
      task({ id: "later", date: "2026-09-07" }),
      task({ id: "undated" }),
      task({ id: "done", date: today, completed: true })
    ], today);
    expect(groups.overdue.map((item) => item.id)).toEqual(["overdue"]);
    expect(groups.today.map((item) => item.id)).toEqual(["today"]);
    expect(groups.later.map((item) => item.id)).toEqual(["later"]);
  });
});

describe("filters and sorting", () => {
  it("combines priority, label, and text filters", () => {
    const tasks = [
      task({ title: "Call Mina", priority: 1, labels: ["連絡"] }),
      task({ id: "two", title: "Call Jo", priority: 2, labels: ["連絡"] })
    ];
    expect(filterTasks(tasks, "all", { priorities: [1], labels: ["連絡"], search: "mina", includeCompleted: false })).toHaveLength(1);
  });

  it("includes completed tasks only when explicitly enabled", () => {
    const tasks = [task({ id: "open" }), task({ id: "done", completed: true })];
    expect(filterTasks(tasks, "all", { priorities: [], labels: [], search: "", includeCompleted: false }).map((item) => item.id)).toEqual(["open"]);
    expect(filterTasks(tasks, "all", { priorities: [], labels: [], search: "", includeCompleted: true }).map((item) => item.id)).toEqual(["open", "done"]);
  });

  it("includes completed tasks inside dated and undated views when explicitly enabled", () => {
    const tasks = [
      task({ id: "dated", date: "2026-09-20", completed: true }),
      task({ id: "undated", completed: true })
    ];
    const filters = { priorities: [], labels: [], search: "", includeCompleted: true };
    expect(filterTasks(tasks, "scheduled", filters).map((item) => item.id)).toEqual(["dated"]);
    expect(filterTasks(tasks, "unplanned", filters).map((item) => item.id)).toEqual(["undated"]);
  });

  it("preserves global rank in manual mode", () => {
    const tasks = [task({ id: "late", rank: 20 }), task({ id: "early", rank: 10 })];
    expect(sortTasks(tasks, "manual").map((item) => item.id)).toEqual(["early", "late"]);
  });

  it("reverses date order while keeping undated tasks last", () => {
    const tasks = [
      task({ id: "none", date: null }),
      task({ id: "early", date: "2026-09-10" }),
      task({ id: "late", date: "2026-09-20" })
    ];
    expect(sortTasks(tasks, "date", "asc").map((item) => item.id)).toEqual(["early", "late", "none"]);
    expect(sortTasks(tasks, "date", "desc").map((item) => item.id)).toEqual(["late", "early", "none"]);
  });

  it("reverses priority order while keeping tasks without priority last", () => {
    const tasks = [
      task({ id: "none", priority: null }),
      task({ id: "p1", priority: 1 }),
      task({ id: "p3", priority: 3 })
    ];
    expect(sortTasks(tasks, "priority", "asc").map((item) => item.id)).toEqual(["p1", "p3", "none"]);
    expect(sortTasks(tasks, "priority", "desc").map((item) => item.id)).toEqual(["p3", "p1", "none"]);
  });

  it("reverses creation order", () => {
    const tasks = [
      task({ id: "old", createdAt: "2026-09-01T00:00:00.000Z" }),
      task({ id: "new", createdAt: "2026-09-02T00:00:00.000Z" })
    ];
    expect(sortTasks(tasks, "created", "asc").map((item) => item.id)).toEqual(["old", "new"]);
    expect(sortTasks(tasks, "created", "desc").map((item) => item.id)).toEqual(["new", "old"]);
  });
});

describe("task Markdown", () => {
  it("round trips the canonical task shape", () => {
    const original = task({ title: "日本語のタスク", date: "2026-09-12", priority: 1, labels: ["仕事", "連絡"], projectId: "project-1", notes: "補足\n二行目" });
    expect(parseTaskMarkdown(original.path, encodeTask(original))).toEqual(original);
  });

  it("uses the readable title without exposing the task ID", () => {
    expect(taskFileName("見積書を送る / 最終版")).toBe("見積書を送る - 最終版.md");
  });

  it("adds a number only when the readable title is already used", () => {
    const occupied = new Set(["買い物.md", "買い物 (2).md"]);
    expect(nextAvailableTaskFileName("買い物", (name) => occupied.has(name))).toBe("買い物 (3).md");
  });

  it("still recognizes the former short-ID filename during migration", () => {
    expect(legacyTaskFileName("見積書を送る", "12345678-abcd")).toBe("見積書を送る--12345678.md");
  });
});

describe("project Markdown", () => {
  it("round trips a project and keeps its filename readable", () => {
    const project: Project = {
      path: "TaskMate/Projects/仕事--project1.md",
      id: "project1-abcd",
      name: "仕事",
      createdAt: "2026-09-07T00:00:00.000Z",
      updatedAt: "2026-09-07T00:00:00.000Z",
      lastUsedAt: null
    };
    expect(parseProjectMarkdown(project.path, encodeProject(project))).toEqual(project);
    expect(projectFileName(project.name, project.id)).toBe("仕事--project1.md");
  });
});

describe("task input suggestions", () => {
  it("offers today, tomorrow, seven days later, and no date", () => {
    expect(taskDateSuggestions("2026-09-13")).toEqual([
      { id: "today", date: "2026-09-13" },
      { id: "tomorrow", date: "2026-09-14" },
      { id: "seven-days", date: "2026-09-20" },
      { id: "none", date: null }
    ]);
  });

  it("keeps ten unique recent labels with newly saved labels first", () => {
    const history = Array.from({ length: 10 }, (_, index) => `label-${index + 1}`);
    expect(recordRecentLabels(history, ["仕事", "label-2", "#連絡", "仕事"])).toEqual([
      "仕事", "label-2", "連絡", "label-1", "label-3", "label-4", "label-5", "label-6", "label-7", "label-8"
    ]);
    expect(recentLabelSuggestions(["仕事", "仕事", " 連絡 "])).toEqual(["仕事", "連絡"]);
  });

  it("offers recent labels on focus and matching labels while typing", () => {
    const labels = ["仕事", "連絡", "私用", "資料"];
    expect(filterLabelSuggestions(labels, ["連絡", "仕事", "削除済み"], "", ["仕事"])).toEqual(["連絡"]);
    expect(filterLabelSuggestions(labels, [], "料", ["仕事"])).toEqual(["資料"]);
  });
});
