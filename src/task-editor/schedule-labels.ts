import type { Translate } from "../i18n";
import type { RepeatRule } from "../tasks/schedule";

const SINGLE_REPEAT_KEYS = { day: "repeat.daily", week: "repeat.weekly", month: "repeat.monthly", year: "repeat.yearly" } as const;
const INTERVAL_REPEAT_KEYS = { day: "repeat.day", week: "repeat.week", month: "repeat.month", year: "repeat.year" } as const;

export function repeatLabel(t: Translate, rule: RepeatRule | null): string {
  if (!rule) return t("repeat.none");
  if (rule.interval === 1) return t(SINGLE_REPEAT_KEYS[rule.unit]);
  return t(INTERVAL_REPEAT_KEYS[rule.unit], { count: rule.interval });
}
