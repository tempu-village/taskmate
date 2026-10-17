import { addDays, todayKey } from "./domain";

export interface DateSuggestion {
  id: "today" | "tomorrow" | "seven-days" | "none";
  date: string | null;
}

export function taskDateSuggestions(today = todayKey()): DateSuggestion[] {
  return [
    { id: "today", date: today },
    { id: "tomorrow", date: addDays(today, 1) },
    { id: "seven-days", date: addDays(today, 7) },
    { id: "none", date: null }
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

export function filterLabelSuggestions(
  labels: Iterable<string>,
  history: Iterable<string>,
  query: string,
  selected: Iterable<string>,
  limit = 10
): string[] {
  const available = normalizeLabels(labels);
  const selectedSet = new Set(normalizeLabels(selected));
  const needle = query.trim().toLocaleLowerCase();
  const candidates = needle
    ? available.filter((label) => label.toLocaleLowerCase().includes(needle))
    : recentLabelSuggestions(history).filter((label) => available.includes(label));
  return candidates.filter((label) => !selectedSet.has(label)).slice(0, limit);
}

export function recordRecentLabels(history: Iterable<string>, savedLabels: Iterable<string>, limit = 10): string[] {
  const used = normalizeLabels(savedLabels);
  if (used.length === 0) return recentLabelSuggestions(history, limit);
  return normalizeLabels([...used, ...history]).slice(0, limit);
}
