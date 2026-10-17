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
