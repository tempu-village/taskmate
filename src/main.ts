import { Notice, Plugin, TFile, normalizePath } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import { TaskRepository } from "./tasks/repository";
import { ProjectRepository } from "./projects/project-repository";
import { DEFAULT_SETTINGS, TaskMateSettingTab } from "./settings";
import type { TaskMateSettings } from "./settings";
import { TODO_VIEW_TYPE, TodoListView } from "./task-list/view";
import { createI18n, desktopLanguageToRecord, isLanguagePreference } from "./i18n";
import type { I18n } from "./i18n";
import { detectObsidianLanguage, isDesktopObsidian } from "./i18n/obsidian-locale";
import { TaskChangeProposalRepository } from "./reviews/task-change/proposal-repository";
import { openProposalInReviewView, TASK_CHANGE_REVIEW_VIEW_TYPE, TaskChangeReviewView, taskChangeIndexDetails } from "./reviews/task-change/review-view";
import { ImportReviewRepository } from "./reviews/import/review-repository";
import { importReviewCompatibility } from "./reviews/import/proposal";
import { IMPORT_REVIEW_VIEW_TYPE, ImportReviewView, importReviewIdFromLink, importReviewIndexDetails } from "./reviews/import/review-view";
import { ReviewCatalog } from "./reviews/shared/review-catalog";
import type { ReviewLocation, ReviewReference } from "./reviews/shared/review-catalog";
import { buildReviewIndex } from "./reviews/shared/review-index";
import type { ReviewIndexDetails, ReviewIndexItem } from "./reviews/shared/review-index";
import { REVIEW_INDEX_VIEW_TYPE, ReviewIndexView } from "./reviews/shared/review-index-view";

export default class TaskMatePlugin extends Plugin {
  settings: TaskMateSettings = DEFAULT_SETTINGS;
  repository!: TaskRepository;
  projects!: ProjectRepository;
  proposals!: TaskChangeProposalRepository;
  importReviews!: ImportReviewRepository;
  reviewCatalog!: ReviewCatalog;
  private refreshTimer: number | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    await this.recordAgentContext();
    const { t } = this.i18n();
    this.repository = new TaskRepository(this.app, () => this.settings.taskFolder);
    this.projects = new ProjectRepository(this.app, () => this.settings.projectFolder);
    this.proposals = new TaskChangeProposalRepository(this.app, () => this.settings.proposalFolder, this.repository);
    this.importReviews = new ImportReviewRepository(this.app, () => this.settings.proposalFolder, this.repository);
    this.reviewCatalog = new ReviewCatalog(this.app, () => this.settings.proposalFolder);
    try {
      const migrated = await this.repository.migrateLegacyFileNames();
      if (migrated > 0) new Notice(t("notice.migratedTaskNames", { count: migrated }));
    } catch (error) {
      console.error("TaskMate could not migrate legacy task filenames", error);
      new Notice(t("notice.migrationFailed"));
    }
    this.registerView(TODO_VIEW_TYPE, (leaf) => new TodoListView(leaf, this));
    this.registerView(TASK_CHANGE_REVIEW_VIEW_TYPE, (leaf) => new TaskChangeReviewView(leaf, this));
    this.registerView(IMPORT_REVIEW_VIEW_TYPE, (leaf) => new ImportReviewView(leaf, this));
    this.registerView(REVIEW_INDEX_VIEW_TYPE, (leaf) => new ReviewIndexView(leaf, this));
    this.addSettingTab(new TaskMateSettingTab(this.app, this));

    this.addRibbonIcon("circle-check-big", t("command.openRibbon"), () => void this.activateView());
    this.addCommand({ id: "open-todo-list", name: t("command.openList"), callback: () => void this.activateView() });
    this.addCommand({ id: "open-reviews", name: t("command.openReviews"), callback: () => void this.openReviewIndex() });
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
    this.registerObsidianProtocolHandler("taskmate-import-review", async (params) => {
      const reviewId = importReviewIdFromLink(params);
      if (!reviewId) {
        new Notice(this.i18n().t("importReview.invalidLink"));
        return;
      }
      await this.openImportReview(reviewId);
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
        for (const leaf of this.app.workspace.getLeavesOfType(IMPORT_REVIEW_VIEW_TYPE)) {
          if (leaf.view instanceof ImportReviewView) leaf.view.requestRender();
        }
        for (const leaf of this.app.workspace.getLeavesOfType(REVIEW_INDEX_VIEW_TYPE)) {
          if (leaf.view instanceof ReviewIndexView) leaf.view.requestRender();
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

  // Shows the shared review list, in the given leaf when a review view returns to it.
  async openReviewIndex(location: ReviewLocation = "pending", leaf?: WorkspaceLeaf): Promise<void> {
    const target = leaf ?? this.app.workspace.getLeavesOfType(REVIEW_INDEX_VIEW_TYPE)[0] ?? this.app.workspace.getLeaf(false);
    const view = await this.showViewInLeaf(target, REVIEW_INDEX_VIEW_TYPE) as ReviewIndexView;
    await view.show(location);
  }

  // Routes a catalog entry to the review view that owns its kind, in the same leaf as the list.
  async openReview(ref: ReviewReference, leaf: WorkspaceLeaf): Promise<void> {
    if (ref.kind === "task-change") {
      const view = await this.showViewInLeaf(leaf, TASK_CHANGE_REVIEW_VIEW_TYPE) as TaskChangeReviewView;
      await (ref.location === "history" ? view.openHistoryProposal(ref.id) : view.openProposal(ref.id));
      return;
    }
    const view = await this.showViewInLeaf(leaf, IMPORT_REVIEW_VIEW_TYPE) as ImportReviewView;
    await view.openReview(ref.id);
  }

  // Lists every review kind together: the catalog classifies the files and each owning Module describes its own reviews.
  async reviewIndex(location: ReviewLocation): Promise<ReviewIndexItem[]> {
    const i18n = this.i18n();
    const [entries, taskChanges, importReviews] = await Promise.all([
      this.reviewCatalog.list(location),
      location === "pending" ? this.proposals.listPending() : this.proposals.listHistory(),
      location === "pending" ? this.importReviews.listPending() : this.importReviews.listHistory()
    ]);
    const details = new Map<string, ReviewIndexDetails>([
      ...taskChanges.map((summary): [string, ReviewIndexDetails] => [`task-change:${summary.id}`, taskChangeIndexDetails(summary, i18n)]),
      ...importReviews.map((summary): [string, ReviewIndexDetails] => [`import:${summary.reviewId}`, importReviewIndexDetails(summary, i18n)])
    ]);
    return buildReviewIndex(entries, (ref) => details.get(`${ref.kind}:${ref.id}`) ?? null);
  }

  async openProposalReview(proposalId: string, taskId?: string, changeId?: string): Promise<void> {
    await openProposalInReviewView(() => this.activateReviewView(), proposalId, taskId, changeId);
  }

  async activateImportReviewView(): Promise<ImportReviewView> {
    let leaf = this.app.workspace.getLeavesOfType(IMPORT_REVIEW_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf(false);
      await leaf.setViewState({ type: IMPORT_REVIEW_VIEW_TYPE, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
    return leaf.view as ImportReviewView;
  }

  async openImportReview(reviewId: string): Promise<void> {
    const view = await this.activateImportReviewView();
    await view.openReview(reviewId);
  }

  private async showViewInLeaf(leaf: WorkspaceLeaf, type: string): Promise<WorkspaceLeaf["view"]> {
    if (leaf.view.getViewType() !== type) await leaf.setViewState({ type, active: true });
    await this.app.workspace.revealLeaf(leaf);
    return leaf.view;
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

  // Records what Task Pilot needs to know about the loaded plugin: the desktop language, and the plugin version with the
  // Import review schema versions it reads. Obsidian applies a language change or a plugin update by loading this plugin
  // again, so recording once at load is enough.
  private async recordAgentContext(): Promise<void> {
    const language = desktopLanguageToRecord(this.settings.desktopLanguage, isDesktopObsidian(), detectObsidianLanguage());
    const compatibility = importReviewCompatibility(this.manifest.version);
    const compatibilityChanged = JSON.stringify(this.settings.agentCompatibility) !== JSON.stringify(compatibility);
    if (!language && !compatibilityChanged) return;
    if (language) this.settings.desktopLanguage = language;
    this.settings.agentCompatibility = compatibility;
    try {
      await this.saveSettings();
    } catch (error) {
      console.error("TaskMate could not record its compatibility and desktop language for Task Pilot", error);
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
