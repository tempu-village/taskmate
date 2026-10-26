import type { ProposalReview } from "./proposal";

export interface TaskChangeReviewState {
  mode: "semantic" | "raw";
  approvedChangeIds: ReadonlySet<string>;
}

export interface TaskChangeReviewCopy {
  title: string;
  summaryTitle: string;
  apply: string;
  reject: string;
  selectAll: string;
  selectAllShort: string;
  selectTask: string;
  clearAll: string;
  clearAllShort: string;
  clearTask: string;
  semantic: string;
  semanticAria: string;
  markdown: string;
  markdownAria: string;
  comparisonAria: string;
  noSelection: string;
}

export type TaskChangeReviewAction =
  | { type: "set-mode"; mode: "semantic" | "raw" }
  | { type: "set-approved"; changeId: string; approved: boolean }
  | { type: "set-many-approved"; changeIds: string[]; approved: boolean }
  | { type: "apply"; approvedChangeIds: string[] }
  | { type: "reject" };

export function createTaskChangeReviewState(): TaskChangeReviewState {
  return { mode: "semantic", approvedChangeIds: new Set() };
}

export function reduceTaskChangeReviewState(state: TaskChangeReviewState, action: TaskChangeReviewAction): TaskChangeReviewState {
  if (action.type === "set-mode") return { ...state, mode: action.mode };
  if (action.type === "set-approved") {
    const approvedChangeIds = new Set(state.approvedChangeIds);
    action.approved ? approvedChangeIds.add(action.changeId) : approvedChangeIds.delete(action.changeId);
    return { ...state, approvedChangeIds };
  }
  if (action.type === "set-many-approved") {
    const approvedChangeIds = new Set(state.approvedChangeIds);
    for (const id of action.changeIds) action.approved ? approvedChangeIds.add(id) : approvedChangeIds.delete(id);
    return { ...state, approvedChangeIds };
  }
  return state;
}

export function renderTaskChangeReview(
  container: HTMLElement,
  review: ProposalReview,
  state: TaskChangeReviewState,
  copy: TaskChangeReviewCopy,
  dispatch: (action: TaskChangeReviewAction) => void,
  options: { readOnly?: boolean; back?: { label: string; onClick: () => void } } = {}
): void {
  container.replaceChildren();
  container.classList.add("taskmate-review");
  const header = element("header", "taskmate-review-header", container);
  appendTextElement(header, "h2", copy.title);
  if (options.back) {
    const back = button(options.back.label, options.back.onClick);
    back.classList.add("taskmate-review-back");
    header.append(back);
  }

  const sections = new Map<string, HTMLElement>();
  renderSummary(container, review, copy, sections);

  const controls = element("div", "taskmate-review-controls", container);
  const allIds = review.tasks.flatMap((task) => task.changes.map((change) => change.id));
  const selectedAllCount = selectedCount(allIds, state.approvedChangeIds);
  if (!options.readOnly) {
    const selection = element("div", "taskmate-review-selection-actions", controls);
    selection.append(responsiveBulkButton(copy.selectAll, copy.selectAllShort, "taskmate-review-select-all", selectedAllCount === allIds.length, () => dispatch({ type: "set-many-approved", changeIds: allIds, approved: true })));
    selection.append(responsiveBulkButton(copy.clearAll, copy.clearAllShort, "taskmate-review-clear-all", selectedAllCount === 0, () => dispatch({ type: "set-many-approved", changeIds: allIds, approved: false })));
  }
  const displaySwitch = element("div", "taskmate-review-display-switch", controls);
  displaySwitch.setAttribute("role", "group");
  displaySwitch.setAttribute("aria-label", copy.comparisonAria);
  displaySwitch.append(modeButton(copy.semantic, copy.semanticAria, "taskmate-review-mode-semantic", state.mode === "semantic", () => dispatch({ type: "set-mode", mode: "semantic" })));
  displaySwitch.append(modeButton(copy.markdown, copy.markdownAria, "taskmate-review-mode-raw", state.mode === "raw", () => dispatch({ type: "set-mode", mode: "raw" })));

  const list = element("div", "taskmate-review-files", container);
  for (const task of review.tasks) {
    const section = element("section", "taskmate-review-file", list);
    section.id = `taskmate-review-${task.taskId}`;
    section.dataset.reviewAnchor = task.taskId;
    sections.set(task.taskId, section);
    const fileHeader = element("div", "taskmate-review-file-header", section);
    const identity = element("div", "taskmate-review-file-identity", fileHeader);
    appendTextElement(identity, "h3", task.title);
    const taskIds = task.changes.map((change) => change.id);
    if (!options.readOnly && taskIds.length > 1) {
      const selectedTaskCount = selectedCount(taskIds, state.approvedChangeIds);
      const taskActions = element("div", "taskmate-review-file-actions", fileHeader);
      taskActions.append(bulkButton(copy.selectTask, "taskmate-review-select-task", selectedTaskCount === taskIds.length, () => dispatch({ type: "set-many-approved", changeIds: taskIds, approved: true })));
      taskActions.append(bulkButton(copy.clearTask, "taskmate-review-clear-task", selectedTaskCount === 0, () => dispatch({ type: "set-many-approved", changeIds: taskIds, approved: false })));
    }
    if (task.summary) appendTextElement(section, "p", task.summary, "taskmate-review-task-summary");

    if (state.mode === "semantic") {
      for (const change of task.changes) {
        const row = element(options.readOnly ? "div" : "label", "taskmate-review-change", section);
        if (options.readOnly) row.classList.add("is-read-only");
        row.dataset.reviewAnchor = change.id;
        if (!options.readOnly) {
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = state.approvedChangeIds.has(change.id);
          checkbox.addEventListener("change", () => dispatch({ type: "set-approved", changeId: change.id, approved: checkbox.checked }));
          row.append(checkbox);
        }
        appendTextElement(row, "span", change.id, "taskmate-review-id");
        const details = element("span", "taskmate-review-change-details", row);
        appendTextElement(details, "strong", change.field);
        appendTextElement(details, "span", `${formatValue(change.before)} → ${formatValue(change.after)}`, "taskmate-review-values");
        appendTextElement(details, "span", change.reason, "taskmate-review-reason");
      }
    } else {
      const raw = element("pre", "taskmate-review-diff", section);
      for (const hunk of task.rawHunks) {
        appendTextElement(raw, "span", `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n`, "taskmate-diff-header");
        for (const line of hunk.lines) {
          const className = line.startsWith("+") ? "taskmate-diff-add" : line.startsWith("-") ? "taskmate-diff-delete" : "taskmate-diff-context";
          appendTextElement(raw, "span", `${line}\n`, className);
        }
      }
    }
  }

  if (!options.readOnly) {
    const footer = element("footer", "taskmate-review-footer", container);
    const apply = button(copy.apply, () => dispatch({
      type: "apply",
      approvedChangeIds: allIds.filter((id) => state.approvedChangeIds.has(id))
    }));
    apply.classList.add("taskmate-review-apply", "mod-cta");
    apply.disabled = state.approvedChangeIds.size === 0;
    apply.title = apply.disabled ? copy.noSelection : "";
    footer.append(apply);
    const reject = button(copy.reject, () => dispatch({ type: "reject" }));
    reject.classList.add("taskmate-review-reject", "mod-warning");
    footer.append(reject);
  }
}

// Task Pilot's explanations, shown above the changes only when the Proposal carries them.
function renderSummary(container: HTMLElement, review: ProposalReview, copy: TaskChangeReviewCopy, sections: ReadonlyMap<string, HTMLElement>): void {
  const described = review.tasks.filter((task) => task.summary);
  if (!review.summary && described.length === 0) return;
  const summary = element("section", "taskmate-review-summary", container);
  appendTextElement(summary, "h3", copy.summaryTitle);
  if (review.summary) appendTextElement(summary, "p", review.summary);
  if (described.length === 0) return;
  const list = element("ol", "taskmate-review-summary-tasks", summary);
  for (const task of described) {
    const item = element("li", "", list);
    const jump = button(task.title, () => sections.get(task.taskId)?.scrollIntoView({ block: "start" }));
    jump.classList.add("taskmate-review-summary-jump");
    item.append(jump);
    appendTextElement(item, "span", task.summary ?? "", "taskmate-review-summary-line");
  }
}

function element<Tag extends keyof HTMLElementTagNameMap>(tag: Tag, className: string, parent?: HTMLElement): HTMLElementTagNameMap[Tag] {
  const value = document.createElement(tag);
  value.className = className;
  parent?.append(value);
  return value;
}

function appendTextElement(parent: HTMLElement, tag: keyof HTMLElementTagNameMap, text: string, className?: string): HTMLElement {
  const value = document.createElement(tag);
  if (className) value.className = className;
  value.textContent = text;
  parent.append(value);
  return value;
}

function button(text: string, activate: () => void, active = false): HTMLButtonElement {
  const value = document.createElement("button");
  value.type = "button";
  value.textContent = text;
  if (active) value.classList.add("is-active");
  value.addEventListener("click", activate);
  return value;
}

function bulkButton(text: string, className: string, disabled: boolean, activate: () => void): HTMLButtonElement {
  const value = button(text, activate);
  value.classList.add(className);
  value.disabled = disabled;
  return value;
}

function responsiveBulkButton(longText: string, shortText: string, className: string, disabled: boolean, activate: () => void): HTMLButtonElement {
  const value = bulkButton("", className, disabled, activate);
  value.setAttribute("aria-label", longText);
  appendTextElement(value, "span", longText, "taskmate-review-wide-label");
  appendTextElement(value, "span", shortText, "taskmate-review-compact-label");
  return value;
}

function modeButton(text: string, accessibleName: string, className: string, active: boolean, activate: () => void): HTMLButtonElement {
  const value = button(text, activate, active);
  value.classList.add(className);
  value.setAttribute("aria-label", accessibleName);
  value.setAttribute("aria-pressed", String(active));
  return value;
}

function selectedCount(changeIds: readonly string[], selectedIds: ReadonlySet<string>): number {
  return changeIds.reduce((count, id) => count + (selectedIds.has(id) ? 1 : 0), 0);
}

function formatValue(value: unknown): string {
  if (value === null) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
