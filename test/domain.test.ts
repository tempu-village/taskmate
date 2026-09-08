import { describe, expect, it } from "vitest";
import { filterTasks, sortTasks, taskMatchesView } from "../src/domain";
import type { Project, Task } from "../src/domain";
import { encodeTask, parseTaskMarkdown, taskFileName } from "../src/markdown";
import { encodeProject, parseProjectMarkdown, projectFileName } from "../src/project-markdown";

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

  it("includes overdue tasks in Today", () => {
    expect(taskMatchesView(task({ date: "2026-09-04" }), "today", today)).toBe(true);
  });

  it("limits Next 7 days to today through day six", () => {
    expect(taskMatchesView(task({ date: "2026-09-12" }), "seven-days", today)).toBe(true);
    expect(taskMatchesView(task({ date: "2026-09-13" }), "seven-days", today)).toBe(false);
  });

  it("puts only incomplete undated tasks in Unplanned", () => {
    expect(taskMatchesView(task(), "unplanned", today)).toBe(true);
    expect(taskMatchesView(task({ completed: true }), "unplanned", today)).toBe(false);
  });
});

describe("filters and sorting", () => {
  it("combines priority, label, and text filters", () => {
    const tasks = [
      task({ title: "Call Mina", priority: 1, labels: ["連絡"] }),
      task({ id: "two", title: "Call Jo", priority: 2, labels: ["連絡"] })
    ];
    expect(filterTasks(tasks, "all", { priorities: [1], labels: ["連絡"], search: "mina" })).toHaveLength(1);
  });

  it("preserves global rank in manual mode", () => {
    const tasks = [task({ id: "late", rank: 20 }), task({ id: "early", rank: 10 })];
    expect(sortTasks(tasks, "manual").map((item) => item.id)).toEqual(["early", "late"]);
  });
});

describe("task Markdown", () => {
  it("round trips the canonical task shape", () => {
    const original = task({ title: "日本語のタスク", date: "2026-09-12", priority: 1, labels: ["仕事", "連絡"], projectId: "project-1", notes: "補足\n二行目" });
    expect(parseTaskMarkdown(original.path, encodeTask(original))).toEqual(original);
  });

  it("uses a readable collision-resistant file name", () => {
    expect(taskFileName("見積書を送る / 最終版", "12345678-abcd")).toBe("見積書を送る - 最終版--12345678.md");
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
