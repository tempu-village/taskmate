import { describe, expect, it } from "vitest";
import {
  calculateKeyboardLayout,
  clampScrollTop
} from "../src/mobile-keyboard-layout";

describe("mobile keyboard layout", () => {
  it("subtracts host shrinkage instead of applying keyboard coverage twice", () => {
    expect(calculateKeyboardLayout({
      keyboardOcclusion: 300,
      hostShrink: 300,
      alignmentShortfall: 0
    })).toEqual({ keyboardClearance: 0, alignmentClearance: 0, totalClearance: 0 });

    expect(calculateKeyboardLayout({
      keyboardOcclusion: 300,
      hostShrink: 200,
      alignmentShortfall: 0
    })).toEqual({ keyboardClearance: 100, alignmentClearance: 0, totalClearance: 100 });
  });

  it("keeps alignment clearance separate and never returns negative space", () => {
    expect(calculateKeyboardLayout({
      keyboardOcclusion: 200,
      hostShrink: 260,
      alignmentShortfall: 48
    })).toEqual({ keyboardClearance: 0, alignmentClearance: 48, totalClearance: 48 });
  });

  it("clamps the current position after temporary clearance disappears", () => {
    expect(clampScrollTop(520, 680, 300)).toBe(380);
    expect(clampScrollTop(120, 680, 300)).toBe(120);
    expect(clampScrollTop(-20, 680, 300)).toBe(0);
  });
});
