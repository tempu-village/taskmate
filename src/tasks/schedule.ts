import { addDays } from "./domain";
import type { Task } from "./domain";

export type RepeatUnit = "day" | "week" | "month" | "year";

export interface RepeatRule {
  interval: number;
  unit: RepeatUnit;
}

export const REMINDER_OFFSETS = [0, 5, 15, 30, 60, 1440] as const;
export type ReminderOffset = (typeof REMINDER_OFFSETS)[number];

export const MAXIMUM_REPEAT_INTERVAL = 99;

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const REPEAT = /^every ([1-9]\d?) (day|week|month|year)s?$/;
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
  const normalized = value.trim().toLowerCase();
  const alias = REPEAT_ALIASES[normalized];
  if (alias) return { ...alias };
  const match = normalized.match(REPEAT);
  if (!match) return null;
  return { interval: Number(match[1]), unit: match[2] as RepeatUnit };
}

export function formatRepeat(rule: RepeatRule | null): string | null {
  if (!rule) return null;
  if (rule.interval === 1) return { day: "daily", week: "weekly", month: "monthly", year: "yearly" }[rule.unit];
  return `every ${rule.interval} ${rule.unit}s`;
}

export function parseReminder(value: unknown): ReminderOffset | null {
  return typeof value === "number" && (REMINDER_OFFSETS as readonly number[]).includes(value) ? value as ReminderOffset : null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addMonths(dateKey: string, amount: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const index = year * 12 + (month - 1) + amount;
  const nextYear = Math.floor(index / 12);
  const nextMonth = index % 12 + 1;
  const nextDay = Math.min(day, daysInMonth(nextYear, nextMonth));
  return `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;
}

export function addRepeat(dateKey: string, rule: RepeatRule): string {
  switch (rule.unit) {
    case "day": return addDays(dateKey, rule.interval);
    case "week": return addDays(dateKey, rule.interval * 7);
    case "month": return addMonths(dateKey, rule.interval);
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

/** The local wall-clock instant of a dated, timed Task in the device's current time zone. */
export function scheduledInstant(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function reminderInstant(task: Pick<Task, "date" | "time" | "reminder">): Date | null {
  if (task.reminder === null || !task.date || !task.time || !DATE.test(task.date)) return null;
  return new Date(scheduledInstant(task.date, task.time).getTime() - task.reminder * 60_000);
}

/** A key that changes whenever the reminder would fire at a different moment for a different occurrence. */
export function reminderKey(task: Pick<Task, "id" | "date" | "time" | "reminder">): string | null {
  if (task.reminder === null || !task.date || !task.time) return null;
  return `${task.id}|${task.date}T${task.time}|${task.reminder}`;
}
