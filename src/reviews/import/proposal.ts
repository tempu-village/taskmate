import { encodeTaskPreservingProperties, parseTaskMarkdown } from "../../tasks/markdown";
import type { Task } from "../../tasks/domain";
import { sha256 } from "../../shared/sha256";

const SCHEMA_VERSION = 1 as const;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const MERGE_FIELDS = ["title", "date", "priority", "labels", "project", "steps", "notes"] as const;
const IMMUTABLE_TASK_FIELDS: Array<keyof Task> = ["id", "completed", "rank", "createdAt", "completedAt", "sourceNote", "stepSectionRemainder"];

type ReviewStatus = "pending" | "ready-to-apply" | "partially-applied" | "applied" | "history";
type Health = "ok" | "stale" | "failed";
type Operation = "create" | "merge" | "exclude";
type Decision = "pending" | "approved" | "hold";
type MergeField = (typeof MERGE_FIELDS)[number];

interface NoteSource {
  id: string;
  type: "note";
  path: string;
  sha256: string;
  capturedAt: string;
}

interface ConversationSource {
  id: string;
  type: "conversation";
  localSourceId: string;
  threadId?: string | null;
  turnRefs: string[];
  snapshot: string;
  sha256: string;
  capturedAt: string;
  selectionInstruction: string;
}

type ReviewSource = NoteSource | ConversationSource;

interface SourceRef {
  sourceId: string;
  statement: string;
}

interface CandidateStep {
  text: string;
  completed: boolean;
  date: string | null;
}

export interface CandidateTaskDraft {
  title: string;
  date: string | null;
  priority: 1 | 2 | 3 | null;
  labels: string[];
  project: string | null;
  steps: CandidateStep[];
  notes: string;
}

type MergeValue = string | number | null | string[] | CandidateStep[];

interface FieldChange {
  field: MergeField;
  before: MergeValue;
  after: MergeValue;
  reason: string;
}

interface MergeTarget {
  taskId: string;
  path: string;
  title: string;
  beforeMarkdown: string;
  afterMarkdown: string;
  beforeSha256: string;
  changes: FieldChange[];
}

interface Application {
  status: "not-applied" | "applied" | "failed";
  appliedAt: string | null;
  promotedTaskId: string | null;
  error: string | null;
}

interface CandidateBase {
  id: string;
  revision: number;
  originalOperation: Operation;
  title: string;
  sourceRefs: SourceRef[];
  taskDraft?: CandidateTaskDraft;
  mergeTarget?: MergeTarget;
  exclusionReason?: string;
  decision: Decision;
  decisionRevision: number | null;
  decidedAt: string | null;
  diffViewedRevision: number | null;
  health: Health;
  healthReason: string | null;
  application: Application;
}

export type ImportCandidate =
  | (CandidateBase & { operation: "create"; taskDraft: CandidateTaskDraft })
  | (CandidateBase & { operation: "merge"; mergeTarget: MergeTarget })
  | (CandidateBase & { operation: "exclude"; exclusionReason: string });

export interface ImportReview {
  schemaVersion: typeof SCHEMA_VERSION;
  reviewId: string;
  reviewType: "import";
  status: ReviewStatus;
  health: Health;
  revision: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  sources: ReviewSource[];
  candidates: ImportCandidate[];
}

export type CandidateEdit =
  | { operation: "create"; title?: string; taskDraft: CandidateTaskDraft }
  | { operation: "merge"; title?: string; values: Partial<Record<MergeField, MergeValue>>; reason: string }
  | { operation: "exclude"; title?: string; exclusionReason: string };

export type ApplicationOutcome =
  | { kind: "applied"; promotedTaskId: string | null }
  | { kind: "failed"; error: string }
  | { kind: "stale"; reason: string };

export interface FormalApplyPlan {
  eligible: ImportCandidate[];
  blocked: Array<{ candidateId: string; reason: "stale" | "held" | "undecided" | "outdated-decision" }>;
  counts: Record<Operation, number>;
  unviewedMerges: Array<{ candidateId: string; targetTitle: string }>;
  requiresAcknowledgement: boolean;
}

export interface NoteSourceCompletion {
  sourceId: string;
  path: string;
  sha256: string;
  complete: boolean;
  taskIds: string[];
}

// Parsing and validation

export function parseImportReview(content: string): ImportReview {
  const value: unknown = JSON.parse(content);
  validateProposal(value);
  return value;
}

export async function verifyMergeEvidence(target: MergeTarget): Promise<void> {
  if (await sha256(target.beforeMarkdown) !== target.beforeSha256) throw new Error(`Merge target ${target.taskId} beforeSha256 does not match its Markdown`);
  const before = requiredTask(target.path, target.beforeMarkdown, target.taskId);
  const after = requiredTask(target.path, target.afterMarkdown, target.taskId);
  const represented = new Set<MergeField>();
  for (const change of target.changes) {
    represented.add(change.field);
    if (!sameValue(change.before, mergeValue(before, change.field)) || !sameValue(change.after, mergeValue(after, change.field))) {
      throw new Error(`Merge change ${change.field} does not match the Markdown evidence of Task ${target.taskId}`);
    }
  }
  for (const field of MERGE_FIELDS) {
    const changed = !sameValue(mergeValue(before, field), mergeValue(after, field));
    if (changed && !represented.has(field)) throw new Error(`Merge evidence has an unrepresented ${field} change for Task ${target.taskId}`);
    if (!changed && represented.has(field)) throw new Error(`Merge evidence represents an unchanged ${field} for Task ${target.taskId}`);
  }
  for (const field of IMMUTABLE_TASK_FIELDS) {
    if (!sameValue(before[field], after[field])) throw new Error(`Merge evidence changes unsupported Task field ${field}`);
  }
}

export async function promotedTaskId(reviewId: string, candidateId: string, revision: number): Promise<string> {
  const hex = await sha256(`${reviewId}\n${candidateId}\n${revision}`);
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// Transitions

export function editCandidate(proposal: ImportReview, candidateId: string, edit: CandidateEdit, now: string): ImportReview {
  return updateCandidate(proposal, candidateId, now, (candidate) => {
    if (candidate.application.status === "applied") throw new Error(`Candidate ${candidateId} is already applied`);
    const base = {
      ...candidate,
      title: requiredText(edit.title ?? candidate.title, "title"),
      revision: candidate.revision + 1,
      decision: "pending" as const,
      decisionRevision: null,
      decidedAt: null,
      diffViewedRevision: null,
      health: "ok" as const,
      healthReason: null,
      application: emptyApplication()
    };
    if (edit.operation === "create") {
      validateTaskDraft(edit.taskDraft, `${candidateId}.taskDraft`);
      return { ...base, operation: "create", taskDraft: structuredClone(edit.taskDraft) };
    }
    if (edit.operation === "exclude") {
      return { ...base, operation: "exclude", exclusionReason: requiredText(edit.exclusionReason, "exclusionReason") };
    }
    if (!candidate.mergeTarget) throw new Error(`Candidate ${candidateId} has no merge target evidence from Task Pilot`);
    return { ...base, operation: "merge", mergeTarget: regeneratedMergeTarget(candidate.mergeTarget, edit.values, requiredText(edit.reason, "reason"), now) };
  });
}

export function decideCandidate(proposal: ImportReview, candidateId: string, decision: Decision, now: string): ImportReview {
  return updateCandidate(proposal, candidateId, now, (candidate) => {
    if (candidate.application.status === "applied") throw new Error(`Candidate ${candidateId} is already applied`);
    return {
      ...candidate,
      decision,
      decisionRevision: decision === "pending" ? null : candidate.revision,
      decidedAt: decision === "pending" ? null : now
    };
  });
}

export function markDiffViewed(proposal: ImportReview, candidateId: string, now: string): ImportReview {
  return updateCandidate(proposal, candidateId, now, (candidate) => {
    if (candidate.operation !== "merge") throw new Error(`Candidate ${candidateId} has no merge diff`);
    return { ...candidate, diffViewedRevision: candidate.revision };
  });
}

export function recordApplication(proposal: ImportReview, candidateId: string, outcome: ApplicationOutcome, now: string): ImportReview {
  return updateCandidate(proposal, candidateId, now, (candidate) => {
    if (candidate.application.status === "applied") throw new Error(`Candidate ${candidateId} is already applied`);
    if (outcome.kind === "stale") {
      return { ...candidate, decision: "pending", decisionRevision: null, decidedAt: null, health: "stale", healthReason: requiredText(outcome.reason, "reason") };
    }
    if (outcome.kind === "failed") {
      const error = requiredText(outcome.error, "error");
      return { ...candidate, health: "failed", healthReason: error, application: { status: "failed", appliedAt: null, promotedTaskId: null, error } };
    }
    if (candidate.operation === "exclude" ? outcome.promotedTaskId !== null : !outcome.promotedTaskId) {
      throw new Error(`Candidate ${candidateId} ${candidate.operation} requires ${candidate.operation === "exclude" ? "no" : "a"} promoted Task ID`);
    }
    if (candidate.operation === "merge" && outcome.promotedTaskId !== candidate.mergeTarget.taskId) {
      throw new Error(`Candidate ${candidateId} merge must promote its target Task`);
    }
    return {
      ...candidate,
      health: "ok",
      healthReason: null,
      application: { status: "applied", appliedAt: now, promotedTaskId: outcome.promotedTaskId, error: null }
    };
  });
}

export function markSourceStale(proposal: ImportReview, sourceId: string, reason: string, now: string): ImportReview {
  if (!proposal.sources.some((source) => source.id === sourceId)) throw new Error(`Unknown Source ${sourceId}`);
  let next = proposal;
  for (const candidate of proposal.candidates) {
    if (candidate.application.status !== "applied" && candidate.sourceRefs.some((ref) => ref.sourceId === sourceId)) {
      next = recordApplication(next, candidate.id, { kind: "stale", reason }, now);
    }
  }
  return next;
}

export function archiveReview(proposal: ImportReview, now: string): ImportReview {
  if (derivedStatus(proposal) !== "applied") throw new Error(`Review ${proposal.reviewId} still has unapplied candidates`);
  return { ...structuredClone(proposal), status: "history", archivedAt: now, revision: proposal.revision + 1, updatedAt: now };
}

// Read models

export function planFormalApply(proposal: ImportReview): FormalApplyPlan {
  const plan: FormalApplyPlan = { eligible: [], blocked: [], counts: { create: 0, merge: 0, exclude: 0 }, unviewedMerges: [], requiresAcknowledgement: false };
  if (proposal.status === "history") return plan;
  for (const candidate of proposal.candidates) {
    if (candidate.application.status === "applied") continue;
    const reason = candidate.health === "stale" ? "stale"
      : candidate.decision === "hold" ? "held"
      : candidate.decision === "pending" ? "undecided"
      : candidate.decisionRevision !== candidate.revision ? "outdated-decision"
      : null;
    if (reason) {
      plan.blocked.push({ candidateId: candidate.id, reason });
      continue;
    }
    plan.eligible.push(structuredClone(candidate));
    plan.counts[candidate.operation] += 1;
    if (candidate.operation === "merge" && candidate.diffViewedRevision !== candidate.revision) {
      plan.unviewedMerges.push({ candidateId: candidate.id, targetTitle: candidate.mergeTarget.title });
    }
  }
  plan.requiresAcknowledgement = plan.unviewedMerges.length > 0;
  return plan;
}

// The before and after Task fields of a merge target, in the same shape as a Task draft.
export function mergeTargetFields(candidate: ImportCandidate): { before: CandidateTaskDraft; after: CandidateTaskDraft } | null {
  const target = candidate.mergeTarget;
  if (!target) return null;
  return {
    before: taskFields(requiredTask(target.path, target.beforeMarkdown, target.taskId)),
    after: taskFields(requiredTask(target.path, target.afterMarkdown, target.taskId))
  };
}

export function noteSourceCompletion(proposal: ImportReview): NoteSourceCompletion[] {
  return proposal.sources.flatMap((source) => {
    if (source.type !== "note") return [];
    const candidates = proposal.candidates.filter((candidate) => candidate.sourceRefs.some((ref) => ref.sourceId === source.id));
    const taskIds = [...new Set(candidates.flatMap((candidate) => candidate.application.promotedTaskId ? [candidate.application.promotedTaskId] : []))];
    return [{
      sourceId: source.id,
      path: source.path,
      sha256: source.sha256,
      complete: candidates.every((candidate) => candidate.application.status === "applied"),
      taskIds
    }];
  });
}

export function newlyCompletedNoteSources(before: ImportReview, after: ImportReview): NoteSourceCompletion[] {
  const previouslyComplete = new Set(noteSourceCompletion(before).filter((source) => source.complete).map((source) => source.sourceId));
  return noteSourceCompletion(after).filter((source) => source.complete && !previouslyComplete.has(source.sourceId));
}

// Internal helpers

function updateCandidate(
  proposal: ImportReview,
  candidateId: string,
  now: string,
  update: (candidate: ImportCandidate) => ImportCandidate
): ImportReview {
  if (proposal.status === "history") throw new Error(`Review ${proposal.reviewId} is in History`);
  if (!DATE_TIME.test(now)) throw new Error("Transition time must be an ISO date-time");
  const index = proposal.candidates.findIndex((candidate) => candidate.id === candidateId);
  if (index < 0) throw new Error(`Unknown candidate ${candidateId}`);
  const next = structuredClone(proposal);
  next.candidates[index] = update(next.candidates[index]);
  next.revision += 1;
  next.updatedAt = now;
  next.health = derivedHealth(next);
  next.status = derivedStatus(next);
  return next;
}

function regeneratedMergeTarget(
  target: MergeTarget,
  values: Partial<Record<MergeField, MergeValue>>,
  reason: string,
  now: string
): MergeTarget {
  const before = requiredTask(target.path, target.beforeMarkdown, target.taskId);
  const current = requiredTask(target.path, target.afterMarkdown, target.taskId);
  const after: Task = structuredClone(current);
  for (const [field, value] of Object.entries(values) as Array<[MergeField, MergeValue]>) {
    if (!MERGE_FIELDS.includes(field)) throw new Error(`Merge field ${field} cannot be edited`);
    assignMergeValue(after, field, value);
  }
  after.updatedAt = now;
  const previousReasons = new Map(target.changes.map((change) => [change.field, change]));
  const changes = MERGE_FIELDS.flatMap((field): FieldChange[] => {
    const beforeValue = mergeValue(before, field);
    const afterValue = mergeValue(after, field);
    if (sameValue(beforeValue, afterValue)) return [];
    const previous = previousReasons.get(field);
    const kept = previous && sameValue(previous.after, afterValue) ? previous.reason : reason;
    return [{ field, before: beforeValue, after: afterValue, reason: kept }];
  });
  if (changes.length === 0) throw new Error(`Merge into Task ${target.taskId} must change at least one field`);
  return { ...target, afterMarkdown: encodeTaskPreservingProperties(after, target.beforeMarkdown), changes };
}

function assignMergeValue(task: Task, field: MergeField, value: MergeValue): void {
  switch (field) {
    case "title": task.title = requiredText(value, "title"); return;
    case "date": if (value !== null && !(typeof value === "string" && DATE.test(value))) throw new Error("Merge date must be YYYY-MM-DD or null"); task.date = value; return;
    case "priority": if (value !== null && value !== 1 && value !== 2 && value !== 3) throw new Error("Merge priority must be 1, 2, 3 or null"); task.priority = value; return;
    case "labels": if (!isStringArray(value)) throw new Error("Merge labels must be strings"); task.labels = [...value]; return;
    case "project": if (value !== null && typeof value !== "string") throw new Error("Merge project must be a string or null"); task.projectId = value; return;
    case "steps": validateSteps(value, "steps"); task.steps = structuredClone(value as CandidateStep[]); return;
    case "notes": if (typeof value !== "string") throw new Error("Merge notes must be a string"); task.notes = value; return;
  }
}

function mergeValue(task: Task, field: MergeField): MergeValue {
  switch (field) {
    case "title": return task.title;
    case "date": return task.date;
    case "priority": return task.priority;
    case "labels": return task.labels;
    case "project": return task.projectId;
    case "steps": return task.steps;
    case "notes": return task.notes;
  }
}

function taskFields(task: Task): CandidateTaskDraft {
  return { title: task.title, date: task.date, priority: task.priority, labels: [...task.labels], project: task.projectId, steps: structuredClone(task.steps), notes: task.notes };
}

function requiredTask(path: string, markdown: string, taskId: string): Task {
  const task = parseTaskMarkdown(path, markdown);
  if (!task || task.id !== taskId) throw new Error(`Merge evidence is not canonical Task ${taskId}`);
  return task;
}

function derivedHealth(proposal: ImportReview): Health {
  const pending = proposal.candidates.filter((candidate) => candidate.application.status !== "applied");
  if (pending.some((candidate) => candidate.health === "failed")) return "failed";
  if (pending.some((candidate) => candidate.health === "stale")) return "stale";
  return "ok";
}

function derivedStatus(proposal: ImportReview): ReviewStatus {
  if (proposal.status === "history") return "history";
  const applied = proposal.candidates.filter((candidate) => candidate.application.status === "applied").length;
  if (applied === proposal.candidates.length) return "applied";
  if (applied > 0) return "partially-applied";
  const ready = proposal.candidates.every((candidate) =>
    candidate.decision === "approved" && candidate.decisionRevision === candidate.revision && candidate.health === "ok");
  return ready ? "ready-to-apply" : "pending";
}

function emptyApplication(): Application {
  return { status: "not-applied", appliedAt: null, promotedTaskId: null, error: null };
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requiredText(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value;
}

// Shape validation (mirrors docs/engineering/specifications/import-review.schema.json)

function validateProposal(value: unknown): asserts value is ImportReview {
  const proposal = record(value, "Proposal");
  allowOnly(proposal, ["schemaVersion", "reviewId", "reviewType", "status", "health", "revision", "createdAt", "updatedAt", "archivedAt", "sources", "candidates"], "Proposal");
  if (proposal.schemaVersion !== SCHEMA_VERSION) invalid("schemaVersion", "must be 1");
  if (typeof proposal.reviewId !== "string" || !/^import-review-[A-Za-z0-9._-]+$/.test(proposal.reviewId)) invalid("reviewId", "must start with import-review-");
  if (proposal.reviewType !== "import") invalid("reviewType", "must be import");
  oneOf(proposal.status, ["pending", "ready-to-apply", "partially-applied", "applied", "history"], "status");
  oneOf(proposal.health, ["ok", "stale", "failed"], "health");
  positiveInteger(proposal.revision, "revision");
  dateTime(proposal.createdAt, "createdAt");
  dateTime(proposal.updatedAt, "updatedAt");
  if (proposal.archivedAt !== undefined && proposal.archivedAt !== null) dateTime(proposal.archivedAt, "archivedAt");
  if (!Array.isArray(proposal.sources) || proposal.sources.length === 0) invalid("sources", "requires at least one Source");
  if (!Array.isArray(proposal.candidates) || proposal.candidates.length === 0) invalid("candidates", "requires at least one candidate");
  const sourceIds = new Set<string>();
  proposal.sources.forEach((source, index) => {
    const id = validateSource(source, `sources[${index}]`);
    if (sourceIds.has(id)) invalid(`sources[${index}].id`, `duplicates ${id}`);
    sourceIds.add(id);
  });
  const candidateIds = new Set<string>();
  const statements = new Map<string, string>();
  proposal.candidates.forEach((candidate, index) => {
    const path = `candidates[${index}]`;
    validateCandidate(candidate, path);
    const { id, sourceRefs } = candidate as ImportCandidate;
    if (candidateIds.has(id)) invalid(`${path}.id`, `duplicates ${id}`);
    candidateIds.add(id);
    for (const ref of sourceRefs) {
      if (!sourceIds.has(ref.sourceId)) invalid(`${path}.sourceRefs`, `references unknown Source ${ref.sourceId}`);
      const key = `${ref.sourceId}\u0000${ref.statement}`;
      const owner = statements.get(key);
      if (owner) invalid(`${path}.sourceRefs`, `maps a ${ref.sourceId} statement already mapped by ${owner}`);
      statements.set(key, id);
    }
  });
  const referenced = new Set([...statements.keys()].map((key) => key.split("\u0000")[0]));
  for (const id of sourceIds) if (!referenced.has(id)) invalid("sources", `${id} is not mapped by any candidate`);
  const typed = proposal as unknown as ImportReview;
  if ((typed.status === "history") !== Boolean(typed.archivedAt)) invalid("archivedAt", "must be set exactly when the review is in History");
  if (typed.status !== "history" && typed.status !== derivedStatus(typed)) invalid("status", `does not match candidate state (${derivedStatus(typed)})`);
  if (typed.status === "history" && derivedStatus({ ...typed, status: "pending" }) !== "applied") invalid("status", "History requires every candidate to be applied");
  if (typed.health !== derivedHealth(typed)) invalid("health", `does not match candidate health (${derivedHealth(typed)})`);
}

function validateSource(value: unknown, path: string): string {
  const source = record(value, path);
  pattern(source.id, /^SRC-[0-9]{2,}$/, `${path}.id`);
  sha(source.sha256, `${path}.sha256`);
  dateTime(source.capturedAt, `${path}.capturedAt`);
  if (source.type === "note") {
    allowOnly(source, ["id", "type", "path", "sha256", "capturedAt"], path);
    nonEmpty(source.path, `${path}.path`);
  } else if (source.type === "conversation") {
    allowOnly(source, ["id", "type", "localSourceId", "threadId", "turnRefs", "snapshot", "sha256", "capturedAt", "selectionInstruction"], path);
    nonEmpty(source.localSourceId, `${path}.localSourceId`);
    if (source.threadId !== undefined && source.threadId !== null && typeof source.threadId !== "string") invalid(`${path}.threadId`, "must be a string or null");
    if (!isStringArray(source.turnRefs) || source.turnRefs.some((ref) => !ref) || new Set(source.turnRefs).size !== source.turnRefs.length) invalid(`${path}.turnRefs`, "must be unique non-empty strings");
    nonEmpty(source.snapshot, `${path}.snapshot`);
    nonEmpty(source.selectionInstruction, `${path}.selectionInstruction`);
  } else {
    invalid(`${path}.type`, "must be note or conversation");
  }
  return source.id as string;
}

function validateCandidate(value: unknown, path: string): void {
  const candidate = record(value, path);
  allowOnly(candidate, ["id", "revision", "originalOperation", "operation", "title", "sourceRefs", "taskDraft", "mergeTarget", "exclusionReason", "decision", "decisionRevision", "decidedAt", "diffViewedRevision", "health", "healthReason", "application"], path);
  pattern(candidate.id, /^IC-[0-9]{2,}$/, `${path}.id`);
  positiveInteger(candidate.revision, `${path}.revision`);
  oneOf(candidate.originalOperation, ["create", "merge", "exclude"], `${path}.originalOperation`);
  oneOf(candidate.operation, ["create", "merge", "exclude"], `${path}.operation`);
  nonEmpty(candidate.title, `${path}.title`);
  if (!Array.isArray(candidate.sourceRefs) || candidate.sourceRefs.length === 0) invalid(`${path}.sourceRefs`, "requires at least one Source statement");
  candidate.sourceRefs.forEach((ref, index) => {
    const sourceRef = record(ref, `${path}.sourceRefs[${index}]`);
    allowOnly(sourceRef, ["sourceId", "statement"], `${path}.sourceRefs[${index}]`);
    pattern(sourceRef.sourceId, /^SRC-[0-9]{2,}$/, `${path}.sourceRefs[${index}].sourceId`);
    nonEmpty(sourceRef.statement, `${path}.sourceRefs[${index}].statement`);
  });
  if (candidate.taskDraft !== undefined) validateTaskDraft(candidate.taskDraft, `${path}.taskDraft`);
  if (candidate.mergeTarget !== undefined) validateMergeTarget(candidate.mergeTarget, `${path}.mergeTarget`);
  if (candidate.exclusionReason !== undefined) nonEmpty(candidate.exclusionReason, `${path}.exclusionReason`);
  const required = { create: "taskDraft", merge: "mergeTarget", exclude: "exclusionReason" } as const;
  const requiredField = required[candidate.operation as Operation];
  if (candidate[requiredField] === undefined) invalid(path, `${candidate.operation} requires ${requiredField}`);
  oneOf(candidate.decision, ["pending", "approved", "hold"], `${path}.decision`);
  optionalRevision(candidate.decisionRevision, `${path}.decisionRevision`);
  if (candidate.decidedAt !== null) dateTime(candidate.decidedAt, `${path}.decidedAt`);
  optionalRevision(candidate.diffViewedRevision, `${path}.diffViewedRevision`);
  oneOf(candidate.health, ["ok", "stale", "failed"], `${path}.health`);
  if (candidate.healthReason !== null && typeof candidate.healthReason !== "string") invalid(`${path}.healthReason`, "must be a string or null");
  const revision = candidate.revision as number;
  const decided = candidate.decision !== "pending";
  if (decided !== (candidate.decisionRevision !== null) || decided !== (candidate.decidedAt !== null)) invalid(path, "decisionRevision and decidedAt must be set exactly when a decision is made");
  if (typeof candidate.decisionRevision === "number" && candidate.decisionRevision > revision) invalid(`${path}.decisionRevision`, "is newer than the candidate");
  if (typeof candidate.diffViewedRevision === "number" && (candidate.diffViewedRevision > revision || candidate.operation !== "merge")) invalid(`${path}.diffViewedRevision`, "is valid only for a viewed merge revision");
  validateApplication(candidate.application, candidate, `${path}.application`);
}

function validateApplication(value: unknown, candidate: Record<string, unknown>, path: string): void {
  const application = record(value, path);
  allowOnly(application, ["status", "appliedAt", "promotedTaskId", "error"], path);
  oneOf(application.status, ["not-applied", "applied", "failed"], `${path}.status`);
  if (application.appliedAt !== null) dateTime(application.appliedAt, `${path}.appliedAt`);
  if (application.promotedTaskId !== null && typeof application.promotedTaskId !== "string") invalid(`${path}.promotedTaskId`, "must be a string or null");
  if (application.error !== null && typeof application.error !== "string") invalid(`${path}.error`, "must be a string or null");
  const applied = application.status === "applied";
  if (applied !== (application.appliedAt !== null)) invalid(`${path}.appliedAt`, "must be set exactly when applied");
  if ((application.status === "failed") !== (application.error !== null)) invalid(`${path}.error`, "must be set exactly when failed");
  const needsTask = applied && candidate.operation !== "exclude";
  if (needsTask !== (application.promotedTaskId !== null)) invalid(`${path}.promotedTaskId`, "must be set exactly for an applied create or merge");
  if (applied && candidate.operation === "merge" && application.promotedTaskId !== (candidate.mergeTarget as MergeTarget).taskId) invalid(`${path}.promotedTaskId`, "must be the merge target");
}

function validateTaskDraft(value: unknown, path: string): void {
  const draft = record(value, path);
  allowOnly(draft, ["title", "date", "priority", "labels", "project", "steps", "notes"], path);
  for (const field of ["title", "date", "priority", "labels", "project", "steps", "notes"]) if (!(field in draft)) invalid(path, `requires ${field}`);
  nonEmpty(draft.title, `${path}.title`);
  if (draft.date !== null && !(typeof draft.date === "string" && DATE.test(draft.date))) invalid(`${path}.date`, "must be YYYY-MM-DD or null");
  if (draft.priority !== null && draft.priority !== 1 && draft.priority !== 2 && draft.priority !== 3) invalid(`${path}.priority`, "must be 1, 2, 3 or null");
  if (!isStringArray(draft.labels) || draft.labels.some((label) => !label) || new Set(draft.labels).size !== draft.labels.length) invalid(`${path}.labels`, "must be unique non-empty strings");
  if (draft.project !== null && typeof draft.project !== "string") invalid(`${path}.project`, "must be a string or null");
  validateSteps(draft.steps, `${path}.steps`);
  if (typeof draft.notes !== "string") invalid(`${path}.notes`, "must be a string");
}

function validateSteps(value: unknown, path: string): void {
  if (!Array.isArray(value)) invalid(path, "must be an array");
  value.forEach((raw, index) => {
    const step = record(raw, `${path}[${index}]`);
    allowOnly(step, ["text", "completed", "date"], `${path}[${index}]`);
    nonEmpty(step.text, `${path}[${index}].text`);
    if (typeof step.completed !== "boolean") invalid(`${path}[${index}].completed`, "must be a boolean");
    if (step.date !== null && !(typeof step.date === "string" && DATE.test(step.date))) invalid(`${path}[${index}].date`, "must be YYYY-MM-DD or null");
  });
}

function validateMergeTarget(value: unknown, path: string): void {
  const target = record(value, path);
  allowOnly(target, ["taskId", "path", "title", "beforeMarkdown", "afterMarkdown", "beforeSha256", "changes"], path);
  nonEmpty(target.taskId, `${path}.taskId`);
  nonEmpty(target.path, `${path}.path`);
  if ((target.path as string).startsWith("/") || (target.path as string).split("/").includes("..")) invalid(`${path}.path`, "must stay inside the Vault");
  nonEmpty(target.title, `${path}.title`);
  nonEmpty(target.beforeMarkdown, `${path}.beforeMarkdown`);
  nonEmpty(target.afterMarkdown, `${path}.afterMarkdown`);
  sha(target.beforeSha256, `${path}.beforeSha256`);
  if (!Array.isArray(target.changes) || target.changes.length === 0) invalid(`${path}.changes`, "requires at least one change");
  const fields = new Set<unknown>();
  target.changes.forEach((raw, index) => {
    const change = record(raw, `${path}.changes[${index}]`);
    allowOnly(change, ["field", "before", "after", "reason"], `${path}.changes[${index}]`);
    oneOf(change.field, MERGE_FIELDS, `${path}.changes[${index}].field`);
    if (!("before" in change) || !("after" in change)) invalid(`${path}.changes[${index}]`, "requires before and after");
    nonEmpty(change.reason, `${path}.changes[${index}].reason`);
    if (fields.has(change.field)) invalid(`${path}.changes[${index}].field`, `duplicates ${String(change.field)}`);
    fields.add(change.field);
  });
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid(path, "must be an object");
  return value as Record<string, unknown>;
}

function allowOnly(value: Record<string, unknown>, keys: readonly string[], path: string): void {
  const unexpected = Object.keys(value).filter((key) => !keys.includes(key));
  if (unexpected.length > 0) invalid(path, `has unsupported properties: ${unexpected.join(", ")}`);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], path: string): asserts value is T {
  if (!allowed.includes(value as T)) invalid(path, `must be one of ${allowed.join(", ")}`);
}

function pattern(value: unknown, regex: RegExp, path: string): void {
  if (typeof value !== "string" || !regex.test(value)) invalid(path, `must match ${regex.source}`);
}

function nonEmpty(value: unknown, path: string): void {
  if (typeof value !== "string" || value.length === 0) invalid(path, "must be a non-empty string");
}

function sha(value: unknown, path: string): void {
  pattern(value, SHA256, path);
}

function dateTime(value: unknown, path: string): void {
  if (typeof value !== "string" || !DATE_TIME.test(value) || Number.isNaN(Date.parse(value))) invalid(path, "must be an ISO date-time");
}

function positiveInteger(value: unknown, path: string): void {
  if (!Number.isInteger(value) || (value as number) < 1) invalid(path, "must be a positive integer");
}

function optionalRevision(value: unknown, path: string): void {
  if (value !== null) positiveInteger(value, path);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function invalid(path: string, message: string): never {
  throw new Error(`Import review ${path} ${message}`);
}
