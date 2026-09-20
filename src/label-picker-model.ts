import type { SupportedLocale } from "./i18n";
import { compareDisplayText } from "./i18n";
import { normalizeLabels } from "./task-input-suggestions";

export const FAVORITE_LABEL_LIMIT = 10;
export const RECENT_LABEL_LIMIT = 10;

export type LabelGroupId = `latin:${string}` | "japanese" | "other";

export interface LabelGroup {
  id: LabelGroupId;
  labels: string[];
}

export interface SuggestedLabels {
  favorites: string[];
  recent: string[];
}

export interface FavoriteToggleResult {
  favorites: string[];
  changed: boolean;
  atLimit: boolean;
}

function firstCharacter(label: string): string {
  return Array.from(label.trim())[0] ?? "";
}

function groupId(label: string): LabelGroupId {
  const first = firstCharacter(label);
  const latin = first.toLocaleUpperCase("en-US");
  if (/^[A-Z]$/.test(latin)) return `latin:${latin}`;
  if (/^[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]$/.test(first)) return "japanese";
  return "other";
}

function groupOrder(id: LabelGroupId): number {
  if (id.startsWith("latin:")) return id.charCodeAt(id.length - 1) - 65;
  if (id === "japanese") return 26;
  return 27;
}

export function buildLabelGroups(labels: Iterable<string>, query: string, locale: SupportedLocale): LabelGroup[] {
  const needle = query.trim().toLocaleLowerCase(locale);
  const grouped = new Map<LabelGroupId, string[]>();
  normalizeLabels(labels)
    .filter((label) => !needle || label.toLocaleLowerCase(locale).includes(needle))
    .forEach((label) => {
      const id = groupId(label);
      grouped.set(id, [...(grouped.get(id) ?? []), label]);
    });
  return [...grouped.entries()]
    .map(([id, items]) => ({ id, labels: items.sort((a, b) => compareDisplayText(a, b, locale)) }))
    .sort((a, b) => groupOrder(a.id) - groupOrder(b.id));
}

export function suggestedLabels(
  availableLabels: Iterable<string>,
  favoriteLabels: Iterable<string>,
  recentLabels: Iterable<string>
): SuggestedLabels {
  const available = new Set(normalizeLabels(availableLabels));
  const favorites = normalizeLabels(favoriteLabels)
    .filter((label) => available.has(label))
    .slice(0, FAVORITE_LABEL_LIMIT);
  const favoriteSet = new Set(favorites);
  const recent = normalizeLabels(recentLabels)
    .filter((label) => available.has(label) && !favoriteSet.has(label))
    .slice(0, RECENT_LABEL_LIMIT);
  return { favorites, recent };
}

export function toggleFavoriteLabel(
  favoriteLabels: Iterable<string>,
  label: string,
  limit = FAVORITE_LABEL_LIMIT
): FavoriteToggleResult {
  const normalized = normalizeLabels(favoriteLabels);
  if (normalized.includes(label)) {
    return { favorites: normalized.filter((item) => item !== label), changed: true, atLimit: false };
  }
  if (normalized.length >= limit) return { favorites: normalized, changed: false, atLimit: true };
  return { favorites: [label, ...normalized], changed: true, atLimit: false };
}
