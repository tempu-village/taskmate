export const COMPACT_LABEL_LIMIT = 3;

export interface LabelSummary {
  visible: string[];
  hidden: string[];
}

export function summarizeLabels(labels: readonly string[], limit = COMPACT_LABEL_LIMIT): LabelSummary {
  const safeLimit = Math.max(0, limit);
  return {
    visible: labels.slice(0, safeLimit),
    hidden: labels.slice(safeLimit)
  };
}

