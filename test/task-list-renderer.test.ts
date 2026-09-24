/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskListModel } from "../src/task-list-model";
import { renderTaskList } from "../src/task-list-renderer";

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
      delayOnTouchOnly: true
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

  it("destroys renderer-owned resources", () => {
    const container = document.createElement("div");
    const dispatch = vi.fn();
    const rendered = renderTaskList(container, model, copy, dispatch);
    rendered.destroy();
    container.querySelector<HTMLButtonElement>(".taskmate-title")?.click();
    expect(sortableDestroy).toHaveBeenCalledOnce();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
