import { ItemView, Modal, Notice, WorkspaceLeaf } from "obsidian";
import type TaskMatePlugin from "./main";
import { createTaskChangeReviewState, reduceTaskChangeReviewState, renderTaskChangeReview } from "./task-change-review-renderer";
import type { TaskChangeReviewAction, TaskChangeReviewCopy, TaskChangeReviewState } from "./task-change-review-renderer";
import type { ProposalReview } from "./task-change-proposal";
import { captureReviewPosition, restoreReviewPosition } from "./task-change-review-scroll";

export const TASK_CHANGE_REVIEW_VIEW_TYPE = "taskmate-change-review";

export class TaskChangeReviewView extends ItemView {
  private proposalId: string | null = null;
  private targetTaskId: string | null = null;
  private targetChangeId: string | null = null;
  private review: ProposalReview | null = null;
  private state: TaskChangeReviewState = createTaskChangeReviewState();

  constructor(leaf: WorkspaceLeaf, private readonly plugin: TaskMatePlugin) {
    super(leaf);
  }

  getViewType(): string { return TASK_CHANGE_REVIEW_VIEW_TYPE; }
  getDisplayText(): string { return this.plugin.i18n().t("review.title"); }
  getIcon(): string { return "file-diff"; }

  async onOpen(): Promise<void> { await this.render(); }

  requestRender(): void { void this.render("scroll"); }

  async openProposal(proposalId: string, taskId?: string, changeId?: string): Promise<void> {
    this.proposalId = proposalId;
    this.targetTaskId = taskId ?? null;
    this.targetChangeId = changeId ?? null;
    this.state = createTaskChangeReviewState();
    await this.render();
  }

  private async render(preserve?: "scroll" | "anchor"): Promise<void> {
    const position = preserve ? captureReviewPosition(this.contentEl, preserve) : null;
    this.contentEl.empty();
    if (!this.proposalId) {
      const pending = await this.plugin.proposals.listPending();
      const root = this.contentEl.createDiv({ cls: "taskmate-review-index" });
      root.createEl("h2", { text: this.plugin.i18n().t("review.pending") });
      if (pending.length === 0) root.createDiv({ cls: "taskmate-empty", text: this.plugin.i18n().t("review.none") });
      for (const proposal of pending) {
        const open = root.createEl("button", { cls: "taskmate-review-index-item" });
        open.createSpan({ text: proposal.id });
        open.createSpan({ text: this.plugin.i18n().t("review.summary", { tasks: proposal.taskCount, changes: proposal.changeCount }) });
        open.addEventListener("click", () => void this.openProposal(proposal.id));
      }
      return;
    }
    try {
      this.review = await this.plugin.proposals.review(this.proposalId);
      renderTaskChangeReview(this.contentEl, this.review, this.state, reviewCopy(this.plugin), (action) => void this.handle(action));
      if (position) restoreReviewPosition(this.contentEl, position);
      else window.setTimeout(() => this.revealTarget(), 0);
    } catch (error) {
      console.error("TaskMate could not open Proposal", error);
      this.contentEl.createDiv({ cls: "taskmate-empty", text: this.plugin.i18n().t("review.invalid") });
    }
  }

  private async handle(action: TaskChangeReviewAction): Promise<void> {
    let preserve: "scroll" | "anchor" | undefined = action.type === "set-mode" ? "anchor"
      : action.type === "set-approved" || action.type === "set-many-approved" || action.type === "set-task-collapsed" ? "scroll" : undefined;
    this.state = reduceTaskChangeReviewState(this.state, action);
    if (action.type === "navigate-task") {
      this.targetTaskId = action.taskId;
      this.targetChangeId = null;
      await this.render();
      return;
    }
    if (action.type === "apply" && this.proposalId) {
      const result = await this.plugin.proposals.apply(this.proposalId, action.approvedChangeIds);
      new Notice(this.plugin.i18n().t("review.applied", { count: result.closedProposal.result?.succeededChangeIds.length ?? 0 }));
      this.proposalId = result.followUp?.id ?? null;
      this.state = createTaskChangeReviewState();
      preserve = undefined;
    }
    if (action.type === "reject" && this.proposalId) {
      if (!window.confirm(this.plugin.i18n().t("review.rejectConfirm"))) return;
      await this.plugin.proposals.reject(this.proposalId);
      this.proposalId = null;
      new Notice(this.plugin.i18n().t("review.rejected"));
      preserve = undefined;
    }
    await this.render(preserve);
  }

  private revealTarget(): void {
    if (!this.targetTaskId) return;
    const target = this.contentEl.querySelector<HTMLElement>(`#taskmate-review-${CSS.escape(this.targetTaskId)}`);
    target?.scrollIntoView({ block: "start" });
    if (this.targetChangeId) {
      for (const label of Array.from(target?.querySelectorAll<HTMLElement>(".taskmate-review-change") ?? [])) {
        if (label.textContent?.includes(this.targetChangeId)) label.classList.add("is-target");
      }
    }
    this.targetTaskId = null;
    this.targetChangeId = null;
  }

}

export class TaskChangeReviewModal extends Modal {
  constructor(private readonly plugin: TaskMatePlugin, private readonly proposalId: string) { super(plugin.app); }

  async onOpen(): Promise<void> {
    this.modalEl.addClass("taskmate-review-modal");
    const review = await this.plugin.proposals.review(this.proposalId);
    let state: TaskChangeReviewState = createTaskChangeReviewState();
    const rerender = (preserve?: "scroll" | "anchor") => {
      const position = preserve ? captureReviewPosition(this.contentEl, preserve) : null;
      renderTaskChangeReview(this.contentEl, review, state, reviewCopy(this.plugin), (action) => void handle(action));
      if (position) restoreReviewPosition(this.contentEl, position);
    };
    const handle = async (action: TaskChangeReviewAction) => {
      state = reduceTaskChangeReviewState(state, action);
      if (action.type === "apply") { await this.plugin.proposals.apply(this.proposalId, action.approvedChangeIds); this.close(); return; }
      if (action.type === "reject") { if (window.confirm(this.plugin.i18n().t("review.rejectConfirm"))) { await this.plugin.proposals.reject(this.proposalId); this.close(); } return; }
      rerender(action.type === "set-mode" ? "anchor" : action.type === "navigate-task" ? undefined : "scroll");
      if (action.type === "navigate-task") {
        window.setTimeout(() => this.contentEl.querySelector<HTMLElement>(`#taskmate-review-${CSS.escape(action.taskId)}`)?.scrollIntoView({ block: "start" }), 0);
      }
    };
    rerender();
  }
}

function reviewCopy(plugin: TaskMatePlugin): TaskChangeReviewCopy {
  const { t } = plugin.i18n();
  return {
    title: t("review.title"), apply: t("review.apply"), reject: t("review.reject"),
    selectAll: t("review.selectAll"), selectAllShort: t("review.selectAllShort"), selectTask: t("review.selectTask"),
    clearAll: t("review.clearAll"), clearAllShort: t("review.clearAllShort"), clearTask: t("review.clearTask"),
    semantic: t("review.semantic"), semanticAria: t("review.semanticAria"), markdown: t("review.markdown"), markdownAria: t("review.markdownAria"),
    comparisonAria: t("review.comparisonAria"), noSelection: t("review.noSelection"),
    fileList: t("review.fileList"), changeCount: t("review.changeCount", { count: "{count}" })
  };
}
