import { describe, expect, it } from "vitest";
import type { App } from "obsidian";
import { TFile } from "obsidian";
import type { Task } from "../../../src/domain";
import { encodeTask, parseTaskMarkdown } from "../../../src/markdown";
import { TaskRepository } from "../../../src/repository";
import { TaskChangeProposalRepository } from "../../../src/reviews/task-change/proposal-repository";
import { sha256 } from "../../../src/reviews/task-change/proposal";
import type { TaskChangeProposal } from "../../../src/reviews/task-change/proposal";

class MemoryVault {
  readonly files = new Map<string, { file: TFile; content: string }>();
  readonly folders = new Set<string>();

  put(path: string, content: string): TFile {
    const file = new TFile();
    file.path = path;
    Object.defineProperty(file, "extension", { value: path.split(".").pop() ?? "" });
    this.files.set(path, { file, content });
    return file;
  }
  getFiles(): TFile[] { return [...this.files.values()].map((entry) => entry.file); }
  getMarkdownFiles(): TFile[] { return this.getFiles().filter((file) => file.path.endsWith(".md")); }
  getAbstractFileByPath(path: string): unknown { return this.files.get(path)?.file ?? (this.folders.has(path) ? { path } : null); }
  async read(file: TFile): Promise<string> { return this.files.get(file.path)!.content; }
  async cachedRead(file: TFile): Promise<string> { return this.read(file); }
  async create(path: string, content: string): Promise<TFile> { return this.put(path, content); }
  async modify(file: TFile, content: string): Promise<void> { this.files.get(file.path)!.content = content; }
  async process(file: TFile, change: (content: string) => string): Promise<string> {
    const entry = this.files.get(file.path)!;
    entry.content = change(entry.content);
    return entry.content;
  }
  async createFolder(path: string): Promise<void> { this.folders.add(path); }
}

function baseTask(overrides: Partial<Task> = {}): Task {
  return {
    path: "TaskMate/Tasks/Example.md", id: "task-uuid", title: "Example", completed: false,
    date: "2026-10-10", priority: null, labels: [], projectId: null, rank: 1024,
    createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
    completedAt: null, sourceNote: null, steps: [], stepSectionRemainder: "", notes: "Original", ...overrides
  };
}

describe("TaskChangeProposalRepository", () => {
  it("applies selected changes, archives the reviewed Proposal and persists a follow-up", async () => {
    const vault = new MemoryVault();
    vault.folders.add("TaskMate"); vault.folders.add("TaskMate/Tasks"); vault.folders.add("TaskMate/Proposals");
    const before = encodeTask(baseTask());
    const after = encodeTask(baseTask({ date: "2026-10-18", notes: "Changed", updatedAt: "2026-10-12T00:00:00.000Z" }));
    vault.put("TaskMate/Tasks/Example.md", before);
    const proposal: TaskChangeProposal = {
      schemaVersion: 1, id: "proposal-001", status: "pending", createdAt: "2026-10-12T00:00:00.000Z",
      tasks: [{ taskId: "task-uuid", path: "TaskMate/Tasks/Example.md", title: "Example",
        beforeMarkdown: before, afterMarkdown: after, beforeSha256: await sha256(before), changes: [
          { id: "C-01", field: "date", before: "2026-10-10", after: "2026-10-18", reason: "Reschedule" },
          { id: "C-02", field: "notes", before: "Original", after: "Changed", reason: "Clarify" }
        ] }]
    };
    vault.put("TaskMate/Proposals/proposal-001.json", `${JSON.stringify(proposal)}\n`);
    const app = { vault, fileManager: { renameFile: async (file: TFile, path: string) => {
      const entry = vault.files.get(file.path)!; vault.files.delete(file.path); file.path = path; vault.files.set(path, entry);
    } } } as unknown as App;
    const tasks = new TaskRepository(app, () => "TaskMate/Tasks");
    const proposals = new TaskChangeProposalRepository(app, () => "TaskMate/Proposals", tasks);

    await proposals.review("proposal-001");
    expect(parseTaskMarkdown("TaskMate/Tasks/Example.md", vault.files.get("TaskMate/Tasks/Example.md")!.content)?.date).toBe("2026-10-10");
    const result = await proposals.apply("proposal-001", ["C-01"], "2026-10-12T01:00:00.000Z");

    expect(result.status).toBe("partially-applied");
    expect(parseTaskMarkdown("TaskMate/Tasks/Example.md", vault.files.get("TaskMate/Tasks/Example.md")!.content)).toEqual(expect.objectContaining({ date: "2026-10-18", notes: "Original" }));
    expect(vault.files.has("TaskMate/Proposals/History/proposal-001.json")).toBe(true);
    expect(vault.files.has(`TaskMate/Proposals/${result.followUp?.id}.json`)).toBe(true);
    expect(await proposals.listHistory()).toEqual([
      expect.objectContaining({
        id: "proposal-001",
        status: "partially-applied",
        succeededCount: 1,
        failedCount: 0,
        followUpProposalId: result.followUp?.id
      })
    ]);
    expect((await proposals.reviewHistory("proposal-001")).proposalId).toBe("proposal-001");
  });

  it("retains another Task's follow-up when a later Task write becomes stale", async () => {
    const vault = new MemoryVault();
    vault.folders.add("TaskMate"); vault.folders.add("TaskMate/Proposals");
    const first = baseTask({ id: "task-first", path: "TaskMate/Tasks/First.md", title: "First" });
    const second = baseTask({ id: "task-second", path: "TaskMate/Tasks/Second.md", title: "Second" });
    const firstBefore = encodeTask(first);
    const secondBefore = encodeTask(second);
    const proposal: TaskChangeProposal = {
      schemaVersion: 1, id: "proposal-001", status: "pending", createdAt: "2026-10-12T00:00:00.000Z",
      tasks: [
        {
          taskId: first.id, path: first.path, title: first.title,
          beforeMarkdown: firstBefore,
          afterMarkdown: encodeTask({ ...first, date: "2026-10-18", notes: "Later", updatedAt: "2026-10-12T00:00:00.000Z" }),
          beforeSha256: await sha256(firstBefore),
          changes: [
            { id: "C-01", field: "date", before: first.date, after: "2026-10-18", reason: "Reschedule" },
            { id: "C-02", field: "notes", before: first.notes, after: "Later", reason: "Defer notes" }
          ]
        },
        {
          taskId: second.id, path: second.path, title: second.title,
          beforeMarkdown: secondBefore,
          afterMarkdown: encodeTask({ ...second, priority: 1, updatedAt: "2026-10-12T00:00:00.000Z" }),
          beforeSha256: await sha256(secondBefore),
          changes: [{ id: "C-03", field: "priority", before: null, after: 1, reason: "Prioritize" }]
        }
      ]
    };
    vault.put("TaskMate/Proposals/proposal-001.json", `${JSON.stringify(proposal)}\n`);
    const app = { vault, fileManager: { renameFile: async (file: TFile, path: string) => {
      const entry = vault.files.get(file.path)!; vault.files.delete(file.path); file.path = path; vault.files.set(path, entry);
    } } } as unknown as App;
    const sources = new Map([[first.id, firstBefore], [second.id, secondBefore]]);
    const tasks = {
      readReviewedTask: async (taskId: string) => ({ status: "ready" as const, path: taskId === first.id ? first.path : second.path, content: sources.get(taskId)! }),
      writeReviewedTask: async (taskId: string) => {
        if (taskId === second.id) {
          sources.set(second.id, encodeTask({ ...second, notes: "Changed during write", updatedAt: "2026-10-12T01:00:00.000Z" }));
          return { status: "stale" as const };
        }
        return { status: "saved" as const, path: first.path };
      }
    } as unknown as TaskRepository;
    const proposals = new TaskChangeProposalRepository(app, () => "TaskMate/Proposals", tasks);

    const result = await proposals.apply("proposal-001", ["C-01", "C-03"], "2026-10-12T01:00:00.000Z");

    expect(result.status).toBe("partially-applied");
    expect(result.followUp?.tasks).toHaveLength(2);
    expect(result.followUp?.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ taskId: first.id }),
      expect.objectContaining({
        taskId: second.id,
        beforeMarkdown: sources.get(second.id),
        changes: [expect.objectContaining({
          id: "C-02",
          field: "priority",
          origin: { proposalId: "proposal-001", changeId: "C-03" }
        })]
      })
    ]));
    expect(result.closedProposal.result?.failed).toContainEqual(expect.objectContaining({ taskId: second.id }));
    expect(vault.files.has(`TaskMate/Proposals/${result.followUp?.id}.json`)).toBe(true);
  });
});
