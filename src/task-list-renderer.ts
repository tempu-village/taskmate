import Sortable from "sortablejs";
import type { TaskListModel, TaskListRow, TaskListSectionId } from "./task-list-model";

export type TaskListAction =
  | { type: "open"; taskId: string }
  | { type: "toggle-completed"; taskId: string; completed: boolean }
  | { type: "show-actions"; taskId: string; event: MouseEvent }
  | { type: "reorder"; taskId: string; previousId: string | null; nextId: string | null };

export interface TaskListCopy {
  empty: string;
  reorderAriaLabel: string;
  completeAriaLabel: (title: string) => string;
  moreAriaLabel: string;
  sectionTitles: Record<Exclude<TaskListSectionId, "default">, string>;
}

export interface RenderedTaskList {
  destroy(): void;
}

type DispatchTaskListAction = (action: TaskListAction) => void | Promise<void>;

function appendElement<K extends keyof HTMLElementTagNameMap>(
  parent: HTMLElement,
  tag: K,
  options: { className?: string; text?: string; attributes?: Record<string, string> } = {}
): HTMLElementTagNameMap[K] {
  const element = parent.ownerDocument.createElement(tag);
  if (options.className) element.className = options.className;
  if (options.text !== undefined) element.textContent = options.text;
  Object.entries(options.attributes ?? {}).forEach(([name, value]) => element.setAttribute(name, value));
  parent.append(element);
  return element;
}

function renderRow(
  list: HTMLElement,
  row: TaskListRow,
  reorderEnabled: boolean,
  copy: TaskListCopy,
  signal: AbortSignal,
  dispatch: DispatchTaskListAction
): void {
  const task = appendElement(list, "div", {
    className: `taskmate-task${row.completed ? " is-completed" : ""}`,
    attributes: { role: "listitem" }
  });
  task.dataset.taskId = row.id;

  const drag = appendElement(task, "button", {
    className: "taskmate-drag",
    text: "⠿",
    attributes: { "aria-label": copy.reorderAriaLabel }
  });
  drag.disabled = !reorderEnabled;

  const checkbox = appendElement(task, "input", {
    attributes: { type: "checkbox", "aria-label": copy.completeAriaLabel(row.title) }
  });
  checkbox.checked = row.completed;
  checkbox.addEventListener("change", () => {
    void dispatch({ type: "toggle-completed", taskId: row.id, completed: checkbox.checked });
  }, { signal });

  const body = appendElement(task, "div", { className: "taskmate-task-body" });
  const title = appendElement(body, "button", { className: "taskmate-title", text: row.title });
  title.addEventListener("click", () => {
    void dispatch({ type: "open", taskId: row.id });
  }, { signal });

  const metadata = appendElement(body, "div", { className: "taskmate-metadata" });
  if (row.date) appendElement(metadata, "span", { text: row.date });
  if (row.priority) appendElement(metadata, "span", {
    text: `P${row.priority}`,
    className: `taskmate-priority taskmate-priority-${row.priority}`
  });
  if (row.projectName) appendElement(metadata, "span", { text: row.projectName });
  row.labels.forEach((label) => appendElement(metadata, "span", { text: `#${label}` }));

  const more = appendElement(task, "button", {
    className: "taskmate-more",
    text: "•••",
    attributes: { "aria-label": copy.moreAriaLabel }
  });
  more.addEventListener("click", (event) => {
    void dispatch({ type: "show-actions", taskId: row.id, event });
  }, { signal });
}

export function renderTaskList(
  container: HTMLElement,
  model: TaskListModel,
  copy: TaskListCopy,
  dispatch: DispatchTaskListAction
): RenderedTaskList {
  const AbortControllerClass = container.ownerDocument.defaultView?.AbortController ?? AbortController;
  const controller = new AbortControllerClass();
  const list = appendElement(container, "div", {
    className: `taskmate-list${model.grouping === "scheduled" ? " taskmate-scheduled-list" : ""}`,
    attributes: { role: "list" }
  });
  const rowCount = model.sections.reduce((count, section) => count + section.rows.length, 0);
  if (rowCount === 0) {
    appendElement(list, "div", { className: "taskmate-empty", text: copy.empty });
    return { destroy: () => controller.abort() };
  }

  model.sections.forEach((section) => {
    if (section.id !== "default") {
      appendElement(list, "div", {
        className: `taskmate-task-section-heading is-${section.id}`,
        text: copy.sectionTitles[section.id],
        attributes: { role: "heading", "aria-level": "3" }
      });
    }
    section.rows.forEach((row) => renderRow(list, row, model.reorderEnabled, copy, controller.signal, dispatch));
  });

  const sortable = Sortable.create(list, {
    animation: 140,
    handle: ".taskmate-drag",
    draggable: ".taskmate-task",
    disabled: !model.reorderEnabled,
    delay: 120,
    delayOnTouchOnly: true,
    touchStartThreshold: 4,
    onEnd: (event) => {
      if (event.oldIndex === event.newIndex) return;
      const orderedIds = Array.from(list.querySelectorAll<HTMLElement>(".taskmate-task"))
        .map((element) => element.dataset.taskId ?? "");
      const taskId = (event.item as HTMLElement).dataset.taskId ?? "";
      const newIndex = orderedIds.indexOf(taskId);
      if (!taskId || newIndex < 0) return;
      void dispatch({
        type: "reorder",
        taskId,
        previousId: orderedIds[newIndex - 1] || null,
        nextId: orderedIds[newIndex + 1] || null
      });
    }
  });

  return {
    destroy(): void {
      controller.abort();
      sortable.destroy();
    }
  };
}
