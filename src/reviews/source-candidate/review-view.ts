import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type { I18n } from "../../i18n";
import type TaskMatePlugin from "../../main";
import { decideCandidate, markDiffViewed, planFormalApply } from "./proposal";
import type { SourceCandidateProposal } from "./proposal";
import type { FormalApplyResult } from "./review-repository";
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

export class SourceCandidateReviewView extends ItemView {
  private reviewId: string | null = null;
  private indexMode: "pending" | "history" = "pending";
  private state: SourceReviewUiState = createSourceReviewUiState();

  constructor(leaf: WorkspaceLeaf, private readonly plugin: TaskMatePlugin) {
    super(leaf);
  }

  getViewType(): string { return SOURCE_CANDIDATE_REVIEW_VIEW_TYPE; }
  getDisplayText(): string { return this.plugin.i18n().t("sourceReview.title"); }
  getIcon(): string { return "inbox"; }

  async onOpen(): Promise<void> { await this.render(); }

  requestRender(): void { void this.render(true); }

  async openIndex(mode: "pending" | "history" = "pending"): Promise<void> {
    this.reviewId = null;
    this.indexMode = mode;
    this.state = createSourceReviewUiState();
    await this.render();
  }

  async openReview(reviewId: string): Promise<void> {
    this.reviewId = reviewId;
    this.state = createSourceReviewUiState();
    await this.render();
  }

  private async render(preserveScroll = false): Promise<void> {
    const scrollTop = preserveScroll ? this.contentEl.scrollTop : 0;
    this.contentEl.empty();
    const i18n = this.plugin.i18n();
    if (!this.reviewId) {
      await this.renderIndex(i18n);
      return;
    }
    try {
      const review = await this.plugin.sourceReviews.load(this.reviewId);
      renderSourceCandidateReview(this.contentEl, review, planFormalApply(review), this.state, sourceReviewCopy(i18n), (action) => void this.handle(action), {
        readOnly: review.status === "history",
        onBack: () => void this.openIndex(review.status === "history" ? "history" : "pending")
      });
    } catch (error) {
      console.error("TaskMate could not open Source candidate review", error);
      this.contentEl.createDiv({ cls: "taskmate-empty", text: i18n.t("sourceReview.invalid") });
    }
    this.contentEl.scrollTop = scrollTop;
  }

  private async renderIndex(i18n: I18n): Promise<void> {
    const reviews = this.indexMode === "pending" ? await this.plugin.sourceReviews.listPending() : await this.plugin.sourceReviews.listHistory();
    const root = this.contentEl.createDiv({ cls: "taskmate-review-index" });
    root.createEl("h2", { text: i18n.t("sourceReview.title") });
    const tabs = root.createDiv({ cls: "taskmate-review-index-tabs" });
    for (const mode of ["pending", "history"] as const) {
      const tab = tabs.createEl("button", {
        text: i18n.t(mode === "pending" ? "sourceReview.pending" : "sourceReview.history"),
        cls: this.indexMode === mode ? "is-active" : "",
        attr: { "aria-pressed": String(this.indexMode === mode) }
      });
      tab.addEventListener("click", () => void this.openIndex(mode));
    }
    if (reviews.length === 0) root.createDiv({ cls: "taskmate-empty", text: i18n.t(this.indexMode === "pending" ? "sourceReview.none" : "sourceReview.historyNone") });
    for (const summary of reviews) {
      const open = root.createEl("button", { cls: "taskmate-review-index-item" });
      const identity = open.createSpan({ cls: "taskmate-review-index-identity" });
      identity.createSpan({ text: summary.reviewId });
      identity.createSpan({ cls: "taskmate-review-history-status", text: statusText(summary.status, i18n) });
      open.createSpan({ cls: "taskmate-review-index-summary", text: i18n.t("sourceReview.summary", { candidates: summary.candidateCount, applied: summary.appliedCount }) });
      open.addEventListener("click", () => void this.openReview(summary.reviewId));
    }
  }

  private async handle(action: SourceReviewAction): Promise<void> {
    const reviewId = this.reviewId;
    if (!reviewId) return;
    const previous = this.state;
    this.state = reduceSourceReviewUiState(this.state, action);
    try {
      if (action.type === "decide") {
        const review = await this.plugin.sourceReviews.load(reviewId);
        await this.plugin.sourceReviews.save(decideCandidate(review, action.candidateId, action.decision, new Date().toISOString()));
      } else if (action.type === "toggle-diff" && !previous.expandedDiffs.has(action.candidateId)) {
        const review = await this.plugin.sourceReviews.load(reviewId);
        if (needsDiffViewed(review, action.candidateId)) {
          await this.plugin.sourceReviews.save(markDiffViewed(review, action.candidateId, new Date().toISOString()));
        }
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
      date: t("sourceReview.field.date"),
      priority: t("sourceReview.field.priority"),
      labels: t("sourceReview.field.labels"),
      project: t("sourceReview.field.project"),
      steps: t("sourceReview.field.steps"),
      notes: t("sourceReview.field.notes")
    },
    empty: t("sourceReview.empty"),
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
    cancel: t("sourceReview.cancel")
  };
}
