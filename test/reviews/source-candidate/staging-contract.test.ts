import Ajv2020 from "ajv/dist/2020";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { parseSourceCandidateProposal, planFormalApply, verifyMergeEvidence } from "../../../src/reviews/source-candidate/proposal";
import { schemaJson } from "./fixture";

const SCRIPTS = fileURLToPath(new URL("../../../skills/taskpilot/scripts/", import.meta.url));
const ajv = new Ajv2020({ allErrors: true });
ajv.addFormat("date-time", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
const validate = ajv.compile(schemaJson());
const vaults: string[] = [];

function python(vault: string, script: string, ...args: string[]): Record<string, any> {
  const result = spawnSync("python3", [join(SCRIPTS, script), "--vault", vault, ...args], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${script} ${args.join(" ")} failed: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

function stagedVault(): { vault: string; reviewPath: string; targetId: string } {
  const vault = mkdtempSync(join(tmpdir(), "taskmate-staging-"));
  vaults.push(vault);
  mkdirSync(join(vault, ".obsidian", "plugins", "taskmate"), { recursive: true });
  writeFileSync(join(vault, ".obsidian", "plugins", "taskmate", "data.json"), JSON.stringify({ sourceFolders: ["Notes"] }));
  mkdirSync(join(vault, "Notes"));
  writeFileSync(join(vault, "Notes", "日次.md"), "# 日次メモ\n\n- 佐藤さんへ契約書を送る。\n- デモの検索フィルターを確認する。\n- 次回会議は金曜午後が候補。\n");
  const target = python(vault, "todo_store.py", "create", "--title", "明日のデモを準備する", "--date", "2026-10-19", "--label", "context/pc",
    "--steps-json", JSON.stringify([{ text: "デモデータを準備する", completed: false, date: null }]));
  const inspected = python(vault, "planning_store.py", "inspect", "--today", "2026-10-18");
  const snapshot = inspected.tasks.find((task: { id: string }) => task.id === target.id).snapshot;
  const request = {
    sources: [
      { type: "note", path: "Notes/日次.md", statements: ["佐藤さんへ契約書を送る。", "デモの検索フィルターを確認する。", "次回会議は金曜午後が候補。"] },
      { type: "conversation", localSourceId: "conversation-01", snapshot: "リリース手順を確認する。", selectionInstruction: "この発言を含める", threadId: null, turnRefs: [], statements: ["リリース手順を確認する。"] }
    ],
    candidates: [
      { operation: "create", title: "契約書を送る", sourceRefs: [{ source: "Notes/日次.md", statement: "佐藤さんへ契約書を送る。" }],
        taskDraft: { title: "契約書を送る", date: "2026-10-18", priority: 2, labels: ["context/pc"], project: null, steps: [], notes: "" } },
      { operation: "merge", title: "検索フィルター確認を統合する", sourceRefs: [{ source: "Notes/日次.md", statement: "デモの検索フィルターを確認する。" }],
        mergeTarget: { taskId: target.id, snapshot, reason: "同じデモ準備の行動", changes: {
          steps: [{ text: "デモデータを準備する", completed: false, date: null }, { text: "検索フィルターを確認する", completed: false, date: null }],
          notes: "会議で追加された確認。" } } },
      { operation: "exclude", title: "会議日程は除外", sourceRefs: [{ source: "Notes/日次.md", statement: "次回会議は金曜午後が候補。" }], exclusionReason: "候補日時であり行動ではない" },
      { operation: "create", title: "リリース手順を確認する", sourceRefs: [{ source: "conversation-01", statement: "リリース手順を確認する。" }],
        taskDraft: { title: "リリース手順を確認する", date: null, priority: null, labels: [], project: null, steps: [], notes: "" } }
    ]
  };
  const requestPath = join(vault, "request.json");
  writeFileSync(requestPath, JSON.stringify(request));
  const staged = python(vault, "source_review.py", "stage", "--request", requestPath, "--review-id", "source-review-contract");
  return { vault, reviewPath: join(vault, staged.path), targetId: target.id };
}

afterEach(() => {
  for (const vault of vaults.splice(0)) rmSync(vault, { recursive: true, force: true });
});

describe("Task Pilot staging contract", () => {
  it("writes JSON that TaskMate's validator and the Draft 2020-12 Schema both accept", async () => {
    const { reviewPath, targetId } = stagedVault();
    const text = readFileSync(reviewPath, "utf8");

    expect(validate(JSON.parse(text)) ? "" : ajv.errorsText(validate.errors)).toBe("");
    const proposal = parseSourceCandidateProposal(text);
    expect([proposal.status, proposal.health, proposal.revision]).toEqual(["pending", "ok", 1]);
    expect(proposal.candidates.map((candidate) => candidate.operation)).toEqual(["create", "merge", "exclude", "create"]);
    const merge = proposal.candidates[1];
    if (merge.operation !== "merge") throw new Error("SC-02 must merge");
    expect(merge.mergeTarget.taskId).toBe(targetId);
    expect(merge.mergeTarget.changes.map((change) => change.field)).toEqual(["steps", "notes"]);
    await expect(verifyMergeEvidence(merge.mergeTarget)).resolves.toBeUndefined();
    expect(planFormalApply(proposal).blocked.map((item) => item.reason)).toEqual(["undecided", "undecided", "undecided", "undecided"]);
  });
});
