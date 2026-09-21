import { beforeEach, describe, expect, it } from "vitest";

import type { App } from "obsidian";
import { TFile } from "obsidian";
import type { Task, TaskDraft } from "../src/domain";
import { encodeTask, parseTaskMarkdown } from "../src/markdown";
import { TaskRepository } from "../src/repository";

function task(overrides: Partial<Task> = {}): Task {
  return {
    path: "TaskMate/Tasks/One.md",
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
    notes: base.notes,
    sourceNote: base.sourceNote,
    ...overrides
  };
}

class MemoryVault {
  readonly files = new Map<string, { file: TFile; content: string }>();

  put(path: string, content: string): void {
    const file = new TFile();
    file.path = path;
    this.files.set(path, { file, content });
  }

  getMarkdownFiles(): TFile[] {
    return [...this.files.values()].map((entry) => entry.file);
  }

  getAbstractFileByPath(path: string): TFile | null {
    return this.files.get(path)?.file ?? null;
  }

  async cachedRead(file: TFile): Promise<string> {
    return this.read(file);
  }

  async read(file: TFile): Promise<string> {
    const entry = this.files.get(file.path);
    if (!entry) throw new Error(`Missing ${file.path}`);
    return entry.content;
  }

  async process(file: TFile, change: (content: string) => string): Promise<string> {
    const entry = this.files.get(file.path);
    if (!entry) throw new Error(`Missing ${file.path}`);
    entry.content = change(entry.content);
    return entry.content;
  }

  async createFolder(): Promise<void> {}

  async create(path: string, content: string): Promise<TFile> {
    this.put(path, content);
    return this.files.get(path)!.file;
  }

  async trash(file: TFile): Promise<void> {
    this.files.delete(file.path);
  }
}

function repositoryWith(vault: MemoryVault): TaskRepository {
  const app = {
    vault,
    fileManager: {
      renameFile: async (file: TFile, desiredPath: string) => {
        const entry = vault.files.get(file.path);
        if (!entry) throw new Error(`Missing ${file.path}`);
        vault.files.delete(file.path);
        file.path = desiredPath;
        vault.files.set(desiredPath, entry);
      }
    }
  } as unknown as App;
  return new TaskRepository(app, () => "TaskMate/Tasks");
}

describe("TaskRepository conflict guards", () => {
  let vault: MemoryVault;
  let repository: TaskRepository;

  beforeEach(() => {
    vault = new MemoryVault();
    repository = repositoryWith(vault);
  });

  it("hides duplicate identities and reports every conflicting path", async () => {
    vault.put("TaskMate/Tasks/One.md", encodeTask(task()));
    vault.put("TaskMate/Tasks/One conflict.md", encodeTask(task({ path: "TaskMate/Tasks/One conflict.md", title: "Other copy" })));

    const result = await repository.scan();

    expect(result.tasks).toEqual([]);
    expect(result.identityConflicts).toEqual([{
      id: "one",
      paths: ["TaskMate/Tasks/One conflict.md", "TaskMate/Tasks/One.md"]
    }]);
  });

  it("blocks a save when a duplicate identity appears after editing begins", async () => {
    const base = task();
    vault.put(base.path, encodeTask(base));
    await repository.scan();
    const start = await repository.beginEdit(base);
    expect(start.status).toBe("ready");
    if (start.status !== "ready") return;
    vault.put(
      "TaskMate/Tasks/One (Conflicted copy Android).md",
      encodeTask(task({ path: "TaskMate/Tasks/One (Conflicted copy Android).md" }))
    );

    const result = await repository.saveEditedTask(start.session, draft(base, { notes: "Mine" }));

    expect(result.status).toBe("identity-conflict");
    expect(parseTaskMarkdown(base.path, vault.files.get(base.path)!.content)?.notes).toBe("Original notes");
  });

  it("merges disjoint changes and preserves unknown frontmatter", async () => {
    const base = task();
    vault.put(base.path, encodeTask(base).replace("---\n\n#", "external-property: keep\n---\n\n#"));
    await repository.scan();
    const start = await repository.beginEdit(base);
    expect(start.status).toBe("ready");
    if (start.status !== "ready") return;
    const external = task({ notes: "Changed externally" });
    vault.files.get(base.path)!.content = encodeTask(external).replace("---\n\n#", "external-property: keep\n---\n\n#");

    const result = await repository.saveEditedTask(start.session, draft(base, { date: "2026-09-22" }));

    expect(result.status).toBe("saved");
    const savedContent = vault.files.get(base.path)!.content;
    expect(savedContent).toContain("external-property: keep");
    expect(parseTaskMarkdown(base.path, savedContent)).toEqual(expect.objectContaining({
      date: "2026-09-22",
      notes: "Changed externally"
    }));
  });

  it("preserves notes synced while the editor is open when only labels are changed locally", async () => {
    const base = task();
    vault.put(base.path, encodeTask(base));
    await repository.scan();
    const start = await repository.beginEdit(base);
    expect(start.status).toBe("ready");
    if (start.status !== "ready") return;

    const syncedFromPc = task({ notes: "Changed on PC" });
    vault.files.get(base.path)!.content = encodeTask(syncedFromPc);

    const result = await repository.saveEditedTask(
      start.session,
      draft(base, { labels: ["work", "changed-on-phone"] })
    );

    expect(result).toEqual(expect.objectContaining({
      status: "saved",
      externalChangesPreserved: true
    }));
    expect(parseTaskMarkdown(base.path, vault.files.get(base.path)!.content)).toEqual(expect.objectContaining({
      labels: ["work", "changed-on-phone"],
      notes: "Changed on PC"
    }));
  });

  it("leaves the file unchanged until a same-field conflict is resolved", async () => {
    const base = task();
    vault.put(base.path, encodeTask(base));
    await repository.scan();
    const start = await repository.beginEdit(base);
    expect(start.status).toBe("ready");
    if (start.status !== "ready") return;
    vault.files.get(base.path)!.content = encodeTask(task({ title: "External title" }));
    const externalContent = vault.files.get(base.path)!.content;

    const conflict = await repository.saveEditedTask(start.session, draft(base, { title: "My title" }));

    expect(conflict.status).toBe("conflict");
    expect(vault.files.get(base.path)!.content).toBe(externalContent);
    if (conflict.status !== "conflict") return;
    const saved = await repository.resolveEditConflict(conflict, { title: "draft" });
    expect(saved.status).toBe("saved");
    const savedTask = parseTaskMarkdown("TaskMate/Tasks/My title.md", vault.files.get("TaskMate/Tasks/My title.md")!.content);
    expect(savedTask?.title).toBe("My title");
  });

  it("does not apply a decision made against a stale conflict screen", async () => {
    const base = task();
    vault.put(base.path, encodeTask(base));
    await repository.scan();
    const start = await repository.beginEdit(base);
    expect(start.status).toBe("ready");
    if (start.status !== "ready") return;
    vault.files.get(base.path)!.content = encodeTask(task({ title: "External title" }));
    const first = await repository.saveEditedTask(start.session, draft(base, { title: "My title" }));
    expect(first.status).toBe("conflict");
    if (first.status !== "conflict") return;
    vault.files.get(base.path)!.content = encodeTask(task({ title: "Newer external title" }));

    const refreshed = await repository.resolveEditConflict(first, { title: "draft" });

    expect(refreshed.status).toBe("conflict");
    expect(parseTaskMarkdown(base.path, vault.files.get(base.path)!.content)?.title).toBe("Newer external title");
    if (refreshed.status === "conflict") {
      expect(refreshed.comparison.conflicts[0]?.currentValue).toBe("Newer external title");
    }
  });

  it("requires a new Save when a later change removes the original field conflict", async () => {
    const base = task();
    vault.put(base.path, encodeTask(base));
    await repository.scan();
    const start = await repository.beginEdit(base);
    expect(start.status).toBe("ready");
    if (start.status !== "ready") return;
    vault.files.get(base.path)!.content = encodeTask(task({ title: "External title" }));
    const first = await repository.saveEditedTask(start.session, draft(base, { title: "My title" }));
    expect(first.status).toBe("conflict");
    if (first.status !== "conflict") return;
    vault.files.get(base.path)!.content = encodeTask(task({ title: "My title", notes: "A newer note" }));
    const beforeResolution = vault.files.get(base.path)!.content;

    const result = await repository.resolveEditConflict(first, { title: "draft" });

    expect(result.status).toBe("review-stale");
    expect(vault.files.get(base.path)!.content).toBe(beforeResolution);
  });
});
