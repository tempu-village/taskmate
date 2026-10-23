/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import type { ReviewCatalogEntry, ReviewReference } from "../../../src/reviews/shared/review-catalog";
import { buildReviewIndex, renderNoOpenReview, renderReviewIndex } from "../../../src/reviews/shared/review-index";
import type { ReviewIndexCopy, ReviewIndexDetails } from "../../../src/reviews/shared/review-index";

const copy: ReviewIndexCopy = {
  title: "Reviews",
  location: { pending: "Pending", history: "History" },
  empty: { pending: "No pending reviews", history: "No review history" },
  kind: { "task-change": "Task changes", "source-candidate": "Source candidates" },
  openAria: (kind, id) => `Open ${kind} review ${id}`,
  invalidTitle: "Files that could not be read",
  invalidReason: {
    "unreadable-json": "not JSON", "unknown-type": "unknown type", "unsupported-version": "unsupported version",
    "mismatched-id": "mismatched ID", "unreadable-review": "unreadable review"
  }
};

const ref = (kind: ReviewReference["kind"], id: string): ReviewReference => ({ kind, id, location: "pending", path: `TaskMate/Proposals/${id}.json` });
const entries: ReviewCatalogEntry[] = [
  { type: "review", ref: ref("task-change", "proposal-old") },
  { type: "invalid", path: "TaskMate/Proposals/zz.json", location: "pending", reason: "unknown-type" },
  { type: "review", ref: ref("source-candidate", "source-review-new") },
  { type: "review", ref: ref("task-change", "proposal-unreadable") }
];
const details: Record<string, ReviewIndexDetails> = {
  "proposal-old": { sortKey: "2026-10-20T09:00:00Z", lines: ["2 Tasks, 3 changes"] },
  "source-review-new": { sortKey: "2026-10-22T09:00:00Z", lines: ["Pending", "3 candidates, 0 applied"] }
};

describe("shared review index", () => {
  it("lists every kind newest first and keeps files its Module cannot read visible as unreadable", () => {
    expect(buildReviewIndex(entries, (value) => details[value.id] ?? null)).toEqual([
      { type: "review", ref: ref("source-candidate", "source-review-new"), details: details["source-review-new"] },
      { type: "review", ref: ref("task-change", "proposal-old"), details: details["proposal-old"] },
      { type: "invalid", path: "TaskMate/Proposals/proposal-unreadable.json", reason: "unreadable-review" },
      { type: "invalid", path: "TaskMate/Proposals/zz.json", reason: "unknown-type" }
    ]);
  });

  it("renders kind-labelled entries that open their review, and the unreadable files apart", () => {
    const container = document.createElement("div");
    const actions = { open: vi.fn(), showLocation: vi.fn() };
    renderReviewIndex(container, buildReviewIndex(entries, (value) => details[value.id] ?? null), "pending", copy, actions);

    expect(container.querySelector("h2")?.textContent).toBe("Reviews");
    const items = Array.from(container.querySelectorAll<HTMLButtonElement>(".taskmate-review-index-item"));
    expect(items.map((item) => [item.getAttribute("aria-label"), item.querySelector(".taskmate-review-index-kind")?.textContent, Array.from(item.querySelectorAll(".taskmate-review-index-summary")).map((line) => line.textContent)])).toEqual([
      ["Open Source candidates review source-review-new", "Source candidates", ["Pending", "3 candidates, 0 applied"]],
      ["Open Task changes review proposal-old", "Task changes", ["2 Tasks, 3 changes"]]
    ]);
    items[1].click();
    expect(actions.open).toHaveBeenCalledWith(ref("task-change", "proposal-old"));

    const invalid = container.querySelector<HTMLElement>(".taskmate-review-index-invalid")!;
    expect(invalid.getAttribute("aria-labelledby")).toBe("taskmate-review-index-invalid-title");
    expect(Array.from(invalid.querySelectorAll("li")).map((item) => item.textContent)).toEqual([
      "TaskMate/Proposals/proposal-unreadable.json: unreadable review", "TaskMate/Proposals/zz.json: unknown type"
    ]);
    expect(invalid.querySelectorAll("button")).toHaveLength(0);
  });

  it("switches between Pending and History and shows an empty state", () => {
    const container = document.createElement("div");
    const actions = { open: vi.fn(), showLocation: vi.fn() };
    renderReviewIndex(container, [], "history", copy, actions);

    const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>(".taskmate-review-index-tabs button"));
    expect(tabs.map((tab) => [tab.textContent, tab.getAttribute("aria-pressed")])).toEqual([["Pending", "false"], ["History", "true"]]);
    expect(container.querySelector(".taskmate-empty")?.textContent).toBe("No review history");
    expect(container.querySelector(".taskmate-review-index-invalid")).toBeNull();
    tabs[0].click();
    expect(actions.showLocation).toHaveBeenCalledWith("pending");
  });

  it("offers the review list when a review view has nothing open", () => {
    const container = document.createElement("div");
    const onClick = vi.fn();
    renderNoOpenReview(container, "No review is open.", { label: "Open reviews", onClick });

    expect(container.textContent).toBe("No review is open.Open reviews");
    container.querySelector("button")!.click();
    expect(onClick).toHaveBeenCalledOnce();
  });
});
