import { ItemView, Menu, Notice, WorkspaceLeaf } from "obsidian";
import Sortable from "sortablejs";
import { filterTasks, SMART_VIEW_LABELS, sortTasks } from "./domain";
import type { Priority, Project, SmartView, SortMode, Task, TaskFilters } from "./domain";
import type TaskMatePlugin from "./main";
import { ProjectModal } from "./project-modal";
import { TaskModal } from "./task-modal";
import { recordRecentLabels } from "./task-input-suggestions";

export const TODO_VIEW_TYPE = "taskmate-list";

type MainScreen = "date" | "search" | "projects" | "filter";
type ProjectScreen = "index" | "detail" | "edit";

const SORT_LABELS: Record<SortMode, string> = {
  manual: "手動順",
  date: "日付順",
  priority: "優先度順",
  created: "作成日順"
};

const NAV_ITEMS: Array<{ screen: MainScreen; icon: string; label: string }> = [
  { screen: "date", icon: "◷", label: "日付" },
  { screen: "search", icon: "⌕", label: "検索" },
  { screen: "projects", icon: "▣", label: "プロジェクト" },
  { screen: "filter", icon: "≡", label: "フィルタ" }
];

const EMPTY_FILTERS: TaskFilters = { priorities: [], labels: [], search: "" };

export class TodoListView extends ItemView {
  private screen: MainScreen = "date";
  private smartView: SmartView = "today";
  private sortMode: SortMode = "manual";
  private searchQuery = "";
  private selectedPriorities: Priority[] = [];
  private selectedLabels: string[] = [];
  private labelQuery = "";
  private labelsExpanded = false;
  private projectScreen: ProjectScreen = "index";
  private activeProjectId: string | null = null;
  private sortable: Sortable | null = null;
  private generation = 0;
  private inputTimer: number | null = null;
  private focusAfterRender: "search" | "label" | null = null;

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
    this.sortable?.destroy();
    if (this.inputTimer !== null) window.clearTimeout(this.inputTimer);
  }

  requestRender(): void {
    void this.render();
  }

  private async render(): Promise<void> {
    const currentGeneration = ++this.generation;
    const [tasks, projects] = await Promise.all([this.plugin.repository.list(), this.plugin.projects.list()]);
    if (currentGeneration !== this.generation) return;

    this.sortable?.destroy();
    this.sortable = null;
    const root = this.contentEl;
    root.empty();
    root.addClass("taskmate-view");
    const page = root.createDiv({ cls: "taskmate-page" });
    this.renderNavigation(page);
    const content = page.createDiv({ cls: "taskmate-content" });

    if (this.screen === "date") this.renderDateScreen(content, tasks, projects);
    else if (this.screen === "search") this.renderSearchScreen(content, tasks, projects);
    else if (this.screen === "projects") this.renderProjectsScreen(content, tasks, projects);
    else this.renderFilterScreen(content, tasks, projects);
  }

  private renderHeader(container: HTMLElement, title: string, addTaskProjectId?: string | null): HTMLElement {
    const header = container.createDiv({ cls: "taskmate-header" });
    header.createEl("h2", { text: title });
    if (addTaskProjectId !== undefined) {
      const add = header.createEl("button", { text: "＋ 追加", cls: "mod-cta taskmate-add" });
      add.addEventListener("click", () => void this.openCreateTask(addTaskProjectId));
    }
    return header;
  }

  private renderDateScreen(container: HTMLElement, tasks: Task[], projects: Project[]): void {
    this.renderHeader(container, "TaskMate", null);
    const tabs = container.createDiv({ cls: "taskmate-smart-views", attr: { role: "tablist" } });
    (Object.keys(SMART_VIEW_LABELS) as SmartView[]).forEach((view) => {
      const count = tasks.filter((task) => filterTasks([task], view, EMPTY_FILTERS).length > 0).length;
      const button = tabs.createEl("button", {
        cls: view === this.smartView ? "is-active" : "",
        attr: { role: "tab", "aria-selected": String(view === this.smartView) }
      });
      button.createSpan({ text: SMART_VIEW_LABELS[view] });
      button.createSpan({ text: String(count), cls: "taskmate-view-count" });
      button.addEventListener("click", () => {
        this.smartView = view;
        this.requestRender();
      });
    });

    this.renderSortControl(container);
    this.renderTaskList(container, filterTasks(tasks, this.smartView, EMPTY_FILTERS), projects, true);
  }

  private renderSearchScreen(container: HTMLElement, tasks: Task[], projects: Project[]): void {
    this.renderHeader(container, "検索");
    const input = container.createEl("input", {
      type: "search",
      value: this.searchQuery,
      placeholder: "タスク、ラベル、プロジェクトを検索",
      cls: "taskmate-search-input",
      attr: { "aria-label": "タスクを検索" }
    });
    input.addEventListener("input", () => {
      this.searchQuery = input.value;
      this.focusAfterRender = "search";
      this.scheduleRender();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && this.searchQuery.trim()) void this.rememberSearch(this.searchQuery);
    });
    this.restoreFocus(input, "search");

    const recent = this.plugin.settings.recentSearches ?? [];
    if (recent.length > 0) {
      const section = container.createDiv({ cls: "taskmate-section" });
      const heading = section.createDiv({ cls: "taskmate-section-heading" });
      heading.createEl("h3", { text: "最近の検索" });
      const clear = heading.createEl("button", { text: "消去" });
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
      container.createDiv({ cls: "taskmate-empty", text: "検索語を入力してください" });
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
      const edit = header.createEl("button", { text: "編集" });
      edit.addEventListener("click", () => {
        this.projectScreen = "edit";
        this.requestRender();
      });
      this.renderSortControl(container);
      this.renderTaskList(container, tasks.filter((task) => !task.completed && task.projectId === active.id), projects, true);
      return;
    }

    if (this.projectScreen === "edit" && active) {
      const header = this.renderHeader(container, "プロジェクトを編集");
      this.addBackButton(header, () => {
        this.projectScreen = "detail";
        this.requestRender();
      });
      this.renderProjectEditor(container, active);
      return;
    }

    const header = this.renderHeader(container, "プロジェクト");
    const add = header.createEl("button", { text: "＋ 追加", cls: "mod-cta" });
    add.addEventListener("click", () => this.openCreateProject());
    const recent = [...projects]
      .filter((project) => project.lastUsedAt)
      .sort((a, b) => (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? ""))
      .slice(0, 5);
    if (recent.length > 0) this.renderProjectList(container, "最近使ったプロジェクト", recent, tasks);
    this.renderProjectList(container, "すべてのプロジェクト", [...projects].sort((a, b) => a.name.localeCompare(b.name, "ja")), tasks);
  }

  private renderProjectList(container: HTMLElement, title: string, projects: Project[], tasks: Task[]): void {
    const section = container.createDiv({ cls: "taskmate-section" });
    section.createEl("h3", { text: title });
    if (projects.length === 0) {
      section.createDiv({ cls: "taskmate-empty-compact", text: "プロジェクトはありません" });
      return;
    }
    const list = section.createDiv({ cls: "taskmate-project-list" });
    for (const project of projects) {
      const row = list.createDiv({ cls: "taskmate-project-row" });
      const open = row.createEl("button", { cls: "taskmate-project-open" });
      open.createSpan({ text: project.name });
      open.createSpan({ text: `${tasks.filter((task) => !task.completed && task.projectId === project.id).length}件`, cls: "taskmate-project-count" });
      open.addEventListener("click", async () => {
        await this.plugin.projects.touch(project);
        this.activeProjectId = project.id;
        this.projectScreen = "detail";
        this.requestRender();
      });
      const edit = row.createEl("button", { text: "編集", cls: "taskmate-project-edit" });
      edit.addEventListener("click", () => {
        this.activeProjectId = project.id;
        this.projectScreen = "edit";
        this.requestRender();
      });
    }
  }

  private renderProjectEditor(container: HTMLElement, project: Project): void {
    const panel = container.createDiv({ cls: "taskmate-project-editor" });
    const label = panel.createEl("label", { text: "プロジェクト名" });
    const input = label.createEl("input", { type: "text", value: project.name });
    const save = panel.createEl("button", { text: "名称を保存", cls: "mod-cta" });
    save.addEventListener("click", async () => {
      if (!input.value.trim()) return;
      await this.plugin.projects.update(project, { name: input.value.trim() });
      this.projectScreen = "detail";
      this.requestRender();
    });
    const remove = panel.createEl("button", { text: "プロジェクトを削除", cls: "mod-warning" });
    remove.addEventListener("click", async () => {
      if (!window.confirm(`「${project.name}」を削除しますか？タスクは未所属へ移動します。`)) return;
      await this.plugin.repository.clearProject(project.id);
      await this.plugin.projects.remove(project);
      this.activeProjectId = null;
      this.projectScreen = "index";
      new Notice("プロジェクトを削除し、タスクを未所属へ移動しました");
      this.requestRender();
    });
  }

  private renderFilterScreen(container: HTMLElement, tasks: Task[], projects: Project[]): void {
    this.renderHeader(container, "フィルタ");
    const priorities = container.createDiv({ cls: "taskmate-section" });
    priorities.createEl("h3", { text: "優先度" });
    const priorityButtons = priorities.createDiv({ cls: "taskmate-filter-buttons" });
    ([1, 2, 3] as Priority[]).forEach((priority) => {
      const selected = this.selectedPriorities.includes(priority);
      const button = priorityButtons.createEl("button", { text: `優先度 ${priority}`, cls: selected ? "is-active" : "" });
      button.addEventListener("click", () => {
        this.selectedPriorities = selected
          ? this.selectedPriorities.filter((value) => value !== priority)
          : [...this.selectedPriorities, priority];
        this.requestRender();
      });
    });

    const labelsSection = container.createDiv({ cls: "taskmate-section" });
    const labelsHeading = labelsSection.createDiv({ cls: "taskmate-section-heading" });
    labelsHeading.createEl("h3", { text: "ラベル" });
    const allLabels = [...new Set(tasks.flatMap((task) => task.labels))].slice(0, 500);
    const toggle = labelsHeading.createEl("button", { text: this.labelsExpanded ? "たたむ" : `すべて表示 (${allLabels.length})` });
    toggle.addEventListener("click", () => {
      this.labelsExpanded = !this.labelsExpanded;
      this.requestRender();
    });
    const labelSearch = labelsSection.createEl("input", {
      type: "search",
      value: this.labelQuery,
      placeholder: "ラベルを検索",
      cls: "taskmate-label-search",
      attr: { "aria-label": "ラベルを検索" }
    });
    labelSearch.addEventListener("input", () => {
      this.labelQuery = labelSearch.value;
      this.focusAfterRender = "label";
      this.scheduleRender();
    });
    this.restoreFocus(labelSearch, "label");

    const favoriteSet = new Set(this.plugin.settings.favoriteLabels ?? []);
    const matchingLabels = allLabels
      .filter((label) => label.toLocaleLowerCase().includes(this.labelQuery.trim().toLocaleLowerCase()))
      .sort((a, b) => Number(favoriteSet.has(b)) - Number(favoriteSet.has(a)) || a.localeCompare(b, "ja"));
    const visibleLabels = this.labelQuery.trim() || this.labelsExpanded
      ? matchingLabels
      : matchingLabels.filter((label) => favoriteSet.has(label)).concat(matchingLabels.filter((label) => !favoriteSet.has(label)).slice(0, 12));
    const labelList = labelsSection.createDiv({ cls: "taskmate-label-list" });
    visibleLabels.slice(0, 500).forEach((label) => {
      const row = labelList.createDiv({ cls: "taskmate-label-row" });
      const selected = this.selectedLabels.includes(label);
      const choose = row.createEl("button", { text: label, cls: selected ? "is-active taskmate-label-select" : "taskmate-label-select" });
      choose.addEventListener("click", () => {
        this.selectedLabels = selected ? this.selectedLabels.filter((item) => item !== label) : [...this.selectedLabels, label];
        this.requestRender();
      });
      const favorite = row.createEl("button", { text: favoriteSet.has(label) ? "★" : "☆", cls: "taskmate-label-favorite", attr: { "aria-label": `${label}をお気に入りにする` } });
      favorite.addEventListener("click", () => void this.toggleFavoriteLabel(label));
    });

    const selectionCount = this.selectedPriorities.length + this.selectedLabels.length;
    const resultHeader = container.createDiv({ cls: "taskmate-filter-result-heading" });
    resultHeader.createEl("h3", { text: selectionCount > 0 ? `結果` : "フィルタを選択" });
    if (selectionCount > 0) {
      const clear = resultHeader.createEl("button", { text: "すべて解除" });
      clear.addEventListener("click", () => {
        this.selectedPriorities = [];
        this.selectedLabels = [];
        this.requestRender();
      });
      const matches = filterTasks(tasks, "all", {
        priorities: this.selectedPriorities,
        labels: this.selectedLabels,
        search: ""
      });
      this.renderTaskList(container, matches, projects, false);
    }
  }

  private renderSortControl(container: HTMLElement): void {
    const controls = container.createDiv({ cls: "taskmate-sort" });
    const sort = controls.createEl("select", { attr: { "aria-label": "並べ替え" } });
    (Object.keys(SORT_LABELS) as SortMode[]).forEach((mode) => sort.createEl("option", { text: SORT_LABELS[mode], value: mode }));
    sort.value = this.sortMode;
    sort.addEventListener("change", () => {
      this.sortMode = sort.value as SortMode;
      this.requestRender();
    });
  }

  private renderTaskList(container: HTMLElement, source: Task[], projects: Project[], allowReorder: boolean): void {
    const visibleTasks = sortTasks(source, this.sortMode);
    const projectNames = new Map(projects.map((project) => [project.id, project.name]));
    const list = container.createDiv({ cls: "taskmate-list", attr: { role: "list" } });
    if (visibleTasks.length === 0) {
      list.createDiv({ cls: "taskmate-empty", text: "タスクはありません" });
      return;
    }
    visibleTasks.forEach((task) => this.renderTask(list, task, projectNames));
    this.sortable = Sortable.create(list, {
      animation: 140,
      handle: ".taskmate-drag",
      draggable: ".taskmate-task",
      disabled: this.sortMode !== "manual" || !allowReorder,
      delay: 120,
      delayOnTouchOnly: true,
      touchStartThreshold: 4,
      onEnd: async (event) => {
        if (event.oldIndex === event.newIndex || event.newIndex === undefined) return;
        const orderedIds = Array.from(list.querySelectorAll<HTMLElement>(".taskmate-task")).map((element) => element.dataset.taskId ?? "");
        const id = orderedIds[event.newIndex];
        await this.plugin.repository.reorder(id, orderedIds[event.newIndex - 1] ?? null, orderedIds[event.newIndex + 1] ?? null);
        this.requestRender();
      }
    });
  }

  private renderTask(list: HTMLElement, task: Task, projectNames: Map<string, string>): void {
    const row = list.createDiv({ cls: `taskmate-task${task.completed ? " is-completed" : ""}`, attr: { role: "listitem" } });
    row.dataset.taskId = task.id;
    const drag = row.createEl("button", { text: "⠿", cls: "taskmate-drag", attr: { "aria-label": "並べ替え" } });
    drag.disabled = this.sortMode !== "manual" || this.screen === "search" || this.screen === "filter";
    const checkbox = row.createEl("input", { type: "checkbox", attr: { "aria-label": `${task.title}を完了` } });
    checkbox.checked = task.completed;
    checkbox.addEventListener("change", async () => {
      await this.plugin.repository.update(task, { completed: checkbox.checked });
      this.requestRender();
    });
    const body = row.createDiv({ cls: "taskmate-task-body" });
    const title = body.createEl("button", { text: task.title, cls: "taskmate-title" });
    title.addEventListener("click", () => void this.openEditTask(task));
    const metadata = body.createDiv({ cls: "taskmate-metadata" });
    if (task.date) metadata.createSpan({ text: task.date });
    if (task.priority) metadata.createSpan({ text: `P${task.priority}`, cls: `taskmate-priority taskmate-priority-${task.priority}` });
    if (task.projectId && projectNames.has(task.projectId)) metadata.createSpan({ text: projectNames.get(task.projectId) });
    task.labels.slice(0, 3).forEach((label) => metadata.createSpan({ text: `#${label}` }));
    const more = row.createEl("button", { text: "•••", cls: "taskmate-more", attr: { "aria-label": "その他" } });
    more.addEventListener("click", (event) => {
      const menu = new Menu();
      menu.addItem((item) => item.setTitle("編集").setIcon("pencil").onClick(() => void this.openEditTask(task)));
      menu.addItem((item) => item.setTitle("削除").setIcon("trash").onClick(async () => {
        if (!window.confirm(`「${task.title}」をゴミ箱へ移動しますか？`)) return;
        await this.plugin.repository.remove(task);
        new Notice("タスクをゴミ箱へ移動しました");
        this.requestRender();
      }));
      menu.showAtMouseEvent(event);
    });
  }

  private renderNavigation(root: HTMLElement): void {
    const navigation = root.createDiv({ cls: "taskmate-navigation", attr: { "aria-label": "メインナビゲーション" } });
    NAV_ITEMS.forEach((item) => {
      const button = navigation.createEl("button", {
        cls: item.screen === this.screen ? "is-active" : "",
        attr: { "aria-current": item.screen === this.screen ? "page" : "false" }
      });
      button.createSpan({ text: item.icon, cls: "taskmate-nav-icon" });
      button.createSpan({ text: item.label });
      button.addEventListener("click", () => {
        this.screen = item.screen;
        if (item.screen === "projects") this.projectScreen = "index";
        this.requestRender();
      });
    });
  }

  private addBackButton(header: HTMLElement, action: () => void): void {
    const button = header.createEl("button", { text: "‹", cls: "taskmate-back", attr: { "aria-label": "戻る" } });
    header.prepend(button);
    button.addEventListener("click", action);
  }

  private scheduleRender(): void {
    if (this.inputTimer !== null) window.clearTimeout(this.inputTimer);
    this.inputTimer = window.setTimeout(() => this.requestRender(), 140);
  }

  private restoreFocus(input: HTMLInputElement, type: "search" | "label"): void {
    if (this.focusAfterRender !== type) return;
    this.focusAfterRender = null;
    window.setTimeout(() => {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }, 0);
  }

  private async rememberSearch(value: string): Promise<void> {
    const word = value.trim();
    if (!word) return;
    this.plugin.settings.recentSearches = [word, ...(this.plugin.settings.recentSearches ?? []).filter((item) => item !== word)].slice(0, 10);
    await this.plugin.saveSettings();
    this.requestRender();
  }

  private async toggleFavoriteLabel(label: string): Promise<void> {
    const favorites = this.plugin.settings.favoriteLabels ?? [];
    this.plugin.settings.favoriteLabels = favorites.includes(label) ? favorites.filter((item) => item !== label) : [...favorites, label];
    await this.plugin.saveSettings();
    this.requestRender();
  }

  private async openCreateTask(projectId: string | null): Promise<void> {
    const projects = await this.plugin.projects.list();
    new TaskModal(this.app, null, projects, this.plugin.settings.recentLabels ?? [], projectId, async (draft) => {
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
    new TaskModal(this.app, task, projects, this.plugin.settings.recentLabels ?? [], task.projectId, async (draft) => {
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
    new ProjectModal(this.app, async (name) => {
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
