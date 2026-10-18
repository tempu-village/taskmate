import { App, normalizePath, TFile } from "obsidian";
import type { TaskDraft } from "../../tasks/domain";
import type { TaskRepository } from "../../tasks/repository";
import { sha256 } from "../../shared/sha256";
import {
  archiveReview,
  markSourceStale,
  noteSourceCompletion,
  parseSourceCandidateProposal,
  planFormalApply,
  promotedTaskId,
  recordApplication,
  verifyMergeEvidence
} from "./proposal";
import type { ApplicationOutcome, SourceCandidate, SourceCandidateProposal } from "./proposal";
import { importedHash, sourceNoteHash, withSourceNoteProvenance } from "./source-note-provenance";

const REVIEW_ID = /^source-review-[A-Za-z0-9._-]+$/;

interface ReviewSummary {
  reviewId: string;
  status: SourceCandidateProposal["status"];
  health: SourceCandidateProposal["health"];
  createdAt: string;
  updatedAt: string;
  candidateCount: number;
  appliedCount: number;
}

export interface FormalApplyResult {
  review: SourceCandidateProposal;
  applied: string[];
  failed: Array<{ candidateId: string; error: string }>;
  stale: Array<{ candidateId: string; reason: string }>;
  provenance: {
    written: string[];
    changed: string[];
    failed: Array<{ path: string; error: string }>;
  };
  archived: boolean;
}

export class SourceCandidateReviewRepository {
  constructor(
    private readonly app: App,
    private readonly proposalFolder: () => string,
    private readonly tasks: TaskRepository
  ) {}

  async listPending(): Promise<ReviewSummary[]> {
    return this.list(this.pendingFiles(), (review) => review.status !== "history");
  }

  async listHistory(): Promise<ReviewSummary[]> {
    return this.list(this.historyFiles(), (review) => review.status === "history");
  }

  async load(reviewId: string): Promise<SourceCandidateProposal> {
    const file = this.reviewFile(reviewId) ?? this.historyFile(reviewId);
    if (!file) throw new Error(`Source candidate review not found: ${reviewId}`);
    return parseSourceCandidateProposal(await this.app.vault.read(file));
  }

  async save(review: SourceCandidateProposal): Promise<void> {
    if (review.status === "history") throw new Error(`Review ${review.reviewId} is archived`);
    const content = serialize(review);
    const file = this.reviewFile(review.reviewId);
    if (file) await this.app.vault.modify(file, content);
    else {
      await this.ensureFolder(this.folder());
      await this.app.vault.create(normalizePath(`${this.folder()}/${review.reviewId}.json`), content);
    }
  }

  async formalApply(
    reviewId: string,
    options: { acknowledgeUnviewedMerges: boolean; now?: () => string }
  ): Promise<FormalApplyResult> {
    const now = options.now ?? (() => new Date().toISOString());
    if (!this.reviewFile(reviewId)) throw new Error(`Pending Source candidate review not found: ${reviewId}`);
    let review = await this.load(reviewId);
    const result: FormalApplyResult = {
      review, applied: [], failed: [], stale: [], provenance: { written: [], changed: [], failed: [] }, archived: false
    };
    if (planFormalApply(review).requiresAcknowledgement && !options.acknowledgeUnviewedMerges) {
      throw new Error("Selected merges include unviewed diffs; acknowledge them before formal apply");
    }

    for (const source of review.sources) {
      if (!planFormalApply(review).eligible.some((candidate) => referencesSource(candidate, source.id))) continue;
      const changed = await this.sourceChange(source);
      if (changed) {
        review = markSourceStale(review, source.id, changed, now());
        result.stale.push(...review.candidates
          .filter((candidate) => referencesSource(candidate, source.id) && candidate.health === "stale")
          .map((candidate) => ({ candidateId: candidate.id, reason: changed })));
      }
    }
    if (result.stale.length > 0) await this.save(review);

    for (const candidate of planFormalApply(review).eligible) {
      let outcome: ApplicationOutcome;
      try {
        outcome = await this.applyCandidate(review, candidate);
      } catch (error) {
        outcome = { kind: "failed", error: error instanceof Error ? error.message : String(error) };
      }
      review = recordApplication(review, candidate.id, outcome, now());
      await this.save(review);
      if (outcome.kind === "applied") result.applied.push(candidate.id);
      else if (outcome.kind === "failed") result.failed.push({ candidateId: candidate.id, error: outcome.error });
      else result.stale.push({ candidateId: candidate.id, reason: outcome.reason });
    }

    await this.writeProvenance(review, now, result);
    if (review.status === "applied" && result.provenance.failed.length === 0) {
      review = archiveReview(review, now());
      await this.archive(review);
      result.archived = true;
    }
    result.review = review;
    return result;
  }

  private async applyCandidate(review: SourceCandidateProposal, candidate: SourceCandidate): Promise<ApplicationOutcome> {
    if (candidate.operation === "exclude") return { kind: "applied", promotedTaskId: null };
    if (candidate.operation === "merge") {
      const target = candidate.mergeTarget;
      await verifyMergeEvidence(target);
      const current = await this.tasks.readReviewedTask(target.taskId, target.path);
      if (current.status === "ready" && current.content === target.afterMarkdown) return { kind: "applied", promotedTaskId: target.taskId };
      const written = await this.tasks.writeReviewedTask(target.taskId, target.path, target.beforeMarkdown, target.afterMarkdown);
      if (written.status === "saved") return { kind: "applied", promotedTaskId: target.taskId };
      if (written.status === "stale") return { kind: "stale", reason: `Merge target ${target.title} changed after staging` };
      if (written.status === "missing") return { kind: "failed", error: `Merge target ${target.title} is missing` };
      return { kind: "failed", error: `Merge target ${target.title} has duplicate Task IDs: ${written.conflict.paths.join(", ")}` };
    }
    const taskId = await promotedTaskId(review.reviewId, candidate.id, candidate.revision);
    const existing = await this.tasks.readReviewedTask(taskId, "");
    if (existing.status === "ready") return { kind: "applied", promotedTaskId: taskId };
    if (existing.status === "identity-conflict") return { kind: "failed", error: `Task ${taskId} has duplicate IDs: ${existing.conflict.paths.join(", ")}` };
    const draft = candidate.taskDraft;
    const sourceNote = review.sources.find((source) => source.type === "note" && referencesSource(candidate, source.id));
    const taskDraft: TaskDraft = {
      title: draft.title,
      date: draft.date,
      priority: draft.priority,
      labels: [...draft.labels],
      projectId: draft.project,
      steps: draft.steps.map((step) => ({ ...step })),
      notes: draft.notes,
      sourceNote: sourceNote?.type === "note" ? sourceNote.path : null
    };
    await this.tasks.create(taskDraft, taskId);
    return { kind: "applied", promotedTaskId: taskId };
  }

  private async sourceChange(source: SourceCandidateProposal["sources"][number]): Promise<string | null> {
    if (source.type === "conversation") {
      return await sha256(source.snapshot) === source.sha256 ? null : `Conversation Source ${source.localSourceId} does not match its recorded hash`;
    }
    const file = this.app.vault.getAbstractFileByPath(normalizePath(source.path));
    if (!(file instanceof TFile)) return `Source note ${source.path} is missing`;
    return await sourceNoteHash(await this.app.vault.read(file)) === source.sha256 ? null : `Source note ${source.path} changed after staging`;
  }

  private async writeProvenance(review: SourceCandidateProposal, now: () => string, result: FormalApplyResult): Promise<void> {
    for (const completion of noteSourceCompletion(review)) {
      if (!completion.complete) continue;
      const file = this.app.vault.getAbstractFileByPath(normalizePath(completion.path));
      if (!(file instanceof TFile)) {
        result.provenance.failed.push({ path: completion.path, error: "Source note is missing" });
        continue;
      }
      try {
        const content = await this.app.vault.read(file);
        if (importedHash(content) === completion.sha256) continue;
        if (await sourceNoteHash(content) !== completion.sha256) {
          result.provenance.changed.push(completion.path);
          continue;
        }
        const next = withSourceNoteProvenance(content, { importedAt: now(), importedHash: completion.sha256, taskIds: completion.taskIds });
        let written = false;
        await this.app.vault.process(file, (current) => {
          if (current !== content) return current;
          written = true;
          return next;
        });
        if (written) result.provenance.written.push(completion.path);
        else result.provenance.changed.push(completion.path);
      } catch (error) {
        result.provenance.failed.push({ path: completion.path, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  private async list(files: TFile[], keep: (review: SourceCandidateProposal) => boolean): Promise<ReviewSummary[]> {
    const summaries: ReviewSummary[] = [];
    for (const file of files) {
      try {
        const review = parseSourceCandidateProposal(await this.app.vault.read(file));
        if (keep(review)) summaries.push(summarize(review));
      } catch (error) {
        console.error(`TaskMate ignored malformed Source candidate review ${file.path}`, error);
      }
    }
    return summaries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  private async archive(review: SourceCandidateProposal): Promise<void> {
    const source = this.reviewFile(review.reviewId);
    if (!source) throw new Error(`Source candidate review not found: ${review.reviewId}`);
    await this.app.vault.modify(source, serialize(review));
    await this.ensureFolder(this.historyFolder());
    await this.app.fileManager.renameFile(source, normalizePath(`${this.historyFolder()}/${review.reviewId}.json`));
  }

  private pendingFiles(): TFile[] {
    const prefix = `${this.folder()}/source-review-`;
    return this.app.vault.getFiles().filter((file) => file.path.startsWith(prefix) && file.extension === "json");
  }

  private historyFiles(): TFile[] {
    const prefix = `${this.historyFolder()}/source-review-`;
    return this.app.vault.getFiles().filter((file) => file.path.startsWith(prefix) && file.extension === "json");
  }

  private reviewFile(reviewId: string): TFile | null {
    if (!REVIEW_ID.test(reviewId)) throw new Error("Invalid Source candidate review id");
    const file = this.app.vault.getAbstractFileByPath(normalizePath(`${this.folder()}/${reviewId}.json`));
    return file instanceof TFile ? file : null;
  }

  private historyFile(reviewId: string): TFile | null {
    if (!REVIEW_ID.test(reviewId)) throw new Error("Invalid Source candidate review id");
    const file = this.app.vault.getAbstractFileByPath(normalizePath(`${this.historyFolder()}/${reviewId}.json`));
    return file instanceof TFile ? file : null;
  }

  private folder(): string {
    return normalizePath(this.proposalFolder().trim() || "TaskMate/Proposals");
  }

  private historyFolder(): string {
    return normalizePath(`${this.folder()}/History`);
  }

  private async ensureFolder(path: string): Promise<void> {
    const segments = normalizePath(path).split("/").filter(Boolean);
    let current = "";
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current);
    }
  }
}

function referencesSource(candidate: SourceCandidate, sourceId: string): boolean {
  return candidate.sourceRefs.some((ref) => ref.sourceId === sourceId);
}

function serialize(review: SourceCandidateProposal): string {
  return `${JSON.stringify(parseSourceCandidateProposal(JSON.stringify(review)), null, 2)}\n`;
}

function summarize(review: SourceCandidateProposal): ReviewSummary {
  return {
    reviewId: review.reviewId,
    status: review.status,
    health: review.health,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    candidateCount: review.candidates.length,
    appliedCount: review.candidates.filter((candidate) => candidate.application.status === "applied").length
  };
}
