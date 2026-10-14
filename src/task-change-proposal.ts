import { applyPatch, structuredPatch } from "diff";
import { encodeTaskPreservingProperties, parseTaskMarkdown } from "./markdown";
import type { Task } from "./domain";

export const TASK_CHANGE_PROPOSAL_SCHEMA_VERSION = 1 as const;

export type ProposalStatus = "pending" | "applied" | "partially-applied" | "rejected" | "stale";
export type ChangeField = "title" | "date" | "priority" | "labels" | "steps" | "notes";
export type ChangeValue = string | number | boolean | null | string[] | Array<{ text: string; completed: boolean; date: string | null }>;

export interface ProposalChange {
  id: string;
  field: ChangeField;
  before: ChangeValue;
  after: ChangeValue;
  reason: string;
  origin?: { proposalId: string; changeId: string };
}

export interface ProposalTask {
  taskId: string;
  path: string;
  title: string;
  beforeMarkdown: string;
  afterMarkdown: string;
  beforeSha256: string;
  changes: ProposalChange[];
}

export interface ProposalDecision {
  decidedAt: string;
  approvedChangeIds: string[];
  rejectedChangeIds: string[];
}

export interface ProposalApplyResult {
  appliedAt: string;
  succeededChangeIds: string[];
  failed: Array<{ taskId: string; changeIds: string[]; error: string }>;
  followUpProposalId: string | null;
}

export interface TaskChangeProposal {
  schemaVersion: typeof TASK_CHANGE_PROPOSAL_SCHEMA_VERSION;
  id: string;
  status: ProposalStatus;
  createdAt: string;
  tasks: ProposalTask[];
  decision?: ProposalDecision;
  result?: ProposalApplyResult;
  originProposalId?: string;
}

export interface ReviewHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export interface ProposalTaskReview extends ProposalTask {
  rawHunks: ReviewHunk[];
}

export interface ProposalReview {
  proposalId: string;
  status: ProposalStatus;
  tasks: ProposalTaskReview[];
}

export interface ProposalWrite {
  taskId: string;
  path: string;
  title: string;
  markdown: string;
  changeIds: string[];
}

export interface ProposalDecisionResult {
  status: ProposalStatus;
  writes: ProposalWrite[];
  closedProposal: TaskChangeProposal;
  followUp: TaskChangeProposal | null;
}

export async function sha256(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function buildProposalReview(proposal: TaskChangeProposal): Promise<ProposalReview> {
  validateProposalShape(proposal);
  const tasks: ProposalTaskReview[] = [];
  for (const task of proposal.tasks) {
    if (await sha256(task.beforeMarkdown) !== task.beforeSha256) {
      throw new Error(`Proposal ${proposal.id} beforeSha256 does not match Task ${task.taskId}`);
    }
    validateSemanticEvidence(task);
    const patch = structuredPatch(task.path, task.path, task.beforeMarkdown, task.afterMarkdown, "before", "after", { context: 3 });
    if (applyPatch(task.beforeMarkdown, patch) !== task.afterMarkdown) {
      throw new Error(`Proposal ${proposal.id} exact patch replay failed for Task ${task.taskId}`);
    }
    tasks.push({
      ...task,
      rawHunks: patch.hunks.map((hunk) => ({
        oldStart: hunk.oldStart,
        oldLines: hunk.oldLines,
        newStart: hunk.newStart,
        newLines: hunk.newLines,
        lines: [...hunk.lines]
      }))
    });
  }
  return { proposalId: proposal.id, status: proposal.status, tasks };
}

export function parseTaskChangeProposal(content: string): TaskChangeProposal {
  const value: unknown = JSON.parse(content);
  validateProposalShape(value);
  return value;
}

export async function applyProposalDecision(
  proposal: TaskChangeProposal,
  approvedChangeIds: string[],
  currentMarkdownByTaskId: ReadonlyMap<string, string>,
  options: { decidedAt: string; followUpProposalId: string }
): Promise<ProposalDecisionResult> {
  await buildProposalReview(proposal);
  if (proposal.status !== "pending") throw new Error(`Proposal ${proposal.id} is not pending`);
  const allChanges = proposal.tasks.flatMap((task) => task.changes);
  const knownIds = new Set(allChanges.map((change) => change.id));
  const approved = new Set(approvedChangeIds);
  for (const id of approved) if (!knownIds.has(id)) throw new Error(`Unknown approved change: ${id}`);

  const rejectedIds = allChanges.map((change) => change.id).filter((id) => !approved.has(id));
  const writes: ProposalWrite[] = [];
  const failed: ProposalApplyResult["failed"] = [];
  const followUpTasks: ProposalTask[] = [];
  let nextFollowUpChange = 1;

  for (const proposalTask of proposal.tasks) {
    const approvedForTask = proposalTask.changes.filter((change) => approved.has(change.id));
    const rejectedForTask = proposalTask.changes.filter((change) => !approved.has(change.id));
    const current = currentMarkdownByTaskId.get(proposalTask.taskId);
    if (current === undefined || await sha256(current) !== proposalTask.beforeSha256 || current !== proposalTask.beforeMarkdown) {
      if (approvedForTask.length > 0) {
        failed.push({
          taskId: proposalTask.taskId,
          changeIds: approvedForTask.map((change) => change.id),
          error: current === undefined ? "Task is missing" : "Task changed after review"
        });
      }
      continue;
    }

    const beforeTask = parseRequiredTask(proposalTask.path, proposalTask.beforeMarkdown, proposalTask.taskId);
    const afterTask = parseRequiredTask(proposalTask.path, proposalTask.afterMarkdown, proposalTask.taskId);
    const appliedTask = applyFields(beforeTask, afterTask, approvedForTask.map((change) => change.field));
    const appliedMarkdown = approvedForTask.length > 0
      ? encodeTaskPreservingProperties(appliedTask, proposalTask.beforeMarkdown)
      : proposalTask.beforeMarkdown;
    if (approvedForTask.length > 0) {
      writes.push({
        taskId: proposalTask.taskId,
        path: proposalTask.path,
        title: appliedTask.title,
        markdown: appliedMarkdown,
        changeIds: approvedForTask.map((change) => change.id)
      });
    }

    if (rejectedForTask.length > 0) {
      const followUpAfterTask = applyFields(appliedTask, afterTask, rejectedForTask.map((change) => change.field));
      const followUpAfter = encodeTaskPreservingProperties(followUpAfterTask, appliedMarkdown);
      followUpTasks.push({
        ...withoutLegacyReviewId(proposalTask),
        beforeMarkdown: appliedMarkdown,
        afterMarkdown: followUpAfter,
        beforeSha256: await sha256(appliedMarkdown),
        changes: rejectedForTask.map((change) => ({
          ...change,
          id: `C-${String(nextFollowUpChange++).padStart(2, "0")}`,
          origin: { proposalId: proposal.id, changeId: change.id }
        }))
      });
    }
  }

  const succeededIds = writes.flatMap((write) => write.changeIds);
  const followUp = followUpTasks.length > 0
    ? {
        schemaVersion: TASK_CHANGE_PROPOSAL_SCHEMA_VERSION,
        id: options.followUpProposalId,
        status: "pending" as const,
        createdAt: options.decidedAt,
        tasks: followUpTasks,
        originProposalId: proposal.id
      }
    : null;
  const status: ProposalStatus = failed.length > 0
    ? succeededIds.length > 0 ? "partially-applied" : "stale"
    : rejectedIds.length > 0 ? succeededIds.length > 0 ? "partially-applied" : "rejected"
    : "applied";
  const closedProposal: TaskChangeProposal = {
    ...proposal,
    status,
    decision: {
      decidedAt: options.decidedAt,
      approvedChangeIds: [...approved],
      rejectedChangeIds: rejectedIds
    },
    result: {
      appliedAt: options.decidedAt,
      succeededChangeIds: succeededIds,
      failed,
      followUpProposalId: followUp?.id ?? null
    }
  };
  return { status, writes, closedProposal, followUp };
}

function withoutLegacyReviewId(task: ProposalTask): ProposalTask {
  const copy = { ...task } as ProposalTask & { reviewId?: unknown };
  delete copy.reviewId;
  return copy;
}

function parseRequiredTask(path: string, markdown: string, taskId: string): Task {
  const task = parseTaskMarkdown(path, markdown);
  if (!task || task.id !== taskId) throw new Error(`Invalid Task evidence for ${taskId}`);
  return task;
}

function applyFields(before: Task, after: Task, fields: ChangeField[]): Task {
  const result: Task = {
    ...before,
    labels: [...before.labels],
    steps: before.steps.map((step) => ({ ...step }))
  };
  for (const field of new Set(fields)) {
    switch (field) {
      case "title": result.title = after.title; break;
      case "date": result.date = after.date; break;
      case "priority": result.priority = after.priority; break;
      case "labels": result.labels = [...after.labels]; break;
      case "steps": result.steps = after.steps.map((step) => ({ ...step })); break;
      case "notes": result.notes = after.notes; break;
    }
  }
  if (fields.length > 0) result.updatedAt = after.updatedAt;
  return result;
}

function validateSemanticEvidence(proposalTask: ProposalTask): void {
  const before = parseRequiredTask(proposalTask.path, proposalTask.beforeMarkdown, proposalTask.taskId);
  const after = parseRequiredTask(proposalTask.path, proposalTask.afterMarkdown, proposalTask.taskId);
  const fields: ChangeField[] = ["title", "date", "priority", "labels", "steps", "notes"];
  const represented = new Set<ChangeField>();
  for (const change of proposalTask.changes) {
    if (represented.has(change.field)) throw new Error(`Duplicate semantic field ${change.field} in Task ${proposalTask.taskId}`);
    represented.add(change.field);
    if (!sameValue(change.before, taskField(before, change.field)) || !sameValue(change.after, taskField(after, change.field))) {
      throw new Error(`Change ${change.id} values do not match Markdown evidence`);
    }
  }
  for (const field of fields) {
    const changed = !sameValue(taskField(before, field), taskField(after, field));
    if (changed && !represented.has(field)) throw new Error(`Proposal has unrepresented semantic field ${field}`);
    if (!changed && represented.has(field)) throw new Error(`Proposal represents unchanged semantic field ${field}`);
  }
  const immutable: Array<keyof Task> = ["id", "completed", "projectId", "rank", "createdAt", "completedAt", "sourceNote", "stepSectionRemainder"];
  for (const field of immutable) {
    if (!sameValue(before[field], after[field])) throw new Error(`Proposal changes unsupported Task field ${field}`);
  }
}

function taskField(task: Task, field: ChangeField): ChangeValue {
  switch (field) {
    case "title": return task.title;
    case "date": return task.date;
    case "priority": return task.priority;
    case "labels": return task.labels;
    case "steps": return task.steps;
    case "notes": return task.notes;
  }
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateProposalShape(value: unknown): asserts value is TaskChangeProposal {
  if (!isRecord(value)) throw new Error("Proposal must be an object");
  if (value.schemaVersion !== TASK_CHANGE_PROPOSAL_SCHEMA_VERSION) throw new Error("Unsupported Proposal schemaVersion");
  if (!isIdentifier(value.id, /^proposal-[A-Za-z0-9._-]+$/)) throw new Error("Invalid Proposal id");
  if (!isStatus(value.status)) throw new Error("Invalid Proposal status");
  if (typeof value.createdAt !== "string" || !value.createdAt) throw new Error("Invalid Proposal createdAt");
  if (!Array.isArray(value.tasks) || value.tasks.length === 0) throw new Error("Proposal requires tasks");
  const taskIds = new Set<string>();
  const changeIds = new Set<string>();
  for (const task of value.tasks) {
    if (!isRecord(task)) throw new Error("Invalid Proposal task");
    if (typeof task.taskId !== "string" || !task.taskId || taskIds.has(task.taskId)) throw new Error("Invalid or duplicate taskId");
    if (typeof task.path !== "string" || !task.path || task.path.startsWith("/") || task.path.includes("..")) throw new Error("Invalid Task path");
    if (typeof task.title !== "string" || typeof task.beforeMarkdown !== "string" || typeof task.afterMarkdown !== "string") throw new Error("Invalid Proposal Markdown evidence");
    if (typeof task.beforeSha256 !== "string" || !/^[a-f0-9]{64}$/.test(task.beforeSha256)) throw new Error("Invalid beforeSha256");
    if (!Array.isArray(task.changes) || task.changes.length === 0) throw new Error("Proposal task requires changes");
    taskIds.add(task.taskId);
    const taskFields = new Set<unknown>();
    for (const change of task.changes) {
      if (!isRecord(change) || !isIdentifier(change.id, /^C-[0-9]{2,}$/) || changeIds.has(change.id)) throw new Error("Invalid or duplicate change id");
      if (!isChangeField(change.field)) throw new Error("Invalid change field");
      if (taskFields.has(change.field)) throw new Error("Duplicate change field");
      if (typeof change.reason !== "string" || !change.reason.trim()) throw new Error("Change reason is required");
      changeIds.add(change.id);
      taskFields.add(change.field);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIdentifier(value: unknown, pattern: RegExp): value is string {
  return typeof value === "string" && pattern.test(value);
}

function isStatus(value: unknown): value is ProposalStatus {
  return value === "pending" || value === "applied" || value === "partially-applied" || value === "rejected" || value === "stale";
}

function isChangeField(value: unknown): value is ChangeField {
  return value === "title" || value === "date" || value === "priority" || value === "labels" || value === "steps" || value === "notes";
}
