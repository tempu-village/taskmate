import type { Task } from "./domain";
import { reminderInstant, reminderKey } from "./schedule";

// A reminder found within this window after its moment is delivered as due; anything older was missed
// while TaskMate was not running and is reported once as missed instead.
export const REMINDER_DELIVERY_WINDOW_MS = 2 * 60_000;
// Delivered keys older than this are forgotten so per-device state stays small.
const DELIVERED_RETENTION_MS = 45 * 86_400_000;

export interface DueReminder {
  key: string;
  task: Task;
  at: Date;
}

export interface ReminderEvaluation {
  due: DueReminder[];
  missed: DueReminder[];
  /** The delivered-key record to persist after this evaluation. */
  delivered: Record<string, number>;
}

/**
 * Finds reminders that became due since they were last delivered on this device. Every returned
 * reminder is recorded in `delivered`, so persisting it prevents a second delivery on this device.
 */
export function evaluateReminders(tasks: Task[], delivered: Record<string, number>, now: Date): ReminderEvaluation {
  const nowMs = now.getTime();
  const next: Record<string, number> = {};
  for (const [key, at] of Object.entries(delivered)) {
    if (nowMs - at < DELIVERED_RETENTION_MS) next[key] = at;
  }
  const due: DueReminder[] = [];
  const missed: DueReminder[] = [];
  for (const task of tasks) {
    if (task.completed) continue;
    const key = reminderKey(task);
    const at = reminderInstant(task);
    if (!key || !at || Number.isNaN(at.getTime()) || at.getTime() > nowMs || key in next) continue;
    next[key] = at.getTime();
    // A reminder whose moment had already passed when the Task was last saved was never pending.
    if (at.getTime() < Date.parse(task.updatedAt)) continue;
    (nowMs - at.getTime() <= REMINDER_DELIVERY_WINDOW_MS ? due : missed).push({ key, task, at });
  }
  const byTime = (a: DueReminder, b: DueReminder) => a.at.getTime() - b.at.getTime();
  return { due: due.sort(byTime), missed: missed.sort(byTime), delivered: next };
}
