import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type TaskMatePlugin from "./main";
import { createTaskChangeReviewState, reduceTaskChangeReviewState, renderTaskChangeReview } from "./task-change-review-renderer";
import type { TaskChangeReviewAction, TaskChangeReviewCopy, TaskChangeReviewState } from "./task-change-review-renderer";
import type { ProposalReview } from "./task-change-proposal";
import { captureReviewPosition, restoreReviewPosition } from "./task-change-review-scroll";

export const TASK_CHANGE_REVIEW_VIEW_TYPE = "taskmate-change-review";

export function applyNoticeKind(outcome: { succeeded: number; failed: number; hasFollowUp: boolean }): "applied" | "stale-regenerated" {
  return outcome.succeeded === 0 && outcome.failed > 0 && outcome.hasFollowUp ? "stale-regenerated" : "applied";
}

export async function openProposalInReviewView(
  activate: () => Promise<Pick<TaskChangeReviewView, "openProposal">>,
  proposalId: string,
  taskId?: string,
  changeId?: string
): Promise<void> {
  const view = await activate();
  await view.openProposal(proposalId, taskId, changeId);
}

export class TaskChangeReviewView extends ItemView {
  private proposalId: string | null = null;
  private targetTaskId: string | null = null;
  private targetChangeId: string | null = null;
  private review: ProposalReview | null = null;
  private indexMode: "pending" | "history" = "pending";
  private proposalSource: "pending" | "history" = "pending";
  private state: TaskChangeReviewState = createTaskChangeReviewState();

  constructor(leaf: WorkspaceLeaf, private readonly plugin: TaskMatePlugin) {
    super(leaf);
  }

  getViewType(): string { return TASK_CHANGE_REVIEW_VIEW_TYPE; }
  getDisplayText(): string { return this.plugin.i18n().t("review.title"); }
  getIcon(): string { return "file-diff"; }

  async onOpen(): Promise<void> { await this.render(); }

  requestRender(): void { void this.render("scroll"); }

  async openIndex(): Promise<void> {
    this.proposalId = null;
    this.targetTaskId = null;
    this.targetChangeId = null;
    this.review = null;
    this.indexMode = "pending";
    this.proposalSource = "pending";
    this.state = createTaskChangeReviewState();
    await this.render();
  }

  async openProposal(proposalId: string, taskId?: string, changeId?: string): Promise<void> {
    this.proposalId = proposalId;
    this.targetTaskId = taskId ?? null;
    this.targetChangeId = changeId ?? null;
    this.proposalSource = "pending";
    this.state = createTaskChangeReviewState();
    await this.render();
  }

  private async openHistoryProposal(proposalId: string): Promise<void> {
    this.proposalId = proposalId;
    this.proposalSource = "history";
    this.state = createTaskChangeReviewState();
    await this.render();
  }

  private async render(preserve?: "scroll" | "anchor"): Promise<void> {
    const position = preserve ? captureReviewPosition(this.contentEl, preserve) : null;
    this.contentEl.empty();
    if (!this.proposalId) {
      const proposals = this.indexMode === "pending"
        ? await this.plugin.proposals.listPending()
        : await this.plugin.proposals.listHistory();
      const root = this.contentEl.createDiv({ cls: "taskmate-review-index" });
      const tabs = root.createDiv({ cls: "taskmate-review-index-tabs" });
      for (const mode of ["pending", "history"] as const) {
        const tab = tabs.createEl("button", {
          text: this.plugin.i18n().t(mode === "pending" ? "review.pending" : "review.history"),
          cls: this.indexMode === mode ? "is-active" : ""
        });
        tab.addEventListener("click", () => { this.indexMode = mode; void this.render(); });
      }
      if (proposals.length === 0) root.createDiv({ cls: "taskmate-empty", text: this.plugin.i18n().t(this.indexMode === "pending" ? "review.none" : "review.historyNone") });
      for (const proposal of proposals) {
        const open = root.createEl("button", { cls: "taskmate-review-index-item" });
        const identity = open.createSpan({ cls: "taskmate-review-index-identity" });
        identity.createSpan({ text: proposal.id });
        if (this.indexMode === "history") identity.createSpan({
          cls: "taskmate-review-history-status",
          text: this.plugin.i18n().t("review.historyResult", {
            status: this.plugin.i18n().t(`review.status.${proposal.status}`),
            succeeded: proposal.succeededCount,
            failed: proposal.failedCount
          })
        });
        open.createSpan({ text: this.plugin.i18n().t("review.summary", { tasks: proposal.taskCount, changes: proposal.changeCount }) });
        open.addEventListener("click", () => void (this.indexMode === "pending" ? this.openProposal(proposal.id) : this.openHistoryProposal(proposal.id)));
      }
      return;
    }
    try {
      this.review = this.proposalSource === "history"
        ? await this.plugin.proposals.reviewHistory(this.proposalId)
        : await this.plugin.proposals.review(this.proposalId);
      renderTaskChangeReview(this.contentEl, this.review, this.state, reviewCopy(this.plugin), (action) => void this.handle(action), {
        readOnly: this.proposalSource === "history",
        back: this.proposalSource === "history" ? {
          label: this.plugin.i18n().t("common.back"),
          onClick: () => { this.proposalId = null; this.indexMode = "history"; void this.render(); }
        } : undefined
      });
      if (position) restoreReviewPosition(this.contentEl, position);
      else window.setTimeout(() => this.revealTarget(), 0);
    } catch (error) {
      console.error("TaskMate could not open Proposal", error);
      this.contentEl.createDiv({ cls: "taskmate-empty", text: this.plugin.i18n().t("review.invalid") });
    }
  }

  private async handle(action: TaskChangeReviewAction): Promise<void> {
    let preserve: "scroll" | "anchor" | undefined = action.type === "set-mode" ? "anchor"
      : action.type === "set-approved" || action.type === "set-many-approved" ? "scroll" : undefined;
    this.state = reduceTaskChangeReviewState(this.state, action);
    if (action.type === "apply" && this.proposalId) {
      const result = await this.plugin.proposals.apply(this.proposalId, action.approvedChangeIds);
      const succeeded = result.closedProposal.result?.succeededChangeIds.length ?? 0;
      const failed = result.closedProposal.result?.failed.reduce((count, failure) => count + failure.changeIds.length, 0) ?? 0;
      const notice = applyNoticeKind({ succeeded, failed, hasFollowUp: result.followUp !== null });
      new Notice(notice === "stale-regenerated"
        ? this.plugin.i18n().t("review.staleRegenerated", { failed })
        : this.plugin.i18n().t("review.applied", { count: succeeded }));
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

function reviewCopy(plugin: TaskMatePlugin): TaskChangeReviewCopy {
  const { t } = plugin.i18n();
  return {
    title: t("review.title"), apply: t("review.apply"), reject: t("review.reject"),
    selectAll: t("review.selectAll"), selectAllShort: t("review.selectAllShort"), selectTask: t("review.selectTask"),
    clearAll: t("review.clearAll"), clearAllShort: t("review.clearAllShort"), clearTask: t("review.clearTask"),
    semantic: t("review.semantic"), semanticAria: t("review.semanticAria"), markdown: t("review.markdown"), markdownAria: t("review.markdownAria"),
    comparisonAria: t("review.comparisonAria"), noSelection: t("review.noSelection")
  };
}
