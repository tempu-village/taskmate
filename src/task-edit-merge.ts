import type { Task, TaskDraft } from "./domain";

export const EDITABLE_TASK_FIELDS = [
  "title",
  "date",
  "priority",
  "labels",
  "projectId",
  "steps",
  "notes",
  "sourceNote"
] as const satisfies readonly (keyof TaskDraft)[];

export type EditableTaskField = (typeof EDITABLE_TASK_FIELDS)[number];
export type TaskConflictChoice = "current" | "draft";

export interface TaskFieldConflict {
  field: EditableTaskField;
  baseValue: Task[EditableTaskField];
  currentValue: Task[EditableTaskField];
  draftValue: Task[EditableTaskField];
}

export interface TaskEditComparison {
  merged: Task;
  conflicts: TaskFieldConflict[];
  externalChangesPreserved: boolean;
}

function cloneValue<Value>(value: Value): Value {
  if (Array.isArray(value)) return value.map((item) => typeof item === "object" && item !== null ? { ...item } : item) as Value;
  return value;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => valuesEqual(value, right[index]));
  }
  return left === right;
}

function draftValue<Field extends EditableTaskField>(draft: TaskDraft, base: Task, field: Field): Task[Field] {
  if (field === "sourceNote" && draft.sourceNote === undefined) return base.sourceNote as Task[Field];
  return draft[field] as Task[Field];
}

function assignEditableField<Field extends EditableTaskField>(task: Task, field: Field, value: Task[Field]): void {
  task[field] = cloneValue(value) as Task[Field];
}

export function compareTaskEdit(base: Task, draft: TaskDraft, current: Task): TaskEditComparison {
  const merged: Task = { ...current, labels: [...current.labels], steps: cloneValue(current.steps) };
  const conflicts: TaskFieldConflict[] = [];
  let externalChangesPreserved = false;

  for (const field of EDITABLE_TASK_FIELDS) {
    const baseValue = base[field];
    const nextDraftValue = draftValue(draft, base, field);
    const currentValue = current[field];
    const draftChanged = !valuesEqual(nextDraftValue, baseValue);
    const currentChanged = !valuesEqual(currentValue, baseValue);

    if (draftChanged && currentChanged && !valuesEqual(nextDraftValue, currentValue)) {
      conflicts.push({
        field,
        baseValue: cloneValue(baseValue),
        currentValue: cloneValue(currentValue),
        draftValue: cloneValue(nextDraftValue)
      });
      continue;
    }

    if (draftChanged) assignEditableField(merged, field, nextDraftValue);
    else if (currentChanged) externalChangesPreserved = true;
  }

  return { merged, conflicts, externalChangesPreserved };
}

export function applyTaskConflictChoices(
  comparison: TaskEditComparison,
  choices: Partial<Record<EditableTaskField, TaskConflictChoice>>
): Task {
  const resolved: Task = { ...comparison.merged, labels: [...comparison.merged.labels], steps: cloneValue(comparison.merged.steps) };
  for (const conflict of comparison.conflicts) {
    const choice = choices[conflict.field] ?? "current";
    assignEditableField(resolved, conflict.field, choice === "draft" ? conflict.draftValue : conflict.currentValue);
  }
  return resolved;
}
