export type SmartView =
  | "today"
  | "seven-days"
  | "upcoming"
  | "all"
  | "unplanned"
  | "completed";

export type SortMode = "manual" | "date" | "priority" | "created";
export type Priority = 1 | 2 | 3;

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
  notes: string;
}

export interface TaskDraft {
  title: string;
  date: string | null;
  priority: Priority | null;
  labels: string[];
  projectId: string | null;
  notes: string;
  sourceNote?: string | null;
}

export interface TaskFilters {
  priorities: Priority[];
  labels: string[];
  search: string;
}

export const SMART_VIEW_LABELS: Record<SmartView, string> = {
  today: "今日",
  "seven-days": "7日間",
  upcoming: "今後",
  all: "すべて",
  unplanned: "未整理",
  completed: "完了"
};

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

export function taskMatchesView(task: Task, view: SmartView, today = todayKey()): boolean {
  if (view === "completed") return task.completed;
  if (task.completed) return false;

  switch (view) {
    case "today":
      return task.date !== null && task.date <= today;
    case "seven-days":
      return task.date !== null && task.date >= today && task.date <= addDays(today, 6);
    case "upcoming":
      return task.date !== null && task.date > today;
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
    if (!taskMatchesView(task, view, today)) return false;
    if (filters.priorities.length > 0 && (task.priority === null || !filters.priorities.includes(task.priority))) return false;
    if (filters.labels.length > 0 && !filters.labels.some((label) => task.labels.includes(label))) return false;
    return needle.length === 0 || `${task.title}\n${task.notes}\n${task.labels.join(" ")}`.toLocaleLowerCase().includes(needle);
  });
}

export function sortTasks(tasks: Task[], mode: SortMode): Task[] {
  const result = [...tasks];
  const rankThenCreated = (a: Task, b: Task) => a.rank - b.rank || a.createdAt.localeCompare(b.createdAt);

  switch (mode) {
    case "date":
      return result.sort((a, b) => (a.date ?? "9999-12-31").localeCompare(b.date ?? "9999-12-31") || rankThenCreated(a, b));
    case "priority":
      return result.sort((a, b) => (a.priority ?? 4) - (b.priority ?? 4) || rankThenCreated(a, b));
    case "created":
      return result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case "manual":
      return result.sort(rankThenCreated);
  }
}
