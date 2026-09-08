import { App, normalizePath, TFile } from "obsidian";
import type { Project } from "./domain";
import { encodeProject, parseProjectMarkdown, projectFileName } from "./project-markdown";

function newId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export class ProjectRepository {
  constructor(private readonly app: App, private readonly projectFolder: () => string) {}

  private folder(): string {
    return normalizePath(this.projectFolder().trim() || "TaskMate/Projects");
  }

  private async ensureFolder(): Promise<void> {
    const segments = this.folder().split("/").filter(Boolean);
    let current = "";
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current);
    }
  }

  async list(): Promise<Project[]> {
    const prefix = `${this.folder()}/`;
    const files = this.app.vault.getMarkdownFiles().filter((file) => file.path.startsWith(prefix));
    const projects = await Promise.all(files.map(async (file) => parseProjectMarkdown(file.path, await this.app.vault.cachedRead(file))));
    return projects.filter((project): project is Project => project !== null);
  }

  async create(name: string): Promise<Project> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Project name is required");
    await this.ensureFolder();
    const id = newId();
    const now = new Date().toISOString();
    const path = normalizePath(`${this.folder()}/${projectFileName(trimmed, id)}`);
    const project: Project = { path, id, name: trimmed, createdAt: now, updatedAt: now, lastUsedAt: now };
    await this.app.vault.create(path, encodeProject(project));
    return project;
  }

  async update(project: Project, patch: Partial<Pick<Project, "name" | "lastUsedAt">>): Promise<Project> {
    const file = this.app.vault.getAbstractFileByPath(project.path);
    if (!(file instanceof TFile)) throw new Error(`Project file not found: ${project.path}`);
    let updated = project;
    await this.app.vault.process(file, (content) => {
      const current = parseProjectMarkdown(project.path, content);
      if (!current) throw new Error(`Invalid project file: ${project.path}`);
      updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
      return encodeProject(updated);
    });
    const desiredPath = normalizePath(`${this.folder()}/${projectFileName(updated.name, updated.id)}`);
    if (desiredPath !== file.path) {
      await this.app.fileManager.renameFile(file, desiredPath);
      updated = { ...updated, path: desiredPath };
    }
    return updated;
  }

  async touch(project: Project): Promise<Project> {
    return this.update(project, { lastUsedAt: new Date().toISOString() });
  }

  async remove(project: Project): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(project.path);
    if (file instanceof TFile) await this.app.vault.trash(file, true);
  }
}
