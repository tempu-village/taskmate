import { App, normalizePath, TFile } from "obsidian";
import type { TaskRepository } from "../../tasks/repository";
import {
  applyProposalDecision,
  buildProposalReview,
  parseTaskChangeProposal
} from "./proposal";
import type {
  ProposalDecisionResult,
  ProposalReview,
  ProposalTask,
  TaskChangeProposal
} from "./proposal";

interface ProposalSummary {
  id: string;
  createdAt: string;
  resultAt?: string;
  taskCount: number;
  changeCount: number;
  status: TaskChangeProposal["status"];
  succeededCount: number;
  failedCount: number;
  followUpProposalId: string | null;
}

export class TaskChangeProposalRepository {
  constructor(
    private readonly app: App,
    private readonly proposalFolder: () => string,
    private readonly tasks: TaskRepository
  ) {}

  async listPending(): Promise<ProposalSummary[]> {
    const prefix = `${this.folder()}/`;
    const files = this.app.vault.getFiles().filter((file) => (
      file.path.startsWith(prefix)
      && !file.path.startsWith(`${this.historyFolder()}/`)
      && file.extension === "json"
    ));
    const summaries: ProposalSummary[] = [];
    for (const file of files) {
      try {
        const proposal = parseTaskChangeProposal(await this.app.vault.read(file));
        if (proposal.status !== "pending") continue;
        summaries.push(summarize(proposal));
      } catch (error) {
        console.error(`TaskMate ignored malformed Proposal ${file.path}`, error);
      }
    }
    return summaries.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async listHistory(): Promise<ProposalSummary[]> {
    const prefix = `${this.historyFolder()}/`;
    const files = this.app.vault.getFiles().filter((file) => file.path.startsWith(prefix) && file.extension === "json");
    const summaries: ProposalSummary[] = [];
    for (const file of files) {
      try {
        const proposal = parseTaskChangeProposal(await this.app.vault.read(file));
        if (proposal.status === "pending") continue;
        summaries.push(summarize(proposal));
      } catch (error) {
        console.error(`TaskMate ignored malformed Proposal history ${file.path}`, error);
      }
    }
    return summaries.sort((left, right) => (right.resultAt ?? right.createdAt).localeCompare(left.resultAt ?? left.createdAt));
  }

  async load(proposalId: string): Promise<TaskChangeProposal> {
    const file = this.proposalFile(proposalId);
    if (!file) throw new Error(`Proposal not found: ${proposalId}`);
    return parseTaskChangeProposal(await this.app.vault.read(file));
  }

  async review(proposalId: string): Promise<ProposalReview> {
    return buildProposalReview(await this.load(proposalId));
  }

  async reviewHistory(proposalId: string): Promise<ProposalReview> {
    const file = this.historyProposalFile(proposalId);
    if (!file) throw new Error(`Proposal history not found: ${proposalId}`);
    return buildProposalReview(parseTaskChangeProposal(await this.app.vault.read(file)));
  }

  async save(proposal: TaskChangeProposal): Promise<void> {
    parseTaskChangeProposal(JSON.stringify(proposal));
    await this.ensureFolder(this.folder());
    const path = normalizePath(`${this.folder()}/${proposal.id}.json`);
    const content = `${JSON.stringify(proposal, null, 2)}\n`;
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) await this.app.vault.modify(existing, content);
    else await this.app.vault.create(path, content);
  }

  async apply(proposalId: string, approvedChangeIds: string[], now = new Date().toISOString()): Promise<ProposalDecisionResult> {
    if (approvedChangeIds.length === 0) throw new Error("Select at least one change or reject the Proposal");
    const proposal = await this.load(proposalId);
    const current = new Map<string, string>();
    for (const item of proposal.tasks) {
      const source = await this.tasks.readReviewedTask(item.taskId, item.path);
      if (source.status === "ready") current.set(item.taskId, source.content);
    }
    const followUpProposalId = `${proposal.id}-follow-up-${now.replace(/\D/g, "").slice(0, 14)}`;
    const result = await applyProposalDecision(proposal, approvedChangeIds, current, {
      decidedAt: now,
      followUpProposalId
    });

    const writeFailures: Array<{ taskId: string; changeIds: string[]; error: string }> = [];
    const actuallySucceeded: string[] = [];
    for (const write of result.writes) {
      const proposalTask = proposal.tasks.find((item) => item.taskId === write.taskId);
      if (!proposalTask) continue;
      const saved = await this.tasks.writeReviewedTask(write.taskId, write.path, proposalTask.beforeMarkdown, write.markdown);
      if (saved.status !== "saved") {
        writeFailures.push({ taskId: write.taskId, changeIds: write.changeIds, error: saved.status });
      } else actuallySucceeded.push(...write.changeIds);
    }

    let finalResult = result;
    if (writeFailures.length > 0) {
      const failedTaskIds = new Set(writeFailures.map((failure) => failure.taskId));
      const retainedFollowUpTasks = result.followUp?.tasks.filter((task) => !failedTaskIds.has(task.taskId)) ?? [];
      const regeneratedTasks = (await Promise.all(
        writeFailures.map((failure) => this.regenerateWriteFailure(proposal, failure.taskId, now, followUpProposalId))
      )).filter((task): task is ProposalTask => task !== null);
      const followUpTasks = reindexChanges([...retainedFollowUpTasks, ...regeneratedTasks]);
      const retainedFollowUp = followUpTasks.length > 0
        ? {
            ...(result.followUp ?? {
              schemaVersion: proposal.schemaVersion,
              id: followUpProposalId,
              status: "pending" as const,
              createdAt: now,
              originProposalId: proposal.id
            }),
            tasks: followUpTasks
          }
        : null;
      finalResult = {
        ...result,
        status: actuallySucceeded.length ? "partially-applied" : "stale",
        followUp: retainedFollowUp,
        closedProposal: {
          ...result.closedProposal,
          status: actuallySucceeded.length ? "partially-applied" : "stale",
          result: result.closedProposal.result ? {
            ...result.closedProposal.result,
            succeededChangeIds: actuallySucceeded,
            failed: [...result.closedProposal.result.failed, ...writeFailures],
            followUpProposalId: retainedFollowUp?.id ?? null
          } : undefined
        }
      };
    }
    if (finalResult.followUp) await this.save(finalResult.followUp);
    await this.archive(finalResult.closedProposal);
    return finalResult;
  }

  async reject(proposalId: string, now = new Date().toISOString()): Promise<void> {
    const proposal = await this.load(proposalId);
    const changeIds = proposal.tasks.flatMap((task) => task.changes.map((change) => change.id));
    await this.archive({
      ...proposal,
      status: "rejected",
      decision: { decidedAt: now, approvedChangeIds: [], rejectedChangeIds: changeIds },
      result: { appliedAt: now, succeededChangeIds: [], failed: [], followUpProposalId: null }
    });
  }

  private async regenerateWriteFailure(
    proposal: TaskChangeProposal,
    taskId: string,
    now: string,
    followUpProposalId: string
  ): Promise<ProposalTask | null> {
    const proposalTask = proposal.tasks.find((task) => task.taskId === taskId);
    if (!proposalTask) return null;
    const source = await this.tasks.readReviewedTask(proposalTask.taskId, proposalTask.path);
    if (source.status !== "ready") return null;
    const regenerated = await applyProposalDecision(
      { ...proposal, tasks: [proposalTask] },
      proposalTask.changes.map((change) => change.id),
      new Map([[proposalTask.taskId, source.content]]),
      { decidedAt: now, followUpProposalId }
    );
    return regenerated.followUp?.tasks[0] ?? null;
  }

  private folder(): string {
    return normalizePath(this.proposalFolder().trim() || "TaskMate/Proposals");
  }

  private historyFolder(): string {
    return normalizePath(`${this.folder()}/History`);
  }

  private proposalFile(proposalId: string): TFile | null {
    if (!/^proposal-[A-Za-z0-9._-]+$/.test(proposalId)) throw new Error("Invalid Proposal id");
    const file = this.app.vault.getAbstractFileByPath(normalizePath(`${this.folder()}/${proposalId}.json`));
    return file instanceof TFile ? file : null;
  }

  private historyProposalFile(proposalId: string): TFile | null {
    if (!/^proposal-[A-Za-z0-9._-]+$/.test(proposalId)) throw new Error("Invalid Proposal id");
    const file = this.app.vault.getAbstractFileByPath(normalizePath(`${this.historyFolder()}/${proposalId}.json`));
    return file instanceof TFile ? file : null;
  }

  private async archive(proposal: TaskChangeProposal): Promise<void> {
    const source = this.proposalFile(proposal.id);
    if (!source) throw new Error(`Proposal not found: ${proposal.id}`);
    await this.app.vault.modify(source, `${JSON.stringify(proposal, null, 2)}\n`);
    await this.ensureFolder(this.historyFolder());
    await this.app.fileManager.renameFile(source, normalizePath(`${this.historyFolder()}/${proposal.id}.json`));
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

function reindexChanges(tasks: ProposalTask[]): ProposalTask[] {
  let index = 1;
  return tasks.map((task) => ({
    ...task,
    changes: task.changes.map((change) => ({ ...change, id: `C-${String(index++).padStart(2, "0")}` }))
  }));
}

function summarize(proposal: TaskChangeProposal): ProposalSummary {
  return {
    id: proposal.id,
    createdAt: proposal.createdAt,
    resultAt: proposal.result?.appliedAt,
    taskCount: proposal.tasks.length,
    changeCount: proposal.tasks.reduce((count, task) => count + task.changes.length, 0),
    status: proposal.status,
    succeededCount: proposal.result?.succeededChangeIds.length ?? 0,
    failedCount: proposal.result?.failed.reduce((count, failure) => count + failure.changeIds.length, 0) ?? 0,
    followUpProposalId: proposal.result?.followUpProposalId ?? null
  };
}
