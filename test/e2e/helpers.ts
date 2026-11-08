import { browser } from "@wdio/globals";
import { assertSandboxPath, E2E_VAULT } from "./vault-guard";

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

/** Fails unless the open Vault is a temporary copy of the fixture. Call it in each spec's `before`. */
export async function assertSandboxVault(): Promise<void> {
  const basePath = await browser.executeObsidian(({ app }) => (app.vault.adapter as unknown as { getBasePath(): string }).getBasePath());
  assertSandboxPath(basePath, E2E_VAULT);
}

/** Creates or overwrites a vault file through the Obsidian vault API so TaskMate sees the change. */
export async function writeVaultFile(path: string, content: string): Promise<void> {
  await assertSandboxVault();
  await browser.executeObsidian(async ({ app }, path, content) => {
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
