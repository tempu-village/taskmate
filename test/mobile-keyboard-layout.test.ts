import { describe, expect, it } from "vitest";
import {
  calculateModalFit,
  calculateKeyboardLayout,
  clampScrollTop,
  retainAlignmentClearance
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

  it("fits and shifts the complete modal into the host region", () => {
    expect(calculateModalFit(
      { top: 114, bottom: 598, height: 484 },
      { top: 263, bottom: 731, height: 468 },
      0
    )).toEqual({ availableHeight: 468, shift: -141 });

    expect(calculateModalFit(
      { top: 114, bottom: 994, height: 880 },
      { top: 180, bottom: 900, height: 720 },
      0
    )).toEqual({ availableHeight: 864, shift: 0 });
  });

  it("does not remove alignment clearance during repeated resize observations", () => {
    expect(retainAlignmentClearance(72, 0, true)).toBe(72);
    expect(retainAlignmentClearance(72, 96, true)).toBe(96);
    expect(retainAlignmentClearance(72, 0, false)).toBe(0);
  });
});
