import { addDays, todayKey } from "./domain";

export interface DateSuggestion {
  id: "today" | "tomorrow" | "seven-days" | "none";
  label: string;
  date: string | null;
}

export function taskDateSuggestions(today = todayKey()): DateSuggestion[] {
  return [
    { id: "today", label: "今日", date: today },
    { id: "tomorrow", label: "明日", date: addDays(today, 1) },
    { id: "seven-days", label: "7日後", date: addDays(today, 7) },
    { id: "none", label: "日付なし", date: null }
  ];
}

export function normalizeLabels(labels: Iterable<string>): string[] {
  const result: string[] = [];
  for (const raw of labels) {
    const label = raw.trim().replace(/^#/, "");
    if (label && !result.includes(label)) result.push(label);
  }
  return result;
}

export function recentLabelSuggestions(history: Iterable<string>, limit = 10): string[] {
  return normalizeLabels(history).slice(0, limit);
}

export function recordRecentLabels(history: Iterable<string>, savedLabels: Iterable<string>, limit = 10): string[] {
  const used = normalizeLabels(savedLabels);
  if (used.length === 0) return recentLabelSuggestions(history, limit);
  return normalizeLabels([...used, ...history]).slice(0, limit);
}
