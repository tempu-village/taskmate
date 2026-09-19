import type { Priority, Task } from "./domain";

export interface BulkTaskChanges {
  date?: string | null;
  projectId?: string | null;
  priority?: Priority | null;
  addLabels: string[];
  removeLabels: string[];
}

export type BulkTaskPatch = Partial<Pick<Task, "date" | "projectId" | "priority" | "labels">>;

export function buildBulkTaskPatch(task: Task, changes: BulkTaskChanges): BulkTaskPatch {
  const labels = task.labels
    .filter((label) => !changes.removeLabels.includes(label))
    .concat(changes.addLabels.filter((label) => !task.labels.includes(label)))
    .slice(0, 500);
  const patch: BulkTaskPatch = { labels };
  if ("date" in changes) patch.date = changes.date;
  if ("projectId" in changes) patch.projectId = changes.projectId;
  if ("priority" in changes) patch.priority = changes.priority;
  return patch;
}

export function failedBulkTasks(
  tasks: Task[],
  results: PromiseSettledResult<unknown>[]
): Task[] {
  return tasks.filter((_, index) => results[index]?.status === "rejected");
}
