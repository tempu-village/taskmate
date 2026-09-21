/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { captureTaskListScrollTop, restoreTaskListScrollTop } from "../src/scroll-position";

describe("task-list scroll position", () => {
  it("restores the captured position after the scroll region is replaced", () => {
    const root = document.createElement("div");
    const previous = document.createElement("div");
    previous.className = "taskmate-scroll-region";
    previous.scrollTop = 640;
    root.append(previous);

    const captured = captureTaskListScrollTop(root);
    const replacement = document.createElement("div");
    replacement.className = "taskmate-scroll-region";
    root.replaceChildren(replacement);

    restoreTaskListScrollTop(root, captured);

    expect(captured).toBe(640);
    expect(replacement.scrollTop).toBe(640);
  });

  it("does nothing when no task-list scroll region was captured", () => {
    const root = document.createElement("div");
    expect(captureTaskListScrollTop(root)).toBeNull();

    const replacement = document.createElement("div");
    replacement.className = "taskmate-scroll-region";
    replacement.scrollTop = 120;
    root.append(replacement);

    restoreTaskListScrollTop(root, null);
    expect(replacement.scrollTop).toBe(120);
  });
});
