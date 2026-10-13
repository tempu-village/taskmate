import type { ProposalReview } from "./task-change-proposal";

export interface TaskChangeReviewState {
  mode: "semantic" | "raw";
  approvedChangeIds: ReadonlySet<string>;
}

export interface TaskChangeReviewCopy {
  title: string;
  apply: string;
  reject: string;
  selectAll: string;
  selectTask: string;
  clearAll: string;
  clearTask: string;
  semantic: string;
  markdown: string;
  noSelection: string;
}

export type TaskChangeReviewAction =
  | { type: "set-mode"; mode: "semantic" | "raw" }
  | { type: "set-approved"; changeId: string; approved: boolean }
  | { type: "set-many-approved"; changeIds: string[]; approved: boolean }
  | { type: "apply"; approvedChangeIds: string[] }
  | { type: "reject" };

export function renderTaskChangeReview(
  container: HTMLElement,
  review: ProposalReview,
  state: TaskChangeReviewState,
  copy: TaskChangeReviewCopy,
  dispatch: (action: TaskChangeReviewAction) => void
): void {
  container.replaceChildren();
  container.classList.add("taskmate-review");
  const header = element("header", "taskmate-review-header", container);
  appendTextElement(header, "h2", copy.title);
  appendTextElement(header, "span", `${review.tasks.length} Tasks`, "taskmate-review-count");

  const controls = element("div", "taskmate-review-controls", container);
  const allIds = review.tasks.flatMap((task) => task.changes.map((change) => change.id));
  const selectedAllCount = selectedCount(allIds, state.approvedChangeIds);
  controls.append(bulkButton(copy.selectAll, "taskmate-review-select-all", selectedAllCount === allIds.length, () => dispatch({ type: "set-many-approved", changeIds: allIds, approved: true })));
  controls.append(bulkButton(copy.clearAll, "taskmate-review-clear-all", selectedAllCount === 0, () => dispatch({ type: "set-many-approved", changeIds: allIds, approved: false })));
  controls.append(button(copy.semantic, () => dispatch({ type: "set-mode", mode: "semantic" }), state.mode === "semantic"));
  controls.append(button(copy.markdown, () => dispatch({ type: "set-mode", mode: "raw" }), state.mode === "raw"));

  const list = element("div", "taskmate-review-files", container);
  for (const task of review.tasks) {
    const section = element("section", "taskmate-review-file", list);
    section.id = `taskmate-review-${task.taskId}`;
    const fileHeader = element("div", "taskmate-review-file-header", section);
    appendTextElement(fileHeader, "span", task.reviewId, "taskmate-review-id");
    appendTextElement(fileHeader, "h3", task.title);
    appendTextElement(fileHeader, "span", task.path, "taskmate-review-path");
    const taskIds = task.changes.map((change) => change.id);
    if (taskIds.length > 1) {
      const selectedTaskCount = selectedCount(taskIds, state.approvedChangeIds);
      const taskActions = element("div", "taskmate-review-file-actions", fileHeader);
      taskActions.append(bulkButton(copy.selectTask, "taskmate-review-select-task", selectedTaskCount === taskIds.length, () => dispatch({ type: "set-many-approved", changeIds: taskIds, approved: true })));
      taskActions.append(bulkButton(copy.clearTask, "taskmate-review-clear-task", selectedTaskCount === 0, () => dispatch({ type: "set-many-approved", changeIds: taskIds, approved: false })));
    }

    if (state.mode === "semantic") {
      for (const change of task.changes) {
        const row = element("label", "taskmate-review-change", section);
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = state.approvedChangeIds.has(change.id);
        checkbox.addEventListener("change", () => dispatch({ type: "set-approved", changeId: change.id, approved: checkbox.checked }));
        row.append(checkbox);
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

function selectedCount(changeIds: readonly string[], selectedIds: ReadonlySet<string>): number {
  return changeIds.reduce((count, id) => count + (selectedIds.has(id) ? 1 : 0), 0);
}

function formatValue(value: unknown): string {
  if (value === null) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
