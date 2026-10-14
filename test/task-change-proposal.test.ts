import { describe, expect, it } from "vitest";

import type { Task } from "../src/domain";
import { encodeTask } from "../src/markdown";
import { applyProposalDecision, buildProposalReview, sha256 } from "../src/task-change-proposal";
import type { TaskChangeProposal } from "../src/task-change-proposal";

function task(overrides: Partial<Task> = {}): Task {
  return {
    path: "TaskMate/Tasks/Example.md",
    id: "task-uuid",
    title: "Example",
    completed: false,
    date: "2026-10-10",
    priority: null,
    labels: ["brk", "keep"],
    projectId: null,
    rank: 1024,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    completedAt: null,
    sourceNote: null,
    steps: [],
    stepSectionRemainder: "",
    notes: "Original",
    ...overrides
  };
}

describe("Task change Proposal review", () => {
  it("derives semantic changes and raw hunks from the stored before/after Markdown", async () => {
    const before = encodeTask(task());
    const after = encodeTask(task({
      date: "2026-10-18",
      labels: ["context/break", "keep"],
      updatedAt: "2026-10-12T00:00:00.000Z"
    }));
    const proposal: TaskChangeProposal = {
      schemaVersion: 1,
      id: "proposal-001",
      status: "pending",
      createdAt: "2026-10-12T00:00:00.000Z",
      tasks: [{
        taskId: "task-uuid",
        path: "TaskMate/Tasks/Example.md",
        title: "Example",
        beforeMarkdown: before,
        afterMarkdown: after,
        beforeSha256: await sha256(before),
        changes: [
          { id: "C-01", field: "date", before: "2026-10-10", after: "2026-10-18", reason: "Reschedule" },
          { id: "C-02", field: "labels", before: ["brk", "keep"], after: ["context/break", "keep"], reason: "Normalize context" }
        ]
      }]
    };

    const review = await buildProposalReview(proposal);

    expect(review.proposalId).toBe("proposal-001");
    expect(review.tasks[0].changes.map((change) => change.id)).toEqual(["C-01", "C-02"]);
    expect(review.tasks[0].rawHunks.some((hunk) => hunk.lines.some((line) => line.includes("2026-10-18")))).toBe(true);
    expect(review.tasks[0].rawHunks.some((hunk) => hunk.lines.some((line) => line.includes("context/break")))).toBe(true);
  });

  it("rejects Proposal evidence when the stored original does not match its hash", async () => {
    const before = encodeTask(task());
    const proposal: TaskChangeProposal = {
      schemaVersion: 1,
      id: "proposal-001",
      status: "pending",
      createdAt: "2026-10-12T00:00:00.000Z",
      tasks: [{
        taskId: "task-uuid",
        path: "TaskMate/Tasks/Example.md",
        title: "Example",
        beforeMarkdown: before,
        afterMarkdown: encodeTask(task({ date: null })),
        beforeSha256: "0".repeat(64),
        changes: [{ id: "C-01", field: "date", before: "2026-10-10", after: null, reason: "Remove date" }]
      }]
    };

    await expect(buildProposalReview(proposal)).rejects.toThrow("beforeSha256");
  });

  it("rejects a hidden semantic change that has no ChangeSet entry", async () => {
    const before = encodeTask(task());
    const proposal: TaskChangeProposal = {
      schemaVersion: 1, id: "proposal-001", status: "pending", createdAt: "2026-10-12T00:00:00.000Z",
      tasks: [{ taskId: "task-uuid", path: "TaskMate/Tasks/Example.md", title: "Example",
        beforeMarkdown: before,
        afterMarkdown: encodeTask(task({ date: null, notes: "Hidden change", updatedAt: "2026-10-12T00:00:00.000Z" })),
        beforeSha256: await sha256(before),
        changes: [{ id: "C-01", field: "date", before: "2026-10-10", after: null, reason: "Remove date" }]
      }]
    };

    await expect(buildProposalReview(proposal)).rejects.toThrow("unrepresented semantic field");
  });

  it("applies only approved changes and gives a follow-up Proposal new change IDs with origin references", async () => {
    const before = encodeTask(task());
    const after = encodeTask(task({ date: "2026-10-18", notes: "Changed", updatedAt: "2026-10-12T00:00:00.000Z" }));
    const proposal: TaskChangeProposal = {
      schemaVersion: 1,
      id: "proposal-001",
      status: "pending",
      createdAt: "2026-10-12T00:00:00.000Z",
      tasks: [{
        taskId: "task-uuid",
        path: "TaskMate/Tasks/Example.md",
        title: "Example",
        beforeMarkdown: before,
        afterMarkdown: after,
        beforeSha256: await sha256(before),
        changes: [
          { id: "C-01", field: "date", before: "2026-10-10", after: "2026-10-18", reason: "Reschedule" },
          { id: "C-02", field: "notes", before: "Original", after: "Changed", reason: "Clarify" }
        ]
      }]
    };

    const result = await applyProposalDecision(proposal, ["C-01"], new Map([["task-uuid", before]]), {
      decidedAt: "2026-10-12T01:00:00.000Z",
      followUpProposalId: "proposal-002"
    });

    expect(result.status).toBe("partially-applied");
    expect(result.writes[0].markdown).toContain('date: "2026-10-18"');
    expect(result.writes[0].markdown).toContain("Original");
    expect(result.followUp?.tasks[0].changes).toEqual([expect.objectContaining({
      id: "C-01",
      field: "notes",
      origin: { proposalId: "proposal-001", changeId: "C-02" }
    })]);
    expect(result.closedProposal.result?.followUpProposalId).toBe("proposal-002");
  });

  it("does not produce a write when the canonical Task is stale", async () => {
    const before = encodeTask(task());
    const proposal: TaskChangeProposal = {
      schemaVersion: 1,
      id: "proposal-001",
      status: "pending",
      createdAt: "2026-10-12T00:00:00.000Z",
      tasks: [{
        taskId: "task-uuid",
        path: "TaskMate/Tasks/Example.md",
        title: "Example",
        beforeMarkdown: before,
        afterMarkdown: encodeTask(task({ date: null })),
        beforeSha256: await sha256(before),
        changes: [{ id: "C-01", field: "date", before: "2026-10-10", after: null, reason: "Remove date" }]
      }]
    };

    const result = await applyProposalDecision(
      proposal,
      ["C-01"],
      new Map([["task-uuid", `${before}\nexternal change`]]),
      { decidedAt: "2026-10-12T01:00:00.000Z", followUpProposalId: "proposal-002" }
    );

    expect(result.status).toBe("stale");
    expect(result.writes).toEqual([]);
    expect(result.closedProposal.result?.failed[0]).toEqual(expect.objectContaining({ taskId: "task-uuid" }));
  });

  it("keeps a valid Task's unapplied changes when another Task is stale", async () => {
    const first = task({ id: "task-first", path: "TaskMate/Tasks/First.md", title: "First" });
    const second = task({ id: "task-second", path: "TaskMate/Tasks/Second.md", title: "Second" });
    const firstBefore = encodeTask(first);
    const secondBefore = encodeTask(second);
    const proposal: TaskChangeProposal = {
      schemaVersion: 1,
      id: "proposal-001",
      status: "pending",
      createdAt: "2026-10-12T00:00:00.000Z",
      tasks: [
        {
          taskId: first.id,
          path: first.path,
          title: first.title,
          beforeMarkdown: firstBefore,
          afterMarkdown: encodeTask({ ...first, date: "2026-10-18", notes: "Later", updatedAt: "2026-10-12T00:00:00.000Z" }),
          beforeSha256: await sha256(firstBefore),
          changes: [
            { id: "C-01", field: "date", before: first.date, after: "2026-10-18", reason: "Reschedule" },
            { id: "C-02", field: "notes", before: first.notes, after: "Later", reason: "Defer notes" }
          ]
        },
        {
          taskId: second.id,
          path: second.path,
          title: second.title,
          beforeMarkdown: secondBefore,
          afterMarkdown: encodeTask({ ...second, priority: 1, updatedAt: "2026-10-12T00:00:00.000Z" }),
          beforeSha256: await sha256(secondBefore),
          changes: [{ id: "C-03", field: "priority", before: null, after: 1, reason: "Prioritize" }]
        }
      ]
    };

    const result = await applyProposalDecision(
      proposal,
      ["C-01", "C-03"],
      new Map([[first.id, firstBefore], [second.id, `${secondBefore}\nexternal change`]]),
      { decidedAt: "2026-10-12T01:00:00.000Z", followUpProposalId: "proposal-002" }
    );

    expect(result.status).toBe("partially-applied");
    expect(result.followUp?.tasks).toHaveLength(1);
    expect(result.followUp?.tasks[0]).toEqual(expect.objectContaining({ taskId: first.id }));
    expect(result.followUp?.tasks[0].changes).toEqual([
      expect.objectContaining({ field: "notes", origin: { proposalId: "proposal-001", changeId: "C-02" } })
    ]);
    expect(result.closedProposal.result?.failed).toEqual([
      expect.objectContaining({ taskId: second.id, changeIds: ["C-03"] })
    ]);
  });

  it("builds a synchronous review for 20 small Tasks within the initial guardrail", async () => {
    const tasks = await Promise.all(Array.from({ length: 20 }, async (_, index) => {
      const id = `task-${index}`;
      const path = `TaskMate/Tasks/Task ${index}.md`;
      const before = encodeTask(task({ id, path, title: `Task ${index}` }));
      const after = encodeTask(task({ id, path, title: `Task ${index}`, date: "2026-10-18", updatedAt: "2026-10-12T00:00:00.000Z" }));
      return { taskId: id, path, title: `Task ${index}`,
        beforeMarkdown: before, afterMarkdown: after, beforeSha256: await sha256(before),
        changes: [{ id: `C-${String(index + 1).padStart(2, "0")}`, field: "date" as const, before: "2026-10-10", after: "2026-10-18", reason: "Reschedule" }] };
    }));
    const started = performance.now();
    const review = await buildProposalReview({ schemaVersion: 1, id: "proposal-20", status: "pending", createdAt: "2026-10-12T00:00:00.000Z", tasks });
    const elapsed = performance.now() - started;

    expect(review.tasks).toHaveLength(20);
    expect(review.tasks.every((item) => item.rawHunks.length > 0)).toBe(true);
    expect(elapsed).toBeLessThan(1_000);
  });
});
