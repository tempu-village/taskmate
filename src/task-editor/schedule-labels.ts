import type { Translate } from "../i18n";
import type { ReminderOffset, RepeatRule } from "../tasks/schedule";

const SINGLE_REPEAT_KEYS = { day: "repeat.daily", week: "repeat.weekly", month: "repeat.monthly", year: "repeat.yearly" } as const;
const INTERVAL_REPEAT_KEYS = { day: "repeat.day", week: "repeat.week", month: "repeat.month", year: "repeat.year" } as const;

export function repeatLabel(t: Translate, rule: RepeatRule | null): string {
  if (!rule) return t("repeat.none");
  if (rule.interval === 1) return t(SINGLE_REPEAT_KEYS[rule.unit]);
  return t(INTERVAL_REPEAT_KEYS[rule.unit], { count: rule.interval });
}

export function reminderLabel(t: Translate, offset: ReminderOffset | null): string {
  if (offset === null) return t("reminder.none");
  if (offset === 0) return t("reminder.atTime");
  if (offset === 60) return t("reminder.hourBefore");
  if (offset === 1440) return t("reminder.dayBefore");
  return t("reminder.minutesBefore", { count: offset });
}
