import Sortable from "sortablejs";
import type { TaskListModel, TaskListRow, TaskListSectionId } from "./task-list-model";
import { summarizeLabels } from "./label-summary";

export type TaskListAction =
  | { type: "open"; taskId: string }
  | { type: "toggle-selected"; taskId: string }
  | { type: "toggle-completed"; taskId: string; completed: boolean }
  | { type: "reorder"; taskId: string; previousId: string | null; nextId: string | null };

export interface TaskListCopy {
  empty: string;
  reorderAriaLabel: string;
  completeAriaLabel: (title: string) => string;
  selectAriaLabel: (title: string) => string;
  moreLabels: (count: number) => string;
  moreLabelsAriaLabel: (count: number) => string;
  hideExtraLabels: string;
  showFullTitle: string;
  hideFullTitle: string;
  sectionTitles: Record<Exclude<TaskListSectionId, "default">, string>;
}

export interface RenderedTaskList {
  destroy(): void;
}

type DispatchTaskListAction = (action: TaskListAction) => void | Promise<void>;

export function taskTitleNeedsDisclosure(title: HTMLElement): boolean {
  return title.clientHeight > 0 && title.scrollHeight > title.clientHeight + 1;
}

function observeTitleOverflow(title: HTMLElement, toggle: HTMLButtonElement, signal: AbortSignal): void {
  const view = title.ownerDocument.defaultView;
  let animationFrame: number | null = null;
  const refresh = () => {
    animationFrame = null;
    if (signal.aborted || title.classList.contains("is-expanded")) return;
    toggle.hidden = !taskTitleNeedsDisclosure(title);
  };
  const scheduleRefresh = () => {
    if (animationFrame !== null || signal.aborted) return;
    if (view?.requestAnimationFrame) animationFrame = view.requestAnimationFrame(refresh);
    else queueMicrotask(refresh);
  };
  const ResizeObserverClass = view?.ResizeObserver;
  const observer = ResizeObserverClass ? new ResizeObserverClass(scheduleRefresh) : null;
  observer?.observe(title);
  scheduleRefresh();
  signal.addEventListener("abort", () => {
    observer?.disconnect();
    if (animationFrame !== null && view?.cancelAnimationFrame) view.cancelAnimationFrame(animationFrame);
  }, { once: true });
}

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
  selectionMode: boolean,
  copy: TaskListCopy,
  signal: AbortSignal,
  dispatch: DispatchTaskListAction
): void {
  const task = appendElement(list, "div", {
    className: `taskmate-task${row.completed ? " is-completed" : ""}${row.selected ? " is-selected" : ""}`,
    attributes: { role: "listitem", "aria-selected": String(row.selected) }
  });
  task.dataset.taskId = row.id;
  if (selectionMode) {
    task.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest("input")) return;
      void dispatch({ type: "toggle-selected", taskId: row.id });
    }, { signal });
  }

  if (selectionMode) {
    const selection = appendElement(task, "input", {
      className: "taskmate-select-task",
      attributes: { type: "checkbox", "aria-label": copy.selectAriaLabel(row.title) }
    });
    selection.checked = row.selected;
    selection.addEventListener("change", () => {
      void dispatch({ type: "toggle-selected", taskId: row.id });
    }, { signal });
  } else {
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
  }

  const body = appendElement(task, "div", { className: "taskmate-task-body" });
  const title = appendElement(body, "button", { className: "taskmate-title", text: row.title });
  title.addEventListener("click", () => {
    if (!selectionMode) void dispatch({ type: "open", taskId: row.id });
  }, { signal });

  const titleToggle = appendElement(body, "button", {
    className: "taskmate-title-overflow-toggle",
    text: copy.showFullTitle,
    attributes: { type: "button", "aria-expanded": "false" }
  });
  titleToggle.hidden = true;
  titleToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const expanded = title.classList.toggle("is-expanded");
    titleToggle.hidden = false;
    titleToggle.setAttribute("aria-expanded", String(expanded));
    titleToggle.textContent = expanded ? copy.hideFullTitle : copy.showFullTitle;
  }, { signal });
  observeTitleOverflow(title, titleToggle, signal);

  const metadata = appendElement(body, "div", { className: "taskmate-metadata" });
  if (row.date) appendElement(metadata, "span", { text: row.date });
  if (row.priority) appendElement(metadata, "span", {
    text: `P${row.priority}`,
    className: `taskmate-priority taskmate-priority-${row.priority}`
  });
  if (row.projectName) appendElement(metadata, "span", { text: row.projectName });
  const labels = summarizeLabels(row.labels);
  labels.visible.forEach((label) => appendElement(metadata, "span", { text: `#${label}` }));
  if (labels.hidden.length > 0) {
    const extra = appendElement(metadata, "span", { className: "taskmate-extra-labels" });
    extra.hidden = true;
    labels.hidden.forEach((label) => appendElement(extra, "span", { text: `#${label}` }));
    const toggle = appendElement(metadata, "button", {
      className: "taskmate-label-overflow-toggle",
      text: copy.moreLabels(labels.hidden.length),
      attributes: {
        type: "button",
        "aria-expanded": "false",
        "aria-label": copy.moreLabelsAriaLabel(labels.hidden.length)
      }
    });
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      extra.hidden = expanded;
      toggle.setAttribute("aria-expanded", String(!expanded));
      toggle.setAttribute("aria-label", expanded ? copy.moreLabelsAriaLabel(labels.hidden.length) : copy.hideExtraLabels);
      toggle.textContent = expanded ? copy.moreLabels(labels.hidden.length) : copy.hideExtraLabels;
    }, { signal });
  }

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
    className: `taskmate-list${model.grouping === "scheduled" ? " taskmate-scheduled-list" : ""}${model.selectionMode ? " is-selection-mode" : ""}`,
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
    section.rows.forEach((row) => renderRow(list, row, model.reorderEnabled, model.selectionMode, copy, controller.signal, dispatch));
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
