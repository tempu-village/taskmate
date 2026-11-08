import { browser } from "@wdio/globals";

export const TASKS_FOLDER = "TaskMate/Tasks";

export interface TaskFixture {
  id: string;
  date?: string | null;
  /** Extra front matter lines, each ending with a newline, such as `time: "09:00"\n`. */
  extra?: string;
  rank?: number;
  body?: string;
}

/** Builds task Markdown that follows the task schema; omitted fields use neutral defaults. */
export function taskMarkdown({ id, date = null, extra = "", rank = 1000, body = "" }: TaskFixture): string {
  return `---
type: todo
id: "${id}"
completed: false
date: ${date === null ? "null" : `"${date}"`}
${extra}priority: null
labels: []
project: null
rank: ${rank}
created-at: "2026-11-02T09:00:00+09:00"
updated-at: "2026-11-02T09:00:00+09:00"
completed-at: null
---

# ${id}
${body}`;
}

export const taskPath = (id: string) => `${TASKS_FOLDER}/${id}.md`;

/** Creates or overwrites a vault file, and any missing parent folders, through the Obsidian vault API so TaskMate sees the change. */
export async function writeVaultFile(path: string, content: string): Promise<void> {
  await browser.executeObsidian(async ({ app }, path, content) => {
    const parts = path.split("/").slice(0, -1);
    for (let i = 1; i <= parts.length; i++) {
      const folder = parts.slice(0, i).join("/");
      if (!app.vault.getFolderByPath(folder)) await app.vault.createFolder(folder);
    }
    const file = app.vault.getFileByPath(path);
    if (file) await app.vault.modify(file, content);
    else await app.vault.create(path, content);
  }, path, content);
}

export async function writeTask(fixture: TaskFixture): Promise<string> {
  const path = taskPath(fixture.id);
  await writeVaultFile(path, taskMarkdown(fixture));
  return path;
}

export function readVaultFile(path: string): Promise<string> {
  return browser.executeObsidian(({ app }, path) => app.vault.adapter.read(path), path);
}

/** Checks the file on disk, so it also sees hidden folders such as `.trash`. */
export function vaultFileExists(path: string): Promise<boolean> {
  return browser.executeObsidian(({ app }, path) => app.vault.adapter.exists(path), path);
}

/** Sets Obsidian's Deleted files setting. Tests never use "system", which would fill the host's trash. */
export function setTrashOption(option: "local" | "none"): Promise<void> {
  return browser.executeObsidian(({ app }, option) => app.vault.setConfig("trashOption", option), option);
}

/** Writes a pending Proposal that changes the Task's priority from null to 1, and returns its path. */
export async function writePriorityProposal(proposalId: string, taskId: string, taskFile: string): Promise<string> {
  const before = await readVaultFile(taskFile);
  const after = before.replace("priority: null", "priority: 1");
  const beforeSha256 = await browser.execute(async (before) => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(before));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }, before);
  const proposal = {
    schemaVersion: 1, id: proposalId, status: "pending", createdAt: "2026-11-02T00:00:00.000Z",
    tasks: [{ taskId, path: taskFile, title: taskId, beforeMarkdown: before, afterMarkdown: after, beforeSha256,
      changes: [{ id: "C-01", field: "priority", before: null, after: 1, reason: "E2E" }] }]
  };
  const path = `TaskMate/Proposals/${proposalId}.json`;
  await writeVaultFile(path, JSON.stringify(proposal));
  return path;
}

/** Closes modals left open, for example by an earlier failed test. */
export function closeModals(): Promise<void> {
  return browser.executeObsidian(() => document.querySelectorAll(".modal-container").forEach((modal) => modal.remove()));
}

export const taskListView = () => browser.$(".workspace-leaf-content[data-type='taskmate-list']");

/** Opens the TaskMate list and selects the All tab by position, independent of the UI language. */
export async function openAllTab() {
  await browser.executeObsidianCommand("taskmate:open-todo-list");
  const view = taskListView();
  await view.waitForExist();
  // Tabs are Scheduled, All, Undated.
  const allTab = view.$$(".taskmate-smart-views [role='tab']")[1];
  await allTab.click();
  await browser.waitUntil(async () => (await allTab.getAttribute("aria-selected")) === "true");
  return { view, allTab };
}

export const taskRow = (id: string) => taskListView().$(`[data-task-id='${id}']`);

export function taskRowIds(prefix = ""): Promise<string[]> {
  return taskListView()
    .$$(`[data-task-id^='${prefix}']`)
    .map((row) => row.getAttribute("data-task-id"));
}
