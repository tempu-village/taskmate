import { ItemView, Menu, Notice, WorkspaceLeaf } from "obsidian";
import { filterTasks } from "./domain";
import type { Priority, Project, SmartView, SortDirection, SortMode, Task, TaskFilters } from "./domain";
import type { TranslationKey } from "./i18n";
import { compareDisplayText } from "./i18n";
import type TaskMatePlugin from "./main";
import { ProjectModal } from "./project-modal";
import { TaskModal } from "./task-modal";
import { filterLabelSuggestions, recordRecentLabels } from "./task-input-suggestions";
import { buildTaskListModel } from "./task-list-model";
import type { TaskListModel } from "./task-list-model";
import { renderTaskList as renderTaskListDom } from "./task-list-renderer";
import type { RenderedTaskList, TaskListAction, TaskListCopy } from "./task-list-renderer";

export const TODO_VIEW_TYPE = "taskmate-list";

type MainScreen = "date" | "search" | "projects" | "filter";
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
  { screen: "projects", icon: "▣", labelKey: "nav.projects" },
  { screen: "filter", icon: "≡", labelKey: "nav.filter" }
] as const satisfies ReadonlyArray<{ screen: MainScreen; icon: string; labelKey: TranslationKey }>;

const EMPTY_FILTERS: TaskFilters = { priorities: [], labels: [], search: "", includeCompleted: false };

export class TodoListView extends ItemView {
  private screen: MainScreen = "date";
  private smartView: SmartView = "scheduled";
  private sortMode: SortMode = "manual";
  private sortDirection: SortDirection = "asc";
  private searchQuery = "";
  private selectedPriorities: Priority[] = [];
  private selectedLabels: string[] = [];
  private includeCompleted = false;
  private labelQuery = "";
  private projectScreen: ProjectScreen = "index";
  private activeProjectId: string | null = null;
  private renderedTaskList: RenderedTaskList | null = null;
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
    this.renderNavigation(page);
    if (this.screen === "search") {
      this.renderSearchScreen(page, tasks, projects);
    } else if (this.screen === "date") {
      this.renderDateScreen(page, tasks, projects);
    } else if (this.screen === "filter") {
      this.renderFilterScreen(page, tasks, projects);
    } else {
      const content = page.createDiv({ cls: "taskmate-content taskmate-scroll-region" });
      this.renderProjectsScreen(content, tasks, projects);
    }
  }

  private renderHeader(container: HTMLElement, title: string, addTaskProjectId?: string | null): HTMLElement {
    const { t } = this.plugin.i18n();
    const header = container.createDiv({ cls: "taskmate-header" });
    header.createEl("h2", { text: title });
    if (addTaskProjectId !== undefined) {
      const add = header.createEl("button", { text: t("common.add"), cls: "mod-cta taskmate-add" });
      add.addEventListener("click", () => void this.openCreateTask(addTaskProjectId));
    }
    return header;
  }

  private renderDateScreen(container: HTMLElement, tasks: Task[], projects: Project[]): void {
    const { t } = this.plugin.i18n();
    const controls = container.createDiv({ cls: "taskmate-date-controls" });
    this.renderHeader(controls, "TaskMate", null);
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
    });

    this.renderSortControl(controls);
    const results = container.createDiv({ cls: "taskmate-date-results taskmate-scroll-region" });
    const visibleTasks = filterTasks(tasks, this.smartView, EMPTY_FILTERS);
    if (this.smartView === "scheduled") this.renderScheduledTaskList(results, visibleTasks, projects);
    else this.renderTaskList(results, visibleTasks, projects, true);
  }

  private renderSearchScreen(container: HTMLElement, tasks: Task[], projects: Project[]): void {
    const { t } = this.plugin.i18n();
    const controls = container.createDiv({ cls: "taskmate-search-controls" });
    this.renderHeader(controls, t("search.title"));
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
    if (recent.length > 0) {
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
    const projectNames = new Map(projects.map((project) => [project.id, project.name.toLocaleLowerCase()]));
    const matches = tasks.filter((task) => {
      const text = `${task.title}\n${task.notes}\n${task.labels.join(" ")}\n${projectNames.get(task.projectId ?? "") ?? ""}`.toLocaleLowerCase();
      return text.includes(query);
    });
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
      const header = this.renderHeader(container, active.name, active.id);
      this.addBackButton(header, () => {
        this.projectScreen = "index";
        this.requestRender();
      });
      const edit = header.createEl("button", { text: t("common.edit") });
      edit.addEventListener("click", () => {
        this.projectScreen = "edit";
        this.requestRender();
      });
      this.renderSortControl(container);
      this.renderTaskList(container, tasks.filter((task) => !task.completed && task.projectId === active.id), projects, true);
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

  private renderFilterScreen(container: HTMLElement, tasks: Task[], projects: Project[]): void {
    const { t, locale } = this.plugin.i18n();
    const controls = container.createDiv({ cls: "taskmate-filter-controls" });
    this.renderHeader(controls, t("filter.title"));
    const results = container.createDiv({ cls: "taskmate-filter-results taskmate-scroll-region" });
    const updateResults = () => this.renderFilterResults(results, tasks, projects);

    const priorities = controls.createDiv({ cls: "taskmate-section" });
    priorities.createEl("h3", { text: t("filter.priority") });
    const priorityButtons = priorities.createDiv({ cls: "taskmate-filter-buttons" });
    ([1, 2, 3] as Priority[]).forEach((priority) => {
      const selected = this.selectedPriorities.includes(priority);
      const button = priorityButtons.createEl("button", { text: t("filter.priorityValue", { priority }), cls: selected ? "is-active" : "" });
      button.addEventListener("click", () => {
        const currentlySelected = this.selectedPriorities.includes(priority);
        this.selectedPriorities = currentlySelected
          ? this.selectedPriorities.filter((value) => value !== priority)
          : [...this.selectedPriorities, priority];
        button.toggleClass("is-active", !currentlySelected);
        updateResults();
      });
    });

    const labelsSection = controls.createDiv({ cls: "taskmate-section taskmate-filter-label-section" });
    labelsSection.createEl("h3", { text: t("filter.labels") });
    const allLabels = [...new Set(tasks.flatMap((task) => task.labels))]
      .sort((a, b) => compareDisplayText(a, b, locale))
      .slice(0, 500);
    const picker = labelsSection.createDiv({ cls: "taskmate-filter-label-picker" });
    const inputRow = picker.createDiv({ cls: "taskmate-filter-label-input" });
    const tokenHost = inputRow.createDiv({ cls: "taskmate-selected-labels" });
    const labelSearch = inputRow.createEl("input", {
      type: "text",
      value: this.labelQuery,
      placeholder: t("filter.labelSearchPlaceholder"),
      cls: "taskmate-label-search",
      attr: {
        "aria-label": t("filter.labelSearchAriaLabel"),
        "inputmode": "search",
        "enterkeyhint": "search"
      }
    });
    const suggestions = picker.createDiv({ cls: "taskmate-filter-label-suggestions is-hidden" });
    let pickerOpen = false;
    let labelComposing = false;

    const renderTokens = () => {
      tokenHost.empty();
      this.selectedLabels.forEach((label) => {
        const token = tokenHost.createEl("button", {
          text: `${label} ×`,
          cls: "taskmate-label-token",
          attr: { "aria-label": t("filter.removeLabelAriaLabel", { label }) }
        });
        token.addEventListener("click", () => {
          this.selectedLabels = this.selectedLabels.filter((item) => item !== label);
          renderTokens();
          renderSuggestions();
          updateResults();
        });
      });
    };

    const renderSuggestions = () => {
      suggestions.empty();
      suggestions.toggleClass("is-hidden", !pickerOpen);
      if (!pickerOpen) return;
      const candidates = filterLabelSuggestions(
        allLabels,
        this.plugin.settings.recentLabels ?? [],
        this.labelQuery,
        this.selectedLabels
      );
      if (candidates.length === 0) {
        suggestions.addClass("is-hidden");
        return;
      }
      suggestions.createDiv({
        text: t(this.labelQuery.trim() ? "filter.matchingLabels" : "filter.recentLabels"),
        cls: "taskmate-suggestion-heading"
      });
      const chips = suggestions.createDiv({ cls: "taskmate-suggestion-chips" });
      candidates.forEach((label) => {
        const choose = chips.createEl("button", { text: label, cls: "taskmate-suggestion-chip" });
        choose.addEventListener("click", () => {
          this.selectedLabels = [...this.selectedLabels, label];
          this.labelQuery = "";
          labelSearch.value = "";
          renderTokens();
          renderSuggestions();
          updateResults();
          labelSearch.focus();
        });
      });
    };

    labelSearch.addEventListener("compositionstart", () => {
      labelComposing = true;
    });
    labelSearch.addEventListener("compositionend", () => {
      labelComposing = false;
      this.labelQuery = labelSearch.value;
      renderSuggestions();
    });
    labelSearch.addEventListener("input", (event) => {
      this.labelQuery = labelSearch.value;
      if (labelComposing || (event as InputEvent).isComposing) return;
      renderSuggestions();
    });
    labelSearch.addEventListener("focus", () => {
      pickerOpen = true;
      renderSuggestions();
    });
    labelsSection.addEventListener("focusout", () => {
      window.setTimeout(() => {
        if (labelsSection.contains(document.activeElement)) return;
        pickerOpen = false;
        renderSuggestions();
      }, 0);
    });
    renderTokens();

    const completion = controls.createDiv({ cls: "taskmate-section taskmate-completion-filter" });
    completion.createEl("h3", { text: t("filter.completion") });
    const completionLabel = completion.createEl("label");
    const completionCheckbox = completionLabel.createEl("input", { type: "checkbox" });
    completionCheckbox.checked = this.includeCompleted;
    completionLabel.createSpan({ text: t("filter.includeCompleted") });
    completionCheckbox.addEventListener("change", () => {
      this.includeCompleted = completionCheckbox.checked;
      updateResults();
    });

    updateResults();
  }

  private renderFilterResults(container: HTMLElement, tasks: Task[], projects: Project[]): void {
    const { t } = this.plugin.i18n();
    this.destroyTaskList();
    container.empty();
    const selectionCount = this.selectedPriorities.length + this.selectedLabels.length + Number(this.includeCompleted);
    const resultHeader = container.createDiv({ cls: "taskmate-filter-result-heading" });
    resultHeader.createEl("h3", { text: selectionCount > 0 ? t("filter.results") : t("filter.select") });
    if (selectionCount > 0) {
      const clear = resultHeader.createEl("button", { text: t("filter.clearAll") });
      clear.addEventListener("click", () => {
        this.selectedPriorities = [];
        this.selectedLabels = [];
        this.includeCompleted = false;
        this.requestRender();
      });
      const matches = filterTasks(tasks, "all", {
        priorities: this.selectedPriorities,
        labels: this.selectedLabels,
        search: "",
        includeCompleted: this.includeCompleted
      });
      this.renderTaskList(container, matches, projects, false);
    }
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
    });
  }

  private renderTaskList(container: HTMLElement, source: Task[], projects: Project[], allowReorder: boolean): void {
    const model = buildTaskListModel({
      tasks: source,
      projects,
      grouping: "flat",
      sortMode: this.sortMode,
      sortDirection: this.sortDirection,
      allowReorder
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
      allowReorder: true
    });
    this.mountTaskList(container, model, source);
  }

  private taskListCopy(): TaskListCopy {
    const { t } = this.plugin.i18n();
    return {
      empty: t("tasks.empty"),
      reorderAriaLabel: t("tasks.reorderAriaLabel"),
      completeAriaLabel: (title) => t("tasks.completeAriaLabel", { title }),
      moreAriaLabel: t("tasks.moreAriaLabel"),
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
    const { t } = this.plugin.i18n();
    if (action.type === "reorder") {
      await this.plugin.repository.reorder(action.taskId, action.previousId, action.nextId);
      this.requestRender();
      return;
    }

    const task = tasksById.get(action.taskId);
    if (!task) return;
    if (action.type === "show-actions") {
      const menu = new Menu();
      menu.addItem((item) => item.setTitle(t("common.edit")).setIcon("pencil").onClick(() => void this.openEditTask(task)));
      menu.addItem((item) => item.setTitle(t("common.delete")).setIcon("trash").onClick(async () => {
        if (!window.confirm(t("tasks.deleteConfirm", { title: task.title }))) return;
        await this.plugin.repository.remove(task);
        new Notice(t("tasks.deletedNotice"));
        this.requestRender();
      }));
      menu.showAtMouseEvent(action.event);
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

  private async openEditTask(task: Task): Promise<void> {
    const projects = await this.plugin.projects.list();
    new TaskModal(this.app, task, projects, this.plugin.settings.recentLabels ?? [], task.projectId, this.plugin.i18n(), async (draft) => {
      await this.plugin.repository.update(task, draft);
      await this.rememberLabels(draft.labels);
      if (draft.projectId) {
        const project = projects.find((item) => item.id === draft.projectId);
        if (project) await this.plugin.projects.touch(project);
      }
      this.requestRender();
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
