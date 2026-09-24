import { describe, expect, it } from "vitest";
import type { TaskStep } from "../src/domain";
import { moveTaskStep, stepDateState } from "../src/task-steps";
const steps: TaskStep[] = [
  { text: "First", completed: false, date: null },
  { text: "Second", completed: true, date: "2026-10-01" },
  { text: "Third", completed: false, date: null }
];
describe("Task Steps", () => {
  it("reorders the whole Step", () => { expect(moveTaskStep(steps, 1, 0)).toEqual([steps[1], steps[0], steps[2]]); });
  it("uses the supplied local date", () => {
    expect(stepDateState("2026-09-22", "2026-09-23")).toBe("overdue");
    expect(stepDateState("2026-09-23", "2026-09-23")).toBe("today");
  });
});
