import { ItemView, Modal, Notice, WorkspaceLeaf } from "obsidian";
import type TaskMatePlugin from "./main";
import { renderTaskChangeReview } from "./task-change-review-renderer";
import type { TaskChangeReviewAction, TaskChangeReviewState } from "./task-change-review-renderer";
import type { ProposalReview } from "./task-change-proposal";

export const TASK_CHANGE_REVIEW_VIEW_TYPE = "taskmate-change-review";

export class TaskChangeReviewView extends ItemView {
  private proposalId: string | null = null;
  private targetTaskId: string | null = null;
  private targetChangeId: string | null = null;
  private review: ProposalReview | null = null;
  private state: TaskChangeReviewState = { mode: "semantic", approvedChangeIds: new Set() };

  constructor(leaf: WorkspaceLeaf, private readonly plugin: TaskMatePlugin) {
    super(leaf);
  }

  getViewType(): string { return TASK_CHANGE_REVIEW_VIEW_TYPE; }
  getDisplayText(): string { return this.plugin.i18n().t("review.title"); }
  getIcon(): string { return "file-diff"; }

  async onOpen(): Promise<void> { await this.render(); }

  requestRender(): void { void this.render(); }

  async openProposal(proposalId: string, taskId?: string, changeId?: string): Promise<void> {
    this.proposalId = proposalId;
    this.targetTaskId = taskId ?? null;
    this.targetChangeId = changeId ?? null;
    this.state = { mode: "semantic", approvedChangeIds: new Set() };
    await this.render();
  }

  private async render(): Promise<void> {
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
      renderTaskChangeReview(this.contentEl, this.review, this.state, this.copy(), (action) => void this.handle(action));
      window.setTimeout(() => this.revealTarget(), 0);
    } catch (error) {
      console.error("TaskMate could not open Proposal", error);
      this.contentEl.createDiv({ cls: "taskmate-empty", text: this.plugin.i18n().t("review.invalid") });
    }
  }

  private async handle(action: TaskChangeReviewAction): Promise<void> {
    if (action.type === "set-mode") this.state = { ...this.state, mode: action.mode };
    if (action.type === "set-approved") {
      const next = new Set(this.state.approvedChangeIds);
      if (action.approved) next.add(action.changeId); else next.delete(action.changeId);
      this.state = { ...this.state, approvedChangeIds: next };
    }
    if (action.type === "set-many-approved") {
      const next = new Set(this.state.approvedChangeIds);
      for (const id of action.changeIds) action.approved ? next.add(id) : next.delete(id);
      this.state = { ...this.state, approvedChangeIds: next };
    }
    if (action.type === "apply" && this.proposalId) {
      const result = await this.plugin.proposals.apply(this.proposalId, action.approvedChangeIds);
      new Notice(this.plugin.i18n().t("review.applied", { count: result.closedProposal.result?.succeededChangeIds.length ?? 0 }));
      this.proposalId = result.followUp?.id ?? null;
      this.state = { mode: "semantic", approvedChangeIds: new Set() };
    }
    if (action.type === "reject" && this.proposalId) {
      if (!window.confirm(this.plugin.i18n().t("review.rejectConfirm"))) return;
      await this.plugin.proposals.reject(this.proposalId);
      this.proposalId = null;
      new Notice(this.plugin.i18n().t("review.rejected"));
    }
    await this.render();
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

  private copy() {
    const { t } = this.plugin.i18n();
    return {
      title: t("review.title"), apply: t("review.apply"), reject: t("review.reject"),
      selectAll: t("review.selectAll"), selectTask: t("review.selectTask"), clearAll: t("review.clearAll"), clearTask: t("review.clearTask"), semantic: t("review.semantic"),
      markdown: t("review.markdown"), noSelection: t("review.noSelection")
    };
  }
}

export class TaskChangeReviewModal extends Modal {
  constructor(private readonly plugin: TaskMatePlugin, private readonly proposalId: string) { super(plugin.app); }

  async onOpen(): Promise<void> {
    this.modalEl.addClass("taskmate-review-modal");
    const review = await this.plugin.proposals.review(this.proposalId);
    let state: TaskChangeReviewState = { mode: "semantic", approvedChangeIds: new Set() };
    const rerender = () => renderTaskChangeReview(this.contentEl, review, state, new TaskChangeReviewViewCopy(this.plugin).value, async (action) => {
      if (action.type === "set-mode") state = { ...state, mode: action.mode };
      if (action.type === "set-approved") {
        const next = new Set(state.approvedChangeIds); action.approved ? next.add(action.changeId) : next.delete(action.changeId);
        state = { ...state, approvedChangeIds: next };
      }
      if (action.type === "set-many-approved") {
        const next = new Set(state.approvedChangeIds); for (const id of action.changeIds) action.approved ? next.add(id) : next.delete(id);
        state = { ...state, approvedChangeIds: next };
      }
      if (action.type === "apply") { await this.plugin.proposals.apply(this.proposalId, action.approvedChangeIds); this.close(); return; }
      if (action.type === "reject") { if (window.confirm(this.plugin.i18n().t("review.rejectConfirm"))) { await this.plugin.proposals.reject(this.proposalId); this.close(); } return; }
      rerender();
    });
    rerender();
  }
}

class TaskChangeReviewViewCopy {
  readonly value;
  constructor(plugin: TaskMatePlugin) {
    const { t } = plugin.i18n();
    this.value = { title: t("review.title"), apply: t("review.apply"), reject: t("review.reject"), selectAll: t("review.selectAll"), selectTask: t("review.selectTask"), clearAll: t("review.clearAll"), clearTask: t("review.clearTask"), semantic: t("review.semantic"), markdown: t("review.markdown"), noSelection: t("review.noSelection") };
  }
}
