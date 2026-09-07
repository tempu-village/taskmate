import type { Task, TaskDraft } from "./domain";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

function scalar(value: string | null | boolean | number): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

function parseScalar(value: string): string | number | boolean | null {
  const trimmed = value.trim();
  if (trimmed === "null" || trimmed === "") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed.startsWith('"')) {
    try {
      return JSON.parse(trimmed) as string;
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function readFrontmatter(content: string): Record<string, string | number | boolean | null> {
  const match = content.match(FRONTMATTER);
  if (!match) return {};
  const result: Record<string, string | number | boolean | null> = {};
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
    important: properties.important === true,
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
    `important: ${scalar(task.important)}`,
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
    important: draft.important,
    rank,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    sourceNote: draft.sourceNote ?? null,
    notes: draft.notes.trim()
  };
}

export function taskFileName(title: string, id: string): string {
  const readable = title
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|#^[\]]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/^[.\s-]+|[.\s-]+$/g, "")
    .slice(0, 80)
    .trim() || "task";
  return `${readable}--${id.slice(0, 8)}.md`;
}
