import { Notice, Plugin, TFile, normalizePath } from "obsidian";
import { TaskRepository } from "./tasks/repository";
import { ProjectRepository } from "./projects/project-repository";
import { DEFAULT_SETTINGS, TaskMateSettingTab } from "./settings";
import type { TaskMateSettings } from "./settings";
import { TODO_VIEW_TYPE, TodoListView } from "./task-list/view";
import { createI18n, desktopLanguageToRecord, isLanguagePreference } from "./i18n";
import type { I18n } from "./i18n";
import { detectObsidianLanguage, isDesktopObsidian } from "./i18n/obsidian-locale";
import { TaskChangeProposalRepository } from "./reviews/task-change/proposal-repository";
import { openProposalInReviewView, TASK_CHANGE_REVIEW_VIEW_TYPE, TaskChangeReviewView } from "./reviews/task-change/review-view";
import { SourceCandidateReviewRepository } from "./reviews/source-candidate/review-repository";
import { SOURCE_CANDIDATE_REVIEW_VIEW_TYPE, SourceCandidateReviewView, sourceReviewIdFromLink } from "./reviews/source-candidate/review-view";

export default class TaskMatePlugin extends Plugin {
  settings: TaskMateSettings = DEFAULT_SETTINGS;
  repository!: TaskRepository;
  projects!: ProjectRepository;
  proposals!: TaskChangeProposalRepository;
  sourceReviews!: SourceCandidateReviewRepository;
  private refreshTimer: number | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    await this.recordDesktopLanguage();
    const { t } = this.i18n();
    this.repository = new TaskRepository(this.app, () => this.settings.taskFolder);
    this.projects = new ProjectRepository(this.app, () => this.settings.projectFolder);
    this.proposals = new TaskChangeProposalRepository(this.app, () => this.settings.proposalFolder, this.repository);
    this.sourceReviews = new SourceCandidateReviewRepository(this.app, () => this.settings.proposalFolder, this.repository);
    try {
      const migrated = await this.repository.migrateLegacyFileNames();
      if (migrated > 0) new Notice(t("notice.migratedTaskNames", { count: migrated }));
    } catch (error) {
      console.error("TaskMate could not migrate legacy task filenames", error);
      new Notice(t("notice.migrationFailed"));
    }
    this.registerView(TODO_VIEW_TYPE, (leaf) => new TodoListView(leaf, this));
    this.registerView(TASK_CHANGE_REVIEW_VIEW_TYPE, (leaf) => new TaskChangeReviewView(leaf, this));
    this.registerView(SOURCE_CANDIDATE_REVIEW_VIEW_TYPE, (leaf) => new SourceCandidateReviewView(leaf, this));
    this.addSettingTab(new TaskMateSettingTab(this.app, this));

    this.addRibbonIcon("circle-check-big", t("command.openRibbon"), () => void this.activateView());
    this.addCommand({ id: "open-todo-list", name: t("command.openList"), callback: () => void this.activateView() });
    this.addCommand({ id: "open-task-change-reviews", name: t("command.openReviews"), callback: () => void this.openReviewIndex() });
    this.registerObsidianProtocolHandler("taskmate-review", async (params) => {
      const proposalId = params.proposal;
      if (!proposalId || !/^proposal-[A-Za-z0-9._-]+$/.test(proposalId)) {
        new Notice(this.i18n().t("review.invalidLink"));
        return;
      }
      const taskId = typeof params.task === "string" && /^[A-Za-z0-9._-]+$/.test(params.task) ? params.task : undefined;
      const changeId = typeof params.change === "string" && /^C-[0-9]{2,}$/.test(params.change) ? params.change : undefined;
      await this.openProposalReview(proposalId, taskId, changeId);
    });
    this.addCommand({ id: "open-source-candidate-reviews", name: t("command.openSourceReviews"), callback: () => void this.openSourceReviewIndex() });
    this.registerObsidianProtocolHandler("taskmate-source-review", async (params) => {
      const reviewId = sourceReviewIdFromLink(params);
      if (!reviewId) {
        new Notice(this.i18n().t("sourceReview.invalidLink"));
        return;
      }
      await this.openSourceReview(reviewId);
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

    const scheduleRefresh = (file: TFile) => {
      const taskPrefix = `${normalizePath(this.settings.taskFolder)}/`;
      const projectPrefix = `${normalizePath(this.settings.projectFolder)}/`;
      const proposalPrefix = `${normalizePath(this.settings.proposalFolder)}/`;
      if (!file.path.startsWith(taskPrefix) && !file.path.startsWith(projectPrefix) && !file.path.startsWith(proposalPrefix)) return;
      if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
      this.refreshTimer = window.setTimeout(() => {
        this.refreshViews();
        for (const leaf of this.app.workspace.getLeavesOfType(TASK_CHANGE_REVIEW_VIEW_TYPE)) {
          if (leaf.view instanceof TaskChangeReviewView) leaf.view.requestRender();
        }
        for (const leaf of this.app.workspace.getLeavesOfType(SOURCE_CANDIDATE_REVIEW_VIEW_TYPE)) {
          if (leaf.view instanceof SourceCandidateReviewView) leaf.view.requestRender();
        }
      }, 100);
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

  async activateReviewView(): Promise<TaskChangeReviewView> {
    let leaf = this.app.workspace.getLeavesOfType(TASK_CHANGE_REVIEW_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf(false);
      await leaf.setViewState({ type: TASK_CHANGE_REVIEW_VIEW_TYPE, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
    return leaf.view as TaskChangeReviewView;
  }

  async openReviewIndex(): Promise<void> {
    const view = await this.activateReviewView();
    await view.openIndex();
  }

  async openProposalReview(proposalId: string, taskId?: string, changeId?: string): Promise<void> {
    await openProposalInReviewView(() => this.activateReviewView(), proposalId, taskId, changeId);
  }

  async activateSourceReviewView(): Promise<SourceCandidateReviewView> {
    let leaf = this.app.workspace.getLeavesOfType(SOURCE_CANDIDATE_REVIEW_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf(false);
      await leaf.setViewState({ type: SOURCE_CANDIDATE_REVIEW_VIEW_TYPE, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
    return leaf.view as SourceCandidateReviewView;
  }

  async openSourceReviewIndex(): Promise<void> {
    const view = await this.activateSourceReviewView();
    await view.openIndex();
  }

  async openSourceReview(reviewId: string): Promise<void> {
    const view = await this.activateSourceReviewView();
    await view.openReview(reviewId);
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

  // Obsidian applies a language change by reloading its window, which loads this plugin again, so reading the language
  // once at load is enough.
  private async recordDesktopLanguage(): Promise<void> {
    const language = desktopLanguageToRecord(this.settings.desktopLanguage, isDesktopObsidian(), detectObsidianLanguage());
    if (!language) return;
    this.settings.desktopLanguage = language;
    try {
      await this.saveSettings();
    } catch (error) {
      console.error("TaskMate could not record the desktop language for Task Pilot", error);
    }
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
