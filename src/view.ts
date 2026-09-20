import { ItemView, Menu, Notice, setIcon, WorkspaceLeaf } from "obsidian";
import { BulkTaskModal } from "./bulk-task-modal";
import { buildBulkTaskPatch, failedBulkTasks } from "./bulk-task-actions";
import type { BulkTaskChanges } from "./bulk-task-actions";
import { filterTasks } from "./domain";
import type { Project, SmartView, SortDirection, SortMode, Task } from "./domain";
import type { TranslationKey } from "./i18n";
import { compareDisplayText } from "./i18n";
import type TaskMatePlugin from "./main";
import { TaskFilterModal } from "./filter-modal";
import { ProjectModal } from "./project-modal";
import { TaskModal } from "./task-modal";
import { recordRecentLabels } from "./task-input-suggestions";
import { availableFilterLabels } from "./label-picker-model";
import { LabelManagerModal } from "./label-manager-modal";
import { buildManagedLabels, removeLabelValue, renameLabelValues } from "./label-management";
import { buildTaskListModel } from "./task-list-model";
import type { TaskListModel } from "./task-list-model";
import { renderTaskList as renderTaskListDom } from "./task-list-renderer";
import type { RenderedTaskList, TaskListAction, TaskListCopy } from "./task-list-renderer";
import { TaskFilterState } from "./task-filter-state";

export const TODO_VIEW_TYPE = "taskmate-list";

type MainScreen = "date" | "search" | "projects";
type ProjectScreen = "index" | "detail" | "edit";

const SMART_VIEW_KEYS = {
  scheduled: "view.scheduled",
  all: "view.all",
  unplanned: "view.unplanned"
} as const satisfies Record<SmartView, TranslationKey>;

const SORT_KEYS = {
  manual: "sort.manual",
  date: "sort.date",
  priority: "sort.priority",
  created: "sort.created"
} as const satisfies Record<SortMode, TranslationKey>;

const NAV_ITEMS = [
  { screen: "date", icon: "◷", labelKey: "nav.date" },
  { screen: "search", icon: "⌕", labelKey: "nav.search" },
  { screen: "projects", icon: "▣", labelKey: "nav.projects" }
] as const satisfies ReadonlyArray<{ screen: MainScreen; icon: string; labelKey: TranslationKey }>;

export class TodoListView extends ItemView {
  private screen: MainScreen = "date";
  private smartView: SmartView = "scheduled";
  private sortMode: SortMode = "manual";
  private sortDirection: SortDirection = "asc";
  private searchQuery = "";
  private readonly filterState = new TaskFilterState();
  private projectScreen: ProjectScreen = "index";
  private activeProjectId: string | null = null;
  private renderedTaskList: RenderedTaskList | null = null;
  private selectionMode = false;
  private selectedTaskIds = new Set<string>();
  private selectionScopeIds = new Set<string>();
  private generation = 0;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: TaskMatePlugin) {
    super(leaf);
  }

  getViewType(): string {
    return TODO_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "TaskMate";
  }

  getIcon(): string {
    return "circle-check-big";
  }

  async onOpen(): Promise<void> {
    await this.render();
  }

  async onClose(): Promise<void> {
    this.destroyTaskList();
  }

  requestRender(): void {
    void this.render();
  }

  private async render(): Promise<void> {
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

  private renderHeader(
    container: HTMLElement,
    title: string,
    addTaskProjectId?: string | null,
    selectionScope?: () => Task[]
  ): HTMLElement {
    const { t } = this.plugin.i18n();
    const header = container.createDiv({ cls: "taskmate-header" });
    header.createEl("h2", { text: title });
    if (!this.selectionMode && selectionScope) this.renderAdjustMenu(header, selectionScope);
    if (!this.selectionMode && addTaskProjectId !== undefined) {
      const add = header.createEl("button", { text: t("common.add"), cls: "mod-cta taskmate-add" });
      add.addEventListener("click", () => void this.openCreateTask(addTaskProjectId));
    }
    return header;
  }

  private renderDateScreen(container: HTMLElement, tasks: Task[], projects: Project[]): void {
    const { t } = this.plugin.i18n();
    const controls = container.createDiv({ cls: "taskmate-date-controls" });
    const visibleTasks = filterTasks(tasks, this.smartView, this.filterState.value());
    this.renderHeader(controls, "TaskMate", null, () => visibleTasks);
    const tabs = controls.createDiv({ cls: "taskmate-smart-views", attr: { role: "tablist" } });
    (Object.keys(SMART_VIEW_KEYS) as SmartView[]).forEach((view) => {
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

  private renderSearchScreen(container: HTMLElement, tasks: Task[], projects: Project[]): void {
    const { t } = this.plugin.i18n();
    const controls = container.createDiv({ cls: "taskmate-search-controls" });
    const currentMatches = () => this.searchMatches(tasks, projects);
    this.renderHeader(controls, t("search.title"), undefined, currentMatches);
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
      if (!composing && !(event as InputEvent).isComposing) updateResults();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && this.searchQuery.trim()) void this.rememberSearch(this.searchQuery);
    });
    updateResults();
  }

  private renderSearchResults(container: HTMLElement, tasks: Task[], projects: Project[]): void {
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
    const matches = this.searchMatches(tasks, projects);
    this.renderTaskList(container, matches, projects, false);
  }

  private renderProjectsScreen(container: HTMLElement, tasks: Task[], projects: Project[]): void {
    const { t, locale } = this.plugin.i18n();
    const active = projects.find((project) => project.id === this.activeProjectId) ?? null;
    if (this.projectScreen !== "index" && !active) {
      this.projectScreen = "index";
      this.activeProjectId = null;
    }

    if (this.projectScreen === "detail" && active) {
      const visibleTasks = filterTasks(tasks.filter((task) => task.projectId === active.id), "all", this.filterState.value());
      const header = this.renderHeader(container, active.name, active.id, () => visibleTasks);
      if (!this.selectionMode) {
        this.addBackButton(header, () => {
          this.projectScreen = "index";
          this.requestRender();
        });
        const edit = header.createEl("button", { text: t("common.edit") });
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
      const header = this.renderHeader(container, t("projects.editTitle"));
      this.addBackButton(header, () => {
        this.projectScreen = "detail";
        this.requestRender();
      });
      this.renderProjectEditor(container, active);
      return;
    }

    const header = this.renderHeader(container, t("projects.title"));
    const add = header.createEl("button", { text: t("common.add"), cls: "mod-cta" });
    add.addEventListener("click", () => this.openCreateProject());
    const recent = [...projects]
      .filter((project) => project.lastUsedAt)
      .sort((a, b) => (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? ""))
      .slice(0, 5);
    if (recent.length > 0) this.renderProjectList(container, t("projects.recent"), recent, tasks);
    this.renderProjectList(container, t("projects.all"), [...projects].sort((a, b) => compareDisplayText(a.name, b.name, locale)), tasks);
  }

  private renderProjectList(container: HTMLElement, title: string, projects: Project[], tasks: Task[]): void {
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

  private renderProjectEditor(container: HTMLElement, project: Project): void {
    const { t } = this.plugin.i18n();
    const panel = container.createDiv({ cls: "taskmate-project-editor" });
    const label = panel.createEl("label", { text: t("projects.name") });
    const input = label.createEl("input", { type: "text", value: project.name });
    const save = panel.createEl("button", { text: t("projects.saveName"), cls: "mod-cta" });
    save.addEventListener("click", async () => {
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
      new Notice(t("projects.deletedNotice"));
      this.requestRender();
    });
  }

  private renderSortControl(container: HTMLElement): void {
    const { t } = this.plugin.i18n();
    const controls = container.createDiv({ cls: "taskmate-sort" });
    controls.createDiv({ text: t("sort.label"), cls: "taskmate-sort-label" });
    const options = controls.createDiv({ cls: "taskmate-sort-options", attr: { role: "group", "aria-label": t("sort.ariaLabel") } });
    (Object.keys(SORT_KEYS) as SortMode[]).forEach((mode) => {
      const selected = mode === this.sortMode;
      const directionLabel = this.sortDirection === "asc" ? t("sort.ascending") : t("sort.descending");
      const button = options.createEl("button", {
        cls: selected ? "is-active" : "",
        attr: {
          type: "button",
          "aria-pressed": String(selected),
          "aria-label": selected && mode !== "manual"
            ? t("sort.activeOptionAriaLabel", { mode: t(SORT_KEYS[mode]), direction: directionLabel })
            : t(SORT_KEYS[mode])
        }
      });
      button.createSpan({ text: t(SORT_KEYS[mode]) });
      if (selected && mode !== "manual") {
        button.createSpan({ text: this.sortDirection === "asc" ? "↑" : "↓", cls: "taskmate-sort-direction", attr: { "aria-hidden": "true" } });
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

  private renderTaskList(container: HTMLElement, source: Task[], projects: Project[], allowReorder: boolean): void {
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

  private renderScheduledTaskList(container: HTMLElement, source: Task[], projects: Project[]): void {
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

  private taskListCopy(): TaskListCopy {
    const { t } = this.plugin.i18n();
    return {
      empty: t("tasks.empty"),
      reorderAriaLabel: t("tasks.reorderAriaLabel"),
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

  private mountTaskList(
    container: HTMLElement,
    model: TaskListModel,
    source: Task[]
  ): void {
    this.destroyTaskList();
    const tasksById = new Map(source.map((task) => [task.id, task]));
    this.renderedTaskList = renderTaskListDom(container, model, this.taskListCopy(), (action) =>
      this.handleTaskListAction(action, tasksById)
    );
  }

  private destroyTaskList(): void {
    this.renderedTaskList?.destroy();
    this.renderedTaskList = null;
  }

  private async handleTaskListAction(action: TaskListAction, tasksById: Map<string, Task>): Promise<void> {
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

  private renderNavigation(root: HTMLElement): void {
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

  private searchMatches(tasks: Task[], projects: Project[]): Task[] {
    const query = this.searchQuery.trim().toLocaleLowerCase();
    if (!query) return [];
    const projectNames = new Map(projects.map((project) => [project.id, project.name.toLocaleLowerCase()]));
    const matches = tasks.filter((task) => {
      const text = `${task.title}\n${task.notes}\n${task.labels.join(" ")}\n${projectNames.get(task.projectId ?? "") ?? ""}`.toLocaleLowerCase();
      return text.includes(query);
    });
    return filterTasks(matches, "all", this.filterState.value());
  }

  private renderAdjustMenu(header: HTMLElement, selectionScope: () => Task[]): void {
    const { t } = this.plugin.i18n();
    const count = this.filterState.count();
    const button = header.createEl("button", {
      cls: `taskmate-adjust${count > 0 ? " is-active" : ""}`,
      attr: { "aria-label": count > 0 ? t("adjust.ariaLabelActive", { count }) : t("adjust.ariaLabel") }
    });
    setIcon(button, "sliders-horizontal");
    if (count > 0) button.createSpan({ text: String(count), cls: "taskmate-adjust-count" });
    button.addEventListener("click", (event) => {
      const menu = new Menu();
      const scope = selectionScope();
      menu.addItem((item) => item.setTitle(t("selection.start")).setIcon("list-checks").setDisabled(scope.length === 0).onClick(() => {
        this.selectionScopeIds = new Set(scope.map((task) => task.id));
        this.selectedTaskIds.clear();
        this.selectionMode = true;
        this.requestRender();
      }));
      menu.addItem((item) => item
        .setTitle(count > 0 ? t("filter.change") : t("filter.title"))
        .setIcon("list-filter")
        .onClick(() => void this.openFilterModal()));
      menu.addItem((item) => item
        .setTitle(t("labelManager.menu"))
        .setIcon("tags")
        .onClick(() => void this.openLabelManager()));
      if (count > 0) {
        menu.addSeparator();
        menu.addItem((item) => item
          .setTitle(t("filter.clearActive"))
          .setIcon("filter-x")
          .onClick(() => this.clearActiveFilters()));
      }
      menu.showAtMouseEvent(event);
    });
  }

  private renderSelectionToolbar(root: HTMLElement, tasks: Task[]): void {
    const { t } = this.plugin.i18n();
    const existingIds = new Set(tasks.map((task) => task.id));
    this.selectionScopeIds = new Set([...this.selectionScopeIds].filter((id) => existingIds.has(id)));
    this.selectedTaskIds = new Set([...this.selectedTaskIds].filter((id) => this.selectionScopeIds.has(id)));
    const toolbar = root.createDiv({ cls: "taskmate-selection-toolbar", attr: { "aria-label": t("selection.ariaLabel") } });
    const exit = toolbar.createEl("button", { text: `× ${t("selection.exit")}` });
    exit.addEventListener("click", () => this.exitSelectionMode());
    toolbar.createDiv({ text: t("selection.count", { count: this.selectedTaskIds.size }), cls: "taskmate-selection-count" });
    const selectAll = toolbar.createEl("button", { text: t("selection.selectAll") });
    selectAll.disabled = this.selectionScopeIds.size === 0;
    selectAll.addEventListener("click", () => {
      this.selectedTaskIds = this.selectedTaskIds.size === this.selectionScopeIds.size
        ? new Set<string>()
        : new Set(this.selectionScopeIds);
      this.requestRender();
    });
    const edit = toolbar.createEl("button", { text: t("common.edit") });
    edit.disabled = this.selectedTaskIds.size === 0;
    edit.addEventListener("click", () => void this.editSelectedTasks(tasks));
    const remove = toolbar.createEl("button", { text: t("common.delete"), cls: "mod-warning" });
    remove.disabled = this.selectedTaskIds.size === 0;
    remove.addEventListener("click", () => void this.deleteSelectedTasks(tasks));
  }

  private exitSelectionMode(): void {
    this.selectionMode = false;
    this.selectedTaskIds.clear();
    this.selectionScopeIds.clear();
    this.requestRender();
  }

  private async openFilterModal(): Promise<void> {
    const i18n = this.plugin.i18n();
    const tasks = await this.plugin.repository.list();
    const incompleteTaskLabels = availableFilterLabels(tasks, false)
      .sort((a, b) => compareDisplayText(a, b, i18n.locale))
      .slice(0, 500);
    const allTaskLabels = availableFilterLabels(tasks, true)
      .sort((a, b) => compareDisplayText(a, b, i18n.locale))
      .slice(0, 500);
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

  private async openLabelManager(): Promise<void> {
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

  private async renameManagedLabel(tasks: Task[], from: string, to: string): Promise<void> {
    const affected = tasks.filter((task) => task.labels.includes(from));
    const results = await Promise.allSettled(affected.map((task) =>
      this.plugin.repository.update(task, { labels: renameLabelValues(task.labels, from, to) })
    ));
    if (this.reportLabelWriteFailures(affected, results)) return;
    this.plugin.settings.recentLabels = renameLabelValues(this.plugin.settings.recentLabels ?? [], from, to);
    this.plugin.settings.favoriteLabels = renameLabelValues(this.plugin.settings.favoriteLabels ?? [], from, to);
    const filters = this.filterState.value();
    this.filterState.replace({ ...filters, labels: renameLabelValues(filters.labels, from, to) });
    await this.plugin.saveSettings();
    const { t } = this.plugin.i18n();
    new Notice(affected.length === 1
      ? t("labelManager.renamedNoticeOne", { from, to, count: affected.length })
      : t("labelManager.renamedNotice", { from, to, count: affected.length }));
    this.requestRender();
  }

  private async deleteManagedLabel(tasks: Task[], label: string): Promise<void> {
    const affected = tasks.filter((task) => task.labels.includes(label));
    const results = await Promise.allSettled(affected.map((task) =>
      this.plugin.repository.update(task, { labels: removeLabelValue(task.labels, label) })
    ));
    if (this.reportLabelWriteFailures(affected, results)) return;
    this.plugin.settings.recentLabels = removeLabelValue(this.plugin.settings.recentLabels ?? [], label);
    this.plugin.settings.favoriteLabels = removeLabelValue(this.plugin.settings.favoriteLabels ?? [], label);
    const filters = this.filterState.value();
    this.filterState.replace({ ...filters, labels: removeLabelValue(filters.labels, label) });
    await this.plugin.saveSettings();
    const { t } = this.plugin.i18n();
    new Notice(affected.length === 1
      ? t("labelManager.deletedNoticeOne", { label, count: affected.length })
      : t("labelManager.deletedNotice", { label, count: affected.length }));
    this.requestRender();
  }

  private reportLabelWriteFailures(tasks: Task[], results: PromiseSettledResult<unknown>[]): boolean {
    const failed = failedBulkTasks(tasks, results);
    if (failed.length === 0) return false;
    new Notice(this.plugin.i18n().t("labelManager.partialFailure", {
      failed: failed.length,
      total: tasks.length,
      paths: failed.map((task) => task.path).join(", ")
    }), 0);
    this.requestRender();
    return true;
  }

  private clearActiveFilters(): void {
    this.filterState.clear();
    new Notice(this.plugin.i18n().t("filter.clearedNotice"));
    this.requestRender();
  }

  private async editSelectedTasks(tasks: Task[]): Promise<void> {
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

  private async applyBulkChanges(tasks: Task[], changes: BulkTaskChanges): Promise<void> {
    const results = await Promise.allSettled(tasks.map((task) =>
      this.plugin.repository.update(task, buildBulkTaskPatch(task, changes))
    ));
    if (typeof changes.projectId === "string") {
      const project = (await this.plugin.projects.list()).find((item) => item.id === changes.projectId);
      if (project) await this.plugin.projects.touch(project);
    }
    await this.rememberLabels(changes.addLabels);
    this.finishBulkAction(tasks, results, "selection.updatedNotice");
  }

  private async deleteSelectedTasks(tasks: Task[]): Promise<void> {
    const { t } = this.plugin.i18n();
    const selected = tasks.filter((task) => this.selectedTaskIds.has(task.id));
    if (selected.length === 0 || !window.confirm(t("selection.deleteConfirm", { count: selected.length }))) return;
    const results = await Promise.allSettled(selected.map((task) => this.plugin.repository.remove(task)));
    this.finishBulkAction(selected, results, "selection.deletedNotice");
  }

  private finishBulkAction(
    tasks: Task[],
    results: PromiseSettledResult<unknown>[],
    successKey: "selection.updatedNotice" | "selection.deletedNotice"
  ): void {
    const { t } = this.plugin.i18n();
    const failed = failedBulkTasks(tasks, results);
    if (failed.length === 0) {
      new Notice(t(successKey, { count: tasks.length }));
      this.exitSelectionMode();
      return;
    }
    this.selectedTaskIds = new Set(failed.map((task) => task.id));
    this.selectionScopeIds = new Set(failed.map((task) => task.id));
    new Notice(t("selection.partialFailure", { failed: failed.length, total: tasks.length }));
    this.requestRender();
  }

  private addBackButton(header: HTMLElement, action: () => void): void {
    const button = header.createEl("button", {
      text: "‹",
      cls: "taskmate-back",
      attr: { "aria-label": this.plugin.i18n().t("common.back") }
    });
    header.prepend(button);
    button.addEventListener("click", action);
  }

  private async rememberSearch(value: string): Promise<void> {
    const word = value.trim();
    if (!word) return;
    this.plugin.settings.recentSearches = [word, ...(this.plugin.settings.recentSearches ?? []).filter((item) => item !== word)].slice(0, 10);
    await this.plugin.saveSettings();
    this.requestRender();
  }

  private async openCreateTask(projectId: string | null): Promise<void> {
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

  private async openEditTask(task: Task, afterAction?: () => void): Promise<void> {
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
      new Notice(this.plugin.i18n().t("tasks.deletedNotice"));
      if (afterAction) afterAction();
      else this.requestRender();
    }).open();
  }

  private openCreateProject(): void {
    new ProjectModal(this.app, this.plugin.i18n(), async (name) => {
      const project = await this.plugin.projects.create(name);
      this.activeProjectId = project.id;
      this.projectScreen = "detail";
      this.requestRender();
    }).open();
  }

  private async rememberLabels(labels: string[]): Promise<void> {
    const current = this.plugin.settings.recentLabels ?? [];
    const next = recordRecentLabels(current, labels);
    if (next.length === current.length && next.every((label, index) => label === current[index])) return;
    this.plugin.settings.recentLabels = next;
    await this.plugin.saveSettings();
  }
}
