import { addDays } from "./domain";
import type { Task } from "./domain";

export type RepeatUnit = "day" | "week" | "month" | "year";

export interface RepeatRule {
  interval: number;
  unit: RepeatUnit;
  /**
   * For monthly rules, the day each occurrence lands on: a day of month, or the month's last day.
   * Recording it in the rule keeps a 30th on the 30th after February instead of drifting from a
   * clamped date. A rule without it repeats the current date's day.
   */
  monthDay?: number | "last";
}


export const MAXIMUM_REPEAT_INTERVAL = 99;

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const REPEAT = /^every ([1-9]\d?) (day|week|month|year)s?$/;
const MONTH_DAY = /^(.*) on (?:day ([1-9]|[12]\d|3[01])|(last) day)$/;
const REPEAT_ALIASES: Record<string, RepeatRule> = {
  daily: { interval: 1, unit: "day" },
  weekly: { interval: 1, unit: "week" },
  monthly: { interval: 1, unit: "month" },
  yearly: { interval: 1, unit: "year" }
};

export function parseTime(value: unknown): string | null {
  return typeof value === "string" && TIME.test(value) ? value : null;
}

export function parseRepeat(value: unknown): RepeatRule | null {
  if (typeof value !== "string") return null;
  let normalized = value.trim().toLowerCase();
  const monthDayMatch = normalized.match(MONTH_DAY);
  if (monthDayMatch) normalized = monthDayMatch[1];
  const alias = REPEAT_ALIASES[normalized];
  const match = alias ? null : normalized.match(REPEAT);
  const rule: RepeatRule | null = alias ? { ...alias } : match ? { interval: Number(match[1]), unit: match[2] as RepeatUnit } : null;
  if (!rule || !monthDayMatch) return rule;
  if (rule.unit !== "month") return null;
  return { ...rule, monthDay: monthDayMatch[3] ? "last" : Number(monthDayMatch[2]) };
}

export function formatRepeat(rule: RepeatRule | null): string | null {
  if (!rule) return null;
  const base = rule.interval === 1
    ? { day: "daily", week: "weekly", month: "monthly", year: "yearly" }[rule.unit]
    : `every ${rule.interval} ${rule.unit}s`;
  if (rule.unit !== "month" || rule.monthDay === undefined) return base;
  return `${base} on ${rule.monthDay === "last" ? "last day" : `day ${rule.monthDay}`}`;
}

/** Records the day a monthly rule repeats on, taken from the scheduled date when the rule has none. */
export function anchorRepeat(rule: RepeatRule | null, dateKey: string | null): RepeatRule | null {
  if (!rule || rule.unit !== "month" || rule.monthDay !== undefined || !dateKey || !DATE.test(dateKey)) return rule;
  return { ...rule, monthDay: Number(dateKey.slice(8)) };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// The day comes from the rule when it records one; a month shorter than that day uses its last day.
function addMonths(dateKey: string, amount: number, monthDay?: number | "last"): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const index = year * 12 + (month - 1) + amount;
  const nextYear = Math.floor(index / 12);
  const nextMonth = index % 12 + 1;
  const lastDay = daysInMonth(nextYear, nextMonth);
  const nextDay = monthDay === "last" ? lastDay : Math.min(monthDay ?? day, lastDay);
  return `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;
}

export function addRepeat(dateKey: string, rule: RepeatRule): string {
  switch (rule.unit) {
    case "day": return addDays(dateKey, rule.interval);
    case "week": return addDays(dateKey, rule.interval * 7);
    case "month": return addMonths(dateKey, rule.interval, rule.monthDay);
    case "year": return addMonths(dateKey, rule.interval * 12);
  }
}

function dayNumber(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function shiftDate(dateKey: string, from: string, to: string): string {
  return addDays(dateKey, dayNumber(to) - dayNumber(from));
}

/**
 * Returns the Task fields that replace a completed occurrence of a recurring Task,
 * or null when the Task does not recur. The next occurrence keeps every other field.
 */
export function nextOccurrence(task: Pick<Task, "date" | "deadline" | "repeat" | "steps">): Pick<Task, "date" | "deadline" | "steps"> | null {
  if (!task.repeat || !task.date || !DATE.test(task.date)) return null;
  const date = addRepeat(task.date, task.repeat);
  return {
    date,
    deadline: task.deadline && DATE.test(task.deadline) ? shiftDate(task.deadline, task.date, date) : task.deadline,
    steps: task.steps.map((step) => ({ ...step, completed: false }))
  };
}
