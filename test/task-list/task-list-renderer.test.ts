/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskListModel } from "../../src/task-list/task-list-model";
import { renderTaskList } from "../../src/task-list/task-list-renderer";

const { sortableDestroy, sortableCreate } = vi.hoisted(() => {
  const destroy = vi.fn();
  return {
    sortableDestroy: destroy,
    sortableCreate: vi.fn(() => ({ destroy }))
  };
});

vi.mock("sortablejs", () => ({
  default: {
    create: sortableCreate
  }
}));

const copy = {
  empty: "No tasks",
  completeAriaLabel: (title: string) => `Complete ${title}`,
  selectAriaLabel: (title: string) => `Select ${title}`,
  moreLabels: (count: number) => `${count} more`,
  moreLabelsAriaLabel: (count: number) => `Show ${count} more labels`,
  hideExtraLabels: "Hide extra labels",
  deadline: (date: string) => `Deadline ${date}`,
  deadlineOverdue: (date: string) => `Deadline passed ${date}`,
  sectionTitles: { overdue: "Overdue", today: "Today", later: "Later" }
};

const model: TaskListModel = {
  grouping: "flat",
  reorderEnabled: true,
  selectionMode: false,
  sections: [{
    id: "default",
    rows: [{
      id: "task-1",
      title: "Test task",
      completed: false,
      date: "2026-09-19",
      deadline: null,
      deadlineState: "none",
      priority: 1,
      projectName: "Project",
      labels: ["label"],
      selected: false
    }]
  }]
};

describe("task-list renderer", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    sortableDestroy.mockClear();
    sortableCreate.mockClear();
  });

  it("renders rows and dispatches user intent without performing persistence", () => {
    const container = document.createElement("div");
    container.className = "taskmate-scroll-region";
    document.body.append(container);
    const dispatch = vi.fn();
    renderTaskList(container, model, copy, dispatch);

    container.querySelector<HTMLButtonElement>(".taskmate-title")?.click();
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    if (checkbox) {
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event("change"));
    }
    expect(dispatch).toHaveBeenNthCalledWith(1, { type: "open", taskId: "task-1" });
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: "toggle-completed", taskId: "task-1", completed: true });
    expect(container.querySelector(".taskmate-more")).toBeNull();
    expect(container.textContent).toContain("Project");
    expect(container.textContent).toContain("#label");
    expect(container.querySelector(".taskmate-drag")).toBeNull();
    expect(sortableCreate).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({
      handle: ".taskmate-task-body",
      filter: ".taskmate-label-overflow-toggle",
      preventOnFilter: false,
      delay: 250,
      delayOnTouchOnly: true,
      scroll: expect.any(HTMLElement),
      scrollSensitivity: 192,
      forceAutoScrollFallback: true,
      bubbleScroll: false,
      scrollFn: expect.any(Function)
    }));
  });

  it("uses one selection checkbox and row title toggles selection in selection mode", () => {
    const container = document.createElement("div");
    const dispatch = vi.fn();
    renderTaskList(container, {
      ...model,
      selectionMode: true,
      reorderEnabled: false,
      sections: [{ id: "default", rows: [{ ...model.sections[0].rows[0], selected: true }] }]
    }, copy, dispatch);
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
    expect(container.querySelector(".taskmate-drag")).toBeNull();
    container.querySelector<HTMLElement>(".taskmate-metadata")?.click();
    expect(dispatch).toHaveBeenCalledWith({ type: "toggle-selected", taskId: "task-1" });
  });

  it("reveals every overflow label with one click without mutating task data", () => {
    const container = document.createElement("div");
    const dispatch = vi.fn();
    const labels = ["l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8", "l9"];
    renderTaskList(container, {
      ...model,
      sections: [{ id: "default", rows: [{ ...model.sections[0].rows[0], labels }] }]
    }, copy, dispatch);
    const toggle = container.querySelector<HTMLButtonElement>(".taskmate-label-overflow-toggle");
    const extra = container.querySelector<HTMLElement>(".taskmate-extra-labels");
    expect(toggle?.textContent).toBe("6 more");
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(extra?.hidden).toBe(true);
    toggle?.click();
    expect(extra?.hidden).toBe(false);
    expect(extra?.textContent).toContain("#l9");
    expect(toggle?.textContent).toBe("Hide extra labels");
    expect(dispatch).not.toHaveBeenCalled();
    expect(labels).toHaveLength(9);
  });

  it("renders the complete title through 100 characters without a disclosure control", () => {
    const container = document.createElement("div");
    const dispatch = vi.fn();
    const fullTitle = "あ".repeat(100);
    renderTaskList(container, {
      ...model,
      sections: [{ id: "default", rows: [{
        ...model.sections[0].rows[0],
        title: fullTitle
      }] }]
    }, copy, dispatch);

    const title = container.querySelector<HTMLButtonElement>(".taskmate-title");
    expect(title?.textContent).toBe(fullTitle);
    expect(title?.getAttribute("aria-label")).toBe(fullTitle);
    expect(container.querySelector(".taskmate-title-overflow-toggle")).toBeNull();
  });

  it("truncates titles beyond 100 visible characters without changing the accessible title", () => {
    const container = document.createElement("div");
    const fullTitle = `${"あ".repeat(100)}い`;
    renderTaskList(container, {
      ...model,
      sections: [{ id: "default", rows: [{ ...model.sections[0].rows[0], title: fullTitle }] }]
    }, copy, vi.fn());

    const title = container.querySelector<HTMLButtonElement>(".taskmate-title");
    expect(title?.textContent).toBe(`${"あ".repeat(100)}…`);
    expect(title?.getAttribute("aria-label")).toBe(fullTitle);
  });

  it("does not split an extended grapheme cluster at the 100-character boundary", () => {
    const container = document.createElement("div");
    const familyEmoji = "👨‍👩‍👧‍👦";
    const fullTitle = `${"あ".repeat(99)}${familyEmoji}終`;
    renderTaskList(container, {
      ...model,
      sections: [{ id: "default", rows: [{ ...model.sections[0].rows[0], title: fullTitle }] }]
    }, copy, vi.fn());

    expect(container.querySelector(".taskmate-title")?.textContent)
      .toBe(`${"あ".repeat(99)}${familyEmoji}…`);
  });

  it("shows a deadline separately from the scheduled date and highlights a missed one", () => {
    const container = document.createElement("div");
    const row = model.sections[0].rows[0];
    renderTaskList(container, {
      ...model,
      sections: [{ id: "default", rows: [
        { ...row, id: "missed", date: "2026-10-20", deadline: "2026-10-12", deadlineState: "overdue" },
        { ...row, id: "upcoming", date: null, deadline: "2026-10-30", deadlineState: "upcoming" }
      ] }]
    }, copy, vi.fn());
    const deadlines = Array.from(container.querySelectorAll<HTMLElement>(".taskmate-deadline"));
    expect(deadlines.map((element) => element.textContent)).toEqual(["Deadline passed 2026-10-12", "Deadline 2026-10-30"]);
    expect(deadlines[0].classList.contains("is-overdue")).toBe(true);
    expect(container.textContent).toContain("2026-10-20");
  });

  it("destroys renderer-owned resources", () => {
    const container = document.createElement("div");
    const dispatch = vi.fn();
    const rendered = renderTaskList(container, model, copy, dispatch);
    rendered.destroy();
    container.querySelector<HTMLButtonElement>(".taskmate-title")?.click();
    expect(sortableDestroy).toHaveBeenCalledOnce();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("does not target the document when no Task result scroller exists", () => {
    const container = document.createElement("div");
    renderTaskList(container, model, copy, vi.fn());
    expect(sortableCreate).toHaveBeenCalledWith(expect.any(HTMLElement), expect.not.objectContaining({
      scroll: expect.anything()
    }));
  });

  it("applies variable auto-scroll to the Task result region and resets timing after drop", () => {
    const container = document.createElement("div");
    container.className = "taskmate-scroll-region";
    Object.defineProperties(container, {
      clientHeight: { value: 600 },
      scrollHeight: { value: 1200 }
    });
    container.scrollTop = 100;
    container.getBoundingClientRect = () => ({
      top: 100,
      bottom: 700,
      height: 600,
      left: 0,
      right: 320,
      width: 320,
      x: 0,
      y: 100,
      toJSON: () => ({})
    });
    renderTaskList(container, model, copy, vi.fn());
    const calls = sortableCreate.mock.calls as unknown as Array<[HTMLElement, {
      scrollFn?: (offsetX: number, offsetY: number, originalEvent: Event, touchEvent: TouchEvent, target: HTMLElement) => void;
      onEnd?: (event: { oldIndex?: number; newIndex?: number }) => void;
    }]>;
    const options = calls[0]?.[1];
    const now = vi.spyOn(performance, "now")
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(116)
      .mockReturnValueOnce(200);
    const pointer = { clientY: 700 } as MouseEvent;

    options?.scrollFn?.(0, 10, pointer, pointer as unknown as TouchEvent, container);
    expect(container.scrollTop).toBe(100);
    options?.scrollFn?.(0, 10, pointer, pointer as unknown as TouchEvent, container);
    expect(container.scrollTop).toBeCloseTo(116);
    options?.onEnd?.({ oldIndex: 0, newIndex: 0 });
    options?.scrollFn?.(0, 10, pointer, pointer as unknown as TouchEvent, container);
    expect(container.scrollTop).toBeCloseTo(116);
    now.mockRestore();
  });

  it("returns a Task to its original position when it is dropped outside the Task result region", () => {
    const container = document.createElement("div");
    container.className = "taskmate-scroll-region";
    container.getBoundingClientRect = () => ({
      top: 100, bottom: 700, height: 600, left: 0, right: 320, width: 320, x: 0, y: 100, toJSON: () => ({})
    });
    document.body.append(container);
    const dispatch = vi.fn();
    const rows = ["task-1", "task-2", "task-3"].map((id) => ({ ...model.sections[0].rows[0], id, title: id }));
    renderTaskList(container, { ...model, sections: [{ id: "default", rows }] }, copy, dispatch);
    const list = container.querySelector<HTMLElement>(".taskmate-task")?.parentElement as HTMLElement;
    const options = (sortableCreate.mock.calls as unknown as Array<[HTMLElement, {
      onStart?: (event: { originalEvent: Event }) => void;
      onEnd?: (event: { item: HTMLElement; oldIndex?: number; newIndex?: number }) => void;
    }]>)[0]?.[1];
    const order = (): string[] => Array.from(list.querySelectorAll<HTMLElement>(".taskmate-task"))
      .map((element) => element.dataset.taskId ?? "");
    const moveFirstTaskToEnd = (start: Event, during: () => void): void => {
      const item = list.querySelector<HTMLElement>('[data-task-id="task-1"]') as HTMLElement;
      options?.onStart?.({ originalEvent: start });
      list.append(item);
      during();
      options?.onEnd?.({ item, oldIndex: 0, newIndex: 2 });
    };
    const touchDrag = (pointerY: number): void => moveFirstTaskToEnd(new MouseEvent("mousedown"), () => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 100, clientY: pointerY }));
    });
    const nativeDrag = (dropTarget: HTMLElement | null): void => moveFirstTaskToEnd(new Event("dragstart"), () => {
      // A native drag stops reporting the pointer once it leaves the window, so its last position stays inside.
      document.dispatchEvent(new MouseEvent("dragover", { clientX: 100, clientY: 650 }));
      dropTarget?.dispatchEvent(new Event("drop", { bubbles: true }));
    });

    touchDrag(40);
    expect(order()).toEqual(["task-1", "task-2", "task-3"]);
    nativeDrag(null);
    expect(order()).toEqual(["task-1", "task-2", "task-3"]);
    nativeDrag(document.body);
    expect(order()).toEqual(["task-1", "task-2", "task-3"]);
    expect(dispatch).not.toHaveBeenCalled();

    nativeDrag(list);
    expect(order()).toEqual(["task-2", "task-3", "task-1"]);
    expect(dispatch).toHaveBeenCalledWith({ type: "reorder", taskId: "task-1", previousId: "task-3", nextId: null });

    dispatch.mockClear();
    list.prepend(list.querySelector<HTMLElement>('[data-task-id="task-1"]') as HTMLElement);
    touchDrag(650);
    expect(order()).toEqual(["task-2", "task-3", "task-1"]);
    expect(dispatch).toHaveBeenCalledWith({ type: "reorder", taskId: "task-1", previousId: "task-3", nextId: null });
  });

  it("keeps a Scheduled Task inside its date section", () => {
    const container = document.createElement("div");
    container.className = "taskmate-scroll-region";
    document.body.append(container);
    const dispatch = vi.fn();
    const row = (id: string) => ({ ...model.sections[0].rows[0], id, title: id });
    renderTaskList(container, {
      ...model,
      grouping: "scheduled",
      sections: [
        { id: "overdue", rows: [row("overdue-1"), row("overdue-2")] },
        { id: "later", rows: [row("later-1"), row("later-2")] }
      ]
    }, copy, dispatch);
    const list = container.querySelector<HTMLElement>(".taskmate-list") as HTMLElement;
    const options = (sortableCreate.mock.calls as unknown as Array<[HTMLElement, {
      onMove?: (event: { dragged: HTMLElement; related: HTMLElement; willInsertAfter?: boolean }) => boolean;
      onEnd?: (event: { item: HTMLElement; oldIndex?: number; newIndex?: number }) => void;
    }]>)[0]?.[1];
    const task = (id: string) => list.querySelector<HTMLElement>(`[data-task-id="${id}"]`) as HTMLElement;
    const laterHeading = list.querySelector<HTMLElement>(".taskmate-task-section-heading.is-later") as HTMLElement;
    const order = (): string[] => Array.from(list.querySelectorAll<HTMLElement>(".taskmate-task"))
      .map((element) => element.dataset.taskId ?? "");

    expect(options?.onMove?.({ dragged: task("overdue-1"), related: task("overdue-2"), willInsertAfter: true })).toBe(true);
    expect(options?.onMove?.({ dragged: task("overdue-1"), related: laterHeading, willInsertAfter: false })).toBe(true);
    expect(options?.onMove?.({ dragged: task("overdue-1"), related: laterHeading, willInsertAfter: true })).toBe(false);
    expect(options?.onMove?.({ dragged: task("overdue-1"), related: task("later-1"), willInsertAfter: false })).toBe(false);

    const item = task("overdue-1");
    list.append(item);
    options?.onEnd?.({ item, oldIndex: 1, newIndex: 6 });
    expect(order()).toEqual(["overdue-1", "overdue-2", "later-1", "later-2"]);
    expect(dispatch).not.toHaveBeenCalled();
    // A blocked move parks the Task at the end of its own section; releasing it over
    // the next section must still return it instead of saving the parked position.
    const onStart = (sortableCreate.mock.calls as unknown as Array<[HTMLElement, {
      onStart?: (event: { originalEvent: Event }) => void;
    }]>)[0]?.[1].onStart;
    const elementFromPoint = vi.fn(() => task("later-1"));
    Object.defineProperty(document, "elementFromPoint", { value: elementFromPoint, configurable: true });
    onStart?.({ originalEvent: new Event("dragstart") });
    task("overdue-2").after(item);
    document.dispatchEvent(new MouseEvent("dragover", { clientX: 100, clientY: 400 }));
    list.dispatchEvent(new Event("drop", { bubbles: true }));
    options?.onEnd?.({ item, oldIndex: 1, newIndex: 2 });
    expect(elementFromPoint).toHaveBeenCalledWith(100, 400);
    expect(order()).toEqual(["overdue-1", "overdue-2", "later-1", "later-2"]);
    expect(dispatch).not.toHaveBeenCalled();
    Reflect.deleteProperty(document, "elementFromPoint");
  });
});
