import { describe, expect, it } from "vitest";
import type { Task } from "../src/domain";
import {
  buildManagedLabels,
  normalizeManagedLabel,
  removeLabelValue,
  renameLabelValues
} from "../src/label-management";

function task(labels: string[]): Pick<Task, "labels"> {
  return { labels };
}

describe("label management", () => {
  it("combines task, recent, and favorite labels and marks stored-only values", () => {
    expect(buildManagedLabels(
      [task(["work", "shared"]), task(["shared", "done-only"])],
      ["recent-only", "shared"],
      ["favorite-only", "work"]
    )).toEqual([
      { label: "work", taskCount: 1, storedOnly: false },
      { label: "shared", taskCount: 2, storedOnly: false },
      { label: "done-only", taskCount: 1, storedOnly: false },
      { label: "recent-only", taskCount: 0, storedOnly: true },
      { label: "favorite-only", taskCount: 0, storedOnly: true }
    ]);
  });

  it("renames into an existing label without duplicates and reconciles saved lists", () => {
    expect(renameLabelValues(["old", "keep", "new"], "old", "new")).toEqual(["new", "keep"]);
    expect(renameLabelValues(["old", "other"], "missing", "new")).toEqual(["old", "other"]);
  });

  it("removes labels and accepts exactly one normalized destination", () => {
    expect(removeLabelValue(["remove", "keep", "remove"], "remove")).toEqual(["keep"]);
    expect(normalizeManagedLabel(" #renamed ")).toBe("renamed");
    expect(normalizeManagedLabel("one, two")).toBeNull();
    expect(normalizeManagedLabel("   ")).toBeNull();
  });
});

