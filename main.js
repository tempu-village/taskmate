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
var import_obsidian10 = require("obsidian");

// src/repository.ts
var import_obsidian = require("obsidian");

// src/markdown.ts
var FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
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
  const notes = lines.filter((_, index2) => index2 !== heading).join("\n").trim();
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
    notes
  };
}
function encodeTask(task) {
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
  return `${frontmatter}

# ${task.title.trim()}${notes ? `

${notes}` : ""}
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

// src/repository.ts
var RANK_STEP = 1024;
function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
var TaskRepository = class {
  constructor(app, taskFolder) {
    this.app = app;
    this.taskFolder = taskFolder;
  }
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
  async list() {
    const prefix = `${this.folder()}/`;
    const files = this.app.vault.getMarkdownFiles().filter((file) => file.path.startsWith(prefix));
    const tasks = await Promise.all(files.map(async (file) => parseTaskMarkdown(file.path, await this.app.vault.cachedRead(file))));
    return tasks.filter((task) => task !== null);
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
    const file = this.app.vault.getAbstractFileByPath(task.path);
    if (!(file instanceof import_obsidian.TFile)) throw new Error(`Task file not found: ${task.path}`);
    let updated = task;
    await this.app.vault.process(file, (content) => {
      const current = parseTaskMarkdown(task.path, content);
      if (!current) throw new Error(`Invalid task file: ${task.path}`);
      const completed = patch.completed ?? current.completed;
      updated = {
        ...current,
        ...patch,
        completed,
        completedAt: completed ? current.completedAt ?? (/* @__PURE__ */ new Date()).toISOString() : null,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      return encodeTask(updated);
    });
    const desiredPath = this.availableTaskPath(updated.title, task.path);
    if (desiredPath !== file.path) {
      await this.app.fileManager.renameFile(file, desiredPath);
      updated = { ...updated, path: desiredPath };
    }
    return updated;
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
    const file = this.app.vault.getAbstractFileByPath(task.path);
    if (file instanceof import_obsidian.TFile) await this.app.vault.trash(file, true);
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
};

// src/project-repository.ts
var import_obsidian2 = require("obsidian");

// src/project-markdown.ts
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

// src/project-repository.ts
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

// src/view.ts
var import_obsidian8 = require("obsidian");

// src/bulk-task-modal.ts
var import_obsidian4 = require("obsidian");

// src/domain.ts
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
    return needle.length === 0 || `${task.title}
${task.notes}
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

// src/task-input-suggestions.ts
function taskDateSuggestions(today = todayKey()) {
  return [
    { id: "today", date: today },
    { id: "tomorrow", date: addDays(today, 1) },
    { id: "seven-days", date: addDays(today, 7) },
    { id: "none", date: null }
  ];
}
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

// src/bulk-task-modal.ts
var BulkTaskModal = class extends import_obsidian4.Modal {
  constructor(app, count, projects, i18n, onApply) {
    super(app);
    this.count = count;
    this.projects = projects;
    this.i18n = i18n;
    this.onApply = onApply;
    this.setTitle(i18n.t("bulk.title", { count }));
  }
  changes = { addLabels: [], removeLabels: [] };
  onOpen() {
    const { t } = this.i18n;
    const date = new import_obsidian4.Setting(this.contentEl).setName(t("taskModal.date"));
    let dateInput = null;
    date.addDropdown((dropdown) => dropdown.addOption("unchanged", t("bulk.unchanged")).addOption("clear", t("date.none")).addOption("set", t("bulk.setValue")).onChange((value) => {
      if (value === "unchanged") delete this.changes.date;
      else if (value === "clear") this.changes.date = null;
      else this.changes.date = dateInput?.value || null;
      if (dateInput) dateInput.disabled = value !== "set";
    }));
    date.addText((text) => {
      text.inputEl.type = "date";
      text.inputEl.disabled = true;
      dateInput = text.inputEl;
      text.onChange((value) => {
        if (!text.inputEl.disabled) this.changes.date = value || null;
      });
    });
    new import_obsidian4.Setting(this.contentEl).setName(t("taskModal.project")).addDropdown((dropdown) => {
      dropdown.addOption("unchanged", t("bulk.unchanged")).addOption("clear", t("taskModal.unassigned"));
      this.projects.forEach((project) => dropdown.addOption(project.id, project.name));
      dropdown.onChange((value) => {
        if (value === "unchanged") delete this.changes.projectId;
        else this.changes.projectId = value === "clear" ? null : value;
      });
    });
    new import_obsidian4.Setting(this.contentEl).setName(t("taskModal.priority")).addDropdown((dropdown) => dropdown.addOption("unchanged", t("bulk.unchanged")).addOption("clear", t("taskModal.noPriority")).addOption("1", t("filter.priorityValue", { priority: 1 })).addOption("2", t("filter.priorityValue", { priority: 2 })).addOption("3", t("filter.priorityValue", { priority: 3 })).onChange((value) => {
      if (value === "unchanged") delete this.changes.priority;
      else this.changes.priority = value === "clear" ? null : Number(value);
    }));
    new import_obsidian4.Setting(this.contentEl).setName(t("bulk.addLabels")).addText((text) => text.onChange((value) => {
      this.changes.addLabels = normalizeLabels(value.split(",")).slice(0, 500);
    }));
    new import_obsidian4.Setting(this.contentEl).setName(t("bulk.removeLabels")).addText((text) => text.onChange((value) => {
      this.changes.removeLabels = normalizeLabels(value.split(",")).slice(0, 500);
    }));
    const actions = this.contentEl.createDiv({ cls: "taskmate-modal-actions" });
    const cancel = actions.createEl("button", { text: t("common.cancel") });
    cancel.addEventListener("click", () => this.close());
    const apply = actions.createEl("button", { text: t("bulk.apply", { count: this.count }), cls: "mod-cta" });
    apply.addEventListener("click", async () => {
      apply.disabled = true;
      try {
        await this.onApply(this.changes);
        this.close();
      } finally {
        apply.disabled = false;
      }
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/bulk-task-actions.ts
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
  "common.add": "+ Add",
  "common.edit": "Edit",
  "common.delete": "Delete",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.back": "Back",
  "common.clear": "Clear",
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
  "filter.labelSearchPlaceholder": "Search labels",
  "filter.labelSearchAriaLabel": "Search labels",
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
  "filter.labelsDescription": "Comma-separated labels. A task matches any selected label.",
  "filter.labelsPlaceholder": "work, calls",
  "adjust.ariaLabel": "View and task actions",
  "adjust.ariaLabelActive": "View and task actions, {count} active filters",
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
  "tasks.reorderAriaLabel": "Reorder tasks",
  "tasks.completeAriaLabel": "Complete {title}",
  "tasks.moreAriaLabel": "More actions",
  "tasks.selectAriaLabel": "Select {title}",
  "tasks.deleteConfirm": "Move \u201C{title}\u201D to the trash?",
  "tasks.deletedNotice": "Task moved to the trash",
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
  "taskModal.labelsDescription": "Comma-separated, up to 500 unique labels",
  "taskModal.labelsPlaceholder": "work, calls",
  "taskModal.recentLabels": "Recently used labels",
  "taskModal.notes": "Notes",
  "bulk.title": "Edit {count} tasks",
  "bulk.unchanged": "No change",
  "bulk.setValue": "Set a date",
  "bulk.addLabels": "Add labels",
  "bulk.removeLabels": "Remove labels",
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
  "common.add": "\uFF0B \u8FFD\u52A0",
  "common.edit": "\u7DE8\u96C6",
  "common.delete": "\u524A\u9664",
  "common.cancel": "\u30AD\u30E3\u30F3\u30BB\u30EB",
  "common.save": "\u4FDD\u5B58",
  "common.back": "\u623B\u308B",
  "common.clear": "\u6D88\u53BB",
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
  "filter.labelSearchPlaceholder": "\u30E9\u30D9\u30EB\u3092\u691C\u7D22",
  "filter.labelSearchAriaLabel": "\u30E9\u30D9\u30EB\u3092\u691C\u7D22",
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
  "filter.labelsDescription": "\u30AB\u30F3\u30DE\u533A\u5207\u308A\u3002\u9078\u629E\u3057\u305F\u3044\u305A\u308C\u304B\u306E\u30E9\u30D9\u30EB\u3092\u542B\u3080\u30BF\u30B9\u30AF\u3092\u8868\u793A\u3057\u307E\u3059\u3002",
  "filter.labelsPlaceholder": "\u4ED5\u4E8B, \u9023\u7D61",
  "adjust.ariaLabel": "\u8868\u793A\u3068\u30BF\u30B9\u30AF\u306E\u64CD\u4F5C",
  "adjust.ariaLabelActive": "\u8868\u793A\u3068\u30BF\u30B9\u30AF\u306E\u64CD\u4F5C\u3001{count}\u4EF6\u306E\u30D5\u30A3\u30EB\u30BF\u304C\u6709\u52B9",
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
  "tasks.reorderAriaLabel": "\u30BF\u30B9\u30AF\u3092\u4E26\u3079\u66FF\u3048",
  "tasks.completeAriaLabel": "{title}\u3092\u5B8C\u4E86",
  "tasks.moreAriaLabel": "\u305D\u306E\u4ED6",
  "tasks.selectAriaLabel": "{title}\u3092\u9078\u629E",
  "tasks.deleteConfirm": "\u300C{title}\u300D\u3092\u30B4\u30DF\u7BB1\u3078\u79FB\u52D5\u3057\u307E\u3059\u304B\uFF1F",
  "tasks.deletedNotice": "\u30BF\u30B9\u30AF\u3092\u30B4\u30DF\u7BB1\u3078\u79FB\u52D5\u3057\u307E\u3057\u305F",
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
  "taskModal.labelsDescription": "\u30AB\u30F3\u30DE\u533A\u5207\u308A\u3001\u6700\u5927500\u7A2E\u985E",
  "taskModal.labelsPlaceholder": "\u4ED5\u4E8B, \u9023\u7D61",
  "taskModal.recentLabels": "\u6700\u8FD1\u4F7F\u3063\u305F\u30E9\u30D9\u30EB",
  "taskModal.notes": "\u30E1\u30E2",
  "bulk.title": "{count}\u4EF6\u3092\u4E00\u62EC\u7DE8\u96C6",
  "bulk.unchanged": "\u5909\u66F4\u3057\u306A\u3044",
  "bulk.setValue": "\u65E5\u4ED8\u3092\u6307\u5B9A",
  "bulk.addLabels": "\u8FFD\u52A0\u3059\u308B\u30E9\u30D9\u30EB",
  "bulk.removeLabels": "\u524A\u9664\u3059\u308B\u30E9\u30D9\u30EB",
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

// src/filter-modal.ts
var import_obsidian5 = require("obsidian");
var TaskFilterModal = class extends import_obsidian5.Modal {
  constructor(app, filters, i18n, onApply) {
    super(app);
    this.i18n = i18n;
    this.onApply = onApply;
    this.draft = { ...filters, priorities: [...filters.priorities], labels: [...filters.labels] };
    this.setTitle(i18n.t("filter.title"));
  }
  draft;
  onOpen() {
    const { t } = this.i18n;
    const priority = new import_obsidian5.Setting(this.contentEl).setName(t("filter.priority"));
    [1, 2, 3].forEach((value) => priority.addButton((button) => {
      const refresh = () => {
        const selected = this.draft.priorities.includes(value);
        button.buttonEl.toggleClass("is-active", selected);
        button.buttonEl.toggleClass("mod-cta", selected);
      };
      button.setButtonText(`P${value}`).setTooltip(t("filter.priorityValue", { priority: value })).onClick(() => {
        this.draft.priorities = this.draft.priorities.includes(value) ? this.draft.priorities.filter((item) => item !== value) : [...this.draft.priorities, value];
        refresh();
      });
      refresh();
    }));
    new import_obsidian5.Setting(this.contentEl).setName(t("filter.labels")).setDesc(t("filter.labelsDescription")).addText((text) => text.setPlaceholder(t("filter.labelsPlaceholder")).setValue(this.draft.labels.join(", ")).onChange((value) => {
      this.draft.labels = normalizeLabels(value.split(",")).slice(0, 500);
    }));
    new import_obsidian5.Setting(this.contentEl).setName(t("filter.completion")).addToggle((toggle) => toggle.setValue(this.draft.includeCompleted).onChange((value) => {
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

// src/project-modal.ts
var import_obsidian6 = require("obsidian");
var ProjectModal = class extends import_obsidian6.Modal {
  constructor(app, i18n, onSave) {
    super(app);
    this.i18n = i18n;
    this.onSave = onSave;
    this.setTitle(i18n.t("projectModal.addTitle"));
  }
  name = "";
  onOpen() {
    const { t } = this.i18n;
    new import_obsidian6.Setting(this.contentEl).setName(t("projectModal.name")).addText((text) => {
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

// src/task-modal.ts
var import_obsidian7 = require("obsidian");
var DATE_SUGGESTION_KEYS = {
  today: "date.today",
  tomorrow: "date.tomorrow",
  "seven-days": "date.sevenDays",
  none: "date.none"
};
var TaskModal = class extends import_obsidian7.Modal {
  constructor(app, task, projects, recentLabels, defaultProjectId, i18n, onSave, onDelete = null) {
    super(app);
    this.projects = projects;
    this.recentLabels = recentLabels;
    this.i18n = i18n;
    this.onSave = onSave;
    this.onDelete = onDelete;
    this.draft = {
      title: task?.title ?? "",
      date: task?.date ?? null,
      priority: task?.priority ?? null,
      labels: task?.labels ?? [],
      projectId: task?.projectId ?? defaultProjectId,
      notes: task?.notes ?? "",
      sourceNote: task?.sourceNote ?? null
    };
    this.setTitle(task ? i18n.t("taskModal.editTitle") : i18n.t("taskModal.addTitle"));
  }
  draft;
  onOpen() {
    const { contentEl } = this;
    const { t } = this.i18n;
    this.modalEl.addClass("taskmate-task-modal");
    const fields = contentEl.createDiv({ cls: "taskmate-task-fields" });
    const titleSetting = new import_obsidian7.Setting(fields).setName(t("taskModal.title"));
    titleSetting.settingEl.addClass("taskmate-title-setting");
    titleSetting.addText((text) => {
      text.setPlaceholder(t("taskModal.titlePlaceholder")).setValue(this.draft.title).onChange((value) => {
        this.draft.title = value;
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });
    const dateSetting = new import_obsidian7.Setting(fields).setName(t("taskModal.date"));
    dateSetting.settingEl.addClass("taskmate-date-setting");
    const datePresets = dateSetting.controlEl.createDiv({ cls: "taskmate-date-presets" });
    const dateButtons = [];
    let dateInput;
    const refreshDateSelection = () => {
      for (const button of dateButtons) {
        const selected = button.dataset.date === (this.draft.date ?? "");
        button.toggleClass("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
      }
    };
    for (const suggestion of taskDateSuggestions()) {
      const button = datePresets.createEl("button", {
        cls: "taskmate-suggestion-chip",
        attr: { type: "button", "aria-pressed": "false" }
      });
      button.dataset.date = suggestion.date ?? "";
      button.createSpan({ text: t(DATE_SUGGESTION_KEYS[suggestion.id]) });
      button.addEventListener("click", () => {
        this.draft.date = suggestion.date;
        dateInput.value = suggestion.date ?? "";
        refreshDateSelection();
      });
      dateButtons.push(button);
    }
    dateSetting.addText((text) => {
      text.inputEl.type = "date";
      text.inputEl.addClass("taskmate-date-input");
      dateInput = text.inputEl;
      text.setValue(this.draft.date ?? "").onChange((value) => {
        this.draft.date = value || null;
        refreshDateSelection();
      });
    });
    refreshDateSelection();
    new import_obsidian7.Setting(fields).setName(t("taskModal.project")).addDropdown((dropdown) => {
      dropdown.addOption("", t("taskModal.unassigned"));
      for (const project of this.projects) dropdown.addOption(project.id, project.name);
      dropdown.setValue(this.draft.projectId ?? "").onChange((value) => {
        this.draft.projectId = value || null;
      });
    });
    new import_obsidian7.Setting(fields).setName(t("taskModal.priority")).addDropdown((dropdown) => {
      dropdown.addOption("", t("taskModal.noPriority")).addOption("1", t("filter.priorityValue", { priority: 1 })).addOption("2", t("filter.priorityValue", { priority: 2 })).addOption("3", t("filter.priorityValue", { priority: 3 })).setValue(this.draft.priority ? String(this.draft.priority) : "").onChange((value) => {
        this.draft.priority = value ? Number(value) : null;
      });
    });
    const labelSetting = new import_obsidian7.Setting(fields).setName(t("taskModal.labels")).setDesc(t("taskModal.labelsDescription"));
    let labelInput;
    const recentLabelButtons = [];
    const refreshLabelSelection = () => {
      for (const button of recentLabelButtons) {
        const selected = this.draft.labels.includes(button.dataset.label ?? "");
        button.toggleClass("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
      }
    };
    labelSetting.addText((text) => {
      text.setPlaceholder(t("taskModal.labelsPlaceholder")).setValue(this.draft.labels.join(", ")).onChange((value) => {
        this.draft.labels = normalizeLabels(value.split(",")).slice(0, 500);
        refreshLabelSelection();
      });
      labelInput = text.inputEl;
    });
    const labelSuggestions = recentLabelSuggestions(this.recentLabels);
    if (labelSuggestions.length > 0) {
      const recent = fields.createDiv({ cls: "taskmate-recent-labels" });
      recent.createDiv({ text: t("taskModal.recentLabels"), cls: "taskmate-suggestion-heading" });
      const chips = recent.createDiv({ cls: "taskmate-suggestion-chips" });
      for (const label of labelSuggestions) {
        const button = chips.createEl("button", {
          text: label,
          cls: "taskmate-suggestion-chip",
          attr: { type: "button", "aria-pressed": "false" }
        });
        button.dataset.label = label;
        button.addEventListener("click", () => {
          this.draft.labels = this.draft.labels.includes(label) ? this.draft.labels.filter((item) => item !== label) : [...this.draft.labels, label].slice(0, 500);
          labelInput.value = this.draft.labels.join(", ");
          refreshLabelSelection();
        });
        recentLabelButtons.push(button);
      }
      refreshLabelSelection();
    }
    const notesSetting = new import_obsidian7.Setting(fields).setName(t("taskModal.notes"));
    notesSetting.settingEl.addClass("taskmate-notes-setting");
    notesSetting.addTextArea((area) => {
      area.inputEl.rows = 7;
      area.setValue(this.draft.notes).onChange((value) => {
        this.draft.notes = value;
      });
    });
    const actions = contentEl.createDiv({ cls: "taskmate-modal-actions" });
    if (this.onDelete) {
      const remove = actions.createEl("button", { cls: "taskmate-delete-task" });
      (0, import_obsidian7.setIcon)(remove, "trash-2");
      remove.createSpan({ text: t("common.delete") });
      remove.addEventListener("click", async () => {
        if (!window.confirm(t("tasks.deleteConfirm", { title: this.draft.title }))) return;
        remove.disabled = true;
        try {
          await this.onDelete?.();
          this.close();
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
      save2.disabled = true;
      try {
        await this.onSave(this.draft);
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

// src/task-list-model.ts
function toRow(task, projectNames) {
  return {
    id: task.id,
    title: task.title,
    completed: task.completed,
    date: task.date,
    priority: task.priority,
    projectName: task.projectId ? projectNames.get(task.projectId) ?? null : null,
    labels: task.labels.slice(0, 3),
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
Sortable.get = function(element) {
  return element[expando];
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

// src/task-list-renderer.ts
function appendElement(parent, tag, options = {}) {
  const element = parent.ownerDocument.createElement(tag);
  if (options.className) element.className = options.className;
  if (options.text !== void 0) element.textContent = options.text;
  Object.entries(options.attributes ?? {}).forEach(([name, value]) => element.setAttribute(name, value));
  parent.append(element);
  return element;
}
function renderRow(list, row, reorderEnabled, selectionMode, copy, signal, dispatch) {
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
    const drag = appendElement(task, "button", {
      className: "taskmate-drag",
      text: "\u283F",
      attributes: { "aria-label": copy.reorderAriaLabel }
    });
    drag.disabled = !reorderEnabled;
    const checkbox = appendElement(task, "input", {
      attributes: { type: "checkbox", "aria-label": copy.completeAriaLabel(row.title) }
    });
    checkbox.checked = row.completed;
    checkbox.addEventListener("change", () => {
      void dispatch({ type: "toggle-completed", taskId: row.id, completed: checkbox.checked });
    }, { signal });
  }
  const body = appendElement(task, "div", { className: "taskmate-task-body" });
  const title = appendElement(body, "button", { className: "taskmate-title", text: row.title });
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
  row.labels.forEach((label) => appendElement(metadata, "span", { text: `#${label}` }));
}
function renderTaskList(container, model, copy, dispatch) {
  const AbortControllerClass = container.ownerDocument.defaultView?.AbortController ?? AbortController;
  const controller = new AbortControllerClass();
  const list = appendElement(container, "div", {
    className: `taskmate-list${model.grouping === "scheduled" ? " taskmate-scheduled-list" : ""}${model.selectionMode ? " is-selection-mode" : ""}`,
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
    section.rows.forEach((row) => renderRow(list, row, model.reorderEnabled, model.selectionMode, copy, controller.signal, dispatch));
  });
  const sortable = sortable_esm_default.create(list, {
    animation: 140,
    handle: ".taskmate-drag",
    draggable: ".taskmate-task",
    disabled: !model.reorderEnabled,
    delay: 120,
    delayOnTouchOnly: true,
    touchStartThreshold: 4,
    onEnd: (event) => {
      if (event.oldIndex === event.newIndex) return;
      const orderedIds = Array.from(list.querySelectorAll(".taskmate-task")).map((element) => element.dataset.taskId ?? "");
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

// src/task-filter-state.ts
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

// src/view.ts
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
var TodoListView = class extends import_obsidian8.ItemView {
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
  selectionMode = false;
  selectedTaskIds = /* @__PURE__ */ new Set();
  selectionScopeIds = /* @__PURE__ */ new Set();
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
  requestRender() {
    void this.render();
  }
  async render() {
    const currentGeneration = ++this.generation;
    const [tasks, projects] = await Promise.all([this.plugin.repository.list(), this.plugin.projects.list()]);
    if (currentGeneration !== this.generation) return;
    this.destroyTaskList();
    const root = this.contentEl;
    root.empty();
    root.addClass("taskmate-view");
    const page = root.createDiv({ cls: "taskmate-page" });
    if (this.selectionMode) this.renderSelectionToolbar(page, tasks);
    else this.renderNavigation(page);
    if (this.screen === "search") {
      this.renderSearchScreen(page, tasks, projects);
    } else if (this.screen === "date") {
      this.renderDateScreen(page, tasks, projects);
    } else {
      const content = page.createDiv({ cls: "taskmate-content taskmate-scroll-region" });
      this.renderProjectsScreen(content, tasks, projects);
    }
  }
  renderHeader(container, title, addTaskProjectId, selectionScope) {
    const { t } = this.plugin.i18n();
    const header = container.createDiv({ cls: "taskmate-header" });
    header.createEl("h2", { text: title });
    if (!this.selectionMode && selectionScope) this.renderAdjustMenu(header, selectionScope);
    if (!this.selectionMode && addTaskProjectId !== void 0) {
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
      const button = tabs.createEl("button", {
        cls: view === this.smartView ? "is-active" : "",
        attr: { role: "tab", "aria-selected": String(view === this.smartView) }
      });
      button.createSpan({ text: t(SMART_VIEW_KEYS[view]) });
      button.addEventListener("click", () => {
        this.smartView = view;
        this.requestRender();
      });
      button.disabled = this.selectionMode;
    });
    this.renderSortControl(controls);
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
    input.disabled = this.selectionMode;
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
    if (!this.selectionMode && recent.length > 0) {
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
        const button = words.createEl("button", { text: word });
        button.addEventListener("click", () => {
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
      if (!this.selectionMode) {
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
      new import_obsidian8.Notice(t("projects.deletedNotice"));
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
      const button = options.createEl("button", {
        cls: selected ? "is-active" : "",
        attr: {
          type: "button",
          "aria-pressed": String(selected),
          "aria-label": selected && mode !== "manual" ? t("sort.activeOptionAriaLabel", { mode: t(SORT_KEYS[mode]), direction: directionLabel }) : t(SORT_KEYS[mode])
        }
      });
      button.createSpan({ text: t(SORT_KEYS[mode]) });
      if (selected && mode !== "manual") {
        button.createSpan({ text: this.sortDirection === "asc" ? "\u2191" : "\u2193", cls: "taskmate-sort-direction", attr: { "aria-hidden": "true" } });
      }
      button.addEventListener("click", () => {
        if (mode === this.sortMode && mode !== "manual") {
          this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
        } else {
          this.sortMode = mode;
          this.sortDirection = "asc";
        }
        this.requestRender();
      });
      button.disabled = this.selectionMode;
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
      selectionMode: this.selectionMode,
      selectedIds: this.selectedTaskIds
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
      selectionMode: this.selectionMode,
      selectedIds: this.selectedTaskIds
    });
    this.mountTaskList(container, model, source);
  }
  taskListCopy() {
    const { t } = this.plugin.i18n();
    return {
      empty: t("tasks.empty"),
      reorderAriaLabel: t("tasks.reorderAriaLabel"),
      completeAriaLabel: (title) => t("tasks.completeAriaLabel", { title }),
      selectAriaLabel: (title) => t("tasks.selectAriaLabel", { title }),
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
      if (this.selectedTaskIds.has(task.id)) this.selectedTaskIds.delete(task.id);
      else this.selectedTaskIds.add(task.id);
      this.requestRender();
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
      const button = navigation.createEl("button", {
        cls: item.screen === this.screen ? "is-active" : "",
        attr: { "aria-current": item.screen === this.screen ? "page" : "false" }
      });
      button.createSpan({ text: item.icon, cls: "taskmate-nav-icon" });
      button.createSpan({ text: t(item.labelKey) });
      button.addEventListener("click", () => {
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
    const button = header.createEl("button", {
      cls: `taskmate-adjust${count > 0 ? " is-active" : ""}`,
      attr: { "aria-label": count > 0 ? t("adjust.ariaLabelActive", { count }) : t("adjust.ariaLabel") }
    });
    (0, import_obsidian8.setIcon)(button, "sliders-horizontal");
    if (count > 0) button.createSpan({ text: String(count), cls: "taskmate-adjust-count" });
    button.addEventListener("click", (event) => {
      const menu = new import_obsidian8.Menu();
      const scope = selectionScope();
      menu.addItem((item) => item.setTitle(t("selection.start")).setIcon("list-checks").setDisabled(scope.length === 0).onClick(() => {
        this.selectionScopeIds = new Set(scope.map((task) => task.id));
        this.selectedTaskIds.clear();
        this.selectionMode = true;
        this.requestRender();
      }));
      menu.addItem((item) => item.setTitle(count > 0 ? t("filter.change") : t("filter.title")).setIcon("list-filter").onClick(() => this.openFilterModal()));
      if (count > 0) {
        menu.addSeparator();
        menu.addItem((item) => item.setTitle(t("filter.clearActive")).setIcon("filter-x").onClick(() => this.clearActiveFilters()));
      }
      menu.showAtMouseEvent(event);
    });
  }
  renderSelectionToolbar(root, tasks) {
    const { t } = this.plugin.i18n();
    const existingIds = new Set(tasks.map((task) => task.id));
    this.selectionScopeIds = new Set([...this.selectionScopeIds].filter((id) => existingIds.has(id)));
    this.selectedTaskIds = new Set([...this.selectedTaskIds].filter((id) => this.selectionScopeIds.has(id)));
    const toolbar = root.createDiv({ cls: "taskmate-selection-toolbar", attr: { "aria-label": t("selection.ariaLabel") } });
    const exit = toolbar.createEl("button", { text: `\xD7 ${t("selection.exit")}` });
    exit.addEventListener("click", () => this.exitSelectionMode());
    toolbar.createDiv({ text: t("selection.count", { count: this.selectedTaskIds.size }), cls: "taskmate-selection-count" });
    const selectAll = toolbar.createEl("button", { text: t("selection.selectAll") });
    selectAll.disabled = this.selectionScopeIds.size === 0;
    selectAll.addEventListener("click", () => {
      this.selectedTaskIds = this.selectedTaskIds.size === this.selectionScopeIds.size ? /* @__PURE__ */ new Set() : new Set(this.selectionScopeIds);
      this.requestRender();
    });
    const edit = toolbar.createEl("button", { text: t("common.edit") });
    edit.disabled = this.selectedTaskIds.size === 0;
    edit.addEventListener("click", () => void this.editSelectedTasks(tasks));
    const remove = toolbar.createEl("button", { text: t("common.delete"), cls: "mod-warning" });
    remove.disabled = this.selectedTaskIds.size === 0;
    remove.addEventListener("click", () => void this.deleteSelectedTasks(tasks));
  }
  exitSelectionMode() {
    this.selectionMode = false;
    this.selectedTaskIds.clear();
    this.selectionScopeIds.clear();
    this.requestRender();
  }
  openFilterModal() {
    new TaskFilterModal(this.app, this.filterState.value(), this.plugin.i18n(), (filters) => {
      this.filterState.replace(filters);
      this.requestRender();
    }).open();
  }
  clearActiveFilters() {
    this.filterState.clear();
    new import_obsidian8.Notice(this.plugin.i18n().t("filter.clearedNotice"));
    this.requestRender();
  }
  async editSelectedTasks(tasks) {
    const selected = tasks.filter((task) => this.selectedTaskIds.has(task.id));
    if (selected.length === 1) {
      await this.openEditTask(selected[0], () => this.exitSelectionMode());
      return;
    }
    if (selected.length < 2) return;
    const projects = await this.plugin.projects.list();
    new BulkTaskModal(this.app, selected.length, projects, this.plugin.i18n(), async (changes) => {
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
    const selected = tasks.filter((task) => this.selectedTaskIds.has(task.id));
    if (selected.length === 0 || !window.confirm(t("selection.deleteConfirm", { count: selected.length }))) return;
    const results = await Promise.allSettled(selected.map((task) => this.plugin.repository.remove(task)));
    this.finishBulkAction(selected, results, "selection.deletedNotice");
  }
  finishBulkAction(tasks, results, successKey) {
    const { t } = this.plugin.i18n();
    const failed = failedBulkTasks(tasks, results);
    if (failed.length === 0) {
      new import_obsidian8.Notice(t(successKey, { count: tasks.length }));
      this.exitSelectionMode();
      return;
    }
    this.selectedTaskIds = new Set(failed.map((task) => task.id));
    this.selectionScopeIds = new Set(failed.map((task) => task.id));
    new import_obsidian8.Notice(t("selection.partialFailure", { failed: failed.length, total: tasks.length }));
    this.requestRender();
  }
  addBackButton(header, action) {
    const button = header.createEl("button", {
      text: "\u2039",
      cls: "taskmate-back",
      attr: { "aria-label": this.plugin.i18n().t("common.back") }
    });
    header.prepend(button);
    button.addEventListener("click", action);
  }
  async rememberSearch(value) {
    const word = value.trim();
    if (!word) return;
    this.plugin.settings.recentSearches = [word, ...(this.plugin.settings.recentSearches ?? []).filter((item) => item !== word)].slice(0, 10);
    await this.plugin.saveSettings();
    this.requestRender();
  }
  async openCreateTask(projectId) {
    const projects = await this.plugin.projects.list();
    new TaskModal(this.app, null, projects, this.plugin.settings.recentLabels ?? [], projectId, this.plugin.i18n(), async (draft) => {
      await this.plugin.repository.create(draft);
      await this.rememberLabels(draft.labels);
      if (draft.projectId) {
        const project = projects.find((item) => item.id === draft.projectId);
        if (project) await this.plugin.projects.touch(project);
      }
      this.requestRender();
    }).open();
  }
  async openEditTask(task, afterAction) {
    const projects = await this.plugin.projects.list();
    new TaskModal(this.app, task, projects, this.plugin.settings.recentLabels ?? [], task.projectId, this.plugin.i18n(), async (draft) => {
      await this.plugin.repository.update(task, draft);
      await this.rememberLabels(draft.labels);
      if (draft.projectId) {
        const project = projects.find((item) => item.id === draft.projectId);
        if (project) await this.plugin.projects.touch(project);
      }
      if (afterAction) afterAction();
      else this.requestRender();
    }, async () => {
      await this.plugin.repository.remove(task);
      new import_obsidian8.Notice(this.plugin.i18n().t("tasks.deletedNotice"));
      if (afterAction) afterAction();
      else this.requestRender();
    }).open();
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
var import_obsidian9 = require("obsidian");
function detectObsidianLanguage() {
  try {
    return typeof import_obsidian9.getLanguage === "function" ? (0, import_obsidian9.getLanguage)() : void 0;
  } catch {
    return void 0;
  }
}

// src/main.ts
var TaskMatePlugin = class extends import_obsidian10.Plugin {
  settings = DEFAULT_SETTINGS;
  repository;
  projects;
  refreshTimer = null;
  async onload() {
    await this.loadSettings();
    const { t } = this.i18n();
    this.repository = new TaskRepository(this.app, () => this.settings.taskFolder);
    this.projects = new ProjectRepository(this.app, () => this.settings.projectFolder);
    try {
      const migrated = await this.repository.migrateLegacyFileNames();
      if (migrated > 0) new import_obsidian10.Notice(t("notice.migratedTaskNames", { count: migrated }));
    } catch (error) {
      console.error("TaskMate could not migrate legacy task filenames", error);
      new import_obsidian10.Notice(t("notice.migrationFailed"));
    }
    this.registerView(TODO_VIEW_TYPE, (leaf) => new TodoListView(leaf, this));
    this.addSettingTab(new TaskMateSettingTab(this.app, this));
    this.addRibbonIcon("circle-check-big", t("command.openRibbon"), () => void this.activateView());
    this.addCommand({ id: "open-todo-list", name: t("command.openList"), callback: () => void this.activateView() });
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
      const taskPrefix = `${(0, import_obsidian10.normalizePath)(this.settings.taskFolder)}/`;
      const projectPrefix = `${(0, import_obsidian10.normalizePath)(this.settings.projectFolder)}/`;
      if (!file.path.startsWith(taskPrefix) && !file.path.startsWith(projectPrefix)) return;
      if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
      this.refreshTimer = window.setTimeout(() => this.refreshViews(), 100);
    };
    this.registerEvent(this.app.vault.on("create", (file) => {
      if (file instanceof import_obsidian10.TFile) scheduleRefresh(file);
    }));
    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (file instanceof import_obsidian10.TFile) scheduleRefresh(file);
    }));
    this.registerEvent(this.app.vault.on("delete", (file) => {
      if (file instanceof import_obsidian10.TFile) scheduleRefresh(file);
    }));
    this.registerEvent(this.app.vault.on("rename", (file) => {
      if (file instanceof import_obsidian10.TFile) scheduleRefresh(file);
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
        new import_obsidian10.Notice(value ? t("notice.noteIncluded") : t("notice.noteExcluded"));
      });
    }
    return true;
  }
  includeCurrentFolder(checking) {
    const file = this.app.workspace.getActiveFile();
    const folder = file?.parent?.path;
    if (!file || !folder || folder === "/") return false;
    if (!checking) {
      const normalized = (0, import_obsidian10.normalizePath)(folder);
      if (!this.settings.sourceFolders.includes(normalized)) this.settings.sourceFolders.push(normalized);
      void this.saveSettings().then(() => new import_obsidian10.Notice(this.i18n().t("notice.folderIncluded", { folder: normalized })));
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
