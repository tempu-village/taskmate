import type { ProjectRepository } from "../projects/project-repository";
import type { Priority, Task } from "../tasks/domain";
import type { TaskRepository } from "../tasks/repository";
import { failedTaskWrites } from "../tasks/task-writes";

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

export interface BulkTaskRepositories {
  tasks: Pick<TaskRepository, "update">;
  projects: Pick<ProjectRepository, "list" | "touch">;
}

export async function applyBulkTaskChanges(
  repositories: BulkTaskRepositories,
  tasks: readonly Task[],
  changes: BulkTaskChanges
): Promise<Task[]> {
  const failed = await failedTaskWrites(tasks, (task) => repositories.tasks.update(task, buildBulkTaskPatch(task, changes)));
  if (typeof changes.projectId === "string") {
    const project = (await repositories.projects.list()).find((item) => item.id === changes.projectId);
    if (project) await repositories.projects.touch(project);
  }
  return failed;
}
