import { browser, expect } from "@wdio/globals";
import { describe, it } from "mocha";
import { openAllTab, readVaultFile, taskListView, taskRow, taskRowIds, writeTask } from "../helpers";

describe("TaskMate schedule", function () {
  it("disables time and repeat with a hint while the task has no date", async function () {
    const { view } = await openAllTab();
    await view.$(".taskmate-add").click();
    const modal = browser.$(".modal");
    await expect(modal.$("input[type='time']")).toBeDisabled();
    await expect(modal.$(".taskmate-repeat-setting select")).toBeDisabled();
    await expect(modal.$(".taskmate-schedule-hint")).toBeDisplayed();
    await browser.keys("Escape");
  });

  it("advances date and deadline by a week and reopens Steps when a weekly task is completed", async function () {
    const path = await writeTask({
      id: "weekly",
      date: "2026-11-20",
      extra: 'deadline: "2026-11-22"\nrepeat: "weekly"\n',
      body: "\n## Steps\n\n- [x] Step one\n"
    });
    await openAllTab();
    const checkbox = taskRow("weekly").$("input[type='checkbox']");
    await checkbox.waitForExist();
    await checkbox.click();

    await browser.waitUntil(async () => (await readVaultFile(path)).includes('date: "2026-11-27"'));
    const text = await readVaultFile(path);
    expect(text).toContain('deadline: "2026-11-29"');
    expect(text).toContain("completed: false");
    expect(text).toContain("- [ ] Step one");
  });

  it("orders same-day tasks untimed first, then by time, in date sort", async function () {
    await writeTask({ id: "sort-a", date: "2026-11-20", extra: 'time: "09:00"\n', rank: 100 });
    await writeTask({ id: "sort-b", date: "2026-11-20", rank: 300 });
    await writeTask({ id: "sort-c", date: "2026-11-20", extra: 'time: "08:00"\n', rank: 200 });
    await openAllTab();
    // Sort options are Manual, Date, Priority, Created; select by position so the test ignores the UI language.
    await taskListView().$$(".taskmate-sort-options button")[1].click();

    const expected = ["sort-b", "sort-c", "sort-a"];
    await browser.waitUntil(async () => JSON.stringify(await taskRowIds("sort-")) === JSON.stringify(expected));
    expect(await taskRowIds("sort-")).toEqual(expected);
  });
});
