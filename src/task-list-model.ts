import { groupScheduledTasks, sortTasks } from "./domain";
import type { Project, SortDirection, SortMode, Task } from "./domain";

export type TaskListGrouping = "flat" | "scheduled";
export type TaskListSectionId = "default" | "overdue" | "today" | "later";

export interface TaskListRow {
  id: string;
  title: string;
  completed: boolean;
  date: string | null;
  priority: Task["priority"];
  projectName: string | null;
  labels: string[];
}

export interface TaskListSection {
  id: TaskListSectionId;
  rows: TaskListRow[];
}

export interface TaskListModel {
  grouping: TaskListGrouping;
  sections: TaskListSection[];
  reorderEnabled: boolean;
}

export interface TaskListModelInput {
  tasks: Task[];
  projects: Project[];
  grouping: TaskListGrouping;
  sortMode: SortMode;
  sortDirection: SortDirection;
  allowReorder: boolean;
  today?: string;
}

function toRow(task: Task, projectNames: Map<string, string>): TaskListRow {
  return {
    id: task.id,
    title: task.title,
    completed: task.completed,
    date: task.date,
    priority: task.priority,
    projectName: task.projectId ? projectNames.get(task.projectId) ?? null : null,
    labels: task.labels.slice(0, 3)
  };
}

export function buildTaskListModel(input: TaskListModelInput): TaskListModel {
  const projectNames = new Map(input.projects.map((project) => [project.id, project.name]));
  const toSortedRows = (tasks: Task[]) => sortTasks(tasks, input.sortMode, input.sortDirection)
    .map((task) => toRow(task, projectNames));

  if (input.grouping === "flat") {
    return {
      grouping: "flat",
      sections: [{ id: "default", rows: toSortedRows(input.tasks) }],
      reorderEnabled: input.allowReorder && input.sortMode === "manual"
    };
  }

  const groups = groupScheduledTasks(input.tasks, input.today);
  const sections = (["overdue", "today", "later"] as const)
    .map((id) => ({ id, rows: toSortedRows(groups[id]) }))
    .filter((section) => section.rows.length > 0);
  return {
    grouping: "scheduled",
    sections,
    reorderEnabled: input.allowReorder && input.sortMode === "manual"
  };
}
