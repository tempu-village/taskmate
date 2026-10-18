import { structuredPatch } from "diff";
import type { FormalApplyPlan, SourceCandidate, SourceCandidateProposal } from "./proposal";

type Operation = SourceCandidate["operation"];
type Decision = SourceCandidate["decision"];
type BlockReason = FormalApplyPlan["blocked"][number]["reason"];

export interface SourceReviewUiState {
  expandedDiffs: ReadonlySet<string>;
  applyOpen: boolean;
  acknowledged: boolean;
}

export interface SourceReviewCopy {
  title: string;
  back: string;
  status: Record<SourceCandidateProposal["status"], string>;
  health: Record<"stale" | "failed", string>;
  operation: Record<Operation, string>;
  decision: Record<Decision, string>;
  decide: Record<Operation | "hold" | "pending", string>;
  decideAria: (action: string, candidateId: string) => string;
  decisionGroupAria: (candidateId: string) => string;
  sources: string;
  conversation: (id: string) => string;
  fields: Record<"date" | "priority" | "labels" | "project" | "steps" | "notes", string>;
  empty: string;
  mergeTarget: (title: string) => string;
  showDiff: string;
  hideDiff: string;
  diffAria: (candidateId: string) => string;
  exclusionReason: string;
  applied: string;
  openApply: string;
  applyTitle: string;
  applyCounts: (counts: Record<Operation, number>) => string;
  nothingToApply: string;
  blockedTitle: string;
  blocked: Record<BlockReason, string>;
  unviewedTitle: string;
  acknowledge: (count: number) => string;
  confirm: string;
  cancel: string;
}

export type SourceReviewAction =
  | { type: "decide"; candidateId: string; decision: Decision }
  | { type: "toggle-diff"; candidateId: string }
  | { type: "open-apply" }
  | { type: "cancel-apply" }
  | { type: "set-acknowledged"; acknowledged: boolean }
  | { type: "confirm-apply" };

export function createSourceReviewUiState(): SourceReviewUiState {
  return { expandedDiffs: new Set(), applyOpen: false, acknowledged: false };
}

export function reduceSourceReviewUiState(state: SourceReviewUiState, action: SourceReviewAction): SourceReviewUiState {
  switch (action.type) {
    case "toggle-diff": {
      const expandedDiffs = new Set(state.expandedDiffs);
      if (expandedDiffs.has(action.candidateId)) expandedDiffs.delete(action.candidateId);
      else expandedDiffs.add(action.candidateId);
      return { ...state, expandedDiffs };
    }
    case "open-apply": return { ...state, applyOpen: true, acknowledged: false };
    case "cancel-apply": return { ...state, applyOpen: false, acknowledged: false };
    case "set-acknowledged": return { ...state, acknowledged: action.acknowledged };
    default: return state;
  }
}

export function renderSourceCandidateReview(
  container: HTMLElement,
  review: SourceCandidateProposal,
  plan: FormalApplyPlan,
  state: SourceReviewUiState,
  copy: SourceReviewCopy,
  dispatch: (action: SourceReviewAction) => void,
  options: { readOnly?: boolean; onBack?: () => void } = {}
): void {
  container.replaceChildren();
  container.classList.add("taskmate-review", "taskmate-source-review");
  const header = element("header", "taskmate-review-header", container);
  text(header, "h2", copy.title);
  if (options.onBack) {
    const back = button(copy.back, options.onBack);
    back.classList.add("taskmate-review-back");
    header.append(back);
  }
  const summary = element("p", "taskmate-source-review-summary", container);
  summary.textContent = [review.reviewId, copy.status[review.status], review.health === "ok" ? "" : copy.health[review.health]].filter(Boolean).join(" · ");

  const list = element("div", "taskmate-review-files", container);
  for (const candidate of review.candidates) renderCard(list, review, candidate, state, copy, dispatch, Boolean(options.readOnly));

  if (!options.readOnly) renderApply(container, plan, state, copy, dispatch);
}

function renderCard(
  parent: HTMLElement,
  review: SourceCandidateProposal,
  candidate: SourceCandidate,
  state: SourceReviewUiState,
  copy: SourceReviewCopy,
  dispatch: (action: SourceReviewAction) => void,
  readOnly: boolean
): void {
  const card = element("section", "taskmate-review-file taskmate-source-candidate", parent);
  card.id = `taskmate-source-candidate-${candidate.id}`;
  card.dataset.operation = candidate.operation;
  const head = element("div", "taskmate-review-file-header", card);
  const identity = element("div", "taskmate-review-file-identity", head);
  text(identity, "span", candidate.id, "taskmate-review-id");
  text(identity, "span", copy.operation[candidate.operation], "taskmate-source-candidate-operation");
  text(identity, "h3", candidate.title);

  const status = element("p", "taskmate-source-candidate-status", card);
  const applied = candidate.application.status === "applied";
  status.textContent = [
    applied ? copy.applied : copy.decision[candidate.decision],
    candidate.health === "ok" ? "" : `${copy.health[candidate.health]}${candidate.healthReason ? `: ${candidate.healthReason}` : ""}`
  ].filter(Boolean).join(" · ");
  if (candidate.health !== "ok") status.classList.add(`is-${candidate.health}`);

  const sources = element("div", "taskmate-source-candidate-sources", card);
  text(sources, "h4", copy.sources);
  for (const ref of candidate.sourceRefs) {
    const source = review.sources.find((item) => item.id === ref.sourceId);
    const label = !source ? ref.sourceId : source.type === "note" ? source.path : copy.conversation(source.localSourceId);
    const quote = element("blockquote", "taskmate-source-candidate-statement", sources);
    text(quote, "cite", `${ref.sourceId} · ${label}`);
    text(quote, "p", ref.statement);
  }

  if (candidate.operation === "create") renderDraft(card, candidate.taskDraft, copy);
  else if (candidate.operation === "merge") renderMerge(card, candidate, state, copy, dispatch);
  else {
    const reason = element("p", "taskmate-source-candidate-reason", card);
    text(reason, "strong", `${copy.exclusionReason}: `);
    reason.append(candidate.exclusionReason);
  }

  if (!readOnly && !applied) {
    const decisions = element("div", "taskmate-source-candidate-decisions", card);
    decisions.setAttribute("role", "group");
    decisions.setAttribute("aria-label", copy.decisionGroupAria(candidate.id));
    const choices: Array<[Decision, string]> = [["approved", copy.decide[candidate.operation]], ["hold", copy.decide.hold], ["pending", copy.decide.pending]];
    for (const [decision, label] of choices) {
      const pressed = candidate.decision === decision;
      const choice = button(label, () => dispatch({ type: "decide", candidateId: candidate.id, decision }), pressed);
      choice.setAttribute("aria-pressed", String(pressed));
      choice.setAttribute("aria-label", copy.decideAria(label, candidate.id));
      decisions.append(choice);
    }
  }
}

function renderDraft(card: HTMLElement, draft: Extract<SourceCandidate, { operation: "create" }>["taskDraft"], copy: SourceReviewCopy): void {
  const fields = element("dl", "taskmate-source-candidate-fields", card);
  const rows: Array<[keyof SourceReviewCopy["fields"], string]> = [
    ["date", draft.date ?? copy.empty],
    ["priority", draft.priority === null ? copy.empty : String(draft.priority)],
    ["labels", draft.labels.length ? draft.labels.join(", ") : copy.empty],
    ["project", draft.project ?? copy.empty],
    ["notes", draft.notes || copy.empty]
  ];
  for (const [field, value] of rows) {
    text(fields, "dt", copy.fields[field]);
    text(fields, "dd", value);
  }
  if (draft.steps.length > 0) {
    text(fields, "dt", copy.fields.steps);
    const steps = element("dd", "", fields);
    const listEl = element("ul", "taskmate-source-candidate-steps", steps);
    for (const step of draft.steps) text(listEl, "li", step.date ? `${step.text} (${step.date})` : step.text);
  }
}

function renderMerge(
  card: HTMLElement,
  candidate: Extract<SourceCandidate, { operation: "merge" }>,
  state: SourceReviewUiState,
  copy: SourceReviewCopy,
  dispatch: (action: SourceReviewAction) => void
): void {
  const target = candidate.mergeTarget;
  const block = element("div", "taskmate-source-candidate-merge", card);
  text(block, "p", copy.mergeTarget(target.title), "taskmate-source-candidate-target");
  for (const change of target.changes) {
    const row = element("div", "taskmate-review-change is-read-only", block);
    text(row, "strong", change.field);
    const details = element("span", "taskmate-review-change-details", row);
    text(details, "span", `${formatValue(change.before)} → ${formatValue(change.after)}`, "taskmate-review-values");
    text(details, "span", change.reason, "taskmate-review-reason");
  }
  const expanded = state.expandedDiffs.has(candidate.id);
  const diffId = `taskmate-source-candidate-diff-${candidate.id}`;
  const toggle = button(expanded ? copy.hideDiff : copy.showDiff, () => dispatch({ type: "toggle-diff", candidateId: candidate.id }));
  toggle.classList.add("taskmate-source-candidate-diff-toggle");
  toggle.setAttribute("aria-expanded", String(expanded));
  toggle.setAttribute("aria-controls", diffId);
  block.append(toggle);
  if (!expanded) return;
  const diff = element("pre", "taskmate-review-diff", block);
  diff.id = diffId;
  diff.setAttribute("aria-label", copy.diffAria(candidate.id));
  const patch = structuredPatch(target.path, target.path, target.beforeMarkdown, target.afterMarkdown, "before", "after", { context: 3 });
  for (const hunk of patch.hunks) {
    text(diff, "span", `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n`, "taskmate-diff-header");
    for (const line of hunk.lines) {
      text(diff, "span", `${line}\n`, line.startsWith("+") ? "taskmate-diff-add" : line.startsWith("-") ? "taskmate-diff-delete" : "taskmate-diff-context");
    }
  }
}

function renderApply(
  container: HTMLElement,
  plan: FormalApplyPlan,
  state: SourceReviewUiState,
  copy: SourceReviewCopy,
  dispatch: (action: SourceReviewAction) => void
): void {
  const footer = element("footer", "taskmate-review-footer taskmate-source-review-apply", container);
  if (!state.applyOpen) {
    const open = button(copy.openApply, () => dispatch({ type: "open-apply" }));
    open.classList.add("mod-cta");
    open.disabled = plan.eligible.length === 0;
    if (open.disabled) open.title = copy.nothingToApply;
    footer.append(open);
    return;
  }
  const panel = element("section", "taskmate-source-review-apply-panel", footer);
  panel.setAttribute("aria-labelledby", "taskmate-source-review-apply-title");
  text(panel, "h3", copy.applyTitle).id = "taskmate-source-review-apply-title";
  text(panel, "p", copy.applyCounts(plan.counts));
  if (plan.blocked.length > 0) {
    text(panel, "h4", copy.blockedTitle);
    const blocked = element("ul", "taskmate-source-review-blocked", panel);
    for (const item of plan.blocked) text(blocked, "li", `${item.candidateId}: ${copy.blocked[item.reason]}`);
  }
  if (plan.requiresAcknowledgement) {
    text(panel, "h4", copy.unviewedTitle);
    const unviewed = element("ul", "taskmate-source-review-unviewed", panel);
    for (const item of plan.unviewedMerges) text(unviewed, "li", `${item.candidateId}: ${item.targetTitle}`);
    const label = element("label", "taskmate-source-review-acknowledge", panel);
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.acknowledged;
    checkbox.addEventListener("change", () => dispatch({ type: "set-acknowledged", acknowledged: checkbox.checked }));
    label.append(checkbox, document.createTextNode(copy.acknowledge(plan.unviewedMerges.length)));
  }
  const actions = element("div", "taskmate-source-review-apply-actions", panel);
  const confirm = button(copy.confirm, () => dispatch({ type: "confirm-apply" }));
  confirm.classList.add("mod-cta");
  confirm.disabled = plan.eligible.length === 0 || (plan.requiresAcknowledgement && !state.acknowledged);
  const cancel = button(copy.cancel, () => dispatch({ type: "cancel-apply" }));
  actions.append(confirm, cancel);
}

function element<Tag extends keyof HTMLElementTagNameMap>(tag: Tag, className: string, parent?: HTMLElement): HTMLElementTagNameMap[Tag] {
  const value = document.createElement(tag);
  if (className) value.className = className;
  parent?.append(value);
  return value;
}

function text(parent: HTMLElement, tag: keyof HTMLElementTagNameMap, content: string, className?: string): HTMLElement {
  const value = element(tag, className ?? "", parent);
  value.textContent = content;
  return value;
}

function button(label: string, activate: () => void, active = false): HTMLButtonElement {
  const value = document.createElement("button");
  value.type = "button";
  value.textContent = label;
  if (active) value.classList.add("is-active");
  value.addEventListener("click", activate);
  return value;
}

function formatValue(value: unknown): string {
  if (value === null) return "—";
  if (Array.isArray(value)) return value.map((item) => typeof item === "object" && item && "text" in item ? String((item as { text: unknown }).text) : String(item)).join(", ") || "—";
  return String(value);
}
