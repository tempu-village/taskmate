import type { TaskStep } from "./domain";
export type StepDateState = "overdue" | "today" | "later" | "none";
export function moveTaskStep(steps: TaskStep[], from: number, to: number): TaskStep[] {
  const reordered = steps.map((step) => ({ ...step }));
  if (from < 0 || from >= steps.length || to < 0 || to >= steps.length || from === to) return reordered;
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);
  return reordered;
}
export function stepDateState(date: string | null, today: string): StepDateState {
  if (!date) return "none";
  if (date < today) return "overdue";
  if (date === today) return "today";
  return "later";
}
