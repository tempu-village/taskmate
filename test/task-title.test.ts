import { describe, expect, it } from "vitest";
import { normalizeTaskTitleInput } from "../src/task-title";

describe("task title input", () => {
  it("keeps visual wrapping out of the stored single-line title", () => {
    expect(normalizeTaskTitleInput("長いタスク名")).toBe("長いタスク名");
    expect(normalizeTaskTitleInput("first\nsecond")).toBe("first second");
    expect(normalizeTaskTitleInput("first \r\n second")).toBe("first second");
    expect(normalizeTaskTitleInput("first\n\nsecond")).toBe("first second");
  });
});
