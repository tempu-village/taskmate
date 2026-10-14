/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { captureReviewPosition, restoreReviewPosition } from "../src/task-change-review-scroll";

describe("Task change review position", () => {
  it("restores numeric scrollTop after a selection redraw", () => {
    const container = document.createElement("div");
    container.scrollTop = 480;
    const position = captureReviewPosition(container, "scroll");
    container.scrollTop = 0;

    restoreReviewPosition(container, position);

    expect(container.scrollTop).toBe(480);
  });

  it("restores the nearest review anchor after a display-mode redraw", () => {
    const container = document.createElement("div");
    container.scrollTop = 300;
    container.getBoundingClientRect = () => ({ top: 100 } as DOMRect);
    const first = document.createElement("div");
    first.dataset.reviewAnchor = "T-01";
    first.getBoundingClientRect = () => ({ top: 70 } as DOMRect);
    const nearest = document.createElement("div");
    nearest.dataset.reviewAnchor = "C-02";
    nearest.getBoundingClientRect = () => ({ top: 108 } as DOMRect);
    container.append(first, nearest);

    const position = captureReviewPosition(container, "anchor");
    container.replaceChildren();
    const replacement = document.createElement("div");
    replacement.dataset.reviewAnchor = "C-02";
    replacement.getBoundingClientRect = () => ({ top: 148 } as DOMRect);
    container.append(replacement);
    container.scrollTop = 0;

    restoreReviewPosition(container, position);

    expect(position).toEqual({ kind: "anchor", anchorId: "C-02", offset: 8, scrollTop: 300 });
    expect(container.scrollTop).toBe(340);
  });
});
