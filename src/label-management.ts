import type { Task } from "./domain";
import { normalizeLabels } from "./task-input-suggestions";

export interface ManagedLabel {
  label: string;
  taskCount: number;
  storedOnly: boolean;
}

export function buildManagedLabels(
  tasks: Iterable<Pick<Task, "labels">>,
  recentLabels: Iterable<string>,
  favoriteLabels: Iterable<string>
): ManagedLabel[] {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    for (const label of normalizeLabels(task.labels)) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const labels = normalizeLabels([...counts.keys(), ...recentLabels, ...favoriteLabels]);
  return labels.map((label) => ({
    label,
    taskCount: counts.get(label) ?? 0,
    storedOnly: !counts.has(label)
  }));
}

export function normalizeManagedLabel(value: string): string | null {
  const labels = normalizeLabels(value.split(","));
  return labels.length === 1 ? labels[0] : null;
}

export function renameLabelValues(labels: Iterable<string>, from: string, to: string): string[] {
  return normalizeLabels([...labels].map((label) => label === from ? to : label));
}

export function removeLabelValue(labels: Iterable<string>, label: string): string[] {
  return normalizeLabels(labels).filter((item) => item !== label);
}

