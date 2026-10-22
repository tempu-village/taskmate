/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import { decideCandidate, markDiffViewed, parseSourceCandidateProposal, planFormalApply, recordApplication } from "../../../src/reviews/source-candidate/proposal";
import type { SourceCandidateProposal } from "../../../src/reviews/source-candidate/proposal";
import { candidateEditForm } from "../../../src/reviews/source-candidate/candidate-edit-form";
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
  fields: { title: "Title", date: "Date", priority: "Priority", labels: "Labels", project: "Project", steps: "Steps", notes: "Notes" },
  empty: "None",
  unassigned: "Unassigned",
  noPriority: "No priority",
  priorityValue: (priority) => `P${priority}`,
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
  cancel: "Cancel",
  edit: "Edit",
  editAria: (candidate) => `Edit ${candidate}`,
  finishEditFirst: "Finish editing first",
  editOperation: "Operation",
  changeReason: "Reason for the change",
  editHelp: { labels: "Comma separated", steps: "One per line", changeReason: "Needed for changes", noMergeTarget: "Restage to merge" },
  editErrors: { "required": "Enter a value", "invalid-date": "Use YYYY-MM-DD", "no-change": "Nothing would change" },
  save: "Save"
};

function render(review: SourceCandidateProposal, state: SourceReviewUiState = createSourceReviewUiState(), options: Parameters<typeof renderSourceCandidateReview>[6] = {}) {
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

function editing(review: SourceCandidateProposal, id: string, state: SourceReviewUiState = createSourceReviewUiState()): SourceReviewUiState {
  const candidate = review.candidates.find((item) => item.id === id)!;
  return reduceSourceReviewUiState(state, { type: "start-edit", candidateId: id, revision: candidate.revision, form: candidateEditForm(candidate) });
}

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
    expect(cards[0].textContent).toContain("PriorityP2");
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
    expect(order).toEqual(["Show diff", "Merge", "Hold", "Undecide", "Edit"]);
  });

  it("starts editing a candidate from its Edit button", () => {
    const review = example();
    const { container, dispatch } = render(review);

    const edit = buttons(container, "Edit SC-01")[0];
    expect([edit.textContent, edit.id]).toEqual(["Edit", "taskmate-source-candidate-edit-SC-01"]);
    edit.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "start-edit", candidateId: "SC-01", revision: review.candidates[0].revision, form: candidateEditForm(review.candidates[0]) });
  });

  it("replaces the card body with a labelled form and locks other actions while editing", () => {
    const review = example();
    const state = editing(review, "SC-01");
    const { container } = render(review, state, { projects: [{ id: "project-1", name: "Customer A" }] });

    const card = container.querySelector<HTMLElement>("#taskmate-source-candidate-SC-01")!;
    expect([card.querySelector(".taskmate-source-candidate-fields"), card.querySelector("[role=group]")]).toEqual([null, null]);
    const form = card.querySelector("form")!;
    expect(form.getAttribute("aria-label")).toBe("Edit SC-01");
    expect(Array.from(form.querySelectorAll("label")).map((label) => [label.textContent, label.htmlFor])).toEqual([
      ["Operation", "taskmate-source-edit-operation"], ["Title", "taskmate-source-edit-title"], ["Date", "taskmate-source-edit-date"],
      ["Priority", "taskmate-source-edit-priority"], ["Labels", "taskmate-source-edit-labels"], ["Project", "taskmate-source-edit-project"],
      ["Steps", "taskmate-source-edit-steps"], ["Notes", "taskmate-source-edit-notes"]
    ]);
    const operation = form.querySelector<HTMLSelectElement>("#taskmate-source-edit-operation")!;
    expect(Array.from(operation.options).map((option) => option.value)).toEqual(["create", "exclude"]);
    expect(operation.getAttribute("aria-describedby")).toBe("taskmate-source-edit-operation-help");
    expect(form.querySelector<HTMLInputElement>("#taskmate-source-edit-title")?.value).toBe("顧客Aへ修正版の契約書を送る");
    expect(form.querySelector<HTMLInputElement>("#taskmate-source-edit-date")?.type).toBe("date");
    expect(Array.from(form.querySelector<HTMLSelectElement>("#taskmate-source-edit-project")!.options).map((option) => option.textContent)).toEqual(["Unassigned", "Customer A"]);
    expect(document.activeElement).toBe(operation);
    expect(buttons(container, "Edit SC-02")[0].disabled).toBe(true);
    const apply = buttons(container, "Apply decisions…")[0];
    expect([apply.disabled, apply.title]).toEqual([true, "Finish editing first"]);
  });

  it("shows merge fields with a change reason, or only the reason when excluding", () => {
    const review = example();
    const merge = render(review, editing(review, "SC-02")).container;
    expect(Array.from(merge.querySelector<HTMLSelectElement>("#taskmate-source-edit-operation")!.options).map((option) => option.value)).toEqual(["create", "merge", "exclude"]);
    expect(merge.querySelector<HTMLTextAreaElement>("#taskmate-source-edit-steps")?.value).toBe("デモデータを準備する\n検索フィルターを確認する");
    expect(merge.querySelector("#taskmate-source-edit-reason")?.getAttribute("aria-describedby")).toBe("taskmate-source-edit-reason-help");

    const exclude = render(review, editing(review, "SC-03")).container;
    expect(Array.from(exclude.querySelectorAll("form label")).map((label) => label.textContent)).toEqual(["Operation", "Reason"]);
    expect(exclude.querySelector("#taskmate-source-edit-exclusionReason")?.getAttribute("aria-required")).toBe("true");
  });

  it("dispatches typing, operation changes, save and cancel", () => {
    const review = example();
    const { container, dispatch } = render(review, editing(review, "SC-01"));

    const title = container.querySelector<HTMLInputElement>("#taskmate-source-edit-title")!;
    title.value = "新しいタイトル";
    title.dispatchEvent(new Event("input", { bubbles: true }));
    const priority = container.querySelector<HTMLSelectElement>("#taskmate-source-edit-priority")!;
    priority.value = "3";
    priority.dispatchEvent(new Event("change", { bubbles: true }));
    const operation = container.querySelector<HTMLSelectElement>("#taskmate-source-edit-operation")!;
    operation.value = "exclude";
    operation.dispatchEvent(new Event("change", { bubbles: true }));
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    buttons(container, "Cancel")[0].click();

    expect(dispatch.mock.calls.map(([action]) => action)).toEqual([
      { type: "edit-input", field: "title", value: "新しいタイトル" },
      { type: "edit-input", field: "priority", value: "3" },
      { type: "edit-operation", operation: "exclude" },
      { type: "save-edit" },
      { type: "cancel-edit" }
    ]);
  });

  it("marks invalid fields, describes the error and focuses the first one", () => {
    const review = example();
    const state = reduceSourceReviewUiState(editing(review, "SC-01"), { type: "edit-invalid", errors: { date: "invalid-date", title: "required" } });
    const { container } = render(review, state);

    const title = container.querySelector<HTMLInputElement>("#taskmate-source-edit-title")!;
    expect([title.getAttribute("aria-invalid"), title.getAttribute("aria-describedby"), title.getAttribute("aria-required")]).toEqual(["true", "taskmate-source-edit-title-error", "true"]);
    expect(container.querySelector("#taskmate-source-edit-title-error")?.textContent).toBe("Enter a value");
    expect(container.querySelector("#taskmate-source-edit-date-error")?.textContent).toBe("Use YYYY-MM-DD");
    expect(document.activeElement).toBe(title);

    const noChange = render(review, reduceSourceReviewUiState(editing(review, "SC-02"), { type: "edit-invalid", errors: { form: "no-change" } })).container;
    const alert = noChange.querySelector<HTMLElement>("#taskmate-source-edit-form-error")!;
    expect([alert.getAttribute("role"), alert.textContent, document.activeElement === alert]).toEqual(["alert", "Nothing would change", true]);
  });

  it("keeps typed values in the edit state and returns focus to the Edit button", () => {
    const review = example();
    let state = editing(review, "SC-02");
    state = reduceSourceReviewUiState(state, { type: "edit-input", field: "date", value: "2026-10-20" });
    state = reduceSourceReviewUiState(state, { type: "edit-input", field: "reason", value: "延期" });
    expect([state.editing?.form.merge?.date, state.editing?.form.draft.date, state.editing?.form.reason]).toEqual(["2026-10-20", "", "延期"]);

    state = reduceSourceReviewUiState(state, { type: "edit-operation", operation: "create" });
    state = reduceSourceReviewUiState(state, { type: "edit-input", field: "date", value: "2026-10-21" });
    expect([state.editing?.form.merge?.date, state.editing?.form.draft.date]).toEqual(["2026-10-20", "2026-10-21"]);

    state = reduceSourceReviewUiState(state, { type: "cancel-edit" });
    expect([state.editing, state.focus]).toEqual([null, "taskmate-source-candidate-edit-SC-02"]);
    render(review, state);
    expect(document.activeElement?.id).toBe("taskmate-source-candidate-edit-SC-02");
  });

  it("closes the apply confirmation when editing starts and shows project names", () => {
    const review = example();
    review.candidates[0].taskDraft!.project = "project-1";
    const opened = reduceSourceReviewUiState(createSourceReviewUiState(), { type: "open-apply" });
    expect(editing(review, "SC-01", opened).applyOpen).toBe(false);

    const { container } = render(review, createSourceReviewUiState(), { projects: [{ id: "project-1", name: "Customer A" }] });
    expect(container.querySelector("#taskmate-source-candidate-SC-01 .taskmate-source-candidate-fields")?.textContent).toContain("ProjectCustomer A");
  });

  it("moves focus into the opened confirmation and back to its button when cancelled", () => {
    const opened = reduceSourceReviewUiState(createSourceReviewUiState(), { type: "open-apply" });
    const panel = render(example(), opened).container;
    const title = panel.querySelector<HTMLElement>("#taskmate-source-review-apply-title")!;
    expect([document.activeElement === title, title.tabIndex, panel.querySelector("footer")?.classList.contains("is-open")]).toEqual([true, -1, true]);

    const closed = render(example(), reduceSourceReviewUiState(opened, { type: "cancel-apply" })).container;
    expect([document.activeElement?.id, closed.querySelector("footer")?.classList.contains("is-open")]).toEqual(["taskmate-source-review-open-apply", false]);
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
