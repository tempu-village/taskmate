import { editCandidate, mergeTargetFields } from "./proposal";
import type { CandidateEdit, CandidateTaskDraft, ImportCandidate, ImportReview } from "./proposal";

type Operation = ImportCandidate["operation"];
type TaskField = keyof CandidateTaskDraft;

const TASK_FIELDS: readonly TaskField[] = ["title", "date", "priority", "labels", "project", "steps", "notes"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Text values of the Task fields as the user edits them.
export type CandidateFieldsForm = Record<TaskField, string>;

export interface CandidateEditForm {
  operation: Operation;
  draft: CandidateFieldsForm;
  // Fields of the merge target after the merge; null when Task Pilot staged no merge evidence.
  merge: CandidateFieldsForm | null;
  reason: string;
  exclusionReason: string;
}

export type CandidateEditField = TaskField | "reason" | "exclusionReason";
export type CandidateEditError = "required" | "invalid-date" | "no-change";
export type CandidateEditErrors = Partial<Record<CandidateEditField | "form", CandidateEditError>>;

export type CandidateEditResult =
  | { kind: "edit"; edit: CandidateEdit }
  | { kind: "unchanged" }
  | { kind: "invalid"; errors: CandidateEditErrors };

export type CandidateEditSave =
  | { kind: "saved"; review: ImportReview }
  | { kind: "unchanged" }
  | { kind: "invalid"; errors: CandidateEditErrors }
  | { kind: "conflict" };

// Field order in the form, used to focus the first invalid field.
export const CANDIDATE_EDIT_FIELDS: readonly CandidateEditField[] = [...TASK_FIELDS, "reason", "exclusionReason"];

export function candidateEditForm(candidate: ImportCandidate): CandidateEditForm {
  const merge = mergeTargetFields(candidate);
  return {
    operation: candidate.operation,
    draft: fieldsForm(candidate.taskDraft ?? emptyDraft(candidate.title)),
    merge: merge ? fieldsForm(merge.after) : null,
    reason: "",
    exclusionReason: candidate.exclusionReason ?? ""
  };
}

// `editedReason` is recorded for changed merge fields when the user gives no reason of their own.
export function candidateEditFromForm(candidate: ImportCandidate, form: CandidateEditForm, editedReason: string): CandidateEditResult {
  if (form.operation === "exclude") {
    const exclusionReason = form.exclusionReason.trim();
    if (!exclusionReason) return { kind: "invalid", errors: { exclusionReason: "required" } };
    if (candidate.operation === "exclude" && exclusionReason === candidate.exclusionReason) return { kind: "unchanged" };
    return { kind: "edit", edit: { operation: "exclude", exclusionReason } };
  }

  if (form.operation === "create") {
    const previous = candidate.taskDraft ?? emptyDraft(candidate.title);
    const parsed = parseFields(form.draft, previous.steps);
    if ("errors" in parsed) return { kind: "invalid", errors: parsed.errors };
    if (candidate.operation === "create" && sameValue(parsed.draft, candidate.taskDraft)) return { kind: "unchanged" };
    return { kind: "edit", edit: { operation: "create", title: parsed.draft.title, taskDraft: parsed.draft } };
  }

  const target = mergeTargetFields(candidate);
  if (!target || !form.merge || !candidate.mergeTarget) throw new Error(`Candidate ${candidate.id} has no merge target evidence from Task Pilot`);
  const parsed = parseFields(form.merge, target.after.steps);
  if ("errors" in parsed) return { kind: "invalid", errors: parsed.errors };
  if (TASK_FIELDS.every((field) => sameValue(parsed.draft[field], target.before[field]))) return { kind: "invalid", errors: { form: "no-change" } };
  const values: Partial<CandidateTaskDraft> = {};
  for (const field of TASK_FIELDS) {
    if (!sameValue(parsed.draft[field], target.after[field])) Object.assign(values, { [field]: parsed.draft[field] });
  }
  if (Object.keys(values).length === 0 && candidate.operation === "merge") return { kind: "unchanged" };
  // The Domain keeps the staged reason of every field whose result did not change, so the reason applies only to edited fields.
  return { kind: "edit", edit: { operation: "merge", values, reason: form.reason.trim() || editedReason } };
}

// Applies a submitted form to the latest stored review. The form is refused if the candidate changed after editing began.
export function saveCandidateEdit(
  review: ImportReview,
  editing: { candidateId: string; revision: number; form: CandidateEditForm },
  now: string,
  editedReason: string
): CandidateEditSave {
  const candidate = review.candidates.find((item) => item.id === editing.candidateId);
  if (!candidate || candidate.revision !== editing.revision || candidate.application.status === "applied" || review.status === "history") return { kind: "conflict" };
  const result = candidateEditFromForm(candidate, editing.form, editedReason);
  if (result.kind !== "edit") return result;
  return { kind: "saved", review: editCandidate(review, candidate.id, result.edit, now) };
}

function fieldsForm(draft: CandidateTaskDraft): CandidateFieldsForm {
  return {
    title: draft.title,
    date: draft.date ?? "",
    priority: draft.priority === null ? "" : String(draft.priority),
    labels: draft.labels.join(", "),
    project: draft.project ?? "",
    steps: draft.steps.map((step) => step.text).join("\n"),
    notes: draft.notes
  };
}

function parseFields(form: CandidateFieldsForm, previousSteps: CandidateTaskDraft["steps"]): { draft: CandidateTaskDraft } | { errors: CandidateEditErrors } {
  const errors: CandidateEditErrors = {};
  const title = form.title.trim();
  if (!title) errors.title = "required";
  const date = form.date.trim();
  if (date && !validDate(date)) errors.date = "invalid-date";
  if (Object.keys(errors).length > 0) return { errors };
  const priority = form.priority === "1" ? 1 : form.priority === "2" ? 2 : form.priority === "3" ? 3 : null;
  return {
    draft: {
      title,
      date: date || null,
      priority,
      labels: labels(form.labels),
      project: form.project.trim() || null,
      steps: steps(form.steps, previousSteps),
      notes: form.notes
    }
  };
}

// Same rule as the Task editor: comma-separated, trimmed, without a leading # and without duplicates.
function labels(value: string): string[] {
  const result: string[] = [];
  for (const raw of value.split(",")) {
    const label = raw.trim().replace(/^#/, "");
    if (label && !result.includes(label)) result.push(label);
  }
  return result;
}

// One Step per line. A line that matches an earlier Step keeps that Step's completion and date.
function steps(value: string, previous: CandidateTaskDraft["steps"]): CandidateTaskDraft["steps"] {
  const unused = [...previous];
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((text) => {
    const index = unused.findIndex((step) => step.text === text);
    if (index < 0) return { text, completed: false, date: null };
    const [step] = unused.splice(index, 1);
    return { ...step };
  });
}

function validDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function emptyDraft(title: string): CandidateTaskDraft {
  return { title, date: null, priority: null, labels: [], project: null, steps: [], notes: "" };
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
