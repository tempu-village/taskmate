import { browser, expect } from "@wdio/globals";
import { describe, it } from "mocha";

describe("TaskMate task list", function () {
  it("shows an undated vault task after switching to the All tab", async function () {
    await browser.executeObsidianCommand("taskmate:open-todo-list");

    const view = browser.$(".workspace-leaf-content[data-type='taskmate-list']");
    await expect(view).toExist();

    // Tabs are Scheduled, All, Undated; select by position so the test ignores the UI language.
    const allTab = view.$$(".taskmate-smart-views [role='tab']")[1];
    await allTab.click();
    await expect(allTab).toHaveAttribute("aria-selected", "true");
    await expect(view).toHaveText(expect.stringContaining("E2E sample task"));
  });
});
