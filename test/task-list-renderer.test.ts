/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskListModel } from "../src/task-list-model";
import { renderTaskList } from "../src/task-list-renderer";

const sortableDestroy = vi.fn();

vi.mock("sortablejs", () => ({
  default: {
    create: vi.fn(() => ({ destroy: sortableDestroy }))
  }
}));

const copy = {
  empty: "No tasks",
  reorderAriaLabel: "Reorder",
  completeAriaLabel: (title: string) => `Complete ${title}`,
  moreAriaLabel: "More",
  sectionTitles: { overdue: "Overdue", today: "Today", later: "Later" }
};

const model: TaskListModel = {
  grouping: "flat",
  reorderEnabled: true,
  sections: [{
    id: "default",
    rows: [{
      id: "task-1",
      title: "Test task",
      completed: false,
      date: "2026-09-19",
      priority: 1,
      projectName: "Project",
      labels: ["label"]
    }]
  }]
};

describe("task-list renderer", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    sortableDestroy.mockClear();
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
    container.querySelector<HTMLButtonElement>(".taskmate-more")?.click();

    expect(dispatch).toHaveBeenNthCalledWith(1, { type: "open", taskId: "task-1" });
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: "toggle-completed", taskId: "task-1", completed: true });
    expect(dispatch).toHaveBeenNthCalledWith(3, expect.objectContaining({
      type: "show-actions",
      taskId: "task-1",
      event: expect.any(MouseEvent)
    }));
    expect(container.textContent).toContain("Project");
    expect(container.textContent).toContain("#label");
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
