import { describe, expect, it } from "vitest";
import { availableFilterLabels, buildLabelGroups, suggestedLabels, toggleFavoriteLabel } from "../src/label-picker-model";

describe("label picker model", () => {
  it("offers labels from incomplete tasks unless completed tasks are included", () => {
    const tasks = [
      { completed: false, labels: ["Work", "Calls"] },
      { completed: false, labels: ["Work"] },
      { completed: true, labels: ["Archive"] }
    ];

    expect(availableFilterLabels(tasks, false)).toEqual(["Work", "Calls"]);
    expect(availableFilterLabels(tasks, true)).toEqual(["Work", "Calls", "Archive"]);
  });

  it("shows only populated indexed groups and sorts labels for the active locale", () => {
    expect(buildLabelGroups(["Work", "Admin", "あとで", "会議", "2026"], "", "ja")).toEqual([
      { id: "latin:A", labels: ["Admin"] },
      { id: "latin:W", labels: ["Work"] },
      { id: "japanese", labels: ["あとで", "会議"] },
      { id: "other", labels: ["2026"] }
    ]);
  });

  it("filters before building the index so empty initials disappear", () => {
    expect(buildLabelGroups(["Admin", "Calls", "Design"], "de", "en")).toEqual([
      { id: "latin:D", labels: ["Design"] }
    ]);
  });

  it("keeps favorites first and backfills recent suggestions without duplicates", () => {
    expect(suggestedLabels(
      ["Work", "Calls", "Design", "Personal"],
      ["Work", "Calls"],
      ["Work", "Design", "Calls", "Personal"]
    )).toEqual({ favorites: ["Work", "Calls"], recent: ["Design", "Personal"] });
  });

  it("adds favorites newest-first, removes them, and refuses silent eviction", () => {
    expect(toggleFavoriteLabel(["Work"], "Calls")).toEqual({
      favorites: ["Calls", "Work"], changed: true, atLimit: false
    });
    expect(toggleFavoriteLabel(["Calls", "Work"], "Calls")).toEqual({
      favorites: ["Work"], changed: true, atLimit: false
    });
    expect(toggleFavoriteLabel(["A", "B"], "C", 2)).toEqual({
      favorites: ["A", "B"], changed: false, atLimit: true
    });
  });
});
