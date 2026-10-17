import { describe, expect, it } from "vitest";
import { filterLabelSuggestions, recordRecentLabels, recentLabelSuggestions } from "../../src/labels/label-suggestions";

describe("label suggestions", () => {
  it("keeps ten unique recent labels with newly saved labels first", () => {
    const history = Array.from({ length: 10 }, (_, index) => `label-${index + 1}`);
    expect(recordRecentLabels(history, ["仕事", "label-2", "#連絡", "仕事"])).toEqual([
      "仕事", "label-2", "連絡", "label-1", "label-3", "label-4", "label-5", "label-6", "label-7", "label-8"
    ]);
    expect(recentLabelSuggestions(["仕事", "仕事", " 連絡 "])).toEqual(["仕事", "連絡"]);
  });

  it("offers recent labels on focus and matching labels while typing", () => {
    const labels = ["仕事", "連絡", "私用", "資料"];
    expect(filterLabelSuggestions(labels, ["連絡", "仕事", "削除済み"], "", ["仕事"])).toEqual(["連絡"]);
    expect(filterLabelSuggestions(labels, [], "料", ["仕事"])).toEqual(["資料"]);
  });
});
