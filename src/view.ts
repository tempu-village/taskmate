import { ItemView, Menu, Notice, WorkspaceLeaf } from "obsidian";
import Sortable from "sortablejs";
import { filterTasks, SMART_VIEW_LABELS, sortTasks } from "./domain";
import type { SmartView, SortMode, Task, TaskFilters } from "./domain";
import type BennrinaTodoPlugin from "./main";
import { TaskModal } from "./task-modal";

export const TODO_VIEW_TYPE = "taskmate-list";

const SORT_LABELS: Record<SortMode, string> = {
  manual: "手動順",
  date: "日付順",
  important: "重要順",
  created: "作成日順"
};

export class TodoListView extends ItemView {
  private smartView: SmartView = "today";
  private sortMode: SortMode = "manual";
  private filters: TaskFilters = { importantOnly: false, noDateOnly: false, search: "" };
  private sortable: Sortable | null = null;
  private generation = 0;
  private searchTimer: number | null = null;
  private restoreSearchFocus = false;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: BennrinaTodoPlugin) {
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
    if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
  }

  requestRender(): void {
    void this.render();
  }

  private async render(): Promise<void> {
    const currentGeneration = ++this.generation;
    const tasks = await this.plugin.repository.list();
    if (currentGeneration !== this.generation) return;

    this.sortable?.destroy();
    this.sortable = null;
    const root = this.contentEl;
    root.empty();
    root.addClass("taskmate-view");

    const header = root.createDiv({ cls: "taskmate-header" });
    header.createEl("h2", { text: "TaskMate" });
    const add = header.createEl("button", { text: "＋ 追加", cls: "mod-cta taskmate-add" });
    add.addEventListener("click", () => this.openCreateModal());

    const tabs = root.createDiv({ cls: "taskmate-tabs", attr: { role: "tablist" } });
    (Object.keys(SMART_VIEW_LABELS) as SmartView[]).forEach((view) => {
      const button = tabs.createEl("button", {
        text: SMART_VIEW_LABELS[view],
        cls: view === this.smartView ? "is-active" : "",
        attr: { role: "tab", "aria-selected": String(view === this.smartView) }
      });
      button.addEventListener("click", () => {
        this.smartView = view;
        this.requestRender();
      });
    });

    const controls = root.createDiv({ cls: "taskmate-controls" });
    const search = controls.createEl("input", {
      type: "search",
      placeholder: "タスクを検索",
      value: this.filters.search,
      attr: { "aria-label": "タスクを検索" }
    });
    search.addEventListener("input", () => {
      this.filters.search = search.value;
      this.restoreSearchFocus = true;
      if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
      this.searchTimer = window.setTimeout(() => this.requestRender(), 160);
    });
    if (this.restoreSearchFocus) {
      this.restoreSearchFocus = false;
      window.setTimeout(() => {
        search.focus();
        search.setSelectionRange(search.value.length, search.value.length);
      }, 0);
    }

    const important = controls.createEl("button", { text: "★ 重要", cls: this.filters.importantOnly ? "is-active" : "" });
    important.addEventListener("click", () => {
      this.filters.importantOnly = !this.filters.importantOnly;
      this.requestRender();
    });

    const noDate = controls.createEl("button", { text: "期限なし", cls: this.filters.noDateOnly ? "is-active" : "" });
    noDate.addEventListener("click", () => {
      this.filters.noDateOnly = !this.filters.noDateOnly;
      this.requestRender();
    });

    const sort = controls.createEl("select", { attr: { "aria-label": "並べ替え" } });
    (Object.keys(SORT_LABELS) as SortMode[]).forEach((mode) => {
      sort.createEl("option", { text: SORT_LABELS[mode], value: mode });
    });
    sort.value = this.sortMode;
    sort.addEventListener("change", () => {
      this.sortMode = sort.value as SortMode;
      this.requestRender();
    });

    const visibleTasks = sortTasks(filterTasks(tasks, this.smartView, this.filters), this.sortMode);
    const list = root.createDiv({ cls: "taskmate-list", attr: { role: "list" } });
    if (visibleTasks.length === 0) {
      list.createDiv({ cls: "taskmate-empty", text: "タスクはありません" });
      return;
    }

    visibleTasks.forEach((task) => this.renderTask(list, task));
    this.sortable = Sortable.create(list, {
      animation: 140,
      handle: ".taskmate-drag",
      draggable: ".taskmate-task",
      disabled: this.sortMode !== "manual",
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

  private renderTask(list: HTMLElement, task: Task): void {
    const row = list.createDiv({ cls: `taskmate-task${task.completed ? " is-completed" : ""}`, attr: { role: "listitem" } });
    row.dataset.taskId = task.id;

    const drag = row.createEl("button", { text: "⠿", cls: "taskmate-drag", attr: { "aria-label": "並べ替え" } });
    drag.disabled = this.sortMode !== "manual";

    const checkbox = row.createEl("input", { type: "checkbox", attr: { "aria-label": `${task.title}を完了` } });
    checkbox.checked = task.completed;
    checkbox.addEventListener("change", async () => {
      await this.plugin.repository.update(task, { completed: checkbox.checked });
      this.requestRender();
    });

    const body = row.createDiv({ cls: "taskmate-task-body" });
    const title = body.createEl("button", { text: task.title, cls: "taskmate-title" });
    title.addEventListener("click", () => this.openEditModal(task));
    const metadata = body.createDiv({ cls: "taskmate-metadata" });
    if (task.date) metadata.createSpan({ text: task.date });
    if (task.important) metadata.createSpan({ text: "★ 重要" });
    if (task.sourceNote) metadata.createSpan({ text: "ノートから作成" });

    const more = row.createEl("button", { text: "•••", cls: "taskmate-more", attr: { "aria-label": "その他" } });
    more.addEventListener("click", (event) => {
      const menu = new Menu();
      menu.addItem((item) => item.setTitle("編集").setIcon("pencil").onClick(() => this.openEditModal(task)));
      menu.addItem((item) => item.setTitle("削除").setIcon("trash").onClick(async () => {
        if (!window.confirm(`「${task.title}」をゴミ箱へ移動しますか？`)) return;
        await this.plugin.repository.remove(task);
        new Notice("タスクをゴミ箱へ移動しました");
        this.requestRender();
      }));
      menu.showAtMouseEvent(event);
    });
  }

  private openCreateModal(): void {
    new TaskModal(this.app, null, async (draft) => {
      await this.plugin.repository.create(draft);
      this.requestRender();
    }).open();
  }

  private openEditModal(task: Task): void {
    new TaskModal(this.app, task, async (draft) => {
      await this.plugin.repository.update(task, draft);
      this.requestRender();
    }).open();
  }
}
