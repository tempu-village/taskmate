import { browser, expect } from "@wdio/globals";
import { describe, it } from "mocha";
import { openAllTab, taskListView, taskPath, taskRow, writeTask } from "../helpers";

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

  it("asks in an Obsidian modal before deleting a task, and keeps it on cancel", async function () {
    // Start without modals left open by an earlier failed test.
    await browser.executeObsidian(() => document.querySelectorAll(".modal-container").forEach((modal) => modal.remove()));
    const path = await writeTask({ id: "ui-delete" });
    await openAllTab();
    const openEditor = async () => {
      await taskRow("ui-delete").$(".taskmate-title").click();
      await browser.$(".modal .taskmate-delete-task").click();
      const confirm = browser.$(".modal .mod-warning");
      await confirm.waitForExist();
      return confirm;
    };

    await (await openEditor()).parentElement().$("button").click();
    await browser.$(".modal .mod-warning").waitForExist({ reverse: true });
    expect(await fileExists(path)).toBe(true);
    await browser.keys("Escape");

    await (await openEditor()).click();
    await browser.waitUntil(async () => !(await fileExists(taskPath("ui-delete"))));
    await taskListView().$("[data-task-id='ui-delete']").waitForExist({ reverse: true });
  });
});
