import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type { I18n } from "../../i18n";
import type TaskMatePlugin from "../../main";
import { saveCandidateEdit } from "./candidate-edit-form";
import { decideCandidate, markDiffViewed, planFormalApply } from "./proposal";
import type { ImportReview } from "./proposal";
import type { FormalApplyResult, ImportReviewSummary } from "./review-repository";
import { renderNoOpenReview } from "../shared/review-index";
import type { ReviewIndexDetails } from "../shared/review-index";
import { createImportReviewUiState, reduceImportReviewUiState, renderImportReview } from "./review-renderer";
import type { ImportReviewAction, ImportReviewCopy, ImportReviewUiState } from "./review-renderer";

export const IMPORT_REVIEW_VIEW_TYPE = "taskmate-import-review";
const REVIEW_ID = /^(?:import|source)-review-[A-Za-z0-9._-]+$/;

export function importReviewIdFromLink(params: Record<string, string | undefined>): string | null {
  const reviewId = params.review;
  return typeof reviewId === "string" && REVIEW_ID.test(reviewId) ? reviewId : null;
}

export function formalApplyMessage(result: FormalApplyResult, i18n: I18n): string {
  const { t } = i18n;
  const parts = [t("importReview.result", { applied: result.applied.length, failed: result.failed.length, stale: result.stale.length })];
  if (result.provenance.changed.length > 0) parts.push(t("importReview.provenanceChanged", { count: result.provenance.changed.length }));
  if (result.provenance.failed.length > 0) parts.push(t("importReview.provenanceFailed", { count: result.provenance.failed.length }));
  if (result.archived) parts.push(t("importReview.archived"));
  return parts.join(" ");
}

export function importReviewIndexDetails(summary: ImportReviewSummary, i18n: I18n): ReviewIndexDetails {
  return {
    sortKey: summary.updatedAt,
    lines: [
      statusText(summary.status, i18n),
      i18n.t("importReview.summary", { candidates: summary.candidateCount, applied: summary.appliedCount }),
      ...(summary.format === "v2" ? [] : [i18n.t("importReview.legacyFormat")])
    ]
  };
}

export class ImportReviewView extends ItemView {
  private reviewId: string | null = null;
  private state: ImportReviewUiState = createImportReviewUiState();

  constructor(leaf: WorkspaceLeaf, private readonly plugin: TaskMatePlugin) {
    super(leaf);
  }

  getViewType(): string { return IMPORT_REVIEW_VIEW_TYPE; }
  getDisplayText(): string { return this.plugin.i18n().t("importReview.title"); }
  getIcon(): string { return "inbox"; }

  async onOpen(): Promise<void> { await this.render(); }

  requestRender(): void { void this.render(true); }

  async openReview(reviewId: string): Promise<void> {
    this.reviewId = reviewId;
    this.state = createImportReviewUiState();
    await this.render();
  }

  private async render(preserveScroll = false): Promise<void> {
    const scrollTop = preserveScroll ? this.contentEl.scrollTop : 0;
    // A refresh from a Vault change keeps keyboard focus on the same control, such as an edit field.
    const active = this.contentEl.ownerDocument.activeElement;
    const focused = preserveScroll && active instanceof HTMLElement && this.contentEl.contains(active) ? active.id : "";
    const requestedFocus = this.state.focus;
    this.contentEl.empty();
    const i18n = this.plugin.i18n();
    if (!this.reviewId) {
      renderNoOpenReview(this.contentEl, i18n.t("reviews.notOpen"), { label: i18n.t("command.openReviews"), onClick: () => void this.plugin.openReviewIndex("pending", this.leaf) });
      return;
    }
    try {
      const review = await this.plugin.importReviews.load(this.reviewId);
      const projects = (await this.plugin.projects.list()).map((project) => ({ id: project.id, name: project.name }));
      const state = !this.state.focus && focused ? { ...this.state, focus: focused } : this.state;
      renderImportReview(this.contentEl, review, planFormalApply(review), state, importReviewCopy(i18n), (action) => void this.handle(action), {
        readOnly: review.status === "history",
        onBack: () => void this.plugin.openReviewIndex(review.status === "history" ? "history" : "pending", this.leaf),
        projects
      });
      this.state = { ...this.state, focus: null };
    } catch (error) {
      console.error("TaskMate could not open Import review", error);
      this.contentEl.createDiv({ cls: "taskmate-empty", text: i18n.t("importReview.invalid", { error: error instanceof Error ? error.message : String(error) }) });
    }
    this.contentEl.scrollTop = scrollTop;
    // Restoring the scroll position can hide the element that just received focus, such as the top toggle after a long
    // statement list was collapsed from below; bring it back into view.
    if (requestedFocus) this.contentEl.querySelector<HTMLElement>(`[id="${requestedFocus}"]`)?.scrollIntoView({ block: "nearest" });
  }

  private async handle(action: ImportReviewAction): Promise<void> {
    const reviewId = this.reviewId;
    if (!reviewId) return;
    const previous = this.state;
    this.state = reduceImportReviewUiState(this.state, action);
    // Typing only updates the form state; re-rendering would move the caret.
    if (action.type === "edit-input") return;
    try {
      if (action.type === "decide") {
        const review = await this.plugin.importReviews.load(reviewId);
        await this.plugin.importReviews.save(decideCandidate(review, action.candidateId, action.decision, new Date().toISOString()));
      } else if (action.type === "toggle-diff" && !previous.expandedDiffs.has(action.candidateId)) {
        const review = await this.plugin.importReviews.load(reviewId);
        if (needsDiffViewed(review, action.candidateId)) {
          await this.plugin.importReviews.save(markDiffViewed(review, action.candidateId, new Date().toISOString()));
        }
      } else if (action.type === "save-edit" && previous.editing) {
        await this.saveEdit(reviewId, previous.editing);
      } else if (action.type === "confirm-apply") {
        const result = await this.plugin.importReviews.formalApply(reviewId, { acknowledgeUnviewedMerges: previous.acknowledged });
        this.state = createImportReviewUiState();
        new Notice(formalApplyMessage(result, this.plugin.i18n()), 10000);
      }
    } catch (error) {
      console.error("TaskMate could not update Import review", error);
      new Notice(this.plugin.i18n().t("importReview.actionFailed", { error: error instanceof Error ? error.message : String(error) }), 0);
    }
    await this.render(true);
  }

  private async saveEdit(reviewId: string, editing: NonNullable<ImportReviewUiState["editing"]>): Promise<void> {
    const i18n = this.plugin.i18n();
    const result = saveCandidateEdit(await this.plugin.importReviews.load(reviewId), editing, new Date().toISOString(), i18n.t("importReview.editedReason"));
    if (result.kind === "conflict") {
      new Notice(i18n.t("importReview.editConflict"), 10000);
      return;
    }
    if (result.kind === "invalid") {
      this.state = reduceImportReviewUiState(this.state, { type: "edit-invalid", errors: result.errors });
      return;
    }
    if (result.kind === "saved") await this.plugin.importReviews.save(result.review);
    this.state = reduceImportReviewUiState(this.state, { type: "cancel-edit" });
  }
}

function needsDiffViewed(review: ImportReview, candidateId: string): boolean {
  const candidate = review.candidates.find((item) => item.id === candidateId);
  return candidate?.operation === "merge" && candidate.application.status !== "applied" && candidate.diffViewedRevision !== candidate.revision && review.status !== "history";
}

function statusText(status: ImportReview["status"], i18n: I18n): string {
  return importReviewCopy(i18n).status[status];
}

function importReviewCopy(i18n: I18n): ImportReviewCopy {
  const { t } = i18n;
  return {
    title: t("importReview.title"),
    back: t("common.back"),
    status: {
      "pending": t("importReview.status.pending"),
      "ready-to-apply": t("importReview.status.ready"),
      "partially-applied": t("importReview.status.partial"),
      "applied": t("importReview.status.applied"),
      "history": t("importReview.status.history")
    },
    health: { stale: t("importReview.health.stale"), failed: t("importReview.health.failed") },
    operation: { create: t("importReview.operation.create"), merge: t("importReview.operation.merge"), exclude: t("importReview.operation.exclude") },
    decision: { approved: t("importReview.decision.approved"), hold: t("importReview.decision.hold"), pending: t("importReview.decision.pending") },
    decide: {
      create: t("importReview.decide.create"),
      merge: t("importReview.decide.merge"),
      exclude: t("importReview.decide.exclude"),
      hold: t("importReview.decide.hold"),
      pending: t("importReview.decide.pending")
    },
    decideAria: (action, candidate) => t("importReview.decideAria", { action, candidate }),
    decisionGroupAria: (candidate) => t("importReview.decisionGroupAria", { candidate }),
    evidenceTitle: t("importReview.evidence.title"),
    sourceKind: { note: t("importReview.evidence.note"), conversation: t("importReview.evidence.conversation") },
    conversation: (id) => t("importReview.conversation", { id }),
    summaryLabel: { note: t("importReview.evidence.noteSummary"), conversation: t("importReview.evidence.conversationSummary") },
    noSummary: t("importReview.evidence.noSummary"),
    showStatements: (count) => t("importReview.evidence.show", { count }),
    hideStatements: (count) => t("importReview.evidence.hide", { count }),
    statementsAria: (candidate, source) => t("importReview.evidence.aria", { candidate, source }),
    legacyFormat: t("importReview.legacyFormat"),
    fields: {
      title: t("importReview.field.title"),
      date: t("importReview.field.date"),
      priority: t("importReview.field.priority"),
      labels: t("importReview.field.labels"),
      project: t("importReview.field.project"),
      steps: t("importReview.field.steps"),
      notes: t("importReview.field.notes")
    },
    empty: t("importReview.empty"),
    unassigned: t("taskModal.unassigned"),
    noPriority: t("taskModal.noPriority"),
    priorityValue: (priority) => t("filter.priorityValue", { priority }),
    mergeTarget: (title) => t("importReview.mergeTarget", { title }),
    showDiff: t("importReview.showDiff"),
    hideDiff: t("importReview.hideDiff"),
    diffAria: (candidate) => t("importReview.diffAria", { candidate }),
    exclusionReason: t("importReview.exclusionReason"),
    applied: t("importReview.applied"),
    openApply: t("importReview.openApply"),
    applyTitle: t("importReview.applyTitle"),
    applyCounts: (counts) => t("importReview.applyCounts", counts),
    nothingToApply: t("importReview.nothingToApply"),
    blockedTitle: t("importReview.blockedTitle"),
    blocked: {
      "stale": t("importReview.blocked.stale"),
      "held": t("importReview.blocked.held"),
      "undecided": t("importReview.blocked.undecided"),
      "outdated-decision": t("importReview.blocked.outdated")
    },
    unviewedTitle: t("importReview.unviewedTitle"),
    acknowledge: (count) => t("importReview.acknowledge", { count }),
    confirm: t("importReview.confirm"),
    cancel: t("importReview.cancel"),
    edit: t("importReview.edit"),
    editAria: (candidate) => t("importReview.editAria", { candidate }),
    finishEditFirst: t("importReview.finishEditFirst"),
    editOperation: t("importReview.editOperation"),
    changeReason: t("importReview.changeReason"),
    editHelp: {
      labels: t("importReview.editHelp.labels"),
      steps: t("importReview.editHelp.steps"),
      changeReason: t("importReview.editHelp.changeReason"),
      noMergeTarget: t("importReview.editHelp.noMergeTarget")
    },
    editErrors: {
      "required": t("importReview.editError.required"),
      "invalid-date": t("importReview.editError.invalidDate"),
      "no-change": t("importReview.editError.noChange")
    },
    save: t("importReview.save")
  };
}
