import { describe, expect, it } from "vitest";
import { candidateEditForm, candidateEditFromForm, saveCandidateEdit } from "../../../src/reviews/source-candidate/candidate-edit-form";
import type { CandidateEditForm } from "../../../src/reviews/source-candidate/candidate-edit-form";
import { decideCandidate, editCandidate, parseSourceCandidateProposal, recordApplication } from "../../../src/reviews/source-candidate/proposal";
import type { CandidateEdit, SourceCandidate, SourceCandidateProposal } from "../../../src/reviews/source-candidate/proposal";
import { NOW, exampleText } from "./fixture";

const EDITED = "TaskMateで編集";
const STAGED_REASON = "会話で明示されたデモ準備の次の行動を同じ完了条件へ統合する";
const example = () => parseSourceCandidateProposal(exampleText());
const candidate = (review: SourceCandidateProposal, id: string): SourceCandidate => review.candidates.find((item) => item.id === id)!;

function edited(review: SourceCandidateProposal, id: string, change: (form: CandidateEditForm) => void): CandidateEdit {
  const form = candidateEditForm(candidate(review, id));
  change(form);
  const result = candidateEditFromForm(candidate(review, id), form, EDITED);
  if (result.kind !== "edit") throw new Error(`expected an edit, got ${JSON.stringify(result)}`);
  return result.edit;
}

// Saving the edit must leave a Proposal that still passes full validation.
function saved(review: SourceCandidateProposal, id: string, edit: CandidateEdit): SourceCandidate {
  const next = parseSourceCandidateProposal(JSON.stringify(editCandidate(review, id, edit, NOW)));
  return candidate(next, id);
}

describe("Source candidate edit form", () => {
  it("starts from the staged draft, the merge result or the exclusion reason", () => {
    const review = example();

    expect(candidateEditForm(candidate(review, "SC-01"))).toEqual({
      operation: "create",
      draft: {
        title: "顧客Aへ修正版の契約書を送る", date: "2026-10-17", priority: "2", labels: "context/pc", project: "",
        steps: "修正版PDFを最終確認する\n佐藤さんへメールで送る", notes: "顧客定例で合意した修正内容を反映した版を送る。"
      },
      merge: null, reason: "", exclusionReason: ""
    });
    const merge = candidateEditForm(candidate(review, "SC-02"));
    expect([merge.operation, merge.merge?.title, merge.merge?.steps, merge.draft.title]).toEqual([
      "merge", "明日のデモを準備する", "デモデータを準備する\n検索フィルターを確認する", "検索フィルター確認を既存デモ準備Taskへ統合する"
    ]);
    expect(candidateEditForm(candidate(review, "SC-03")).exclusionReason).toBe("候補日時であり、利用者が実行する独立した行動ではない");
  });

  it("treats an untouched form as no edit", () => {
    const review = example();
    for (const id of ["SC-01", "SC-02", "SC-03"]) {
      expect(candidateEditFromForm(candidate(review, id), candidateEditForm(candidate(review, id)), EDITED)).toEqual({ kind: "unchanged" });
    }
  });

  it("edits a create draft with normalized labels and Steps that keep their state", () => {
    const review = example();
    const draft = candidate(review, "SC-01").taskDraft!;
    draft.steps[1] = { text: "佐藤さんへメールで送る", completed: true, date: "2026-10-17" };

    const edit = edited(review, "SC-01", (form) => {
      form.draft.title = "  修正版の契約書を送る  ";
      form.draft.priority = "1";
      form.draft.labels = "#context/pc, home, context/pc, ";
      form.draft.steps = "佐藤さんへメールで送る\n\n送付後に電話する";
      form.draft.date = "";
    });

    expect(edit).toEqual({
      operation: "create",
      title: "修正版の契約書を送る",
      taskDraft: {
        title: "修正版の契約書を送る", date: null, priority: 1, labels: ["context/pc", "home"], project: null,
        steps: [{ text: "佐藤さんへメールで送る", completed: true, date: "2026-10-17" }, { text: "送付後に電話する", completed: false, date: null }],
        notes: "顧客定例で合意した修正内容を反映した版を送る。"
      }
    });
    expect(saved(review, "SC-01", edit)).toMatchObject({ title: "修正版の契約書を送る", revision: candidate(review, "SC-01").revision + 1, decision: "pending" });
  });

  it("reports missing and invalid values per field", () => {
    const review = example();
    const errors = (id: string, change: (form: CandidateEditForm) => void) => {
      const form = candidateEditForm(candidate(review, id));
      change(form);
      return candidateEditFromForm(candidate(review, id), form, EDITED);
    };

    expect(errors("SC-01", (form) => { form.draft.title = " "; form.draft.date = "2026-02-30"; }))
      .toEqual({ kind: "invalid", errors: { title: "required", date: "invalid-date" } });
    expect(errors("SC-01", (form) => { form.operation = "exclude"; })).toEqual({ kind: "invalid", errors: { exclusionReason: "required" } });
    expect(errors("SC-02", (form) => { form.merge!.steps = "デモデータを準備する"; })).toEqual({ kind: "invalid", errors: { form: "no-change" } });
  });

  it("switches between create and exclude", () => {
    const review = example();

    const exclude = edited(review, "SC-01", (form) => { form.operation = "exclude"; form.exclusionReason = " 既に送付済み "; });
    expect(exclude).toEqual({ operation: "exclude", exclusionReason: "既に送付済み" });
    expect(saved(review, "SC-01", exclude)).toMatchObject({ operation: "exclude", exclusionReason: "既に送付済み" });

    const create = edited(review, "SC-03", (form) => { form.operation = "create"; });
    expect(create).toMatchObject({ operation: "create", title: "次回会議の候補時間はTask化しない", taskDraft: { date: null, labels: [], steps: [] } });
    expect(saved(review, "SC-03", create).operation).toBe("create");
  });

  it("edits merge fields with an optional reason and keeps the staged reason of unchanged fields", () => {
    const review = example();

    const edit = edited(review, "SC-02", (form) => { form.merge!.date = "2026-10-20"; form.reason = " 会議が延期された "; });
    expect(edit).toEqual({ operation: "merge", values: { date: "2026-10-20" }, reason: "会議が延期された" });
    expect(saved(review, "SC-02", edit).mergeTarget!.changes.map((change) => [change.field, change.reason])).toEqual([
      ["date", "会議が延期された"], ["steps", STAGED_REASON]
    ]);

    const withoutReason = edited(review, "SC-02", (form) => { form.merge!.date = "2026-10-20"; });
    expect(withoutReason).toEqual({ operation: "merge", values: { date: "2026-10-20" }, reason: EDITED });
    expect(saved(review, "SC-02", withoutReason).mergeTarget!.changes.map((change) => [change.field, change.reason])).toEqual([
      ["date", EDITED], ["steps", STAGED_REASON]
    ]);
  });

  it("switches a merge to create and back and keeps the staged reasons", () => {
    const review = example();
    const asCreate = parseSourceCandidateProposal(JSON.stringify(editCandidate(review, "SC-02", edited(review, "SC-02", (form) => { form.operation = "create"; }), NOW)));

    const form = candidateEditForm(candidate(asCreate, "SC-02"));
    expect([form.operation, form.merge?.title]).toEqual(["create", "明日のデモを準備する"]);
    const back = edited(asCreate, "SC-02", (value) => { value.operation = "merge"; });
    expect(back).toEqual({ operation: "merge", values: {}, reason: EDITED });
    const merged = saved(asCreate, "SC-02", back);
    expect(merged).toMatchObject({ operation: "merge", revision: candidate(review, "SC-02").revision + 2 });
    expect(merged.mergeTarget!.changes.map((change) => change.reason)).toEqual([STAGED_REASON]);
  });

  it("saves against the latest review and refuses a candidate that changed meanwhile", () => {
    const review = example();
    const sc01 = candidate(review, "SC-01");
    const form = candidateEditForm(sc01);
    form.draft.title = "修正版の契約書を送る";
    const editing = { candidateId: "SC-01", revision: sc01.revision, form };

    const result = saveCandidateEdit(review, editing, NOW, EDITED);
    expect(result.kind).toBe("saved");
    if (result.kind === "saved") expect(candidate(result.review, "SC-01")).toMatchObject({ title: "修正版の契約書を送る", decision: "pending" });
    expect(saveCandidateEdit(review, { ...editing, form: candidateEditForm(sc01) }, NOW, EDITED)).toEqual({ kind: "unchanged" });
    expect(saveCandidateEdit(review, { ...editing, form: { ...form, draft: { ...form.draft, title: "" } } }, NOW, EDITED)).toEqual({ kind: "invalid", errors: { title: "required" } });

    const editedElsewhere = editCandidate(review, "SC-01", { operation: "exclude", exclusionReason: "x" }, NOW);
    expect(saveCandidateEdit(editedElsewhere, editing, NOW, EDITED)).toEqual({ kind: "conflict" });
    const decided = decideCandidate(review, "SC-01", "approved", NOW);
    expect(saveCandidateEdit(decided, editing, NOW, EDITED).kind).toBe("saved");
    const applied = recordApplication(review, "SC-01", { kind: "applied", promotedTaskId: "55555555-5555-4555-8555-555555555555" }, NOW);
    expect(saveCandidateEdit(applied, editing, NOW, EDITED)).toEqual({ kind: "conflict" });
  });
});
