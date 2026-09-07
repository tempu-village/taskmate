import { Notice, Plugin, TFile, normalizePath } from "obsidian";
import { TaskRepository } from "./repository";
import { BennrinaTodoSettingTab, DEFAULT_SETTINGS } from "./settings";
import type { BennrinaTodoSettings } from "./settings";
import { TODO_VIEW_TYPE, TodoListView } from "./view";

export default class BennrinaTodoPlugin extends Plugin {
  settings: BennrinaTodoSettings = DEFAULT_SETTINGS;
  repository!: TaskRepository;
  private refreshTimer: number | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.repository = new TaskRepository(this.app, () => this.settings.taskFolder);
    this.registerView(TODO_VIEW_TYPE, (leaf) => new TodoListView(leaf, this));
    this.addSettingTab(new BennrinaTodoSettingTab(this.app, this));

    this.addRibbonIcon("circle-check-big", "TaskMateを開く", () => void this.activateView());
    this.addCommand({ id: "open-todo-list", name: "タスク一覧を開く", callback: () => void this.activateView() });
    this.addCommand({
      id: "include-current-note-as-ai-source",
      name: "現在のノートをAI対象にする",
      checkCallback: (checking) => this.setCurrentNoteSource(true, checking)
    });
    this.addCommand({
      id: "exclude-current-note-as-ai-source",
      name: "現在のノートをAI対象外にする",
      checkCallback: (checking) => this.setCurrentNoteSource(false, checking)
    });
    this.addCommand({
      id: "include-current-folder-as-ai-source",
      name: "現在のフォルダをAI対象にする",
      checkCallback: (checking) => this.includeCurrentFolder(checking)
    });

    const scheduleRefresh = (file: TFile) => {
      const prefix = `${normalizePath(this.settings.taskFolder)}/`;
      if (!file.path.startsWith(prefix)) return;
      if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
      this.refreshTimer = window.setTimeout(() => this.refreshViews(), 100);
    };
    this.registerEvent(this.app.vault.on("create", (file) => { if (file instanceof TFile) scheduleRefresh(file); }));
    this.registerEvent(this.app.vault.on("modify", (file) => { if (file instanceof TFile) scheduleRefresh(file); }));
    this.registerEvent(this.app.vault.on("delete", (file) => { if (file instanceof TFile) scheduleRefresh(file); }));
    this.registerEvent(this.app.vault.on("rename", (file) => { if (file instanceof TFile) scheduleRefresh(file); }));
  }

  onunload(): void {
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
  }

  async activateView(): Promise<void> {
    let leaf = this.app.workspace.getLeavesOfType(TODO_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf(false);
      await leaf.setViewState({ type: TODO_VIEW_TYPE, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
  }

  refreshViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(TODO_VIEW_TYPE)) {
      if (leaf.view instanceof TodoListView) leaf.view.requestRender();
    }
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData() as Partial<BennrinaTodoSettings> | null) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private setCurrentNoteSource(value: boolean, checking: boolean): boolean {
    const file = this.app.workspace.getActiveFile();
    if (!file) return false;
    if (!checking) {
      void this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        frontmatter["taskmate-source"] = value;
      }).then(() => new Notice(value ? "AI対象に追加しました" : "AI対象から除外しました"));
    }
    return true;
  }

  private includeCurrentFolder(checking: boolean): boolean {
    const file = this.app.workspace.getActiveFile();
    const folder = file?.parent?.path;
    if (!file || !folder || folder === "/") return false;
    if (!checking) {
      const normalized = normalizePath(folder);
      if (!this.settings.sourceFolders.includes(normalized)) this.settings.sourceFolders.push(normalized);
      void this.saveSettings().then(() => new Notice(`${normalized}をAI対象に追加しました`));
    }
    return true;
  }
}
