import { normalizeLabels } from "./label-suggestions";

export interface LabelChipInputState {
  labels: string[];
  pending: string;
}

export function updateLabelChipInput(
  currentLabels: Iterable<string>,
  value: string,
  commitPending: boolean,
  limit = 500
): LabelChipInputState {
  const parts = value.split(",");
  const committed = commitPending ? parts : parts.slice(0, -1);
  const pending = commitPending ? "" : (parts.at(-1) ?? "").trimStart();
  return {
    labels: normalizeLabels([...currentLabels, ...committed]).slice(0, Math.max(0, limit)),
    pending
  };
}

// keyCode 229 marks Safari's IME-confirming Enter, which arrives after compositionend with isComposing false (ADR 0030).
export function shouldCommitLabelOnEnter(key: string, composing: boolean, keyCode = 0): boolean {
  return key === "Enter" && !composing && keyCode !== 229;
}
