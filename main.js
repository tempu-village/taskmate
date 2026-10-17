var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => TaskMatePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian16 = require("obsidian");

// src/tasks/repository.ts
var import_obsidian = require("obsidian");

// src/tasks/task-body.ts
var STEP_LINE = /^- \[([ xX])\](?: (.*))?$/;
var DUE_SUFFIX = /^(.*?)(?:\s+<!-- due: (\d{4}-\d{2}-\d{2}) -->)\s*$/;
function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
function splitStepDeadline(rawText) {
  let text = rawText;
  let date = null;
  while (true) {
    const due = text.match(DUE_SUFFIX);
    if (!due?.[2] || !isCalendarDate(due[2]) || !due[1].trim()) break;
    date ??= due[2];
    text = due[1].trimEnd();
  }
  return { text, date };
}
function normalizeTaskSteps(steps) {
  return steps.map((step) => {
    const parsed = splitStepDeadline(step.text.replace(/\r?\n/g, " ").trim());
    return { text: parsed.text, completed: step.completed, date: step.date && isCalendarDate(step.date) ? step.date : parsed.date };
  }).filter((step) => step.text.length > 0);
}
function parseTaskBody(body) {
  const lines = body.trim().split(/\r?\n/);
  if (lines.length === 1 && lines[0] === "") return { steps: [], notes: "", stepSectionRemainder: "" };
  const stepsHeading = lines.findIndex((line) => line.trim() === "## Steps");
  if (stepsHeading < 0) return { steps: [], notes: body.trim(), stepSectionRemainder: "" };
  const notesHeading = lines.findIndex((line, index2) => index2 > stepsHeading && line.trim() === "## Notes");
  const sectionEnd = notesHeading >= 0 ? notesHeading : lines.findIndex((line, index2) => index2 > stepsHeading && /^##\s+/.test(line));
  const end = sectionEnd >= 0 ? sectionEnd : lines.length;
  const steps = [];
  const remainder = [];
  for (const line of lines.slice(stepsHeading + 1, end)) {
    const checkbox = line.match(STEP_LINE);
    const rawText = checkbox?.[2]?.trim() ?? "";
    if (!checkbox || !rawText) {
      remainder.push(line);
      continue;
    }
    const parsed = splitStepDeadline(rawText);
    steps.push({ text: parsed.text, completed: checkbox[1].toLowerCase() === "x", date: parsed.date });
  }
  const before = lines.slice(0, stepsHeading).join("\n").trim();
  const after = notesHeading >= 0 ? lines.slice(notesHeading + 1).join("\n").trim() : "";
  return { steps, notes: [before, after].filter(Boolean).join("\n\n"), stepSectionRemainder: remainder.join("\n").trim() };
}
function encodeTaskBody(steps, notes, stepSectionRemainder = "") {
  const normalized = normalizeTaskSteps(steps);
  const remainder = stepSectionRemainder.trim();
  const trimmedNotes = notes.trim();
  if (normalized.length === 0 && !remainder) return trimmedNotes;
  const stepLines = normalized.map((step) => `- [${step.completed ? "x" : " "}] ${step.text}${step.date ? ` <!-- due: ${step.date} -->` : ""}`);
  const stepSection = ["## Steps", "", ...stepLines, ...remainder ? ["", remainder] : []].join("\n").trimEnd();
  return trimmedNotes ? `${stepSection}

## Notes

${trimmedNotes}` : stepSection;
}

// src/tasks/markdown.ts
var FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
var TASK_PROPERTY_LINES = {
  type: (task) => "type: todo",
  id: (task) => `id: ${scalar(task.id)}`,
  completed: (task) => `completed: ${scalar(task.completed)}`,
  date: (task) => `date: ${scalar(task.date)}`,
  priority: (task) => `priority: ${scalar(task.priority)}`,
  labels: (task) => `labels: ${JSON.stringify(task.labels)}`,
  project: (task) => `project: ${scalar(task.projectId)}`,
  rank: (task) => `rank: ${scalar(task.rank)}`,
  "created-at": (task) => `created-at: ${scalar(task.createdAt)}`,
  "updated-at": (task) => `updated-at: ${scalar(task.updatedAt)}`,
  "completed-at": (task) => `completed-at: ${scalar(task.completedAt)}`,
  "source-note": (task) => `source-note: ${scalar(task.sourceNote)}`
};
var LEGACY_TASK_PROPERTIES = /* @__PURE__ */ new Set(["important"]);
function scalar(value) {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}
function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === "null" || trimmed === "") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed.startsWith('"') || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}
function readFrontmatter(content) {
  const match = content.match(FRONTMATTER);
  if (!match) return {};
  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 1 || line.startsWith(" ")) continue;
    result[line.slice(0, separator).trim()] = parseScalar(line.slice(separator + 1));
  }
  return result;
}
function bodyWithoutFrontmatter(content) {
  return content.replace(FRONTMATTER, "");
}
function parseTaskMarkdown(path, content) {
  const properties2 = readFrontmatter(content);
  if (properties2.type !== "todo" || typeof properties2.id !== "string") return null;
  const body = bodyWithoutFrontmatter(content).trim();
  const lines = body.split(/\r?\n/);
  const heading = lines.findIndex((line) => line.startsWith("# "));
  const title = heading >= 0 ? lines[heading].slice(2).trim() : "Untitled task";
  const parsedBody = parseTaskBody(lines.filter((_, index2) => index2 !== heading).join("\n").trim());
  return {
    path,
    id: properties2.id,
    title,
    completed: properties2.completed === true,
    date: typeof properties2.date === "string" ? properties2.date : null,
    priority: properties2.priority === 1 || properties2.priority === 2 || properties2.priority === 3 ? properties2.priority : properties2.important === true ? 1 : null,
    labels: Array.isArray(properties2.labels) ? properties2.labels.filter((label) => typeof label === "string") : [],
    projectId: typeof properties2.project === "string" ? properties2.project : null,
    rank: typeof properties2.rank === "number" ? properties2.rank : 0,
    createdAt: typeof properties2["created-at"] === "string" ? properties2["created-at"] : "",
    updatedAt: typeof properties2["updated-at"] === "string" ? properties2["updated-at"] : "",
    completedAt: typeof properties2["completed-at"] === "string" ? properties2["completed-at"] : null,
    sourceNote: typeof properties2["source-note"] === "string" ? properties2["source-note"] : null,
    steps: parsedBody.steps,
    stepSectionRemainder: parsedBody.stepSectionRemainder,
    notes: parsedBody.notes
  };
}
function encodeTask(task) {
  const frontmatter = ["---", ...Object.values(TASK_PROPERTY_LINES).map((line) => line(task)), "---"].join("\n");
  const body = encodeTaskBody(task.steps, task.notes, task.stepSectionRemainder);
  return `${frontmatter}

# ${task.title.trim()}${body ? `

${body}` : ""}
`;
}
function encodeTaskPreservingProperties(task, currentContent) {
  const match = currentContent.match(FRONTMATTER);
  if (!match) return encodeTask(task);
  const emitted = /* @__PURE__ */ new Set();
  const frontmatterLines = [];
  for (const line of match[1].split(/\r?\n/)) {
    const property = line.match(/^([^\s:#][^:]*):/)?.[1]?.trim();
    if (!property) {
      frontmatterLines.push(line);
      continue;
    }
    const render = TASK_PROPERTY_LINES[property];
    if (render) {
      if (!emitted.has(property)) frontmatterLines.push(render(task));
      emitted.add(property);
      continue;
    }
    if (!LEGACY_TASK_PROPERTIES.has(property)) frontmatterLines.push(line);
  }
  for (const [property, render] of Object.entries(TASK_PROPERTY_LINES)) {
    if (!emitted.has(property)) frontmatterLines.push(render(task));
  }
  const body = encodeTaskBody(task.steps, task.notes, task.stepSectionRemainder);
  return `---
${frontmatterLines.join("\n")}
---

# ${task.title.trim()}${body ? `

${body}` : ""}
`;
}
function taskFromDraft(id, path, draft, rank, now) {
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
    steps: draft.steps.map((step) => ({ ...step })),
    stepSectionRemainder: "",
    notes: draft.notes.trim()
  };
}
function readableTaskFileStem(title) {
  return title.normalize("NFKC").replace(/[\\/:*?"<>|#^[\]]/g, "-").replace(/\s+/g, " ").replace(/-+/g, "-").replace(/^[.\s-]+|[.\s-]+$/g, "").slice(0, 80).trim() || "task";
}
function taskFileName(title, duplicateNumber = 1) {
  const suffix = duplicateNumber > 1 ? ` (${duplicateNumber})` : "";
  return `${readableTaskFileStem(title)}${suffix}.md`;
}
function nextAvailableTaskFileName(title, isTaken) {
  for (let duplicateNumber = 1; ; duplicateNumber += 1) {
    const candidate = taskFileName(title, duplicateNumber);
    if (!isTaken(candidate)) return candidate;
  }
}
function legacyTaskFileName(title, id) {
  return `${readableTaskFileStem(title)}--${id.slice(0, 8)}.md`;
}

// src/tasks/task-edit-merge.ts
var EDITABLE_TASK_FIELDS = [
  "title",
  "date",
  "priority",
  "labels",
  "projectId",
  "steps",
  "notes",
  "sourceNote"
];
function cloneValue(value) {
  if (Array.isArray(value)) return value.map((item) => typeof item === "object" && item !== null ? { ...item } : item);
  return value;
}
function isPlainObject(value) {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function valuesEqual(left, right) {
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index2) => valuesEqual(value, right[index2]));
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return leftKeys.length === rightKeys.length && leftKeys.every((key) => Object.hasOwn(right, key) && valuesEqual(left[key], right[key]));
  }
  return left === right;
}
function draftValue(draft, base, field) {
  if (field === "sourceNote" && draft.sourceNote === void 0) return base.sourceNote;
  return draft[field];
}
function assignEditableField(task, field, value) {
  task[field] = cloneValue(value);
}
function compareTaskEdit(base, draft, current) {
  const merged = { ...current, labels: [...current.labels], steps: cloneValue(current.steps) };
  const conflicts = [];
  let externalChangesPreserved = false;
  for (const field of EDITABLE_TASK_FIELDS) {
    const baseValue = base[field];
    const nextDraftValue = draftValue(draft, base, field);
    const currentValue = current[field];
    const draftChanged = !valuesEqual(nextDraftValue, baseValue);
    const currentChanged = !valuesEqual(currentValue, baseValue);
    if (draftChanged && currentChanged && !valuesEqual(nextDraftValue, currentValue)) {
      conflicts.push({
        field,
        baseValue: cloneValue(baseValue),
        currentValue: cloneValue(currentValue),
        draftValue: cloneValue(nextDraftValue)
      });
      continue;
    }
    if (draftChanged) assignEditableField(merged, field, nextDraftValue);
    else if (currentChanged) externalChangesPreserved = true;
  }
  return { merged, conflicts, externalChangesPreserved };
}
function applyTaskConflictChoices(comparison, choices) {
  const resolved = { ...comparison.merged, labels: [...comparison.merged.labels], steps: cloneValue(comparison.merged.steps) };
  for (const conflict of comparison.conflicts) {
    const choice = choices[conflict.field] ?? "current";
    assignEditableField(resolved, conflict.field, choice === "draft" ? conflict.draftValue : conflict.currentValue);
  }
  return resolved;
}

// src/tasks/repository.ts
var RANK_STEP = 1024;
var DuplicateTaskIdError = class extends Error {
  constructor(conflict) {
    super(`Duplicate task ID ${conflict.id}: ${conflict.paths.join(", ")}`);
    this.conflict = conflict;
  }
};
function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
var TaskRepository = class {
  constructor(app, taskFolder) {
    this.app = app;
    this.taskFolder = taskFolder;
  }
  knownPathsById = /* @__PURE__ */ new Map();
  indexedTaskPaths = null;
  folder() {
    return (0, import_obsidian.normalizePath)(this.taskFolder().trim() || "TaskMate/Tasks");
  }
  async ensureFolder(path) {
    const segments = (0, import_obsidian.normalizePath)(path).split("/").filter(Boolean);
    let current = "";
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current);
    }
  }
  availableTaskPath(title, currentPath = null) {
    const folder = this.folder();
    const prefix = `${folder}/`;
    const occupied = new Set(
      this.app.vault.getMarkdownFiles().map((file) => file.path).filter((path) => path.startsWith(prefix) && path !== currentPath).map((path) => path.toLocaleLowerCase())
    );
    const fileName = nextAvailableTaskFileName(title, (candidate) => occupied.has((0, import_obsidian.normalizePath)(`${folder}/${candidate}`).toLocaleLowerCase()));
    return (0, import_obsidian.normalizePath)(`${folder}/${fileName}`);
  }
  async scan() {
    const prefix = `${this.folder()}/`;
    const files = this.app.vault.getMarkdownFiles().filter((file) => file.path.startsWith(prefix));
    const tasks = await Promise.all(files.map(async (file) => parseTaskMarkdown(file.path, await this.app.vault.cachedRead(file))));
    const parsed = tasks.filter((task) => task !== null);
    const pathsById = /* @__PURE__ */ new Map();
    for (const task of parsed) {
      const paths = pathsById.get(task.id) ?? [];
      paths.push(task.path);
      pathsById.set(task.id, paths);
    }
    this.knownPathsById = pathsById;
    this.indexedTaskPaths = this.pathSignature(files);
    const identityConflicts = [...pathsById.entries()].filter(([, paths]) => paths.length > 1).map(([id, paths]) => ({ id, paths: [...paths].sort() })).sort((left, right) => left.id.localeCompare(right.id));
    const conflictedIds = new Set(identityConflicts.map((conflict) => conflict.id));
    return {
      tasks: parsed.filter((task) => !conflictedIds.has(task.id)),
      identityConflicts
    };
  }
  async list() {
    return (await this.scan()).tasks;
  }
  async create(draft) {
    if (!draft.title.trim()) throw new Error("Task title is required");
    await this.ensureFolder(this.folder());
    const tasks = await this.list();
    const rank = tasks.reduce((maximum, task2) => Math.max(maximum, task2.rank), 0) + RANK_STEP;
    const id = newId();
    const path = this.availableTaskPath(draft.title);
    const task = taskFromDraft(id, path, draft, rank, (/* @__PURE__ */ new Date()).toISOString());
    await this.app.vault.create(path, encodeTask(task));
    return task;
  }
  async update(task, patch) {
    const located = await this.locateTask(task.id, task.path);
    if (located.status === "identity-conflict") throw new DuplicateTaskIdError(located.conflict);
    if (located.status === "missing") throw new Error(`Task file not found: ${task.path}`);
    const { file } = located;
    let updated = task;
    await this.app.vault.process(file, (content) => {
      const current = parseTaskMarkdown(file.path, content);
      if (!current || current.id !== task.id) throw new Error(`Invalid task file: ${file.path}`);
      const completed = patch.completed ?? current.completed;
      updated = {
        ...current,
        ...patch,
        completed,
        completedAt: completed ? current.completedAt ?? (/* @__PURE__ */ new Date()).toISOString() : null,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      return encodeTaskPreservingProperties(updated, content);
    });
    const desiredPath = this.availableTaskPath(updated.title, file.path);
    if (desiredPath !== file.path) {
      await this.app.fileManager.renameFile(file, desiredPath);
      updated = { ...updated, path: desiredPath };
    }
    return updated;
  }
  async beginEdit(task) {
    const located = await this.locateTask(task.id, task.path);
    if (located.status !== "ready") return located;
    return {
      status: "ready",
      task: located.task,
      session: {
        taskId: located.task.id,
        openingPath: located.file.path,
        baseTask: { ...located.task, labels: [...located.task.labels], steps: located.task.steps.map((step) => ({ ...step })) },
        baseContent: located.content
      }
    };
  }
  async saveEditedTask(session, draft) {
    const located = await this.locateTask(session.taskId, session.openingPath);
    if (located.status !== "ready") return located;
    let outcome = { status: "missing" };
    await this.app.vault.process(located.file, (content) => {
      const current = parseTaskMarkdown(located.file.path, content);
      if (!current || current.id !== session.taskId) {
        outcome = { status: "missing" };
        return content;
      }
      const comparison = compareTaskEdit(session.baseTask, draft, current);
      if (comparison.conflicts.length > 0) {
        outcome = this.conflictResult(session, draft, current, content, comparison);
        return content;
      }
      const updated = this.withUpdatedTimestamp(comparison.merged);
      outcome = {
        status: "saved",
        task: updated,
        externalChangesPreserved: comparison.externalChangesPreserved
      };
      return encodeTaskPreservingProperties(updated, content);
    });
    return this.finishSavedTask(located.file, outcome);
  }
  async resolveEditConflict(conflict, choices) {
    const located = await this.locateTask(conflict.session.taskId, conflict.current.path);
    if (located.status !== "ready") return located;
    let outcome = { status: "missing" };
    await this.app.vault.process(located.file, (content) => {
      const current = parseTaskMarkdown(located.file.path, content);
      if (!current || current.id !== conflict.session.taskId) {
        outcome = { status: "missing" };
        return content;
      }
      if (content !== conflict.currentContent) {
        const comparison = compareTaskEdit(conflict.session.baseTask, conflict.draft, current);
        outcome = comparison.conflicts.length > 0 ? this.conflictResult(conflict.session, conflict.draft, current, content, comparison) : { status: "review-stale" };
        return content;
      }
      const resolved = this.withUpdatedTimestamp(applyTaskConflictChoices(conflict.comparison, choices));
      outcome = { status: "saved", task: resolved, externalChangesPreserved: true };
      return encodeTaskPreservingProperties(resolved, content);
    });
    return this.finishSavedTask(located.file, outcome);
  }
  async migrateLegacyFileNames() {
    const tasks = (await this.list()).sort((a, b) => a.path.localeCompare(b.path));
    let migrated = 0;
    for (const task of tasks) {
      const currentName = task.path.split("/").pop();
      if (currentName !== legacyTaskFileName(task.title, task.id)) continue;
      const file = this.app.vault.getAbstractFileByPath(task.path);
      if (!(file instanceof import_obsidian.TFile)) continue;
      const desiredPath = this.availableTaskPath(task.title, task.path);
      if (desiredPath === task.path) continue;
      await this.app.fileManager.renameFile(file, desiredPath);
      migrated += 1;
    }
    return migrated;
  }
  async remove(task) {
    const located = await this.locateTask(task.id, task.path);
    if (located.status === "identity-conflict") throw new DuplicateTaskIdError(located.conflict);
    if (located.status === "ready") await this.app.vault.trash(located.file, true);
  }
  async readReviewedTask(taskId, preferredPath) {
    const located = await this.locateTask(taskId, preferredPath);
    if (located.status !== "ready") return located;
    return { status: "ready", path: located.file.path, content: located.content };
  }
  async writeReviewedTask(taskId, preferredPath, expectedContent, nextContent) {
    const located = await this.locateTask(taskId, preferredPath);
    if (located.status !== "ready") return located;
    let saved = false;
    await this.app.vault.process(located.file, (content) => {
      if (content !== expectedContent) return content;
      const next = parseTaskMarkdown(located.file.path, nextContent);
      if (!next || next.id !== taskId) throw new Error(`Invalid reviewed Task content: ${taskId}`);
      saved = true;
      return nextContent;
    });
    if (!saved) return { status: "stale" };
    const updated = parseTaskMarkdown(located.file.path, nextContent);
    if (!updated) throw new Error(`Invalid reviewed Task content: ${taskId}`);
    const desiredPath = this.availableTaskPath(updated.title, located.file.path);
    if (desiredPath !== located.file.path) await this.app.fileManager.renameFile(located.file, desiredPath);
    return { status: "saved", path: desiredPath };
  }
  async clearProject(projectId) {
    const tasks = await this.list();
    await Promise.all(tasks.filter((task) => task.projectId === projectId).map((task) => this.update(task, { projectId: null })));
  }
  async reorder(taskId, previousId, nextId) {
    const tasks = await this.list();
    const target = tasks.find((task) => task.id === taskId);
    if (!target) return;
    const previous = previousId ? tasks.find((task) => task.id === previousId) : null;
    const next = nextId ? tasks.find((task) => task.id === nextId) : null;
    let rank = RANK_STEP;
    if (previous && next) rank = (previous.rank + next.rank) / 2;
    else if (previous) {
      const successor = tasks.filter((task) => task.id !== target.id && task.rank > previous.rank).sort((a, b) => a.rank - b.rank)[0];
      rank = successor ? (previous.rank + successor.rank) / 2 : previous.rank + RANK_STEP;
    } else if (next) {
      const predecessor = tasks.filter((task) => task.id !== target.id && task.rank < next.rank).sort((a, b) => b.rank - a.rank)[0];
      rank = predecessor ? (predecessor.rank + next.rank) / 2 : next.rank - RANK_STEP;
    }
    await this.update(target, { rank });
  }
  cloneDraft(draft) {
    return { ...draft, labels: [...draft.labels], steps: draft.steps.map((step) => ({ ...step })) };
  }
  conflictResult(session, draft, current, currentContent, comparison) {
    return {
      status: "conflict",
      session,
      draft: this.cloneDraft(draft),
      current: { ...current, labels: [...current.labels], steps: current.steps.map((step) => ({ ...step })) },
      currentContent,
      comparison
    };
  }
  withUpdatedTimestamp(task) {
    return { ...task, labels: [...task.labels], steps: task.steps.map((step) => ({ ...step })), updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  }
  async finishSavedTask(file, outcome) {
    if (outcome.status !== "saved") return outcome;
    const desiredPath = this.availableTaskPath(outcome.task.title, file.path);
    if (desiredPath === file.path) return outcome;
    await this.app.fileManager.renameFile(file, desiredPath);
    return { ...outcome, task: { ...outcome.task, path: desiredPath } };
  }
  taskFiles() {
    const prefix = `${this.folder()}/`;
    return this.app.vault.getMarkdownFiles().filter((file) => file.path.startsWith(prefix));
  }
  async locateTask(id, preferredPath) {
    const taskFiles = this.taskFiles();
    if (this.indexedTaskPaths !== this.pathSignature(taskFiles)) await this.scan();
    const knownPaths = this.knownPathsById.get(id) ?? [];
    if (knownPaths.length > 1) return {
      status: "identity-conflict",
      conflict: { id, paths: [...knownPaths].sort() }
    };
    const candidatePaths = [.../* @__PURE__ */ new Set([preferredPath, ...knownPaths])];
    for (const path of candidatePaths) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof import_obsidian.TFile)) continue;
      const content = await this.app.vault.read(file);
      const task = parseTaskMarkdown(file.path, content);
      if (task?.id === id) return { status: "ready", file, content, task };
    }
    const matches2 = [];
    for (const file of taskFiles) {
      const content = await this.app.vault.read(file);
      const task = parseTaskMarkdown(file.path, content);
      if (task?.id === id) matches2.push({ file, content, task });
    }
    this.knownPathsById.set(id, matches2.map((match) => match.file.path));
    if (matches2.length > 1) return {
      status: "identity-conflict",
      conflict: { id, paths: matches2.map((match) => match.file.path).sort() }
    };
    if (matches2.length === 0) return { status: "missing" };
    return { status: "ready", ...matches2[0] };
  }
  pathSignature(files) {
    return files.map((file) => file.path).sort().join("\n");
  }
};

// src/projects/project-repository.ts
var import_obsidian2 = require("obsidian");

// src/projects/project-markdown.ts
var FRONTMATTER2 = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
function parseValue(raw) {
  const value = raw.trim();
  if (!value || value === "null") return null;
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  return value;
}
function properties(content) {
  const match = content.match(FRONTMATTER2);
  if (!match) return {};
  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 1 || line.startsWith(" ")) continue;
    result[line.slice(0, separator).trim()] = parseValue(line.slice(separator + 1));
  }
  return result;
}
function parseProjectMarkdown(path, content) {
  const props = properties(content);
  if (props.type !== "taskmate-project" || !props.id || !props.name) return null;
  return {
    path,
    id: props.id,
    name: props.name,
    createdAt: props["created-at"] ?? "",
    updatedAt: props["updated-at"] ?? "",
    lastUsedAt: props["last-used-at"]
  };
}
function encodeProject(project) {
  return [
    "---",
    "type: taskmate-project",
    `id: ${JSON.stringify(project.id)}`,
    `name: ${JSON.stringify(project.name)}`,
    `created-at: ${JSON.stringify(project.createdAt)}`,
    `updated-at: ${JSON.stringify(project.updatedAt)}`,
    `last-used-at: ${project.lastUsedAt ? JSON.stringify(project.lastUsedAt) : "null"}`,
    "---",
    "",
    `# ${project.name}`,
    ""
  ].join("\n");
}
function projectFileName(name, id) {
  const readable = name.normalize("NFKC").replace(/[\\/:*?"<>|#^[\]]/g, "-").replace(/\s+/g, " ").replace(/-+/g, "-").replace(/^[.\s-]+|[.\s-]+$/g, "").slice(0, 80).trim() || "project";
  return `${readable}--${id.slice(0, 8)}.md`;
}

// src/projects/project-repository.ts
function newId2() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
var ProjectRepository = class {
  constructor(app, projectFolder) {
    this.app = app;
    this.projectFolder = projectFolder;
  }
  folder() {
    return (0, import_obsidian2.normalizePath)(this.projectFolder().trim() || "TaskMate/Projects");
  }
  async ensureFolder() {
    const segments = this.folder().split("/").filter(Boolean);
    let current = "";
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current);
    }
  }
  async list() {
    const prefix = `${this.folder()}/`;
    const files = this.app.vault.getMarkdownFiles().filter((file) => file.path.startsWith(prefix));
    const projects = await Promise.all(files.map(async (file) => parseProjectMarkdown(file.path, await this.app.vault.cachedRead(file))));
    return projects.filter((project) => project !== null);
  }
  async create(name) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Project name is required");
    await this.ensureFolder();
    const id = newId2();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const path = (0, import_obsidian2.normalizePath)(`${this.folder()}/${projectFileName(trimmed, id)}`);
    const project = { path, id, name: trimmed, createdAt: now, updatedAt: now, lastUsedAt: now };
    await this.app.vault.create(path, encodeProject(project));
    return project;
  }
  async update(project, patch) {
    const file = this.app.vault.getAbstractFileByPath(project.path);
    if (!(file instanceof import_obsidian2.TFile)) throw new Error(`Project file not found: ${project.path}`);
    let updated = project;
    await this.app.vault.process(file, (content) => {
      const current = parseProjectMarkdown(project.path, content);
      if (!current) throw new Error(`Invalid project file: ${project.path}`);
      updated = { ...current, ...patch, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      return encodeProject(updated);
    });
    const desiredPath = (0, import_obsidian2.normalizePath)(`${this.folder()}/${projectFileName(updated.name, updated.id)}`);
    if (desiredPath !== file.path) {
      await this.app.fileManager.renameFile(file, desiredPath);
      updated = { ...updated, path: desiredPath };
    }
    return updated;
  }
  async touch(project) {
    return this.update(project, { lastUsedAt: (/* @__PURE__ */ new Date()).toISOString() });
  }
  async remove(project) {
    const file = this.app.vault.getAbstractFileByPath(project.path);
    if (file instanceof import_obsidian2.TFile) await this.app.vault.trash(file, true);
  }
};

// src/settings.ts
var import_obsidian3 = require("obsidian");
var DEFAULT_SETTINGS = {
  language: "auto",
  taskFolder: "TaskMate/Tasks",
  projectFolder: "TaskMate/Projects",
  proposalFolder: "TaskMate/Proposals",
  sourceFolders: [],
  includeSourceSubfolders: true,
  recentSearches: [],
  recentLabels: [],
  favoriteLabels: []
};
var TaskMateSettingTab = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    const { t } = this.plugin.i18n();
    containerEl.empty();
    containerEl.createEl("h2", { text: "TaskMate" });
    new import_obsidian3.Setting(containerEl).setName(t("settings.language")).setDesc(t("settings.languageDescription")).addDropdown((dropdown) => dropdown.addOption("auto", t("settings.languageAuto")).addOption("en", t("settings.languageEnglish")).addOption("ja", t("settings.languageJapanese")).setValue(this.plugin.settings.language).onChange(async (value) => {
      this.plugin.settings.language = value;
      await this.plugin.saveSettings();
      this.plugin.refreshViews();
      this.display();
    }));
    new import_obsidian3.Setting(containerEl).setName(t("settings.taskFolder")).setDesc(t("settings.taskFolderDescription")).addText((text) => text.setValue(this.plugin.settings.taskFolder).onChange(async (value) => {
      this.plugin.settings.taskFolder = value.trim() || DEFAULT_SETTINGS.taskFolder;
      await this.plugin.saveSettings();
      this.plugin.refreshViews();
    }));
    new import_obsidian3.Setting(containerEl).setName(t("settings.projectFolder")).setDesc(t("settings.projectFolderDescription")).addText((text) => text.setValue(this.plugin.settings.projectFolder).onChange(async (value) => {
      this.plugin.settings.projectFolder = value.trim() || DEFAULT_SETTINGS.projectFolder;
      await this.plugin.saveSettings();
      this.plugin.refreshViews();
    }));
    new import_obsidian3.Setting(containerEl).setName(t("settings.proposalFolder")).setDesc(t("settings.proposalFolderDescription")).addText((text) => text.setValue(this.plugin.settings.proposalFolder).onChange(async (value) => {
      this.plugin.settings.proposalFolder = value.trim() || DEFAULT_SETTINGS.proposalFolder;
      await this.plugin.saveSettings();
    }));
    new import_obsidian3.Setting(containerEl).setName(t("settings.sourceFolders")).setDesc(t("settings.sourceFoldersDescription")).addTextArea((text) => {
      text.inputEl.rows = 6;
      text.inputEl.addClass("taskmate-folder-list");
      text.setValue(this.plugin.settings.sourceFolders.join("\n")).onChange(async (value) => {
        this.plugin.settings.sourceFolders = value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian3.Setting(containerEl).setName(t("settings.includeSubfolders")).setDesc(t("settings.includeSubfoldersDescription")).addToggle((toggle) => toggle.setValue(this.plugin.settings.includeSourceSubfolders).onChange(async (value) => {
      this.plugin.settings.includeSourceSubfolders = value;
      await this.plugin.saveSettings();
    }));
  }
};

// src/task-list/view.ts
var import_obsidian12 = require("obsidian");

// src/task-list/bulk-task-modal.ts
var import_obsidian5 = require("obsidian");

// src/tasks/domain.ts
function localDateParts(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function todayKey(now = /* @__PURE__ */ new Date()) {
  return localDateParts(now);
}
function addDays(dateKey, amount) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);
  return localDateParts(date);
}
function taskMatchesView(task, view, today = todayKey(), includeCompleted = false) {
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
function filterTasks(tasks, view, filters, today) {
  const needle = filters.search.trim().toLocaleLowerCase();
  return tasks.filter((task) => {
    if (!taskMatchesView(task, view, today, filters.includeCompleted)) return false;
    if (filters.priorities.length > 0 && (task.priority === null || !filters.priorities.includes(task.priority))) return false;
    if (filters.labels.length > 0 && !filters.labels.some((label) => task.labels.includes(label))) return false;
    const stepText = task.steps.map((step) => step.text).join("\n");
    return needle.length === 0 || `${task.title}
${task.notes}
${stepText}
${task.labels.join(" ")}`.toLocaleLowerCase().includes(needle);
  });
}
function groupScheduledTasks(tasks, today = todayKey(), includeCompleted = false) {
  const scheduled = tasks.filter((task) => (includeCompleted || !task.completed) && task.date !== null);
  return {
    overdue: scheduled.filter((task) => task.date !== null && task.date < today),
    today: scheduled.filter((task) => task.date === today),
    later: scheduled.filter((task) => task.date !== null && task.date > today)
  };
}
function sortTasks(tasks, mode, direction = "asc") {
  const result = [...tasks];
  const rankThenCreated = (a, b) => a.rank - b.rank || a.createdAt.localeCompare(b.createdAt);
  const directed = (comparison) => direction === "asc" ? comparison : -comparison;
  const compareNullable = (a, b, compare) => {
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

// src/tasks/date-suggestions.ts
function taskDateSuggestions(today = todayKey()) {
  return [
    { id: "today", date: today },
    { id: "tomorrow", date: addDays(today, 1) },
    { id: "seven-days", date: addDays(today, 7) },
    { id: "none", date: null }
  ];
}

// src/labels/label-suggestions.ts
function normalizeLabels(labels) {
  const result = [];
  for (const raw of labels) {
    const label = raw.trim().replace(/^#/, "");
    if (label && !result.includes(label)) result.push(label);
  }
  return result;
}
function recentLabelSuggestions(history, limit = 10) {
  return normalizeLabels(history).slice(0, limit);
}
function recordRecentLabels(history, savedLabels, limit = 10) {
  const used = normalizeLabels(savedLabels);
  if (used.length === 0) return recentLabelSuggestions(history, limit);
  return normalizeLabels([...used, ...history]).slice(0, limit);
}

// src/labels/label-chip-input.ts
function updateLabelChipInput(currentLabels, value, commitPending, limit = 500) {
  const parts = value.split(",");
  const committed = commitPending ? parts : parts.slice(0, -1);
  const pending = commitPending ? "" : (parts.at(-1) ?? "").trimStart();
  return {
    labels: normalizeLabels([...currentLabels, ...committed]).slice(0, Math.max(0, limit)),
    pending
  };
}
function shouldCommitLabelOnEnter(key, composing, keyCode = 0) {
  return key === "Enter" && !composing && keyCode !== 229;
}

// src/labels/label-summary.ts
var COMPACT_LABEL_LIMIT = 3;
function summarizeLabels(labels, limit = COMPACT_LABEL_LIMIT) {
  const safeLimit = Math.max(0, limit);
  return {
    visible: labels.slice(0, safeLimit),
    hidden: labels.slice(safeLimit)
  };
}

// src/labels/label-picker-modal.ts
var import_obsidian4 = require("obsidian");

// src/i18n/en.ts
var en = {
  "nav.date": "Date",
  "nav.search": "Search",
  "nav.projects": "Projects",
  "nav.filter": "Filter",
  "nav.ariaLabel": "Main navigation",
  "view.scheduled": "Scheduled",
  "view.overdue": "Overdue",
  "view.today": "Today",
  "view.later": "Later",
  "view.all": "All",
  "view.unplanned": "No date",
  "sort.label": "Sort",
  "sort.manual": "Manual",
  "sort.date": "Date",
  "sort.priority": "Priority",
  "sort.created": "Created",
  "sort.ariaLabel": "Sort tasks",
  "sort.ascending": "ascending",
  "sort.descending": "descending",
  "sort.activeOptionAriaLabel": "{mode}, {direction}. Activate again to reverse the order.",
  "sort.scheduledDateScope": "Date order applies within each section: Overdue, Today, and Later.",
  "common.add": "+ Add",
  "common.edit": "Edit",
  "common.delete": "Delete",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.back": "Back",
  "common.clear": "Clear",
  "command.openReviews": "Open Task change reviews",
  "review.title": "Review Task changes",
  "review.pending": "Pending reviews",
  "review.history": "History",
  "review.none": "No pending reviews",
  "review.historyNone": "No review history",
  "review.summary": "{tasks} Tasks, {changes} changes",
  "review.historyCounts": "{succeeded} applied \xB7 {failed} failed",
  "review.status.applied": "Applied",
  "review.status.partially-applied": "Partially applied",
  "review.status.rejected": "Rejected",
  "review.status.stale": "Stale",
  "review.status.pending": "Pending",
  "review.apply": "Apply selection",
  "review.applied": "Applied {count} changes",
  "review.staleRegenerated": "Applied 0 changes because {failed} changes became stale. Created a new review proposal.",
  "review.reject": "Reject proposal",
  "review.rejected": "Proposal rejected",
  "review.rejectConfirm": "Reject this proposal without changing Tasks?",
  "review.selectAll": "Select all changes in every Task",
  "review.selectAllShort": "Select all",
  "review.selectTask": "Select all",
  "review.clearAll": "Clear all changes in every Task",
  "review.clearAllShort": "Clear all",
  "review.clearTask": "Clear all",
  "review.semantic": "Items",
  "review.semanticAria": "Item comparison",
  "review.markdown": "Full text",
  "review.markdownAria": "Full-text comparison",
  "review.comparisonAria": "Comparison view",
  "review.noSelection": "Select at least one change",
  "review.invalid": "This proposal is missing or invalid",
  "review.invalidLink": "The TaskMate review link is invalid",
  "search.title": "Search",
  "search.placeholder": "Search tasks, labels, and projects",
  "search.ariaLabel": "Search tasks",
  "search.recent": "Recent searches",
  "search.emptyQuery": "Enter a search term",
  "projects.title": "Projects",
  "projects.editTitle": "Edit project",
  "projects.recent": "Recently used projects",
  "projects.all": "All projects",
  "projects.empty": "No projects",
  "projects.taskCountOne": "{count} task",
  "projects.taskCount": "{count} tasks",
  "projects.name": "Project name",
  "projects.saveName": "Save name",
  "projects.delete": "Delete project",
  "projects.deleteConfirm": "Delete \u201C{project}\u201D? Its tasks will become unassigned.",
  "projects.deletedNotice": "Project deleted. Its tasks are now unassigned.",
  "filter.title": "Filter",
  "filter.priority": "Priority",
  "filter.priorityValue": "Priority {priority}",
  "filter.labels": "Labels",
  "filter.labelPickerTitle": "Select labels",
  "filter.suggestedLabelsTab": "Recent & Favorites",
  "filter.allLabelsTab": "All labels",
  "filter.favoriteLabels": "Favorites",
  "filter.chooseLabels": "Choose labels",
  "filter.confirmLabelSelection": "Confirm selection",
  "filter.selectedLabelCount": "{count} selected",
  "filter.labelSearchPlaceholder": "Search labels",
  "filter.labelSearchAriaLabel": "Search labels",
  "filter.labelIndexAriaLabel": "Label initial groups",
  "filter.groupJapanese": "Japanese",
  "filter.groupOther": "Numbers & symbols",
  "filter.addFavoriteAriaLabel": "Add {label} to favorites",
  "filter.removeFavoriteAriaLabel": "Remove {label} from favorites",
  "filter.favoriteLimitNotice": "Favorites are limited to {count} labels",
  "filter.noLabels": "No matching labels",
  "filter.recentLabels": "Recent labels",
  "filter.matchingLabels": "Matching labels",
  "filter.removeLabelAriaLabel": "Remove {label}",
  "filter.completion": "Completion state",
  "filter.includeCompleted": "Include completed tasks",
  "filter.results": "Results",
  "filter.select": "Select filters",
  "filter.change": "Change filters",
  "filter.clearActive": "Clear filters",
  "filter.clearedNotice": "Filters cleared",
  "filter.clearAll": "Clear all",
  "filter.apply": "Apply",
  "filter.labelsDescription": "Choose one or more existing labels. A task matches any selected label.",
  "filter.labelsPlaceholder": "work, calls",
  "adjust.ariaLabel": "View and task actions",
  "adjust.ariaLabelActive": "View and task actions, {count} active filters",
  "labelManager.menu": "Manage labels",
  "labelManager.title": "Manage labels",
  "labelManager.search": "Search labels",
  "labelManager.empty": "No matching labels",
  "labelManager.storedOnly": "Stored only",
  "labelManager.taskCountOne": "{count} task",
  "labelManager.taskCount": "{count} tasks",
  "labelManager.renameAriaLabel": "Rename {label}",
  "labelManager.deleteAriaLabel": "Delete {label}",
  "labelManager.renameUsed": "Rename \u201C{label}\u201D on {count} tasks",
  "labelManager.renameUsedOne": "Rename \u201C{label}\u201D on {count} task",
  "labelManager.renameStoredOnly": "Rename stored label \u201C{label}\u201D",
  "labelManager.confirmRename": "Rename",
  "labelManager.deleteConfirm": "Remove \u201C{label}\u201D from {count} tasks? The tasks themselves will not be deleted.",
  "labelManager.deleteConfirmOne": "Remove \u201C{label}\u201D from {count} task? The task itself will not be deleted.",
  "labelManager.deleteStoredOnlyConfirm": "Delete stored label \u201C{label}\u201D? No task files will be changed.",
  "labelManager.renamedNotice": "Renamed \u201C{from}\u201D to \u201C{to}\u201D on {count} tasks",
  "labelManager.renamedNoticeOne": "Renamed \u201C{from}\u201D to \u201C{to}\u201D on {count} task",
  "labelManager.deletedNotice": "Removed \u201C{label}\u201D from {count} tasks",
  "labelManager.deletedNoticeOne": "Removed \u201C{label}\u201D from {count} task",
  "labelManager.partialFailure": "Could not update {failed} of {total} tasks: {paths}",
  "selection.start": "Select tasks",
  "selection.ariaLabel": "Task selection actions",
  "selection.exit": "Exit",
  "selection.count": "{count} selected",
  "selection.selectAll": "Select all",
  "selection.deleteConfirm": "Move {count} tasks to the Obsidian trash?",
  "selection.deletedNotice": "Moved {count} tasks to the trash",
  "selection.updatedNotice": "Updated {count} tasks",
  "selection.partialFailure": "{failed} of {total} tasks could not be changed",
  "tasks.empty": "No tasks",
  "tasks.completeAriaLabel": "Complete {title}",
  "tasks.moreAriaLabel": "More actions",
  "tasks.selectAriaLabel": "Select {title}",
  "tasks.deleteConfirm": "Move \u201C{title}\u201D to the trash?",
  "tasks.deletedNotice": "Task moved to the trash",
  "tasks.moreLabels": "{count} more",
  "tasks.moreLabelsAriaLabel": "Show {count} more labels",
  "tasks.hideExtraLabels": "Hide extra labels",
  "taskModal.addTitle": "Add task",
  "taskModal.editTitle": "Edit task",
  "taskModal.title": "Title",
  "taskModal.titlePlaceholder": "What needs to be done?",
  "taskModal.date": "Date",
  "taskModal.project": "Project",
  "taskModal.unassigned": "Unassigned",
  "taskModal.priority": "Priority",
  "taskModal.noPriority": "None",
  "taskModal.labels": "Labels",
  "taskModal.labelsDescription": "Add with the button, Enter, or a comma; up to 500 labels",
  "taskModal.labelsPlaceholder": "Type a label",
  "taskModal.addLabel": "Add",
  "taskModal.addLabelAriaLabel": "Add the typed label",
  "taskModal.removeLabelAriaLabel": "Remove {label}",
  "taskModal.chooseLabels": "Choose",
  "taskModal.chooseExistingLabelsAriaLabel": "Choose from existing labels",
  "taskModal.steps": "Steps",
  "taskModal.addStep": "+ Add step",
  "taskModal.stepProgress": "{completed}/{total} complete",
  "taskModal.stepCompletedAriaLabel": "Toggle completion for step {step}",
  "taskModal.editStepAriaLabel": "Edit step {title}",
  "taskModal.stepOverdue": "Overdue",
  "taskModal.stepDueToday": "Due today",
  "stepModal.addTitle": "Add step",
  "stepModal.editTitle": "Edit step",
  "stepModal.title": "Step title",
  "stepModal.titlePlaceholder": "What needs to be done?",
  "stepModal.date": "Date",
  "stepModal.add": "Add",
  "taskModal.notes": "Notes",
  "conflict.title": "Review conflicting changes",
  "conflict.description": "This task changed after editing began. Choose which value to keep for each conflicting field.",
  "conflict.currentValue": "Current file",
  "conflict.draftValue": "Your edit",
  "conflict.none": "None",
  "conflict.sourceNote": "Source note",
  "conflict.saveResolved": "Save reviewed changes",
  "conflict.changedAgain": "The task changed again while the conflict was open. Review the latest values before saving.",
  "conflict.missing": "The task was deleted or is no longer available. It was not recreated.",
  "conflict.identityNotice": "TaskMate found the same task ID in multiple files: {paths}",
  "conflict.identityBanner": "Task identity conflicts: {count}. Conflicting tasks are hidden until their duplicate IDs are resolved.",
  "conflict.identityDetails": "{id}: {paths}",
  "conflict.externalPreserved": "Saved your changes and preserved newer changes from another source.",
  "conflict.resolved": "Resolved the conflict with your selected values and saved the task.",
  "bulk.title": "Edit {count} tasks",
  "bulk.unchanged": "No change",
  "bulk.setValue": "Set a date",
  "bulk.labelsDescription": "Labels used by any selected task are shown. A label marked Some is only on some selected tasks; use its more-actions button to leave it unchanged, add it to all, or remove it from every selected task.",
  "bulk.labelPartial": "Some",
  "bulk.labelActionsAriaLabel": "Actions for {label}",
  "bulk.partialLabelActionsTitle": "Edit {label}",
  "bulk.partialLabelActionsDescription": "This Label is on only some selected tasks.",
  "bulk.addLabelToAll": "Add to all selected tasks",
  "bulk.removeLabel": "Remove from selected tasks",
  "bulk.removeLabelAriaLabel": "Remove {label} from selected tasks",
  "bulk.apply": "Apply to {count} tasks",
  "date.today": "Today",
  "date.tomorrow": "Tomorrow",
  "date.sevenDays": "7 days later",
  "date.none": "No date",
  "projectModal.addTitle": "Add project",
  "projectModal.name": "Project name",
  "projectModal.namePlaceholder": "New project",
  "settings.language": "Language",
  "settings.languageDescription": "Choose the language used by TaskMate. Reload the plugin to update command names and the ribbon tooltip.",
  "settings.languageAuto": "Auto",
  "settings.languageEnglish": "English",
  "settings.languageJapanese": "\u65E5\u672C\u8A9E",
  "settings.taskFolder": "Task folder",
  "settings.taskFolderDescription": "One Markdown file is stored here for each task.",
  "settings.projectFolder": "Project folder",
  "settings.projectFolderDescription": "One Markdown file is stored here for each project.",
  "settings.proposalFolder": "Proposal folder",
  "settings.proposalFolderDescription": "AI import proposals are reviewed here before approved items become tasks.",
  "settings.sourceFolders": "AI source folders",
  "settings.sourceFoldersDescription": "One vault-relative folder per line. Notes inherit inclusion from these folders.",
  "settings.includeSubfolders": "Include subfolders",
  "settings.includeSubfoldersDescription": "Apply every AI source folder rule to its subfolders too.",
  "command.openRibbon": "Open TaskMate",
  "command.openList": "Open task list",
  "command.includeNote": "Include current note as an AI source",
  "command.excludeNote": "Exclude current note as an AI source",
  "command.includeFolder": "Include current folder as an AI source",
  "notice.migratedTaskNames": "Removed IDs from {count} task note names",
  "notice.migrationFailed": "Some task note names could not be updated",
  "notice.noteIncluded": "Note included as an AI source",
  "notice.noteExcluded": "Note excluded as an AI source",
  "notice.folderIncluded": "Included {folder} as an AI source"
};

// src/i18n/ja.ts
var ja = {
  "nav.date": "\u65E5\u4ED8",
  "nav.search": "\u691C\u7D22",
  "nav.projects": "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8",
  "nav.filter": "\u30D5\u30A3\u30EB\u30BF",
  "nav.ariaLabel": "\u30E1\u30A4\u30F3\u30CA\u30D3\u30B2\u30FC\u30B7\u30E7\u30F3",
  "view.scheduled": "\u4E88\u5B9A",
  "view.overdue": "\u671F\u9650\u5207\u308C",
  "view.today": "\u4ECA\u65E5",
  "view.later": "\u660E\u65E5\u4EE5\u964D",
  "view.all": "\u3059\u3079\u3066",
  "view.unplanned": "\u65E5\u4ED8\u306A\u3057",
  "sort.label": "\u4E26\u3079\u66FF\u3048",
  "sort.manual": "\u624B\u52D5",
  "sort.date": "\u65E5\u4ED8",
  "sort.priority": "\u512A\u5148\u5EA6",
  "sort.created": "\u4F5C\u6210\u65E5",
  "sort.ariaLabel": "\u30BF\u30B9\u30AF\u3092\u4E26\u3079\u66FF\u3048",
  "sort.ascending": "\u6607\u9806",
  "sort.descending": "\u964D\u9806",
  "sort.activeOptionAriaLabel": "{mode}\u3001{direction}\u3002\u3082\u3046\u4E00\u5EA6\u62BC\u3059\u3068\u9806\u5E8F\u3092\u53CD\u8EE2\u3057\u307E\u3059\u3002",
  "sort.scheduledDateScope": "\u65E5\u4ED8\u9806\u306F\u300C\u671F\u9650\u5207\u308C\u30FB\u4ECA\u65E5\u30FB\u660E\u65E5\u4EE5\u964D\u300D\u306E\u5404\u30BB\u30AF\u30B7\u30E7\u30F3\u5185\u306B\u9069\u7528\u3055\u308C\u307E\u3059\u3002",
  "common.add": "\uFF0B \u8FFD\u52A0",
  "common.edit": "\u7DE8\u96C6",
  "common.delete": "\u524A\u9664",
  "common.cancel": "\u30AD\u30E3\u30F3\u30BB\u30EB",
  "common.save": "\u4FDD\u5B58",
  "common.back": "\u623B\u308B",
  "common.clear": "\u6D88\u53BB",
  "command.openReviews": "Task\u5909\u66F4\u30EC\u30D3\u30E5\u30FC\u3092\u958B\u304F",
  "review.title": "Task\u5909\u66F4\u3092\u30EC\u30D3\u30E5\u30FC",
  "review.pending": "\u672A\u30EC\u30D3\u30E5\u30FC",
  "review.history": "\u5C65\u6B74",
  "review.none": "\u672A\u30EC\u30D3\u30E5\u30FC\u306EProposal\u306F\u3042\u308A\u307E\u305B\u3093",
  "review.historyNone": "\u30EC\u30D3\u30E5\u30FC\u5C65\u6B74\u306F\u3042\u308A\u307E\u305B\u3093",
  "review.summary": "{tasks}\u4EF6\u306ETask\u3001{changes}\u4EF6\u306E\u5909\u66F4",
  "review.historyCounts": "\u6210\u529F{succeeded}\u4EF6\u30FB\u5931\u6557{failed}\u4EF6",
  "review.status.applied": "\u9069\u7528\u6E08\u307F",
  "review.status.partially-applied": "\u4E00\u90E8\u9069\u7528",
  "review.status.rejected": "\u5374\u4E0B",
  "review.status.stale": "stale",
  "review.status.pending": "\u672A\u30EC\u30D3\u30E5\u30FC",
  "review.apply": "\u9078\u629E\u3092\u9069\u7528",
  "review.applied": "{count}\u4EF6\u306E\u5909\u66F4\u3092\u9069\u7528\u3057\u307E\u3057\u305F",
  "review.staleRegenerated": "{failed}\u4EF6\u304Cstale\u306B\u306A\u3063\u305F\u305F\u30810\u4EF6\u9069\u7528\u3057\u3001\u518D\u78BA\u8A8D\u7528Proposal\u3092\u4F5C\u6210\u3057\u307E\u3057\u305F",
  "review.reject": "\u63D0\u6848\u3092\u5374\u4E0B",
  "review.rejected": "Proposal\u3092\u5374\u4E0B\u3057\u307E\u3057\u305F",
  "review.rejectConfirm": "Task\u3092\u5909\u66F4\u305B\u305A\u3001\u3053\u306EProposal\u3092\u5374\u4E0B\u3057\u307E\u3059\u304B\uFF1F",
  "review.selectAll": "\u5168Task\u306E\u5909\u66F4\u3092\u3059\u3079\u3066\u9078\u629E",
  "review.selectAllShort": "\u5168\u9078\u629E",
  "review.selectTask": "\u5168\u9078\u629E",
  "review.clearAll": "\u5168Task\u306E\u5909\u66F4\u3092\u3059\u3079\u3066\u89E3\u9664",
  "review.clearAllShort": "\u5168\u89E3\u9664",
  "review.clearTask": "\u5168\u89E3\u9664",
  "review.semantic": "\u9805\u76EE",
  "review.semanticAria": "\u9805\u76EE\u6BD4\u8F03",
  "review.markdown": "\u5168\u6587",
  "review.markdownAria": "\u5168\u6587\u6BD4\u8F03",
  "review.comparisonAria": "\u6BD4\u8F03\u8868\u793A",
  "review.noSelection": "\u5909\u66F4\u30921\u4EF6\u4EE5\u4E0A\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044",
  "review.invalid": "Proposal\u304C\u898B\u3064\u304B\u3089\u306A\u3044\u304B\u3001\u5F62\u5F0F\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093",
  "review.invalidLink": "TaskMate\u306E\u30EC\u30D3\u30E5\u30FC\u30EA\u30F3\u30AF\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093",
  "search.title": "\u691C\u7D22",
  "search.placeholder": "\u30BF\u30B9\u30AF\u3001\u30E9\u30D9\u30EB\u3001\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3092\u691C\u7D22",
  "search.ariaLabel": "\u30BF\u30B9\u30AF\u3092\u691C\u7D22",
  "search.recent": "\u6700\u8FD1\u306E\u691C\u7D22",
  "search.emptyQuery": "\u691C\u7D22\u8A9E\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044",
  "projects.title": "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8",
  "projects.editTitle": "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3092\u7DE8\u96C6",
  "projects.recent": "\u6700\u8FD1\u4F7F\u3063\u305F\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8",
  "projects.all": "\u3059\u3079\u3066\u306E\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8",
  "projects.empty": "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u306F\u3042\u308A\u307E\u305B\u3093",
  "projects.taskCountOne": "{count}\u4EF6",
  "projects.taskCount": "{count}\u4EF6",
  "projects.name": "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u540D",
  "projects.saveName": "\u540D\u79F0\u3092\u4FDD\u5B58",
  "projects.delete": "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3092\u524A\u9664",
  "projects.deleteConfirm": "\u300C{project}\u300D\u3092\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F\u30BF\u30B9\u30AF\u306F\u672A\u6240\u5C5E\u3078\u79FB\u52D5\u3057\u307E\u3059\u3002",
  "projects.deletedNotice": "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3092\u524A\u9664\u3057\u3001\u30BF\u30B9\u30AF\u3092\u672A\u6240\u5C5E\u3078\u79FB\u52D5\u3057\u307E\u3057\u305F",
  "filter.title": "\u30D5\u30A3\u30EB\u30BF",
  "filter.priority": "\u512A\u5148\u5EA6",
  "filter.priorityValue": "\u512A\u5148\u5EA6 {priority}",
  "filter.labels": "\u30E9\u30D9\u30EB",
  "filter.labelPickerTitle": "\u30E9\u30D9\u30EB\u3092\u9078\u629E",
  "filter.suggestedLabelsTab": "\u5C65\u6B74\u30FB\u304A\u6C17\u306B\u5165\u308A",
  "filter.allLabelsTab": "\u3059\u3079\u3066\u306E\u30E9\u30D9\u30EB",
  "filter.favoriteLabels": "\u304A\u6C17\u306B\u5165\u308A",
  "filter.chooseLabels": "\u30E9\u30D9\u30EB\u3092\u9078\u629E",
  "filter.confirmLabelSelection": "\u9078\u629E\u3092\u78BA\u5B9A",
  "filter.selectedLabelCount": "{count}\u4EF6\u9078\u629E\u4E2D",
  "filter.labelSearchPlaceholder": "\u30E9\u30D9\u30EB\u3092\u691C\u7D22",
  "filter.labelSearchAriaLabel": "\u30E9\u30D9\u30EB\u3092\u691C\u7D22",
  "filter.labelIndexAriaLabel": "\u30E9\u30D9\u30EB\u306E\u982D\u6587\u5B57\u30B0\u30EB\u30FC\u30D7",
  "filter.groupJapanese": "\u65E5\u672C\u8A9E",
  "filter.groupOther": "\u6570\u5B57\u30FB\u8A18\u53F7",
  "filter.addFavoriteAriaLabel": "{label}\u3092\u304A\u6C17\u306B\u5165\u308A\u306B\u8FFD\u52A0",
  "filter.removeFavoriteAriaLabel": "{label}\u3092\u304A\u6C17\u306B\u5165\u308A\u304B\u3089\u89E3\u9664",
  "filter.favoriteLimitNotice": "\u304A\u6C17\u306B\u5165\u308A\u306F{count}\u4EF6\u307E\u3067\u3067\u3059",
  "filter.noLabels": "\u4E00\u81F4\u3059\u308B\u30E9\u30D9\u30EB\u306F\u3042\u308A\u307E\u305B\u3093",
  "filter.recentLabels": "\u6700\u8FD1\u4F7F\u3063\u305F\u30E9\u30D9\u30EB",
  "filter.matchingLabels": "\u4E00\u81F4\u3059\u308B\u30E9\u30D9\u30EB",
  "filter.removeLabelAriaLabel": "{label}\u3092\u89E3\u9664",
  "filter.completion": "\u5B8C\u4E86\u72B6\u614B",
  "filter.includeCompleted": "\u5B8C\u4E86\u6E08\u307F\u30BF\u30B9\u30AF\u3092\u8868\u793A",
  "filter.results": "\u7D50\u679C",
  "filter.select": "\u30D5\u30A3\u30EB\u30BF\u3092\u9078\u629E",
  "filter.change": "\u30D5\u30A3\u30EB\u30BF\u3092\u5909\u66F4",
  "filter.clearActive": "\u30D5\u30A3\u30EB\u30BF\u3092\u89E3\u9664",
  "filter.clearedNotice": "\u30D5\u30A3\u30EB\u30BF\u3092\u89E3\u9664\u3057\u307E\u3057\u305F",
  "filter.clearAll": "\u3059\u3079\u3066\u89E3\u9664",
  "filter.apply": "\u9069\u7528",
  "filter.labelsDescription": "\u65E2\u5B58\u306E\u30E9\u30D9\u30EB\u3092\u9078\u629E\u3057\u307E\u3059\u3002\u9078\u629E\u3057\u305F\u3044\u305A\u308C\u304B\u306E\u30E9\u30D9\u30EB\u3092\u542B\u3080\u30BF\u30B9\u30AF\u3092\u8868\u793A\u3057\u307E\u3059\u3002",
  "filter.labelsPlaceholder": "\u4ED5\u4E8B, \u9023\u7D61",
  "adjust.ariaLabel": "\u8868\u793A\u3068\u30BF\u30B9\u30AF\u306E\u64CD\u4F5C",
  "adjust.ariaLabelActive": "\u8868\u793A\u3068\u30BF\u30B9\u30AF\u306E\u64CD\u4F5C\u3001{count}\u4EF6\u306E\u30D5\u30A3\u30EB\u30BF\u304C\u6709\u52B9",
  "labelManager.menu": "\u30E9\u30D9\u30EB\u7BA1\u7406",
  "labelManager.title": "\u30E9\u30D9\u30EB\u7BA1\u7406",
  "labelManager.search": "\u30E9\u30D9\u30EB\u3092\u691C\u7D22",
  "labelManager.empty": "\u4E00\u81F4\u3059\u308B\u30E9\u30D9\u30EB\u306F\u3042\u308A\u307E\u305B\u3093",
  "labelManager.storedOnly": "\u4FDD\u5B58\u306E\u307F",
  "labelManager.taskCountOne": "{count}\u4EF6\u306E\u30BF\u30B9\u30AF",
  "labelManager.taskCount": "{count}\u4EF6\u306E\u30BF\u30B9\u30AF",
  "labelManager.renameAriaLabel": "{label}\u306E\u540D\u524D\u3092\u5909\u66F4",
  "labelManager.deleteAriaLabel": "{label}\u3092\u524A\u9664",
  "labelManager.renameUsed": "{count}\u4EF6\u306E\u30BF\u30B9\u30AF\u306B\u3042\u308B\u300C{label}\u300D\u306E\u540D\u524D\u3092\u5909\u66F4",
  "labelManager.renameUsedOne": "{count}\u4EF6\u306E\u30BF\u30B9\u30AF\u306B\u3042\u308B\u300C{label}\u300D\u306E\u540D\u524D\u3092\u5909\u66F4",
  "labelManager.renameStoredOnly": "\u4FDD\u5B58\u6E08\u307F\u30E9\u30D9\u30EB\u300C{label}\u300D\u306E\u540D\u524D\u3092\u5909\u66F4",
  "labelManager.confirmRename": "\u540D\u524D\u3092\u5909\u66F4",
  "labelManager.deleteConfirm": "\u300C{label}\u300D\u3092{count}\u4EF6\u306E\u30BF\u30B9\u30AF\u304B\u3089\u5916\u3057\u307E\u3059\u304B\uFF1F\u30BF\u30B9\u30AF\u81EA\u4F53\u306F\u524A\u9664\u3055\u308C\u307E\u305B\u3093\u3002",
  "labelManager.deleteConfirmOne": "\u300C{label}\u300D\u3092{count}\u4EF6\u306E\u30BF\u30B9\u30AF\u304B\u3089\u5916\u3057\u307E\u3059\u304B\uFF1F\u30BF\u30B9\u30AF\u81EA\u4F53\u306F\u524A\u9664\u3055\u308C\u307E\u305B\u3093\u3002",
  "labelManager.deleteStoredOnlyConfirm": "\u4FDD\u5B58\u6E08\u307F\u30E9\u30D9\u30EB\u300C{label}\u300D\u3092\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F\u30BF\u30B9\u30AF\u30D5\u30A1\u30A4\u30EB\u306F\u5909\u66F4\u3055\u308C\u307E\u305B\u3093\u3002",
  "labelManager.renamedNotice": "\u300C{from}\u300D\u3092\u300C{to}\u300D\u3078\u5909\u66F4\u3057\u307E\u3057\u305F\uFF08{count}\u4EF6\uFF09",
  "labelManager.renamedNoticeOne": "\u300C{from}\u300D\u3092\u300C{to}\u300D\u3078\u5909\u66F4\u3057\u307E\u3057\u305F\uFF08{count}\u4EF6\uFF09",
  "labelManager.deletedNotice": "\u300C{label}\u300D\u3092{count}\u4EF6\u306E\u30BF\u30B9\u30AF\u304B\u3089\u5916\u3057\u307E\u3057\u305F",
  "labelManager.deletedNoticeOne": "\u300C{label}\u300D\u3092{count}\u4EF6\u306E\u30BF\u30B9\u30AF\u304B\u3089\u5916\u3057\u307E\u3057\u305F",
  "labelManager.partialFailure": "{total}\u4EF6\u4E2D{failed}\u4EF6\u3092\u66F4\u65B0\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F: {paths}",
  "selection.start": "\u30BF\u30B9\u30AF\u3092\u9078\u629E",
  "selection.ariaLabel": "\u30BF\u30B9\u30AF\u9078\u629E\u306E\u64CD\u4F5C",
  "selection.exit": "\u89E3\u9664",
  "selection.count": "{count}\u4EF6\u9078\u629E",
  "selection.selectAll": "\u3059\u3079\u3066\u9078\u629E",
  "selection.deleteConfirm": "{count}\u4EF6\u306E\u30BF\u30B9\u30AF\u3092Obsidian\u306E\u30B4\u30DF\u7BB1\u3078\u79FB\u52D5\u3057\u307E\u3059\u304B\uFF1F",
  "selection.deletedNotice": "{count}\u4EF6\u306E\u30BF\u30B9\u30AF\u3092\u30B4\u30DF\u7BB1\u3078\u79FB\u52D5\u3057\u307E\u3057\u305F",
  "selection.updatedNotice": "{count}\u4EF6\u306E\u30BF\u30B9\u30AF\u3092\u66F4\u65B0\u3057\u307E\u3057\u305F",
  "selection.partialFailure": "{total}\u4EF6\u4E2D{failed}\u4EF6\u3092\u5909\u66F4\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F",
  "tasks.empty": "\u30BF\u30B9\u30AF\u306F\u3042\u308A\u307E\u305B\u3093",
  "tasks.completeAriaLabel": "{title}\u3092\u5B8C\u4E86",
  "tasks.moreAriaLabel": "\u305D\u306E\u4ED6",
  "tasks.selectAriaLabel": "{title}\u3092\u9078\u629E",
  "tasks.deleteConfirm": "\u300C{title}\u300D\u3092\u30B4\u30DF\u7BB1\u3078\u79FB\u52D5\u3057\u307E\u3059\u304B\uFF1F",
  "tasks.deletedNotice": "\u30BF\u30B9\u30AF\u3092\u30B4\u30DF\u7BB1\u3078\u79FB\u52D5\u3057\u307E\u3057\u305F",
  "tasks.moreLabels": "\u307B\u304B{count}\u4EF6",
  "tasks.moreLabelsAriaLabel": "\u6B8B\u308A{count}\u4EF6\u306E\u30E9\u30D9\u30EB\u3092\u8868\u793A",
  "tasks.hideExtraLabels": "\u8FFD\u52A0\u306E\u30E9\u30D9\u30EB\u3092\u9589\u3058\u308B",
  "taskModal.addTitle": "\u30BF\u30B9\u30AF\u3092\u8FFD\u52A0",
  "taskModal.editTitle": "\u30BF\u30B9\u30AF\u3092\u7DE8\u96C6",
  "taskModal.title": "\u30BF\u30A4\u30C8\u30EB",
  "taskModal.titlePlaceholder": "\u3084\u308B\u3053\u3068",
  "taskModal.date": "\u65E5\u4ED8",
  "taskModal.project": "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8",
  "taskModal.unassigned": "\u672A\u6240\u5C5E",
  "taskModal.priority": "\u512A\u5148\u5EA6",
  "taskModal.noPriority": "\u306A\u3057",
  "taskModal.labels": "\u30E9\u30D9\u30EB",
  "taskModal.labelsDescription": "\u8FFD\u52A0\u30DC\u30BF\u30F3\u30FBEnter\u30FB\u534A\u89D2\u30AB\u30F3\u30DE\u3067\u8FFD\u52A0\u3001\u6700\u5927500\u7A2E\u985E",
  "taskModal.labelsPlaceholder": "\u30E9\u30D9\u30EB\u3092\u5165\u529B",
  "taskModal.addLabel": "\u8FFD\u52A0",
  "taskModal.addLabelAriaLabel": "\u5165\u529B\u3057\u305F\u30E9\u30D9\u30EB\u3092\u8FFD\u52A0",
  "taskModal.removeLabelAriaLabel": "{label}\u3092\u524A\u9664",
  "taskModal.chooseLabels": "\u9078\u629E",
  "taskModal.chooseExistingLabelsAriaLabel": "\u65E2\u5B58\u306E\u30E9\u30D9\u30EB\u304B\u3089\u9078\u3076",
  "taskModal.steps": "\u30B9\u30C6\u30C3\u30D7",
  "taskModal.addStep": "\uFF0B \u30B9\u30C6\u30C3\u30D7\u3092\u8FFD\u52A0",
  "taskModal.stepProgress": "{completed}/{total}\u4EF6\u5B8C\u4E86",
  "taskModal.stepCompletedAriaLabel": "\u30B9\u30C6\u30C3\u30D7{step}\u306E\u5B8C\u4E86\u72B6\u614B\u3092\u5207\u308A\u66FF\u3048",
  "taskModal.editStepAriaLabel": "\u30B9\u30C6\u30C3\u30D7\u300C{title}\u300D\u3092\u7DE8\u96C6",
  "taskModal.stepOverdue": "\u671F\u9650\u5207\u308C",
  "taskModal.stepDueToday": "\u4ECA\u65E5\u307E\u3067",
  "stepModal.addTitle": "\u30B9\u30C6\u30C3\u30D7\u3092\u8FFD\u52A0",
  "stepModal.editTitle": "\u30B9\u30C6\u30C3\u30D7\u3092\u7DE8\u96C6",
  "stepModal.title": "\u30B9\u30C6\u30C3\u30D7\u540D",
  "stepModal.titlePlaceholder": "\u3084\u308B\u3053\u3068",
  "stepModal.date": "\u65E5\u4ED8",
  "stepModal.add": "\u8FFD\u52A0",
  "taskModal.notes": "\u30E1\u30E2",
  "conflict.title": "\u7AF6\u5408\u3057\u305F\u5909\u66F4\u3092\u78BA\u8A8D",
  "conflict.description": "\u7DE8\u96C6\u4E2D\u306B\u3053\u306E\u30BF\u30B9\u30AF\u304C\u5909\u66F4\u3055\u308C\u307E\u3057\u305F\u3002\u7AF6\u5408\u3057\u3066\u3044\u308B\u5404\u9805\u76EE\u3067\u6B8B\u3059\u5024\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044\u3002",
  "conflict.currentValue": "\u73FE\u5728\u306E\u30D5\u30A1\u30A4\u30EB",
  "conflict.draftValue": "\u81EA\u5206\u306E\u7DE8\u96C6",
  "conflict.none": "\u306A\u3057",
  "conflict.sourceNote": "\u53C2\u7167\u5143\u30CE\u30FC\u30C8",
  "conflict.saveResolved": "\u78BA\u8A8D\u3057\u305F\u5185\u5BB9\u3092\u4FDD\u5B58",
  "conflict.changedAgain": "\u7AF6\u5408\u753B\u9762\u3092\u958B\u3044\u3066\u3044\u308B\u9593\u306B\u30BF\u30B9\u30AF\u304C\u518D\u3073\u5909\u66F4\u3055\u308C\u307E\u3057\u305F\u3002\u6700\u65B0\u306E\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3066\u304B\u3089\u4FDD\u5B58\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
  "conflict.missing": "\u30BF\u30B9\u30AF\u304C\u524A\u9664\u3055\u308C\u305F\u304B\u3001\u5229\u7528\u3067\u304D\u306A\u304F\u306A\u308A\u307E\u3057\u305F\u3002\u518D\u4F5C\u6210\u306F\u3057\u3066\u3044\u307E\u305B\u3093\u3002",
  "conflict.identityNotice": "\u540C\u3058\u30BF\u30B9\u30AFID\u3092\u6301\u3064\u30D5\u30A1\u30A4\u30EB\u304C\u8907\u6570\u3042\u308A\u307E\u3059: {paths}",
  "conflict.identityBanner": "{count}\u4EF6\u306E\u30BF\u30B9\u30AFID\u7AF6\u5408\u3092\u975E\u8868\u793A\u306B\u3057\u3066\u3044\u307E\u3059\u3002\u7DE8\u96C6\u3059\u308B\u524D\u306B\u91CD\u8907ID\u3092\u89E3\u6D88\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
  "conflict.identityDetails": "{id}: {paths}",
  "conflict.externalPreserved": "\u81EA\u5206\u306E\u5909\u66F4\u3092\u4FDD\u5B58\u3057\u3001\u5225\u306E\u5834\u6240\u304B\u3089\u884C\u308F\u308C\u305F\u65B0\u3057\u3044\u5909\u66F4\u3082\u7DAD\u6301\u3057\u307E\u3057\u305F\u3002",
  "conflict.resolved": "\u9078\u629E\u3057\u305F\u5185\u5BB9\u3067\u7AF6\u5408\u3092\u89E3\u6C7A\u3057\u3001\u30BF\u30B9\u30AF\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002",
  "bulk.title": "{count}\u4EF6\u3092\u4E00\u62EC\u7DE8\u96C6",
  "bulk.unchanged": "\u5909\u66F4\u3057\u306A\u3044",
  "bulk.setValue": "\u65E5\u4ED8\u3092\u6307\u5B9A",
  "bulk.labelsDescription": "\u9078\u629E\u3057\u305F\u30BF\u30B9\u30AF\u306E\u3044\u305A\u308C\u304B\u306B\u4ED8\u3044\u3066\u3044\u308B\u30E9\u30D9\u30EB\u3092\u8868\u793A\u3057\u307E\u3059\u3002\u300C\u4E00\u90E8\u300D\u306E\u30E9\u30D9\u30EB\u306F\u4E00\u90E8\u306E\u30BF\u30B9\u30AF\u3060\u3051\u306B\u4ED8\u3044\u3066\u3044\u307E\u3059\u3002\u2026\u304B\u3089\u3001\u7DAD\u6301\u3001\u5168\u30BF\u30B9\u30AF\u3078\u306E\u8FFD\u52A0\u3001\u307E\u305F\u306F\u9078\u629E\u4E2D\u306E\u3059\u3079\u3066\u306E\u30BF\u30B9\u30AF\u304B\u3089\u306E\u524A\u9664\u3092\u9078\u3079\u307E\u3059\u3002",
  "bulk.labelPartial": "\u4E00\u90E8",
  "bulk.labelActionsAriaLabel": "{label}\u306E\u64CD\u4F5C",
  "bulk.partialLabelActionsTitle": "{label}\u3092\u7DE8\u96C6",
  "bulk.partialLabelActionsDescription": "\u3053\u306E\u30E9\u30D9\u30EB\u306F\u9078\u629E\u4E2D\u306E\u4E00\u90E8\u306E\u30BF\u30B9\u30AF\u3060\u3051\u306B\u4ED8\u3044\u3066\u3044\u307E\u3059\u3002",
  "bulk.addLabelToAll": "\u5168\u30BF\u30B9\u30AF\u306B\u8FFD\u52A0",
  "bulk.removeLabel": "\u9078\u629E\u4E2D\u306E\u30BF\u30B9\u30AF\u304B\u3089\u5916\u3059",
  "bulk.removeLabelAriaLabel": "\u9078\u629E\u4E2D\u306E\u30BF\u30B9\u30AF\u304B\u3089{label}\u3092\u524A\u9664",
  "bulk.apply": "{count}\u4EF6\u306B\u9069\u7528",
  "date.today": "\u4ECA\u65E5",
  "date.tomorrow": "\u660E\u65E5",
  "date.sevenDays": "7\u65E5\u5F8C",
  "date.none": "\u65E5\u4ED8\u306A\u3057",
  "projectModal.addTitle": "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3092\u8FFD\u52A0",
  "projectModal.name": "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u540D",
  "projectModal.namePlaceholder": "\u65B0\u3057\u3044\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8",
  "settings.language": "\u8A00\u8A9E",
  "settings.languageDescription": "TaskMate\u3067\u4F7F\u7528\u3059\u308B\u8A00\u8A9E\u3092\u9078\u629E\u3057\u307E\u3059\u3002\u30B3\u30DE\u30F3\u30C9\u540D\u3068\u30EA\u30DC\u30F3\u306E\u8AAC\u660E\u3092\u66F4\u65B0\u3059\u308B\u306B\u306F\u3001\u30D7\u30E9\u30B0\u30A4\u30F3\u3092\u518D\u8AAD\u307F\u8FBC\u307F\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
  "settings.languageAuto": "\u81EA\u52D5",
  "settings.languageEnglish": "English",
  "settings.languageJapanese": "\u65E5\u672C\u8A9E",
  "settings.taskFolder": "\u30BF\u30B9\u30AF\u30D5\u30A9\u30EB\u30C0",
  "settings.taskFolderDescription": "\u30BF\u30B9\u30AF\u3054\u3068\u306B1\u3064\u306EMarkdown\u30D5\u30A1\u30A4\u30EB\u3092\u4FDD\u5B58\u3057\u307E\u3059\u3002",
  "settings.projectFolder": "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u30D5\u30A9\u30EB\u30C0",
  "settings.projectFolderDescription": "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3054\u3068\u306B1\u3064\u306EMarkdown\u30D5\u30A1\u30A4\u30EB\u3092\u4FDD\u5B58\u3057\u307E\u3059\u3002",
  "settings.proposalFolder": "\u63D0\u6848\u30D5\u30A9\u30EB\u30C0",
  "settings.proposalFolderDescription": "\u627F\u8A8D\u3057\u305F\u9805\u76EE\u3092\u30BF\u30B9\u30AF\u306B\u3059\u308B\u524D\u306B\u3001AI\u306B\u3088\u308B\u30A4\u30F3\u30DD\u30FC\u30C8\u63D0\u6848\u3092\u3053\u3053\u3067\u78BA\u8A8D\u3057\u307E\u3059\u3002",
  "settings.sourceFolders": "AI\u5BFE\u8C61\u30D5\u30A9\u30EB\u30C0",
  "settings.sourceFoldersDescription": "Vault\u304B\u3089\u306E\u76F8\u5BFE\u30D1\u30B9\u30921\u884C\u306B1\u30D5\u30A9\u30EB\u30C0\u5165\u529B\u3057\u307E\u3059\u3002\u914D\u4E0B\u306E\u30CE\u30FC\u30C8\u306F\u3053\u306E\u8A2D\u5B9A\u3092\u5F15\u304D\u7D99\u304E\u307E\u3059\u3002",
  "settings.includeSubfolders": "\u30B5\u30D6\u30D5\u30A9\u30EB\u30C0\u3092\u542B\u3081\u308B",
  "settings.includeSubfoldersDescription": "\u5404AI\u5BFE\u8C61\u30D5\u30A9\u30EB\u30C0\u306E\u8A2D\u5B9A\u3092\u3001\u305D\u306E\u30B5\u30D6\u30D5\u30A9\u30EB\u30C0\u306B\u3082\u9069\u7528\u3057\u307E\u3059\u3002",
  "command.openRibbon": "TaskMate\u3092\u958B\u304F",
  "command.openList": "\u30BF\u30B9\u30AF\u4E00\u89A7\u3092\u958B\u304F",
  "command.includeNote": "\u73FE\u5728\u306E\u30CE\u30FC\u30C8\u3092AI\u5BFE\u8C61\u306B\u3059\u308B",
  "command.excludeNote": "\u73FE\u5728\u306E\u30CE\u30FC\u30C8\u3092AI\u5BFE\u8C61\u5916\u306B\u3059\u308B",
  "command.includeFolder": "\u73FE\u5728\u306E\u30D5\u30A9\u30EB\u30C0\u3092AI\u5BFE\u8C61\u306B\u3059\u308B",
  "notice.migratedTaskNames": "{count}\u4EF6\u306E\u30BF\u30B9\u30AF\u30CE\u30FC\u30C8\u540D\u304B\u3089ID\u3092\u53D6\u308A\u9664\u304D\u307E\u3057\u305F",
  "notice.migrationFailed": "\u4E00\u90E8\u306E\u30BF\u30B9\u30AF\u30CE\u30FC\u30C8\u540D\u3092\u66F4\u65B0\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F",
  "notice.noteIncluded": "AI\u5BFE\u8C61\u306B\u8FFD\u52A0\u3057\u307E\u3057\u305F",
  "notice.noteExcluded": "AI\u5BFE\u8C61\u304B\u3089\u9664\u5916\u3057\u307E\u3057\u305F",
  "notice.folderIncluded": "{folder}\u3092AI\u5BFE\u8C61\u306B\u8FFD\u52A0\u3057\u307E\u3057\u305F"
};

// src/i18n/index.ts
var catalogs = { en, ja };
var PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g;
function selectLocalizedMessage(english, localized) {
  if (!english.trim()) throw new Error("The canonical English translation must not be blank");
  return localized?.trim() ? localized : english;
}
function isLanguagePreference(value) {
  return value === "auto" || value === "en" || value === "ja";
}
function resolveLocale(preference, detectedLanguage) {
  if (preference === "en" || preference === "ja") return preference;
  if (preference !== "auto") return "en";
  const normalized = detectedLanguage?.trim().toLowerCase().replace(/_/g, "-") ?? "";
  if (normalized === "ja" || normalized.startsWith("ja-")) return "ja";
  return "en";
}
function compareDisplayText(a, b, locale) {
  return new Intl.Collator(locale).compare(a, b);
}
function interpolate(message, values) {
  return message.replace(PLACEHOLDER, (_placeholder, name) => {
    if (!values || !(name in values)) throw new Error(`Missing translation value: ${name}`);
    return String(values[name]);
  });
}
function createI18n(preference, detectedLanguage) {
  const locale = resolveLocale(preference, detectedLanguage);
  const t = ((key, ...args) => {
    const message = selectLocalizedMessage(en[key], catalogs[locale][key]);
    return interpolate(message, args[0]);
  });
  return { locale, t };
}

// src/labels/label-picker-model.ts
var FAVORITE_LABEL_LIMIT = 10;
var RECENT_LABEL_LIMIT = 10;
function firstCharacter(label) {
  return Array.from(label.trim())[0] ?? "";
}
function groupId(label) {
  const first = firstCharacter(label);
  const latin = first.toLocaleUpperCase("en-US");
  if (/^[A-Z]$/.test(latin)) return `latin:${latin}`;
  if (/^[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]$/.test(first)) return "japanese";
  return "other";
}
function groupOrder(id) {
  if (id.startsWith("latin:")) return id.charCodeAt(id.length - 1) - 65;
  if (id === "japanese") return 26;
  return 27;
}
function availableFilterLabels(tasks, includeCompleted) {
  const labels = [];
  for (const task of tasks) {
    if (!includeCompleted && task.completed) continue;
    labels.push(...task.labels);
  }
  return normalizeLabels(labels);
}
function initialLabelPickerSelection(selectedLabels, availableLabels, preserveUnavailable) {
  const selected = normalizeLabels(selectedLabels);
  if (preserveUnavailable) return selected;
  const available = new Set(normalizeLabels(availableLabels));
  return selected.filter((label) => available.has(label));
}
function buildLabelGroups(labels, query, locale) {
  const needle = query.trim().toLocaleLowerCase(locale);
  const grouped = /* @__PURE__ */ new Map();
  normalizeLabels(labels).filter((label) => !needle || label.toLocaleLowerCase(locale).includes(needle)).forEach((label) => {
    const id = groupId(label);
    grouped.set(id, [...grouped.get(id) ?? [], label]);
  });
  return [...grouped.entries()].map(([id, items]) => ({ id, labels: items.sort((a, b) => compareDisplayText(a, b, locale)) })).sort((a, b) => groupOrder(a.id) - groupOrder(b.id));
}
function suggestedLabels(availableLabels, favoriteLabels, recentLabels) {
  const available = new Set(normalizeLabels(availableLabels));
  const favorites = normalizeLabels(favoriteLabels).filter((label) => available.has(label)).slice(0, FAVORITE_LABEL_LIMIT);
  const favoriteSet = new Set(favorites);
  const recent = normalizeLabels(recentLabels).filter((label) => available.has(label) && !favoriteSet.has(label)).slice(0, RECENT_LABEL_LIMIT);
  return { favorites, recent };
}
function toggleFavoriteLabel(favoriteLabels, label, limit = FAVORITE_LABEL_LIMIT) {
  const normalized = normalizeLabels(favoriteLabels);
  if (normalized.includes(label)) {
    return { favorites: normalized.filter((item) => item !== label), changed: true, atLimit: false };
  }
  if (normalized.length >= limit) return { favorites: normalized, changed: false, atLimit: true };
  return { favorites: [label, ...normalized], changed: true, atLimit: false };
}

// src/labels/label-picker-modal.ts
var LabelPickerModal = class extends import_obsidian4.Modal {
  constructor(app, options) {
    super(app);
    this.options = options;
    this.selectedLabels = initialLabelPickerSelection(
      options.selectedLabels,
      options.allLabels,
      options.preserveUnavailableSelectedLabels ?? false
    );
    this.favoriteLabels = normalizeLabels(options.favoriteLabels);
    this.setTitle(options.i18n.t("filter.labelPickerTitle"));
  }
  selectedLabels;
  favoriteLabels;
  tab = "suggested";
  query = "";
  activeGroup = null;
  resultsEl = null;
  indexEl = null;
  onOpen() {
    const { t } = this.options.i18n;
    this.modalEl.addClass("taskmate-label-picker-modal");
    const controls = this.contentEl.createDiv({ cls: "taskmate-label-picker-controls" });
    const search = controls.createEl("input", {
      type: "text",
      cls: "taskmate-label-picker-search",
      placeholder: t("filter.labelSearchPlaceholder"),
      attr: {
        "aria-label": t("filter.labelSearchAriaLabel"),
        "inputmode": "search",
        "enterkeyhint": "search"
      }
    });
    let composing = false;
    search.addEventListener("compositionstart", () => {
      composing = true;
    });
    search.addEventListener("compositionend", () => {
      composing = false;
      this.query = search.value;
      this.renderPicker();
    });
    search.addEventListener("input", (event) => {
      this.query = search.value;
      if (composing || event.isComposing) return;
      this.renderPicker();
    });
    const tabs = controls.createDiv({ cls: "taskmate-label-picker-tabs", attr: { role: "tablist" } });
    ["suggested", "all"].forEach((tab) => {
      const button2 = tabs.createEl("button", {
        text: t(tab === "suggested" ? "filter.suggestedLabelsTab" : "filter.allLabelsTab"),
        attr: { role: "tab" }
      });
      button2.addEventListener("click", () => {
        this.tab = tab;
        this.renderPicker();
      });
    });
    this.indexEl = controls.createDiv({ cls: "taskmate-label-picker-index" });
    this.resultsEl = this.contentEl.createDiv({ cls: "taskmate-label-picker-results" });
    const actions = this.contentEl.createDiv({ cls: "taskmate-modal-actions taskmate-label-picker-actions" });
    const cancel = actions.createEl("button", { text: t("common.cancel") });
    cancel.addEventListener("click", () => this.close());
    const confirm = actions.createEl("button", { text: t("filter.confirmLabelSelection"), cls: "mod-cta" });
    confirm.addEventListener("click", async () => {
      confirm.disabled = true;
      try {
        await this.options.onConfirm([...this.selectedLabels], [...this.favoriteLabels]);
        this.close();
      } finally {
        confirm.disabled = false;
      }
    });
    this.renderPicker();
  }
  onClose() {
    this.contentEl.empty();
  }
  renderPicker() {
    const { t } = this.options.i18n;
    const tabs = this.contentEl.querySelectorAll(".taskmate-label-picker-tabs button");
    tabs.forEach((button2, index2) => {
      const selected = index2 === 0 && this.tab === "suggested" || index2 === 1 && this.tab === "all";
      button2.toggleClass("is-active", selected);
      button2.setAttribute("aria-selected", String(selected));
    });
    if (!this.resultsEl || !this.indexEl) return;
    this.resultsEl.empty();
    this.indexEl.empty();
    this.indexEl.toggleClass("is-hidden", this.tab !== "all");
    if (this.tab === "suggested") {
      const suggested = suggestedLabels(this.options.allLabels, this.favoriteLabels, this.options.recentLabels);
      const needle = this.query.trim().toLocaleLowerCase(this.options.i18n.locale);
      const favorites = suggested.favorites.filter((label) => label.toLocaleLowerCase(this.options.i18n.locale).includes(needle));
      const recent = suggested.recent.filter((label) => label.toLocaleLowerCase(this.options.i18n.locale).includes(needle));
      this.renderSection(t("filter.favoriteLabels"), favorites);
      this.renderSection(t("filter.recentLabels"), recent);
      if (favorites.length === 0 && recent.length === 0) this.renderEmpty();
      return;
    }
    const groups = buildLabelGroups(this.options.allLabels, this.query, this.options.i18n.locale);
    if (!groups.some((group) => group.id === this.activeGroup)) this.activeGroup = groups[0]?.id ?? null;
    this.indexEl.setAttribute("aria-label", t("filter.labelIndexAriaLabel"));
    groups.forEach((group) => {
      const active2 = group.id === this.activeGroup;
      const button2 = this.indexEl?.createEl("button", {
        text: this.groupLabel(group.id),
        cls: active2 ? "is-active" : "",
        attr: { "aria-pressed": String(active2) }
      });
      button2?.addEventListener("click", () => {
        this.activeGroup = group.id;
        this.renderPicker();
      });
    });
    const active = groups.find((group) => group.id === this.activeGroup);
    if (!active) {
      this.renderEmpty();
      return;
    }
    this.resultsEl.createEl("h3", { text: this.groupLabel(active.id) });
    active.labels.forEach((label) => this.renderLabelRow(label));
  }
  renderSection(title, labels) {
    if (!this.resultsEl || labels.length === 0) return;
    const section = this.resultsEl.createDiv({ cls: "taskmate-label-picker-section" });
    section.createEl("h3", { text: title });
    labels.forEach((label) => this.renderLabelRow(label, section));
  }
  renderLabelRow(label, container = this.resultsEl) {
    if (!container) return;
    const { t } = this.options.i18n;
    const selected = this.selectedLabels.includes(label);
    const favorite = this.favoriteLabels.includes(label);
    const row = container.createDiv({ cls: "taskmate-label-picker-row" });
    const select = row.createEl("button", {
      cls: `taskmate-label-picker-select${selected ? " is-selected" : ""}`,
      attr: { "aria-pressed": String(selected) }
    });
    if (selected) select.createSpan({ text: "\u2713", cls: "taskmate-label-picker-check", attr: { "aria-hidden": "true" } });
    select.createSpan({ text: label });
    select.addEventListener("click", () => {
      this.selectedLabels = selected ? this.selectedLabels.filter((item) => item !== label) : [...this.selectedLabels, label].slice(0, 500);
      this.renderPicker();
    });
    const star = row.createEl("button", {
      text: favorite ? "\u2605" : "\u2606",
      cls: `taskmate-label-picker-favorite${favorite ? " is-favorite" : ""}`,
      attr: {
        "aria-label": t(favorite ? "filter.removeFavoriteAriaLabel" : "filter.addFavoriteAriaLabel", { label }),
        "aria-pressed": String(favorite)
      }
    });
    star.addEventListener("click", () => this.toggleFavorite(label));
  }
  toggleFavorite(label) {
    const result = toggleFavoriteLabel(this.favoriteLabels, label);
    if (result.atLimit) {
      new import_obsidian4.Notice(this.options.i18n.t("filter.favoriteLimitNotice", { count: FAVORITE_LABEL_LIMIT }));
      return;
    }
    if (!result.changed) return;
    this.favoriteLabels = result.favorites;
    this.renderPicker();
  }
  groupLabel(group) {
    const { t } = this.options.i18n;
    if (group.startsWith("latin:")) return group.slice(-1);
    return t(group === "japanese" ? "filter.groupJapanese" : "filter.groupOther");
  }
  renderEmpty() {
    this.resultsEl?.createDiv({ text: this.options.i18n.t("filter.noLabels"), cls: "taskmate-empty" });
  }
};

// src/shared/mobile-keyboard-layout.ts
function finiteNonNegative(value) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
function calculateKeyboardLayout(input) {
  const keyboardClearance = Math.max(
    0,
    finiteNonNegative(input.keyboardOcclusion) - finiteNonNegative(input.hostShrink)
  );
  const alignmentClearance = finiteNonNegative(input.alignmentShortfall);
  return {
    keyboardClearance,
    alignmentClearance,
    totalClearance: keyboardClearance + alignmentClearance
  };
}
function clampScrollTop(scrollTop, scrollHeight, clientHeight) {
  const maximum = Math.max(0, finiteNonNegative(scrollHeight) - finiteNonNegative(clientHeight));
  return Math.min(Math.max(0, finiteNonNegative(scrollTop)), maximum);
}
function retainAlignmentClearance(currentClearance, requiredClearance, keyboardOpen) {
  if (!keyboardOpen) return 0;
  return Math.max(finiteNonNegative(currentClearance), finiteNonNegative(requiredClearance));
}
function calculateModalFit(region, modal, currentShift, edgeGap = 8) {
  const availableHeight = Math.max(0, region.height - edgeGap * 2);
  const naturalTop = modal.top - currentShift;
  const naturalBottom = modal.bottom - currentShift;
  const topLimit = region.top + edgeGap;
  const bottomLimit = region.bottom - edgeGap;
  let shift = 0;
  if (naturalBottom > bottomLimit) shift = bottomLimit - naturalBottom;
  if (naturalTop + shift < topLimit) shift += topLimit - (naturalTop + shift);
  return { availableHeight, shift };
}
var KEYBOARD_THRESHOLD = 48;
var COMFORTABLE_EDGE = 24;
function shouldConstrainModal(hasActiveControl, keyboardOcclusion, hostShrink) {
  if (!hasActiveControl) return false;
  return keyboardOcclusion >= KEYBOARD_THRESHOLD || hostShrink >= KEYBOARD_THRESHOLD;
}
var MobileKeyboardScroller = class {
  constructor(fields, modal, availableRegion, baselineAvailableHeight) {
    this.fields = fields;
    this.modal = modal;
    this.availableRegion = availableRegion;
    this.baselineAvailableHeight = baselineAvailableHeight ?? availableRegion.getBoundingClientRect().height;
    this.baselineViewportBottom = this.viewportBottom();
  }
  baselineAvailableHeight;
  baselineViewportBottom;
  activeControl = null;
  resizeObserver = null;
  scheduledFrame = null;
  delayedAdjustments = [];
  closed = false;
  modalShift = 0;
  alignmentClearance = 0;
  currentClearance = 0;
  connect() {
    if (!window.matchMedia("(max-width: 700px)").matches) return;
    this.fields.addEventListener("focusin", this.handleFocusIn);
    this.fields.addEventListener("focusout", this.handleFocusOut);
    window.addEventListener("resize", this.scheduleAdjustment);
    window.visualViewport?.addEventListener("resize", this.scheduleAdjustment);
    window.visualViewport?.addEventListener("scroll", this.scheduleAdjustment);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this.scheduleAdjustment);
      this.resizeObserver.observe(this.fields);
      this.resizeObserver.observe(this.availableRegion);
    }
    this.scheduleAdjustment();
  }
  disconnect() {
    this.closed = true;
    this.fields.removeEventListener("focusin", this.handleFocusIn);
    this.fields.removeEventListener("focusout", this.handleFocusOut);
    window.removeEventListener("resize", this.scheduleAdjustment);
    window.visualViewport?.removeEventListener("resize", this.scheduleAdjustment);
    window.visualViewport?.removeEventListener("scroll", this.scheduleAdjustment);
    this.resizeObserver?.disconnect();
    if (this.scheduledFrame !== null) window.cancelAnimationFrame(this.scheduledFrame);
    for (const timer of this.delayedAdjustments) window.clearTimeout(timer);
    this.fields.style.removeProperty("--taskmate-keyboard-clearance");
    this.modal.style.removeProperty("--taskmate-modal-available-height");
    this.modal.style.removeProperty("--taskmate-modal-shift");
  }
  handleFocusIn = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches("input, textarea, [contenteditable='true']")) return;
    if (this.activeControl !== target) this.alignmentClearance = 0;
    this.activeControl = target;
    this.scheduleAdjustment();
    for (const delay of [80, 180, 360, 600]) {
      this.delayedAdjustments.push(window.setTimeout(this.scheduleAdjustment, delay));
    }
  };
  handleFocusOut = () => {
    window.setTimeout(() => {
      if (this.closed || this.fields.contains(document.activeElement)) return;
      this.activeControl = null;
      this.scheduleAdjustment();
    }, 0);
  };
  scheduleAdjustment = () => {
    if (this.closed || this.scheduledFrame !== null) return;
    this.scheduledFrame = window.requestAnimationFrame(() => {
      this.scheduledFrame = null;
      this.adjust();
    });
  };
  adjust() {
    const availableHeight = this.availableRegion.getBoundingClientRect().height;
    const hostShrink = Math.max(0, this.baselineAvailableHeight - availableHeight);
    const keyboardOcclusion = Math.max(0, this.baselineViewportBottom - this.viewportBottom());
    const keyboardLikelyOpen = shouldConstrainModal(
      this.activeControl !== null,
      keyboardOcclusion,
      hostShrink
    );
    if (!keyboardLikelyOpen || !this.activeControl) {
      this.resetModalFit();
      this.alignmentClearance = 0;
      this.setClearance(0);
      this.fields.scrollTop = clampScrollTop(
        this.fields.scrollTop,
        this.fields.scrollHeight,
        this.fields.clientHeight
      );
      return;
    }
    this.fitModalToAvailableRegion();
    const keyboardLayout = calculateKeyboardLayout({
      keyboardOcclusion,
      hostShrink,
      alignmentShortfall: 0
    });
    window.requestAnimationFrame(() => {
      if (this.closed || !this.activeControl) return;
      const fieldsRect = this.fields.getBoundingClientRect();
      const controlRect = this.activeControl.getBoundingClientRect();
      const visibleTop = fieldsRect.top + COMFORTABLE_EDGE;
      const visibleBottom = Math.min(fieldsRect.bottom, this.viewportBottom()) - COMFORTABLE_EDGE;
      if (visibleBottom <= visibleTop) return;
      let desiredDelta = 0;
      if (controlRect.bottom > visibleBottom || controlRect.top < visibleTop) {
        desiredDelta = (controlRect.top + controlRect.bottom) / 2 - (visibleTop + visibleBottom) / 2;
      }
      if (desiredDelta > 0) {
        const baseScrollHeight = Math.max(0, this.fields.scrollHeight - this.currentClearance);
        const remainingScroll = Math.max(
          0,
          baseScrollHeight + keyboardLayout.keyboardClearance - this.fields.clientHeight - this.fields.scrollTop
        );
        const alignmentShortfall = Math.max(0, desiredDelta - remainingScroll);
        this.alignmentClearance = retainAlignmentClearance(
          this.alignmentClearance,
          alignmentShortfall,
          true
        );
      }
      const layout = calculateKeyboardLayout({
        keyboardOcclusion,
        hostShrink,
        alignmentShortfall: this.alignmentClearance
      });
      this.setClearance(layout.totalClearance);
      if (desiredDelta !== 0) this.fields.scrollBy({ top: desiredDelta, behavior: "auto" });
    });
  }
  setClearance(value) {
    const next = Math.max(0, value);
    if (Math.abs(next - this.currentClearance) < 1) return;
    this.currentClearance = next;
    this.fields.style.setProperty("--taskmate-keyboard-clearance", `${next}px`);
  }
  fitModalToAvailableRegion() {
    const region = this.availableRegion.getBoundingClientRect();
    if (region.height <= 0) return;
    const availableHeight = Math.max(0, region.height - 16);
    this.modal.style.setProperty("--taskmate-modal-available-height", `${availableHeight}px`);
    const current = this.modal.getBoundingClientRect();
    const fit = calculateModalFit(region, current, this.modalShift);
    this.modalShift = fit.shift;
    this.modal.style.setProperty("--taskmate-modal-shift", `${fit.shift}px`);
  }
  resetModalFit() {
    if (this.modalShift === 0 && !this.modal.style.getPropertyValue("--taskmate-modal-available-height")) return;
    this.modalShift = 0;
    this.modal.style.removeProperty("--taskmate-modal-available-height");
    this.modal.style.removeProperty("--taskmate-modal-shift");
  }
  viewportBottom() {
    const viewport = window.visualViewport;
    return viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
  }
};

// src/task-list/bulk-task-modal.ts
var DATE_SUGGESTION_KEYS = { today: "date.today", tomorrow: "date.tomorrow", "seven-days": "date.sevenDays", none: "date.none" };
function decorateField(setting, icon, accessibleName) {
  setting.settingEl.addClass("taskmate-compact-setting");
  const marker = document.createElement("span");
  marker.addClass("taskmate-field-icon");
  marker.setAttribute("aria-hidden", "true");
  (0, import_obsidian5.setIcon)(marker, icon);
  setting.settingEl.prepend(marker);
  setting.controlEl.setAttribute("aria-label", accessibleName);
}
function addEmbeddedLabel(setting, label) {
  setting.controlEl.addClass("taskmate-embedded-select");
  setting.controlEl.prepend(setting.controlEl.createSpan({ text: label, cls: "taskmate-embedded-field-label", attr: { "aria-hidden": "true" } }));
}
var PartialLabelActionsModal = class extends import_obsidian5.Modal {
  constructor(app, label, i18n, onAddToAll, onRemove) {
    super(app);
    this.i18n = i18n;
    this.onAddToAll = onAddToAll;
    this.onRemove = onRemove;
    this.setTitle(i18n.t("bulk.partialLabelActionsTitle", { label }));
  }
  onOpen() {
    const { t } = this.i18n;
    this.modalEl.addClass("taskmate-partial-label-actions-modal");
    this.contentEl.createDiv({ text: t("bulk.partialLabelActionsDescription"), cls: "taskmate-partial-label-actions-description" });
    const actions = this.contentEl.createDiv({ cls: "taskmate-partial-label-actions" });
    const addToAll = actions.createEl("button", { text: t("bulk.addLabelToAll"), cls: "mod-cta" });
    addToAll.addEventListener("click", () => {
      this.onAddToAll();
      this.close();
    });
    const remove = actions.createEl("button", { text: t("bulk.removeLabel"), cls: "mod-warning" });
    remove.addEventListener("click", () => {
      this.onRemove();
      this.close();
    });
    const cancel = actions.createEl("button", { text: t("common.cancel") });
    cancel.addEventListener("click", () => this.close());
  }
  onClose() {
    this.contentEl.empty();
  }
};
var BulkTaskModal = class extends import_obsidian5.Modal {
  constructor(app, tasks, projects, labelOptions, availableRegion, i18n, onApply) {
    super(app);
    this.tasks = tasks;
    this.projects = projects;
    this.labelOptions = labelOptions;
    this.availableRegion = availableRegion;
    this.i18n = i18n;
    this.onApply = onApply;
    this.baselineAvailableHeight = availableRegion.getBoundingClientRect().height;
    this.initialLabels = normalizeLabels(tasks.flatMap((task) => task.labels)).slice(0, 500);
    this.setTitle(i18n.t("bulk.title", { count: tasks.length }));
  }
  changes = { addLabels: [], removeLabels: [] };
  keyboardScroller = null;
  baselineAvailableHeight;
  initialLabels;
  onOpen() {
    const { t } = this.i18n;
    this.modalEl.addClass("taskmate-task-modal", "taskmate-bulk-task-modal");
    const fields = this.contentEl.createDiv({ cls: "taskmate-task-fields" });
    const dateSetting = new import_obsidian5.Setting(fields).setName(t("taskModal.date"));
    dateSetting.settingEl.addClass("taskmate-date-setting");
    decorateField(dateSetting, "calendar-days", t("taskModal.date"));
    const datePresets = dateSetting.controlEl.createDiv({ cls: "taskmate-date-presets taskmate-bulk-date-presets" });
    const dateButtons = [];
    let dateInput;
    const selectDate = (value) => {
      if (value === void 0) delete this.changes.date;
      else this.changes.date = value;
      dateInput.value = typeof value === "string" ? value : "";
      dateButtons.forEach((button2) => {
        const selected = button2.dataset.bulkDate === (value === void 0 ? "unchanged" : value ?? "");
        button2.toggleClass("is-active", selected);
        button2.setAttribute("aria-pressed", String(selected));
      });
    };
    const unchanged = datePresets.createEl("button", { text: t("bulk.unchanged"), cls: "taskmate-suggestion-chip is-active", attr: { type: "button", "aria-pressed": "true" } });
    unchanged.dataset.bulkDate = "unchanged";
    unchanged.addEventListener("click", () => selectDate(void 0));
    dateButtons.push(unchanged);
    for (const suggestion of taskDateSuggestions()) {
      const button2 = datePresets.createEl("button", { cls: "taskmate-suggestion-chip", attr: { type: "button", "aria-pressed": "false" } });
      button2.dataset.bulkDate = suggestion.date ?? "";
      button2.createSpan({ text: t(DATE_SUGGESTION_KEYS[suggestion.id]) });
      button2.addEventListener("click", () => selectDate(suggestion.date));
      dateButtons.push(button2);
    }
    dateSetting.addText((text) => {
      text.inputEl.type = "date";
      text.inputEl.addClass("taskmate-date-input");
      text.inputEl.setAttribute("aria-label", t("taskModal.date"));
      dateInput = text.inputEl;
      text.onChange((value) => selectDate(value || null));
    });
    const projectSetting = new import_obsidian5.Setting(fields).setName(t("taskModal.project"));
    decorateField(projectSetting, "folder", t("taskModal.project"));
    addEmbeddedLabel(projectSetting, t("taskModal.project"));
    projectSetting.addDropdown((dropdown) => {
      dropdown.addOption("unchanged", t("bulk.unchanged")).addOption("clear", t("taskModal.unassigned"));
      this.projects.forEach((project) => dropdown.addOption(project.id, project.name));
      dropdown.onChange((value) => {
        if (value === "unchanged") delete this.changes.projectId;
        else this.changes.projectId = value === "clear" ? null : value;
      });
    });
    const prioritySetting = new import_obsidian5.Setting(fields).setName(t("taskModal.priority"));
    decorateField(prioritySetting, "flag", t("taskModal.priority"));
    addEmbeddedLabel(prioritySetting, t("taskModal.priority"));
    prioritySetting.addDropdown((dropdown) => dropdown.addOption("unchanged", t("bulk.unchanged")).addOption("clear", t("taskModal.noPriority")).addOption("1", t("filter.priorityValue", { priority: 1 })).addOption("2", t("filter.priorityValue", { priority: 2 })).addOption("3", t("filter.priorityValue", { priority: 3 })).onChange((value) => {
      if (value === "unchanged") delete this.changes.priority;
      else this.changes.priority = value === "clear" ? null : Number(value);
    }));
    const labelSetting = new import_obsidian5.Setting(fields).setName(t("taskModal.labels")).setDesc(t("bulk.labelsDescription"));
    labelSetting.settingEl.addClass("taskmate-label-setting");
    decorateField(labelSetting, "tags", t("taskModal.labels"));
    const entryRow = labelSetting.controlEl.createDiv({ cls: "taskmate-label-entry-row" });
    const editor = entryRow.createDiv({ cls: "taskmate-editor-label-summary taskmate-label-chip-editor" });
    const input = editor.createEl("input", { type: "text", cls: "taskmate-label-chip-input", placeholder: t("taskModal.labelsPlaceholder"), attr: { "aria-label": t("taskModal.labels"), enterkeyhint: "enter" } });
    const add = entryRow.createEl("button", { text: t("taskModal.addLabel"), cls: "taskmate-label-add", attr: { type: "button", "aria-label": t("taskModal.addLabelAriaLabel") } });
    let pending = "";
    let composing = false;
    let expanded = false;
    const labelsNow = () => this.initialLabels.filter((label) => !this.changes.removeLabels.includes(label)).concat(this.changes.addLabels.filter((label) => !this.initialLabels.includes(label)));
    const include = (label) => {
      if (this.initialLabels.includes(label)) this.changes.removeLabels = this.changes.removeLabels.filter((item) => item !== label);
      else if (!this.changes.addLabels.includes(label)) this.changes.addLabels = [...this.changes.addLabels, label].slice(0, 500);
    };
    const includeEverywhere = (label) => {
      this.changes.removeLabels = this.changes.removeLabels.filter((item) => item !== label);
      if (!this.changes.addLabels.includes(label)) this.changes.addLabels = [...this.changes.addLabels, label].slice(0, 500);
    };
    const exclude = (label) => {
      this.changes.addLabels = this.changes.addLabels.filter((item) => item !== label);
      if (this.initialLabels.includes(label) && !this.changes.removeLabels.includes(label)) this.changes.removeLabels = [...this.changes.removeLabels, label];
    };
    const refresh = () => {
      editor.querySelectorAll("[data-taskmate-label-chip], .taskmate-label-overflow-toggle").forEach((element2) => element2.remove());
      const labels = labelsNow();
      const summary = summarizeLabels(labels);
      for (const label of expanded ? labels : summary.visible) {
        const assigned = this.tasks.filter((task) => task.labels.includes(label)).length;
        const partial = assigned > 0 && assigned < this.tasks.length && !this.changes.addLabels.includes(label);
        const chip = document.createElement("span");
        chip.addClass("taskmate-editor-label-chip");
        if (partial) chip.addClass("taskmate-bulk-label-partial");
        chip.dataset.taskmateLabelChip = label;
        chip.createSpan({ text: label });
        if (partial) {
          chip.createSpan({ text: t("bulk.labelPartial"), cls: "taskmate-bulk-label-partial-status" });
          const more = chip.createEl("button", { cls: "taskmate-label-chip-more", attr: { type: "button", "aria-label": t("bulk.labelActionsAriaLabel", { label }) } });
          (0, import_obsidian5.setIcon)(more, "ellipsis");
          more.addEventListener("click", () => new PartialLabelActionsModal(
            this.app,
            label,
            this.i18n,
            () => {
              includeEverywhere(label);
              refresh();
            },
            () => {
              exclude(label);
              refresh();
            }
          ).open());
        } else {
          const remove = chip.createEl("button", { cls: "taskmate-label-chip-remove", attr: { type: "button", "aria-label": t("bulk.removeLabelAriaLabel", { label }) } });
          (0, import_obsidian5.setIcon)(remove, "x");
          remove.addEventListener("click", () => {
            exclude(label);
            if (labelsNow().length <= 3) expanded = false;
            refresh();
          });
        }
        editor.insertBefore(chip, input);
      }
      if (summary.hidden.length > 0) {
        const toggle = document.createElement("button");
        toggle.addClass("taskmate-label-overflow-toggle");
        toggle.type = "button";
        toggle.textContent = expanded ? t("tasks.hideExtraLabels") : t("tasks.moreLabels", { count: summary.hidden.length });
        toggle.addEventListener("click", () => {
          expanded = !expanded;
          refresh();
        });
        editor.insertBefore(toggle, input);
      }
      add.disabled = pending.trim().length === 0;
    };
    const commitInput = (commitPending, keepFocus) => {
      const next = updateLabelChipInput(labelsNow(), input.value, commitPending);
      next.labels.forEach(include);
      pending = next.pending;
      input.value = pending;
      refresh();
      if (keepFocus) window.requestAnimationFrame(() => input.focus({ preventScroll: true }));
    };
    input.addEventListener("compositionstart", () => {
      composing = true;
    });
    input.addEventListener("compositionend", () => {
      composing = false;
      commitInput(false, false);
    });
    input.addEventListener("input", (event) => {
      pending = input.value;
      add.disabled = !pending.trim();
      if (!composing && !event.isComposing) commitInput(false, false);
    });
    input.addEventListener("keydown", (event) => {
      if (shouldCommitLabelOnEnter(event.key, composing || event.isComposing, event.keyCode)) {
        event.preventDefault();
        commitInput(true, true);
      }
    });
    add.addEventListener("pointerdown", (event) => event.preventDefault());
    add.addEventListener("click", () => commitInput(true, true));
    const choose = labelSetting.controlEl.createEl("button", { text: t("taskModal.chooseLabels"), cls: "taskmate-editor-label-picker-open", attr: { type: "button", "aria-label": t("taskModal.chooseExistingLabelsAriaLabel") } });
    choose.addEventListener("click", () => new LabelPickerModal(this.app, {
      selectedLabels: labelsNow(),
      allLabels: this.labelOptions.allLabels,
      recentLabels: this.labelOptions.recentLabels,
      favoriteLabels: this.labelOptions.favoriteLabels,
      preserveUnavailableSelectedLabels: true,
      i18n: this.i18n,
      onConfirm: async (selected, favorites) => {
        const next = new Set(selected);
        labelsNow().forEach((label) => {
          if (!next.has(label)) exclude(label);
        });
        selected.forEach(include);
        this.labelOptions.favoriteLabels = favorites;
        await this.labelOptions.onFavoriteLabelsChange(favorites);
        refresh();
      }
    }).open());
    refresh();
    const actions = this.contentEl.createDiv({ cls: "taskmate-modal-actions" });
    const cancel = actions.createEl("button", { text: t("common.cancel") });
    cancel.addEventListener("click", () => this.close());
    const apply = actions.createEl("button", { text: t("bulk.apply", { count: this.tasks.length }), cls: "mod-cta" });
    apply.addEventListener("click", async () => {
      apply.disabled = true;
      try {
        await this.onApply(this.changes);
        this.close();
      } finally {
        apply.disabled = false;
      }
    });
    this.keyboardScroller = new MobileKeyboardScroller(fields, this.modalEl, this.availableRegion, this.baselineAvailableHeight);
    this.keyboardScroller.connect();
  }
  onClose() {
    this.keyboardScroller?.disconnect();
    this.keyboardScroller = null;
    this.contentEl.empty();
  }
};

// src/task-list/bulk-task-actions.ts
function buildBulkTaskPatch(task, changes) {
  const labels = task.labels.filter((label) => !changes.removeLabels.includes(label)).concat(changes.addLabels.filter((label) => !task.labels.includes(label))).slice(0, 500);
  const patch = { labels };
  if ("date" in changes) patch.date = changes.date;
  if ("projectId" in changes) patch.projectId = changes.projectId;
  if ("priority" in changes) patch.priority = changes.priority;
  return patch;
}
function failedBulkTasks(tasks, results) {
  return tasks.filter((_, index2) => results[index2]?.status === "rejected");
}

// src/task-list/filter-modal.ts
var import_obsidian6 = require("obsidian");
var TaskFilterModal = class extends import_obsidian6.Modal {
  constructor(app, filters, incompleteTaskLabels, allTaskLabels, recentLabels, favoriteLabels, i18n, onFavoritesChange, onApply) {
    super(app);
    this.incompleteTaskLabels = incompleteTaskLabels;
    this.allTaskLabels = allTaskLabels;
    this.recentLabels = recentLabels;
    this.favoriteLabels = favoriteLabels;
    this.i18n = i18n;
    this.onFavoritesChange = onFavoritesChange;
    this.onApply = onApply;
    this.draft = { ...filters, priorities: [...filters.priorities], labels: [...filters.labels] };
    this.setTitle(i18n.t("filter.title"));
  }
  draft;
  onOpen() {
    const { t } = this.i18n;
    const priority = new import_obsidian6.Setting(this.contentEl).setName(t("filter.priority"));
    [1, 2, 3].forEach((value) => priority.addButton((button2) => {
      const refresh = () => {
        const selected = this.draft.priorities.includes(value);
        button2.buttonEl.toggleClass("is-active", selected);
        button2.buttonEl.toggleClass("mod-cta", selected);
      };
      button2.setButtonText(`P${value}`).setTooltip(t("filter.priorityValue", { priority: value })).onClick(() => {
        this.draft.priorities = this.draft.priorities.includes(value) ? this.draft.priorities.filter((item) => item !== value) : [...this.draft.priorities, value];
        refresh();
      });
      refresh();
    }));
    const labels = new import_obsidian6.Setting(this.contentEl).setName(t("filter.labels")).setDesc(t("filter.labelsDescription"));
    const chooseLabels = labels.controlEl.createEl("button", { cls: "taskmate-label-picker-open" });
    const renderLabelChoice = () => {
      chooseLabels.textContent = this.draft.labels.length > 0 ? t("filter.selectedLabelCount", { count: this.draft.labels.length }) : t("filter.chooseLabels");
    };
    chooseLabels.addEventListener("click", () => {
      new LabelPickerModal(this.app, {
        selectedLabels: this.draft.labels,
        allLabels: this.draft.includeCompleted ? this.allTaskLabels : this.incompleteTaskLabels,
        recentLabels: this.recentLabels,
        favoriteLabels: this.favoriteLabels,
        i18n: this.i18n,
        onConfirm: async (selected, favorites) => {
          this.draft.labels = selected;
          renderLabelChoice();
          this.favoriteLabels = favorites;
          await this.onFavoritesChange(favorites);
        }
      }).open();
    });
    renderLabelChoice();
    new import_obsidian6.Setting(this.contentEl).setName(t("filter.completion")).addToggle((toggle) => toggle.setValue(this.draft.includeCompleted).onChange((value) => {
      this.draft.includeCompleted = value;
    })).setDesc(t("filter.includeCompleted"));
    const actions = this.contentEl.createDiv({ cls: "taskmate-modal-actions" });
    const clear = actions.createEl("button", { text: t("filter.clearAll") });
    clear.addEventListener("click", () => {
      this.onApply({ priorities: [], labels: [], search: "", includeCompleted: false });
      this.close();
    });
    const apply = actions.createEl("button", { text: t("filter.apply"), cls: "mod-cta" });
    apply.addEventListener("click", () => {
      this.onApply(this.draft);
      this.close();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/projects/project-modal.ts
var import_obsidian7 = require("obsidian");
var ProjectModal = class extends import_obsidian7.Modal {
  constructor(app, i18n, onSave) {
    super(app);
    this.i18n = i18n;
    this.onSave = onSave;
    this.setTitle(i18n.t("projectModal.addTitle"));
  }
  name = "";
  onOpen() {
    const { t } = this.i18n;
    new import_obsidian7.Setting(this.contentEl).setName(t("projectModal.name")).addText((text) => {
      text.setPlaceholder(t("projectModal.namePlaceholder")).onChange((value) => {
        this.name = value;
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });
    const actions = this.contentEl.createDiv({ cls: "taskmate-modal-actions" });
    actions.createEl("button", { text: t("common.cancel") }).addEventListener("click", () => this.close());
    const save2 = actions.createEl("button", { text: t("common.add"), cls: "mod-cta" });
    save2.addEventListener("click", async () => {
      if (!this.name.trim()) return;
      save2.disabled = true;
      try {
        await this.onSave(this.name.trim());
        this.close();
      } finally {
        save2.disabled = false;
      }
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/task-editor/task-conflict-modal.ts
var import_obsidian8 = require("obsidian");
var FIELD_LABEL_KEYS = {
  title: "taskModal.title",
  date: "taskModal.date",
  priority: "taskModal.priority",
  labels: "taskModal.labels",
  projectId: "taskModal.project",
  steps: "taskModal.steps",
  notes: "taskModal.notes",
  sourceNote: "conflict.sourceNote"
};
var TaskConflictModal = class extends import_obsidian8.Modal {
  constructor(app, conflict, projects, i18n, onResolve) {
    super(app);
    this.conflict = conflict;
    this.projects = projects;
    this.i18n = i18n;
    this.onResolve = onResolve;
    for (const item of conflict.comparison.conflicts) this.choices[item.field] = "current";
    this.setTitle(i18n.t("conflict.title"));
  }
  choices = {};
  onOpen() {
    const { t } = this.i18n;
    this.modalEl.addClass("taskmate-conflict-modal");
    this.contentEl.createEl("p", { text: t("conflict.description"), cls: "taskmate-conflict-description" });
    const list = this.contentEl.createDiv({ cls: "taskmate-conflict-list" });
    this.conflict.comparison.conflicts.forEach((conflict, index2) => {
      const section = list.createEl("fieldset", { cls: "taskmate-conflict-field" });
      section.createEl("legend", { text: t(FIELD_LABEL_KEYS[conflict.field]) });
      const radioName = `taskmate-conflict-${Date.now()}-${index2}`;
      this.renderChoice(
        section,
        radioName,
        conflict.field,
        "current",
        t("conflict.currentValue"),
        this.formatValue(conflict.field, conflict.currentValue),
        true
      );
      this.renderChoice(
        section,
        radioName,
        conflict.field,
        "draft",
        t("conflict.draftValue"),
        this.formatValue(conflict.field, conflict.draftValue),
        false
      );
    });
    const actions = this.contentEl.createDiv({ cls: "taskmate-modal-actions taskmate-conflict-actions" });
    const cancel = actions.createEl("button", { text: t("common.cancel") });
    cancel.addEventListener("click", () => this.close());
    const save2 = actions.createEl("button", { text: t("conflict.saveResolved"), cls: "mod-cta" });
    save2.addEventListener("click", async () => {
      save2.disabled = true;
      try {
        if (await this.onResolve({ ...this.choices })) this.close();
      } finally {
        save2.disabled = false;
      }
    });
  }
  onClose() {
    this.contentEl.empty();
  }
  renderChoice(container, radioName, field, choice, heading, value, checked) {
    const label = container.createEl("label", { cls: "taskmate-conflict-choice" });
    const radio = label.createEl("input", { type: "radio", attr: { name: radioName, value: choice } });
    radio.checked = checked;
    radio.addEventListener("change", () => {
      if (radio.checked) this.choices[field] = choice;
    });
    const text = label.createDiv();
    text.createDiv({ text: heading, cls: "taskmate-conflict-choice-heading" });
    text.createDiv({ text: value, cls: "taskmate-conflict-choice-value" });
  }
  formatValue(field, value) {
    if (field === "projectId" && typeof value === "string") {
      return this.projects.find((project) => project.id === value)?.name ?? value;
    }
    if (field === "priority" && typeof value === "number") {
      return this.i18n.t("filter.priorityValue", { priority: value });
    }
    if (field === "steps" && Array.isArray(value)) {
      return value.length > 0 ? value.map((step) => {
        const item = step;
        return `${item.completed ? "[x]" : "[ ]"} ${item.text ?? ""}${item.date ? ` (${item.date})` : ""}`;
      }).join("\n") : this.i18n.t("conflict.none");
    }
    if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : this.i18n.t("conflict.none");
    if (value === null || value === void 0 || value === "") return this.i18n.t("conflict.none");
    return String(value);
  }
};

// src/labels/label-manager-modal.ts
var import_obsidian9 = require("obsidian");

// src/labels/label-management.ts
function buildManagedLabels(tasks, recentLabels, favoriteLabels) {
  const counts = /* @__PURE__ */ new Map();
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
function normalizeManagedLabel(value) {
  const labels = normalizeLabels(value.split(","));
  return labels.length === 1 ? labels[0] : null;
}
function renameLabelValues(labels, from, to) {
  return normalizeLabels([...labels].map((label) => label === from ? to : label));
}
function removeLabelValue(labels, label) {
  return normalizeLabels(labels).filter((item) => item !== label);
}

// src/labels/label-manager-modal.ts
var LabelManagerModal = class extends import_obsidian9.Modal {
  constructor(app, options) {
    super(app);
    this.options = options;
    this.setTitle(options.i18n.t("labelManager.title"));
  }
  query = "";
  editingLabel = null;
  resultsEl = null;
  onOpen() {
    const { t } = this.options.i18n;
    this.modalEl.addClass("taskmate-label-manager-modal");
    const search = this.contentEl.createEl("input", {
      type: "text",
      cls: "taskmate-label-manager-search",
      attr: { placeholder: t("labelManager.search"), "aria-label": t("labelManager.search") }
    });
    search.addEventListener("input", () => {
      this.query = search.value;
      this.editingLabel = null;
      this.renderResults();
    });
    this.resultsEl = this.contentEl.createDiv({ cls: "taskmate-label-manager-results" });
    this.renderResults();
  }
  onClose() {
    this.contentEl.empty();
  }
  renderResults() {
    if (!this.resultsEl) return;
    const { t, locale } = this.options.i18n;
    const needle = this.query.trim().toLocaleLowerCase(locale);
    const labels = this.options.labels.filter((item) => item.label.toLocaleLowerCase(locale).includes(needle)).sort((left, right) => compareDisplayText(left.label, right.label, locale));
    this.resultsEl.empty();
    if (labels.length === 0) {
      this.resultsEl.createDiv({ text: t("labelManager.empty"), cls: "taskmate-empty-compact" });
      return;
    }
    for (const item of labels) this.renderRow(item);
  }
  renderRow(item) {
    if (!this.resultsEl) return;
    const { t } = this.options.i18n;
    const row = this.resultsEl.createDiv({ cls: "taskmate-label-manager-row" });
    if (this.editingLabel === item.label) {
      const editor = row.createDiv({ cls: "taskmate-label-manager-editor" });
      editor.createDiv({
        text: item.storedOnly ? t("labelManager.renameStoredOnly", { label: item.label }) : item.taskCount === 1 ? t("labelManager.renameUsedOne", { label: item.label, count: item.taskCount }) : t("labelManager.renameUsed", { label: item.label, count: item.taskCount }),
        cls: "taskmate-label-manager-impact"
      });
      const input = editor.createEl("input", { type: "text", value: item.label });
      const actions = editor.createDiv({ cls: "taskmate-label-manager-editor-actions" });
      const cancel = actions.createEl("button", { text: t("common.cancel") });
      const confirm = actions.createEl("button", { text: t("labelManager.confirmRename"), cls: "mod-cta" });
      const refreshValidity = () => {
        const normalized = normalizeManagedLabel(input.value);
        confirm.disabled = normalized === null || normalized === item.label;
      };
      input.addEventListener("input", refreshValidity);
      cancel.addEventListener("click", () => {
        this.editingLabel = null;
        this.renderResults();
      });
      confirm.addEventListener("click", async () => {
        const normalized = normalizeManagedLabel(input.value);
        if (!normalized || normalized === item.label) return;
        confirm.disabled = true;
        try {
          await this.options.onRename(item.label, normalized);
          this.close();
        } finally {
          confirm.disabled = false;
        }
      });
      refreshValidity();
      window.setTimeout(() => input.focus(), 0);
      return;
    }
    const summary = row.createDiv({ cls: "taskmate-label-manager-summary" });
    summary.createSpan({ text: item.label, cls: "taskmate-label-manager-name" });
    summary.createSpan({
      text: item.storedOnly ? t("labelManager.storedOnly") : item.taskCount === 1 ? t("labelManager.taskCountOne", { count: item.taskCount }) : t("labelManager.taskCount", { count: item.taskCount }),
      cls: "taskmate-label-manager-count"
    });
    const rename = row.createEl("button", { attr: { "aria-label": t("labelManager.renameAriaLabel", { label: item.label }) } });
    (0, import_obsidian9.setIcon)(rename, "pencil");
    rename.addEventListener("click", () => {
      this.editingLabel = item.label;
      this.renderResults();
    });
    const remove = row.createEl("button", {
      cls: "taskmate-label-manager-delete",
      attr: { "aria-label": t("labelManager.deleteAriaLabel", { label: item.label }) }
    });
    (0, import_obsidian9.setIcon)(remove, "trash-2");
    remove.addEventListener("click", async () => {
      const message = item.storedOnly ? t("labelManager.deleteStoredOnlyConfirm", { label: item.label }) : item.taskCount === 1 ? t("labelManager.deleteConfirmOne", { label: item.label, count: item.taskCount }) : t("labelManager.deleteConfirm", { label: item.label, count: item.taskCount });
      if (!window.confirm(message)) return;
      remove.disabled = true;
      try {
        await this.options.onDelete(item.label);
        this.close();
      } finally {
        remove.disabled = false;
      }
    });
  }
};

// src/task-list/task-list-model.ts
function toRow(task, projectNames) {
  return {
    id: task.id,
    title: task.title,
    completed: task.completed,
    date: task.date,
    priority: task.priority,
    projectName: task.projectId ? projectNames.get(task.projectId) ?? null : null,
    labels: [...task.labels],
    selected: false
  };
}
function buildTaskListModel(input) {
  const projectNames = new Map(input.projects.map((project) => [project.id, project.name]));
  const selectionMode = input.selectionMode ?? false;
  const selectedIds = input.selectedIds ?? /* @__PURE__ */ new Set();
  const toSortedRows = (tasks) => sortTasks(tasks, input.sortMode, input.sortDirection).map((task) => ({ ...toRow(task, projectNames), selected: selectedIds.has(task.id) }));
  if (input.grouping === "flat") {
    return {
      grouping: "flat",
      sections: [{ id: "default", rows: toSortedRows(input.tasks) }],
      reorderEnabled: !selectionMode && input.allowReorder && input.sortMode === "manual",
      selectionMode
    };
  }
  const groups = groupScheduledTasks(input.tasks, input.today, true);
  const sections = ["overdue", "today", "later"].map((id) => ({ id, rows: toSortedRows(groups[id]) })).filter((section) => section.rows.length > 0);
  return {
    grouping: "scheduled",
    sections,
    reorderEnabled: !selectionMode && input.allowReorder && input.sortMode === "manual",
    selectionMode
  };
}

// node_modules/sortablejs/modular/sortable.esm.js
function _defineProperty(e, r, t) {
  return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
    value: t,
    enumerable: true,
    configurable: true,
    writable: true
  }) : e[r] = t, e;
}
function _extends() {
  return _extends = Object.assign ? Object.assign.bind() : function(n) {
    for (var e = 1; e < arguments.length; e++) {
      var t = arguments[e];
      for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
    }
    return n;
  }, _extends.apply(null, arguments);
}
function ownKeys(e, r) {
  var t = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var o = Object.getOwnPropertySymbols(e);
    r && (o = o.filter(function(r2) {
      return Object.getOwnPropertyDescriptor(e, r2).enumerable;
    })), t.push.apply(t, o);
  }
  return t;
}
function _objectSpread2(e) {
  for (var r = 1; r < arguments.length; r++) {
    var t = null != arguments[r] ? arguments[r] : {};
    r % 2 ? ownKeys(Object(t), true).forEach(function(r2) {
      _defineProperty(e, r2, t[r2]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function(r2) {
      Object.defineProperty(e, r2, Object.getOwnPropertyDescriptor(t, r2));
    });
  }
  return e;
}
function _objectWithoutProperties(e, t) {
  if (null == e) return {};
  var o, r, i = _objectWithoutPropertiesLoose(e, t);
  if (Object.getOwnPropertySymbols) {
    var n = Object.getOwnPropertySymbols(e);
    for (r = 0; r < n.length; r++) o = n[r], -1 === t.indexOf(o) && {}.propertyIsEnumerable.call(e, o) && (i[o] = e[o]);
  }
  return i;
}
function _objectWithoutPropertiesLoose(r, e) {
  if (null == r) return {};
  var t = {};
  for (var n in r) if ({}.hasOwnProperty.call(r, n)) {
    if (-1 !== e.indexOf(n)) continue;
    t[n] = r[n];
  }
  return t;
}
function _toPrimitive(t, r) {
  if ("object" != typeof t || !t) return t;
  var e = t[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t, r || "default");
    if ("object" != typeof i) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t);
}
function _toPropertyKey(t) {
  var i = _toPrimitive(t, "string");
  return "symbol" == typeof i ? i : i + "";
}
function _typeof(o) {
  "@babel/helpers - typeof";
  return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o2) {
    return typeof o2;
  } : function(o2) {
    return o2 && "function" == typeof Symbol && o2.constructor === Symbol && o2 !== Symbol.prototype ? "symbol" : typeof o2;
  }, _typeof(o);
}
var version = "1.15.7";
function userAgent(pattern) {
  if (typeof window !== "undefined" && window.navigator) {
    return !!/* @__PURE__ */ navigator.userAgent.match(pattern);
  }
}
var IE11OrLess = userAgent(/(?:Trident.*rv[ :]?11\.|msie|iemobile|Windows Phone)/i);
var Edge = userAgent(/Edge/i);
var FireFox = userAgent(/firefox/i);
var Safari = userAgent(/safari/i) && !userAgent(/chrome/i) && !userAgent(/android/i);
var IOS = userAgent(/iP(ad|od|hone)/i);
var ChromeForAndroid = userAgent(/chrome/i) && userAgent(/android/i);
var captureMode = {
  capture: false,
  passive: false
};
function on(el, event, fn) {
  el.addEventListener(event, fn, !IE11OrLess && captureMode);
}
function off(el, event, fn) {
  el.removeEventListener(event, fn, !IE11OrLess && captureMode);
}
function matches(el, selector) {
  if (!selector) return;
  selector[0] === ">" && (selector = selector.substring(1));
  if (el) {
    try {
      if (el.matches) {
        return el.matches(selector);
      } else if (el.msMatchesSelector) {
        return el.msMatchesSelector(selector);
      } else if (el.webkitMatchesSelector) {
        return el.webkitMatchesSelector(selector);
      }
    } catch (_) {
      return false;
    }
  }
  return false;
}
function getParentOrHost(el) {
  return el.host && el !== document && el.host.nodeType && el.host !== el ? el.host : el.parentNode;
}
function closest(el, selector, ctx, includeCTX) {
  if (el) {
    ctx = ctx || document;
    do {
      if (selector != null && (selector[0] === ">" ? el.parentNode === ctx && matches(el, selector) : matches(el, selector)) || includeCTX && el === ctx) {
        return el;
      }
      if (el === ctx) break;
    } while (el = getParentOrHost(el));
  }
  return null;
}
var R_SPACE = /\s+/g;
function toggleClass(el, name, state) {
  if (el && name) {
    if (el.classList) {
      el.classList[state ? "add" : "remove"](name);
    } else {
      var className = (" " + el.className + " ").replace(R_SPACE, " ").replace(" " + name + " ", " ");
      el.className = (className + (state ? " " + name : "")).replace(R_SPACE, " ");
    }
  }
}
function css(el, prop, val) {
  var style = el && el.style;
  if (style) {
    if (val === void 0) {
      if (document.defaultView && document.defaultView.getComputedStyle) {
        val = document.defaultView.getComputedStyle(el, "");
      } else if (el.currentStyle) {
        val = el.currentStyle;
      }
      return prop === void 0 ? val : val[prop];
    } else {
      if (!(prop in style) && prop.indexOf("webkit") === -1) {
        prop = "-webkit-" + prop;
      }
      style[prop] = val + (typeof val === "string" ? "" : "px");
    }
  }
}
function matrix(el, selfOnly) {
  var appliedTransforms = "";
  if (typeof el === "string") {
    appliedTransforms = el;
  } else {
    do {
      var transform = css(el, "transform");
      if (transform && transform !== "none") {
        appliedTransforms = transform + " " + appliedTransforms;
      }
    } while (!selfOnly && (el = el.parentNode));
  }
  var matrixFn = window.DOMMatrix || window.WebKitCSSMatrix || window.CSSMatrix || window.MSCSSMatrix;
  return matrixFn && new matrixFn(appliedTransforms);
}
function find(ctx, tagName, iterator) {
  if (ctx) {
    var list = ctx.getElementsByTagName(tagName), i = 0, n = list.length;
    if (iterator) {
      for (; i < n; i++) {
        iterator(list[i], i);
      }
    }
    return list;
  }
  return [];
}
function getWindowScrollingElement() {
  var scrollingElement = document.scrollingElement;
  if (scrollingElement) {
    return scrollingElement;
  } else {
    return document.documentElement;
  }
}
function getRect(el, relativeToContainingBlock, relativeToNonStaticParent, undoScale, container) {
  if (!el.getBoundingClientRect && el !== window) return;
  var elRect, top, left, bottom, right, height, width;
  if (el !== window && el.parentNode && el !== getWindowScrollingElement()) {
    elRect = el.getBoundingClientRect();
    top = elRect.top;
    left = elRect.left;
    bottom = elRect.bottom;
    right = elRect.right;
    height = elRect.height;
    width = elRect.width;
  } else {
    top = 0;
    left = 0;
    bottom = window.innerHeight;
    right = window.innerWidth;
    height = window.innerHeight;
    width = window.innerWidth;
  }
  if ((relativeToContainingBlock || relativeToNonStaticParent) && el !== window) {
    container = container || el.parentNode;
    if (!IE11OrLess) {
      do {
        if (container && container.getBoundingClientRect && (css(container, "transform") !== "none" || relativeToNonStaticParent && css(container, "position") !== "static")) {
          var containerRect = container.getBoundingClientRect();
          top -= containerRect.top + parseInt(css(container, "border-top-width"));
          left -= containerRect.left + parseInt(css(container, "border-left-width"));
          bottom = top + elRect.height;
          right = left + elRect.width;
          break;
        }
      } while (container = container.parentNode);
    }
  }
  if (undoScale && el !== window) {
    var elMatrix = matrix(container || el), scaleX = elMatrix && elMatrix.a, scaleY = elMatrix && elMatrix.d;
    if (elMatrix) {
      top /= scaleY;
      left /= scaleX;
      width /= scaleX;
      height /= scaleY;
      bottom = top + height;
      right = left + width;
    }
  }
  return {
    top,
    left,
    bottom,
    right,
    width,
    height
  };
}
function isScrolledPast(el, elSide, parentSide) {
  var parent = getParentAutoScrollElement(el, true), elSideVal = getRect(el)[elSide];
  while (parent) {
    var parentSideVal = getRect(parent)[parentSide], visible = void 0;
    if (parentSide === "top" || parentSide === "left") {
      visible = elSideVal >= parentSideVal;
    } else {
      visible = elSideVal <= parentSideVal;
    }
    if (!visible) return parent;
    if (parent === getWindowScrollingElement()) break;
    parent = getParentAutoScrollElement(parent, false);
  }
  return false;
}
function getChild(el, childNum, options, includeDragEl) {
  var currentChild = 0, i = 0, children = el.children;
  while (i < children.length) {
    if (children[i].style.display !== "none" && children[i] !== Sortable.ghost && (includeDragEl || children[i] !== Sortable.dragged) && closest(children[i], options.draggable, el, false)) {
      if (currentChild === childNum) {
        return children[i];
      }
      currentChild++;
    }
    i++;
  }
  return null;
}
function lastChild(el, selector) {
  var last = el.lastElementChild;
  while (last && (last === Sortable.ghost || css(last, "display") === "none" || selector && !matches(last, selector))) {
    last = last.previousElementSibling;
  }
  return last || null;
}
function index(el, selector) {
  var index2 = 0;
  if (!el || !el.parentNode) {
    return -1;
  }
  while (el = el.previousElementSibling) {
    if (el.nodeName.toUpperCase() !== "TEMPLATE" && el !== Sortable.clone && (!selector || matches(el, selector))) {
      index2++;
    }
  }
  return index2;
}
function getRelativeScrollOffset(el) {
  var offsetLeft = 0, offsetTop = 0, winScroller = getWindowScrollingElement();
  if (el) {
    do {
      var elMatrix = matrix(el), scaleX = elMatrix.a, scaleY = elMatrix.d;
      offsetLeft += el.scrollLeft * scaleX;
      offsetTop += el.scrollTop * scaleY;
    } while (el !== winScroller && (el = el.parentNode));
  }
  return [offsetLeft, offsetTop];
}
function indexOfObject(arr, obj) {
  for (var i in arr) {
    if (!arr.hasOwnProperty(i)) continue;
    for (var key in obj) {
      if (obj.hasOwnProperty(key) && obj[key] === arr[i][key]) return Number(i);
    }
  }
  return -1;
}
function getParentAutoScrollElement(el, includeSelf) {
  if (!el || !el.getBoundingClientRect) return getWindowScrollingElement();
  var elem = el;
  var gotSelf = false;
  do {
    if (elem.clientWidth < elem.scrollWidth || elem.clientHeight < elem.scrollHeight) {
      var elemCSS = css(elem);
      if (elem.clientWidth < elem.scrollWidth && (elemCSS.overflowX == "auto" || elemCSS.overflowX == "scroll") || elem.clientHeight < elem.scrollHeight && (elemCSS.overflowY == "auto" || elemCSS.overflowY == "scroll")) {
        if (!elem.getBoundingClientRect || elem === document.body) return getWindowScrollingElement();
        if (gotSelf || includeSelf) return elem;
        gotSelf = true;
      }
    }
  } while (elem = elem.parentNode);
  return getWindowScrollingElement();
}
function extend(dst, src) {
  if (dst && src) {
    for (var key in src) {
      if (src.hasOwnProperty(key)) {
        dst[key] = src[key];
      }
    }
  }
  return dst;
}
function isRectEqual(rect1, rect2) {
  return Math.round(rect1.top) === Math.round(rect2.top) && Math.round(rect1.left) === Math.round(rect2.left) && Math.round(rect1.height) === Math.round(rect2.height) && Math.round(rect1.width) === Math.round(rect2.width);
}
var _throttleTimeout;
function throttle(callback, ms) {
  return function() {
    if (!_throttleTimeout) {
      var args = arguments, _this = this;
      if (args.length === 1) {
        callback.call(_this, args[0]);
      } else {
        callback.apply(_this, args);
      }
      _throttleTimeout = setTimeout(function() {
        _throttleTimeout = void 0;
      }, ms);
    }
  };
}
function cancelThrottle() {
  clearTimeout(_throttleTimeout);
  _throttleTimeout = void 0;
}
function scrollBy(el, x, y) {
  el.scrollLeft += x;
  el.scrollTop += y;
}
function clone(el) {
  var Polymer = window.Polymer;
  var $ = window.jQuery || window.Zepto;
  if (Polymer && Polymer.dom) {
    return Polymer.dom(el).cloneNode(true);
  } else if ($) {
    return $(el).clone(true)[0];
  } else {
    return el.cloneNode(true);
  }
}
function getChildContainingRectFromElement(container, options, ghostEl2) {
  var rect = {};
  Array.from(container.children).forEach(function(child) {
    var _rect$left, _rect$top, _rect$right, _rect$bottom;
    if (!closest(child, options.draggable, container, false) || child.animated || child === ghostEl2) return;
    var childRect = getRect(child);
    rect.left = Math.min((_rect$left = rect.left) !== null && _rect$left !== void 0 ? _rect$left : Infinity, childRect.left);
    rect.top = Math.min((_rect$top = rect.top) !== null && _rect$top !== void 0 ? _rect$top : Infinity, childRect.top);
    rect.right = Math.max((_rect$right = rect.right) !== null && _rect$right !== void 0 ? _rect$right : -Infinity, childRect.right);
    rect.bottom = Math.max((_rect$bottom = rect.bottom) !== null && _rect$bottom !== void 0 ? _rect$bottom : -Infinity, childRect.bottom);
  });
  rect.width = rect.right - rect.left;
  rect.height = rect.bottom - rect.top;
  rect.x = rect.left;
  rect.y = rect.top;
  return rect;
}
var expando = "Sortable" + (/* @__PURE__ */ new Date()).getTime();
function AnimationStateManager() {
  var animationStates = [], animationCallbackId;
  return {
    captureAnimationState: function captureAnimationState() {
      animationStates = [];
      if (!this.options.animation) return;
      var children = [].slice.call(this.el.children);
      children.forEach(function(child) {
        if (css(child, "display") === "none" || child === Sortable.ghost) return;
        animationStates.push({
          target: child,
          rect: getRect(child)
        });
        var fromRect = _objectSpread2({}, animationStates[animationStates.length - 1].rect);
        if (child.thisAnimationDuration) {
          var childMatrix = matrix(child, true);
          if (childMatrix) {
            fromRect.top -= childMatrix.f;
            fromRect.left -= childMatrix.e;
          }
        }
        child.fromRect = fromRect;
      });
    },
    addAnimationState: function addAnimationState(state) {
      animationStates.push(state);
    },
    removeAnimationState: function removeAnimationState(target) {
      animationStates.splice(indexOfObject(animationStates, {
        target
      }), 1);
    },
    animateAll: function animateAll(callback) {
      var _this = this;
      if (!this.options.animation) {
        clearTimeout(animationCallbackId);
        if (typeof callback === "function") callback();
        return;
      }
      var animating = false, animationTime = 0;
      animationStates.forEach(function(state) {
        var time = 0, target = state.target, fromRect = target.fromRect, toRect = getRect(target), prevFromRect = target.prevFromRect, prevToRect = target.prevToRect, animatingRect = state.rect, targetMatrix = matrix(target, true);
        if (targetMatrix) {
          toRect.top -= targetMatrix.f;
          toRect.left -= targetMatrix.e;
        }
        target.toRect = toRect;
        if (target.thisAnimationDuration) {
          if (isRectEqual(prevFromRect, toRect) && !isRectEqual(fromRect, toRect) && // Make sure animatingRect is on line between toRect & fromRect
          (animatingRect.top - toRect.top) / (animatingRect.left - toRect.left) === (fromRect.top - toRect.top) / (fromRect.left - toRect.left)) {
            time = calculateRealTime(animatingRect, prevFromRect, prevToRect, _this.options);
          }
        }
        if (!isRectEqual(toRect, fromRect)) {
          target.prevFromRect = fromRect;
          target.prevToRect = toRect;
          if (!time) {
            time = _this.options.animation;
          }
          _this.animate(target, animatingRect, toRect, time);
        }
        if (time) {
          animating = true;
          animationTime = Math.max(animationTime, time);
          clearTimeout(target.animationResetTimer);
          target.animationResetTimer = setTimeout(function() {
            target.animationTime = 0;
            target.prevFromRect = null;
            target.fromRect = null;
            target.prevToRect = null;
            target.thisAnimationDuration = null;
          }, time);
          target.thisAnimationDuration = time;
        }
      });
      clearTimeout(animationCallbackId);
      if (!animating) {
        if (typeof callback === "function") callback();
      } else {
        animationCallbackId = setTimeout(function() {
          if (typeof callback === "function") callback();
        }, animationTime);
      }
      animationStates = [];
    },
    animate: function animate(target, currentRect, toRect, duration) {
      if (duration) {
        css(target, "transition", "");
        css(target, "transform", "");
        var elMatrix = matrix(this.el), scaleX = elMatrix && elMatrix.a, scaleY = elMatrix && elMatrix.d, translateX = (currentRect.left - toRect.left) / (scaleX || 1), translateY = (currentRect.top - toRect.top) / (scaleY || 1);
        target.animatingX = !!translateX;
        target.animatingY = !!translateY;
        css(target, "transform", "translate3d(" + translateX + "px," + translateY + "px,0)");
        this.forRepaintDummy = repaint(target);
        css(target, "transition", "transform " + duration + "ms" + (this.options.easing ? " " + this.options.easing : ""));
        css(target, "transform", "translate3d(0,0,0)");
        typeof target.animated === "number" && clearTimeout(target.animated);
        target.animated = setTimeout(function() {
          css(target, "transition", "");
          css(target, "transform", "");
          target.animated = false;
          target.animatingX = false;
          target.animatingY = false;
        }, duration);
      }
    }
  };
}
function repaint(target) {
  return target.offsetWidth;
}
function calculateRealTime(animatingRect, fromRect, toRect, options) {
  return Math.sqrt(Math.pow(fromRect.top - animatingRect.top, 2) + Math.pow(fromRect.left - animatingRect.left, 2)) / Math.sqrt(Math.pow(fromRect.top - toRect.top, 2) + Math.pow(fromRect.left - toRect.left, 2)) * options.animation;
}
var plugins = [];
var defaults = {
  initializeByDefault: true
};
var PluginManager = {
  mount: function mount(plugin) {
    for (var option2 in defaults) {
      if (defaults.hasOwnProperty(option2) && !(option2 in plugin)) {
        plugin[option2] = defaults[option2];
      }
    }
    plugins.forEach(function(p) {
      if (p.pluginName === plugin.pluginName) {
        throw "Sortable: Cannot mount plugin ".concat(plugin.pluginName, " more than once");
      }
    });
    plugins.push(plugin);
  },
  pluginEvent: function pluginEvent(eventName, sortable, evt) {
    var _this = this;
    this.eventCanceled = false;
    evt.cancel = function() {
      _this.eventCanceled = true;
    };
    var eventNameGlobal = eventName + "Global";
    plugins.forEach(function(plugin) {
      if (!sortable[plugin.pluginName]) return;
      if (sortable[plugin.pluginName][eventNameGlobal]) {
        sortable[plugin.pluginName][eventNameGlobal](_objectSpread2({
          sortable
        }, evt));
      }
      if (sortable.options[plugin.pluginName] && sortable[plugin.pluginName][eventName]) {
        sortable[plugin.pluginName][eventName](_objectSpread2({
          sortable
        }, evt));
      }
    });
  },
  initializePlugins: function initializePlugins(sortable, el, defaults2, options) {
    plugins.forEach(function(plugin) {
      var pluginName = plugin.pluginName;
      if (!sortable.options[pluginName] && !plugin.initializeByDefault) return;
      var initialized = new plugin(sortable, el, sortable.options);
      initialized.sortable = sortable;
      initialized.options = sortable.options;
      sortable[pluginName] = initialized;
      _extends(defaults2, initialized.defaults);
    });
    for (var option2 in sortable.options) {
      if (!sortable.options.hasOwnProperty(option2)) continue;
      var modified = this.modifyOption(sortable, option2, sortable.options[option2]);
      if (typeof modified !== "undefined") {
        sortable.options[option2] = modified;
      }
    }
  },
  getEventProperties: function getEventProperties(name, sortable) {
    var eventProperties = {};
    plugins.forEach(function(plugin) {
      if (typeof plugin.eventProperties !== "function") return;
      _extends(eventProperties, plugin.eventProperties.call(sortable[plugin.pluginName], name));
    });
    return eventProperties;
  },
  modifyOption: function modifyOption(sortable, name, value) {
    var modifiedValue;
    plugins.forEach(function(plugin) {
      if (!sortable[plugin.pluginName]) return;
      if (plugin.optionListeners && typeof plugin.optionListeners[name] === "function") {
        modifiedValue = plugin.optionListeners[name].call(sortable[plugin.pluginName], value);
      }
    });
    return modifiedValue;
  }
};
function dispatchEvent(_ref) {
  var sortable = _ref.sortable, rootEl2 = _ref.rootEl, name = _ref.name, targetEl = _ref.targetEl, cloneEl2 = _ref.cloneEl, toEl = _ref.toEl, fromEl = _ref.fromEl, oldIndex2 = _ref.oldIndex, newIndex2 = _ref.newIndex, oldDraggableIndex2 = _ref.oldDraggableIndex, newDraggableIndex2 = _ref.newDraggableIndex, originalEvent = _ref.originalEvent, putSortable2 = _ref.putSortable, extraEventProperties = _ref.extraEventProperties;
  sortable = sortable || rootEl2 && rootEl2[expando];
  if (!sortable) return;
  var evt, options = sortable.options, onName = "on" + name.charAt(0).toUpperCase() + name.substr(1);
  if (window.CustomEvent && !IE11OrLess && !Edge) {
    evt = new CustomEvent(name, {
      bubbles: true,
      cancelable: true
    });
  } else {
    evt = document.createEvent("Event");
    evt.initEvent(name, true, true);
  }
  evt.to = toEl || rootEl2;
  evt.from = fromEl || rootEl2;
  evt.item = targetEl || rootEl2;
  evt.clone = cloneEl2;
  evt.oldIndex = oldIndex2;
  evt.newIndex = newIndex2;
  evt.oldDraggableIndex = oldDraggableIndex2;
  evt.newDraggableIndex = newDraggableIndex2;
  evt.originalEvent = originalEvent;
  evt.pullMode = putSortable2 ? putSortable2.lastPutMode : void 0;
  var allEventProperties = _objectSpread2(_objectSpread2({}, extraEventProperties), PluginManager.getEventProperties(name, sortable));
  for (var option2 in allEventProperties) {
    evt[option2] = allEventProperties[option2];
  }
  if (rootEl2) {
    rootEl2.dispatchEvent(evt);
  }
  if (options[onName]) {
    options[onName].call(sortable, evt);
  }
}
var _excluded = ["evt"];
var pluginEvent2 = function pluginEvent3(eventName, sortable) {
  var _ref = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {}, originalEvent = _ref.evt, data = _objectWithoutProperties(_ref, _excluded);
  PluginManager.pluginEvent.bind(Sortable)(eventName, sortable, _objectSpread2({
    dragEl,
    parentEl,
    ghostEl,
    rootEl,
    nextEl,
    lastDownEl,
    cloneEl,
    cloneHidden,
    dragStarted: moved,
    putSortable,
    activeSortable: Sortable.active,
    originalEvent,
    oldIndex,
    oldDraggableIndex,
    newIndex,
    newDraggableIndex,
    hideGhostForTarget: _hideGhostForTarget,
    unhideGhostForTarget: _unhideGhostForTarget,
    cloneNowHidden: function cloneNowHidden() {
      cloneHidden = true;
    },
    cloneNowShown: function cloneNowShown() {
      cloneHidden = false;
    },
    dispatchSortableEvent: function dispatchSortableEvent(name) {
      _dispatchEvent({
        sortable,
        name,
        originalEvent
      });
    }
  }, data));
};
function _dispatchEvent(info) {
  dispatchEvent(_objectSpread2({
    putSortable,
    cloneEl,
    targetEl: dragEl,
    rootEl,
    oldIndex,
    oldDraggableIndex,
    newIndex,
    newDraggableIndex
  }, info));
}
var dragEl;
var parentEl;
var ghostEl;
var rootEl;
var nextEl;
var lastDownEl;
var cloneEl;
var cloneHidden;
var oldIndex;
var newIndex;
var oldDraggableIndex;
var newDraggableIndex;
var activeGroup;
var putSortable;
var awaitingDragStarted = false;
var ignoreNextClick = false;
var sortables = [];
var tapEvt;
var touchEvt;
var lastDx;
var lastDy;
var tapDistanceLeft;
var tapDistanceTop;
var moved;
var lastTarget;
var lastDirection;
var pastFirstInvertThresh = false;
var isCircumstantialInvert = false;
var targetMoveDistance;
var ghostRelativeParent;
var ghostRelativeParentInitialScroll = [];
var _silent = false;
var savedInputChecked = [];
var documentExists = typeof document !== "undefined";
var PositionGhostAbsolutely = IOS;
var CSSFloatProperty = Edge || IE11OrLess ? "cssFloat" : "float";
var supportDraggable = documentExists && !ChromeForAndroid && !IOS && "draggable" in document.createElement("div");
var supportCssPointerEvents = (function() {
  if (!documentExists) return;
  if (IE11OrLess) {
    return false;
  }
  var el = document.createElement("x");
  el.style.cssText = "pointer-events:auto";
  return el.style.pointerEvents === "auto";
})();
var _detectDirection = function _detectDirection2(el, options) {
  var elCSS = css(el), elWidth = parseInt(elCSS.width) - parseInt(elCSS.paddingLeft) - parseInt(elCSS.paddingRight) - parseInt(elCSS.borderLeftWidth) - parseInt(elCSS.borderRightWidth), child1 = getChild(el, 0, options), child2 = getChild(el, 1, options), firstChildCSS = child1 && css(child1), secondChildCSS = child2 && css(child2), firstChildWidth = firstChildCSS && parseInt(firstChildCSS.marginLeft) + parseInt(firstChildCSS.marginRight) + getRect(child1).width, secondChildWidth = secondChildCSS && parseInt(secondChildCSS.marginLeft) + parseInt(secondChildCSS.marginRight) + getRect(child2).width;
  if (elCSS.display === "flex") {
    return elCSS.flexDirection === "column" || elCSS.flexDirection === "column-reverse" ? "vertical" : "horizontal";
  }
  if (elCSS.display === "grid") {
    return elCSS.gridTemplateColumns.split(" ").length <= 1 ? "vertical" : "horizontal";
  }
  if (child1 && firstChildCSS["float"] && firstChildCSS["float"] !== "none") {
    var touchingSideChild2 = firstChildCSS["float"] === "left" ? "left" : "right";
    return child2 && (secondChildCSS.clear === "both" || secondChildCSS.clear === touchingSideChild2) ? "vertical" : "horizontal";
  }
  return child1 && (firstChildCSS.display === "block" || firstChildCSS.display === "flex" || firstChildCSS.display === "table" || firstChildCSS.display === "grid" || firstChildWidth >= elWidth && elCSS[CSSFloatProperty] === "none" || child2 && elCSS[CSSFloatProperty] === "none" && firstChildWidth + secondChildWidth > elWidth) ? "vertical" : "horizontal";
};
var _dragElInRowColumn = function _dragElInRowColumn2(dragRect, targetRect, vertical) {
  var dragElS1Opp = vertical ? dragRect.left : dragRect.top, dragElS2Opp = vertical ? dragRect.right : dragRect.bottom, dragElOppLength = vertical ? dragRect.width : dragRect.height, targetS1Opp = vertical ? targetRect.left : targetRect.top, targetS2Opp = vertical ? targetRect.right : targetRect.bottom, targetOppLength = vertical ? targetRect.width : targetRect.height;
  return dragElS1Opp === targetS1Opp || dragElS2Opp === targetS2Opp || dragElS1Opp + dragElOppLength / 2 === targetS1Opp + targetOppLength / 2;
};
var _detectNearestEmptySortable = function _detectNearestEmptySortable2(x, y) {
  var ret;
  sortables.some(function(sortable) {
    var threshold = sortable[expando].options.emptyInsertThreshold;
    if (!threshold || lastChild(sortable)) return;
    var rect = getRect(sortable), insideHorizontally = x >= rect.left - threshold && x <= rect.right + threshold, insideVertically = y >= rect.top - threshold && y <= rect.bottom + threshold;
    if (insideHorizontally && insideVertically) {
      return ret = sortable;
    }
  });
  return ret;
};
var _prepareGroup = function _prepareGroup2(options) {
  function toFn(value, pull) {
    return function(to, from, dragEl2, evt) {
      var sameGroup = to.options.group.name && from.options.group.name && to.options.group.name === from.options.group.name;
      if (value == null && (pull || sameGroup)) {
        return true;
      } else if (value == null || value === false) {
        return false;
      } else if (pull && value === "clone") {
        return value;
      } else if (typeof value === "function") {
        return toFn(value(to, from, dragEl2, evt), pull)(to, from, dragEl2, evt);
      } else {
        var otherGroup = (pull ? to : from).options.group.name;
        return value === true || typeof value === "string" && value === otherGroup || value.join && value.indexOf(otherGroup) > -1;
      }
    };
  }
  var group = {};
  var originalGroup = options.group;
  if (!originalGroup || _typeof(originalGroup) != "object") {
    originalGroup = {
      name: originalGroup
    };
  }
  group.name = originalGroup.name;
  group.checkPull = toFn(originalGroup.pull, true);
  group.checkPut = toFn(originalGroup.put);
  group.revertClone = originalGroup.revertClone;
  options.group = group;
};
var _hideGhostForTarget = function _hideGhostForTarget2() {
  if (!supportCssPointerEvents && ghostEl) {
    css(ghostEl, "display", "none");
  }
};
var _unhideGhostForTarget = function _unhideGhostForTarget2() {
  if (!supportCssPointerEvents && ghostEl) {
    css(ghostEl, "display", "");
  }
};
if (documentExists && !ChromeForAndroid) {
  document.addEventListener("click", function(evt) {
    if (ignoreNextClick) {
      evt.preventDefault();
      evt.stopPropagation && evt.stopPropagation();
      evt.stopImmediatePropagation && evt.stopImmediatePropagation();
      ignoreNextClick = false;
      return false;
    }
  }, true);
}
var nearestEmptyInsertDetectEvent = function nearestEmptyInsertDetectEvent2(evt) {
  if (dragEl) {
    evt = evt.touches ? evt.touches[0] : evt;
    var nearest = _detectNearestEmptySortable(evt.clientX, evt.clientY);
    if (nearest) {
      var event = {};
      for (var i in evt) {
        if (evt.hasOwnProperty(i)) {
          event[i] = evt[i];
        }
      }
      event.target = event.rootEl = nearest;
      event.preventDefault = void 0;
      event.stopPropagation = void 0;
      nearest[expando]._onDragOver(event);
    }
  }
};
var _checkOutsideTargetEl = function _checkOutsideTargetEl2(evt) {
  if (dragEl) {
    dragEl.parentNode[expando]._isOutsideThisEl(evt.target);
  }
};
function Sortable(el, options) {
  if (!(el && el.nodeType && el.nodeType === 1)) {
    throw "Sortable: `el` must be an HTMLElement, not ".concat({}.toString.call(el));
  }
  this.el = el;
  this.options = options = _extends({}, options);
  el[expando] = this;
  var defaults2 = {
    group: null,
    sort: true,
    disabled: false,
    store: null,
    handle: null,
    draggable: /^[uo]l$/i.test(el.nodeName) ? ">li" : ">*",
    swapThreshold: 1,
    // percentage; 0 <= x <= 1
    invertSwap: false,
    // invert always
    invertedSwapThreshold: null,
    // will be set to same as swapThreshold if default
    removeCloneOnHide: true,
    direction: function direction() {
      return _detectDirection(el, this.options);
    },
    ghostClass: "sortable-ghost",
    chosenClass: "sortable-chosen",
    dragClass: "sortable-drag",
    ignore: "a, img",
    filter: null,
    preventOnFilter: true,
    animation: 0,
    easing: null,
    setData: function setData(dataTransfer, dragEl2) {
      dataTransfer.setData("Text", dragEl2.textContent);
    },
    dropBubble: false,
    dragoverBubble: false,
    dataIdAttr: "data-id",
    delay: 0,
    delayOnTouchOnly: false,
    touchStartThreshold: (Number.parseInt ? Number : window).parseInt(window.devicePixelRatio, 10) || 1,
    forceFallback: false,
    fallbackClass: "sortable-fallback",
    fallbackOnBody: false,
    fallbackTolerance: 0,
    fallbackOffset: {
      x: 0,
      y: 0
    },
    // Disabled on Safari: #1571; Enabled on Safari IOS: #2244
    supportPointer: Sortable.supportPointer !== false && "PointerEvent" in window && (!Safari || IOS),
    emptyInsertThreshold: 5
  };
  PluginManager.initializePlugins(this, el, defaults2);
  for (var name in defaults2) {
    !(name in options) && (options[name] = defaults2[name]);
  }
  _prepareGroup(options);
  for (var fn in this) {
    if (fn.charAt(0) === "_" && typeof this[fn] === "function") {
      this[fn] = this[fn].bind(this);
    }
  }
  this.nativeDraggable = options.forceFallback ? false : supportDraggable;
  if (this.nativeDraggable) {
    this.options.touchStartThreshold = 1;
  }
  if (options.supportPointer) {
    on(el, "pointerdown", this._onTapStart);
  } else {
    on(el, "mousedown", this._onTapStart);
    on(el, "touchstart", this._onTapStart);
  }
  if (this.nativeDraggable) {
    on(el, "dragover", this);
    on(el, "dragenter", this);
  }
  sortables.push(this.el);
  options.store && options.store.get && this.sort(options.store.get(this) || []);
  _extends(this, AnimationStateManager());
}
Sortable.prototype = /** @lends Sortable.prototype */
{
  constructor: Sortable,
  _isOutsideThisEl: function _isOutsideThisEl(target) {
    if (!this.el.contains(target) && target !== this.el) {
      lastTarget = null;
    }
  },
  _getDirection: function _getDirection(evt, target) {
    return typeof this.options.direction === "function" ? this.options.direction.call(this, evt, target, dragEl) : this.options.direction;
  },
  _onTapStart: function _onTapStart(evt) {
    if (!evt.cancelable) return;
    var _this = this, el = this.el, options = this.options, preventOnFilter = options.preventOnFilter, type = evt.type, touch = evt.touches && evt.touches[0] || evt.pointerType && evt.pointerType === "touch" && evt, target = (touch || evt).target, originalTarget = evt.target.shadowRoot && (evt.path && evt.path[0] || evt.composedPath && evt.composedPath()[0]) || target, filter = options.filter;
    _saveInputCheckedState(el);
    if (dragEl) {
      return;
    }
    if (/mousedown|pointerdown/.test(type) && evt.button !== 0 || options.disabled) {
      return;
    }
    if (originalTarget.isContentEditable) {
      return;
    }
    if (!this.nativeDraggable && Safari && target && target.tagName.toUpperCase() === "SELECT") {
      return;
    }
    target = closest(target, options.draggable, el, false);
    if (target && target.animated) {
      return;
    }
    if (lastDownEl === target) {
      return;
    }
    oldIndex = index(target);
    oldDraggableIndex = index(target, options.draggable);
    if (typeof filter === "function") {
      if (filter.call(this, evt, target, this)) {
        _dispatchEvent({
          sortable: _this,
          rootEl: originalTarget,
          name: "filter",
          targetEl: target,
          toEl: el,
          fromEl: el
        });
        pluginEvent2("filter", _this, {
          evt
        });
        preventOnFilter && evt.preventDefault();
        return;
      }
    } else if (filter) {
      filter = filter.split(",").some(function(criteria) {
        criteria = closest(originalTarget, criteria.trim(), el, false);
        if (criteria) {
          _dispatchEvent({
            sortable: _this,
            rootEl: criteria,
            name: "filter",
            targetEl: target,
            fromEl: el,
            toEl: el
          });
          pluginEvent2("filter", _this, {
            evt
          });
          return true;
        }
      });
      if (filter) {
        preventOnFilter && evt.preventDefault();
        return;
      }
    }
    if (options.handle && !closest(originalTarget, options.handle, el, false)) {
      return;
    }
    this._prepareDragStart(evt, touch, target);
  },
  _prepareDragStart: function _prepareDragStart(evt, touch, target) {
    var _this = this, el = _this.el, options = _this.options, ownerDocument = el.ownerDocument, dragStartFn;
    if (target && !dragEl && target.parentNode === el) {
      var dragRect = getRect(target);
      rootEl = el;
      dragEl = target;
      parentEl = dragEl.parentNode;
      nextEl = dragEl.nextSibling;
      lastDownEl = target;
      activeGroup = options.group;
      Sortable.dragged = dragEl;
      tapEvt = {
        target: dragEl,
        clientX: (touch || evt).clientX,
        clientY: (touch || evt).clientY
      };
      tapDistanceLeft = tapEvt.clientX - dragRect.left;
      tapDistanceTop = tapEvt.clientY - dragRect.top;
      this._lastX = (touch || evt).clientX;
      this._lastY = (touch || evt).clientY;
      dragEl.style["will-change"] = "all";
      dragStartFn = function dragStartFn2() {
        pluginEvent2("delayEnded", _this, {
          evt
        });
        if (Sortable.eventCanceled) {
          _this._onDrop();
          return;
        }
        _this._disableDelayedDragEvents();
        if (!FireFox && _this.nativeDraggable) {
          dragEl.draggable = true;
        }
        _this._triggerDragStart(evt, touch);
        _dispatchEvent({
          sortable: _this,
          name: "choose",
          originalEvent: evt
        });
        toggleClass(dragEl, options.chosenClass, true);
      };
      options.ignore.split(",").forEach(function(criteria) {
        find(dragEl, criteria.trim(), _disableDraggable);
      });
      on(ownerDocument, "dragover", nearestEmptyInsertDetectEvent);
      on(ownerDocument, "mousemove", nearestEmptyInsertDetectEvent);
      on(ownerDocument, "touchmove", nearestEmptyInsertDetectEvent);
      if (options.supportPointer) {
        on(ownerDocument, "pointerup", _this._onDrop);
        !this.nativeDraggable && on(ownerDocument, "pointercancel", _this._onDrop);
      } else {
        on(ownerDocument, "mouseup", _this._onDrop);
        on(ownerDocument, "touchend", _this._onDrop);
        on(ownerDocument, "touchcancel", _this._onDrop);
      }
      if (FireFox && this.nativeDraggable) {
        this.options.touchStartThreshold = 4;
        dragEl.draggable = true;
      }
      pluginEvent2("delayStart", this, {
        evt
      });
      if (options.delay && (!options.delayOnTouchOnly || touch) && (!this.nativeDraggable || !(Edge || IE11OrLess))) {
        if (Sortable.eventCanceled) {
          this._onDrop();
          return;
        }
        if (options.supportPointer) {
          on(ownerDocument, "pointerup", _this._disableDelayedDrag);
          on(ownerDocument, "pointercancel", _this._disableDelayedDrag);
        } else {
          on(ownerDocument, "mouseup", _this._disableDelayedDrag);
          on(ownerDocument, "touchend", _this._disableDelayedDrag);
          on(ownerDocument, "touchcancel", _this._disableDelayedDrag);
        }
        on(ownerDocument, "mousemove", _this._delayedDragTouchMoveHandler);
        on(ownerDocument, "touchmove", _this._delayedDragTouchMoveHandler);
        options.supportPointer && on(ownerDocument, "pointermove", _this._delayedDragTouchMoveHandler);
        _this._dragStartTimer = setTimeout(dragStartFn, options.delay);
      } else {
        dragStartFn();
      }
    }
  },
  _delayedDragTouchMoveHandler: function _delayedDragTouchMoveHandler(e) {
    var touch = e.touches ? e.touches[0] : e;
    if (Math.max(Math.abs(touch.clientX - this._lastX), Math.abs(touch.clientY - this._lastY)) >= Math.floor(this.options.touchStartThreshold / (this.nativeDraggable && window.devicePixelRatio || 1))) {
      this._disableDelayedDrag();
    }
  },
  _disableDelayedDrag: function _disableDelayedDrag() {
    dragEl && _disableDraggable(dragEl);
    clearTimeout(this._dragStartTimer);
    this._disableDelayedDragEvents();
  },
  _disableDelayedDragEvents: function _disableDelayedDragEvents() {
    var ownerDocument = this.el.ownerDocument;
    off(ownerDocument, "mouseup", this._disableDelayedDrag);
    off(ownerDocument, "touchend", this._disableDelayedDrag);
    off(ownerDocument, "touchcancel", this._disableDelayedDrag);
    off(ownerDocument, "pointerup", this._disableDelayedDrag);
    off(ownerDocument, "pointercancel", this._disableDelayedDrag);
    off(ownerDocument, "mousemove", this._delayedDragTouchMoveHandler);
    off(ownerDocument, "touchmove", this._delayedDragTouchMoveHandler);
    off(ownerDocument, "pointermove", this._delayedDragTouchMoveHandler);
  },
  _triggerDragStart: function _triggerDragStart(evt, touch) {
    touch = touch || evt.pointerType == "touch" && evt;
    if (!this.nativeDraggable || touch) {
      if (this.options.supportPointer) {
        on(document, "pointermove", this._onTouchMove);
      } else if (touch) {
        on(document, "touchmove", this._onTouchMove);
      } else {
        on(document, "mousemove", this._onTouchMove);
      }
    } else {
      on(dragEl, "dragend", this);
      on(rootEl, "dragstart", this._onDragStart);
    }
    try {
      if (document.selection) {
        _nextTick(function() {
          document.selection.empty();
        });
      } else {
        window.getSelection().removeAllRanges();
      }
    } catch (err) {
    }
  },
  _dragStarted: function _dragStarted(fallback, evt) {
    awaitingDragStarted = false;
    if (rootEl && dragEl) {
      pluginEvent2("dragStarted", this, {
        evt
      });
      if (this.nativeDraggable) {
        on(document, "dragover", _checkOutsideTargetEl);
      }
      var options = this.options;
      !fallback && toggleClass(dragEl, options.dragClass, false);
      toggleClass(dragEl, options.ghostClass, true);
      Sortable.active = this;
      fallback && this._appendGhost();
      _dispatchEvent({
        sortable: this,
        name: "start",
        originalEvent: evt
      });
    } else {
      this._nulling();
    }
  },
  _emulateDragOver: function _emulateDragOver() {
    if (touchEvt) {
      this._lastX = touchEvt.clientX;
      this._lastY = touchEvt.clientY;
      _hideGhostForTarget();
      var target = document.elementFromPoint(touchEvt.clientX, touchEvt.clientY);
      var parent = target;
      while (target && target.shadowRoot) {
        target = target.shadowRoot.elementFromPoint(touchEvt.clientX, touchEvt.clientY);
        if (target === parent) break;
        parent = target;
      }
      dragEl.parentNode[expando]._isOutsideThisEl(target);
      if (parent) {
        do {
          if (parent[expando]) {
            var inserted = void 0;
            inserted = parent[expando]._onDragOver({
              clientX: touchEvt.clientX,
              clientY: touchEvt.clientY,
              target,
              rootEl: parent
            });
            if (inserted && !this.options.dragoverBubble) {
              break;
            }
          }
          target = parent;
        } while (parent = getParentOrHost(parent));
      }
      _unhideGhostForTarget();
    }
  },
  _onTouchMove: function _onTouchMove(evt) {
    if (tapEvt) {
      var options = this.options, fallbackTolerance = options.fallbackTolerance, fallbackOffset = options.fallbackOffset, touch = evt.touches ? evt.touches[0] : evt, ghostMatrix = ghostEl && matrix(ghostEl, true), scaleX = ghostEl && ghostMatrix && ghostMatrix.a, scaleY = ghostEl && ghostMatrix && ghostMatrix.d, relativeScrollOffset = PositionGhostAbsolutely && ghostRelativeParent && getRelativeScrollOffset(ghostRelativeParent), dx = (touch.clientX - tapEvt.clientX + fallbackOffset.x) / (scaleX || 1) + (relativeScrollOffset ? relativeScrollOffset[0] - ghostRelativeParentInitialScroll[0] : 0) / (scaleX || 1), dy = (touch.clientY - tapEvt.clientY + fallbackOffset.y) / (scaleY || 1) + (relativeScrollOffset ? relativeScrollOffset[1] - ghostRelativeParentInitialScroll[1] : 0) / (scaleY || 1);
      if (!Sortable.active && !awaitingDragStarted) {
        if (fallbackTolerance && Math.max(Math.abs(touch.clientX - this._lastX), Math.abs(touch.clientY - this._lastY)) < fallbackTolerance) {
          return;
        }
        this._onDragStart(evt, true);
      }
      if (ghostEl) {
        if (ghostMatrix) {
          ghostMatrix.e += dx - (lastDx || 0);
          ghostMatrix.f += dy - (lastDy || 0);
        } else {
          ghostMatrix = {
            a: 1,
            b: 0,
            c: 0,
            d: 1,
            e: dx,
            f: dy
          };
        }
        var cssMatrix = "matrix(".concat(ghostMatrix.a, ",").concat(ghostMatrix.b, ",").concat(ghostMatrix.c, ",").concat(ghostMatrix.d, ",").concat(ghostMatrix.e, ",").concat(ghostMatrix.f, ")");
        css(ghostEl, "webkitTransform", cssMatrix);
        css(ghostEl, "mozTransform", cssMatrix);
        css(ghostEl, "msTransform", cssMatrix);
        css(ghostEl, "transform", cssMatrix);
        lastDx = dx;
        lastDy = dy;
        touchEvt = touch;
      }
      evt.cancelable && evt.preventDefault();
    }
  },
  _appendGhost: function _appendGhost() {
    if (!ghostEl) {
      var container = this.options.fallbackOnBody ? document.body : rootEl, rect = getRect(dragEl, true, PositionGhostAbsolutely, true, container), options = this.options;
      if (PositionGhostAbsolutely) {
        ghostRelativeParent = container;
        while (css(ghostRelativeParent, "position") === "static" && css(ghostRelativeParent, "transform") === "none" && ghostRelativeParent !== document) {
          ghostRelativeParent = ghostRelativeParent.parentNode;
        }
        if (ghostRelativeParent !== document.body && ghostRelativeParent !== document.documentElement) {
          if (ghostRelativeParent === document) ghostRelativeParent = getWindowScrollingElement();
          rect.top += ghostRelativeParent.scrollTop;
          rect.left += ghostRelativeParent.scrollLeft;
        } else {
          ghostRelativeParent = getWindowScrollingElement();
        }
        ghostRelativeParentInitialScroll = getRelativeScrollOffset(ghostRelativeParent);
      }
      ghostEl = dragEl.cloneNode(true);
      toggleClass(ghostEl, options.ghostClass, false);
      toggleClass(ghostEl, options.fallbackClass, true);
      toggleClass(ghostEl, options.dragClass, true);
      css(ghostEl, "transition", "");
      css(ghostEl, "transform", "");
      css(ghostEl, "box-sizing", "border-box");
      css(ghostEl, "margin", 0);
      css(ghostEl, "top", rect.top);
      css(ghostEl, "left", rect.left);
      css(ghostEl, "width", rect.width);
      css(ghostEl, "height", rect.height);
      css(ghostEl, "opacity", "0.8");
      css(ghostEl, "position", PositionGhostAbsolutely ? "absolute" : "fixed");
      css(ghostEl, "zIndex", "100000");
      css(ghostEl, "pointerEvents", "none");
      Sortable.ghost = ghostEl;
      container.appendChild(ghostEl);
      css(ghostEl, "transform-origin", tapDistanceLeft / parseInt(ghostEl.style.width) * 100 + "% " + tapDistanceTop / parseInt(ghostEl.style.height) * 100 + "%");
    }
  },
  _onDragStart: function _onDragStart(evt, fallback) {
    var _this = this;
    var dataTransfer = evt.dataTransfer;
    var options = _this.options;
    pluginEvent2("dragStart", this, {
      evt
    });
    if (Sortable.eventCanceled) {
      this._onDrop();
      return;
    }
    pluginEvent2("setupClone", this);
    if (!Sortable.eventCanceled) {
      cloneEl = clone(dragEl);
      cloneEl.removeAttribute("id");
      cloneEl.draggable = false;
      cloneEl.style["will-change"] = "";
      this._hideClone();
      toggleClass(cloneEl, this.options.chosenClass, false);
      Sortable.clone = cloneEl;
    }
    _this.cloneId = _nextTick(function() {
      pluginEvent2("clone", _this);
      if (Sortable.eventCanceled) return;
      if (!_this.options.removeCloneOnHide) {
        rootEl.insertBefore(cloneEl, dragEl);
      }
      _this._hideClone();
      _dispatchEvent({
        sortable: _this,
        name: "clone"
      });
    });
    !fallback && toggleClass(dragEl, options.dragClass, true);
    if (fallback) {
      ignoreNextClick = true;
      _this._loopId = setInterval(_this._emulateDragOver, 50);
    } else {
      off(document, "mouseup", _this._onDrop);
      off(document, "touchend", _this._onDrop);
      off(document, "touchcancel", _this._onDrop);
      if (dataTransfer) {
        dataTransfer.effectAllowed = "move";
        options.setData && options.setData.call(_this, dataTransfer, dragEl);
      }
      on(document, "drop", _this);
      css(dragEl, "transform", "translateZ(0)");
    }
    awaitingDragStarted = true;
    _this._dragStartId = _nextTick(_this._dragStarted.bind(_this, fallback, evt));
    on(document, "selectstart", _this);
    moved = true;
    window.getSelection().removeAllRanges();
    if (Safari) {
      css(document.body, "user-select", "none");
    }
  },
  // Returns true - if no further action is needed (either inserted or another condition)
  _onDragOver: function _onDragOver(evt) {
    var el = this.el, target = evt.target, dragRect, targetRect, revert, options = this.options, group = options.group, activeSortable = Sortable.active, isOwner = activeGroup === group, canSort = options.sort, fromSortable = putSortable || activeSortable, vertical, _this = this, completedFired = false;
    if (_silent) return;
    function dragOverEvent(name, extra) {
      pluginEvent2(name, _this, _objectSpread2({
        evt,
        isOwner,
        axis: vertical ? "vertical" : "horizontal",
        revert,
        dragRect,
        targetRect,
        canSort,
        fromSortable,
        target,
        completed,
        onMove: function onMove(target2, after2) {
          return _onMove(rootEl, el, dragEl, dragRect, target2, getRect(target2), evt, after2);
        },
        changed
      }, extra));
    }
    function capture() {
      dragOverEvent("dragOverAnimationCapture");
      _this.captureAnimationState();
      if (_this !== fromSortable) {
        fromSortable.captureAnimationState();
      }
    }
    function completed(insertion) {
      dragOverEvent("dragOverCompleted", {
        insertion
      });
      if (insertion) {
        if (isOwner) {
          activeSortable._hideClone();
        } else {
          activeSortable._showClone(_this);
        }
        if (_this !== fromSortable) {
          toggleClass(dragEl, putSortable ? putSortable.options.ghostClass : activeSortable.options.ghostClass, false);
          toggleClass(dragEl, options.ghostClass, true);
        }
        if (putSortable !== _this && _this !== Sortable.active) {
          putSortable = _this;
        } else if (_this === Sortable.active && putSortable) {
          putSortable = null;
        }
        if (fromSortable === _this) {
          _this._ignoreWhileAnimating = target;
        }
        _this.animateAll(function() {
          dragOverEvent("dragOverAnimationComplete");
          _this._ignoreWhileAnimating = null;
        });
        if (_this !== fromSortable) {
          fromSortable.animateAll();
          fromSortable._ignoreWhileAnimating = null;
        }
      }
      if (target === dragEl && !dragEl.animated || target === el && !target.animated) {
        lastTarget = null;
      }
      if (!options.dragoverBubble && !evt.rootEl && target !== document) {
        dragEl.parentNode[expando]._isOutsideThisEl(evt.target);
        !insertion && nearestEmptyInsertDetectEvent(evt);
      }
      !options.dragoverBubble && evt.stopPropagation && evt.stopPropagation();
      return completedFired = true;
    }
    function changed() {
      newIndex = index(dragEl);
      newDraggableIndex = index(dragEl, options.draggable);
      _dispatchEvent({
        sortable: _this,
        name: "change",
        toEl: el,
        newIndex,
        newDraggableIndex,
        originalEvent: evt
      });
    }
    if (evt.preventDefault !== void 0) {
      evt.cancelable && evt.preventDefault();
    }
    target = closest(target, options.draggable, el, true);
    dragOverEvent("dragOver");
    if (Sortable.eventCanceled) return completedFired;
    if (dragEl.contains(evt.target) || target.animated && target.animatingX && target.animatingY || _this._ignoreWhileAnimating === target) {
      return completed(false);
    }
    ignoreNextClick = false;
    if (activeSortable && !options.disabled && (isOwner ? canSort || (revert = parentEl !== rootEl) : putSortable === this || (this.lastPutMode = activeGroup.checkPull(this, activeSortable, dragEl, evt)) && group.checkPut(this, activeSortable, dragEl, evt))) {
      vertical = this._getDirection(evt, target) === "vertical";
      dragRect = getRect(dragEl);
      dragOverEvent("dragOverValid");
      if (Sortable.eventCanceled) return completedFired;
      if (revert) {
        parentEl = rootEl;
        capture();
        this._hideClone();
        dragOverEvent("revert");
        if (!Sortable.eventCanceled) {
          if (nextEl) {
            rootEl.insertBefore(dragEl, nextEl);
          } else {
            rootEl.appendChild(dragEl);
          }
        }
        return completed(true);
      }
      var elLastChild = lastChild(el, options.draggable);
      if (!elLastChild || _ghostIsLast(evt, vertical, this) && !elLastChild.animated) {
        if (elLastChild === dragEl) {
          return completed(false);
        }
        if (elLastChild && el === evt.target) {
          target = elLastChild;
        }
        if (target) {
          targetRect = getRect(target);
        }
        if (_onMove(rootEl, el, dragEl, dragRect, target, targetRect, evt, !!target) !== false) {
          capture();
          if (elLastChild && elLastChild.nextSibling) {
            el.insertBefore(dragEl, elLastChild.nextSibling);
          } else {
            el.appendChild(dragEl);
          }
          parentEl = el;
          changed();
          return completed(true);
        }
      } else if (elLastChild && _ghostIsFirst(evt, vertical, this)) {
        var firstChild = getChild(el, 0, options, true);
        if (firstChild === dragEl) {
          return completed(false);
        }
        target = firstChild;
        targetRect = getRect(target);
        if (_onMove(rootEl, el, dragEl, dragRect, target, targetRect, evt, false) !== false) {
          capture();
          el.insertBefore(dragEl, firstChild);
          parentEl = el;
          changed();
          return completed(true);
        }
      } else if (target.parentNode === el) {
        targetRect = getRect(target);
        var direction = 0, targetBeforeFirstSwap, differentLevel = dragEl.parentNode !== el, differentRowCol = !_dragElInRowColumn(dragEl.animated && dragEl.toRect || dragRect, target.animated && target.toRect || targetRect, vertical), side1 = vertical ? "top" : "left", scrolledPastTop = isScrolledPast(target, "top", "top") || isScrolledPast(dragEl, "top", "top"), scrollBefore = scrolledPastTop ? scrolledPastTop.scrollTop : void 0;
        if (lastTarget !== target) {
          targetBeforeFirstSwap = targetRect[side1];
          pastFirstInvertThresh = false;
          isCircumstantialInvert = !differentRowCol && options.invertSwap || differentLevel;
        }
        direction = _getSwapDirection(evt, target, targetRect, vertical, differentRowCol ? 1 : options.swapThreshold, options.invertedSwapThreshold == null ? options.swapThreshold : options.invertedSwapThreshold, isCircumstantialInvert, lastTarget === target);
        var sibling;
        if (direction !== 0) {
          var dragIndex = index(dragEl);
          do {
            dragIndex -= direction;
            sibling = parentEl.children[dragIndex];
          } while (sibling && (css(sibling, "display") === "none" || sibling === ghostEl));
        }
        if (direction === 0 || sibling === target) {
          return completed(false);
        }
        lastTarget = target;
        lastDirection = direction;
        var nextSibling = target.nextElementSibling, after = false;
        after = direction === 1;
        var moveVector = _onMove(rootEl, el, dragEl, dragRect, target, targetRect, evt, after);
        if (moveVector !== false) {
          if (moveVector === 1 || moveVector === -1) {
            after = moveVector === 1;
          }
          _silent = true;
          setTimeout(_unsilent, 30);
          capture();
          if (after && !nextSibling) {
            el.appendChild(dragEl);
          } else {
            target.parentNode.insertBefore(dragEl, after ? nextSibling : target);
          }
          if (scrolledPastTop) {
            scrollBy(scrolledPastTop, 0, scrollBefore - scrolledPastTop.scrollTop);
          }
          parentEl = dragEl.parentNode;
          if (targetBeforeFirstSwap !== void 0 && !isCircumstantialInvert) {
            targetMoveDistance = Math.abs(targetBeforeFirstSwap - getRect(target)[side1]);
          }
          changed();
          return completed(true);
        }
      }
      if (el.contains(dragEl)) {
        return completed(false);
      }
    }
    return false;
  },
  _ignoreWhileAnimating: null,
  _offMoveEvents: function _offMoveEvents() {
    off(document, "mousemove", this._onTouchMove);
    off(document, "touchmove", this._onTouchMove);
    off(document, "pointermove", this._onTouchMove);
    off(document, "dragover", nearestEmptyInsertDetectEvent);
    off(document, "mousemove", nearestEmptyInsertDetectEvent);
    off(document, "touchmove", nearestEmptyInsertDetectEvent);
  },
  _offUpEvents: function _offUpEvents() {
    var ownerDocument = this.el.ownerDocument;
    off(ownerDocument, "mouseup", this._onDrop);
    off(ownerDocument, "touchend", this._onDrop);
    off(ownerDocument, "pointerup", this._onDrop);
    off(ownerDocument, "pointercancel", this._onDrop);
    off(ownerDocument, "touchcancel", this._onDrop);
    off(document, "selectstart", this);
  },
  _onDrop: function _onDrop(evt) {
    var el = this.el, options = this.options;
    newIndex = index(dragEl);
    newDraggableIndex = index(dragEl, options.draggable);
    pluginEvent2("drop", this, {
      evt
    });
    parentEl = dragEl && dragEl.parentNode;
    newIndex = index(dragEl);
    newDraggableIndex = index(dragEl, options.draggable);
    if (Sortable.eventCanceled) {
      this._nulling();
      return;
    }
    awaitingDragStarted = false;
    isCircumstantialInvert = false;
    pastFirstInvertThresh = false;
    clearInterval(this._loopId);
    clearTimeout(this._dragStartTimer);
    _cancelNextTick(this.cloneId);
    _cancelNextTick(this._dragStartId);
    if (this.nativeDraggable) {
      off(document, "drop", this);
      off(el, "dragstart", this._onDragStart);
    }
    this._offMoveEvents();
    this._offUpEvents();
    if (Safari) {
      css(document.body, "user-select", "");
    }
    css(dragEl, "transform", "");
    if (evt) {
      if (moved) {
        evt.cancelable && evt.preventDefault();
        !options.dropBubble && evt.stopPropagation();
      }
      ghostEl && ghostEl.parentNode && ghostEl.parentNode.removeChild(ghostEl);
      if (rootEl === parentEl || putSortable && putSortable.lastPutMode !== "clone") {
        cloneEl && cloneEl.parentNode && cloneEl.parentNode.removeChild(cloneEl);
      }
      if (dragEl) {
        if (this.nativeDraggable) {
          off(dragEl, "dragend", this);
        }
        _disableDraggable(dragEl);
        dragEl.style["will-change"] = "";
        if (moved && !awaitingDragStarted) {
          toggleClass(dragEl, putSortable ? putSortable.options.ghostClass : this.options.ghostClass, false);
        }
        toggleClass(dragEl, this.options.chosenClass, false);
        _dispatchEvent({
          sortable: this,
          name: "unchoose",
          toEl: parentEl,
          newIndex: null,
          newDraggableIndex: null,
          originalEvent: evt
        });
        if (rootEl !== parentEl) {
          if (newIndex >= 0) {
            _dispatchEvent({
              rootEl: parentEl,
              name: "add",
              toEl: parentEl,
              fromEl: rootEl,
              originalEvent: evt
            });
            _dispatchEvent({
              sortable: this,
              name: "remove",
              toEl: parentEl,
              originalEvent: evt
            });
            _dispatchEvent({
              rootEl: parentEl,
              name: "sort",
              toEl: parentEl,
              fromEl: rootEl,
              originalEvent: evt
            });
            _dispatchEvent({
              sortable: this,
              name: "sort",
              toEl: parentEl,
              originalEvent: evt
            });
          }
          putSortable && putSortable.save();
        } else {
          if (newIndex !== oldIndex) {
            if (newIndex >= 0) {
              _dispatchEvent({
                sortable: this,
                name: "update",
                toEl: parentEl,
                originalEvent: evt
              });
              _dispatchEvent({
                sortable: this,
                name: "sort",
                toEl: parentEl,
                originalEvent: evt
              });
            }
          }
        }
        if (Sortable.active) {
          if (newIndex == null || newIndex === -1) {
            newIndex = oldIndex;
            newDraggableIndex = oldDraggableIndex;
          }
          _dispatchEvent({
            sortable: this,
            name: "end",
            toEl: parentEl,
            originalEvent: evt
          });
          this.save();
        }
      }
    }
    this._nulling();
  },
  _nulling: function _nulling() {
    pluginEvent2("nulling", this);
    rootEl = dragEl = parentEl = ghostEl = nextEl = cloneEl = lastDownEl = cloneHidden = tapEvt = touchEvt = moved = newIndex = newDraggableIndex = oldIndex = oldDraggableIndex = lastTarget = lastDirection = putSortable = activeGroup = Sortable.dragged = Sortable.ghost = Sortable.clone = Sortable.active = null;
    var el = this.el;
    savedInputChecked.forEach(function(checkEl) {
      if (el.contains(checkEl)) {
        checkEl.checked = true;
      }
    });
    savedInputChecked.length = lastDx = lastDy = 0;
  },
  handleEvent: function handleEvent(evt) {
    switch (evt.type) {
      case "drop":
      case "dragend":
        this._onDrop(evt);
        break;
      case "dragenter":
      case "dragover":
        if (dragEl) {
          this._onDragOver(evt);
          _globalDragOver(evt);
        }
        break;
      case "selectstart":
        evt.preventDefault();
        break;
    }
  },
  /**
   * Serializes the item into an array of string.
   * @returns {String[]}
   */
  toArray: function toArray() {
    var order = [], el, children = this.el.children, i = 0, n = children.length, options = this.options;
    for (; i < n; i++) {
      el = children[i];
      if (closest(el, options.draggable, this.el, false)) {
        order.push(el.getAttribute(options.dataIdAttr) || _generateId(el));
      }
    }
    return order;
  },
  /**
   * Sorts the elements according to the array.
   * @param  {String[]}  order  order of the items
   */
  sort: function sort(order, useAnimation) {
    var items = {}, rootEl2 = this.el;
    this.toArray().forEach(function(id, i) {
      var el = rootEl2.children[i];
      if (closest(el, this.options.draggable, rootEl2, false)) {
        items[id] = el;
      }
    }, this);
    useAnimation && this.captureAnimationState();
    order.forEach(function(id) {
      if (items[id]) {
        rootEl2.removeChild(items[id]);
        rootEl2.appendChild(items[id]);
      }
    });
    useAnimation && this.animateAll();
  },
  /**
   * Save the current sorting
   */
  save: function save() {
    var store = this.options.store;
    store && store.set && store.set(this);
  },
  /**
   * For each element in the set, get the first element that matches the selector by testing the element itself and traversing up through its ancestors in the DOM tree.
   * @param   {HTMLElement}  el
   * @param   {String}       [selector]  default: `options.draggable`
   * @returns {HTMLElement|null}
   */
  closest: function closest$1(el, selector) {
    return closest(el, selector || this.options.draggable, this.el, false);
  },
  /**
   * Set/get option
   * @param   {string} name
   * @param   {*}      [value]
   * @returns {*}
   */
  option: function option(name, value) {
    var options = this.options;
    if (value === void 0) {
      return options[name];
    } else {
      var modifiedValue = PluginManager.modifyOption(this, name, value);
      if (typeof modifiedValue !== "undefined") {
        options[name] = modifiedValue;
      } else {
        options[name] = value;
      }
      if (name === "group") {
        _prepareGroup(options);
      }
    }
  },
  /**
   * Destroy
   */
  destroy: function destroy() {
    pluginEvent2("destroy", this);
    var el = this.el;
    el[expando] = null;
    off(el, "mousedown", this._onTapStart);
    off(el, "touchstart", this._onTapStart);
    off(el, "pointerdown", this._onTapStart);
    if (this.nativeDraggable) {
      off(el, "dragover", this);
      off(el, "dragenter", this);
    }
    Array.prototype.forEach.call(el.querySelectorAll("[draggable]"), function(el2) {
      el2.removeAttribute("draggable");
    });
    this._onDrop();
    this._disableDelayedDragEvents();
    sortables.splice(sortables.indexOf(this.el), 1);
    this.el = el = null;
  },
  _hideClone: function _hideClone() {
    if (!cloneHidden) {
      pluginEvent2("hideClone", this);
      if (Sortable.eventCanceled) return;
      css(cloneEl, "display", "none");
      if (this.options.removeCloneOnHide && cloneEl.parentNode) {
        cloneEl.parentNode.removeChild(cloneEl);
      }
      cloneHidden = true;
    }
  },
  _showClone: function _showClone(putSortable2) {
    if (putSortable2.lastPutMode !== "clone") {
      this._hideClone();
      return;
    }
    if (cloneHidden) {
      pluginEvent2("showClone", this);
      if (Sortable.eventCanceled) return;
      if (dragEl.parentNode == rootEl && !this.options.group.revertClone) {
        rootEl.insertBefore(cloneEl, dragEl);
      } else if (nextEl) {
        rootEl.insertBefore(cloneEl, nextEl);
      } else {
        rootEl.appendChild(cloneEl);
      }
      if (this.options.group.revertClone) {
        this.animate(dragEl, cloneEl);
      }
      css(cloneEl, "display", "");
      cloneHidden = false;
    }
  }
};
function _globalDragOver(evt) {
  if (evt.dataTransfer) {
    evt.dataTransfer.dropEffect = "move";
  }
  evt.cancelable && evt.preventDefault();
}
function _onMove(fromEl, toEl, dragEl2, dragRect, targetEl, targetRect, originalEvent, willInsertAfter) {
  var evt, sortable = fromEl[expando], onMoveFn = sortable.options.onMove, retVal;
  if (window.CustomEvent && !IE11OrLess && !Edge) {
    evt = new CustomEvent("move", {
      bubbles: true,
      cancelable: true
    });
  } else {
    evt = document.createEvent("Event");
    evt.initEvent("move", true, true);
  }
  evt.to = toEl;
  evt.from = fromEl;
  evt.dragged = dragEl2;
  evt.draggedRect = dragRect;
  evt.related = targetEl || toEl;
  evt.relatedRect = targetRect || getRect(toEl);
  evt.willInsertAfter = willInsertAfter;
  evt.originalEvent = originalEvent;
  fromEl.dispatchEvent(evt);
  if (onMoveFn) {
    retVal = onMoveFn.call(sortable, evt, originalEvent);
  }
  return retVal;
}
function _disableDraggable(el) {
  el.draggable = false;
}
function _unsilent() {
  _silent = false;
}
function _ghostIsFirst(evt, vertical, sortable) {
  var firstElRect = getRect(getChild(sortable.el, 0, sortable.options, true));
  var childContainingRect = getChildContainingRectFromElement(sortable.el, sortable.options, ghostEl);
  var spacer = 10;
  return vertical ? evt.clientX < childContainingRect.left - spacer || evt.clientY < firstElRect.top && evt.clientX < firstElRect.right : evt.clientY < childContainingRect.top - spacer || evt.clientY < firstElRect.bottom && evt.clientX < firstElRect.left;
}
function _ghostIsLast(evt, vertical, sortable) {
  var lastElRect = getRect(lastChild(sortable.el, sortable.options.draggable));
  var childContainingRect = getChildContainingRectFromElement(sortable.el, sortable.options, ghostEl);
  var spacer = 10;
  return vertical ? evt.clientX > childContainingRect.right + spacer || evt.clientY > lastElRect.bottom && evt.clientX > lastElRect.left : evt.clientY > childContainingRect.bottom + spacer || evt.clientX > lastElRect.right && evt.clientY > lastElRect.top;
}
function _getSwapDirection(evt, target, targetRect, vertical, swapThreshold, invertedSwapThreshold, invertSwap, isLastTarget) {
  var mouseOnAxis = vertical ? evt.clientY : evt.clientX, targetLength = vertical ? targetRect.height : targetRect.width, targetS1 = vertical ? targetRect.top : targetRect.left, targetS2 = vertical ? targetRect.bottom : targetRect.right, invert = false;
  if (!invertSwap) {
    if (isLastTarget && targetMoveDistance < targetLength * swapThreshold) {
      if (!pastFirstInvertThresh && (lastDirection === 1 ? mouseOnAxis > targetS1 + targetLength * invertedSwapThreshold / 2 : mouseOnAxis < targetS2 - targetLength * invertedSwapThreshold / 2)) {
        pastFirstInvertThresh = true;
      }
      if (!pastFirstInvertThresh) {
        if (lastDirection === 1 ? mouseOnAxis < targetS1 + targetMoveDistance : mouseOnAxis > targetS2 - targetMoveDistance) {
          return -lastDirection;
        }
      } else {
        invert = true;
      }
    } else {
      if (mouseOnAxis > targetS1 + targetLength * (1 - swapThreshold) / 2 && mouseOnAxis < targetS2 - targetLength * (1 - swapThreshold) / 2) {
        return _getInsertDirection(target);
      }
    }
  }
  invert = invert || invertSwap;
  if (invert) {
    if (mouseOnAxis < targetS1 + targetLength * invertedSwapThreshold / 2 || mouseOnAxis > targetS2 - targetLength * invertedSwapThreshold / 2) {
      return mouseOnAxis > targetS1 + targetLength / 2 ? 1 : -1;
    }
  }
  return 0;
}
function _getInsertDirection(target) {
  if (index(dragEl) < index(target)) {
    return 1;
  } else {
    return -1;
  }
}
function _generateId(el) {
  var str = el.tagName + el.className + el.src + el.href + el.textContent, i = str.length, sum = 0;
  while (i--) {
    sum += str.charCodeAt(i);
  }
  return sum.toString(36);
}
function _saveInputCheckedState(root) {
  savedInputChecked.length = 0;
  var inputs = root.getElementsByTagName("input");
  var idx = inputs.length;
  while (idx--) {
    var el = inputs[idx];
    el.checked && savedInputChecked.push(el);
  }
}
function _nextTick(fn) {
  return setTimeout(fn, 0);
}
function _cancelNextTick(id) {
  return clearTimeout(id);
}
if (documentExists) {
  on(document, "touchmove", function(evt) {
    if ((Sortable.active || awaitingDragStarted) && evt.cancelable) {
      evt.preventDefault();
    }
  });
}
Sortable.utils = {
  on,
  off,
  css,
  find,
  is: function is(el, selector) {
    return !!closest(el, selector, el, false);
  },
  extend,
  throttle,
  closest,
  toggleClass,
  clone,
  index,
  nextTick: _nextTick,
  cancelNextTick: _cancelNextTick,
  detectDirection: _detectDirection,
  getChild,
  expando
};
Sortable.get = function(element2) {
  return element2[expando];
};
Sortable.mount = function() {
  for (var _len = arguments.length, plugins2 = new Array(_len), _key = 0; _key < _len; _key++) {
    plugins2[_key] = arguments[_key];
  }
  if (plugins2[0].constructor === Array) plugins2 = plugins2[0];
  plugins2.forEach(function(plugin) {
    if (!plugin.prototype || !plugin.prototype.constructor) {
      throw "Sortable: Mounted plugin must be a constructor function, not ".concat({}.toString.call(plugin));
    }
    if (plugin.utils) Sortable.utils = _objectSpread2(_objectSpread2({}, Sortable.utils), plugin.utils);
    PluginManager.mount(plugin);
  });
};
Sortable.create = function(el, options) {
  return new Sortable(el, options);
};
Sortable.version = version;
var autoScrolls = [];
var scrollEl;
var scrollRootEl;
var scrolling = false;
var lastAutoScrollX;
var lastAutoScrollY;
var touchEvt$1;
var pointerElemChangedInterval;
function AutoScrollPlugin() {
  function AutoScroll() {
    this.defaults = {
      scroll: true,
      forceAutoScrollFallback: false,
      scrollSensitivity: 30,
      scrollSpeed: 10,
      bubbleScroll: true
    };
    for (var fn in this) {
      if (fn.charAt(0) === "_" && typeof this[fn] === "function") {
        this[fn] = this[fn].bind(this);
      }
    }
  }
  AutoScroll.prototype = {
    dragStarted: function dragStarted(_ref) {
      var originalEvent = _ref.originalEvent;
      if (this.sortable.nativeDraggable) {
        on(document, "dragover", this._handleAutoScroll);
      } else {
        if (this.options.supportPointer) {
          on(document, "pointermove", this._handleFallbackAutoScroll);
        } else if (originalEvent.touches) {
          on(document, "touchmove", this._handleFallbackAutoScroll);
        } else {
          on(document, "mousemove", this._handleFallbackAutoScroll);
        }
      }
    },
    dragOverCompleted: function dragOverCompleted(_ref2) {
      var originalEvent = _ref2.originalEvent;
      if (!this.options.dragOverBubble && !originalEvent.rootEl) {
        this._handleAutoScroll(originalEvent);
      }
    },
    drop: function drop3() {
      if (this.sortable.nativeDraggable) {
        off(document, "dragover", this._handleAutoScroll);
      } else {
        off(document, "pointermove", this._handleFallbackAutoScroll);
        off(document, "touchmove", this._handleFallbackAutoScroll);
        off(document, "mousemove", this._handleFallbackAutoScroll);
      }
      clearPointerElemChangedInterval();
      clearAutoScrolls();
      cancelThrottle();
    },
    nulling: function nulling() {
      touchEvt$1 = scrollRootEl = scrollEl = scrolling = pointerElemChangedInterval = lastAutoScrollX = lastAutoScrollY = null;
      autoScrolls.length = 0;
    },
    _handleFallbackAutoScroll: function _handleFallbackAutoScroll(evt) {
      this._handleAutoScroll(evt, true);
    },
    _handleAutoScroll: function _handleAutoScroll(evt, fallback) {
      var _this = this;
      var x = (evt.touches ? evt.touches[0] : evt).clientX, y = (evt.touches ? evt.touches[0] : evt).clientY, elem = document.elementFromPoint(x, y);
      touchEvt$1 = evt;
      if (fallback || this.options.forceAutoScrollFallback || Edge || IE11OrLess || Safari) {
        autoScroll(evt, this.options, elem, fallback);
        var ogElemScroller = getParentAutoScrollElement(elem, true);
        if (scrolling && (!pointerElemChangedInterval || x !== lastAutoScrollX || y !== lastAutoScrollY)) {
          pointerElemChangedInterval && clearPointerElemChangedInterval();
          pointerElemChangedInterval = setInterval(function() {
            var newElem = getParentAutoScrollElement(document.elementFromPoint(x, y), true);
            if (newElem !== ogElemScroller) {
              ogElemScroller = newElem;
              clearAutoScrolls();
            }
            autoScroll(evt, _this.options, newElem, fallback);
          }, 10);
          lastAutoScrollX = x;
          lastAutoScrollY = y;
        }
      } else {
        if (!this.options.bubbleScroll || getParentAutoScrollElement(elem, true) === getWindowScrollingElement()) {
          clearAutoScrolls();
          return;
        }
        autoScroll(evt, this.options, getParentAutoScrollElement(elem, false), false);
      }
    }
  };
  return _extends(AutoScroll, {
    pluginName: "scroll",
    initializeByDefault: true
  });
}
function clearAutoScrolls() {
  autoScrolls.forEach(function(autoScroll2) {
    clearInterval(autoScroll2.pid);
  });
  autoScrolls = [];
}
function clearPointerElemChangedInterval() {
  clearInterval(pointerElemChangedInterval);
}
var autoScroll = throttle(function(evt, options, rootEl2, isFallback) {
  if (!options.scroll) return;
  var x = (evt.touches ? evt.touches[0] : evt).clientX, y = (evt.touches ? evt.touches[0] : evt).clientY, sens = options.scrollSensitivity, speed = options.scrollSpeed, winScroller = getWindowScrollingElement();
  var scrollThisInstance = false, scrollCustomFn;
  if (scrollRootEl !== rootEl2) {
    scrollRootEl = rootEl2;
    clearAutoScrolls();
    scrollEl = options.scroll;
    scrollCustomFn = options.scrollFn;
    if (scrollEl === true) {
      scrollEl = getParentAutoScrollElement(rootEl2, true);
    }
  }
  var layersOut = 0;
  var currentParent = scrollEl;
  do {
    var el = currentParent, rect = getRect(el), top = rect.top, bottom = rect.bottom, left = rect.left, right = rect.right, width = rect.width, height = rect.height, canScrollX = void 0, canScrollY = void 0, scrollWidth = el.scrollWidth, scrollHeight = el.scrollHeight, elCSS = css(el), scrollPosX = el.scrollLeft, scrollPosY = el.scrollTop;
    if (el === winScroller) {
      canScrollX = width < scrollWidth && (elCSS.overflowX === "auto" || elCSS.overflowX === "scroll" || elCSS.overflowX === "visible");
      canScrollY = height < scrollHeight && (elCSS.overflowY === "auto" || elCSS.overflowY === "scroll" || elCSS.overflowY === "visible");
    } else {
      canScrollX = width < scrollWidth && (elCSS.overflowX === "auto" || elCSS.overflowX === "scroll");
      canScrollY = height < scrollHeight && (elCSS.overflowY === "auto" || elCSS.overflowY === "scroll");
    }
    var vx = canScrollX && (Math.abs(right - x) <= sens && scrollPosX + width < scrollWidth) - (Math.abs(left - x) <= sens && !!scrollPosX);
    var vy = canScrollY && (Math.abs(bottom - y) <= sens && scrollPosY + height < scrollHeight) - (Math.abs(top - y) <= sens && !!scrollPosY);
    if (!autoScrolls[layersOut]) {
      for (var i = 0; i <= layersOut; i++) {
        if (!autoScrolls[i]) {
          autoScrolls[i] = {};
        }
      }
    }
    if (autoScrolls[layersOut].vx != vx || autoScrolls[layersOut].vy != vy || autoScrolls[layersOut].el !== el) {
      autoScrolls[layersOut].el = el;
      autoScrolls[layersOut].vx = vx;
      autoScrolls[layersOut].vy = vy;
      clearInterval(autoScrolls[layersOut].pid);
      if (vx != 0 || vy != 0) {
        scrollThisInstance = true;
        autoScrolls[layersOut].pid = setInterval(function() {
          if (isFallback && this.layer === 0) {
            Sortable.active._onTouchMove(touchEvt$1);
          }
          var scrollOffsetY = autoScrolls[this.layer].vy ? autoScrolls[this.layer].vy * speed : 0;
          var scrollOffsetX = autoScrolls[this.layer].vx ? autoScrolls[this.layer].vx * speed : 0;
          if (typeof scrollCustomFn === "function") {
            if (scrollCustomFn.call(Sortable.dragged.parentNode[expando], scrollOffsetX, scrollOffsetY, evt, touchEvt$1, autoScrolls[this.layer].el) !== "continue") {
              return;
            }
          }
          scrollBy(autoScrolls[this.layer].el, scrollOffsetX, scrollOffsetY);
        }.bind({
          layer: layersOut
        }), 24);
      }
    }
    layersOut++;
  } while (options.bubbleScroll && currentParent !== winScroller && (currentParent = getParentAutoScrollElement(currentParent, false)));
  scrolling = scrollThisInstance;
}, 30);
var drop = function drop2(_ref) {
  var originalEvent = _ref.originalEvent, putSortable2 = _ref.putSortable, dragEl2 = _ref.dragEl, activeSortable = _ref.activeSortable, dispatchSortableEvent = _ref.dispatchSortableEvent, hideGhostForTarget = _ref.hideGhostForTarget, unhideGhostForTarget = _ref.unhideGhostForTarget;
  if (!originalEvent) return;
  var toSortable = putSortable2 || activeSortable;
  hideGhostForTarget();
  var touch = originalEvent.changedTouches && originalEvent.changedTouches.length ? originalEvent.changedTouches[0] : originalEvent;
  var target = document.elementFromPoint(touch.clientX, touch.clientY);
  unhideGhostForTarget();
  if (toSortable && !toSortable.el.contains(target)) {
    dispatchSortableEvent("spill");
    this.onSpill({
      dragEl: dragEl2,
      putSortable: putSortable2
    });
  }
};
function Revert() {
}
Revert.prototype = {
  startIndex: null,
  dragStart: function dragStart(_ref2) {
    var oldDraggableIndex2 = _ref2.oldDraggableIndex;
    this.startIndex = oldDraggableIndex2;
  },
  onSpill: function onSpill(_ref3) {
    var dragEl2 = _ref3.dragEl, putSortable2 = _ref3.putSortable;
    this.sortable.captureAnimationState();
    if (putSortable2) {
      putSortable2.captureAnimationState();
    }
    var nextSibling = getChild(this.sortable.el, this.startIndex, this.options);
    if (nextSibling) {
      this.sortable.el.insertBefore(dragEl2, nextSibling);
    } else {
      this.sortable.el.appendChild(dragEl2);
    }
    this.sortable.animateAll();
    if (putSortable2) {
      putSortable2.animateAll();
    }
  },
  drop
};
_extends(Revert, {
  pluginName: "revertOnSpill"
});
function Remove() {
}
Remove.prototype = {
  onSpill: function onSpill2(_ref4) {
    var dragEl2 = _ref4.dragEl, putSortable2 = _ref4.putSortable;
    var parentSortable = putSortable2 || this.sortable;
    parentSortable.captureAnimationState();
    dragEl2.parentNode && dragEl2.parentNode.removeChild(dragEl2);
    parentSortable.animateAll();
  },
  drop
};
_extends(Remove, {
  pluginName: "removeOnSpill"
});
Sortable.mount(new AutoScrollPlugin());
Sortable.mount(Remove, Revert);
var sortable_esm_default = Sortable;

// src/task-list/task-list-renderer.ts
var TASK_LIST_TITLE_CHARACTER_LIMIT = 100;
var taskTitleSegmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter(void 0, { granularity: "grapheme" }) : null;
function* titleGraphemes(title) {
  if (taskTitleSegmenter) {
    for (const { segment } of taskTitleSegmenter.segment(title)) yield segment;
    return;
  }
  yield* title;
}
function taskListTitleText(title, limit = TASK_LIST_TITLE_CHARACTER_LIMIT) {
  const visible = [];
  for (const segment of titleGraphemes(title)) {
    if (visible.length === limit) return `${visible.join("")}\u2026`;
    visible.push(segment);
  }
  return title;
}
function appendElement(parent, tag, options = {}) {
  const element2 = parent.ownerDocument.createElement(tag);
  if (options.className) element2.className = options.className;
  if (options.text !== void 0) element2.textContent = options.text;
  Object.entries(options.attributes ?? {}).forEach(([name, value]) => element2.setAttribute(name, value));
  parent.append(element2);
  return element2;
}
function renderRow(list, row, selectionMode, copy, signal, dispatch) {
  const task = appendElement(list, "div", {
    className: `taskmate-task${row.completed ? " is-completed" : ""}${row.selected ? " is-selected" : ""}`,
    attributes: { role: "listitem", "aria-selected": String(row.selected) }
  });
  task.dataset.taskId = row.id;
  if (selectionMode) {
    task.addEventListener("click", (event) => {
      if (event.target.closest("input")) return;
      void dispatch({ type: "toggle-selected", taskId: row.id });
    }, { signal });
  }
  if (selectionMode) {
    const selection = appendElement(task, "input", {
      className: "taskmate-select-task",
      attributes: { type: "checkbox", "aria-label": copy.selectAriaLabel(row.title) }
    });
    selection.checked = row.selected;
    selection.addEventListener("change", () => {
      void dispatch({ type: "toggle-selected", taskId: row.id });
    }, { signal });
  } else {
    const checkbox = appendElement(task, "input", {
      attributes: { type: "checkbox", "aria-label": copy.completeAriaLabel(row.title) }
    });
    checkbox.checked = row.completed;
    checkbox.addEventListener("change", () => {
      void dispatch({ type: "toggle-completed", taskId: row.id, completed: checkbox.checked });
    }, { signal });
  }
  const body = appendElement(task, "div", { className: "taskmate-task-body" });
  const title = appendElement(body, "button", {
    className: "taskmate-title",
    text: taskListTitleText(row.title),
    attributes: { type: "button", "aria-label": row.title }
  });
  title.addEventListener("click", () => {
    if (!selectionMode) void dispatch({ type: "open", taskId: row.id });
  }, { signal });
  const metadata = appendElement(body, "div", { className: "taskmate-metadata" });
  if (row.date) appendElement(metadata, "span", { text: row.date });
  if (row.priority) appendElement(metadata, "span", {
    text: `P${row.priority}`,
    className: `taskmate-priority taskmate-priority-${row.priority}`
  });
  if (row.projectName) appendElement(metadata, "span", { text: row.projectName });
  const labels = summarizeLabels(row.labels);
  labels.visible.forEach((label) => appendElement(metadata, "span", { text: `#${label}` }));
  if (labels.hidden.length > 0) {
    const extra = appendElement(metadata, "span", { className: "taskmate-extra-labels" });
    extra.hidden = true;
    labels.hidden.forEach((label) => appendElement(extra, "span", { text: `#${label}` }));
    const toggle = appendElement(metadata, "button", {
      className: "taskmate-label-overflow-toggle",
      text: copy.moreLabels(labels.hidden.length),
      attributes: {
        type: "button",
        "aria-expanded": "false",
        "aria-label": copy.moreLabelsAriaLabel(labels.hidden.length)
      }
    });
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      extra.hidden = expanded;
      toggle.setAttribute("aria-expanded", String(!expanded));
      toggle.setAttribute("aria-label", expanded ? copy.moreLabelsAriaLabel(labels.hidden.length) : copy.hideExtraLabels);
      toggle.textContent = expanded ? copy.moreLabels(labels.hidden.length) : copy.hideExtraLabels;
    }, { signal });
  }
}
function renderTaskList(container, model, copy, dispatch) {
  const AbortControllerClass = container.ownerDocument.defaultView?.AbortController ?? AbortController;
  const controller = new AbortControllerClass();
  const list = appendElement(container, "div", {
    className: `taskmate-list${model.grouping === "scheduled" ? " taskmate-scheduled-list" : ""}${model.selectionMode ? " is-selection-mode" : ""}${model.reorderEnabled ? " is-reorder-enabled" : ""}`,
    attributes: { role: "list" }
  });
  const rowCount = model.sections.reduce((count, section) => count + section.rows.length, 0);
  if (rowCount === 0) {
    appendElement(list, "div", { className: "taskmate-empty", text: copy.empty });
    return { destroy: () => controller.abort() };
  }
  model.sections.forEach((section) => {
    if (section.id !== "default") {
      appendElement(list, "div", {
        className: `taskmate-task-section-heading is-${section.id}`,
        text: copy.sectionTitles[section.id],
        attributes: { role: "heading", "aria-level": "3" }
      });
    }
    section.rows.forEach((row) => renderRow(list, row, model.selectionMode, copy, controller.signal, dispatch));
  });
  const sortable = sortable_esm_default.create(list, {
    animation: 140,
    handle: ".taskmate-task-body",
    draggable: ".taskmate-task",
    filter: ".taskmate-label-overflow-toggle",
    preventOnFilter: false,
    disabled: !model.reorderEnabled,
    delay: 250,
    delayOnTouchOnly: true,
    touchStartThreshold: 4,
    onEnd: (event) => {
      if (event.oldIndex === event.newIndex) return;
      const orderedIds = Array.from(list.querySelectorAll(".taskmate-task")).map((element2) => element2.dataset.taskId ?? "");
      const taskId = event.item.dataset.taskId ?? "";
      const newIndex2 = orderedIds.indexOf(taskId);
      if (!taskId || newIndex2 < 0) return;
      void dispatch({
        type: "reorder",
        taskId,
        previousId: orderedIds[newIndex2 - 1] || null,
        nextId: orderedIds[newIndex2 + 1] || null
      });
    }
  });
  return {
    destroy() {
      controller.abort();
      sortable.destroy();
    }
  };
}

// src/task-editor/task-modal.ts
var import_obsidian11 = require("obsidian");

// src/tasks/task-title.ts
function normalizeTaskTitleInput(value) {
  return value.replace(/[ \t]*(?:\r\n?|\n)+[ \t]*/g, " ");
}

// src/tasks/task-steps.ts
function moveTaskStep(steps, from, to) {
  const reordered = steps.map((step) => ({ ...step }));
  if (from < 0 || from >= steps.length || to < 0 || to >= steps.length || from === to) return reordered;
  const [moved2] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved2);
  return reordered;
}
function stepDateState(date, today) {
  if (!date) return "none";
  if (date < today) return "overdue";
  if (date === today) return "today";
  return "later";
}

// src/task-editor/step-modal.ts
var import_obsidian10 = require("obsidian");
var StepModal = class extends import_obsidian10.Modal {
  constructor(app, step, availableRegion, i18n, onSave, onDelete = null) {
    super(app);
    this.availableRegion = availableRegion;
    this.i18n = i18n;
    this.onSave = onSave;
    this.onDelete = onDelete;
    this.baselineAvailableHeight = availableRegion.getBoundingClientRect().height;
    this.draft = step ? { ...step } : { text: String(), completed: false, date: null };
    this.setTitle(i18n.t(step ? "stepModal.editTitle" : "stepModal.addTitle"));
  }
  draft;
  keyboardScroller = null;
  baselineAvailableHeight;
  onOpen() {
    const { t } = this.i18n;
    this.modalEl.addClass("taskmate-step-modal");
    const fields = this.contentEl.createDiv({ cls: "taskmate-step-modal-fields" });
    const titleSetting = new import_obsidian10.Setting(fields).setName(t("stepModal.title"));
    titleSetting.addText((text) => {
      text.inputEl.setAttribute("aria-label", t("stepModal.title"));
      text.setPlaceholder(t("stepModal.titlePlaceholder")).setValue(this.draft.text).onChange((value) => {
        this.draft.text = value;
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });
    const dateSetting = new import_obsidian10.Setting(fields).setName(t("stepModal.date"));
    dateSetting.addText((text) => {
      text.inputEl.type = "date";
      text.inputEl.setAttribute("aria-label", t("stepModal.date"));
      text.setValue(this.draft.date ?? "").onChange((value) => {
        this.draft.date = value || null;
      });
    });
    const actions = this.contentEl.createDiv({ cls: "taskmate-modal-actions" });
    if (this.onDelete) {
      const remove = actions.createEl("button", { cls: "taskmate-delete-task" });
      (0, import_obsidian10.setIcon)(remove, "trash-2");
      remove.createSpan({ text: t("common.delete") });
      remove.addEventListener("click", () => {
        this.onDelete?.();
        this.close();
      });
    }
    const ordinaryActions = actions.createDiv({ cls: "taskmate-modal-primary-actions" });
    const cancel = ordinaryActions.createEl("button", { text: t("common.cancel") });
    cancel.addEventListener("click", () => this.close());
    const save2 = ordinaryActions.createEl("button", {
      text: t(this.onDelete ? "common.save" : "stepModal.add"),
      cls: "mod-cta"
    });
    save2.addEventListener("click", () => {
      const [normalized] = normalizeTaskSteps([this.draft]);
      if (!normalized) return;
      this.onSave(normalized);
      this.close();
    });
    this.keyboardScroller = new MobileKeyboardScroller(
      fields,
      this.modalEl,
      this.availableRegion,
      this.baselineAvailableHeight
    );
    this.keyboardScroller.connect();
  }
  onClose() {
    this.keyboardScroller?.disconnect();
    this.keyboardScroller = null;
    this.contentEl.empty();
  }
};

// src/task-editor/task-modal.ts
var DATE_SUGGESTION_KEYS2 = {
  today: "date.today",
  tomorrow: "date.tomorrow",
  "seven-days": "date.sevenDays",
  none: "date.none"
};
function decorateField2(setting, icon, accessibleName) {
  setting.settingEl.addClass("taskmate-compact-setting");
  const marker = document.createElement("span");
  marker.addClass("taskmate-field-icon");
  marker.setAttribute("aria-hidden", "true");
  (0, import_obsidian11.setIcon)(marker, icon);
  setting.settingEl.prepend(marker);
  setting.controlEl.setAttribute("aria-label", accessibleName);
}
function addEmbeddedLabel2(setting, label) {
  setting.controlEl.addClass("taskmate-embedded-select");
  const labelEl = setting.controlEl.createSpan({
    text: label,
    cls: "taskmate-embedded-field-label",
    attr: { "aria-hidden": "true" }
  });
  setting.controlEl.prepend(labelEl);
}
var TaskModal = class extends import_obsidian11.Modal {
  constructor(app, task, projects, labelOptions, defaultProjectId, availableRegion, i18n, onSave, onDelete = null) {
    super(app);
    this.projects = projects;
    this.labelOptions = labelOptions;
    this.availableRegion = availableRegion;
    this.i18n = i18n;
    this.onSave = onSave;
    this.onDelete = onDelete;
    this.baselineAvailableHeight = availableRegion.getBoundingClientRect().height;
    this.draft = {
      title: task?.title ?? "",
      date: task?.date ?? null,
      priority: task?.priority ?? null,
      labels: task?.labels ?? [],
      projectId: task?.projectId ?? defaultProjectId,
      steps: task?.steps.map((step) => ({ ...step })) ?? [],
      notes: task?.notes ?? "",
      sourceNote: task?.sourceNote ?? null
    };
    this.setTitle(task ? i18n.t("taskModal.editTitle") : i18n.t("taskModal.addTitle"));
  }
  draft;
  keyboardScroller = null;
  stepSortable = null;
  baselineAvailableHeight;
  onOpen() {
    const { contentEl } = this;
    const { t } = this.i18n;
    this.modalEl.addClass("taskmate-task-modal");
    const fields = contentEl.createDiv({ cls: "taskmate-task-fields" });
    const titleSetting = new import_obsidian11.Setting(fields).setName(t("taskModal.title"));
    titleSetting.settingEl.addClass("taskmate-title-setting");
    decorateField2(titleSetting, "circle-check", t("taskModal.title"));
    titleSetting.addTextArea((text) => {
      const titleInput = text.inputEl;
      titleInput.rows = 3;
      titleInput.wrap = "soft";
      titleInput.setAttribute("aria-label", t("taskModal.title"));
      const resizeTitleInput = () => {
        titleInput.style.height = "auto";
        titleInput.style.height = `${titleInput.scrollHeight}px`;
      };
      text.setPlaceholder(t("taskModal.titlePlaceholder")).setValue(this.draft.title).onChange((value) => {
        const normalized = normalizeTaskTitleInput(value);
        if (normalized !== value) titleInput.value = normalized;
        this.draft.title = normalized;
        resizeTitleInput();
      });
      titleInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") event.preventDefault();
      });
      window.requestAnimationFrame(resizeTitleInput);
      if (!window.matchMedia("(max-width: 700px)").matches) {
        window.setTimeout(() => titleInput.focus(), 0);
      }
    });
    const dateSetting = new import_obsidian11.Setting(fields).setName(t("taskModal.date"));
    dateSetting.settingEl.addClass("taskmate-date-setting");
    decorateField2(dateSetting, "calendar-days", t("taskModal.date"));
    const datePresets = dateSetting.controlEl.createDiv({ cls: "taskmate-date-presets" });
    const dateButtons = [];
    let dateInput;
    const refreshDateSelection = () => {
      for (const button2 of dateButtons) {
        const selected = button2.dataset.date === (this.draft.date ?? "");
        button2.toggleClass("is-active", selected);
        button2.setAttribute("aria-pressed", String(selected));
      }
    };
    for (const suggestion of taskDateSuggestions()) {
      const button2 = datePresets.createEl("button", {
        cls: "taskmate-suggestion-chip",
        attr: { type: "button", "aria-pressed": "false" }
      });
      button2.dataset.date = suggestion.date ?? "";
      button2.createSpan({ text: t(DATE_SUGGESTION_KEYS2[suggestion.id]) });
      button2.addEventListener("click", () => {
        this.draft.date = suggestion.date;
        dateInput.value = suggestion.date ?? "";
        refreshDateSelection();
      });
      dateButtons.push(button2);
    }
    dateSetting.addText((text) => {
      text.inputEl.type = "date";
      text.inputEl.addClass("taskmate-date-input");
      text.inputEl.setAttribute("aria-label", t("taskModal.date"));
      dateInput = text.inputEl;
      text.setValue(this.draft.date ?? "").onChange((value) => {
        this.draft.date = value || null;
        refreshDateSelection();
      });
    });
    refreshDateSelection();
    const projectSetting = new import_obsidian11.Setting(fields).setName(t("taskModal.project"));
    decorateField2(projectSetting, "folder", t("taskModal.project"));
    addEmbeddedLabel2(projectSetting, t("taskModal.project"));
    projectSetting.addDropdown((dropdown) => {
      dropdown.selectEl.setAttribute("aria-label", t("taskModal.project"));
      dropdown.addOption("", t("taskModal.unassigned"));
      for (const project of this.projects) dropdown.addOption(project.id, project.name);
      dropdown.setValue(this.draft.projectId ?? "").onChange((value) => {
        this.draft.projectId = value || null;
      });
    });
    const prioritySetting = new import_obsidian11.Setting(fields).setName(t("taskModal.priority"));
    decorateField2(prioritySetting, "flag", t("taskModal.priority"));
    addEmbeddedLabel2(prioritySetting, t("taskModal.priority"));
    prioritySetting.addDropdown((dropdown) => {
      dropdown.selectEl.setAttribute("aria-label", t("taskModal.priority"));
      dropdown.addOption("", t("taskModal.noPriority")).addOption("1", t("filter.priorityValue", { priority: 1 })).addOption("2", t("filter.priorityValue", { priority: 2 })).addOption("3", t("filter.priorityValue", { priority: 3 })).setValue(this.draft.priority ? String(this.draft.priority) : "").onChange((value) => {
        this.draft.priority = value ? Number(value) : null;
      });
    });
    const labelSetting = new import_obsidian11.Setting(fields).setName(t("taskModal.labels")).setDesc(t("taskModal.labelsDescription"));
    labelSetting.settingEl.addClass("taskmate-label-setting");
    decorateField2(labelSetting, "tags", t("taskModal.labels"));
    const labelEntryRow = labelSetting.controlEl.createDiv({ cls: "taskmate-label-entry-row" });
    const labelEditor = labelEntryRow.createDiv({
      cls: "taskmate-editor-label-summary taskmate-label-chip-editor"
    });
    const labelInput = labelEditor.createEl("input", {
      type: "text",
      cls: "taskmate-label-chip-input",
      placeholder: t("taskModal.labelsPlaceholder"),
      attr: {
        "aria-label": t("taskModal.labels"),
        enterkeyhint: "enter"
      }
    });
    const addLabel = labelEntryRow.createEl("button", {
      text: t("taskModal.addLabel"),
      cls: "taskmate-label-add",
      attr: {
        type: "button",
        "aria-label": t("taskModal.addLabelAriaLabel")
      }
    });
    let pendingLabelInput = "";
    let labelInputComposing = false;
    let labelsExpanded = false;
    const refreshLabelEditor = () => {
      labelEditor.querySelectorAll("[data-taskmate-label-chip], .taskmate-label-overflow-toggle").forEach((element2) => element2.remove());
      const summary = summarizeLabels(this.draft.labels);
      const visible = labelsExpanded ? this.draft.labels : summary.visible;
      for (const label of visible) {
        const chip = document.createElement("span");
        chip.addClass("taskmate-editor-label-chip");
        chip.dataset.taskmateLabelChip = label;
        chip.createSpan({ text: label });
        const remove = chip.createEl("button", {
          cls: "taskmate-label-chip-remove",
          attr: {
            type: "button",
            "aria-label": t("taskModal.removeLabelAriaLabel", { label })
          }
        });
        (0, import_obsidian11.setIcon)(remove, "x");
        remove.addEventListener("click", () => {
          this.draft.labels = this.draft.labels.filter((item) => item !== label);
          if (this.draft.labels.length <= 3) labelsExpanded = false;
          refreshLabelEditor();
        });
        labelEditor.insertBefore(chip, labelInput);
      }
      if (summary.hidden.length > 0) {
        const toggle = document.createElement("button");
        toggle.addClass("taskmate-label-overflow-toggle");
        toggle.type = "button";
        toggle.textContent = labelsExpanded ? t("tasks.hideExtraLabels") : t("tasks.moreLabels", { count: summary.hidden.length });
        toggle.setAttribute("aria-expanded", String(labelsExpanded));
        toggle.setAttribute("aria-label", labelsExpanded ? t("tasks.hideExtraLabels") : t("tasks.moreLabelsAriaLabel", { count: summary.hidden.length }));
        toggle.addEventListener("click", () => {
          labelsExpanded = !labelsExpanded;
          refreshLabelEditor();
        });
        labelEditor.insertBefore(toggle, labelInput);
      }
      addLabel.disabled = pendingLabelInput.trim().length === 0;
    };
    const updateFromInput = (commitPending, keepFocus) => {
      const next = updateLabelChipInput(this.draft.labels, labelInput.value, commitPending);
      this.draft.labels = next.labels;
      pendingLabelInput = next.pending;
      labelInput.value = pendingLabelInput;
      refreshLabelEditor();
      if (keepFocus) window.requestAnimationFrame(() => labelInput.focus({ preventScroll: true }));
    };
    labelInput.addEventListener("compositionstart", () => {
      labelInputComposing = true;
    });
    labelInput.addEventListener("compositionend", () => {
      labelInputComposing = false;
      updateFromInput(false, false);
    });
    labelInput.addEventListener("input", (event) => {
      pendingLabelInput = labelInput.value;
      addLabel.disabled = pendingLabelInput.trim().length === 0;
      if (labelInputComposing || event.isComposing) return;
      updateFromInput(false, false);
    });
    labelInput.addEventListener("keydown", (event) => {
      if (!shouldCommitLabelOnEnter(event.key, labelInputComposing || event.isComposing, event.keyCode)) return;
      event.preventDefault();
      updateFromInput(true, true);
    });
    addLabel.addEventListener("pointerdown", (event) => event.preventDefault());
    addLabel.addEventListener("click", () => updateFromInput(true, true));
    const chooseLabels = labelSetting.controlEl.createEl("button", {
      text: t("taskModal.chooseLabels"),
      cls: "taskmate-editor-label-picker-open",
      attr: {
        type: "button",
        "aria-label": t("taskModal.chooseExistingLabelsAriaLabel"),
        title: t("taskModal.chooseExistingLabelsAriaLabel")
      }
    });
    chooseLabels.addEventListener("click", () => {
      new LabelPickerModal(this.app, {
        selectedLabels: this.draft.labels,
        allLabels: this.labelOptions.allLabels,
        recentLabels: this.labelOptions.recentLabels,
        favoriteLabels: this.labelOptions.favoriteLabels,
        preserveUnavailableSelectedLabels: true,
        i18n: this.i18n,
        onConfirm: async (selected, favorites) => {
          this.draft.labels = selected.slice(0, 500);
          labelsExpanded = false;
          refreshLabelEditor();
          this.labelOptions.favoriteLabels = favorites;
          await this.labelOptions.onFavoriteLabelsChange(favorites);
        }
      }).open();
    });
    refreshLabelEditor();
    const stepsSetting = new import_obsidian11.Setting(fields).setName(t("taskModal.steps"));
    stepsSetting.settingEl.addClass("taskmate-steps-setting");
    decorateField2(stepsSetting, "list-checks", t("taskModal.steps"));
    const stepsEditor = stepsSetting.controlEl.createDiv({ cls: "taskmate-steps-editor" });
    const stepsHeader = stepsEditor.createDiv({ cls: "taskmate-steps-header" });
    stepsHeader.createSpan({ text: t("taskModal.steps") });
    const stepsCount = stepsHeader.createSpan({ cls: "taskmate-steps-count" });
    const stepsList = stepsEditor.createDiv({ cls: "taskmate-steps-list" });
    const addStep = stepsEditor.createEl("button", { text: t("taskModal.addStep"), cls: "taskmate-add-step", attr: { type: "button" } });
    const renderSteps = () => {
      this.stepSortable?.destroy();
      this.stepSortable = null;
      stepsList.empty();
      const completedCount = this.draft.steps.filter((step) => step.completed).length;
      stepsCount.textContent = t("taskModal.stepProgress", { completed: completedCount, total: this.draft.steps.length });
      this.draft.steps.forEach((step, index2) => {
        const row = stepsList.createDiv({ cls: "taskmate-step-row" });
        row.dataset.stepIndex = String(index2);
        row.toggleClass("is-completed", step.completed);
        const completed = row.createEl("input", { type: "checkbox", cls: "taskmate-step-completed", attr: { "aria-label": t("taskModal.stepCompletedAriaLabel", { step: index2 + 1 }) } });
        completed.checked = step.completed;
        completed.addEventListener("change", () => {
          step.completed = completed.checked;
          row.toggleClass("is-completed", step.completed);
          const nextCompletedCount = this.draft.steps.filter((item) => item.completed).length;
          stepsCount.textContent = t("taskModal.stepProgress", { completed: nextCompletedCount, total: this.draft.steps.length });
        });
        const body = row.createEl("button", {
          cls: "taskmate-step-body",
          attr: { type: "button", "aria-label": t("taskModal.editStepAriaLabel", { title: step.text }) }
        });
        body.createDiv({ text: step.text, cls: "taskmate-step-title" });
        const dateState = stepDateState(step.date, todayKey());
        const dateText = step.date ? `${step.date}${dateState === "overdue" ? ` \xB7 ${t("taskModal.stepOverdue")}` : dateState === "today" ? ` \xB7 ${t("taskModal.stepDueToday")}` : ""}` : t("date.none");
        body.createDiv({ text: dateText, cls: `taskmate-step-metadata${dateState === "overdue" ? " is-overdue" : ""}` });
        body.addEventListener("click", () => {
          new StepModal(this.app, step, this.availableRegion, this.i18n, (updated) => {
            this.draft.steps[index2] = updated;
            renderSteps();
          }, () => {
            this.draft.steps.splice(index2, 1);
            renderSteps();
          }).open();
        });
        const disclosure = row.createSpan({ cls: "taskmate-step-disclosure", attr: { "aria-hidden": "true" } });
        (0, import_obsidian11.setIcon)(disclosure, "chevron-right");
      });
      if (this.draft.steps.length > 1) {
        this.stepSortable = sortable_esm_default.create(stepsList, {
          animation: 140,
          handle: ".taskmate-step-body",
          draggable: ".taskmate-step-row",
          delay: 250,
          delayOnTouchOnly: true,
          touchStartThreshold: 4,
          onEnd: (event) => {
            if (event.oldIndex === void 0 || event.newIndex === void 0 || event.oldIndex === event.newIndex) return;
            this.draft.steps = moveTaskStep(this.draft.steps, event.oldIndex, event.newIndex);
            renderSteps();
          }
        });
      }
    };
    addStep.addEventListener("click", () => {
      new StepModal(this.app, null, this.availableRegion, this.i18n, (step) => {
        this.draft.steps.push(step);
        renderSteps();
      }).open();
    });
    renderSteps();
    const notesSetting = new import_obsidian11.Setting(fields).setName(t("taskModal.notes"));
    notesSetting.settingEl.addClass("taskmate-notes-setting");
    decorateField2(notesSetting, "notebook-pen", t("taskModal.notes"));
    notesSetting.addTextArea((area) => {
      area.inputEl.rows = 7;
      area.inputEl.setAttribute("aria-label", t("taskModal.notes"));
      area.inputEl.placeholder = t("taskModal.notes");
      area.setValue(this.draft.notes).onChange((value) => {
        this.draft.notes = value;
      });
    });
    const actions = contentEl.createDiv({ cls: "taskmate-modal-actions" });
    if (this.onDelete) {
      const remove = actions.createEl("button", { cls: "taskmate-delete-task" });
      (0, import_obsidian11.setIcon)(remove, "trash-2");
      remove.createSpan({ text: t("common.delete") });
      remove.addEventListener("click", async () => {
        if (!window.confirm(t("tasks.deleteConfirm", { title: this.draft.title }))) return;
        remove.disabled = true;
        try {
          if (await this.onDelete?.()) this.close();
        } finally {
          remove.disabled = false;
        }
      });
    }
    const ordinaryActions = actions.createDiv({ cls: "taskmate-modal-primary-actions" });
    const cancel = ordinaryActions.createEl("button", { text: t("common.cancel") });
    cancel.addEventListener("click", () => this.close());
    const save2 = ordinaryActions.createEl("button", { text: t("common.save"), cls: "mod-cta" });
    save2.addEventListener("click", async () => {
      if (!this.draft.title.trim()) return;
      updateFromInput(true, false);
      this.draft.steps = normalizeTaskSteps(this.draft.steps);
      save2.disabled = true;
      try {
        if (await this.onSave(this.draft)) this.close();
      } finally {
        save2.disabled = false;
      }
    });
    this.keyboardScroller = new MobileKeyboardScroller(
      fields,
      this.modalEl,
      this.availableRegion,
      this.baselineAvailableHeight
    );
    this.keyboardScroller.connect();
  }
  onClose() {
    this.stepSortable?.destroy();
    this.stepSortable = null;
    this.keyboardScroller?.disconnect();
    this.keyboardScroller = null;
    this.contentEl.empty();
  }
};

// src/task-list/task-filter-state.ts
var EMPTY_FILTERS = {
  priorities: [],
  labels: [],
  search: "",
  includeCompleted: false
};
var TaskFilterState = class {
  filters = { ...EMPTY_FILTERS };
  value() {
    return {
      priorities: [...this.filters.priorities],
      labels: [...this.filters.labels],
      search: "",
      includeCompleted: this.filters.includeCompleted
    };
  }
  replace(filters) {
    this.filters = {
      priorities: [...filters.priorities],
      labels: [...filters.labels],
      search: "",
      includeCompleted: filters.includeCompleted
    };
  }
  clear() {
    this.filters = { ...EMPTY_FILTERS };
  }
  count() {
    return this.filters.priorities.length + this.filters.labels.length + Number(this.filters.includeCompleted);
  }
};

// src/task-list/task-selection.ts
var TaskSelection = class {
  active = false;
  selected = /* @__PURE__ */ new Set();
  scope = /* @__PURE__ */ new Set();
  isActive() {
    return this.active;
  }
  selectedIds() {
    return this.selected;
  }
  selectedCount() {
    return this.selected.size;
  }
  scopeSize() {
    return this.scope.size;
  }
  selectedTasks(tasks) {
    return tasks.filter((task) => this.selected.has(task.id));
  }
  start(scopeIds) {
    this.scope = new Set(scopeIds);
    this.selected = /* @__PURE__ */ new Set();
    this.active = true;
  }
  toggle(id) {
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
  }
  toggleAll() {
    this.selected = this.selected.size === this.scope.size ? /* @__PURE__ */ new Set() : new Set(this.scope);
  }
  retainExisting(existingIds) {
    const existing = new Set(existingIds);
    this.scope = new Set([...this.scope].filter((id) => existing.has(id)));
    this.selected = new Set([...this.selected].filter((id) => this.scope.has(id)));
  }
  restrictTo(ids) {
    this.scope = new Set(ids);
    this.selected = new Set(this.scope);
  }
  exit() {
    this.active = false;
    this.selected = /* @__PURE__ */ new Set();
    this.scope = /* @__PURE__ */ new Set();
  }
};

// src/task-list/scroll-position.ts
var TASK_LIST_SCROLL_REGION = ".taskmate-scroll-region";
function captureTaskListScrollTop(root) {
  const region = root.querySelector(TASK_LIST_SCROLL_REGION);
  return region ? Math.max(0, region.scrollTop) : null;
}
function restoreTaskListScrollTop(root, scrollTop) {
  if (scrollTop === null) return;
  const region = root.querySelector(TASK_LIST_SCROLL_REGION);
  if (region) region.scrollTop = scrollTop;
}

// src/task-list/view.ts
var TODO_VIEW_TYPE = "taskmate-list";
var SMART_VIEW_KEYS = {
  scheduled: "view.scheduled",
  all: "view.all",
  unplanned: "view.unplanned"
};
var SORT_KEYS = {
  manual: "sort.manual",
  date: "sort.date",
  priority: "sort.priority",
  created: "sort.created"
};
var NAV_ITEMS = [
  { screen: "date", icon: "\u25F7", labelKey: "nav.date" },
  { screen: "search", icon: "\u2315", labelKey: "nav.search" },
  { screen: "projects", icon: "\u25A3", labelKey: "nav.projects" }
];
var TodoListView = class extends import_obsidian12.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  screen = "date";
  smartView = "scheduled";
  sortMode = "manual";
  sortDirection = "asc";
  searchQuery = "";
  filterState = new TaskFilterState();
  projectScreen = "index";
  activeProjectId = null;
  renderedTaskList = null;
  selection = new TaskSelection();
  generation = 0;
  getViewType() {
    return TODO_VIEW_TYPE;
  }
  getDisplayText() {
    return "TaskMate";
  }
  getIcon() {
    return "circle-check-big";
  }
  async onOpen() {
    await this.render();
  }
  async onClose() {
    this.destroyTaskList();
  }
  requestRender(options = {}) {
    const preservedScrollTop = options.preserveScroll ? captureTaskListScrollTop(this.contentEl) : null;
    void this.render(preservedScrollTop);
  }
  async render(preservedScrollTop = null) {
    const currentGeneration = ++this.generation;
    const [taskScan, projects] = await Promise.all([this.plugin.repository.scan(), this.plugin.projects.list()]);
    if (currentGeneration !== this.generation) return;
    const { tasks, identityConflicts } = taskScan;
    this.destroyTaskList();
    const root = this.contentEl;
    root.empty();
    root.addClass("taskmate-view");
    const page = root.createDiv({ cls: "taskmate-page" });
    if (this.selection.isActive()) this.renderSelectionToolbar(page, tasks);
    else this.renderNavigation(page);
    if (identityConflicts.length > 0) {
      const warning = page.createDiv({ cls: "taskmate-identity-conflict" });
      warning.createDiv({ text: this.plugin.i18n().t("conflict.identityBanner", { count: identityConflicts.length }) });
      for (const conflict of identityConflicts) {
        warning.createDiv({
          cls: "taskmate-identity-conflict-details",
          text: this.plugin.i18n().t("conflict.identityDetails", {
            id: conflict.id,
            paths: conflict.paths.join(", ")
          })
        });
      }
    }
    if (this.screen === "search") {
      this.renderSearchScreen(page, tasks, projects);
    } else if (this.screen === "date") {
      this.renderDateScreen(page, tasks, projects);
    } else {
      const content = page.createDiv({ cls: "taskmate-content taskmate-scroll-region" });
      this.renderProjectsScreen(content, tasks, projects);
    }
    restoreTaskListScrollTop(this.contentEl, preservedScrollTop);
  }
  renderHeader(container, title, addTaskProjectId, selectionScope) {
    const { t } = this.plugin.i18n();
    const header = container.createDiv({ cls: "taskmate-header" });
    header.createEl("h2", { text: title });
    if (!this.selection.isActive() && selectionScope) this.renderAdjustMenu(header, selectionScope);
    if (!this.selection.isActive() && addTaskProjectId !== void 0) {
      const add = header.createEl("button", { text: t("common.add"), cls: "mod-cta taskmate-add" });
      add.addEventListener("click", () => void this.openCreateTask(addTaskProjectId));
    }
    return header;
  }
  renderDateScreen(container, tasks, projects) {
    const { t } = this.plugin.i18n();
    const controls = container.createDiv({ cls: "taskmate-date-controls" });
    const visibleTasks = filterTasks(tasks, this.smartView, this.filterState.value());
    this.renderHeader(controls, "TaskMate", null, () => visibleTasks);
    const tabs = controls.createDiv({ cls: "taskmate-smart-views", attr: { role: "tablist" } });
    Object.keys(SMART_VIEW_KEYS).forEach((view) => {
      const button2 = tabs.createEl("button", {
        cls: view === this.smartView ? "is-active" : "",
        attr: { role: "tab", "aria-selected": String(view === this.smartView) }
      });
      button2.createSpan({ text: t(SMART_VIEW_KEYS[view]) });
      button2.addEventListener("click", () => {
        this.smartView = view;
        this.requestRender();
      });
      button2.disabled = this.selection.isActive();
    });
    this.renderSortControl(controls);
    if (this.smartView === "scheduled" && this.sortMode === "date") {
      controls.createDiv({
        text: t("sort.scheduledDateScope"),
        cls: "taskmate-sort-scope-note"
      });
    }
    const results = container.createDiv({ cls: "taskmate-date-results taskmate-scroll-region" });
    if (this.smartView === "scheduled") this.renderScheduledTaskList(results, visibleTasks, projects);
    else this.renderTaskList(results, visibleTasks, projects, true);
  }
  renderSearchScreen(container, tasks, projects) {
    const { t } = this.plugin.i18n();
    const controls = container.createDiv({ cls: "taskmate-search-controls" });
    const currentMatches = () => this.searchMatches(tasks, projects);
    this.renderHeader(controls, t("search.title"), void 0, currentMatches);
    const input = controls.createEl("input", {
      type: "text",
      value: this.searchQuery,
      placeholder: t("search.placeholder"),
      cls: "taskmate-search-input",
      attr: {
        "aria-label": t("search.ariaLabel"),
        "inputmode": "search",
        "enterkeyhint": "search"
      }
    });
    input.disabled = this.selection.isActive();
    const results = container.createDiv({ cls: "taskmate-search-results taskmate-scroll-region" });
    const updateResults = () => this.renderSearchResults(results, tasks, projects);
    let composing = false;
    input.addEventListener("compositionstart", () => {
      composing = true;
    });
    input.addEventListener("compositionend", () => {
      composing = false;
      this.searchQuery = input.value;
      updateResults();
    });
    input.addEventListener("input", (event) => {
      this.searchQuery = input.value;
      if (!composing && !event.isComposing) updateResults();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && this.searchQuery.trim()) void this.rememberSearch(this.searchQuery);
    });
    updateResults();
  }
  renderSearchResults(container, tasks, projects) {
    const { t } = this.plugin.i18n();
    this.destroyTaskList();
    container.empty();
    const recent = this.plugin.settings.recentSearches ?? [];
    if (!this.selection.isActive() && recent.length > 0) {
      const section = container.createDiv({ cls: "taskmate-section" });
      const heading = section.createDiv({ cls: "taskmate-section-heading" });
      heading.createEl("h3", { text: t("search.recent") });
      const clear = heading.createEl("button", { text: t("common.clear") });
      clear.addEventListener("click", async () => {
        this.plugin.settings.recentSearches = [];
        await this.plugin.saveSettings();
        this.requestRender();
      });
      const words = section.createDiv({ cls: "taskmate-recent-searches" });
      recent.forEach((word) => {
        const button2 = words.createEl("button", { text: word });
        button2.addEventListener("click", () => {
          this.searchQuery = word;
          this.requestRender();
        });
      });
    }
    const query = this.searchQuery.trim().toLocaleLowerCase();
    if (!query) {
      container.createDiv({ cls: "taskmate-empty", text: t("search.emptyQuery") });
      return;
    }
    const matches2 = this.searchMatches(tasks, projects);
    this.renderTaskList(container, matches2, projects, false);
  }
  renderProjectsScreen(container, tasks, projects) {
    const { t, locale } = this.plugin.i18n();
    const active = projects.find((project) => project.id === this.activeProjectId) ?? null;
    if (this.projectScreen !== "index" && !active) {
      this.projectScreen = "index";
      this.activeProjectId = null;
    }
    if (this.projectScreen === "detail" && active) {
      const visibleTasks = filterTasks(tasks.filter((task) => task.projectId === active.id), "all", this.filterState.value());
      const header2 = this.renderHeader(container, active.name, active.id, () => visibleTasks);
      if (!this.selection.isActive()) {
        this.addBackButton(header2, () => {
          this.projectScreen = "index";
          this.requestRender();
        });
        const edit = header2.createEl("button", { text: t("common.edit") });
        edit.addEventListener("click", () => {
          this.projectScreen = "edit";
          this.requestRender();
        });
      }
      this.renderSortControl(container);
      this.renderTaskList(container, visibleTasks, projects, true);
      return;
    }
    if (this.projectScreen === "edit" && active) {
      const header2 = this.renderHeader(container, t("projects.editTitle"));
      this.addBackButton(header2, () => {
        this.projectScreen = "detail";
        this.requestRender();
      });
      this.renderProjectEditor(container, active);
      return;
    }
    const header = this.renderHeader(container, t("projects.title"));
    const add = header.createEl("button", { text: t("common.add"), cls: "mod-cta" });
    add.addEventListener("click", () => this.openCreateProject());
    const recent = [...projects].filter((project) => project.lastUsedAt).sort((a, b) => (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "")).slice(0, 5);
    if (recent.length > 0) this.renderProjectList(container, t("projects.recent"), recent, tasks);
    this.renderProjectList(container, t("projects.all"), [...projects].sort((a, b) => compareDisplayText(a.name, b.name, locale)), tasks);
  }
  renderProjectList(container, title, projects, tasks) {
    const { t } = this.plugin.i18n();
    const section = container.createDiv({ cls: "taskmate-section" });
    section.createEl("h3", { text: title });
    if (projects.length === 0) {
      section.createDiv({ cls: "taskmate-empty-compact", text: t("projects.empty") });
      return;
    }
    const list = section.createDiv({ cls: "taskmate-project-list" });
    for (const project of projects) {
      const taskCount = tasks.filter((task) => !task.completed && task.projectId === project.id).length;
      const row = list.createDiv({ cls: "taskmate-project-row" });
      const open = row.createEl("button", { cls: "taskmate-project-open" });
      open.createSpan({ text: project.name });
      open.createSpan({
        text: taskCount === 1 ? t("projects.taskCountOne", { count: taskCount }) : t("projects.taskCount", { count: taskCount }),
        cls: "taskmate-project-count"
      });
      open.addEventListener("click", async () => {
        await this.plugin.projects.touch(project);
        this.activeProjectId = project.id;
        this.projectScreen = "detail";
        this.requestRender();
      });
      const edit = row.createEl("button", { text: t("common.edit"), cls: "taskmate-project-edit" });
      edit.addEventListener("click", () => {
        this.activeProjectId = project.id;
        this.projectScreen = "edit";
        this.requestRender();
      });
    }
  }
  renderProjectEditor(container, project) {
    const { t } = this.plugin.i18n();
    const panel = container.createDiv({ cls: "taskmate-project-editor" });
    const label = panel.createEl("label", { text: t("projects.name") });
    const input = label.createEl("input", { type: "text", value: project.name });
    const save2 = panel.createEl("button", { text: t("projects.saveName"), cls: "mod-cta" });
    save2.addEventListener("click", async () => {
      if (!input.value.trim()) return;
      await this.plugin.projects.update(project, { name: input.value.trim() });
      this.projectScreen = "detail";
      this.requestRender();
    });
    const remove = panel.createEl("button", { text: t("projects.delete"), cls: "mod-warning" });
    remove.addEventListener("click", async () => {
      if (!window.confirm(t("projects.deleteConfirm", { project: project.name }))) return;
      await this.plugin.repository.clearProject(project.id);
      await this.plugin.projects.remove(project);
      this.activeProjectId = null;
      this.projectScreen = "index";
      new import_obsidian12.Notice(t("projects.deletedNotice"));
      this.requestRender();
    });
  }
  renderSortControl(container) {
    const { t } = this.plugin.i18n();
    const controls = container.createDiv({ cls: "taskmate-sort" });
    controls.createDiv({ text: t("sort.label"), cls: "taskmate-sort-label" });
    const options = controls.createDiv({ cls: "taskmate-sort-options", attr: { role: "group", "aria-label": t("sort.ariaLabel") } });
    Object.keys(SORT_KEYS).forEach((mode) => {
      const selected = mode === this.sortMode;
      const directionLabel = this.sortDirection === "asc" ? t("sort.ascending") : t("sort.descending");
      const button2 = options.createEl("button", {
        cls: selected ? "is-active" : "",
        attr: {
          type: "button",
          "aria-pressed": String(selected),
          "aria-label": selected && mode !== "manual" ? t("sort.activeOptionAriaLabel", { mode: t(SORT_KEYS[mode]), direction: directionLabel }) : t(SORT_KEYS[mode])
        }
      });
      button2.createSpan({ text: t(SORT_KEYS[mode]) });
      if (selected && mode !== "manual") {
        button2.createSpan({ text: this.sortDirection === "asc" ? "\u2191" : "\u2193", cls: "taskmate-sort-direction", attr: { "aria-hidden": "true" } });
      }
      button2.addEventListener("click", () => {
        if (mode === this.sortMode && mode !== "manual") {
          this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
        } else {
          this.sortMode = mode;
          this.sortDirection = "asc";
        }
        this.requestRender();
      });
      button2.disabled = this.selection.isActive();
    });
  }
  renderTaskList(container, source, projects, allowReorder) {
    const model = buildTaskListModel({
      tasks: source,
      projects,
      grouping: "flat",
      sortMode: this.sortMode,
      sortDirection: this.sortDirection,
      allowReorder,
      selectionMode: this.selection.isActive(),
      selectedIds: this.selection.selectedIds()
    });
    this.mountTaskList(container, model, source);
  }
  renderScheduledTaskList(container, source, projects) {
    const model = buildTaskListModel({
      tasks: source,
      projects,
      grouping: "scheduled",
      sortMode: this.sortMode,
      sortDirection: this.sortDirection,
      allowReorder: true,
      selectionMode: this.selection.isActive(),
      selectedIds: this.selection.selectedIds()
    });
    this.mountTaskList(container, model, source);
  }
  taskListCopy() {
    const { t } = this.plugin.i18n();
    return {
      empty: t("tasks.empty"),
      completeAriaLabel: (title) => t("tasks.completeAriaLabel", { title }),
      selectAriaLabel: (title) => t("tasks.selectAriaLabel", { title }),
      moreLabels: (count) => t("tasks.moreLabels", { count }),
      moreLabelsAriaLabel: (count) => t("tasks.moreLabelsAriaLabel", { count }),
      hideExtraLabels: t("tasks.hideExtraLabels"),
      sectionTitles: {
        overdue: t("view.overdue"),
        today: t("view.today"),
        later: t("view.later")
      }
    };
  }
  mountTaskList(container, model, source) {
    this.destroyTaskList();
    const tasksById = new Map(source.map((task) => [task.id, task]));
    this.renderedTaskList = renderTaskList(
      container,
      model,
      this.taskListCopy(),
      (action) => this.handleTaskListAction(action, tasksById)
    );
  }
  destroyTaskList() {
    this.renderedTaskList?.destroy();
    this.renderedTaskList = null;
  }
  async handleTaskListAction(action, tasksById) {
    if (action.type === "reorder") {
      await this.plugin.repository.reorder(action.taskId, action.previousId, action.nextId);
      this.requestRender();
      return;
    }
    const task = tasksById.get(action.taskId);
    if (!task) return;
    if (action.type === "toggle-selected") {
      this.selection.toggle(task.id);
      this.requestRender({ preserveScroll: true });
      return;
    }
    if (action.type === "open") {
      await this.openEditTask(task);
      return;
    }
    if (action.type === "toggle-completed") {
      await this.plugin.repository.update(task, { completed: action.completed });
      this.requestRender();
      return;
    }
  }
  renderNavigation(root) {
    const { t } = this.plugin.i18n();
    const navigation = root.createDiv({ cls: "taskmate-navigation", attr: { "aria-label": t("nav.ariaLabel") } });
    NAV_ITEMS.forEach((item) => {
      const button2 = navigation.createEl("button", {
        cls: item.screen === this.screen ? "is-active" : "",
        attr: { "aria-current": item.screen === this.screen ? "page" : "false" }
      });
      button2.createSpan({ text: item.icon, cls: "taskmate-nav-icon" });
      button2.createSpan({ text: t(item.labelKey) });
      button2.addEventListener("click", () => {
        this.screen = item.screen;
        if (item.screen === "projects") this.projectScreen = "index";
        this.requestRender();
      });
    });
  }
  searchMatches(tasks, projects) {
    const query = this.searchQuery.trim().toLocaleLowerCase();
    if (!query) return [];
    const projectNames = new Map(projects.map((project) => [project.id, project.name.toLocaleLowerCase()]));
    const matches2 = tasks.filter((task) => {
      const text = `${task.title}
${task.notes}
${task.labels.join(" ")}
${projectNames.get(task.projectId ?? "") ?? ""}`.toLocaleLowerCase();
      return text.includes(query);
    });
    return filterTasks(matches2, "all", this.filterState.value());
  }
  renderAdjustMenu(header, selectionScope) {
    const { t } = this.plugin.i18n();
    const count = this.filterState.count();
    const button2 = header.createEl("button", {
      cls: `taskmate-adjust${count > 0 ? " is-active" : ""}`,
      attr: { "aria-label": count > 0 ? t("adjust.ariaLabelActive", { count }) : t("adjust.ariaLabel") }
    });
    (0, import_obsidian12.setIcon)(button2, "sliders-horizontal");
    if (count > 0) button2.createSpan({ text: String(count), cls: "taskmate-adjust-count" });
    button2.addEventListener("click", (event) => {
      const menu = new import_obsidian12.Menu();
      const scope = selectionScope();
      menu.addItem((item) => item.setTitle(t("selection.start")).setIcon("list-checks").setDisabled(scope.length === 0).onClick(() => {
        this.selection.start(scope.map((task) => task.id));
        this.requestRender({ preserveScroll: true });
      }));
      menu.addItem((item) => item.setTitle(count > 0 ? t("filter.change") : t("filter.title")).setIcon("list-filter").onClick(() => void this.openFilterModal()));
      menu.addItem((item) => item.setTitle(t("labelManager.menu")).setIcon("tags").onClick(() => void this.openLabelManager()));
      if (count > 0) {
        menu.addSeparator();
        menu.addItem((item) => item.setTitle(t("filter.clearActive")).setIcon("filter-x").onClick(() => this.clearActiveFilters()));
      }
      menu.showAtMouseEvent(event);
    });
  }
  renderSelectionToolbar(root, tasks) {
    const { t } = this.plugin.i18n();
    this.selection.retainExisting(tasks.map((task) => task.id));
    const toolbar = root.createDiv({ cls: "taskmate-selection-toolbar", attr: { "aria-label": t("selection.ariaLabel") } });
    const exit = toolbar.createEl("button", { text: `\xD7 ${t("selection.exit")}` });
    exit.addEventListener("click", () => this.exitSelectionMode());
    toolbar.createDiv({ text: t("selection.count", { count: this.selection.selectedCount() }), cls: "taskmate-selection-count" });
    const selectAll = toolbar.createEl("button", { text: t("selection.selectAll") });
    selectAll.disabled = this.selection.scopeSize() === 0;
    selectAll.addEventListener("click", () => {
      this.selection.toggleAll();
      this.requestRender({ preserveScroll: true });
    });
    const edit = toolbar.createEl("button", { text: t("common.edit") });
    edit.disabled = this.selection.selectedCount() === 0;
    edit.addEventListener("click", () => void this.editSelectedTasks(tasks));
    const remove = toolbar.createEl("button", { text: t("common.delete"), cls: "mod-warning" });
    remove.disabled = this.selection.selectedCount() === 0;
    remove.addEventListener("click", () => void this.deleteSelectedTasks(tasks));
  }
  exitSelectionMode() {
    this.selection.exit();
    this.requestRender({ preserveScroll: true });
  }
  async openFilterModal() {
    const i18n = this.plugin.i18n();
    const tasks = await this.plugin.repository.list();
    const incompleteTaskLabels = availableFilterLabels(tasks, false).sort((a, b) => compareDisplayText(a, b, i18n.locale)).slice(0, 500);
    const allTaskLabels = availableFilterLabels(tasks, true).sort((a, b) => compareDisplayText(a, b, i18n.locale)).slice(0, 500);
    new TaskFilterModal(
      this.app,
      this.filterState.value(),
      incompleteTaskLabels,
      allTaskLabels,
      this.plugin.settings.recentLabels ?? [],
      this.plugin.settings.favoriteLabels ?? [],
      i18n,
      async (favorites) => {
        this.plugin.settings.favoriteLabels = favorites;
        await this.plugin.saveSettings();
      },
      (filters) => {
        this.filterState.replace(filters);
        this.requestRender();
      }
    ).open();
  }
  async openLabelManager() {
    const tasks = await this.plugin.repository.list();
    const labels = buildManagedLabels(
      tasks,
      this.plugin.settings.recentLabels ?? [],
      this.plugin.settings.favoriteLabels ?? []
    );
    new LabelManagerModal(this.app, {
      labels,
      i18n: this.plugin.i18n(),
      onRename: async (from, to) => this.renameManagedLabel(tasks, from, to),
      onDelete: async (label) => this.deleteManagedLabel(tasks, label)
    }).open();
  }
  async renameManagedLabel(tasks, from, to) {
    const affected = tasks.filter((task) => task.labels.includes(from));
    const results = await Promise.allSettled(affected.map(
      (task) => this.plugin.repository.update(task, { labels: renameLabelValues(task.labels, from, to) })
    ));
    if (this.reportLabelWriteFailures(affected, results)) return;
    this.plugin.settings.recentLabels = renameLabelValues(this.plugin.settings.recentLabels ?? [], from, to);
    this.plugin.settings.favoriteLabels = renameLabelValues(this.plugin.settings.favoriteLabels ?? [], from, to);
    const filters = this.filterState.value();
    this.filterState.replace({ ...filters, labels: renameLabelValues(filters.labels, from, to) });
    await this.plugin.saveSettings();
    const { t } = this.plugin.i18n();
    new import_obsidian12.Notice(affected.length === 1 ? t("labelManager.renamedNoticeOne", { from, to, count: affected.length }) : t("labelManager.renamedNotice", { from, to, count: affected.length }));
    this.requestRender();
  }
  async deleteManagedLabel(tasks, label) {
    const affected = tasks.filter((task) => task.labels.includes(label));
    const results = await Promise.allSettled(affected.map(
      (task) => this.plugin.repository.update(task, { labels: removeLabelValue(task.labels, label) })
    ));
    if (this.reportLabelWriteFailures(affected, results)) return;
    this.plugin.settings.recentLabels = removeLabelValue(this.plugin.settings.recentLabels ?? [], label);
    this.plugin.settings.favoriteLabels = removeLabelValue(this.plugin.settings.favoriteLabels ?? [], label);
    const filters = this.filterState.value();
    this.filterState.replace({ ...filters, labels: removeLabelValue(filters.labels, label) });
    await this.plugin.saveSettings();
    const { t } = this.plugin.i18n();
    new import_obsidian12.Notice(affected.length === 1 ? t("labelManager.deletedNoticeOne", { label, count: affected.length }) : t("labelManager.deletedNotice", { label, count: affected.length }));
    this.requestRender();
  }
  reportLabelWriteFailures(tasks, results) {
    const failed = failedBulkTasks(tasks, results);
    if (failed.length === 0) return false;
    new import_obsidian12.Notice(this.plugin.i18n().t("labelManager.partialFailure", {
      failed: failed.length,
      total: tasks.length,
      paths: failed.map((task) => task.path).join(", ")
    }), 0);
    this.requestRender();
    return true;
  }
  clearActiveFilters() {
    this.filterState.clear();
    new import_obsidian12.Notice(this.plugin.i18n().t("filter.clearedNotice"));
    this.requestRender();
  }
  async editSelectedTasks(tasks) {
    const selected = this.selection.selectedTasks(tasks);
    if (selected.length === 1) {
      await this.openEditTask(selected[0], () => this.exitSelectionMode());
      return;
    }
    if (selected.length < 2) return;
    const [projects, allTasks] = await Promise.all([this.plugin.projects.list(), this.plugin.repository.list()]);
    new BulkTaskModal(this.app, selected, projects, this.labelEditingOptions(allTasks), this.contentEl, this.plugin.i18n(), async (changes) => {
      await this.applyBulkChanges(selected, changes);
    }).open();
  }
  async applyBulkChanges(tasks, changes) {
    const results = await Promise.allSettled(tasks.map(
      (task) => this.plugin.repository.update(task, buildBulkTaskPatch(task, changes))
    ));
    if (typeof changes.projectId === "string") {
      const project = (await this.plugin.projects.list()).find((item) => item.id === changes.projectId);
      if (project) await this.plugin.projects.touch(project);
    }
    await this.rememberLabels(changes.addLabels);
    this.finishBulkAction(tasks, results, "selection.updatedNotice");
  }
  async deleteSelectedTasks(tasks) {
    const { t } = this.plugin.i18n();
    const selected = this.selection.selectedTasks(tasks);
    if (selected.length === 0 || !window.confirm(t("selection.deleteConfirm", { count: selected.length }))) return;
    const results = await Promise.allSettled(selected.map((task) => this.plugin.repository.remove(task)));
    this.finishBulkAction(selected, results, "selection.deletedNotice");
  }
  finishBulkAction(tasks, results, successKey) {
    const { t } = this.plugin.i18n();
    const failed = failedBulkTasks(tasks, results);
    if (failed.length === 0) {
      new import_obsidian12.Notice(t(successKey, { count: tasks.length }));
      this.exitSelectionMode();
      return;
    }
    this.selection.restrictTo(failed.map((task) => task.id));
    new import_obsidian12.Notice(t("selection.partialFailure", { failed: failed.length, total: tasks.length }));
    this.requestRender();
  }
  addBackButton(header, action) {
    const button2 = header.createEl("button", {
      text: "\u2039",
      cls: "taskmate-back",
      attr: { "aria-label": this.plugin.i18n().t("common.back") }
    });
    header.prepend(button2);
    button2.addEventListener("click", action);
  }
  async rememberSearch(value) {
    const word = value.trim();
    if (!word) return;
    this.plugin.settings.recentSearches = [word, ...(this.plugin.settings.recentSearches ?? []).filter((item) => item !== word)].slice(0, 10);
    await this.plugin.saveSettings();
    this.requestRender();
  }
  async openCreateTask(projectId) {
    const [projects, tasks] = await Promise.all([
      this.plugin.projects.list(),
      this.plugin.repository.list()
    ]);
    new TaskModal(this.app, null, projects, this.labelEditingOptions(tasks), projectId, this.contentEl, this.plugin.i18n(), async (draft) => {
      await this.plugin.repository.create(draft);
      await this.rememberLabels(draft.labels);
      if (draft.projectId) {
        const project = projects.find((item) => item.id === draft.projectId);
        if (project) await this.plugin.projects.touch(project);
      }
      this.requestRender();
      return true;
    }).open();
  }
  async openEditTask(task, afterAction) {
    const [projects, tasks] = await Promise.all([
      this.plugin.projects.list(),
      this.plugin.repository.list()
    ]);
    const start = await this.plugin.repository.beginEdit(task);
    if (start.status === "identity-conflict") {
      this.showIdentityConflict(start.conflict.paths);
      return;
    }
    if (start.status === "missing") {
      new import_obsidian12.Notice(this.plugin.i18n().t("conflict.missing"));
      this.requestRender();
      return;
    }
    let modal;
    modal = new TaskModal(this.app, start.task, projects, this.labelEditingOptions(tasks), start.task.projectId, this.contentEl, this.plugin.i18n(), async (draft) => {
      const result = await this.plugin.repository.saveEditedTask(start.session, draft);
      return this.handleTaskSaveResult(result, projects, modal, afterAction);
    }, async () => {
      try {
        await this.plugin.repository.remove(start.task);
        new import_obsidian12.Notice(this.plugin.i18n().t("tasks.deletedNotice"));
        if (afterAction) afterAction();
        else this.requestRender();
        return true;
      } catch (error) {
        if (error instanceof DuplicateTaskIdError) {
          this.showIdentityConflict(error.conflict.paths);
          return false;
        }
        throw error;
      }
    });
    modal.open();
  }
  async handleTaskSaveResult(result, projects, taskModal, afterAction, savedNotice) {
    const { t } = this.plugin.i18n();
    if (result.status === "saved") {
      await this.rememberLabels(result.task.labels);
      if (result.task.projectId) {
        const project = projects.find((item) => item.id === result.task.projectId);
        if (project) await this.plugin.projects.touch(project);
      }
      if (savedNotice) new import_obsidian12.Notice(t(savedNotice));
      else if (result.externalChangesPreserved) new import_obsidian12.Notice(t("conflict.externalPreserved"));
      if (afterAction) afterAction();
      else this.requestRender();
      return true;
    }
    if (result.status === "conflict") {
      this.openTaskConflict(result, projects, taskModal, afterAction);
      return false;
    }
    if (result.status === "identity-conflict") {
      this.showIdentityConflict(result.conflict.paths);
      return false;
    }
    new import_obsidian12.Notice(t(result.status === "review-stale" ? "conflict.changedAgain" : "conflict.missing"));
    this.requestRender();
    return false;
  }
  openTaskConflict(conflict, projects, taskModal, afterAction) {
    new TaskConflictModal(this.app, conflict, projects, this.plugin.i18n(), async (choices) => {
      const result = await this.plugin.repository.resolveEditConflict(conflict, choices);
      if (result.status === "saved") {
        await this.handleTaskSaveResult(result, projects, taskModal, afterAction, "conflict.resolved");
        taskModal.close();
        return true;
      }
      if (result.status === "conflict") {
        new import_obsidian12.Notice(this.plugin.i18n().t("conflict.changedAgain"));
        window.setTimeout(() => this.openTaskConflict(result, projects, taskModal, afterAction), 0);
        return true;
      }
      await this.handleTaskSaveResult(result, projects, taskModal, afterAction);
      return true;
    }).open();
  }
  showIdentityConflict(paths) {
    new import_obsidian12.Notice(this.plugin.i18n().t("conflict.identityNotice", { paths: paths.join(", ") }), 0);
    this.requestRender();
  }
  labelEditingOptions(tasks) {
    const i18n = this.plugin.i18n();
    return {
      allLabels: availableFilterLabels(tasks, true).sort((a, b) => compareDisplayText(a, b, i18n.locale)).slice(0, 500),
      recentLabels: this.plugin.settings.recentLabels ?? [],
      favoriteLabels: this.plugin.settings.favoriteLabels ?? [],
      onFavoriteLabelsChange: async (labels) => {
        this.plugin.settings.favoriteLabels = labels;
        await this.plugin.saveSettings();
      }
    };
  }
  openCreateProject() {
    new ProjectModal(this.app, this.plugin.i18n(), async (name) => {
      const project = await this.plugin.projects.create(name);
      this.activeProjectId = project.id;
      this.projectScreen = "detail";
      this.requestRender();
    }).open();
  }
  async rememberLabels(labels) {
    const current = this.plugin.settings.recentLabels ?? [];
    const next = recordRecentLabels(current, labels);
    if (next.length === current.length && next.every((label, index2) => label === current[index2])) return;
    this.plugin.settings.recentLabels = next;
    await this.plugin.saveSettings();
  }
};

// src/i18n/obsidian-locale.ts
var import_obsidian13 = require("obsidian");
function detectObsidianLanguage() {
  try {
    return typeof import_obsidian13.getLanguage === "function" ? (0, import_obsidian13.getLanguage)() : void 0;
  } catch {
    return void 0;
  }
}

// src/reviews/task-change/proposal-repository.ts
var import_obsidian14 = require("obsidian");

// node_modules/diff/libesm/diff/base.js
var Diff = class {
  diff(oldStr, newStr, options = {}) {
    let callback;
    if (typeof options === "function") {
      callback = options;
      options = {};
    } else if ("callback" in options) {
      callback = options.callback;
    }
    const oldString = this.castInput(oldStr, options);
    const newString = this.castInput(newStr, options);
    const oldTokens = this.removeEmpty(this.tokenize(oldString, options));
    const newTokens = this.removeEmpty(this.tokenize(newString, options));
    return this.diffWithOptionsObj(oldTokens, newTokens, options, callback);
  }
  diffWithOptionsObj(oldTokens, newTokens, options, callback) {
    var _a;
    const done = (value) => {
      value = this.postProcess(value, options);
      if (callback) {
        setTimeout(function() {
          callback(value);
        }, 0);
        return void 0;
      } else {
        return value;
      }
    };
    const newLen = newTokens.length, oldLen = oldTokens.length;
    let editLength = 1;
    let maxEditLength = newLen + oldLen;
    if (options.maxEditLength != null) {
      maxEditLength = Math.min(maxEditLength, options.maxEditLength);
    }
    const maxExecutionTime = (_a = options.timeout) !== null && _a !== void 0 ? _a : Infinity;
    const abortAfterTimestamp = Date.now() + maxExecutionTime;
    const bestPath = [{ oldPos: -1, lastComponent: void 0 }];
    let newPos = this.extractCommon(bestPath[0], newTokens, oldTokens, 0, options);
    if (bestPath[0].oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
      return done(this.buildValues(bestPath[0].lastComponent, newTokens, oldTokens));
    }
    let minDiagonalToConsider = -Infinity, maxDiagonalToConsider = Infinity;
    const execEditLength = () => {
      for (let diagonalPath = Math.max(minDiagonalToConsider, -editLength); diagonalPath <= Math.min(maxDiagonalToConsider, editLength); diagonalPath += 2) {
        let basePath;
        const removePath = bestPath[diagonalPath - 1], addPath = bestPath[diagonalPath + 1];
        if (removePath) {
          bestPath[diagonalPath - 1] = void 0;
        }
        let canAdd = false;
        if (addPath) {
          const addPathNewPos = addPath.oldPos - diagonalPath;
          canAdd = addPath && 0 <= addPathNewPos && addPathNewPos < newLen;
        }
        const canRemove = removePath && removePath.oldPos + 1 < oldLen;
        if (!canAdd && !canRemove) {
          bestPath[diagonalPath] = void 0;
          continue;
        }
        if (!canRemove || canAdd && removePath.oldPos < addPath.oldPos) {
          basePath = this.addToPath(addPath, true, false, 0, options);
        } else {
          basePath = this.addToPath(removePath, false, true, 1, options);
        }
        newPos = this.extractCommon(basePath, newTokens, oldTokens, diagonalPath, options);
        if (basePath.oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
          return done(this.buildValues(basePath.lastComponent, newTokens, oldTokens)) || true;
        } else {
          bestPath[diagonalPath] = basePath;
          if (basePath.oldPos + 1 >= oldLen) {
            maxDiagonalToConsider = Math.min(maxDiagonalToConsider, diagonalPath - 1);
          }
          if (newPos + 1 >= newLen) {
            minDiagonalToConsider = Math.max(minDiagonalToConsider, diagonalPath + 1);
          }
        }
      }
      editLength++;
    };
    if (callback) {
      (function exec() {
        setTimeout(function() {
          if (editLength > maxEditLength || Date.now() > abortAfterTimestamp) {
            return callback(void 0);
          }
          if (!execEditLength()) {
            exec();
          }
        }, 0);
      })();
    } else {
      while (editLength <= maxEditLength && Date.now() <= abortAfterTimestamp) {
        const ret = execEditLength();
        if (ret) {
          return ret;
        }
      }
    }
  }
  addToPath(path, added, removed, oldPosInc, options) {
    const last = path.lastComponent;
    if (last && !options.oneChangePerToken && last.added === added && last.removed === removed) {
      return {
        oldPos: path.oldPos + oldPosInc,
        lastComponent: { count: last.count + 1, added, removed, previousComponent: last.previousComponent }
      };
    } else {
      return {
        oldPos: path.oldPos + oldPosInc,
        lastComponent: { count: 1, added, removed, previousComponent: last }
      };
    }
  }
  extractCommon(basePath, newTokens, oldTokens, diagonalPath, options) {
    const newLen = newTokens.length, oldLen = oldTokens.length;
    let oldPos = basePath.oldPos, newPos = oldPos - diagonalPath, commonCount = 0;
    while (newPos + 1 < newLen && oldPos + 1 < oldLen && this.equals(oldTokens[oldPos + 1], newTokens[newPos + 1], options)) {
      newPos++;
      oldPos++;
      commonCount++;
      if (options.oneChangePerToken) {
        basePath.lastComponent = { count: 1, previousComponent: basePath.lastComponent, added: false, removed: false };
      }
    }
    if (commonCount && !options.oneChangePerToken) {
      basePath.lastComponent = { count: commonCount, previousComponent: basePath.lastComponent, added: false, removed: false };
    }
    basePath.oldPos = oldPos;
    return newPos;
  }
  equals(left, right, options) {
    if (options.comparator) {
      return options.comparator(left, right);
    } else {
      return left === right || !!options.ignoreCase && left.toLowerCase() === right.toLowerCase();
    }
  }
  removeEmpty(array) {
    const ret = [];
    for (let i = 0; i < array.length; i++) {
      if (array[i]) {
        ret.push(array[i]);
      }
    }
    return ret;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  castInput(value, options) {
    return value;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tokenize(value, options) {
    return Array.from(value);
  }
  join(chars) {
    return chars.join("");
  }
  postProcess(changeObjects, options) {
    return changeObjects;
  }
  get useLongestToken() {
    return false;
  }
  buildValues(lastComponent, newTokens, oldTokens) {
    const components = [];
    let nextComponent;
    while (lastComponent) {
      components.push(lastComponent);
      nextComponent = lastComponent.previousComponent;
      delete lastComponent.previousComponent;
      lastComponent = nextComponent;
    }
    components.reverse();
    const componentLen = components.length;
    let componentPos = 0, newPos = 0, oldPos = 0;
    for (; componentPos < componentLen; componentPos++) {
      const component = components[componentPos];
      if (!component.removed) {
        if (!component.added && this.useLongestToken) {
          let value = newTokens.slice(newPos, newPos + component.count);
          value = value.map(function(value2, i) {
            const oldValue = oldTokens[oldPos + i];
            return oldValue.length > value2.length ? oldValue : value2;
          });
          component.value = this.join(value);
        } else {
          component.value = this.join(newTokens.slice(newPos, newPos + component.count));
        }
        newPos += component.count;
        if (!component.added) {
          oldPos += component.count;
        }
      } else {
        component.value = this.join(oldTokens.slice(oldPos, oldPos + component.count));
        oldPos += component.count;
      }
    }
    return components;
  }
};

// node_modules/diff/libesm/util/string.js
function hasOnlyWinLineEndings(string) {
  return string.includes("\r\n") && !string.startsWith("\n") && !string.match(/[^\r]\n/);
}
function hasOnlyUnixLineEndings(string) {
  return !string.includes("\r\n") && string.includes("\n");
}

// node_modules/diff/libesm/diff/line.js
var LineDiff = class extends Diff {
  constructor() {
    super(...arguments);
    this.tokenize = tokenize;
  }
  equals(left, right, options) {
    if (options.ignoreWhitespace) {
      if (!options.newlineIsToken || !left.includes("\n")) {
        left = left.trim();
      }
      if (!options.newlineIsToken || !right.includes("\n")) {
        right = right.trim();
      }
    } else if (options.ignoreNewlineAtEof && !options.newlineIsToken) {
      if (left.endsWith("\n")) {
        left = left.slice(0, -1);
      }
      if (right.endsWith("\n")) {
        right = right.slice(0, -1);
      }
    }
    return super.equals(left, right, options);
  }
};
var lineDiff = new LineDiff();
function diffLines(oldStr, newStr, options) {
  return lineDiff.diff(oldStr, newStr, options);
}
function tokenize(value, options) {
  if (options.stripTrailingCr) {
    value = value.replace(/\r\n/g, "\n");
  }
  const retLines = [], linesAndNewlines = value.split(/(\n|\r\n)/);
  if (!linesAndNewlines[linesAndNewlines.length - 1]) {
    linesAndNewlines.pop();
  }
  for (let i = 0; i < linesAndNewlines.length; i++) {
    const line = linesAndNewlines[i];
    if (i % 2 && !options.newlineIsToken) {
      retLines[retLines.length - 1] += line;
    } else {
      retLines.push(line);
    }
  }
  return retLines;
}

// node_modules/diff/libesm/patch/line-endings.js
function unixToWin(patch) {
  if (Array.isArray(patch)) {
    return patch.map((p) => unixToWin(p));
  }
  return Object.assign(Object.assign({}, patch), { hunks: patch.hunks.map((hunk) => Object.assign(Object.assign({}, hunk), { lines: hunk.lines.map((line, i) => {
    var _a;
    return line.startsWith("\\") || line.endsWith("\r") || ((_a = hunk.lines[i + 1]) === null || _a === void 0 ? void 0 : _a.startsWith("\\")) ? line : line + "\r";
  }) })) });
}
function winToUnix(patch) {
  if (Array.isArray(patch)) {
    return patch.map((p) => winToUnix(p));
  }
  return Object.assign(Object.assign({}, patch), { hunks: patch.hunks.map((hunk) => Object.assign(Object.assign({}, hunk), { lines: hunk.lines.map((line) => line.endsWith("\r") ? line.substring(0, line.length - 1) : line) })) });
}
function isUnix(patch) {
  if (!Array.isArray(patch)) {
    patch = [patch];
  }
  return !patch.some((index2) => index2.hunks.some((hunk) => hunk.lines.some((line) => !line.startsWith("\\") && line.endsWith("\r"))));
}
function isWin(patch) {
  if (!Array.isArray(patch)) {
    patch = [patch];
  }
  return patch.some((index2) => index2.hunks.some((hunk) => hunk.lines.some((line) => line.endsWith("\r")))) && patch.every((index2) => index2.hunks.every((hunk) => hunk.lines.every((line, i) => {
    var _a;
    return line.startsWith("\\") || line.endsWith("\r") || ((_a = hunk.lines[i + 1]) === null || _a === void 0 ? void 0 : _a.startsWith("\\"));
  })));
}

// node_modules/diff/libesm/patch/parse.js
function parsePatch(uniDiff) {
  const diffstr = uniDiff.split(/\n/), list = [];
  let i = 0;
  function parseIndex() {
    const index2 = {};
    list.push(index2);
    while (i < diffstr.length) {
      const line = diffstr[i];
      if (/^(---|\+\+\+|@@)\s/.test(line)) {
        break;
      }
      const headerMatch = /^(?:Index:|diff(?: -r \w+)+)\s+/.exec(line);
      if (headerMatch) {
        index2.index = line.substring(headerMatch[0].length).trim();
      }
      i++;
    }
    parseFileHeader(index2);
    parseFileHeader(index2);
    index2.hunks = [];
    while (i < diffstr.length) {
      const line = diffstr[i];
      if (/^(Index:\s|diff\s|---\s|\+\+\+\s|===================================================================)/.test(line)) {
        break;
      } else if (/^@@/.test(line)) {
        index2.hunks.push(parseHunk());
      } else if (line) {
        throw new Error("Unknown line " + (i + 1) + " " + JSON.stringify(line));
      } else {
        i++;
      }
    }
  }
  function parseFileHeader(index2) {
    const fileHeaderMatch = /^(---|\+\+\+)\s+/.exec(diffstr[i]);
    if (fileHeaderMatch) {
      const prefix = fileHeaderMatch[1], data = diffstr[i].substring(3).trim().split("	", 2), header = (data[1] || "").trim();
      let fileName = data[0].replace(/\\\\/g, "\\");
      if (fileName.startsWith('"') && fileName.endsWith('"')) {
        fileName = fileName.substr(1, fileName.length - 2);
      }
      if (prefix === "---") {
        index2.oldFileName = fileName;
        index2.oldHeader = header;
      } else {
        index2.newFileName = fileName;
        index2.newHeader = header;
      }
      i++;
    }
  }
  function parseHunk() {
    var _a;
    const chunkHeaderIndex = i, chunkHeaderLine = diffstr[i++], chunkHeader = chunkHeaderLine.split(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    const hunk = {
      oldStart: +chunkHeader[1],
      oldLines: typeof chunkHeader[2] === "undefined" ? 1 : +chunkHeader[2],
      newStart: +chunkHeader[3],
      newLines: typeof chunkHeader[4] === "undefined" ? 1 : +chunkHeader[4],
      lines: []
    };
    if (hunk.oldLines === 0) {
      hunk.oldStart += 1;
    }
    if (hunk.newLines === 0) {
      hunk.newStart += 1;
    }
    let addCount = 0, removeCount = 0;
    for (; i < diffstr.length && (removeCount < hunk.oldLines || addCount < hunk.newLines || ((_a = diffstr[i]) === null || _a === void 0 ? void 0 : _a.startsWith("\\"))); i++) {
      const operation = diffstr[i].length == 0 && i != diffstr.length - 1 ? " " : diffstr[i][0];
      if (operation === "+" || operation === "-" || operation === " " || operation === "\\") {
        hunk.lines.push(diffstr[i]);
        if (operation === "+") {
          addCount++;
        } else if (operation === "-") {
          removeCount++;
        } else if (operation === " ") {
          addCount++;
          removeCount++;
        }
      } else {
        throw new Error(`Hunk at line ${chunkHeaderIndex + 1} contained invalid line ${diffstr[i]}`);
      }
    }
    if (!addCount && hunk.newLines === 1) {
      hunk.newLines = 0;
    }
    if (!removeCount && hunk.oldLines === 1) {
      hunk.oldLines = 0;
    }
    if (addCount !== hunk.newLines) {
      throw new Error("Added line count did not match for hunk at line " + (chunkHeaderIndex + 1));
    }
    if (removeCount !== hunk.oldLines) {
      throw new Error("Removed line count did not match for hunk at line " + (chunkHeaderIndex + 1));
    }
    return hunk;
  }
  while (i < diffstr.length) {
    parseIndex();
  }
  return list;
}

// node_modules/diff/libesm/util/distance-iterator.js
function distance_iterator_default(start, minLine, maxLine) {
  let wantForward = true, backwardExhausted = false, forwardExhausted = false, localOffset = 1;
  return function iterator() {
    if (wantForward && !forwardExhausted) {
      if (backwardExhausted) {
        localOffset++;
      } else {
        wantForward = false;
      }
      if (start + localOffset <= maxLine) {
        return start + localOffset;
      }
      forwardExhausted = true;
    }
    if (!backwardExhausted) {
      if (!forwardExhausted) {
        wantForward = true;
      }
      if (minLine <= start - localOffset) {
        return start - localOffset++;
      }
      backwardExhausted = true;
      return iterator();
    }
    return void 0;
  };
}

// node_modules/diff/libesm/patch/apply.js
function applyPatch(source, patch, options = {}) {
  let patches;
  if (typeof patch === "string") {
    patches = parsePatch(patch);
  } else if (Array.isArray(patch)) {
    patches = patch;
  } else {
    patches = [patch];
  }
  if (patches.length > 1) {
    throw new Error("applyPatch only works with a single input.");
  }
  return applyStructuredPatch(source, patches[0], options);
}
function applyStructuredPatch(source, patch, options = {}) {
  if (options.autoConvertLineEndings || options.autoConvertLineEndings == null) {
    if (hasOnlyWinLineEndings(source) && isUnix(patch)) {
      patch = unixToWin(patch);
    } else if (hasOnlyUnixLineEndings(source) && isWin(patch)) {
      patch = winToUnix(patch);
    }
  }
  const lines = source.split("\n"), hunks = patch.hunks, compareLine = options.compareLine || ((lineNumber, line, operation, patchContent) => line === patchContent), fuzzFactor = options.fuzzFactor || 0;
  let minLine = 0;
  if (fuzzFactor < 0 || !Number.isInteger(fuzzFactor)) {
    throw new Error("fuzzFactor must be a non-negative integer");
  }
  if (!hunks.length) {
    return source;
  }
  let prevLine = "", removeEOFNL = false, addEOFNL = false;
  for (let i = 0; i < hunks[hunks.length - 1].lines.length; i++) {
    const line = hunks[hunks.length - 1].lines[i];
    if (line[0] == "\\") {
      if (prevLine[0] == "+") {
        removeEOFNL = true;
      } else if (prevLine[0] == "-") {
        addEOFNL = true;
      }
    }
    prevLine = line;
  }
  if (removeEOFNL) {
    if (addEOFNL) {
      if (!fuzzFactor && lines[lines.length - 1] == "") {
        return false;
      }
    } else if (lines[lines.length - 1] == "") {
      lines.pop();
    } else if (!fuzzFactor) {
      return false;
    }
  } else if (addEOFNL) {
    if (lines[lines.length - 1] != "") {
      lines.push("");
    } else if (!fuzzFactor) {
      return false;
    }
  }
  function applyHunk(hunkLines, toPos, maxErrors, hunkLinesI = 0, lastContextLineMatched = true, patchedLines = [], patchedLinesLength = 0) {
    let nConsecutiveOldContextLines = 0;
    let nextContextLineMustMatch = false;
    for (; hunkLinesI < hunkLines.length; hunkLinesI++) {
      const hunkLine = hunkLines[hunkLinesI], operation = hunkLine.length > 0 ? hunkLine[0] : " ", content = hunkLine.length > 0 ? hunkLine.substr(1) : hunkLine;
      if (operation === "-") {
        if (compareLine(toPos + 1, lines[toPos], operation, content)) {
          toPos++;
          nConsecutiveOldContextLines = 0;
        } else {
          if (!maxErrors || lines[toPos] == null) {
            return null;
          }
          patchedLines[patchedLinesLength] = lines[toPos];
          return applyHunk(hunkLines, toPos + 1, maxErrors - 1, hunkLinesI, false, patchedLines, patchedLinesLength + 1);
        }
      }
      if (operation === "+") {
        if (!lastContextLineMatched) {
          return null;
        }
        patchedLines[patchedLinesLength] = content;
        patchedLinesLength++;
        nConsecutiveOldContextLines = 0;
        nextContextLineMustMatch = true;
      }
      if (operation === " ") {
        nConsecutiveOldContextLines++;
        patchedLines[patchedLinesLength] = lines[toPos];
        if (compareLine(toPos + 1, lines[toPos], operation, content)) {
          patchedLinesLength++;
          lastContextLineMatched = true;
          nextContextLineMustMatch = false;
          toPos++;
        } else {
          if (nextContextLineMustMatch || !maxErrors) {
            return null;
          }
          return lines[toPos] && (applyHunk(hunkLines, toPos + 1, maxErrors - 1, hunkLinesI + 1, false, patchedLines, patchedLinesLength + 1) || applyHunk(hunkLines, toPos + 1, maxErrors - 1, hunkLinesI, false, patchedLines, patchedLinesLength + 1)) || applyHunk(hunkLines, toPos, maxErrors - 1, hunkLinesI + 1, false, patchedLines, patchedLinesLength);
        }
      }
    }
    patchedLinesLength -= nConsecutiveOldContextLines;
    toPos -= nConsecutiveOldContextLines;
    patchedLines.length = patchedLinesLength;
    return {
      patchedLines,
      oldLineLastI: toPos - 1
    };
  }
  const resultLines = [];
  let prevHunkOffset = 0;
  for (let i = 0; i < hunks.length; i++) {
    const hunk = hunks[i];
    let hunkResult;
    const maxLine = lines.length - hunk.oldLines + fuzzFactor;
    let toPos;
    for (let maxErrors = 0; maxErrors <= fuzzFactor; maxErrors++) {
      toPos = hunk.oldStart + prevHunkOffset - 1;
      const iterator = distance_iterator_default(toPos, minLine, maxLine);
      for (; toPos !== void 0; toPos = iterator()) {
        hunkResult = applyHunk(hunk.lines, toPos, maxErrors);
        if (hunkResult) {
          break;
        }
      }
      if (hunkResult) {
        break;
      }
    }
    if (!hunkResult) {
      return false;
    }
    for (let i2 = minLine; i2 < toPos; i2++) {
      resultLines.push(lines[i2]);
    }
    for (let i2 = 0; i2 < hunkResult.patchedLines.length; i2++) {
      const line = hunkResult.patchedLines[i2];
      resultLines.push(line);
    }
    minLine = hunkResult.oldLineLastI + 1;
    prevHunkOffset = toPos + 1 - hunk.oldStart;
  }
  for (let i = minLine; i < lines.length; i++) {
    resultLines.push(lines[i]);
  }
  return resultLines.join("\n");
}

// node_modules/diff/libesm/patch/create.js
function structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
  let optionsObj;
  if (!options) {
    optionsObj = {};
  } else if (typeof options === "function") {
    optionsObj = { callback: options };
  } else {
    optionsObj = options;
  }
  if (typeof optionsObj.context === "undefined") {
    optionsObj.context = 4;
  }
  const context = optionsObj.context;
  if (optionsObj.newlineIsToken) {
    throw new Error("newlineIsToken may not be used with patch-generation functions, only with diffing functions");
  }
  if (!optionsObj.callback) {
    return diffLinesResultToPatch(diffLines(oldStr, newStr, optionsObj));
  } else {
    const { callback } = optionsObj;
    diffLines(oldStr, newStr, Object.assign(Object.assign({}, optionsObj), { callback: (diff) => {
      const patch = diffLinesResultToPatch(diff);
      callback(patch);
    } }));
  }
  function diffLinesResultToPatch(diff) {
    if (!diff) {
      return;
    }
    diff.push({ value: "", lines: [] });
    function contextLines(lines) {
      return lines.map(function(entry) {
        return " " + entry;
      });
    }
    const hunks = [];
    let oldRangeStart = 0, newRangeStart = 0, curRange = [], oldLine = 1, newLine = 1;
    for (let i = 0; i < diff.length; i++) {
      const current = diff[i], lines = current.lines || splitLines(current.value);
      current.lines = lines;
      if (current.added || current.removed) {
        if (!oldRangeStart) {
          const prev = diff[i - 1];
          oldRangeStart = oldLine;
          newRangeStart = newLine;
          if (prev) {
            curRange = context > 0 ? contextLines(prev.lines.slice(-context)) : [];
            oldRangeStart -= curRange.length;
            newRangeStart -= curRange.length;
          }
        }
        for (const line of lines) {
          curRange.push((current.added ? "+" : "-") + line);
        }
        if (current.added) {
          newLine += lines.length;
        } else {
          oldLine += lines.length;
        }
      } else {
        if (oldRangeStart) {
          if (lines.length <= context * 2 && i < diff.length - 2) {
            for (const line of contextLines(lines)) {
              curRange.push(line);
            }
          } else {
            const contextSize = Math.min(lines.length, context);
            for (const line of contextLines(lines.slice(0, contextSize))) {
              curRange.push(line);
            }
            const hunk = {
              oldStart: oldRangeStart,
              oldLines: oldLine - oldRangeStart + contextSize,
              newStart: newRangeStart,
              newLines: newLine - newRangeStart + contextSize,
              lines: curRange
            };
            hunks.push(hunk);
            oldRangeStart = 0;
            newRangeStart = 0;
            curRange = [];
          }
        }
        oldLine += lines.length;
        newLine += lines.length;
      }
    }
    for (const hunk of hunks) {
      for (let i = 0; i < hunk.lines.length; i++) {
        if (hunk.lines[i].endsWith("\n")) {
          hunk.lines[i] = hunk.lines[i].slice(0, -1);
        } else {
          hunk.lines.splice(i + 1, 0, "\\ No newline at end of file");
          i++;
        }
      }
    }
    return {
      oldFileName,
      newFileName,
      oldHeader,
      newHeader,
      hunks
    };
  }
}
function splitLines(text) {
  const hasTrailingNl = text.endsWith("\n");
  const result = text.split("\n").map((line) => line + "\n");
  if (hasTrailingNl) {
    result.pop();
  } else {
    result.push(result.pop().slice(0, -1));
  }
  return result;
}

// src/reviews/task-change/proposal.ts
var TASK_CHANGE_PROPOSAL_SCHEMA_VERSION = 1;
async function sha256(content) {
  const bytes = new TextEncoder().encode(content);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
async function buildProposalReview(proposal) {
  validateProposalShape(proposal);
  const tasks = [];
  for (const task of proposal.tasks) {
    if (await sha256(task.beforeMarkdown) !== task.beforeSha256) {
      throw new Error(`Proposal ${proposal.id} beforeSha256 does not match Task ${task.taskId}`);
    }
    validateSemanticEvidence(task);
    const patch = structuredPatch(task.path, task.path, task.beforeMarkdown, task.afterMarkdown, "before", "after", { context: 3 });
    if (applyPatch(task.beforeMarkdown, patch) !== task.afterMarkdown) {
      throw new Error(`Proposal ${proposal.id} exact patch replay failed for Task ${task.taskId}`);
    }
    tasks.push({
      ...task,
      rawHunks: patch.hunks.map((hunk) => ({
        oldStart: hunk.oldStart,
        oldLines: hunk.oldLines,
        newStart: hunk.newStart,
        newLines: hunk.newLines,
        lines: [...hunk.lines]
      }))
    });
  }
  return { proposalId: proposal.id, status: proposal.status, tasks };
}
function parseTaskChangeProposal(content) {
  const value = JSON.parse(content);
  validateProposalShape(value);
  return value;
}
async function applyProposalDecision(proposal, approvedChangeIds, currentMarkdownByTaskId, options) {
  await buildProposalReview(proposal);
  if (proposal.status !== "pending") throw new Error(`Proposal ${proposal.id} is not pending`);
  const allChanges = proposal.tasks.flatMap((task) => task.changes);
  const knownIds = new Set(allChanges.map((change) => change.id));
  const approved = new Set(approvedChangeIds);
  for (const id of approved) if (!knownIds.has(id)) throw new Error(`Unknown approved change: ${id}`);
  const rejectedIds = allChanges.map((change) => change.id).filter((id) => !approved.has(id));
  const writes = [];
  const failed = [];
  const followUpTasks = [];
  let nextFollowUpChange = 1;
  for (const proposalTask of proposal.tasks) {
    const approvedForTask = proposalTask.changes.filter((change) => approved.has(change.id));
    const rejectedForTask = proposalTask.changes.filter((change) => !approved.has(change.id));
    const current = currentMarkdownByTaskId.get(proposalTask.taskId);
    if (current === void 0) {
      failed.push({
        taskId: proposalTask.taskId,
        changeIds: proposalTask.changes.map((change) => change.id),
        error: "Task is missing"
      });
      continue;
    }
    if (await sha256(current) !== proposalTask.beforeSha256 || current !== proposalTask.beforeMarkdown) {
      failed.push({
        taskId: proposalTask.taskId,
        changeIds: proposalTask.changes.map((change) => change.id),
        error: "Task changed after review"
      });
      const currentTask = parseRequiredTask(proposalTask.path, current, proposalTask.taskId);
      const desiredTask = parseRequiredTask(proposalTask.path, proposalTask.afterMarkdown, proposalTask.taskId);
      const remainingChanges = proposalTask.changes.filter(
        (change) => !sameValue(taskField(currentTask, change.field), taskField(desiredTask, change.field))
      );
      if (remainingChanges.length > 0) {
        const regeneratedAfterTask = applyFields(currentTask, desiredTask, remainingChanges.map((change) => change.field));
        followUpTasks.push({
          ...withoutLegacyReviewId(proposalTask),
          title: currentTask.title,
          beforeMarkdown: current,
          afterMarkdown: encodeTaskPreservingProperties(regeneratedAfterTask, current),
          beforeSha256: await sha256(current),
          changes: remainingChanges.map((change) => ({
            ...change,
            id: `C-${String(nextFollowUpChange++).padStart(2, "0")}`,
            before: taskField(currentTask, change.field),
            after: taskField(desiredTask, change.field),
            origin: { proposalId: proposal.id, changeId: change.id }
          }))
        });
      }
      continue;
    }
    const beforeTask = parseRequiredTask(proposalTask.path, proposalTask.beforeMarkdown, proposalTask.taskId);
    const afterTask = parseRequiredTask(proposalTask.path, proposalTask.afterMarkdown, proposalTask.taskId);
    const appliedTask = applyFields(beforeTask, afterTask, approvedForTask.map((change) => change.field));
    const appliedMarkdown = approvedForTask.length > 0 ? encodeTaskPreservingProperties(appliedTask, proposalTask.beforeMarkdown) : proposalTask.beforeMarkdown;
    if (approvedForTask.length > 0) {
      writes.push({
        taskId: proposalTask.taskId,
        path: proposalTask.path,
        title: appliedTask.title,
        markdown: appliedMarkdown,
        changeIds: approvedForTask.map((change) => change.id)
      });
    }
    if (rejectedForTask.length > 0) {
      const followUpAfterTask = applyFields(appliedTask, afterTask, rejectedForTask.map((change) => change.field));
      const followUpAfter = encodeTaskPreservingProperties(followUpAfterTask, appliedMarkdown);
      followUpTasks.push({
        ...withoutLegacyReviewId(proposalTask),
        beforeMarkdown: appliedMarkdown,
        afterMarkdown: followUpAfter,
        beforeSha256: await sha256(appliedMarkdown),
        changes: rejectedForTask.map((change) => ({
          ...change,
          id: `C-${String(nextFollowUpChange++).padStart(2, "0")}`,
          origin: { proposalId: proposal.id, changeId: change.id }
        }))
      });
    }
  }
  const succeededIds = writes.flatMap((write) => write.changeIds);
  const followUp = followUpTasks.length > 0 ? {
    schemaVersion: TASK_CHANGE_PROPOSAL_SCHEMA_VERSION,
    id: options.followUpProposalId,
    status: "pending",
    createdAt: options.decidedAt,
    tasks: followUpTasks,
    originProposalId: proposal.id
  } : null;
  const status = failed.length > 0 ? succeededIds.length > 0 ? "partially-applied" : "stale" : rejectedIds.length > 0 ? succeededIds.length > 0 ? "partially-applied" : "rejected" : "applied";
  const closedProposal = {
    ...proposal,
    status,
    decision: {
      decidedAt: options.decidedAt,
      approvedChangeIds: [...approved],
      rejectedChangeIds: rejectedIds
    },
    result: {
      appliedAt: options.decidedAt,
      succeededChangeIds: succeededIds,
      failed,
      followUpProposalId: followUp?.id ?? null
    }
  };
  return { status, writes, closedProposal, followUp };
}
function withoutLegacyReviewId(task) {
  const copy = { ...task };
  delete copy.reviewId;
  return copy;
}
function parseRequiredTask(path, markdown, taskId) {
  const task = parseTaskMarkdown(path, markdown);
  if (!task || task.id !== taskId) throw new Error(`Invalid Task evidence for ${taskId}`);
  return task;
}
function applyFields(before, after, fields) {
  const result = {
    ...before,
    labels: [...before.labels],
    steps: before.steps.map((step) => ({ ...step }))
  };
  for (const field of new Set(fields)) {
    switch (field) {
      case "title":
        result.title = after.title;
        break;
      case "date":
        result.date = after.date;
        break;
      case "priority":
        result.priority = after.priority;
        break;
      case "labels":
        result.labels = [...after.labels];
        break;
      case "steps":
        result.steps = after.steps.map((step) => ({ ...step }));
        break;
      case "notes":
        result.notes = after.notes;
        break;
    }
  }
  if (fields.length > 0) result.updatedAt = after.updatedAt;
  return result;
}
function validateSemanticEvidence(proposalTask) {
  const before = parseRequiredTask(proposalTask.path, proposalTask.beforeMarkdown, proposalTask.taskId);
  const after = parseRequiredTask(proposalTask.path, proposalTask.afterMarkdown, proposalTask.taskId);
  const fields = ["title", "date", "priority", "labels", "steps", "notes"];
  const represented = /* @__PURE__ */ new Set();
  for (const change of proposalTask.changes) {
    if (represented.has(change.field)) throw new Error(`Duplicate semantic field ${change.field} in Task ${proposalTask.taskId}`);
    represented.add(change.field);
    if (!sameValue(change.before, taskField(before, change.field)) || !sameValue(change.after, taskField(after, change.field))) {
      throw new Error(`Change ${change.id} values do not match Markdown evidence`);
    }
  }
  for (const field of fields) {
    const changed = !sameValue(taskField(before, field), taskField(after, field));
    if (changed && !represented.has(field)) throw new Error(`Proposal has unrepresented semantic field ${field}`);
    if (!changed && represented.has(field)) throw new Error(`Proposal represents unchanged semantic field ${field}`);
  }
  const immutable = ["id", "completed", "projectId", "rank", "createdAt", "completedAt", "sourceNote", "stepSectionRemainder"];
  for (const field of immutable) {
    if (!sameValue(before[field], after[field])) throw new Error(`Proposal changes unsupported Task field ${field}`);
  }
}
function taskField(task, field) {
  switch (field) {
    case "title":
      return task.title;
    case "date":
      return task.date;
    case "priority":
      return task.priority;
    case "labels":
      return task.labels;
    case "steps":
      return task.steps;
    case "notes":
      return task.notes;
  }
}
function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
function validateProposalShape(value) {
  if (!isRecord(value)) throw new Error("Proposal must be an object");
  if (value.schemaVersion !== TASK_CHANGE_PROPOSAL_SCHEMA_VERSION) throw new Error("Unsupported Proposal schemaVersion");
  if (!isIdentifier(value.id, /^proposal-[A-Za-z0-9._-]+$/)) throw new Error("Invalid Proposal id");
  if (!isStatus(value.status)) throw new Error("Invalid Proposal status");
  if (typeof value.createdAt !== "string" || !value.createdAt) throw new Error("Invalid Proposal createdAt");
  if (!Array.isArray(value.tasks) || value.tasks.length === 0) throw new Error("Proposal requires tasks");
  const taskIds = /* @__PURE__ */ new Set();
  const changeIds = /* @__PURE__ */ new Set();
  for (const task of value.tasks) {
    if (!isRecord(task)) throw new Error("Invalid Proposal task");
    if (typeof task.taskId !== "string" || !task.taskId || taskIds.has(task.taskId)) throw new Error("Invalid or duplicate taskId");
    if (typeof task.path !== "string" || !task.path || task.path.startsWith("/") || task.path.includes("..")) throw new Error("Invalid Task path");
    if (typeof task.title !== "string" || typeof task.beforeMarkdown !== "string" || typeof task.afterMarkdown !== "string") throw new Error("Invalid Proposal Markdown evidence");
    if (typeof task.beforeSha256 !== "string" || !/^[a-f0-9]{64}$/.test(task.beforeSha256)) throw new Error("Invalid beforeSha256");
    if (!Array.isArray(task.changes) || task.changes.length === 0) throw new Error("Proposal task requires changes");
    taskIds.add(task.taskId);
    const taskFields = /* @__PURE__ */ new Set();
    for (const change of task.changes) {
      if (!isRecord(change) || !isIdentifier(change.id, /^C-[0-9]{2,}$/) || changeIds.has(change.id)) throw new Error("Invalid or duplicate change id");
      if (!isChangeField(change.field)) throw new Error("Invalid change field");
      if (taskFields.has(change.field)) throw new Error("Duplicate change field");
      if (typeof change.reason !== "string" || !change.reason.trim()) throw new Error("Change reason is required");
      changeIds.add(change.id);
      taskFields.add(change.field);
    }
  }
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isIdentifier(value, pattern) {
  return typeof value === "string" && pattern.test(value);
}
function isStatus(value) {
  return value === "pending" || value === "applied" || value === "partially-applied" || value === "rejected" || value === "stale";
}
function isChangeField(value) {
  return value === "title" || value === "date" || value === "priority" || value === "labels" || value === "steps" || value === "notes";
}

// src/reviews/task-change/proposal-repository.ts
var TaskChangeProposalRepository = class {
  constructor(app, proposalFolder, tasks) {
    this.app = app;
    this.proposalFolder = proposalFolder;
    this.tasks = tasks;
  }
  async listPending() {
    const prefix = `${this.folder()}/`;
    const files = this.app.vault.getFiles().filter((file) => file.path.startsWith(prefix) && !file.path.startsWith(`${this.historyFolder()}/`) && file.extension === "json");
    const summaries = [];
    for (const file of files) {
      try {
        const proposal = parseTaskChangeProposal(await this.app.vault.read(file));
        if (proposal.status !== "pending") continue;
        summaries.push(summarize(proposal));
      } catch (error) {
        console.error(`TaskMate ignored malformed Proposal ${file.path}`, error);
      }
    }
    return summaries.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }
  async listHistory() {
    const prefix = `${this.historyFolder()}/`;
    const files = this.app.vault.getFiles().filter((file) => file.path.startsWith(prefix) && file.extension === "json");
    const summaries = [];
    for (const file of files) {
      try {
        const proposal = parseTaskChangeProposal(await this.app.vault.read(file));
        if (proposal.status === "pending") continue;
        summaries.push(summarize(proposal));
      } catch (error) {
        console.error(`TaskMate ignored malformed Proposal history ${file.path}`, error);
      }
    }
    return summaries.sort((left, right) => (right.resultAt ?? right.createdAt).localeCompare(left.resultAt ?? left.createdAt));
  }
  async load(proposalId) {
    const file = this.proposalFile(proposalId);
    if (!file) throw new Error(`Proposal not found: ${proposalId}`);
    return parseTaskChangeProposal(await this.app.vault.read(file));
  }
  async review(proposalId) {
    return buildProposalReview(await this.load(proposalId));
  }
  async reviewHistory(proposalId) {
    const file = this.historyProposalFile(proposalId);
    if (!file) throw new Error(`Proposal history not found: ${proposalId}`);
    return buildProposalReview(parseTaskChangeProposal(await this.app.vault.read(file)));
  }
  async save(proposal) {
    parseTaskChangeProposal(JSON.stringify(proposal));
    await this.ensureFolder(this.folder());
    const path = (0, import_obsidian14.normalizePath)(`${this.folder()}/${proposal.id}.json`);
    const content = `${JSON.stringify(proposal, null, 2)}
`;
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof import_obsidian14.TFile) await this.app.vault.modify(existing, content);
    else await this.app.vault.create(path, content);
  }
  async apply(proposalId, approvedChangeIds, now = (/* @__PURE__ */ new Date()).toISOString()) {
    if (approvedChangeIds.length === 0) throw new Error("Select at least one change or reject the Proposal");
    const proposal = await this.load(proposalId);
    const current = /* @__PURE__ */ new Map();
    for (const item of proposal.tasks) {
      const source = await this.tasks.readReviewedTask(item.taskId, item.path);
      if (source.status === "ready") current.set(item.taskId, source.content);
    }
    const followUpProposalId = `${proposal.id}-follow-up-${now.replace(/\D/g, "").slice(0, 14)}`;
    const result = await applyProposalDecision(proposal, approvedChangeIds, current, {
      decidedAt: now,
      followUpProposalId
    });
    const writeFailures = [];
    const actuallySucceeded = [];
    for (const write of result.writes) {
      const proposalTask = proposal.tasks.find((item) => item.taskId === write.taskId);
      if (!proposalTask) continue;
      const saved = await this.tasks.writeReviewedTask(write.taskId, write.path, proposalTask.beforeMarkdown, write.markdown);
      if (saved.status !== "saved") {
        writeFailures.push({ taskId: write.taskId, changeIds: write.changeIds, error: saved.status });
      } else actuallySucceeded.push(...write.changeIds);
    }
    let finalResult = result;
    if (writeFailures.length > 0) {
      const failedTaskIds = new Set(writeFailures.map((failure) => failure.taskId));
      const retainedFollowUpTasks = result.followUp?.tasks.filter((task) => !failedTaskIds.has(task.taskId)) ?? [];
      const regeneratedTasks = (await Promise.all(
        writeFailures.map((failure) => this.regenerateWriteFailure(proposal, failure.taskId, now, followUpProposalId))
      )).filter((task) => task !== null);
      const followUpTasks = reindexChanges([...retainedFollowUpTasks, ...regeneratedTasks]);
      const retainedFollowUp = followUpTasks.length > 0 ? {
        ...result.followUp ?? {
          schemaVersion: proposal.schemaVersion,
          id: followUpProposalId,
          status: "pending",
          createdAt: now,
          originProposalId: proposal.id
        },
        tasks: followUpTasks
      } : null;
      finalResult = {
        ...result,
        status: actuallySucceeded.length ? "partially-applied" : "stale",
        followUp: retainedFollowUp,
        closedProposal: {
          ...result.closedProposal,
          status: actuallySucceeded.length ? "partially-applied" : "stale",
          result: result.closedProposal.result ? {
            ...result.closedProposal.result,
            succeededChangeIds: actuallySucceeded,
            failed: [...result.closedProposal.result.failed, ...writeFailures],
            followUpProposalId: retainedFollowUp?.id ?? null
          } : void 0
        }
      };
    }
    if (finalResult.followUp) await this.save(finalResult.followUp);
    await this.archive(finalResult.closedProposal);
    return finalResult;
  }
  async reject(proposalId, now = (/* @__PURE__ */ new Date()).toISOString()) {
    const proposal = await this.load(proposalId);
    const changeIds = proposal.tasks.flatMap((task) => task.changes.map((change) => change.id));
    await this.archive({
      ...proposal,
      status: "rejected",
      decision: { decidedAt: now, approvedChangeIds: [], rejectedChangeIds: changeIds },
      result: { appliedAt: now, succeededChangeIds: [], failed: [], followUpProposalId: null }
    });
  }
  async regenerateWriteFailure(proposal, taskId, now, followUpProposalId) {
    const proposalTask = proposal.tasks.find((task) => task.taskId === taskId);
    if (!proposalTask) return null;
    const source = await this.tasks.readReviewedTask(proposalTask.taskId, proposalTask.path);
    if (source.status !== "ready") return null;
    const regenerated = await applyProposalDecision(
      { ...proposal, tasks: [proposalTask] },
      proposalTask.changes.map((change) => change.id),
      /* @__PURE__ */ new Map([[proposalTask.taskId, source.content]]),
      { decidedAt: now, followUpProposalId }
    );
    return regenerated.followUp?.tasks[0] ?? null;
  }
  folder() {
    return (0, import_obsidian14.normalizePath)(this.proposalFolder().trim() || "TaskMate/Proposals");
  }
  historyFolder() {
    return (0, import_obsidian14.normalizePath)(`${this.folder()}/History`);
  }
  proposalFile(proposalId) {
    if (!/^proposal-[A-Za-z0-9._-]+$/.test(proposalId)) throw new Error("Invalid Proposal id");
    const file = this.app.vault.getAbstractFileByPath((0, import_obsidian14.normalizePath)(`${this.folder()}/${proposalId}.json`));
    return file instanceof import_obsidian14.TFile ? file : null;
  }
  historyProposalFile(proposalId) {
    if (!/^proposal-[A-Za-z0-9._-]+$/.test(proposalId)) throw new Error("Invalid Proposal id");
    const file = this.app.vault.getAbstractFileByPath((0, import_obsidian14.normalizePath)(`${this.historyFolder()}/${proposalId}.json`));
    return file instanceof import_obsidian14.TFile ? file : null;
  }
  async archive(proposal) {
    const source = this.proposalFile(proposal.id);
    if (!source) throw new Error(`Proposal not found: ${proposal.id}`);
    await this.app.vault.modify(source, `${JSON.stringify(proposal, null, 2)}
`);
    await this.ensureFolder(this.historyFolder());
    await this.app.fileManager.renameFile(source, (0, import_obsidian14.normalizePath)(`${this.historyFolder()}/${proposal.id}.json`));
  }
  async ensureFolder(path) {
    const segments = (0, import_obsidian14.normalizePath)(path).split("/").filter(Boolean);
    let current = "";
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current);
    }
  }
};
function reindexChanges(tasks) {
  let index2 = 1;
  return tasks.map((task) => ({
    ...task,
    changes: task.changes.map((change) => ({ ...change, id: `C-${String(index2++).padStart(2, "0")}` }))
  }));
}
function summarize(proposal) {
  return {
    id: proposal.id,
    createdAt: proposal.createdAt,
    resultAt: proposal.result?.appliedAt,
    taskCount: proposal.tasks.length,
    changeCount: proposal.tasks.reduce((count, task) => count + task.changes.length, 0),
    status: proposal.status,
    succeededCount: proposal.result?.succeededChangeIds.length ?? 0,
    failedCount: proposal.result?.failed.reduce((count, failure) => count + failure.changeIds.length, 0) ?? 0,
    followUpProposalId: proposal.result?.followUpProposalId ?? null
  };
}

// src/reviews/task-change/review-view.ts
var import_obsidian15 = require("obsidian");

// src/reviews/task-change/review-renderer.ts
function createTaskChangeReviewState() {
  return { mode: "semantic", approvedChangeIds: /* @__PURE__ */ new Set() };
}
function reduceTaskChangeReviewState(state, action) {
  if (action.type === "set-mode") return { ...state, mode: action.mode };
  if (action.type === "set-approved") {
    const approvedChangeIds = new Set(state.approvedChangeIds);
    action.approved ? approvedChangeIds.add(action.changeId) : approvedChangeIds.delete(action.changeId);
    return { ...state, approvedChangeIds };
  }
  if (action.type === "set-many-approved") {
    const approvedChangeIds = new Set(state.approvedChangeIds);
    for (const id of action.changeIds) action.approved ? approvedChangeIds.add(id) : approvedChangeIds.delete(id);
    return { ...state, approvedChangeIds };
  }
  return state;
}
function renderTaskChangeReview(container, review, state, copy, dispatch, options = {}) {
  container.replaceChildren();
  container.classList.add("taskmate-review");
  const header = element("header", "taskmate-review-header", container);
  appendTextElement(header, "h2", copy.title);
  if (options.back) {
    const back = button(options.back.label, options.back.onClick);
    back.classList.add("taskmate-review-back");
    header.append(back);
  }
  const controls = element("div", "taskmate-review-controls", container);
  const allIds = review.tasks.flatMap((task) => task.changes.map((change) => change.id));
  const selectedAllCount = selectedCount(allIds, state.approvedChangeIds);
  if (!options.readOnly) {
    const selection = element("div", "taskmate-review-selection-actions", controls);
    selection.append(responsiveBulkButton(copy.selectAll, copy.selectAllShort, "taskmate-review-select-all", selectedAllCount === allIds.length, () => dispatch({ type: "set-many-approved", changeIds: allIds, approved: true })));
    selection.append(responsiveBulkButton(copy.clearAll, copy.clearAllShort, "taskmate-review-clear-all", selectedAllCount === 0, () => dispatch({ type: "set-many-approved", changeIds: allIds, approved: false })));
  }
  const displaySwitch = element("div", "taskmate-review-display-switch", controls);
  displaySwitch.setAttribute("role", "group");
  displaySwitch.setAttribute("aria-label", copy.comparisonAria);
  displaySwitch.append(modeButton(copy.semantic, copy.semanticAria, "taskmate-review-mode-semantic", state.mode === "semantic", () => dispatch({ type: "set-mode", mode: "semantic" })));
  displaySwitch.append(modeButton(copy.markdown, copy.markdownAria, "taskmate-review-mode-raw", state.mode === "raw", () => dispatch({ type: "set-mode", mode: "raw" })));
  const list = element("div", "taskmate-review-files", container);
  for (const task of review.tasks) {
    const section = element("section", "taskmate-review-file", list);
    section.id = `taskmate-review-${task.taskId}`;
    section.dataset.reviewAnchor = task.taskId;
    const fileHeader = element("div", "taskmate-review-file-header", section);
    const identity = element("div", "taskmate-review-file-identity", fileHeader);
    appendTextElement(identity, "h3", task.title);
    const taskIds = task.changes.map((change) => change.id);
    if (!options.readOnly && taskIds.length > 1) {
      const selectedTaskCount = selectedCount(taskIds, state.approvedChangeIds);
      const taskActions = element("div", "taskmate-review-file-actions", fileHeader);
      taskActions.append(bulkButton(copy.selectTask, "taskmate-review-select-task", selectedTaskCount === taskIds.length, () => dispatch({ type: "set-many-approved", changeIds: taskIds, approved: true })));
      taskActions.append(bulkButton(copy.clearTask, "taskmate-review-clear-task", selectedTaskCount === 0, () => dispatch({ type: "set-many-approved", changeIds: taskIds, approved: false })));
    }
    if (state.mode === "semantic") {
      for (const change of task.changes) {
        const row = element(options.readOnly ? "div" : "label", "taskmate-review-change", section);
        if (options.readOnly) row.classList.add("is-read-only");
        row.dataset.reviewAnchor = change.id;
        if (!options.readOnly) {
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = state.approvedChangeIds.has(change.id);
          checkbox.addEventListener("change", () => dispatch({ type: "set-approved", changeId: change.id, approved: checkbox.checked }));
          row.append(checkbox);
        }
        appendTextElement(row, "span", change.id, "taskmate-review-id");
        const details = element("span", "taskmate-review-change-details", row);
        appendTextElement(details, "strong", change.field);
        appendTextElement(details, "span", `${formatValue(change.before)} \u2192 ${formatValue(change.after)}`, "taskmate-review-values");
        appendTextElement(details, "span", change.reason, "taskmate-review-reason");
      }
    } else {
      const raw = element("pre", "taskmate-review-diff", section);
      for (const hunk of task.rawHunks) {
        appendTextElement(raw, "span", `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@
`, "taskmate-diff-header");
        for (const line of hunk.lines) {
          const className = line.startsWith("+") ? "taskmate-diff-add" : line.startsWith("-") ? "taskmate-diff-delete" : "taskmate-diff-context";
          appendTextElement(raw, "span", `${line}
`, className);
        }
      }
    }
  }
  if (!options.readOnly) {
    const footer = element("footer", "taskmate-review-footer", container);
    const apply = button(copy.apply, () => dispatch({
      type: "apply",
      approvedChangeIds: allIds.filter((id) => state.approvedChangeIds.has(id))
    }));
    apply.classList.add("taskmate-review-apply", "mod-cta");
    apply.disabled = state.approvedChangeIds.size === 0;
    apply.title = apply.disabled ? copy.noSelection : "";
    footer.append(apply);
    const reject = button(copy.reject, () => dispatch({ type: "reject" }));
    reject.classList.add("taskmate-review-reject", "mod-warning");
    footer.append(reject);
  }
}
function element(tag, className, parent) {
  const value = document.createElement(tag);
  value.className = className;
  parent?.append(value);
  return value;
}
function appendTextElement(parent, tag, text, className) {
  const value = document.createElement(tag);
  if (className) value.className = className;
  value.textContent = text;
  parent.append(value);
  return value;
}
function button(text, activate, active = false) {
  const value = document.createElement("button");
  value.type = "button";
  value.textContent = text;
  if (active) value.classList.add("is-active");
  value.addEventListener("click", activate);
  return value;
}
function bulkButton(text, className, disabled, activate) {
  const value = button(text, activate);
  value.classList.add(className);
  value.disabled = disabled;
  return value;
}
function responsiveBulkButton(longText, shortText, className, disabled, activate) {
  const value = bulkButton("", className, disabled, activate);
  value.setAttribute("aria-label", longText);
  appendTextElement(value, "span", longText, "taskmate-review-wide-label");
  appendTextElement(value, "span", shortText, "taskmate-review-compact-label");
  return value;
}
function modeButton(text, accessibleName, className, active, activate) {
  const value = button(text, activate, active);
  value.classList.add(className);
  value.setAttribute("aria-label", accessibleName);
  value.setAttribute("aria-pressed", String(active));
  return value;
}
function selectedCount(changeIds, selectedIds) {
  return changeIds.reduce((count, id) => count + (selectedIds.has(id) ? 1 : 0), 0);
}
function formatValue(value) {
  if (value === null) return "\u2014";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

// src/reviews/task-change/review-scroll.ts
function captureReviewPosition(container, kind) {
  const scrollTop = Math.max(0, container.scrollTop);
  if (kind === "scroll") return { kind, scrollTop };
  const top = container.getBoundingClientRect().top;
  const anchors = Array.from(container.querySelectorAll("[data-review-anchor]"));
  const nearest = anchors.reduce((best, item) => {
    if (!best) return item;
    return Math.abs(item.getBoundingClientRect().top - top) < Math.abs(best.getBoundingClientRect().top - top) ? item : best;
  }, null);
  const anchorId = nearest?.dataset.reviewAnchor;
  if (!nearest || !anchorId) return { kind: "scroll", scrollTop };
  return { kind, anchorId, offset: nearest.getBoundingClientRect().top - top, scrollTop };
}
function restoreReviewPosition(container, position) {
  if (!position) return;
  container.scrollTop = position.scrollTop;
  if (position.kind !== "anchor") return;
  const anchor = Array.from(container.querySelectorAll("[data-review-anchor]")).find((item) => item.dataset.reviewAnchor === position.anchorId);
  if (!anchor) return;
  const currentOffset = anchor.getBoundingClientRect().top - container.getBoundingClientRect().top;
  container.scrollTop = Math.max(0, position.scrollTop + currentOffset - position.offset);
}

// src/reviews/task-change/review-view.ts
var TASK_CHANGE_REVIEW_VIEW_TYPE = "taskmate-change-review";
function applyNoticeKind(outcome) {
  return outcome.succeeded === 0 && outcome.failed > 0 && outcome.hasFollowUp ? "stale-regenerated" : "applied";
}
async function openProposalInReviewView(activate, proposalId, taskId, changeId) {
  const view = await activate();
  await view.openProposal(proposalId, taskId, changeId);
}
var TaskChangeReviewView = class extends import_obsidian15.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  proposalId = null;
  targetTaskId = null;
  targetChangeId = null;
  review = null;
  indexMode = "pending";
  proposalSource = "pending";
  state = createTaskChangeReviewState();
  getViewType() {
    return TASK_CHANGE_REVIEW_VIEW_TYPE;
  }
  getDisplayText() {
    return this.plugin.i18n().t("review.title");
  }
  getIcon() {
    return "file-diff";
  }
  async onOpen() {
    await this.render();
  }
  requestRender() {
    void this.render("scroll");
  }
  async openIndex(mode = "pending") {
    this.proposalId = null;
    this.targetTaskId = null;
    this.targetChangeId = null;
    this.review = null;
    this.indexMode = mode;
    this.proposalSource = mode;
    this.state = createTaskChangeReviewState();
    await this.render();
  }
  async openProposal(proposalId, taskId, changeId) {
    this.proposalId = proposalId;
    this.targetTaskId = taskId ?? null;
    this.targetChangeId = changeId ?? null;
    this.proposalSource = "pending";
    this.state = createTaskChangeReviewState();
    await this.render();
  }
  async openHistoryProposal(proposalId) {
    this.proposalId = proposalId;
    this.proposalSource = "history";
    this.state = createTaskChangeReviewState();
    await this.render();
  }
  async render(preserve) {
    const position = preserve ? captureReviewPosition(this.contentEl, preserve) : null;
    this.contentEl.empty();
    if (!this.proposalId) {
      const proposals = this.indexMode === "pending" ? await this.plugin.proposals.listPending() : await this.plugin.proposals.listHistory();
      const root = this.contentEl.createDiv({ cls: "taskmate-review-index" });
      const tabs = root.createDiv({ cls: "taskmate-review-index-tabs" });
      for (const mode of ["pending", "history"]) {
        const tab = tabs.createEl("button", {
          text: this.plugin.i18n().t(mode === "pending" ? "review.pending" : "review.history"),
          cls: this.indexMode === mode ? "is-active" : ""
        });
        tab.addEventListener("click", () => {
          this.indexMode = mode;
          void this.render();
        });
      }
      if (proposals.length === 0) root.createDiv({ cls: "taskmate-empty", text: this.plugin.i18n().t(this.indexMode === "pending" ? "review.none" : "review.historyNone") });
      for (const proposal of proposals) {
        const open = root.createEl("button", { cls: "taskmate-review-index-item" });
        const identity = open.createSpan({ cls: "taskmate-review-index-identity" });
        identity.createSpan({ text: proposal.id });
        if (this.indexMode === "history") {
          identity.createSpan({
            cls: "taskmate-review-history-status",
            text: this.plugin.i18n().t(`review.status.${proposal.status}`)
          });
          identity.createSpan({
            cls: "taskmate-review-history-counts",
            text: this.plugin.i18n().t("review.historyCounts", {
              succeeded: proposal.succeededCount,
              failed: proposal.failedCount
            })
          });
        }
        open.createSpan({ cls: "taskmate-review-index-summary", text: this.plugin.i18n().t("review.summary", { tasks: proposal.taskCount, changes: proposal.changeCount }) });
        open.addEventListener("click", () => void (this.indexMode === "pending" ? this.openProposal(proposal.id) : this.openHistoryProposal(proposal.id)));
      }
      return;
    }
    try {
      this.review = this.proposalSource === "history" ? await this.plugin.proposals.reviewHistory(this.proposalId) : await this.plugin.proposals.review(this.proposalId);
      renderTaskChangeReview(this.contentEl, this.review, this.state, reviewCopy(this.plugin), (action) => void this.handle(action), {
        readOnly: this.proposalSource === "history",
        back: {
          label: this.plugin.i18n().t("common.back"),
          onClick: () => void this.openIndex(this.proposalSource)
        }
      });
      if (position) restoreReviewPosition(this.contentEl, position);
      else window.setTimeout(() => this.revealTarget(), 0);
    } catch (error) {
      console.error("TaskMate could not open Proposal", error);
      this.contentEl.createDiv({ cls: "taskmate-empty", text: this.plugin.i18n().t("review.invalid") });
    }
  }
  async handle(action) {
    let preserve = action.type === "set-mode" ? "anchor" : action.type === "set-approved" || action.type === "set-many-approved" ? "scroll" : void 0;
    this.state = reduceTaskChangeReviewState(this.state, action);
    if (action.type === "apply" && this.proposalId) {
      const result = await this.plugin.proposals.apply(this.proposalId, action.approvedChangeIds);
      const succeeded = result.closedProposal.result?.succeededChangeIds.length ?? 0;
      const failed = result.closedProposal.result?.failed.reduce((count, failure) => count + failure.changeIds.length, 0) ?? 0;
      const notice = applyNoticeKind({ succeeded, failed, hasFollowUp: result.followUp !== null });
      new import_obsidian15.Notice(notice === "stale-regenerated" ? this.plugin.i18n().t("review.staleRegenerated", { failed }) : this.plugin.i18n().t("review.applied", { count: succeeded }));
      this.proposalId = result.followUp?.id ?? null;
      this.state = createTaskChangeReviewState();
      preserve = void 0;
    }
    if (action.type === "reject" && this.proposalId) {
      if (!window.confirm(this.plugin.i18n().t("review.rejectConfirm"))) return;
      await this.plugin.proposals.reject(this.proposalId);
      this.proposalId = null;
      new import_obsidian15.Notice(this.plugin.i18n().t("review.rejected"));
      preserve = void 0;
    }
    await this.render(preserve);
  }
  revealTarget() {
    if (!this.targetTaskId) return;
    const target = this.contentEl.querySelector(`#taskmate-review-${CSS.escape(this.targetTaskId)}`);
    target?.scrollIntoView({ block: "start" });
    if (this.targetChangeId) {
      for (const label of Array.from(target?.querySelectorAll(".taskmate-review-change") ?? [])) {
        if (label.textContent?.includes(this.targetChangeId)) label.classList.add("is-target");
      }
    }
    this.targetTaskId = null;
    this.targetChangeId = null;
  }
};
function reviewCopy(plugin) {
  const { t } = plugin.i18n();
  return {
    title: t("review.title"),
    apply: t("review.apply"),
    reject: t("review.reject"),
    selectAll: t("review.selectAll"),
    selectAllShort: t("review.selectAllShort"),
    selectTask: t("review.selectTask"),
    clearAll: t("review.clearAll"),
    clearAllShort: t("review.clearAllShort"),
    clearTask: t("review.clearTask"),
    semantic: t("review.semantic"),
    semanticAria: t("review.semanticAria"),
    markdown: t("review.markdown"),
    markdownAria: t("review.markdownAria"),
    comparisonAria: t("review.comparisonAria"),
    noSelection: t("review.noSelection")
  };
}

// src/main.ts
var TaskMatePlugin = class extends import_obsidian16.Plugin {
  settings = DEFAULT_SETTINGS;
  repository;
  projects;
  proposals;
  refreshTimer = null;
  async onload() {
    await this.loadSettings();
    const { t } = this.i18n();
    this.repository = new TaskRepository(this.app, () => this.settings.taskFolder);
    this.projects = new ProjectRepository(this.app, () => this.settings.projectFolder);
    this.proposals = new TaskChangeProposalRepository(this.app, () => this.settings.proposalFolder, this.repository);
    try {
      const migrated = await this.repository.migrateLegacyFileNames();
      if (migrated > 0) new import_obsidian16.Notice(t("notice.migratedTaskNames", { count: migrated }));
    } catch (error) {
      console.error("TaskMate could not migrate legacy task filenames", error);
      new import_obsidian16.Notice(t("notice.migrationFailed"));
    }
    this.registerView(TODO_VIEW_TYPE, (leaf) => new TodoListView(leaf, this));
    this.registerView(TASK_CHANGE_REVIEW_VIEW_TYPE, (leaf) => new TaskChangeReviewView(leaf, this));
    this.addSettingTab(new TaskMateSettingTab(this.app, this));
    this.addRibbonIcon("circle-check-big", t("command.openRibbon"), () => void this.activateView());
    this.addCommand({ id: "open-todo-list", name: t("command.openList"), callback: () => void this.activateView() });
    this.addCommand({ id: "open-task-change-reviews", name: t("command.openReviews"), callback: () => void this.openReviewIndex() });
    this.registerObsidianProtocolHandler("taskmate-review", async (params) => {
      const proposalId = params.proposal;
      if (!proposalId || !/^proposal-[A-Za-z0-9._-]+$/.test(proposalId)) {
        new import_obsidian16.Notice(this.i18n().t("review.invalidLink"));
        return;
      }
      const taskId = typeof params.task === "string" && /^[A-Za-z0-9._-]+$/.test(params.task) ? params.task : void 0;
      const changeId = typeof params.change === "string" && /^C-[0-9]{2,}$/.test(params.change) ? params.change : void 0;
      await this.openProposalReview(proposalId, taskId, changeId);
    });
    this.addCommand({
      id: "include-current-note-as-ai-source",
      name: t("command.includeNote"),
      checkCallback: (checking) => this.setCurrentNoteSource(true, checking)
    });
    this.addCommand({
      id: "exclude-current-note-as-ai-source",
      name: t("command.excludeNote"),
      checkCallback: (checking) => this.setCurrentNoteSource(false, checking)
    });
    this.addCommand({
      id: "include-current-folder-as-ai-source",
      name: t("command.includeFolder"),
      checkCallback: (checking) => this.includeCurrentFolder(checking)
    });
    const scheduleRefresh = (file) => {
      const taskPrefix = `${(0, import_obsidian16.normalizePath)(this.settings.taskFolder)}/`;
      const projectPrefix = `${(0, import_obsidian16.normalizePath)(this.settings.projectFolder)}/`;
      const proposalPrefix = `${(0, import_obsidian16.normalizePath)(this.settings.proposalFolder)}/`;
      if (!file.path.startsWith(taskPrefix) && !file.path.startsWith(projectPrefix) && !file.path.startsWith(proposalPrefix)) return;
      if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
      this.refreshTimer = window.setTimeout(() => {
        this.refreshViews();
        for (const leaf of this.app.workspace.getLeavesOfType(TASK_CHANGE_REVIEW_VIEW_TYPE)) {
          if (leaf.view instanceof TaskChangeReviewView) leaf.view.requestRender();
        }
      }, 100);
    };
    this.registerEvent(this.app.vault.on("create", (file) => {
      if (file instanceof import_obsidian16.TFile) scheduleRefresh(file);
    }));
    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (file instanceof import_obsidian16.TFile) scheduleRefresh(file);
    }));
    this.registerEvent(this.app.vault.on("delete", (file) => {
      if (file instanceof import_obsidian16.TFile) scheduleRefresh(file);
    }));
    this.registerEvent(this.app.vault.on("rename", (file) => {
      if (file instanceof import_obsidian16.TFile) scheduleRefresh(file);
    }));
  }
  onunload() {
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
  }
  async activateView() {
    let leaf = this.app.workspace.getLeavesOfType(TODO_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf(false);
      await leaf.setViewState({ type: TODO_VIEW_TYPE, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
  }
  async activateReviewView() {
    let leaf = this.app.workspace.getLeavesOfType(TASK_CHANGE_REVIEW_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf(false);
      await leaf.setViewState({ type: TASK_CHANGE_REVIEW_VIEW_TYPE, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
    return leaf.view;
  }
  async openReviewIndex() {
    const view = await this.activateReviewView();
    await view.openIndex();
  }
  async openProposalReview(proposalId, taskId, changeId) {
    await openProposalInReviewView(() => this.activateReviewView(), proposalId, taskId, changeId);
  }
  refreshViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(TODO_VIEW_TYPE)) {
      if (leaf.view instanceof TodoListView) leaf.view.requestRender();
    }
  }
  i18n() {
    return createI18n(this.settings.language, detectObsidianLanguage());
  }
  async loadSettings() {
    const loaded = await this.loadData();
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...loaded,
      language: loaded?.language === void 0 ? "auto" : isLanguagePreference(loaded.language) ? loaded.language : "en"
    };
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  setCurrentNoteSource(value, checking) {
    const file = this.app.workspace.getActiveFile();
    if (!file) return false;
    if (!checking) {
      void this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        frontmatter["taskmate-source"] = value;
      }).then(() => {
        const { t } = this.i18n();
        new import_obsidian16.Notice(value ? t("notice.noteIncluded") : t("notice.noteExcluded"));
      });
    }
    return true;
  }
  includeCurrentFolder(checking) {
    const file = this.app.workspace.getActiveFile();
    const folder = file?.parent?.path;
    if (!file || !folder || folder === "/") return false;
    if (!checking) {
      const normalized = (0, import_obsidian16.normalizePath)(folder);
      if (!this.settings.sourceFolders.includes(normalized)) this.settings.sourceFolders.push(normalized);
      void this.saveSettings().then(() => new import_obsidian16.Notice(this.i18n().t("notice.folderIncluded", { folder: normalized })));
    }
    return true;
  }
};
/*! Bundled license information:

sortablejs/modular/sortable.esm.js:
  (**!
   * Sortable 1.15.7
   * @author	RubaXa   <trash@rubaxa.org>
   * @author	owenm    <owen23355@gmail.com>
   * @license MIT
   *)
*/
