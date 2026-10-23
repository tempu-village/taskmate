import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type { I18n } from "../../i18n";
import type TaskMatePlugin from "../../main";
import { saveCandidateEdit } from "./candidate-edit-form";
import { decideCandidate, markDiffViewed, planFormalApply } from "./proposal";
import type { SourceCandidateProposal } from "./proposal";
import type { FormalApplyResult, SourceReviewSummary } from "./review-repository";
import { renderNoOpenReview } from "../shared/review-index";
import type { ReviewIndexDetails } from "../shared/review-index";
import { createSourceReviewUiState, reduceSourceReviewUiState, renderSourceCandidateReview } from "./review-renderer";
import type { SourceReviewAction, SourceReviewCopy, SourceReviewUiState } from "./review-renderer";

export const SOURCE_CANDIDATE_REVIEW_VIEW_TYPE = "taskmate-source-review";
const REVIEW_ID = /^source-review-[A-Za-z0-9._-]+$/;

export function sourceReviewIdFromLink(params: Record<string, string | undefined>): string | null {
  const reviewId = params.review;
  return typeof reviewId === "string" && REVIEW_ID.test(reviewId) ? reviewId : null;
}

export function formalApplyMessage(result: FormalApplyResult, i18n: I18n): string {
  const { t } = i18n;
  const parts = [t("sourceReview.result", { applied: result.applied.length, failed: result.failed.length, stale: result.stale.length })];
  if (result.provenance.changed.length > 0) parts.push(t("sourceReview.provenanceChanged", { count: result.provenance.changed.length }));
  if (result.provenance.failed.length > 0) parts.push(t("sourceReview.provenanceFailed", { count: result.provenance.failed.length }));
  if (result.archived) parts.push(t("sourceReview.archived"));
  return parts.join(" ");
}

export function sourceReviewIndexDetails(summary: SourceReviewSummary, i18n: I18n): ReviewIndexDetails {
  return {
    sortKey: summary.updatedAt,
    lines: [statusText(summary.status, i18n), i18n.t("sourceReview.summary", { candidates: summary.candidateCount, applied: summary.appliedCount })]
  };
}

export class SourceCandidateReviewView extends ItemView {
  private reviewId: string | null = null;
  private state: SourceReviewUiState = createSourceReviewUiState();

  constructor(leaf: WorkspaceLeaf, private readonly plugin: TaskMatePlugin) {
    super(leaf);
  }

  getViewType(): string { return SOURCE_CANDIDATE_REVIEW_VIEW_TYPE; }
  getDisplayText(): string { return this.plugin.i18n().t("sourceReview.title"); }
  getIcon(): string { return "inbox"; }

  async onOpen(): Promise<void> { await this.render(); }

  requestRender(): void { void this.render(true); }

  async openReview(reviewId: string): Promise<void> {
    this.reviewId = reviewId;
    this.state = createSourceReviewUiState();
    await this.render();
  }

  private async render(preserveScroll = false): Promise<void> {
    const scrollTop = preserveScroll ? this.contentEl.scrollTop : 0;
    // A refresh from a Vault change keeps keyboard focus on the same control, such as an edit field.
    const active = this.contentEl.ownerDocument.activeElement;
    const focused = preserveScroll && active instanceof HTMLElement && this.contentEl.contains(active) ? active.id : "";
    this.contentEl.empty();
    const i18n = this.plugin.i18n();
    if (!this.reviewId) {
      renderNoOpenReview(this.contentEl, i18n.t("reviews.notOpen"), { label: i18n.t("command.openReviews"), onClick: () => void this.plugin.openReviewIndex("pending", this.leaf) });
      return;
    }
    try {
      const review = await this.plugin.sourceReviews.load(this.reviewId);
      const projects = (await this.plugin.projects.list()).map((project) => ({ id: project.id, name: project.name }));
      const state = !this.state.focus && focused ? { ...this.state, focus: focused } : this.state;
      renderSourceCandidateReview(this.contentEl, review, planFormalApply(review), state, sourceReviewCopy(i18n), (action) => void this.handle(action), {
        readOnly: review.status === "history",
        onBack: () => void this.plugin.openReviewIndex(review.status === "history" ? "history" : "pending", this.leaf),
        projects
      });
      this.state = { ...this.state, focus: null };
    } catch (error) {
      console.error("TaskMate could not open Source candidate review", error);
      this.contentEl.createDiv({ cls: "taskmate-empty", text: i18n.t("sourceReview.invalid") });
    }
    this.contentEl.scrollTop = scrollTop;
  }

  private async handle(action: SourceReviewAction): Promise<void> {
    const reviewId = this.reviewId;
    if (!reviewId) return;
    const previous = this.state;
    this.state = reduceSourceReviewUiState(this.state, action);
    // Typing only updates the form state; re-rendering would move the caret.
    if (action.type === "edit-input") return;
    try {
      if (action.type === "decide") {
        const review = await this.plugin.sourceReviews.load(reviewId);
        await this.plugin.sourceReviews.save(decideCandidate(review, action.candidateId, action.decision, new Date().toISOString()));
      } else if (action.type === "toggle-diff" && !previous.expandedDiffs.has(action.candidateId)) {
        const review = await this.plugin.sourceReviews.load(reviewId);
        if (needsDiffViewed(review, action.candidateId)) {
          await this.plugin.sourceReviews.save(markDiffViewed(review, action.candidateId, new Date().toISOString()));
        }
      } else if (action.type === "save-edit" && previous.editing) {
        await this.saveEdit(reviewId, previous.editing);
      } else if (action.type === "confirm-apply") {
        const result = await this.plugin.sourceReviews.formalApply(reviewId, { acknowledgeUnviewedMerges: previous.acknowledged });
        this.state = createSourceReviewUiState();
        new Notice(formalApplyMessage(result, this.plugin.i18n()), 10000);
      }
    } catch (error) {
      console.error("TaskMate could not update Source candidate review", error);
      new Notice(this.plugin.i18n().t("sourceReview.actionFailed", { error: error instanceof Error ? error.message : String(error) }), 0);
    }
    await this.render(true);
  }

  private async saveEdit(reviewId: string, editing: NonNullable<SourceReviewUiState["editing"]>): Promise<void> {
    const i18n = this.plugin.i18n();
    const result = saveCandidateEdit(await this.plugin.sourceReviews.load(reviewId), editing, new Date().toISOString(), i18n.t("sourceReview.editedReason"));
    if (result.kind === "conflict") {
      new Notice(i18n.t("sourceReview.editConflict"), 10000);
      return;
    }
    if (result.kind === "invalid") {
      this.state = reduceSourceReviewUiState(this.state, { type: "edit-invalid", errors: result.errors });
      return;
    }
    if (result.kind === "saved") await this.plugin.sourceReviews.save(result.review);
    this.state = reduceSourceReviewUiState(this.state, { type: "cancel-edit" });
  }
}

function needsDiffViewed(review: SourceCandidateProposal, candidateId: string): boolean {
  const candidate = review.candidates.find((item) => item.id === candidateId);
  return candidate?.operation === "merge" && candidate.application.status !== "applied" && candidate.diffViewedRevision !== candidate.revision && review.status !== "history";
}

function statusText(status: SourceCandidateProposal["status"], i18n: I18n): string {
  return sourceReviewCopy(i18n).status[status];
}

function sourceReviewCopy(i18n: I18n): SourceReviewCopy {
  const { t } = i18n;
  return {
    title: t("sourceReview.title"),
    back: t("common.back"),
    status: {
      "pending": t("sourceReview.status.pending"),
      "ready-to-apply": t("sourceReview.status.ready"),
      "partially-applied": t("sourceReview.status.partial"),
      "applied": t("sourceReview.status.applied"),
      "history": t("sourceReview.status.history")
    },
    health: { stale: t("sourceReview.health.stale"), failed: t("sourceReview.health.failed") },
    operation: { create: t("sourceReview.operation.create"), merge: t("sourceReview.operation.merge"), exclude: t("sourceReview.operation.exclude") },
    decision: { approved: t("sourceReview.decision.approved"), hold: t("sourceReview.decision.hold"), pending: t("sourceReview.decision.pending") },
    decide: {
      create: t("sourceReview.decide.create"),
      merge: t("sourceReview.decide.merge"),
      exclude: t("sourceReview.decide.exclude"),
      hold: t("sourceReview.decide.hold"),
      pending: t("sourceReview.decide.pending")
    },
    decideAria: (action, candidate) => t("sourceReview.decideAria", { action, candidate }),
    decisionGroupAria: (candidate) => t("sourceReview.decisionGroupAria", { candidate }),
    sources: t("sourceReview.sources"),
    conversation: (id) => t("sourceReview.conversation", { id }),
    fields: {
      title: t("sourceReview.field.title"),
      date: t("sourceReview.field.date"),
      priority: t("sourceReview.field.priority"),
      labels: t("sourceReview.field.labels"),
      project: t("sourceReview.field.project"),
      steps: t("sourceReview.field.steps"),
      notes: t("sourceReview.field.notes")
    },
    empty: t("sourceReview.empty"),
    unassigned: t("taskModal.unassigned"),
    noPriority: t("taskModal.noPriority"),
    priorityValue: (priority) => t("filter.priorityValue", { priority }),
    mergeTarget: (title) => t("sourceReview.mergeTarget", { title }),
    showDiff: t("sourceReview.showDiff"),
    hideDiff: t("sourceReview.hideDiff"),
    diffAria: (candidate) => t("sourceReview.diffAria", { candidate }),
    exclusionReason: t("sourceReview.exclusionReason"),
    applied: t("sourceReview.applied"),
    openApply: t("sourceReview.openApply"),
    applyTitle: t("sourceReview.applyTitle"),
    applyCounts: (counts) => t("sourceReview.applyCounts", counts),
    nothingToApply: t("sourceReview.nothingToApply"),
    blockedTitle: t("sourceReview.blockedTitle"),
    blocked: {
      "stale": t("sourceReview.blocked.stale"),
      "held": t("sourceReview.blocked.held"),
      "undecided": t("sourceReview.blocked.undecided"),
      "outdated-decision": t("sourceReview.blocked.outdated")
    },
    unviewedTitle: t("sourceReview.unviewedTitle"),
    acknowledge: (count) => t("sourceReview.acknowledge", { count }),
    confirm: t("sourceReview.confirm"),
    cancel: t("sourceReview.cancel"),
    edit: t("sourceReview.edit"),
    editAria: (candidate) => t("sourceReview.editAria", { candidate }),
    finishEditFirst: t("sourceReview.finishEditFirst"),
    editOperation: t("sourceReview.editOperation"),
    changeReason: t("sourceReview.changeReason"),
    editHelp: {
      labels: t("sourceReview.editHelp.labels"),
      steps: t("sourceReview.editHelp.steps"),
      changeReason: t("sourceReview.editHelp.changeReason"),
      noMergeTarget: t("sourceReview.editHelp.noMergeTarget")
    },
    editErrors: {
      "required": t("sourceReview.editError.required"),
      "invalid-date": t("sourceReview.editError.invalidDate"),
      "no-change": t("sourceReview.editError.noChange")
    },
    save: t("sourceReview.save")
  };
}
