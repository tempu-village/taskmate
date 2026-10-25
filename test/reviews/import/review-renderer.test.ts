/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import { decideCandidate, markDiffViewed, parseImportReview, planFormalApply, recordApplication } from "../../../src/reviews/import/proposal";
import type { ImportReview } from "../../../src/reviews/import/proposal";
import { candidateEditForm } from "../../../src/reviews/import/candidate-edit-form";
import { createImportReviewUiState, reduceImportReviewUiState, renderImportReview } from "../../../src/reviews/import/review-renderer";
import type { ImportReviewAction, ImportReviewCopy, ImportReviewUiState } from "../../../src/reviews/import/review-renderer";
import { NOW, exampleText } from "./fixture";

const copy: ImportReviewCopy = {
  title: "Import review",
  back: "Back",
  status: { "pending": "Pending", "ready-to-apply": "Ready", "partially-applied": "Partial", "applied": "Applied", "history": "History" },
  health: { stale: "Stale", failed: "Failed" },
  operation: { create: "Create Task", merge: "Merge into Task", exclude: "Exclude" },
  decision: { approved: "Approved", hold: "On hold", pending: "Undecided" },
  decide: { create: "Create", merge: "Merge", exclude: "Exclude", hold: "Hold", pending: "Undecide" },
  decideAria: (action, candidate) => `${action} ${candidate}`,
  decisionGroupAria: (candidate) => `Decision for ${candidate}`,
  evidenceTitle: "Evidence for this candidate",
  sourceKind: { note: "Obsidian note", conversation: "Conversation" },
  conversation: (id) => `Conversation ${id}`,
  summaryLabel: { note: "What this note says", conversation: "What this conversation says" },
  noSummary: "No summary",
  showStatements: (count) => `Show ${count} statements`,
  hideStatements: (count) => `Hide ${count} statements`,
  statementsAria: (candidate, source) => `Statements from ${source} for ${candidate}`,
  legacyFormat: "Earlier format",
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

function render(review: ImportReview, state: ImportReviewUiState = createImportReviewUiState(), options: Parameters<typeof renderImportReview>[6] = {}) {
  const container = document.createElement("div");
  document.body.replaceChildren(container);
  const dispatch = vi.fn<(action: ImportReviewAction) => void>();
  renderImportReview(container, review, planFormalApply(review), state, copy, dispatch, options);
  return { container, dispatch };
}

function buttons(container: HTMLElement, name: string): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("button")).filter((button) => button.textContent === name || button.getAttribute("aria-label") === name);
}

const example = () => parseImportReview(exampleText());

function editing(review: ImportReview, id: string, state: ImportReviewUiState = createImportReviewUiState()): ImportReviewUiState {
  const candidate = review.candidates.find((item) => item.id === id)!;
  return reduceImportReviewUiState(state, { type: "start-edit", candidateId: id, revision: candidate.revision, form: candidateEditForm(candidate) });
}

describe("Import review renderer", () => {
  it("renders one card per candidate with Sources, draft fields, merge summary and exclusion reason", () => {
    const { container } = render(example());

    const cards = Array.from(container.querySelectorAll<HTMLElement>(".taskmate-import-candidate"));
    expect(cards.map((card) => card.id)).toEqual(["taskmate-import-candidate-IC-01", "taskmate-import-candidate-IC-02", "taskmate-import-candidate-IC-03"]);
    expect(cards[0].textContent).not.toContain("佐藤さんへ契約書の修正版を今日中に送る。");
    expect(cards[0].textContent).toContain("Notes/2026-10-17 顧客定例.md");
    expect(cards[0].textContent).toContain("顧客Aの佐藤さんへ、修正版の契約書を今日中に送る必要がある。");
    expect(cards[0].querySelector(".taskmate-import-candidate-steps")?.textContent).toContain("修正版PDFを最終確認する");
    expect(cards[1].textContent).toContain("Conversation conversation-20261017-01");
    expect(cards[1].textContent).toContain("Merge into 明日のデモを準備する");
    expect(cards[1].textContent).toContain("デモデータを準備する → デモデータを準備する, 検索フィルターを確認する");
    expect(cards[2].textContent).toContain("Reason: 候補日時であり、利用者が実行する独立した行動ではない");
    expect(cards[0].textContent).toContain("PriorityP2");
    expect(container.querySelector(".taskmate-import-review-summary")?.textContent).toBe("import-review-20261017T101500-demo · Ready");
  });

  it("offers operation-specific decisions with pressed state and candidate-specific names", () => {
    const { container, dispatch } = render(decideCandidate(example(), "IC-03", "hold", NOW));

    const group = container.querySelector<HTMLElement>("#taskmate-import-candidate-IC-03 [role=group]");
    expect(group?.getAttribute("aria-label")).toBe("Decision for IC-03");
    const choices = Array.from(group!.querySelectorAll("button"));
    expect(choices.map((button) => [button.textContent, button.getAttribute("aria-pressed"), button.getAttribute("aria-label")])).toEqual([
      ["Exclude", "false", "Exclude IC-03"], ["Hold", "true", "Hold IC-03"], ["Undecide", "false", "Undecide IC-03"]
    ]);
    buttons(container, "Merge IC-02")[0].click();
    expect(dispatch).toHaveBeenCalledWith({ type: "decide", candidateId: "IC-02", decision: "approved" });
  });

  it("expands a merge diff inside its card on request", () => {
    const collapsed = render(example());
    const toggle = buttons(collapsed.container, "Show diff")[0];
    expect([toggle.getAttribute("aria-expanded"), collapsed.container.querySelector(".taskmate-review-diff")]).toEqual(["false", null]);
    toggle.click();
    expect(collapsed.dispatch).toHaveBeenCalledWith({ type: "toggle-diff", candidateId: "IC-02" });

    const expanded = render(example(), reduceImportReviewUiState(createImportReviewUiState(), { type: "toggle-diff", candidateId: "IC-02" }));
    const hide = buttons(expanded.container, "Hide diff")[0];
    const diff = expanded.container.querySelector<HTMLElement>(".taskmate-review-diff");
    expect([hide.getAttribute("aria-expanded"), hide.getAttribute("aria-controls"), diff?.id]).toEqual(["true", "taskmate-import-candidate-diff-IC-02", "taskmate-import-candidate-diff-IC-02"]);
    expect(diff?.getAttribute("aria-label")).toBe("Diff for IC-02");
    expect(diff?.textContent).toContain("+- [ ] 検索フィルターを確認する");
  });

  it("requires an unchecked-by-default acknowledgement for unviewed merges before confirming", () => {
    const opened = reduceImportReviewUiState(createImportReviewUiState(), { type: "open-apply" });
    const { container, dispatch } = render(example(), opened);

    expect(container.querySelector(".taskmate-import-review-apply-panel")?.textContent).toContain("1 create, 1 merge, 1 exclude");
    expect(container.querySelector(".taskmate-import-review-unviewed")?.textContent).toBe("IC-02: 明日のデモを準備する");
    const checkbox = container.querySelector<HTMLInputElement>(".taskmate-import-review-acknowledge input")!;
    const confirm = buttons(container, "Apply")[0];
    expect([checkbox.checked, confirm.disabled]).toEqual([false, true]);
    confirm.click();
    confirm.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(dispatch).not.toHaveBeenCalled();
    checkbox.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "set-acknowledged", acknowledged: true });

    const acknowledged = render(example(), reduceImportReviewUiState(opened, { type: "set-acknowledged", acknowledged: true }));
    const enabled = buttons(acknowledged.container, "Apply")[0];
    expect(enabled.disabled).toBe(false);
    enabled.click();
    expect(acknowledged.dispatch).toHaveBeenCalledWith({ type: "confirm-apply" });
  });

  it("skips the acknowledgement once merges are viewed and lists blocked candidates", () => {
    const review = decideCandidate(markDiffViewed(example(), "IC-02", NOW), "IC-03", "hold", NOW);
    const { container } = render(review, reduceImportReviewUiState(createImportReviewUiState(), { type: "open-apply" }));

    expect(container.querySelector(".taskmate-import-review-acknowledge")).toBeNull();
    expect(container.querySelector(".taskmate-import-review-blocked")?.textContent).toBe("IC-03: on hold");
    expect(buttons(container, "Apply")[0].disabled).toBe(false);
  });

  it("disables apply when nothing is approved and hides controls for applied candidates and history", () => {
    let review = example();
    for (const id of ["IC-01", "IC-02", "IC-03"]) review = decideCandidate(review, id, "pending", NOW);
    expect(buttons(render(review).container, "Apply decisions…")[0].disabled).toBe(true);

    const applied = recordApplication(example(), "IC-01", { kind: "applied", promotedTaskId: "55555555-5555-4555-8555-555555555555" }, NOW);
    const appliedCard = render(applied).container.querySelector("#taskmate-import-candidate-IC-01")!;
    expect([appliedCard.querySelector("[role=group]"), appliedCard.querySelector(".taskmate-import-candidate-status")?.textContent]).toEqual([null, "Applied"]);

    const readOnly = render(example(), createImportReviewUiState(), { readOnly: true }).container;
    expect([readOnly.querySelectorAll("[role=group]").length, readOnly.querySelector("footer")]).toEqual([0, null]);
  });

  it("keeps a natural keyboard order within each card", () => {
    const { container } = render(example());

    const order = Array.from(container.querySelector("#taskmate-import-candidate-IC-02")!.querySelectorAll("button")).map((button) => button.textContent);
    expect(order).toEqual(["Show diff", "Merge", "Hold", "Undecide", "Edit", "Show 1 statements"]);
  });

  it("puts the Task first and the evidence last, naming each Source once with its summary", () => {
    const review = example();
    const candidate = review.candidates[0];
    candidate.sourceRefs = [
      { sourceId: "SRC-01", statement: "佐藤さんへ契約書の修正版を今日中に送る。" },
      { sourceId: "SRC-02", statement: "デモ環境の検索フィルターを明日確認する。" },
      { sourceId: "SRC-01", statement: "二つ目の引用。" }
    ];
    candidate.sourceSummaries = [{ sourceId: "SRC-01", summary: "契約書を送る。" }, { sourceId: "SRC-02", summary: "会話の要約。" }];
    const { container } = render(review);
    const card = container.querySelector<HTMLElement>("#taskmate-import-candidate-IC-01")!;

    const children = Array.from(card.children).map((child) => child.className);
    expect(children.indexOf("taskmate-import-candidate-fields")).toBeLessThan(children.indexOf("taskmate-import-candidate-actions"));
    expect(children.at(-1)).toBe("taskmate-import-candidate-evidence");
    const sources = Array.from(card.querySelectorAll<HTMLElement>(".taskmate-import-evidence-source"));
    expect(sources.map((source) => source.dataset.sourceId)).toEqual(["SRC-01", "SRC-02"]);
    expect(card.textContent?.split("Notes/2026-10-17 顧客定例.md").length).toBe(2);
    expect(sources.map((source) => [
      source.querySelector(".taskmate-import-evidence-kind")?.textContent,
      source.querySelector(".taskmate-import-evidence-summary-label")?.textContent,
      source.querySelector(".taskmate-import-evidence-summary")?.textContent,
      source.querySelector("button")?.textContent
    ])).toEqual([
      ["Obsidian note", "What this note says", "契約書を送る。", "Show 2 statements"],
      ["Conversation", "What this conversation says", "会話の要約。", "Show 1 statements"]
    ]);
    expect(card.querySelector(".taskmate-import-candidate-statement")).toBeNull();
    expect(card.querySelector("h3")?.textContent).toBe("顧客Aへ修正版の契約書を送る");
  });

  it("expands one Source's exact statements in order and keeps focus on its toggle", () => {
    const review = example();
    review.candidates[0].sourceRefs.push({ sourceId: "SRC-01", statement: "二つ目の引用。" });
    const collapsed = render(review);
    const toggle = buttons(collapsed.container, "Show 2 statements")[0];
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    toggle.click();
    expect(collapsed.dispatch).toHaveBeenCalledWith({ type: "toggle-evidence", candidateId: "IC-01", sourceId: "SRC-01" });

    const state = reduceImportReviewUiState(createImportReviewUiState(), { type: "toggle-evidence", candidateId: "IC-01", sourceId: "SRC-01" });
    const expanded = render(review, state);
    const hide = buttons(expanded.container, "Hide 2 statements")[0];
    const list = expanded.container.querySelector<HTMLElement>(`[id="${hide.getAttribute("aria-controls")}"]`)!;
    expect([hide.getAttribute("aria-expanded"), document.activeElement]).toEqual(["true", hide]);
    expect(Array.from(list.querySelectorAll("blockquote")).map((quote) => quote.textContent)).toEqual(["佐藤さんへ契約書の修正版を今日中に送る。", "二つ目の引用。"]);
    expect(list.getAttribute("aria-label")).toBe("Statements from Notes/2026-10-17 顧客定例.md for IC-01");
    expect(expanded.container.querySelector("#taskmate-import-candidate-IC-01 .taskmate-import-evidence-summary")?.textContent).toBe("顧客Aの佐藤さんへ、修正版の契約書を今日中に送る必要がある。");
    expect(reduceImportReviewUiState(state, { type: "toggle-evidence", candidateId: "IC-01", sourceId: "SRC-01" }).expandedEvidence.size).toBe(0);
  });

  it("marks earlier formats and explains their missing summaries", () => {
    const review = example();
    const legacy = JSON.parse(JSON.stringify(review).replaceAll("import-review-", "source-review-").replaceAll("\"IC-", "\"SC-"));
    legacy.reviewType = "source-candidate";
    legacy.schemaVersion = 1;
    delete legacy.contentLanguage;
    delete legacy.languageSource;
    for (const candidate of legacy.candidates) delete candidate.sourceSummaries;
    const { container } = render(parseImportReview(JSON.stringify(legacy)));

    expect(container.querySelector(".taskmate-import-review-legacy")?.textContent).toBe("Earlier format");
    expect(container.querySelector("#taskmate-import-candidate-SC-01 .taskmate-import-evidence-summary")?.textContent).toBe("No summary");
    expect(render(review).container.querySelector(".taskmate-import-review-legacy")).toBeNull();
  });

  it("starts editing a candidate from its Edit button", () => {
    const review = example();
    const { container, dispatch } = render(review);

    const edit = buttons(container, "Edit IC-01")[0];
    expect([edit.textContent, edit.id]).toEqual(["Edit", "taskmate-import-candidate-edit-IC-01"]);
    edit.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "start-edit", candidateId: "IC-01", revision: review.candidates[0].revision, form: candidateEditForm(review.candidates[0]) });
  });

  it("replaces the card body with a labelled form and locks other actions while editing", () => {
    const review = example();
    const state = editing(review, "IC-01");
    const { container } = render(review, state, { projects: [{ id: "project-1", name: "Customer A" }] });

    const card = container.querySelector<HTMLElement>("#taskmate-import-candidate-IC-01")!;
    expect([card.querySelector(".taskmate-import-candidate-fields"), card.querySelector("[role=group]")]).toEqual([null, null]);
    const form = card.querySelector("form")!;
    expect(form.getAttribute("aria-label")).toBe("Edit IC-01");
    expect(Array.from(form.querySelectorAll("label")).map((label) => [label.textContent, label.htmlFor])).toEqual([
      ["Operation", "taskmate-import-edit-operation"], ["Title", "taskmate-import-edit-title"], ["Date", "taskmate-import-edit-date"],
      ["Priority", "taskmate-import-edit-priority"], ["Labels", "taskmate-import-edit-labels"], ["Project", "taskmate-import-edit-project"],
      ["Steps", "taskmate-import-edit-steps"], ["Notes", "taskmate-import-edit-notes"]
    ]);
    const operation = form.querySelector<HTMLSelectElement>("#taskmate-import-edit-operation")!;
    expect(Array.from(operation.options).map((option) => option.value)).toEqual(["create", "exclude"]);
    expect(operation.getAttribute("aria-describedby")).toBe("taskmate-import-edit-operation-help");
    expect(form.querySelector<HTMLInputElement>("#taskmate-import-edit-title")?.value).toBe("顧客Aへ修正版の契約書を送る");
    expect(form.querySelector<HTMLInputElement>("#taskmate-import-edit-date")?.type).toBe("date");
    expect(Array.from(form.querySelector<HTMLSelectElement>("#taskmate-import-edit-project")!.options).map((option) => option.textContent)).toEqual(["Unassigned", "Customer A"]);
    expect(document.activeElement).toBe(operation);
    expect(buttons(container, "Edit IC-02")[0].disabled).toBe(true);
    const apply = buttons(container, "Apply decisions…")[0];
    expect([apply.disabled, apply.title]).toEqual([true, "Finish editing first"]);
  });

  it("shows merge fields with a change reason, or only the reason when excluding", () => {
    const review = example();
    const merge = render(review, editing(review, "IC-02")).container;
    expect(Array.from(merge.querySelector<HTMLSelectElement>("#taskmate-import-edit-operation")!.options).map((option) => option.value)).toEqual(["create", "merge", "exclude"]);
    expect(merge.querySelector<HTMLTextAreaElement>("#taskmate-import-edit-steps")?.value).toBe("デモデータを準備する\n検索フィルターを確認する");
    expect(merge.querySelector("#taskmate-import-edit-reason")?.getAttribute("aria-describedby")).toBe("taskmate-import-edit-reason-help");

    const exclude = render(review, editing(review, "IC-03")).container;
    expect(Array.from(exclude.querySelectorAll("form label")).map((label) => label.textContent)).toEqual(["Operation", "Reason"]);
    expect(exclude.querySelector("#taskmate-import-edit-exclusionReason")?.getAttribute("aria-required")).toBe("true");
  });

  it("dispatches typing, operation changes, save and cancel", () => {
    const review = example();
    const { container, dispatch } = render(review, editing(review, "IC-01"));

    const title = container.querySelector<HTMLInputElement>("#taskmate-import-edit-title")!;
    title.value = "新しいタイトル";
    title.dispatchEvent(new Event("input", { bubbles: true }));
    const priority = container.querySelector<HTMLSelectElement>("#taskmate-import-edit-priority")!;
    priority.value = "3";
    priority.dispatchEvent(new Event("change", { bubbles: true }));
    const operation = container.querySelector<HTMLSelectElement>("#taskmate-import-edit-operation")!;
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
    const state = reduceImportReviewUiState(editing(review, "IC-01"), { type: "edit-invalid", errors: { date: "invalid-date", title: "required" } });
    const { container } = render(review, state);

    const title = container.querySelector<HTMLInputElement>("#taskmate-import-edit-title")!;
    expect([title.getAttribute("aria-invalid"), title.getAttribute("aria-describedby"), title.getAttribute("aria-required")]).toEqual(["true", "taskmate-import-edit-title-error", "true"]);
    expect(container.querySelector("#taskmate-import-edit-title-error")?.textContent).toBe("Enter a value");
    expect(container.querySelector("#taskmate-import-edit-date-error")?.textContent).toBe("Use YYYY-MM-DD");
    expect(document.activeElement).toBe(title);

    const noChange = render(review, reduceImportReviewUiState(editing(review, "IC-02"), { type: "edit-invalid", errors: { form: "no-change" } })).container;
    const alert = noChange.querySelector<HTMLElement>("#taskmate-import-edit-form-error")!;
    expect([alert.getAttribute("role"), alert.textContent, document.activeElement === alert]).toEqual(["alert", "Nothing would change", true]);
  });

  it("keeps typed values in the edit state and returns focus to the Edit button", () => {
    const review = example();
    let state = editing(review, "IC-02");
    state = reduceImportReviewUiState(state, { type: "edit-input", field: "date", value: "2026-10-20" });
    state = reduceImportReviewUiState(state, { type: "edit-input", field: "reason", value: "延期" });
    expect([state.editing?.form.merge?.date, state.editing?.form.draft.date, state.editing?.form.reason]).toEqual(["2026-10-20", "", "延期"]);

    state = reduceImportReviewUiState(state, { type: "edit-operation", operation: "create" });
    state = reduceImportReviewUiState(state, { type: "edit-input", field: "date", value: "2026-10-21" });
    expect([state.editing?.form.merge?.date, state.editing?.form.draft.date]).toEqual(["2026-10-20", "2026-10-21"]);

    state = reduceImportReviewUiState(state, { type: "cancel-edit" });
    expect([state.editing, state.focus]).toEqual([null, "taskmate-import-candidate-edit-IC-02"]);
    render(review, state);
    expect(document.activeElement?.id).toBe("taskmate-import-candidate-edit-IC-02");
  });

  it("closes the apply confirmation when editing starts and shows project names", () => {
    const review = example();
    review.candidates[0].taskDraft!.project = "project-1";
    const opened = reduceImportReviewUiState(createImportReviewUiState(), { type: "open-apply" });
    expect(editing(review, "IC-01", opened).applyOpen).toBe(false);

    const { container } = render(review, createImportReviewUiState(), { projects: [{ id: "project-1", name: "Customer A" }] });
    expect(container.querySelector("#taskmate-import-candidate-IC-01 .taskmate-import-candidate-fields")?.textContent).toContain("ProjectCustomer A");
  });

  it("moves focus into the opened confirmation and back to its button when cancelled", () => {
    const opened = reduceImportReviewUiState(createImportReviewUiState(), { type: "open-apply" });
    const panel = render(example(), opened).container;
    const title = panel.querySelector<HTMLElement>("#taskmate-import-review-apply-title")!;
    expect([document.activeElement === title, title.tabIndex, panel.querySelector("footer")?.classList.contains("is-open")]).toEqual([true, -1, true]);

    const closed = render(example(), reduceImportReviewUiState(opened, { type: "cancel-apply" })).container;
    expect([document.activeElement?.id, closed.querySelector("footer")?.classList.contains("is-open")]).toEqual(["taskmate-import-review-open-apply", false]);
  });

  it("resets the acknowledgement whenever the apply panel opens or closes", () => {
    let state = reduceImportReviewUiState(createImportReviewUiState(), { type: "open-apply" });
    state = reduceImportReviewUiState(state, { type: "set-acknowledged", acknowledged: true });
    state = reduceImportReviewUiState(state, { type: "cancel-apply" });
    expect([state.applyOpen, state.acknowledged]).toEqual([false, false]);
    state = reduceImportReviewUiState(state, { type: "open-apply" });
    expect([state.applyOpen, state.acknowledged]).toEqual([true, false]);
    expect(reduceImportReviewUiState({ ...createImportReviewUiState(), acknowledged: true }, { type: "open-apply" }).acknowledged).toBe(false);
  });
});
