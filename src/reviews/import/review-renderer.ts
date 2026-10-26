import { structuredPatch } from "diff";
import { CANDIDATE_EDIT_FIELDS, candidateEditForm } from "./candidate-edit-form";
import type { CandidateEditError, CandidateEditErrors, CandidateEditField, CandidateEditForm } from "./candidate-edit-form";
import { candidateEvidence, importReviewFormat } from "./proposal";
import type { FormalApplyPlan, ImportCandidate, ImportReview } from "./proposal";

type Operation = ImportCandidate["operation"];
type Decision = ImportCandidate["decision"];
type BlockReason = FormalApplyPlan["blocked"][number]["reason"];

export interface CandidateEditState {
  candidateId: string;
  // The candidate revision the form started from; saving is refused if the candidate changed meanwhile.
  revision: number;
  form: CandidateEditForm;
  errors: CandidateEditErrors;
}

export interface ImportReviewUiState {
  expandedDiffs: ReadonlySet<string>;
  // Keys from evidenceKey(): the Sources whose statements are shown in full.
  expandedEvidence: ReadonlySet<string>;
  applyOpen: boolean;
  acknowledged: boolean;
  editing: CandidateEditState | null;
  // ID of the element to focus after the next render.
  focus: string | null;
}

export interface ImportReviewProject {
  id: string;
  name: string;
}

export interface ImportReviewCopy {
  title: string;
  back: string;
  status: Record<ImportReview["status"], string>;
  health: Record<"stale" | "failed", string>;
  operation: Record<Operation, string>;
  decision: Record<Decision, string>;
  decide: Record<Operation | "hold" | "pending", string>;
  decideAria: (action: string, candidateId: string) => string;
  decisionGroupAria: (candidateId: string) => string;
  evidenceTitle: string;
  sourceKind: Record<"note" | "conversation", string>;
  conversation: (id: string) => string;
  summaryLabel: Record<"note" | "conversation", string>;
  noSummary: string;
  showStatements: (count: number) => string;
  hideStatements: (count: number) => string;
  statementsAria: (candidateId: string, source: string) => string;
  legacyFormat: string;
  fields: Record<"title" | "date" | "priority" | "labels" | "project" | "steps" | "notes", string>;
  empty: string;
  unassigned: string;
  noPriority: string;
  priorityValue: (priority: number) => string;
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
  edit: string;
  editAria: (candidateId: string) => string;
  finishEditFirst: string;
  editOperation: string;
  changeReason: string;
  editHelp: Record<"labels" | "steps" | "changeReason" | "noMergeTarget", string>;
  editErrors: Record<CandidateEditError, string>;
  save: string;
}

export type ImportReviewAction =
  | { type: "decide"; candidateId: string; decision: Decision }
  | { type: "toggle-diff"; candidateId: string }
  | { type: "toggle-evidence"; candidateId: string; sourceId: string }
  | { type: "open-apply" }
  | { type: "cancel-apply" }
  | { type: "set-acknowledged"; acknowledged: boolean }
  | { type: "confirm-apply" }
  | { type: "start-edit"; candidateId: string; revision: number; form: CandidateEditForm }
  | { type: "edit-input"; field: CandidateEditField; value: string }
  | { type: "edit-operation"; operation: Operation }
  | { type: "edit-invalid"; errors: CandidateEditErrors }
  | { type: "cancel-edit" }
  | { type: "save-edit" };

const OPERATION_ID = "taskmate-import-edit-operation";
// Expanded statement lists at least this long repeat the collapse button below the last statement.
const LONG_EVIDENCE = 4;
const FORM_ERROR_ID = "taskmate-import-edit-form-error";
const OPEN_APPLY_ID = "taskmate-import-review-open-apply";
const APPLY_TITLE_ID = "taskmate-import-review-apply-title";

export function editFieldId(field: CandidateEditField): string {
  return `taskmate-import-edit-${field}`;
}

export function editButtonId(candidateId: string): string {
  return `taskmate-import-candidate-edit-${candidateId}`;
}

export function evidenceKey(candidateId: string, sourceId: string): string {
  return `${candidateId}:${sourceId}`;
}

function evidenceToggleId(candidateId: string, sourceId: string): string {
  return `taskmate-import-evidence-toggle-${candidateId}-${sourceId}`;
}

export function createImportReviewUiState(): ImportReviewUiState {
  return { expandedDiffs: new Set(), expandedEvidence: new Set(), applyOpen: false, acknowledged: false, editing: null, focus: null };
}

export function reduceImportReviewUiState(state: ImportReviewUiState, action: ImportReviewAction): ImportReviewUiState {
  switch (action.type) {
    case "toggle-diff": {
      const expandedDiffs = new Set(state.expandedDiffs);
      if (expandedDiffs.has(action.candidateId)) expandedDiffs.delete(action.candidateId);
      else expandedDiffs.add(action.candidateId);
      return { ...state, expandedDiffs };
    }
    case "toggle-evidence": {
      const key = evidenceKey(action.candidateId, action.sourceId);
      const expandedEvidence = new Set(state.expandedEvidence);
      if (expandedEvidence.has(key)) expandedEvidence.delete(key);
      else expandedEvidence.add(key);
      return { ...state, expandedEvidence, focus: evidenceToggleId(action.candidateId, action.sourceId) };
    }
    case "open-apply": return { ...state, applyOpen: true, acknowledged: false, focus: APPLY_TITLE_ID };
    case "cancel-apply": return { ...state, applyOpen: false, acknowledged: false, focus: OPEN_APPLY_ID };
    case "set-acknowledged": return { ...state, acknowledged: action.acknowledged };
    case "start-edit": return {
      ...state,
      applyOpen: false,
      acknowledged: false,
      editing: { candidateId: action.candidateId, revision: action.revision, form: action.form, errors: {} },
      focus: OPERATION_ID
    };
    case "edit-input":
      return state.editing ? { ...state, editing: { ...state.editing, form: withField(state.editing.form, action.field, action.value) } } : state;
    case "edit-operation":
      return state.editing ? { ...state, editing: { ...state.editing, form: { ...state.editing.form, operation: action.operation }, errors: {} }, focus: OPERATION_ID } : state;
    case "edit-invalid": {
      if (!state.editing) return state;
      const first = CANDIDATE_EDIT_FIELDS.find((field) => action.errors[field]);
      return { ...state, editing: { ...state.editing, errors: action.errors }, focus: first ? editFieldId(first) : FORM_ERROR_ID };
    }
    case "cancel-edit":
      return state.editing ? { ...state, editing: null, focus: editButtonId(state.editing.candidateId) } : state;
    default: return state;
  }
}

function withField(form: CandidateEditForm, field: CandidateEditField, value: string): CandidateEditForm {
  if (field === "reason" || field === "exclusionReason") return { ...form, [field]: value };
  if (form.operation === "merge" && form.merge) return { ...form, merge: { ...form.merge, [field]: value } };
  return { ...form, draft: { ...form.draft, [field]: value } };
}

export function renderImportReview(
  container: HTMLElement,
  review: ImportReview,
  plan: FormalApplyPlan,
  state: ImportReviewUiState,
  copy: ImportReviewCopy,
  dispatch: (action: ImportReviewAction) => void,
  options: { readOnly?: boolean; onBack?: () => void; projects?: readonly ImportReviewProject[] } = {}
): void {
  container.replaceChildren();
  container.classList.add("taskmate-review", "taskmate-import-review");
  const header = element("header", "taskmate-review-header", container);
  text(header, "h2", copy.title);
  if (options.onBack) {
    const back = button(copy.back, options.onBack);
    back.classList.add("taskmate-review-back");
    header.append(back);
  }
  const summary = element("p", "taskmate-import-review-summary", container);
  summary.textContent = [review.reviewId, copy.status[review.status], review.health === "ok" ? "" : copy.health[review.health]].filter(Boolean).join(" · ");
  if (importReviewFormat(review) !== "v2") text(container, "p", copy.legacyFormat, "taskmate-import-review-legacy");

  const list = element("div", "taskmate-review-files", container);
  const projects = options.projects ?? [];
  for (const candidate of review.candidates) renderCard(list, review, candidate, state, copy, dispatch, Boolean(options.readOnly), projects);

  if (!options.readOnly) renderApply(container, plan, state, copy, dispatch);
  if (state.focus) container.querySelector<HTMLElement>(`[id="${state.focus}"]`)?.focus();
}

function renderCard(
  parent: HTMLElement,
  review: ImportReview,
  candidate: ImportCandidate,
  state: ImportReviewUiState,
  copy: ImportReviewCopy,
  dispatch: (action: ImportReviewAction) => void,
  readOnly: boolean,
  projects: readonly ImportReviewProject[]
): void {
  const card = element("section", "taskmate-review-file taskmate-import-candidate", parent);
  card.id = `taskmate-import-candidate-${candidate.id}`;
  card.dataset.operation = candidate.operation;
  const head = element("div", "taskmate-review-file-header", card);
  const identity = element("div", "taskmate-review-file-identity", head);
  text(identity, "span", candidate.id, "taskmate-review-id");
  text(identity, "span", copy.operation[candidate.operation], "taskmate-import-candidate-operation");
  // A create shows the title of the Task it would produce; merges and exclusions keep the candidate's own title.
  text(identity, "h3", candidate.operation === "create" ? candidate.taskDraft.title : candidate.title);

  const status = element("p", "taskmate-import-candidate-status", card);
  const applied = candidate.application.status === "applied";
  status.textContent = [
    applied ? copy.applied : copy.decision[candidate.decision],
    candidate.health === "ok" ? "" : `${copy.health[candidate.health]}${candidate.healthReason ? `: ${candidate.healthReason}` : ""}`
  ].filter(Boolean).join(" · ");
  if (candidate.health !== "ok") status.classList.add(`is-${candidate.health}`);

  const editing = state.editing?.candidateId === candidate.id ? state.editing : null;
  if (editing) {
    renderEditForm(card, candidate, editing, copy, dispatch, projects);
    renderEvidence(card, review, candidate, state, copy, dispatch);
    return;
  }

  if (candidate.operation === "create") renderDraft(card, candidate.taskDraft, copy, projects);
  else if (candidate.operation === "merge") renderMerge(card, candidate, state, copy, dispatch, projects);
  else {
    const reason = element("p", "taskmate-import-candidate-reason", card);
    text(reason, "strong", `${copy.exclusionReason}: `);
    reason.append(candidate.exclusionReason);
  }

  if (!readOnly && !applied) {
    const actions = element("div", "taskmate-import-candidate-actions", card);
    const decisions = element("div", "taskmate-import-candidate-decisions", actions);
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
    const edit = button(copy.edit, () => dispatch({ type: "start-edit", candidateId: candidate.id, revision: candidate.revision, form: candidateEditForm(candidate) }));
    edit.id = editButtonId(candidate.id);
    edit.classList.add("taskmate-import-candidate-edit-button");
    edit.setAttribute("aria-label", copy.editAria(candidate.id));
    edit.disabled = state.editing !== null;
    actions.append(edit);
  }
  renderEvidence(card, review, candidate, state, copy, dispatch);
}

// The Sources behind a candidate, after the Task it would produce: each Source once, with the summary Task Pilot wrote
// for this candidate, and the exact statements collapsed until asked for.
function renderEvidence(
  card: HTMLElement,
  review: ImportReview,
  candidate: ImportCandidate,
  state: ImportReviewUiState,
  copy: ImportReviewCopy,
  dispatch: (action: ImportReviewAction) => void
): void {
  const section = element("div", "taskmate-import-candidate-evidence", card);
  text(section, "h4", copy.evidenceTitle);
  for (const group of candidateEvidence(candidate)) {
    const source = review.sources.find((item) => item.id === group.sourceId);
    const kind = source?.type ?? "note";
    const name = !source ? group.sourceId : source.type === "note" ? source.path : copy.conversation(source.localSourceId);
    const block = element("section", "taskmate-import-evidence-source", section);
    block.dataset.sourceId = group.sourceId;
    text(block, "p", copy.sourceKind[kind], "taskmate-import-evidence-kind");
    text(block, "p", name, "taskmate-import-evidence-name");
    text(block, "p", copy.summaryLabel[kind], "taskmate-import-evidence-summary-label");
    const summary = text(block, "p", group.summary ?? copy.noSummary, "taskmate-import-evidence-summary");
    if (group.summary === null) summary.classList.add("is-missing");

    const expanded = state.expandedEvidence.has(evidenceKey(candidate.id, group.sourceId));
    const count = group.statements.length;
    const listId = `taskmate-import-evidence-${candidate.id}-${group.sourceId}`;
    const toggle = button(expanded ? copy.hideStatements(count) : copy.showStatements(count), () => (
      dispatch({ type: "toggle-evidence", candidateId: candidate.id, sourceId: group.sourceId })
    ));
    toggle.id = evidenceToggleId(candidate.id, group.sourceId);
    toggle.classList.add("taskmate-import-evidence-toggle");
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.setAttribute("aria-controls", listId);
    block.append(toggle);
    if (!expanded) continue;
    const statements = element("div", "taskmate-import-evidence-statements", block);
    statements.id = listId;
    statements.setAttribute("role", "group");
    statements.setAttribute("aria-label", copy.statementsAria(candidate.id, name));
    for (const statement of group.statements) text(statements, "blockquote", statement, "taskmate-import-candidate-statement");
    // A long list would otherwise need scrolling back up to collapse it; collapsing returns focus, and the view, to the
    // toggle at the top.
    if (count >= LONG_EVIDENCE) {
      const bottom = button(copy.hideStatements(count), () => (
        dispatch({ type: "toggle-evidence", candidateId: candidate.id, sourceId: group.sourceId })
      ));
      bottom.classList.add("taskmate-import-evidence-toggle", "is-bottom");
      bottom.setAttribute("aria-expanded", "true");
      bottom.setAttribute("aria-controls", listId);
      block.append(bottom);
    }
  }
}

function renderDraft(
  card: HTMLElement,
  draft: Extract<ImportCandidate, { operation: "create" }>["taskDraft"],
  copy: ImportReviewCopy,
  projects: readonly ImportReviewProject[]
): void {
  const fields = element("dl", "taskmate-import-candidate-fields", card);
  const rows: Array<[keyof ImportReviewCopy["fields"], string]> = [
    ["date", draft.date ?? copy.empty],
    ["priority", draft.priority === null ? copy.empty : copy.priorityValue(draft.priority)],
    ["labels", draft.labels.length ? draft.labels.join(", ") : copy.empty],
    ["project", draft.project === null ? copy.empty : projectName(draft.project, projects)],
    ["notes", draft.notes || copy.empty]
  ];
  for (const [field, value] of rows) {
    text(fields, "dt", copy.fields[field]);
    text(fields, "dd", value);
  }
  if (draft.steps.length > 0) {
    text(fields, "dt", copy.fields.steps);
    const steps = element("dd", "", fields);
    const listEl = element("ul", "taskmate-import-candidate-steps", steps);
    for (const step of draft.steps) text(listEl, "li", step.date ? `${step.text} (${step.date})` : step.text);
  }
}

function renderMerge(
  card: HTMLElement,
  candidate: Extract<ImportCandidate, { operation: "merge" }>,
  state: ImportReviewUiState,
  copy: ImportReviewCopy,
  dispatch: (action: ImportReviewAction) => void,
  projects: readonly ImportReviewProject[]
): void {
  const target = candidate.mergeTarget;
  const block = element("div", "taskmate-import-candidate-merge", card);
  text(block, "p", copy.mergeTarget(target.title), "taskmate-import-candidate-target");
  for (const change of target.changes) {
    const row = element("div", "taskmate-review-change is-read-only", block);
    text(row, "strong", copy.fields[change.field]);
    const details = element("span", "taskmate-review-change-details", row);
    const format = (value: unknown) => change.field === "project" && typeof value === "string" ? projectName(value, projects) : formatValue(value);
    text(details, "span", `${format(change.before)} → ${format(change.after)}`, "taskmate-review-values");
    text(details, "span", change.reason, "taskmate-review-reason");
  }
  const expanded = state.expandedDiffs.has(candidate.id);
  const diffId = `taskmate-import-candidate-diff-${candidate.id}`;
  const toggle = button(expanded ? copy.hideDiff : copy.showDiff, () => dispatch({ type: "toggle-diff", candidateId: candidate.id }));
  toggle.classList.add("taskmate-import-candidate-diff-toggle");
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
  state: ImportReviewUiState,
  copy: ImportReviewCopy,
  dispatch: (action: ImportReviewAction) => void
): void {
  const footer = element("footer", "taskmate-review-footer taskmate-import-review-apply", container);
  if (!state.applyOpen) {
    const open = button(copy.openApply, () => dispatch({ type: "open-apply" }));
    open.id = OPEN_APPLY_ID;
    open.classList.add("mod-cta");
    open.disabled = plan.eligible.length === 0 || state.editing !== null;
    if (state.editing) open.title = copy.finishEditFirst;
    else if (open.disabled) open.title = copy.nothingToApply;
    footer.append(open);
    return;
  }
  footer.classList.add("is-open");
  const panel = element("section", "taskmate-import-review-apply-panel", footer);
  panel.setAttribute("aria-labelledby", APPLY_TITLE_ID);
  const title = text(panel, "h3", copy.applyTitle);
  title.id = APPLY_TITLE_ID;
  // Focusing the title scrolls the confirmation into view and announces it.
  title.tabIndex = -1;
  text(panel, "p", copy.applyCounts(plan.counts));
  if (plan.blocked.length > 0) {
    text(panel, "h4", copy.blockedTitle);
    const blocked = element("ul", "taskmate-import-review-blocked", panel);
    for (const item of plan.blocked) text(blocked, "li", `${item.candidateId}: ${copy.blocked[item.reason]}`);
  }
  if (plan.requiresAcknowledgement) {
    text(panel, "h4", copy.unviewedTitle);
    const unviewed = element("ul", "taskmate-import-review-unviewed", panel);
    for (const item of plan.unviewedMerges) text(unviewed, "li", `${item.candidateId}: ${item.targetTitle}`);
    const label = element("label", "taskmate-import-review-acknowledge", panel);
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.acknowledged;
    checkbox.addEventListener("change", () => dispatch({ type: "set-acknowledged", acknowledged: checkbox.checked }));
    label.append(checkbox, document.createTextNode(copy.acknowledge(plan.unviewedMerges.length)));
  }
  const actions = element("div", "taskmate-import-review-apply-actions", panel);
  const confirm = button(copy.confirm, () => dispatch({ type: "confirm-apply" }));
  confirm.classList.add("mod-cta");
  confirm.disabled = plan.eligible.length === 0 || (plan.requiresAcknowledgement && !state.acknowledged);
  const cancel = button(copy.cancel, () => dispatch({ type: "cancel-apply" }));
  actions.append(confirm, cancel);
}

function renderEditForm(
  card: HTMLElement,
  candidate: ImportCandidate,
  editing: CandidateEditState,
  copy: ImportReviewCopy,
  dispatch: (action: ImportReviewAction) => void,
  projects: readonly ImportReviewProject[]
): void {
  const form = element("form", "taskmate-import-candidate-edit", card);
  form.noValidate = true;
  form.setAttribute("aria-label", copy.editAria(candidate.id));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    dispatch({ type: "save-edit" });
  });
  if (editing.errors.form) {
    const error = text(form, "p", copy.editErrors[editing.errors.form], "taskmate-import-candidate-edit-error");
    error.id = FORM_ERROR_ID;
    error.tabIndex = -1;
    error.setAttribute("role", "alert");
  }

  const { operation, merge } = editing.form;
  const operations: Operation[] = merge ? ["create", "merge", "exclude"] : ["create", "exclude"];
  const operationSelect = select(operations.map((value) => [value, copy.operation[value]]), operation);
  operationSelect.addEventListener("change", () => dispatch({ type: "edit-operation", operation: operationSelect.value as Operation }));
  editField(form, OPERATION_ID, copy.editOperation, operationSelect, merge ? undefined : copy.editHelp.noMergeTarget);

  const control = (name: CandidateEditField, label: string, input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, help?: string) => {
    input.addEventListener(input instanceof HTMLSelectElement ? "change" : "input", () => dispatch({ type: "edit-input", field: name, value: input.value }));
    const error = editing.errors[name];
    editField(form, editFieldId(name), label, input, help, error ? copy.editErrors[error] : undefined);
  };

  if (operation === "exclude") {
    control("exclusionReason", copy.exclusionReason, required(textArea(editing.form.exclusionReason)));
  } else {
    const values = operation === "merge" && merge ? merge : editing.form.draft;
    control("title", copy.fields.title, required(textInput("text", values.title)));
    control("date", copy.fields.date, textInput("date", values.date));
    control("priority", copy.fields.priority, select([["", copy.noPriority], ...[1, 2, 3].map((value): [string, string] => [String(value), copy.priorityValue(value)])], values.priority));
    control("labels", copy.fields.labels, textInput("text", values.labels), copy.editHelp.labels);
    const projectOptions: Array<[string, string]> = [["", copy.unassigned], ...projects.map((project): [string, string] => [project.id, project.name])];
    if (values.project && !projects.some((project) => project.id === values.project)) projectOptions.push([values.project, values.project]);
    control("project", copy.fields.project, select(projectOptions, values.project));
    control("steps", copy.fields.steps, textArea(values.steps), copy.editHelp.steps);
    control("notes", copy.fields.notes, textArea(values.notes));
    if (operation === "merge") control("reason", copy.changeReason, textArea(editing.form.reason), copy.editHelp.changeReason);
  }

  const actions = element("div", "taskmate-import-candidate-edit-actions", form);
  const save = element("button", "mod-cta", actions);
  save.type = "submit";
  save.textContent = copy.save;
  actions.append(button(copy.cancel, () => dispatch({ type: "cancel-edit" })));
}

function editField(form: HTMLElement, id: string, label: string, control: HTMLElement, help?: string, error?: string): void {
  const wrapper = element("div", "taskmate-import-candidate-edit-field", form);
  const caption = element("label", "", wrapper);
  caption.htmlFor = id;
  caption.textContent = label;
  control.id = id;
  wrapper.append(control);
  const describedBy: string[] = [];
  if (help) {
    const note = text(wrapper, "p", help, "taskmate-import-candidate-edit-help");
    note.id = `${id}-help`;
    describedBy.push(note.id);
  }
  if (error) {
    const message = text(wrapper, "p", error, "taskmate-import-candidate-edit-error");
    message.id = `${id}-error`;
    describedBy.push(message.id);
    control.setAttribute("aria-invalid", "true");
  }
  if (describedBy.length > 0) control.setAttribute("aria-describedby", describedBy.join(" "));
}

function textInput(type: "text" | "date", value: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = type;
  input.value = value;
  return input;
}

function textArea(value: string): HTMLTextAreaElement {
  const area = document.createElement("textarea");
  area.rows = 3;
  area.value = value;
  return area;
}

function select(options: Array<[string, string]>, value: string): HTMLSelectElement {
  const control = document.createElement("select");
  for (const [optionValue, label] of options) {
    const option = element("option", "", control);
    option.value = optionValue;
    option.textContent = label;
  }
  control.value = value;
  return control;
}

function required<Control extends HTMLElement>(control: Control): Control {
  control.setAttribute("aria-required", "true");
  return control;
}

function projectName(id: string, projects: readonly ImportReviewProject[]): string {
  return projects.find((project) => project.id === id)?.name ?? id;
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
