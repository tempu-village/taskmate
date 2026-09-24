export type SmartView = "scheduled" | "all" | "unplanned";

export type SortMode = "manual" | "date" | "priority" | "created";
export type SortDirection = "asc" | "desc";
export type Priority = 1 | 2 | 3;

export interface TaskStep { text: string; completed: boolean; date: string | null; }

export interface Project {
  path: string;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}

export interface Task {
  path: string;
  id: string;
  title: string;
  completed: boolean;
  date: string | null;
  priority: Priority | null;
  labels: string[];
  projectId: string | null;
  rank: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  sourceNote: string | null;
  steps: TaskStep[];
  stepSectionRemainder: string;
  notes: string;
}

export interface TaskDraft {
  title: string;
  date: string | null;
  priority: Priority | null;
  labels: string[];
  projectId: string | null;
  steps: TaskStep[];
  notes: string;
  sourceNote?: string | null;
}

export interface TaskFilters {
  priorities: Priority[];
  labels: string[];
  search: string;
  includeCompleted: boolean;
}

function localDateParts(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayKey(now = new Date()): string {
  return localDateParts(now);
}

export function addDays(dateKey: string, amount: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);
  return localDateParts(date);
}

export function taskMatchesView(task: Task, view: SmartView, today = todayKey(), includeCompleted = false): boolean {
  if (task.completed && !includeCompleted) return false;

  switch (view) {
    case "scheduled":
      return task.date !== null;
    case "unplanned":
      return task.date === null;
    case "all":
      return true;
    default:
      return false;
  }
}

export function filterTasks(tasks: Task[], view: SmartView, filters: TaskFilters, today?: string): Task[] {
  const needle = filters.search.trim().toLocaleLowerCase();
  return tasks.filter((task) => {
    if (!taskMatchesView(task, view, today, filters.includeCompleted)) return false;
    if (filters.priorities.length > 0 && (task.priority === null || !filters.priorities.includes(task.priority))) return false;
    if (filters.labels.length > 0 && !filters.labels.some((label) => task.labels.includes(label))) return false;
    const stepText = task.steps.map((step) => step.text).join("\n");
    return needle.length === 0 || `${task.title}\n${task.notes}\n${stepText}\n${task.labels.join(" ")}`.toLocaleLowerCase().includes(needle);
  });
}

export interface ScheduledTaskGroups {
  overdue: Task[];
  today: Task[];
  later: Task[];
}

export function groupScheduledTasks(tasks: Task[], today = todayKey(), includeCompleted = false): ScheduledTaskGroups {
  const scheduled = tasks.filter((task) => (includeCompleted || !task.completed) && task.date !== null);
  return {
    overdue: scheduled.filter((task) => task.date !== null && task.date < today),
    today: scheduled.filter((task) => task.date === today),
    later: scheduled.filter((task) => task.date !== null && task.date > today)
  };
}

export function sortTasks(tasks: Task[], mode: SortMode, direction: SortDirection = "asc"): Task[] {
  const result = [...tasks];
  const rankThenCreated = (a: Task, b: Task) => a.rank - b.rank || a.createdAt.localeCompare(b.createdAt);
  const directed = (comparison: number) => direction === "asc" ? comparison : -comparison;
  const compareNullable = <Value>(a: Value | null, b: Value | null, compare: (left: Value, right: Value) => number): number => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return directed(compare(a, b));
  };

  switch (mode) {
    case "date":
      return result.sort((a, b) => compareNullable(a.date, b.date, (left, right) => left.localeCompare(right)) || rankThenCreated(a, b));
    case "priority":
      return result.sort((a, b) => compareNullable(a.priority, b.priority, (left, right) => left - right) || rankThenCreated(a, b));
    case "created":
      return result.sort((a, b) => directed(a.createdAt.localeCompare(b.createdAt)) || rankThenCreated(a, b));
    case "manual":
      return result.sort(rankThenCreated);
  }
}
