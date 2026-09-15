import { Notice, Plugin, TFile, normalizePath } from "obsidian";
import { TaskRepository } from "./repository";
import { ProjectRepository } from "./project-repository";
import { DEFAULT_SETTINGS, TaskMateSettingTab } from "./settings";
import type { TaskMateSettings } from "./settings";
import { TODO_VIEW_TYPE, TodoListView } from "./view";
import { createI18n, isLanguagePreference } from "./i18n";
import type { I18n } from "./i18n";
import { detectObsidianLanguage } from "./i18n/obsidian-locale";

export default class TaskMatePlugin extends Plugin {
  settings: TaskMateSettings = DEFAULT_SETTINGS;
  repository!: TaskRepository;
  projects!: ProjectRepository;
  private refreshTimer: number | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    const { t } = this.i18n();
    this.repository = new TaskRepository(this.app, () => this.settings.taskFolder);
    this.projects = new ProjectRepository(this.app, () => this.settings.projectFolder);
    try {
      const migrated = await this.repository.migrateLegacyFileNames();
      if (migrated > 0) new Notice(t("notice.migratedTaskNames", { count: migrated }));
    } catch (error) {
      console.error("TaskMate could not migrate legacy task filenames", error);
      new Notice(t("notice.migrationFailed"));
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

    const scheduleRefresh = (file: TFile) => {
      const taskPrefix = `${normalizePath(this.settings.taskFolder)}/`;
      const projectPrefix = `${normalizePath(this.settings.projectFolder)}/`;
      if (!file.path.startsWith(taskPrefix) && !file.path.startsWith(projectPrefix)) return;
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

  i18n(): I18n {
    return createI18n(this.settings.language, detectObsidianLanguage());
  }

  async loadSettings(): Promise<void> {
    const loaded = await this.loadData() as Partial<TaskMateSettings> | null;
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...loaded,
      language: loaded?.language === undefined
        ? "auto"
        : isLanguagePreference(loaded.language) ? loaded.language : "en"
    };
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
      }).then(() => {
        const { t } = this.i18n();
        new Notice(value ? t("notice.noteIncluded") : t("notice.noteExcluded"));
      });
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
      void this.saveSettings().then(() => new Notice(this.i18n().t("notice.folderIncluded", { folder: normalized })));
    }
    return true;
  }
}
