import { Notice } from "obsidian";
import type { App } from "obsidian";
import type { Translate } from "../i18n";
import type { Task } from "../tasks/domain";
import { evaluateReminders } from "../tasks/reminders";

const DELIVERED_STORAGE_KEY = "taskmate-delivered-reminders";
const CHECK_INTERVAL_MS = 30_000;
const MISSED_TITLES_SHOWN = 3;

export type SystemNotificationState = "unavailable" | "default" | "granted" | "denied";

export function systemNotificationState(): SystemNotificationState {
  if (typeof window === "undefined" || typeof window.Notification !== "function") return "unavailable";
  return window.Notification.permission;
}

export async function requestSystemNotificationPermission(): Promise<SystemNotificationState> {
  if (systemNotificationState() === "unavailable") return "unavailable";
  try {
    return await window.Notification.requestPermission();
  } catch {
    return systemNotificationState();
  }
}

export interface ReminderNotifierOptions {
  app: App;
  loadTasks: () => Promise<Task[]>;
  translate: () => Translate;
  systemNotificationsEnabled: () => boolean;
  registerInterval: (id: number) => number;
  registerDomEvent: (target: Document, type: "visibilitychange", listener: () => void) => void;
}

/**
 * Delivers reminders on this device while Obsidian is running. It cannot run in the background:
 * reminders that came due while TaskMate was not running are reported together as missed.
 */
export class ReminderNotifier {
  private checking: Promise<void> | null = null;

  constructor(private readonly options: ReminderNotifierOptions) {}

  start(): void {
    this.options.registerInterval(window.setInterval(() => void this.check(), CHECK_INTERVAL_MS));
    this.options.registerDomEvent(document, "visibilitychange", () => {
      if (document.visibilityState === "visible") void this.check();
    });
    void this.check();
  }

  check(): Promise<void> {
    this.checking ??= this.run().finally(() => {
      this.checking = null;
    });
    return this.checking;
  }

  private async run(): Promise<void> {
    const tasks = await this.options.loadTasks();
    const stored: unknown = this.options.app.loadLocalStorage(DELIVERED_STORAGE_KEY);
    const delivered = stored && typeof stored === "object" ? stored as Record<string, number> : {};
    const result = evaluateReminders(tasks, delivered, new Date());
    // Record first so an exception while presenting cannot cause a second delivery.
    this.options.app.saveLocalStorage(DELIVERED_STORAGE_KEY, result.delivered);
    const t = this.options.translate();
    for (const reminder of result.due) {
      const message = t("reminder.due", { title: reminder.task.title, time: reminder.task.time ?? "" });
      new Notice(message, 0);
      this.showSystemNotification(message);
    }
    if (result.missed.length > 0) {
      const titles = result.missed.slice(0, MISSED_TITLES_SHOWN).map((reminder) => reminder.task.title);
      if (result.missed.length > MISSED_TITLES_SHOWN) titles.push("…");
      new Notice(t("reminder.missed", { count: result.missed.length, titles: titles.join(", ") }), 0);
    }
  }

  private showSystemNotification(message: string): void {
    if (!this.options.systemNotificationsEnabled() || systemNotificationState() !== "granted") return;
    try {
      new window.Notification("TaskMate", { body: message });
    } catch (error) {
      console.error("TaskMate could not show a system notification", error);
    }
  }
}
