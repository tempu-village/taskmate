import type { Task } from "../tasks/domain";
import type { TaskRepository } from "../tasks/repository";
import { failedTaskWrites } from "../tasks/task-writes";
import { removeLabelValue, renameLabelValues } from "./label-management";

export interface LabelPreferences {
  recentLabels: string[];
  favoriteLabels: string[];
}

export type LabelMaintenanceResult =
  | { kind: "applied"; affected: number; preferences: LabelPreferences }
  | { kind: "partial-failure"; affected: number; failed: Task[] };

type TaskWriter = Pick<TaskRepository, "update">;

export function renameLabelAcrossTasks(
  repository: TaskWriter,
  tasks: readonly Task[],
  preferences: LabelPreferences,
  from: string,
  to: string
): Promise<LabelMaintenanceResult> {
  return changeLabelAcrossTasks(repository, tasks, preferences, from, (labels) => renameLabelValues(labels, from, to));
}

export function removeLabelAcrossTasks(
  repository: TaskWriter,
  tasks: readonly Task[],
  preferences: LabelPreferences,
  label: string
): Promise<LabelMaintenanceResult> {
  return changeLabelAcrossTasks(repository, tasks, preferences, label, (labels) => removeLabelValue(labels, label));
}

async function changeLabelAcrossTasks(
  repository: TaskWriter,
  tasks: readonly Task[],
  preferences: LabelPreferences,
  label: string,
  change: (labels: Iterable<string>) => string[]
): Promise<LabelMaintenanceResult> {
  const affected = tasks.filter((task) => task.labels.includes(label));
  const failed = await failedTaskWrites(affected, (task) => repository.update(task, { labels: change(task.labels) }));
  if (failed.length > 0) return { kind: "partial-failure", affected: affected.length, failed };
  return {
    kind: "applied",
    affected: affected.length,
    preferences: {
      recentLabels: change(preferences.recentLabels),
      favoriteLabels: change(preferences.favoriteLabels)
    }
  };
}
