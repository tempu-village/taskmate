import type { Priority, Task, TaskDraft } from "./domain";
import { encodeTaskBody, parseTaskBody } from "./task-body";
import { formatRepeat, parseRepeat, parseTime } from "./schedule";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

const TASK_PROPERTY_LINES = {
  type: (task: Task) => "type: todo",
  id: (task: Task) => `id: ${scalar(task.id)}`,
  completed: (task: Task) => `completed: ${scalar(task.completed)}`,
  date: (task: Task) => `date: ${scalar(task.date)}`,
  deadline: (task: Task) => `deadline: ${scalar(task.deadline)}`,
  time: (task: Task) => task.time === null ? null : `time: ${scalar(task.time)}`,
  repeat: (task: Task) => task.repeat === null ? null : `repeat: ${scalar(formatRepeat(task.repeat))}`,
  priority: (task: Task) => `priority: ${scalar(task.priority)}`,
  labels: (task: Task) => `labels: ${JSON.stringify(task.labels)}`,
  project: (task: Task) => `project: ${scalar(task.projectId)}`,
  rank: (task: Task) => `rank: ${scalar(task.rank)}`,
  "created-at": (task: Task) => `created-at: ${scalar(task.createdAt)}`,
  "updated-at": (task: Task) => `updated-at: ${scalar(task.updatedAt)}`,
  "completed-at": (task: Task) => `completed-at: ${scalar(task.completedAt)}`,
  "source-note": (task: Task) => `source-note: ${scalar(task.sourceNote)}`
} satisfies Record<string, (task: Task) => string | null>;

// Optional schedule properties are omitted when unset. An unreadable value is ignored and kept as written.
const SCHEDULE_PROPERTY_PARSERS: Record<string, (value: unknown) => unknown> = {
  time: parseTime,
  repeat: parseRepeat
};

const LEGACY_TASK_PROPERTIES = new Set(["important"]);

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
  const parsedBody = parseTaskBody(lines.filter((_, index) => index !== heading).join("\n").trim());

  return {
    path,
    id: properties.id,
    title,
    completed: properties.completed === true,
    date: typeof properties.date === "string" ? properties.date : null,
    deadline: typeof properties.deadline === "string" ? properties.deadline : null,
    time: parseTime(properties.time),
    repeat: parseRepeat(properties.repeat),
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
    steps: parsedBody.steps,
    stepSectionRemainder: parsedBody.stepSectionRemainder,
    notes: parsedBody.notes
  };
}

export function encodeTask(task: Task): string {
  const lines = Object.values(TASK_PROPERTY_LINES).map((line) => line(task)).filter((line): line is string => line !== null);
  const frontmatter = ["---", ...lines, "---"].join("\n");
  const body = encodeTaskBody(task.steps, task.notes, task.stepSectionRemainder);
  return `${frontmatter}\n\n# ${task.title.trim()}${body ? `\n\n${body}` : ""}\n`;
}

export function encodeTaskPreservingProperties(task: Task, currentContent: string): string {
  const match = currentContent.match(FRONTMATTER);
  if (!match) return encodeTask(task);

  const emitted = new Set<string>();
  const frontmatterLines: string[] = [];
  for (const line of match[1].split(/\r?\n/)) {
    const property = line.match(/^([^\s:#][^:]*):/)?.[1]?.trim();
    if (!property) {
      frontmatterLines.push(line);
      continue;
    }
    const render = TASK_PROPERTY_LINES[property as keyof typeof TASK_PROPERTY_LINES];
    if (render) {
      const rendered = render(task);
      const parseSchedule = SCHEDULE_PROPERTY_PARSERS[property];
      const unreadable = rendered === null && parseSchedule !== undefined
        && parseScalar(line.slice(line.indexOf(":") + 1)) !== null
        && parseSchedule(parseScalar(line.slice(line.indexOf(":") + 1))) === null;
      if (!emitted.has(property)) {
        if (unreadable) frontmatterLines.push(line);
        else if (rendered !== null) frontmatterLines.push(rendered);
      }
      emitted.add(property);
      continue;
    }
    if (!LEGACY_TASK_PROPERTIES.has(property)) frontmatterLines.push(line);
  }
  for (const [property, render] of Object.entries(TASK_PROPERTY_LINES)) {
    const rendered = render(task);
    if (!emitted.has(property) && rendered !== null) frontmatterLines.push(rendered);
  }

  const body = encodeTaskBody(task.steps, task.notes, task.stepSectionRemainder);
  return `---\n${frontmatterLines.join("\n")}\n---\n\n# ${task.title.trim()}${body ? `\n\n${body}` : ""}\n`;
}

export function taskFromDraft(id: string, path: string, draft: TaskDraft, rank: number, now: string): Task {
  return {
    path,
    id,
    title: draft.title.trim(),
    completed: false,
    date: draft.date,
    deadline: draft.deadline,
    time: draft.time,
    repeat: draft.repeat,
    priority: draft.priority,
    labels: draft.labels,
    projectId: draft.projectId,
    rank,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    sourceNote: draft.sourceNote ?? null,
    steps: draft.steps.map((step) => ({ ...step })),
    stepSectionRemainder: "",
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
