import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({
  ItemView: class {},
  Modal: class {},
  Notice: class {}
}));

import { createI18n } from "../../../src/i18n";
import { applyNoticeKind, openProposalInReviewView, TaskChangeReviewView, taskChangeIndexDetails } from "../../../src/reviews/task-change/review-view";

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

  it("describes pending and history Proposals for the shared review list", () => {
    const i18n = createI18n("en");
    const summary = {
      id: "proposal-a", createdAt: "2026-10-20T09:00:00Z", taskCount: 2, changeCount: 3,
      status: "pending" as const, succeededCount: 0, failedCount: 0, followUpProposalId: null
    };

    expect(taskChangeIndexDetails(summary, i18n)).toEqual({ sortKey: "2026-10-20T09:00:00Z", lines: ["2 Tasks, 3 changes"] });
    expect(taskChangeIndexDetails({ ...summary, status: "partially-applied", resultAt: "2026-10-21T09:00:00Z", succeededCount: 2, failedCount: 1 }, i18n)).toEqual({
      sortKey: "2026-10-21T09:00:00Z",
      lines: ["Partially applied", "2 applied · 1 failed", "2 Tasks, 3 changes"]
    });
  });

  it("opens a history Proposal from the shared review list as read-only evidence", async () => {
    const view = Object.create(TaskChangeReviewView.prototype) as TaskChangeReviewView;
    const render = vi.fn().mockResolvedValue(undefined);
    Object.assign(view, {
      proposalId: null,
      proposalSource: "pending",
      state: { mode: "raw", approvedChangeIds: new Set(["C-01"]) },
      render
    });

    await view.openHistoryProposal("proposal-old");

    expect(render).toHaveBeenCalledOnce();
    expect(view).toEqual(expect.objectContaining({
      proposalId: "proposal-old",
      proposalSource: "history",
      state: { mode: "semantic", approvedChangeIds: new Set() }
    }));
  });
});
