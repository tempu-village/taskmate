import type { Priority, Task, TaskDraft } from "./domain";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

function scalar(value: string | null | boolean | number): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

function parseScalar(value: string): string | string[] | number | boolean | null {
  const trimmed = value.trim();
  if (trimmed === "null" || trimmed === "") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed.startsWith('"') || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed) as string | string[];
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function readFrontmatter(content: string): Record<string, string | string[] | number | boolean | null> {
  const match = content.match(FRONTMATTER);
  if (!match) return {};
  const result: Record<string, string | string[] | number | boolean | null> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 1 || line.startsWith(" ")) continue;
    result[line.slice(0, separator).trim()] = parseScalar(line.slice(separator + 1));
  }
  return result;
}

function bodyWithoutFrontmatter(content: string): string {
  return content.replace(FRONTMATTER, "");
}

export function parseTaskMarkdown(path: string, content: string): Task | null {
  const properties = readFrontmatter(content);
  if (properties.type !== "todo" || typeof properties.id !== "string") return null;
  const body = bodyWithoutFrontmatter(content).trim();
  const lines = body.split(/\r?\n/);
  const heading = lines.findIndex((line) => line.startsWith("# "));
  const title = heading >= 0 ? lines[heading].slice(2).trim() : "Untitled task";
  const notes = lines.filter((_, index) => index !== heading).join("\n").trim();

  return {
    path,
    id: properties.id,
    title,
    completed: properties.completed === true,
    date: typeof properties.date === "string" ? properties.date : null,
    priority: properties.priority === 1 || properties.priority === 2 || properties.priority === 3
      ? properties.priority as Priority
      : properties.important === true ? 1 : null,
    labels: Array.isArray(properties.labels) ? properties.labels.filter((label): label is string => typeof label === "string") : [],
    projectId: typeof properties.project === "string" ? properties.project : null,
    rank: typeof properties.rank === "number" ? properties.rank : 0,
    createdAt: typeof properties["created-at"] === "string" ? properties["created-at"] : "",
    updatedAt: typeof properties["updated-at"] === "string" ? properties["updated-at"] : "",
    completedAt: typeof properties["completed-at"] === "string" ? properties["completed-at"] : null,
    sourceNote: typeof properties["source-note"] === "string" ? properties["source-note"] : null,
    notes
  };
}

export function encodeTask(task: Task): string {
  const frontmatter = [
    "---",
    "type: todo",
    `id: ${scalar(task.id)}`,
    `completed: ${scalar(task.completed)}`,
    `date: ${scalar(task.date)}`,
    `priority: ${scalar(task.priority)}`,
    `labels: ${JSON.stringify(task.labels)}`,
    `project: ${scalar(task.projectId)}`,
    `rank: ${scalar(task.rank)}`,
    `created-at: ${scalar(task.createdAt)}`,
    `updated-at: ${scalar(task.updatedAt)}`,
    `completed-at: ${scalar(task.completedAt)}`,
    `source-note: ${scalar(task.sourceNote)}`,
    "---"
  ].join("\n");
  const notes = task.notes.trim();
  return `${frontmatter}\n\n# ${task.title.trim()}${notes ? `\n\n${notes}` : ""}\n`;
}

export function taskFromDraft(id: string, path: string, draft: TaskDraft, rank: number, now: string): Task {
  return {
    path,
    id,
    title: draft.title.trim(),
    completed: false,
    date: draft.date,
    priority: draft.priority,
    labels: draft.labels,
    projectId: draft.projectId,
    rank,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    sourceNote: draft.sourceNote ?? null,
    notes: draft.notes.trim()
  };
}

function readableTaskFileStem(title: string): string {
  return title
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|#^[\]]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/^[.\s-]+|[.\s-]+$/g, "")
    .slice(0, 80)
    .trim() || "task";
}

export function taskFileName(title: string, duplicateNumber = 1): string {
  const suffix = duplicateNumber > 1 ? ` (${duplicateNumber})` : "";
  return `${readableTaskFileStem(title)}${suffix}.md`;
}

export function nextAvailableTaskFileName(title: string, isTaken: (fileName: string) => boolean): string {
  for (let duplicateNumber = 1; ; duplicateNumber += 1) {
    const candidate = taskFileName(title, duplicateNumber);
    if (!isTaken(candidate)) return candidate;
  }
}

export function legacyTaskFileName(title: string, id: string): string {
  return `${readableTaskFileStem(title)}--${id.slice(0, 8)}.md`;
}
