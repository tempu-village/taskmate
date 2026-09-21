import { describe, expect, it } from "vitest";
import { shouldCommitLabelOnEnter, updateLabelChipInput } from "../src/label-chip-input";

describe("label chip input", () => {
  it("commits completed comma-delimited segments and retains the unfinished segment", () => {
    expect(updateLabelChipInput(["既存"], "仕事, 連絡", false)).toEqual({
      labels: ["既存", "仕事"],
      pending: "連絡"
    });
    expect(updateLabelChipInput([], "仕事, 連絡,", false)).toEqual({
      labels: ["仕事", "連絡"],
      pending: ""
    });
  });

  it("commits the pending segment for Add, Enter, or Save without empty or duplicate labels", () => {
    expect(updateLabelChipInput(["仕事"], " 仕事, 連絡 ", true)).toEqual({
      labels: ["仕事", "連絡"],
      pending: ""
    });
  });

  it("respects the label limit", () => {
    expect(updateLabelChipInput(["A", "B"], "C", true, 2)).toEqual({
      labels: ["A", "B"],
      pending: ""
    });
  });

  it("uses Enter only after IME composition has finished", () => {
    expect(shouldCommitLabelOnEnter("Enter", true)).toBe(false);
    expect(shouldCommitLabelOnEnter("Enter", false, 229)).toBe(false);
    expect(shouldCommitLabelOnEnter("Enter", false)).toBe(true);
    expect(shouldCommitLabelOnEnter(",", false)).toBe(false);
  });
});
