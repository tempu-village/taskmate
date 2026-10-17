import { Notice } from "obsidian";
import type { App } from "obsidian";
import type { I18n } from "../i18n";
import type { LabelEditingOptions } from "../labels/label-picker-modal";
import type { ProjectRepository } from "../projects/project-repository";
import type { Project, Task } from "../tasks/domain";
import { DuplicateTaskIdError } from "../tasks/repository";
import type { TaskRepository, TaskSaveConflict, TaskSaveResult } from "../tasks/repository";
import { TaskConflictModal } from "./task-conflict-modal";
import { TaskModal } from "./task-modal";

interface TaskEditingContext {
  app: App;
  availableRegion: HTMLElement;
  repository: Pick<TaskRepository, "list" | "create" | "beginEdit" | "saveEditedTask" | "resolveEditConflict" | "remove">;
  projects: Pick<ProjectRepository, "list" | "touch">;
  i18n: () => I18n;
  labelOptions: (tasks: Task[]) => LabelEditingOptions;
  rememberLabels: (labels: string[]) => Promise<void>;
  refresh: () => void;
}

export class TaskEditingFlow {
  constructor(private readonly context: TaskEditingContext) {}

  async openCreate(projectId: string | null): Promise<void> {
    const { app, availableRegion, repository } = this.context;
    const [projects, tasks] = await Promise.all([this.context.projects.list(), repository.list()]);
    new TaskModal(app, null, projects, this.context.labelOptions(tasks), projectId, availableRegion, this.context.i18n(), async (draft) => {
      await repository.create(draft);
      await this.context.rememberLabels(draft.labels);
      await this.touchProject(projects, draft.projectId);
      this.context.refresh();
      return true;
    }).open();
  }

  async openEdit(task: Task, afterAction?: () => void): Promise<void> {
    const { app, availableRegion, repository } = this.context;
    const [projects, tasks] = await Promise.all([this.context.projects.list(), repository.list()]);
    const start = await repository.beginEdit(task);
    if (start.status === "identity-conflict") {
      this.showIdentityConflict(start.conflict.paths);
      return;
    }
    if (start.status === "missing") {
      new Notice(this.context.i18n().t("conflict.missing"));
      this.context.refresh();
      return;
    }
    let modal: TaskModal;
    modal = new TaskModal(app, start.task, projects, this.context.labelOptions(tasks), start.task.projectId, availableRegion, this.context.i18n(), async (draft) => {
      const result = await repository.saveEditedTask(start.session, draft);
      return this.handleSaveResult(result, projects, modal, afterAction);
    }, async () => {
      try {
        await repository.remove(start.task);
        new Notice(this.context.i18n().t("tasks.deletedNotice"));
        if (afterAction) afterAction();
        else this.context.refresh();
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

  private async handleSaveResult(
    result: TaskSaveResult,
    projects: Project[],
    taskModal: TaskModal,
    afterAction?: () => void,
    savedNotice?: "conflict.resolved"
  ): Promise<boolean> {
    const { t } = this.context.i18n();
    if (result.status === "saved") {
      await this.context.rememberLabels(result.task.labels);
      await this.touchProject(projects, result.task.projectId);
      if (savedNotice) new Notice(t(savedNotice));
      else if (result.externalChangesPreserved) new Notice(t("conflict.externalPreserved"));
      if (afterAction) afterAction();
      else this.context.refresh();
      return true;
    }
    if (result.status === "conflict") {
      this.openConflict(result, projects, taskModal, afterAction);
      return false;
    }
    if (result.status === "identity-conflict") {
      this.showIdentityConflict(result.conflict.paths);
      return false;
    }
    new Notice(t(result.status === "review-stale" ? "conflict.changedAgain" : "conflict.missing"));
    this.context.refresh();
    return false;
  }

  private openConflict(
    conflict: TaskSaveConflict,
    projects: Project[],
    taskModal: TaskModal,
    afterAction?: () => void
  ): void {
    new TaskConflictModal(this.context.app, conflict, projects, this.context.i18n(), async (choices) => {
      const result = await this.context.repository.resolveEditConflict(conflict, choices);
      if (result.status === "saved") {
        await this.handleSaveResult(result, projects, taskModal, afterAction, "conflict.resolved");
        taskModal.close();
        return true;
      }
      if (result.status === "conflict") {
        new Notice(this.context.i18n().t("conflict.changedAgain"));
        window.setTimeout(() => this.openConflict(result, projects, taskModal, afterAction), 0);
        return true;
      }
      await this.handleSaveResult(result, projects, taskModal, afterAction);
      return true;
    }).open();
  }

  private showIdentityConflict(paths: string[]): void {
    new Notice(this.context.i18n().t("conflict.identityNotice", { paths: paths.join(", ") }), 0);
    this.context.refresh();
  }

  private async touchProject(projects: Project[], projectId: string | null): Promise<void> {
    if (!projectId) return;
    const project = projects.find((item) => item.id === projectId);
    if (project) await this.context.projects.touch(project);
  }
}
