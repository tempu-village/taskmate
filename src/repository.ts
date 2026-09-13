import { App, normalizePath, TFile } from "obsidian";
import type { Task, TaskDraft } from "./domain";
import { encodeTask, legacyTaskFileName, nextAvailableTaskFileName, parseTaskMarkdown, taskFromDraft } from "./markdown";

const RANK_STEP = 1024;

function newId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export class TaskRepository {
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

  async list(): Promise<Task[]> {
    const prefix = `${this.folder()}/`;
    const files = this.app.vault.getMarkdownFiles().filter((file) => file.path.startsWith(prefix));
    const tasks = await Promise.all(files.map(async (file) => parseTaskMarkdown(file.path, await this.app.vault.cachedRead(file))));
    return tasks.filter((task): task is Task => task !== null);
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
    const file = this.app.vault.getAbstractFileByPath(task.path);
    if (!(file instanceof TFile)) throw new Error(`Task file not found: ${task.path}`);
    let updated = task;
    await this.app.vault.process(file, (content) => {
      const current = parseTaskMarkdown(task.path, content);
      if (!current) throw new Error(`Invalid task file: ${task.path}`);
      const completed = patch.completed ?? current.completed;
      updated = {
        ...current,
        ...patch,
        completed,
        completedAt: completed ? current.completedAt ?? new Date().toISOString() : null,
        updatedAt: new Date().toISOString()
      };
      return encodeTask(updated);
    });
    const desiredPath = this.availableTaskPath(updated.title, task.path);
    if (desiredPath !== file.path) {
      await this.app.fileManager.renameFile(file, desiredPath);
      updated = { ...updated, path: desiredPath };
    }
    return updated;
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
    const file = this.app.vault.getAbstractFileByPath(task.path);
    if (file instanceof TFile) await this.app.vault.trash(file, true);
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
}
