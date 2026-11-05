import Sortable from "sortablejs";
import type { RepeatRule } from "../tasks/schedule";
import {
  DRAG_AUTO_SCROLL_MAXIMUM_ZONE,
  calculateDragAutoScroll,
  isPointOutsideBounds,
  pointerClientPoint,
  pointerClientY,
  type PointerClientPoint
} from "./drag-auto-scroll";
import type { TaskListModel, TaskListRow, TaskListSectionId } from "./task-list-model";
import { summarizeLabels } from "../labels/label-summary";

export type TaskListAction =
  | { type: "open"; taskId: string }
  | { type: "toggle-selected"; taskId: string }
  | { type: "toggle-completed"; taskId: string; completed: boolean }
  | { type: "reorder"; taskId: string; previousId: string | null; nextId: string | null };

export interface TaskListCopy {
  empty: string;
  completeAriaLabel: (title: string) => string;
  selectAriaLabel: (title: string) => string;
  moreLabels: (count: number) => string;
  moreLabelsAriaLabel: (count: number) => string;
  hideExtraLabels: string;
  deadline: (date: string) => string;
  deadlineOverdue: (date: string) => string;
  repeat: (rule: RepeatRule) => string;
  sectionTitles: Record<Exclude<TaskListSectionId, "default">, string>;
}

export interface RenderedTaskList {
  destroy(): void;
}

type DispatchTaskListAction = (action: TaskListAction) => void | Promise<void>;

export const TASK_LIST_TITLE_CHARACTER_LIMIT = 100;
const taskTitleSegmenter = typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
  : null;

function* titleGraphemes(title: string): Generator<string> {
  if (taskTitleSegmenter) {
    for (const { segment } of taskTitleSegmenter.segment(title)) yield segment;
    return;
  }
  yield* title;
}

export function taskListTitleText(title: string, limit = TASK_LIST_TITLE_CHARACTER_LIMIT): string {
  const visible: string[] = [];
  for (const segment of titleGraphemes(title)) {
    if (visible.length === limit) return `${visible.join("")}…`;
    visible.push(segment);
  }
  return title;
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
    const checkbox = appendElement(task, "input", {
      attributes: { type: "checkbox", "aria-label": copy.completeAriaLabel(row.title) }
    });
    checkbox.checked = row.completed;
    checkbox.addEventListener("change", () => {
      void dispatch({ type: "toggle-completed", taskId: row.id, completed: checkbox.checked });
    }, { signal });
  }

  const body = appendElement(task, "div", { className: "taskmate-task-body" });
  const title = appendElement(body, "button", {
    className: "taskmate-title",
    text: taskListTitleText(row.title),
    attributes: { type: "button", "aria-label": row.title }
  });
  title.addEventListener("click", () => {
    if (!selectionMode) void dispatch({ type: "open", taskId: row.id });
  }, { signal });

  const metadata = appendElement(body, "div", { className: "taskmate-metadata" });
  if (row.date) appendElement(metadata, "span", { text: row.time ? `${row.date} ${row.time}` : row.date });
  if (row.deadline) appendElement(metadata, "span", {
    text: row.deadlineState === "overdue" ? copy.deadlineOverdue(row.deadline) : copy.deadline(row.deadline),
    className: `taskmate-deadline is-${row.deadlineState}`
  });
  if (row.repeat) appendElement(metadata, "span", { text: copy.repeat(row.repeat), className: "taskmate-repeat" });
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
    className: `taskmate-list${model.grouping === "scheduled" ? " taskmate-scheduled-list" : ""}${model.selectionMode ? " is-selection-mode" : ""}${model.reorderEnabled ? " is-reorder-enabled" : ""}`,
    attributes: { role: "list" }
  });
  const rowCount = model.sections.reduce((count, section) => count + section.rows.length, 0);
  if (rowCount === 0) {
    appendElement(list, "div", { className: "taskmate-empty", text: copy.empty });
    return { destroy: () => controller.abort() };
  }

  model.sections.forEach((section) => {
    if (section.id !== "default") {
      const heading = appendElement(list, "div", {
        className: `taskmate-task-section-heading is-${section.id}`,
        text: copy.sectionTitles[section.id],
        attributes: { role: "heading", "aria-level": "3" }
      });
      heading.dataset.section = section.id;
    }
    section.rows.forEach((row) => {
      renderRow(list, row, model.selectionMode, copy, controller.signal, dispatch);
      if (list.lastElementChild instanceof HTMLElement) list.lastElementChild.dataset.section = section.id;
    });
  });

  const scrollRegion = container.closest<HTMLElement>(".taskmate-scroll-region");
  let lastAutoScrollAt: number | null = null;

  const resetAutoScroll = (): void => {
    lastAutoScrollAt = null;
  };

  // SortableJS keeps the last hovered position even when the pointer leaves the list.
  // Native HTML5 drags (desktop) stop reporting the pointer outside the window, so they
  // count as inside only when a drop event lands in the Task results; touch fallback
  // drags use the latest pointer position.
  let lastDragPoint: PointerClientPoint | null = null;
  let nativeDrag = false;
  let droppedInsideRegion = false;
  const trackDragPoint = (event: Event): void => {
    lastDragPoint = pointerClientPoint(event) ?? lastDragPoint;
  };
  const markDrop = (event: Event): void => {
    droppedInsideRegion = event.target instanceof Node && scrollRegion?.contains(event.target) === true;
  };
  const dragPointEvents = ["dragover", "pointermove", "touchmove", "mousemove"] as const;
  const stopTrackingDragPoint = (): void => {
    for (const type of dragPointEvents) document.removeEventListener(type, trackDragPoint, true);
    document.removeEventListener("drop", markDrop, true);
  };
  const startTrackingDragPoint = (startEvent: Event | undefined): void => {
    lastDragPoint = null;
    nativeDrag = startEvent?.type === "dragstart";
    droppedInsideRegion = false;
    const options = { capture: true, passive: true, signal: controller.signal };
    for (const type of dragPointEvents) document.addEventListener(type, trackDragPoint, options);
    document.addEventListener("drop", markDrop, options);
  };
  const droppedOutsideRegion = (): boolean => {
    if (!scrollRegion) return false;
    if (nativeDrag) return !droppedInsideRegion;
    return lastDragPoint !== null && isPointOutsideBounds(lastDragPoint, scrollRegion.getBoundingClientRect());
  };

  const sortable = Sortable.create(list, {
    animation: 140,
    handle: ".taskmate-task-body",
    draggable: ".taskmate-task",
    filter: ".taskmate-label-overflow-toggle",
    preventOnFilter: false,
    disabled: !model.reorderEnabled,
    delay: 250,
    delayOnTouchOnly: true,
    touchStartThreshold: 4,
    ...(scrollRegion ? {
      scroll: scrollRegion,
      scrollSensitivity: DRAG_AUTO_SCROLL_MAXIMUM_ZONE,
      scrollSpeed: 10,
      forceAutoScrollFallback: true,
      bubbleScroll: false,
      scrollFn: (
        _offsetX: number,
        _offsetY: number,
        originalEvent: Event,
        touchEvent: TouchEvent
      ): void => {
        const pointerY = pointerClientY(touchEvent, originalEvent);
        if (pointerY === null) {
          resetAutoScroll();
          return;
        }
        const now = performance.now();
        const elapsedSinceLastCall = lastAutoScrollAt === null ? 0 : now - lastAutoScrollAt;
        const elapsedMs = elapsedSinceLastCall > 100 ? 0 : elapsedSinceLastCall;
        lastAutoScrollAt = now;
        const delta = calculateDragAutoScroll({
          bounds: scrollRegion.getBoundingClientRect(),
          pointerY,
          elapsedMs,
          scrollTop: scrollRegion.scrollTop,
          maximumScrollTop: scrollRegion.scrollHeight - scrollRegion.clientHeight
        }).delta;
        if (delta !== 0) scrollRegion.scrollTop += delta;
      }
    } : {}),
    onStart: (event) => {
      resetAutoScroll();
      // SortableJS passes the native dragstart or the touch/pointer event that started a fallback drag.
      startTrackingDragPoint((event as (Sortable.SortableEvent & { originalEvent?: Event }) | undefined)?.originalEvent);
    },
    // Sections come from Task dates and a drop changes only the manual rank,
    // so a Task cannot be moved into another section.
    onMove: (event) => sectionAt(event.related, event.willInsertAfter) === event.dragged.dataset.section,
    onEnd: (event) => {
      resetAutoScroll();
      stopTrackingDragPoint();
      const outside = droppedOutsideRegion();
      if (event.oldIndex === event.newIndex) return;
      const itemSection = event.item.dataset.section;
      // A blocked move leaves the Task at its own section's edge, so the section under
      // the release point also decides whether the drop is accepted.
      const pointSection = lastDragPoint ? sectionAtPoint(list, event.item, lastDragPoint) : undefined;
      const crossedSection = precedingSection(event.item) !== itemSection
        || (pointSection !== undefined && pointSection !== itemSection);
      if (outside || crossedSection) {
        restoreDraggedItem(list, event.item, event.oldIndex);
        return;
      }
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
      resetAutoScroll();
      stopTrackingDragPoint();
      controller.abort();
      sortable.destroy();
    }
  };
}

function restoreDraggedItem(list: HTMLElement, item: HTMLElement, oldIndex: number | undefined): void {
  if (oldIndex === undefined) return;
  const siblings = Array.from(list.children).filter((child) => child !== item);
  list.insertBefore(item, siblings[oldIndex] ?? null);
}

function isSectionHeading(element: Element): element is HTMLElement {
  return element instanceof HTMLElement && element.classList.contains("taskmate-task-section-heading");
}

function precedingSection(element: Element): string | undefined {
  for (let sibling = element.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
    if (isSectionHeading(sibling)) return sibling.dataset.section;
  }
  return "default";
}

function sectionAt(related: HTMLElement, insertAfter: boolean | undefined): string | undefined {
  if (isSectionHeading(related) && !insertAfter) return precedingSection(related);
  return related.dataset.section;
}

function sectionAtPoint(list: HTMLElement, item: HTMLElement, point: PointerClientPoint): string | undefined {
  const target = list.ownerDocument.elementFromPoint?.(point.x, point.y);
  const element = target?.closest<HTMLElement>(".taskmate-task, .taskmate-task-section-heading");
  if (!element || !list.contains(element) || element === item) return undefined;
  return element.dataset.section;
}
