/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import { renderTaskChangeReview } from "../../../src/reviews/task-change/review-renderer";
import type { ProposalReview } from "../../../src/reviews/task-change/proposal";

const review: ProposalReview = {
  proposalId: "proposal-001",
  status: "pending",
  tasks: [{
    taskId: "task-uuid",
    path: "TaskMate/Tasks/Example.md",
    title: "Example",
    beforeMarkdown: "date: old\n",
    afterMarkdown: "date: new\n",
    beforeSha256: "a".repeat(64),
    changes: [{ id: "C-01", field: "date", before: "old", after: "new", reason: "Reschedule" }],
    rawHunks: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ["-date: old", "+date: new"] }]
  }]
};

const copy = {
  title: "Review changes",
  summaryTitle: "What this plan changes",
  apply: "Approve and apply selected changes",
  reject: "Reject",
  selectAll: "Select all changes in every Task",
  selectAllShort: "Select all",
  selectTask: "Select all",
  clearAll: "Clear all changes in every Task",
  clearAllShort: "Clear all",
  clearTask: "Clear all",
  semantic: "Items",
  semanticAria: "Item comparison",
  markdown: "Full text",
  markdownAria: "Full-text comparison",
  comparisonAria: "Comparison view",
  noSelection: "Select at least one change"
};

describe("Task change review renderer", () => {
  it("renders stable IDs and dispatches approval without writing files", () => {
    const container = document.createElement("div");
    const dispatch = vi.fn();
    renderTaskChangeReview(container, review, { mode: "semantic", approvedChangeIds: new Set(["C-01"]) }, copy, dispatch);

    expect(container.textContent).not.toContain("T-01");
    expect(container.textContent).toContain("C-01");
    expect(container.textContent).toContain("Reschedule");
    container.querySelector<HTMLButtonElement>(".taskmate-review-apply")?.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "apply", approvedChangeIds: ["C-01"] });
  });

  it("shows a back action for an editable pending Proposal", () => {
    const container = document.createElement("div");
    const back = vi.fn();
    renderTaskChangeReview(container, review, { mode: "semantic", approvedChangeIds: new Set() }, copy, vi.fn(), { back: { label: "Back", onClick: back } });

    container.querySelector<HTMLButtonElement>(".taskmate-review-back")?.click();
    expect(back).toHaveBeenCalledOnce();
    expect(container.querySelector(".taskmate-review-footer")).not.toBeNull();
  });

  it("switches to raw Markdown hunks derived by the review model", () => {
    const container = document.createElement("div");
    renderTaskChangeReview(container, review, { mode: "raw", approvedChangeIds: new Set() }, copy, vi.fn());

    expect(container.textContent).toContain("date: old");
    expect(container.textContent).toContain("date: new");
    expect(container.querySelector(".taskmate-diff-delete")).not.toBeNull();
    expect(container.querySelector(".taskmate-diff-add")).not.toBeNull();
  });

  it("hides Task-level bulk actions for one change and shows both actions for multiple changes", () => {
    const single = document.createElement("div");
    renderTaskChangeReview(single, review, { mode: "semantic", approvedChangeIds: new Set() }, copy, vi.fn());
    expect(single.querySelector(".taskmate-review-file-header button")).toBeNull();
    expect(single.querySelector(".taskmate-review-controls")?.textContent).toContain("Select all changes in every Task");
    expect(single.querySelector(".taskmate-review-controls")?.textContent).toContain("Clear all changes in every Task");
    expect(single.querySelector(".taskmate-review-display-switch")?.getAttribute("role")).toBe("group");
    expect(single.querySelector<HTMLButtonElement>(".taskmate-review-mode-semantic")?.getAttribute("aria-label")).toBe("Item comparison");
    expect(single.querySelector<HTMLButtonElement>(".taskmate-review-mode-semantic")?.getAttribute("aria-pressed")).toBe("true");

    const multiple = document.createElement("div");
    const multipleReview: ProposalReview = {
      ...review,
      tasks: [{
        ...review.tasks[0],
        changes: [
          ...review.tasks[0].changes,
          { id: "C-02", field: "notes", before: "old", after: "new", reason: "Clarify" }
        ]
      }]
    };
    renderTaskChangeReview(multiple, multipleReview, { mode: "semantic", approvedChangeIds: new Set() }, copy, vi.fn());
    const taskButtons = multiple.querySelectorAll<HTMLButtonElement>(".taskmate-review-file-header button");
    expect(Array.from(taskButtons, (item) => item.textContent)).toEqual([
      "Select all",
      "Clear all"
    ]);
    expect(multiple.querySelector(".taskmate-review-file-actions")?.children).toHaveLength(2);
  });

  it("keeps select and clear actions visible and disables only the unavailable operation", () => {
    const multipleReview: ProposalReview = {
      ...review,
      tasks: [{
        ...review.tasks[0],
        changes: [
          ...review.tasks[0].changes,
          { id: "C-02", field: "notes", before: "old", after: "new", reason: "Clarify" }
        ]
      }]
    };

    for (const [approved, selectDisabled, clearDisabled] of [
      [new Set<string>(), false, true],
      [new Set(["C-01"]), false, false],
      [new Set(["C-01", "C-02"]), true, false]
    ] as const) {
      const container = document.createElement("div");
      renderTaskChangeReview(container, multipleReview, { mode: "semantic", approvedChangeIds: approved }, copy, vi.fn());
      expect(container.querySelector<HTMLButtonElement>(".taskmate-review-select-all")?.disabled).toBe(selectDisabled);
      expect(container.querySelector<HTMLButtonElement>(".taskmate-review-clear-all")?.disabled).toBe(clearDisabled);
      expect(container.querySelector<HTMLButtonElement>(".taskmate-review-select-task")?.disabled).toBe(selectDisabled);
      expect(container.querySelector<HTMLButtonElement>(".taskmate-review-clear-task")?.disabled).toBe(clearDisabled);
    }
  });

  it("renders compact always-open Task sections without index, path, or counts", () => {
    const container = document.createElement("div");
    renderTaskChangeReview(container, review, { mode: "semantic", approvedChangeIds: new Set() }, copy, vi.fn());

    expect(container.querySelector("[data-review-anchor='task-uuid']")).not.toBeNull();
    expect(container.querySelector("[data-review-anchor='C-01']")).not.toBeNull();
    expect(container.querySelector(".taskmate-review-file-list")).toBeNull();
    expect(container.querySelector("details")).toBeNull();
    expect(container.textContent).not.toContain(review.tasks[0].path);
    expect(container.textContent).not.toContain("1 change");
  });

  it("renders Proposal history as read-only while preserving both diff modes", () => {
    const container = document.createElement("div");
    const back = vi.fn();
    renderTaskChangeReview(container, review, { mode: "semantic", approvedChangeIds: new Set() }, copy, vi.fn(), { readOnly: true, back: { label: "Back", onClick: back } });

    expect(container.querySelector(".taskmate-review-selection-actions")).toBeNull();
    expect(container.querySelector(".taskmate-review-change input")).toBeNull();
    expect(container.querySelector(".taskmate-review-footer")).toBeNull();
    expect(container.querySelector(".taskmate-review-display-switch")).not.toBeNull();
    container.querySelector<HTMLButtonElement>(".taskmate-review-back")?.click();
    expect(back).toHaveBeenCalledOnce();
  });

  it("shows Task Pilot's summary and per-Task lines above the changes", () => {
    const container = document.createElement("div");
    const described: ProposalReview = {
      ...review,
      summary: "Move the report and keep the rest.",
      tasks: [{ ...review.tasks[0], summary: "Moved to the new date." }]
    };
    renderTaskChangeReview(container, described, { mode: "semantic", approvedChangeIds: new Set() }, copy, vi.fn());

    const summary = container.querySelector(".taskmate-review-summary");
    expect(summary?.querySelector("h3")?.textContent).toBe("What this plan changes");
    expect(summary?.textContent).toContain("Move the report and keep the rest.");
    expect(summary?.querySelector(".taskmate-review-summary-line")?.textContent).toBe("Moved to the new date.");
    expect(summary?.compareDocumentPosition(container.querySelector(".taskmate-review-files")!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(container.querySelector(".taskmate-review-file .taskmate-review-task-summary")?.textContent).toBe("Moved to the new date.");
    expect(container.querySelector(".taskmate-review-file-header")?.textContent).toBe("Example");

    const section = container.querySelector<HTMLElement>("[data-review-anchor='task-uuid']")!;
    section.scrollIntoView = vi.fn();
    container.querySelector<HTMLButtonElement>(".taskmate-review-summary-jump")?.click();
    expect(section.scrollIntoView).toHaveBeenCalledWith({ block: "start" });
  });

  it("shows a Proposal without summaries as before", () => {
    const container = document.createElement("div");
    renderTaskChangeReview(container, review, { mode: "semantic", approvedChangeIds: new Set() }, copy, vi.fn());

    expect(container.querySelector(".taskmate-review-summary")).toBeNull();
    expect(container.querySelector(".taskmate-review-task-summary")).toBeNull();
  });
});
