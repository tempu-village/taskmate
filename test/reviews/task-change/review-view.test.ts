import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({
  ItemView: class {},
  Modal: class {},
  Notice: class {}
}));

import { applyNoticeKind, openProposalInReviewView, TaskChangeReviewView } from "../../../src/reviews/task-change/review-view";

describe("Task change review view", () => {
  it("distinguishes stale regeneration from an ordinary zero-count notice", () => {
    expect(applyNoticeKind({ succeeded: 0, failed: 2, hasFollowUp: true })).toBe("stale-regenerated");
    expect(applyNoticeKind({ succeeded: 2, failed: 0, hasFollowUp: false })).toBe("applied");
  });

  it("routes URI navigation through the working review view", async () => {
    const openProposal = vi.fn().mockResolvedValue(undefined);
    const activate = vi.fn().mockResolvedValue({ openProposal });

    await openProposalInReviewView(activate, "proposal-new", "task-new", "C-02");

    expect(activate).toHaveBeenCalledOnce();
    expect(openProposal).toHaveBeenCalledWith("proposal-new", "task-new", "C-02");
  });

  it("opens a URI-targeted Proposal in the same review view", async () => {
    const view = Object.create(TaskChangeReviewView.prototype) as TaskChangeReviewView;
    const render = vi.fn().mockResolvedValue(undefined);
    Object.assign(view, {
      proposalId: null,
      targetTaskId: null,
      targetChangeId: null,
      review: null,
      state: { mode: "raw", approvedChangeIds: new Set(["C-99"]) },
      render
    });

    await view.openProposal("proposal-new", "task-new", "C-02");

    expect(render).toHaveBeenCalledOnce();
    expect(view).toEqual(expect.objectContaining({
      proposalId: "proposal-new",
      targetTaskId: "task-new",
      targetChangeId: "C-02",
      state: { mode: "semantic", approvedChangeIds: new Set() }
    }));
  });

  it("returns an existing review view to a freshly rendered pending index", async () => {
    const view = Object.create(TaskChangeReviewView.prototype) as TaskChangeReviewView;
    const render = vi.fn().mockResolvedValue(undefined);
    Object.assign(view, {
      proposalId: "proposal-old",
      targetTaskId: "task-old",
      targetChangeId: "C-01",
      review: { proposalId: "proposal-old" },
      indexMode: "history",
      proposalSource: "history",
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
      indexMode: "pending",
      proposalSource: "pending",
      state: { mode: "semantic", approvedChangeIds: new Set() }
    }));
  });
});
