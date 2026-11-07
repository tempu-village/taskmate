import { browser, expect } from "@wdio/globals";
import { describe, it } from "mocha";
import { openAllTab, readVaultFile, taskListView, taskMarkdown, taskPath, taskRow, writeTask, writeVaultFile } from "../helpers";

// TaskMate overrides some Obsidian defaults with higher-specificity selectors instead of !important.
// These checks read the computed style in the real app, where Obsidian's own rules compete.
function computed(selector: string, properties: string[]): Promise<Record<string, string>> {
  return browser.execute((selector, properties) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Missing ${selector}`);
    const style = getComputedStyle(element);
    return Object.fromEntries(properties.map((name) => [name, style.getPropertyValue(name)]));
  }, selector, properties);
}

const fileExists = (path: string) => browser.executeObsidian(({ app }, path) => app.vault.getFileByPath(path) !== null, path);
const adapterExists = (path: string) => browser.executeObsidian(({ app }, path) => app.vault.adapter.exists(path), path);
const closeModals = () => browser.executeObsidian(() => document.querySelectorAll(".modal-container").forEach((modal) => modal.remove()));

/** Waits for TaskMate's confirm modal and returns its warning button. The Cancel button is its first sibling. */
async function confirmButton() {
  const confirm = browser.$(".modal .mod-warning");
  await confirm.waitForExist();
  return confirm;
}

async function cancelConfirm() {
  await (await confirmButton()).parentElement().$("button").click();
  await browser.$(".modal .taskmate-modal-actions .mod-warning").waitForExist({ reverse: true });
}

interface ListViewInternals {
  selection: { start(ids: string[]): void };
  requestRender(): void;
  openLabelManager(): Promise<void>;
}

/** Runs what an Adjust menu item does. Obsidian's Menu does not open from WebDriver clicks in the E2E window. */
function runListView(action: "select" | "labels", ids: string[] = []) {
  return browser.executeObsidian(async ({ app }, action, ids) => {
    const view = app.workspace.getLeavesOfType("taskmate-list")[0].view as unknown as ListViewInternals;
    if (action === "labels") return view.openLabelManager();
    view.selection.start(ids);
    view.requestRender();
  }, action, ids);
}

describe("TaskMate in the Obsidian UI", function () {
  it("keeps the list padding and plain task titles against Obsidian's view and button styles", async function () {
    await writeTask({ id: "ui-title" });
    await openAllTab();
    await taskRow("ui-title").waitForExist();

    expect(await computed(".view-content.taskmate-view", ["padding-top", "padding-left"]))
      .toEqual({ "padding-top": "0px", "padding-left": "0px" });

    const title = "[data-task-id='ui-title'] .taskmate-title";
    await browser.$(title).moveTo();
    expect(await computed(title, ["border-top-left-radius", "box-shadow"]))
      .toEqual({ "border-top-left-radius": "0px", "box-shadow": "none" });
  });

  it("shows the Label input and Steps without Obsidian's input and button chrome", async function () {
    await writeTask({ id: "ui-editor", body: "\n## Steps\n\n- [ ] First step\n" });
    await openAllTab();
    await taskRow("ui-editor").$(".taskmate-title").click();
    const input = browser.$(".modal .taskmate-label-chip-input");
    await input.waitForExist();
    await input.click();

    expect(await computed(".modal .taskmate-label-chip-input", ["border-top-width", "background-color", "box-shadow", "outline-style"]))
      .toEqual({ "border-top-width": "0px", "background-color": "rgba(0, 0, 0, 0)", "box-shadow": "none", "outline-style": "none" });
    expect(await computed(".modal .taskmate-step-body", ["border-top-width", "background-color", "border-top-left-radius", "box-shadow"]))
      .toEqual({ "border-top-width": "0px", "background-color": "rgba(0, 0, 0, 0)", "border-top-left-radius": "0px", "box-shadow": "none" });

    await browser.keys("Escape");
  });

  it("asks in an Obsidian modal before deleting a task, keeps it on cancel, and follows the trash setting", async function () {
    // Start without modals left open by an earlier failed test.
    await closeModals();
    await browser.executeObsidian(({ app }) => app.vault.setConfig("trashOption", "local"));
    const path = await writeTask({ id: "ui-delete" });
    await openAllTab();
    const openEditor = async () => {
      await taskRow("ui-delete").$(".taskmate-title").click();
      await browser.$(".modal .taskmate-delete-task").click();
      return confirmButton();
    };

    await openEditor();
    await cancelConfirm();
    expect(await fileExists(path)).toBe(true);
    await browser.keys("Escape");

    await (await openEditor()).click();
    await browser.waitUntil(async () => !(await fileExists(taskPath("ui-delete"))));
    await taskListView().$("[data-task-id='ui-delete']").waitForExist({ reverse: true });
    // FileManager.trashFile honours "Deleted files: Move to Obsidian trash".
    await browser.waitUntil(() => adapterExists(".trash/ui-delete.md"));
  });

  it("asks before deleting selected tasks", async function () {
    await closeModals();
    const paths = [await writeTask({ id: "ui-bulk-a" }), await writeTask({ id: "ui-bulk-b" })];
    await openAllTab();
    await taskRow("ui-bulk-a").waitForExist();
    await runListView("select", ["ui-bulk-a", "ui-bulk-b"]);
    const toolbar = taskListView().$(".taskmate-selection-toolbar");
    await toolbar.waitForExist();
    for (const id of ["ui-bulk-a", "ui-bulk-b"]) await taskRow(id).$(".taskmate-title").click();
    const remove = toolbar.$(".mod-warning");
    await browser.waitUntil(async () => remove.isEnabled());

    await remove.click();
    await cancelConfirm();
    for (const path of paths) expect(await fileExists(path)).toBe(true);

    await remove.click();
    await (await confirmButton()).click();
    await browser.waitUntil(async () => !(await fileExists(paths[0])) && !(await fileExists(paths[1])));
  });

  it("asks before deleting a label from Manage labels", async function () {
    await closeModals();
    const path = taskPath("ui-label");
    await writeVaultFile(path, taskMarkdown({ id: "ui-label" }).replace("labels: []", 'labels: ["ui-only-label"]'));
    await openAllTab();
    await taskRow("ui-label").waitForExist();
    const openDelete = async () => {
      await runListView("labels");
      const remove = browser.$(".modal .taskmate-label-manager-delete[aria-label*='ui-only-label']");
      await remove.click();
      return confirmButton();
    };

    await openDelete();
    await cancelConfirm();
    expect(await readVaultFile(path)).toContain("ui-only-label");
    await closeModals();

    await (await openDelete()).click();
    await browser.waitUntil(async () => !(await readVaultFile(path)).includes("ui-only-label"));
  });

  it("pads the Proposal review and asks before rejecting it", async function () {
    await closeModals();
    const taskFile = await writeTask({ id: "ui-review" });
    const proposalPath = "TaskMate/Proposals/proposal-ui-review.json";
    await browser.executeObsidian(async ({ app }, taskFile, proposalPath) => {
      const before = await app.vault.adapter.read(taskFile);
      const after = before.replace("priority: null", "priority: 1");
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(before));
      const beforeSha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const proposal = {
        schemaVersion: 1, id: "proposal-ui-review", status: "pending", createdAt: "2026-11-02T00:00:00.000Z",
        tasks: [{ taskId: "ui-review", path: taskFile, title: "ui-review", beforeMarkdown: before, afterMarkdown: after, beforeSha256,
          changes: [{ id: "C-01", field: "priority", before: null, after: 1, reason: "E2E" }] }]
      };
      if (!app.vault.getFolderByPath("TaskMate/Proposals")) await app.vault.createFolder("TaskMate/Proposals");
      await app.vault.create(proposalPath, JSON.stringify(proposal));
    }, taskFile, proposalPath);
    await browser.executeObsidian(async ({ plugins }) => {
      await (plugins.taskmate as unknown as { openProposalReview(id: string): Promise<void> }).openProposalReview("proposal-ui-review");
    });
    const reject = browser.$(".taskmate-review .taskmate-review-reject");
    await reject.waitForExist();

    expect(await computed(".taskmate-review", ["padding-top", "padding-left"]))
      .toEqual({ "padding-top": "16px", "padding-left": "16px" });

    await reject.click();
    await cancelConfirm();
    expect(await fileExists(proposalPath)).toBe(true);

    await reject.click();
    await (await confirmButton()).click();
    await browser.waitUntil(async () => !(await fileExists(proposalPath)));
  });

  it("asks before deleting a project and keeps its tasks", async function () {
    await closeModals();
    const projectPath = "TaskMate/Projects/ui-project--e2e.md";
    await browser.executeObsidian(async ({ app }) => {
      if (!app.vault.getFolderByPath("TaskMate/Projects")) await app.vault.createFolder("TaskMate/Projects");
    });
    await writeVaultFile(projectPath, `---
type: taskmate-project
id: "ui-project"
name: "ui-project"
created-at: "2026-11-02T09:00:00+09:00"
updated-at: "2026-11-02T09:00:00+09:00"
last-used-at: "2026-11-02T09:00:00+09:00"
---
`);
    const taskFile = taskPath("ui-project-task");
    await writeVaultFile(taskFile, taskMarkdown({ id: "ui-project-task" }).replace("project: null", 'project: "ui-project"'));
    await openAllTab();
    // Navigation is Date, Search, Projects.
    await taskListView().$$(".taskmate-navigation button")[2].click();
    const openDelete = async () => {
      const row = taskListView().$(".taskmate-project-row*=ui-project");
      await row.waitForExist();
      await row.$(".taskmate-project-edit").click();
      await taskListView().$(".taskmate-project-editor .mod-warning").click();
      return confirmButton();
    };

    await openDelete();
    await cancelConfirm();
    expect(await fileExists(projectPath)).toBe(true);
    await taskListView().$$(".taskmate-navigation button")[2].click();

    await (await openDelete()).click();
    await browser.waitUntil(async () => !(await fileExists(projectPath)));
    await browser.waitUntil(async () => (await readVaultFile(taskFile)).includes("project: null"));
    await taskListView().$$(".taskmate-navigation button")[0].click();
  });

  it("does not commit a label while the IME is composing, including Safari's Enter with keyCode 229", async function () {
    await closeModals();
    await writeTask({ id: "ui-ime" });
    await openAllTab();
    await taskRow("ui-ime").$(".taskmate-title").click();
    const input = browser.$(".modal .taskmate-label-chip-input");
    await input.waitForExist();
    const chips = () => browser.execute(() => [...document.querySelectorAll(".modal [data-taskmate-label-chip]")].map((chip) => chip.textContent?.trim() ?? ""));
    const before = await chips();

    // WebDriver cannot drive a real IME, so this replays the event sequence a Japanese IME produces.
    await browser.execute(() => {
      const field = document.querySelector<HTMLInputElement>(".modal .taskmate-label-chip-input")!;
      field.focus();
      field.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
      field.value = "にほんご";
      field.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true, data: "にほんご" }));
      // Chrome reports isComposing; Safari reports the confirming Enter as keyCode 229 after composition ends.
      field.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter", isComposing: true, keyCode: 229 }));
      field.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "にほんご" }));
      field.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter", keyCode: 229 }));
    });
    expect(await chips()).toEqual(before);
    expect(await input.getValue()).toBe("にほんご");

    await input.click();
    await browser.keys("Enter");
    await browser.waitUntil(async () => (await chips()).includes("にほんご"));
    expect(await input.getValue()).toBe("");
    await browser.keys("Escape");
  });

  it("deletes permanently when Obsidian's Deleted files setting says so", async function () {
    await closeModals();
    await browser.executeObsidian(({ app }) => app.vault.setConfig("trashOption", "none"));
    const path = await writeTask({ id: "ui-delete-permanent" });
    await openAllTab();
    await taskRow("ui-delete-permanent").$(".taskmate-title").click();
    await browser.$(".modal .taskmate-delete-task").click();
    await (await confirmButton()).click();
    await browser.waitUntil(async () => !(await adapterExists(path)));
    expect(await adapterExists(".trash/ui-delete-permanent.md")).toBe(false);
    await browser.executeObsidian(({ app }) => app.vault.setConfig("trashOption", "local"));
  });

  it("asks for confirmation inside a popout window", async function () {
    await closeModals();
    const path = await writeTask({ id: "ui-popout" });
    const mainWindow = await browser.getWindowHandle();
    await browser.executeObsidian(async ({ app }) => {
      const leaf = app.workspace.openPopoutLeaf();
      await leaf.setViewState({ type: "taskmate-list", active: true });
    });
    await browser.waitUntil(async () => (await browser.getWindowHandles()).length > 1);
    const popout = (await browser.getWindowHandles()).find((handle) => handle !== mainWindow)!;
    await browser.switchToWindow(popout);
    try {
      const view = browser.$(".workspace-leaf-content[data-type='taskmate-list']");
      await view.waitForExist();
      await view.$$(".taskmate-smart-views [role='tab']")[1].click();
      await view.$("[data-task-id='ui-popout'] .taskmate-title").click();
      await browser.$(".modal .taskmate-delete-task").click();
      // The confirm modal must open in the popout's own document, where the user is looking.
      await cancelConfirm();
      expect(await fileExists(path)).toBe(true);
      await browser.$(".modal .taskmate-delete-task").click();
      await (await confirmButton()).click();
      await browser.waitUntil(async () => !(await fileExists(path)));
    } finally {
      await browser.closeWindow();
      await browser.switchToWindow(mainWindow);
    }
  });
});
