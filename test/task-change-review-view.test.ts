import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({
  ItemView: class {},
  Modal: class {},
  Notice: class {}
}));

import { TaskChangeReviewView } from "../src/task-change-review-view";

describe("Task change review view", () => {
  it("returns an existing review view to a freshly rendered pending index", async () => {
    const view = Object.create(TaskChangeReviewView.prototype) as TaskChangeReviewView;
    const render = vi.fn().mockResolvedValue(undefined);
    Object.assign(view, {
      proposalId: "proposal-old",
      targetTaskId: "task-old",
      targetChangeId: "C-01",
      review: { proposalId: "proposal-old" },
      state: { mode: "raw", approvedChangeIds: new Set(["C-01"]) },
      render
    });

    await view.openIndex();

    expect(render).toHaveBeenCalledOnce();
    expect(view).toEqual(expect.objectContaining({
      proposalId: null,
      targetTaskId: null,
      targetChangeId: null,
      review: null,
      state: { mode: "semantic", approvedChangeIds: new Set() }
    }));
  });
});
