/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { isComposingInput } from "../../src/shared/input-composition";

describe("isComposingInput", () => {
  it("reads isComposing from an input event", () => {
    expect(isComposingInput(new InputEvent("input", { isComposing: true }))).toBe(true);
    expect(isComposingInput(new InputEvent("input", { isComposing: false }))).toBe(false);
  });

  it("treats an event without the flag as not composing", () => {
    expect(isComposingInput(new Event("input"))).toBe(false);
  });
});
