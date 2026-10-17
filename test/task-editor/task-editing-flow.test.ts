/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Project, Task, TaskDraft } from "../../src/tasks/domain";
import type { TaskEditSession, TaskEditStartResult, TaskSaveConflict, TaskSaveResult } from "../../src/tasks/repository";
import type { EditableTaskField, TaskConflictChoice } from "../../src/tasks/task-edit-merge";

interface FakeTaskModal {
  task: Task | null;
  defaultProjectId: string | null;
  onSave: (draft: TaskDraft) => Promise<boolean>;
  onDelete: (() => Promise<boolean>) | null;
  opened: boolean;
  closed: boolean;
}

interface FakeConflictModal {
  conflict: TaskSaveConflict;
  onResolve: (choices: Partial<Record<EditableTaskField, TaskConflictChoice>>) => Promise<boolean>;
}

const created = vi.hoisted(() => ({
  notices: [] as Array<{ message: string; duration?: number }>,
  taskModals: [] as FakeTaskModal[],
  conflictModals: [] as FakeConflictModal[]
}));

vi.mock("obsidian", async (importOriginal) => ({
  ...await importOriginal<object>(),
  App: class {},
  Notice: class {
    constructor(message: string, duration?: number) {
      created.notices.push({ message, duration });
    }
  }
}));

vi.mock("../../src/task-editor/task-modal", () => ({
  TaskModal: class {
    private readonly record: FakeTaskModal;
    constructor(
      _app: unknown,
      task: Task | null,
      _projects: Project[],
      _labelOptions: unknown,
      defaultProjectId: string | null,
      _availableRegion: HTMLElement,
      _i18n: unknown,
      onSave: (draft: TaskDraft) => Promise<boolean>,
      onDelete: (() => Promise<boolean>) | null = null
    ) {
      this.record = { task, defaultProjectId, onSave, onDelete, opened: false, closed: false };
      created.taskModals.push(this.record);
    }
    open(): void {
      this.record.opened = true;
    }
    close(): void {
      this.record.closed = true;
    }
  }
}));

vi.mock("../../src/task-editor/task-conflict-modal", () => ({
  TaskConflictModal: class {
    constructor(
      _app: unknown,
      conflict: TaskSaveConflict,
      _projects: Project[],
      _i18n: unknown,
      onResolve: FakeConflictModal["onResolve"]
    ) {
      created.conflictModals.push({ conflict, onResolve });
    }
    open(): void {}
  }
}));

import { App } from "obsidian";
import { createI18n } from "../../src/i18n";
import { TaskEditingFlow } from "../../src/task-editor/task-editing-flow";
import { DuplicateTaskIdError } from "../../src/tasks/repository";

const i18n = createI18n("en");

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
    createdAt: "2026-10-17T00:00:00.000Z",
    updatedAt: "2026-10-17T00:00:00.000Z",
    completedAt: null,
    sourceNote: null,
    steps: [],
    stepSectionRemainder: "",
    notes: "",
    ...overrides
  };
}

const project: Project = {
  path: "TaskMate/Projects/home.md",
  id: "project-home",
  name: "Home",
  createdAt: "2026-10-17T00:00:00.000Z",
  updatedAt: "2026-10-17T00:00:00.000Z",
  lastUsedAt: null
};

const draft: TaskDraft = { title: "Edited", date: null, priority: null, labels: ["home"], projectId: "project-home", steps: [], notes: "" };

function session(base: Task): TaskEditSession {
  return { taskId: base.id, openingPath: base.path, baseTask: base, baseContent: "" };
}

function conflict(base: Task): TaskSaveConflict {
  return {
    status: "conflict",
    session: session(base),
    draft,
    current: base,
    currentContent: "",
    comparison: { merged: base, conflicts: [], externalChangesPreserved: false }
  };
}

function setup(editStart: TaskEditStartResult = { status: "missing" }) {
  const repository = {
    list: vi.fn(async () => [] as Task[]),
    create: vi.fn(async (value: TaskDraft) => task("created", { labels: value.labels })),
    beginEdit: vi.fn(async (_task: Task) => editStart),
    saveEditedTask: vi.fn(async (_session: TaskEditSession, _draft: TaskDraft): Promise<TaskSaveResult> => ({ status: "missing" })),
    resolveEditConflict: vi.fn(async (_conflict: TaskSaveConflict, _choices: Partial<Record<EditableTaskField, TaskConflictChoice>>): Promise<TaskSaveResult> => ({ status: "missing" })),
    remove: vi.fn(async (_task: Task) => undefined)
  };
  const projects = { list: vi.fn(async () => [project]), touch: vi.fn(async (value: Project) => value) };
  const rememberLabels = vi.fn(async (_labels: string[]) => undefined);
  const refresh = vi.fn();
  const flow = new TaskEditingFlow({
    app: new App(),
    availableRegion: document.createElement("div"),
    repository,
    projects,
    i18n: () => i18n,
    labelOptions: () => ({ allLabels: [], recentLabels: [], favoriteLabels: [], onFavoriteLabelsChange: async () => undefined }),
    rememberLabels,
    refresh
  });
  return { flow, repository, projects, rememberLabels, refresh };
}

function messages(): string[] {
  return created.notices.map((notice) => notice.message);
}

beforeEach(() => {
  created.notices.length = 0;
  created.taskModals.length = 0;
  created.conflictModals.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Task editing flow", () => {
  it("creates a Task, remembers its Labels, touches its Project and refreshes", async () => {
    const { flow, repository, projects, rememberLabels, refresh } = setup();

    await flow.openCreate("project-home");
    const modal = created.taskModals[0];
    expect(modal).toMatchObject({ task: null, defaultProjectId: "project-home", opened: true });

    await expect(modal.onSave(draft)).resolves.toBe(true);
    expect(repository.create).toHaveBeenCalledWith(draft);
    expect(rememberLabels).toHaveBeenCalledWith(["home"]);
    expect(projects.touch).toHaveBeenCalledWith(project);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("reports a missing Task without opening the editor", async () => {
    const { flow, refresh } = setup({ status: "missing" });

    await flow.openEdit(task("gone"));

    expect(created.taskModals).toEqual([]);
    expect(messages()).toEqual([i18n.t("conflict.missing")]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("reports duplicate Task IDs persistently without opening the editor", async () => {
    const { flow, refresh } = setup({ status: "identity-conflict", conflict: { id: "one", paths: ["a.md", "b.md"] } });

    await flow.openEdit(task("one"));

    expect(created.taskModals).toEqual([]);
    expect(created.notices).toEqual([{ message: i18n.t("conflict.identityNotice", { paths: "a.md, b.md" }), duration: 0 }]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("finishes a saved edit through the after-action instead of refreshing", async () => {
    const base = task("one");
    const { flow, repository, rememberLabels, refresh } = setup({ status: "ready", session: session(base), task: base });
    const saved = task("one", { labels: ["home"] });
    repository.saveEditedTask.mockResolvedValueOnce({ status: "saved", task: saved, externalChangesPreserved: true });
    const afterAction = vi.fn();

    await flow.openEdit(base, afterAction);

    await expect(created.taskModals[0].onSave(draft)).resolves.toBe(true);
    expect(rememberLabels).toHaveBeenCalledWith(["home"]);
    expect(messages()).toEqual([i18n.t("conflict.externalPreserved")]);
    expect(afterAction).toHaveBeenCalledOnce();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("keeps the editor open on a conflict and closes it once the conflict is resolved", async () => {
    const base = task("one");
    const { flow, repository } = setup({ status: "ready", session: session(base), task: base });
    repository.saveEditedTask.mockResolvedValueOnce(conflict(base));
    repository.resolveEditConflict.mockResolvedValueOnce({ status: "saved", task: base, externalChangesPreserved: false });

    await flow.openEdit(base);
    await expect(created.taskModals[0].onSave(draft)).resolves.toBe(false);
    expect(created.conflictModals).toHaveLength(1);
    expect(created.taskModals[0].closed).toBe(false);

    await expect(created.conflictModals[0].onResolve({ title: "draft" })).resolves.toBe(true);
    expect(messages()).toEqual([i18n.t("conflict.resolved")]);
    expect(created.taskModals[0].closed).toBe(true);
  });

  it("reopens the conflict dialog when the Task changes again during resolution", async () => {
    vi.useFakeTimers();
    const base = task("one");
    const { flow, repository } = setup({ status: "ready", session: session(base), task: base });
    repository.saveEditedTask.mockResolvedValueOnce(conflict(base));
    const again = conflict(task("one", { title: "Changed elsewhere" }));
    repository.resolveEditConflict.mockResolvedValueOnce(again);

    await flow.openEdit(base);
    await created.taskModals[0].onSave(draft);
    await expect(created.conflictModals[0].onResolve({})).resolves.toBe(true);
    expect(messages()).toEqual([i18n.t("conflict.changedAgain")]);
    expect(created.conflictModals).toHaveLength(1);

    vi.runAllTimers();
    expect(created.conflictModals).toHaveLength(2);
    expect(created.conflictModals[1].conflict).toBe(again);
  });

  it("stops a stale save with a notice and a refresh", async () => {
    const base = task("one");
    const { flow, repository, refresh } = setup({ status: "ready", session: session(base), task: base });
    repository.saveEditedTask.mockResolvedValueOnce({ status: "review-stale" });

    await flow.openEdit(base);

    await expect(created.taskModals[0].onSave(draft)).resolves.toBe(false);
    expect(messages()).toEqual([i18n.t("conflict.changedAgain")]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("deletes from the editor and reports duplicate IDs instead of deleting", async () => {
    const base = task("one");
    const { flow, repository, refresh } = setup({ status: "ready", session: session(base), task: base });

    await flow.openEdit(base);
    const onDelete = created.taskModals[0].onDelete;
    expect(onDelete).not.toBeNull();

    await expect(onDelete?.()).resolves.toBe(true);
    expect(repository.remove).toHaveBeenCalledWith(base);
    expect(messages()).toEqual([i18n.t("tasks.deletedNotice")]);
    expect(refresh).toHaveBeenCalledOnce();

    repository.remove.mockRejectedValueOnce(new DuplicateTaskIdError({ id: "one", paths: ["a.md", "b.md"] }));
    await expect(onDelete?.()).resolves.toBe(false);
    expect(messages()).toContain(i18n.t("conflict.identityNotice", { paths: "a.md, b.md" }));
  });
});
