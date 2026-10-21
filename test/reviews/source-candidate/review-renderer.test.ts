/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import { decideCandidate, markDiffViewed, parseSourceCandidateProposal, planFormalApply, recordApplication } from "../../../src/reviews/source-candidate/proposal";
import type { SourceCandidateProposal } from "../../../src/reviews/source-candidate/proposal";
import { createSourceReviewUiState, reduceSourceReviewUiState, renderSourceCandidateReview } from "../../../src/reviews/source-candidate/review-renderer";
import type { SourceReviewAction, SourceReviewCopy, SourceReviewUiState } from "../../../src/reviews/source-candidate/review-renderer";
import { NOW, exampleText } from "./fixture";

const copy: SourceReviewCopy = {
  title: "Review Source candidates",
  back: "Back",
  status: { "pending": "Pending", "ready-to-apply": "Ready", "partially-applied": "Partial", "applied": "Applied", "history": "History" },
  health: { stale: "Stale", failed: "Failed" },
  operation: { create: "Create Task", merge: "Merge into Task", exclude: "Exclude" },
  decision: { approved: "Approved", hold: "On hold", pending: "Undecided" },
  decide: { create: "Create", merge: "Merge", exclude: "Exclude", hold: "Hold", pending: "Undecide" },
  decideAria: (action, candidate) => `${action} ${candidate}`,
  decisionGroupAria: (candidate) => `Decision for ${candidate}`,
  sources: "Sources",
  conversation: (id) => `Conversation ${id}`,
  fields: { date: "Date", priority: "Priority", labels: "Labels", project: "Project", steps: "Steps", notes: "Notes" },
  empty: "None",
  mergeTarget: (title) => `Merge into ${title}`,
  showDiff: "Show diff",
  hideDiff: "Hide diff",
  diffAria: (candidate) => `Diff for ${candidate}`,
  exclusionReason: "Reason",
  applied: "Applied",
  openApply: "Apply decisions…",
  applyTitle: "Apply approved candidates",
  applyCounts: (counts) => `${counts.create} create, ${counts.merge} merge, ${counts.exclude} exclude`,
  nothingToApply: "Approve at least one candidate first",
  blockedTitle: "Not applied now",
  blocked: { "stale": "changed", "held": "on hold", "undecided": "undecided", "outdated-decision": "edited" },
  unviewedTitle: "Unviewed merges",
  acknowledge: (count) => `Apply ${count} merges without viewing their diffs`,
  confirm: "Apply",
  cancel: "Cancel"
};

function render(review: SourceCandidateProposal, state: SourceReviewUiState = createSourceReviewUiState(), options = {}) {
  const container = document.createElement("div");
  document.body.replaceChildren(container);
  const dispatch = vi.fn<(action: SourceReviewAction) => void>();
  renderSourceCandidateReview(container, review, planFormalApply(review), state, copy, dispatch, options);
  return { container, dispatch };
}

function buttons(container: HTMLElement, name: string): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("button")).filter((button) => button.textContent === name || button.getAttribute("aria-label") === name);
}

const example = () => parseSourceCandidateProposal(exampleText());

describe("Source candidate review renderer", () => {
  it("renders one card per candidate with Sources, draft fields, merge summary and exclusion reason", () => {
    const { container } = render(example());

    const cards = Array.from(container.querySelectorAll<HTMLElement>(".taskmate-source-candidate"));
    expect(cards.map((card) => card.id)).toEqual(["taskmate-source-candidate-SC-01", "taskmate-source-candidate-SC-02", "taskmate-source-candidate-SC-03"]);
    expect(cards[0].textContent).toContain("佐藤さんへ契約書の修正版を今日中に送る。");
    expect(cards[0].textContent).toContain("Notes/2026-10-17 顧客定例.md");
    expect(cards[0].querySelector(".taskmate-source-candidate-steps")?.textContent).toContain("修正版PDFを最終確認する");
    expect(cards[1].textContent).toContain("Conversation conversation-20261017-01");
    expect(cards[1].textContent).toContain("Merge into 明日のデモを準備する");
    expect(cards[1].textContent).toContain("デモデータを準備する → デモデータを準備する, 検索フィルターを確認する");
    expect(cards[2].textContent).toContain("Reason: 候補日時であり、利用者が実行する独立した行動ではない");
    expect(container.querySelector(".taskmate-source-review-summary")?.textContent).toBe("source-review-20261017T101500-demo · Ready");
  });

  it("offers operation-specific decisions with pressed state and candidate-specific names", () => {
    const { container, dispatch } = render(decideCandidate(example(), "SC-03", "hold", NOW));

    const group = container.querySelector<HTMLElement>("#taskmate-source-candidate-SC-03 [role=group]");
    expect(group?.getAttribute("aria-label")).toBe("Decision for SC-03");
    const choices = Array.from(group!.querySelectorAll("button"));
    expect(choices.map((button) => [button.textContent, button.getAttribute("aria-pressed"), button.getAttribute("aria-label")])).toEqual([
      ["Exclude", "false", "Exclude SC-03"], ["Hold", "true", "Hold SC-03"], ["Undecide", "false", "Undecide SC-03"]
    ]);
    buttons(container, "Merge SC-02")[0].click();
    expect(dispatch).toHaveBeenCalledWith({ type: "decide", candidateId: "SC-02", decision: "approved" });
  });

  it("expands a merge diff inside its card on request", () => {
    const collapsed = render(example());
    const toggle = buttons(collapsed.container, "Show diff")[0];
    expect([toggle.getAttribute("aria-expanded"), collapsed.container.querySelector(".taskmate-review-diff")]).toEqual(["false", null]);
    toggle.click();
    expect(collapsed.dispatch).toHaveBeenCalledWith({ type: "toggle-diff", candidateId: "SC-02" });

    const expanded = render(example(), reduceSourceReviewUiState(createSourceReviewUiState(), { type: "toggle-diff", candidateId: "SC-02" }));
    const hide = buttons(expanded.container, "Hide diff")[0];
    const diff = expanded.container.querySelector<HTMLElement>(".taskmate-review-diff");
    expect([hide.getAttribute("aria-expanded"), hide.getAttribute("aria-controls"), diff?.id]).toEqual(["true", "taskmate-source-candidate-diff-SC-02", "taskmate-source-candidate-diff-SC-02"]);
    expect(diff?.getAttribute("aria-label")).toBe("Diff for SC-02");
    expect(diff?.textContent).toContain("+- [ ] 検索フィルターを確認する");
  });

  it("requires an unchecked-by-default acknowledgement for unviewed merges before confirming", () => {
    const opened = reduceSourceReviewUiState(createSourceReviewUiState(), { type: "open-apply" });
    const { container, dispatch } = render(example(), opened);

    expect(container.querySelector(".taskmate-source-review-apply-panel")?.textContent).toContain("1 create, 1 merge, 1 exclude");
    expect(container.querySelector(".taskmate-source-review-unviewed")?.textContent).toBe("SC-02: 明日のデモを準備する");
    const checkbox = container.querySelector<HTMLInputElement>(".taskmate-source-review-acknowledge input")!;
    const confirm = buttons(container, "Apply")[0];
    expect([checkbox.checked, confirm.disabled]).toEqual([false, true]);
    confirm.click();
    confirm.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(dispatch).not.toHaveBeenCalled();
    checkbox.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "set-acknowledged", acknowledged: true });

    const acknowledged = render(example(), reduceSourceReviewUiState(opened, { type: "set-acknowledged", acknowledged: true }));
    const enabled = buttons(acknowledged.container, "Apply")[0];
    expect(enabled.disabled).toBe(false);
    enabled.click();
    expect(acknowledged.dispatch).toHaveBeenCalledWith({ type: "confirm-apply" });
  });

  it("skips the acknowledgement once merges are viewed and lists blocked candidates", () => {
    const review = decideCandidate(markDiffViewed(example(), "SC-02", NOW), "SC-03", "hold", NOW);
    const { container } = render(review, reduceSourceReviewUiState(createSourceReviewUiState(), { type: "open-apply" }));

    expect(container.querySelector(".taskmate-source-review-acknowledge")).toBeNull();
    expect(container.querySelector(".taskmate-source-review-blocked")?.textContent).toBe("SC-03: on hold");
    expect(buttons(container, "Apply")[0].disabled).toBe(false);
  });

  it("disables apply when nothing is approved and hides controls for applied candidates and history", () => {
    let review = example();
    for (const id of ["SC-01", "SC-02", "SC-03"]) review = decideCandidate(review, id, "pending", NOW);
    expect(buttons(render(review).container, "Apply decisions…")[0].disabled).toBe(true);

    const applied = recordApplication(example(), "SC-01", { kind: "applied", promotedTaskId: "55555555-5555-4555-8555-555555555555" }, NOW);
    const appliedCard = render(applied).container.querySelector("#taskmate-source-candidate-SC-01")!;
    expect([appliedCard.querySelector("[role=group]"), appliedCard.querySelector(".taskmate-source-candidate-status")?.textContent]).toEqual([null, "Applied"]);

    const readOnly = render(example(), createSourceReviewUiState(), { readOnly: true }).container;
    expect([readOnly.querySelectorAll("[role=group]").length, readOnly.querySelector("footer")]).toEqual([0, null]);
  });

  it("keeps a natural keyboard order within each card", () => {
    const { container } = render(example());

    const order = Array.from(container.querySelector("#taskmate-source-candidate-SC-02")!.querySelectorAll("button")).map((button) => button.textContent);
    expect(order).toEqual(["Show diff", "Merge", "Hold", "Undecide"]);
  });

  it("resets the acknowledgement whenever the apply panel opens or closes", () => {
    let state = reduceSourceReviewUiState(createSourceReviewUiState(), { type: "open-apply" });
    state = reduceSourceReviewUiState(state, { type: "set-acknowledged", acknowledged: true });
    state = reduceSourceReviewUiState(state, { type: "cancel-apply" });
    expect([state.applyOpen, state.acknowledged]).toEqual([false, false]);
    state = reduceSourceReviewUiState(state, { type: "open-apply" });
    expect([state.applyOpen, state.acknowledged]).toEqual([true, false]);
    expect(reduceSourceReviewUiState({ ...createSourceReviewUiState(), acknowledged: true }, { type: "open-apply" }).acknowledged).toBe(false);
  });
});
