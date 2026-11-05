import { expect } from "@wdio/globals";
import { describe, it } from "mocha";
import { openAllTab } from "../helpers";

describe("TaskMate task list", function () {
  it("shows an undated vault task after switching to the All tab", async function () {
    const { view, allTab } = await openAllTab();
    await expect(allTab).toHaveAttribute("aria-selected", "true");
    await expect(view).toHaveText(expect.stringContaining("E2E sample task"));
  });
});
