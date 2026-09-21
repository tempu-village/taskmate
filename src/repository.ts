import { App, normalizePath, TFile } from "obsidian";
import type { Task, TaskDraft } from "./domain";
import { encodeTask, encodeTaskPreservingProperties, legacyTaskFileName, nextAvailableTaskFileName, parseTaskMarkdown, taskFromDraft } from "./markdown";
import { applyTaskConflictChoices, compareTaskEdit } from "./task-edit-merge";
import type { EditableTaskField, TaskConflictChoice, TaskEditComparison } from "./task-edit-merge";

const RANK_STEP = 1024;

export interface TaskIdentityConflict {
  id: string;
  paths: string[];
}

export interface TaskScanResult {
  tasks: Task[];
  identityConflicts: TaskIdentityConflict[];
}

export interface TaskEditSession {
  taskId: string;
  openingPath: string;
  baseTask: Task;
  baseContent: string;
}

export type TaskEditStartResult =
  | { status: "ready"; session: TaskEditSession; task: Task }
  | { status: "missing" }
  | { status: "identity-conflict"; conflict: TaskIdentityConflict };

export interface TaskSaveConflict {
  status: "conflict";
  session: TaskEditSession;
  draft: TaskDraft;
  current: Task;
  currentContent: string;
  comparison: TaskEditComparison;
}

export type TaskSaveResult =
  | { status: "saved"; task: Task; externalChangesPreserved: boolean }
  | TaskSaveConflict
  | { status: "review-stale" }
  | { status: "missing" }
  | { status: "identity-conflict"; conflict: TaskIdentityConflict };

type LocatedTask =
  | { status: "ready"; file: TFile; content: string; task: Task }
  | { status: "missing" }
  | { status: "identity-conflict"; conflict: TaskIdentityConflict };

export class DuplicateTaskIdError extends Error {
  constructor(readonly conflict: TaskIdentityConflict) {
    super(`Duplicate task ID ${conflict.id}: ${conflict.paths.join(", ")}`);
  }
}

function newId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export class TaskRepository {
  private knownPathsById = new Map<string, string[]>();
  private indexedTaskPaths: string | null = null;

  constructor(private readonly app: App, private readonly taskFolder: () => string) {}

  private folder(): string {
    return normalizePath(this.taskFolder().trim() || "TaskMate/Tasks");
  }

  private async ensureFolder(path: string): Promise<void> {
    const segments = normalizePath(path).split("/").filter(Boolean);
    let current = "";
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current);
    }
  }

  private availableTaskPath(title: string, currentPath: string | null = null): string {
    const folder = this.folder();
    const prefix = `${folder}/`;
    const occupied = new Set(
      this.app.vault.getMarkdownFiles()
        .map((file) => file.path)
        .filter((path) => path.startsWith(prefix) && path !== currentPath)
        .map((path) => path.toLocaleLowerCase())
    );
    const fileName = nextAvailableTaskFileName(title, (candidate) => (
      occupied.has(normalizePath(`${folder}/${candidate}`).toLocaleLowerCase())
    ));
    return normalizePath(`${folder}/${fileName}`);
  }

  async scan(): Promise<TaskScanResult> {
    const prefix = `${this.folder()}/`;
    const files = this.app.vault.getMarkdownFiles().filter((file) => file.path.startsWith(prefix));
    const tasks = await Promise.all(files.map(async (file) => parseTaskMarkdown(file.path, await this.app.vault.cachedRead(file))));
    const parsed = tasks.filter((task): task is Task => task !== null);
    const pathsById = new Map<string, string[]>();
    for (const task of parsed) {
      const paths = pathsById.get(task.id) ?? [];
      paths.push(task.path);
      pathsById.set(task.id, paths);
    }
    this.knownPathsById = pathsById;
    this.indexedTaskPaths = this.pathSignature(files);
    const identityConflicts = [...pathsById.entries()]
      .filter(([, paths]) => paths.length > 1)
      .map(([id, paths]) => ({ id, paths: [...paths].sort() }))
      .sort((left, right) => left.id.localeCompare(right.id));
    const conflictedIds = new Set(identityConflicts.map((conflict) => conflict.id));
    return {
      tasks: parsed.filter((task) => !conflictedIds.has(task.id)),
      identityConflicts
    };
  }

  async list(): Promise<Task[]> {
    return (await this.scan()).tasks;
  }

  async create(draft: TaskDraft): Promise<Task> {
    if (!draft.title.trim()) throw new Error("Task title is required");
    await this.ensureFolder(this.folder());
    const tasks = await this.list();
    const rank = tasks.reduce((maximum, task) => Math.max(maximum, task.rank), 0) + RANK_STEP;
    const id = newId();
    const path = this.availableTaskPath(draft.title);
    const task = taskFromDraft(id, path, draft, rank, new Date().toISOString());
    await this.app.vault.create(path, encodeTask(task));
    return task;
  }

  async update(task: Task, patch: Partial<Pick<Task, "title" | "date" | "priority" | "labels" | "projectId" | "notes" | "completed" | "rank">>): Promise<Task> {
    const located = await this.locateTask(task.id, task.path);
    if (located.status === "identity-conflict") throw new DuplicateTaskIdError(located.conflict);
    if (located.status === "missing") throw new Error(`Task file not found: ${task.path}`);
    const { file } = located;
    let updated = task;
    await this.app.vault.process(file, (content) => {
      const current = parseTaskMarkdown(file.path, content);
      if (!current || current.id !== task.id) throw new Error(`Invalid task file: ${file.path}`);
      const completed = patch.completed ?? current.completed;
      updated = {
        ...current,
        ...patch,
        completed,
        completedAt: completed ? current.completedAt ?? new Date().toISOString() : null,
        updatedAt: new Date().toISOString()
      };
      return encodeTaskPreservingProperties(updated, content);
    });
    const desiredPath = this.availableTaskPath(updated.title, file.path);
    if (desiredPath !== file.path) {
      await this.app.fileManager.renameFile(file, desiredPath);
      updated = { ...updated, path: desiredPath };
    }
    return updated;
  }

  async beginEdit(task: Task): Promise<TaskEditStartResult> {
    const located = await this.locateTask(task.id, task.path);
    if (located.status !== "ready") return located;
    return {
      status: "ready",
      task: located.task,
      session: {
        taskId: located.task.id,
        openingPath: located.file.path,
        baseTask: { ...located.task, labels: [...located.task.labels] },
        baseContent: located.content
      }
    };
  }

  async saveEditedTask(session: TaskEditSession, draft: TaskDraft): Promise<TaskSaveResult> {
    const located = await this.locateTask(session.taskId, session.openingPath);
    if (located.status !== "ready") return located;
    let outcome: TaskSaveResult = { status: "missing" };
    await this.app.vault.process(located.file, (content) => {
      const current = parseTaskMarkdown(located.file.path, content);
      if (!current || current.id !== session.taskId) {
        outcome = { status: "missing" };
        return content;
      }
      const comparison = compareTaskEdit(session.baseTask, draft, current);
      if (comparison.conflicts.length > 0) {
        outcome = this.conflictResult(session, draft, current, content, comparison);
        return content;
      }
      const updated = this.withUpdatedTimestamp(comparison.merged);
      outcome = {
        status: "saved",
        task: updated,
        externalChangesPreserved: comparison.externalChangesPreserved
      };
      return encodeTaskPreservingProperties(updated, content);
    });
    return this.finishSavedTask(located.file, outcome);
  }

  async resolveEditConflict(
    conflict: TaskSaveConflict,
    choices: Partial<Record<EditableTaskField, TaskConflictChoice>>
  ): Promise<TaskSaveResult> {
    const located = await this.locateTask(conflict.session.taskId, conflict.current.path);
    if (located.status !== "ready") return located;
    let outcome: TaskSaveResult = { status: "missing" };
    await this.app.vault.process(located.file, (content) => {
      const current = parseTaskMarkdown(located.file.path, content);
      if (!current || current.id !== conflict.session.taskId) {
        outcome = { status: "missing" };
        return content;
      }
      if (content !== conflict.currentContent) {
        const comparison = compareTaskEdit(conflict.session.baseTask, conflict.draft, current);
        outcome = comparison.conflicts.length > 0
          ? this.conflictResult(conflict.session, conflict.draft, current, content, comparison)
          : { status: "review-stale" };
        return content;
      }
      const resolved = this.withUpdatedTimestamp(applyTaskConflictChoices(conflict.comparison, choices));
      outcome = { status: "saved", task: resolved, externalChangesPreserved: true };
      return encodeTaskPreservingProperties(resolved, content);
    });
    return this.finishSavedTask(located.file, outcome);
  }

  async migrateLegacyFileNames(): Promise<number> {
    const tasks = (await this.list()).sort((a, b) => a.path.localeCompare(b.path));
    let migrated = 0;
    for (const task of tasks) {
      const currentName = task.path.split("/").pop();
      if (currentName !== legacyTaskFileName(task.title, task.id)) continue;
      const file = this.app.vault.getAbstractFileByPath(task.path);
      if (!(file instanceof TFile)) continue;
      const desiredPath = this.availableTaskPath(task.title, task.path);
      if (desiredPath === task.path) continue;
      await this.app.fileManager.renameFile(file, desiredPath);
      migrated += 1;
    }
    return migrated;
  }

  async remove(task: Task): Promise<void> {
    const located = await this.locateTask(task.id, task.path);
    if (located.status === "identity-conflict") throw new DuplicateTaskIdError(located.conflict);
    if (located.status === "ready") await this.app.vault.trash(located.file, true);
  }

  async clearProject(projectId: string): Promise<void> {
    const tasks = await this.list();
    await Promise.all(tasks.filter((task) => task.projectId === projectId).map((task) => this.update(task, { projectId: null })));
  }

  async reorder(taskId: string, previousId: string | null, nextId: string | null): Promise<void> {
    const tasks = await this.list();
    const target = tasks.find((task) => task.id === taskId);
    if (!target) return;
    const previous = previousId ? tasks.find((task) => task.id === previousId) : null;
    const next = nextId ? tasks.find((task) => task.id === nextId) : null;
    let rank = RANK_STEP;
    if (previous && next) rank = (previous.rank + next.rank) / 2;
    else if (previous) {
      const successor = tasks
        .filter((task) => task.id !== target.id && task.rank > previous.rank)
        .sort((a, b) => a.rank - b.rank)[0];
      rank = successor ? (previous.rank + successor.rank) / 2 : previous.rank + RANK_STEP;
    } else if (next) {
      const predecessor = tasks
        .filter((task) => task.id !== target.id && task.rank < next.rank)
        .sort((a, b) => b.rank - a.rank)[0];
      rank = predecessor ? (predecessor.rank + next.rank) / 2 : next.rank - RANK_STEP;
    }
    await this.update(target, { rank });
  }

  private cloneDraft(draft: TaskDraft): TaskDraft {
    return { ...draft, labels: [...draft.labels] };
  }

  private conflictResult(
    session: TaskEditSession,
    draft: TaskDraft,
    current: Task,
    currentContent: string,
    comparison: TaskEditComparison
  ): TaskSaveConflict {
    return {
      status: "conflict",
      session,
      draft: this.cloneDraft(draft),
      current: { ...current, labels: [...current.labels] },
      currentContent,
      comparison
    };
  }

  private withUpdatedTimestamp(task: Task): Task {
    return { ...task, labels: [...task.labels], updatedAt: new Date().toISOString() };
  }

  private async finishSavedTask(file: TFile, outcome: TaskSaveResult): Promise<TaskSaveResult> {
    if (outcome.status !== "saved") return outcome;
    const desiredPath = this.availableTaskPath(outcome.task.title, file.path);
    if (desiredPath === file.path) return outcome;
    await this.app.fileManager.renameFile(file, desiredPath);
    return { ...outcome, task: { ...outcome.task, path: desiredPath } };
  }

  private taskFiles(): TFile[] {
    const prefix = `${this.folder()}/`;
    return this.app.vault.getMarkdownFiles().filter((file) => file.path.startsWith(prefix));
  }

  private async locateTask(id: string, preferredPath: string): Promise<LocatedTask> {
    const taskFiles = this.taskFiles();
    if (this.indexedTaskPaths !== this.pathSignature(taskFiles)) await this.scan();
    const knownPaths = this.knownPathsById.get(id) ?? [];
    if (knownPaths.length > 1) return {
      status: "identity-conflict",
      conflict: { id, paths: [...knownPaths].sort() }
    };

    const candidatePaths = [...new Set([preferredPath, ...knownPaths])];
    for (const path of candidatePaths) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) continue;
      const content = await this.app.vault.read(file);
      const task = parseTaskMarkdown(file.path, content);
      if (task?.id === id) return { status: "ready", file, content, task };
    }

    const matches: Array<{ file: TFile; content: string; task: Task }> = [];
    for (const file of taskFiles) {
      const content = await this.app.vault.read(file);
      const task = parseTaskMarkdown(file.path, content);
      if (task?.id === id) matches.push({ file, content, task });
    }
    this.knownPathsById.set(id, matches.map((match) => match.file.path));
    if (matches.length > 1) return {
      status: "identity-conflict",
      conflict: { id, paths: matches.map((match) => match.file.path).sort() }
    };
    if (matches.length === 0) return { status: "missing" };
    return { status: "ready", ...matches[0] };
  }

  private pathSignature(files: TFile[]): string {
    return files.map((file) => file.path).sort().join("\n");
  }
}
