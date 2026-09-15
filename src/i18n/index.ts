import { en } from "./en";
import { ja } from "./ja";

export type LanguagePreference = "auto" | "en" | "ja";
export type SupportedLocale = "en" | "ja";
export type TranslationKey = keyof typeof en;

type PlaceholderNames<Text extends string> = Text extends `${string}{${infer Name}}${infer Rest}`
  ? Name | PlaceholderNames<Rest>
  : never;
type TranslationValues<Key extends TranslationKey> = Record<PlaceholderNames<(typeof en)[Key]>, string | number>;
export type TranslationArgs<Key extends TranslationKey> = [PlaceholderNames<(typeof en)[Key]>] extends [never]
  ? []
  : [values: TranslationValues<Key>];
export type Translate = <Key extends TranslationKey>(key: Key, ...args: TranslationArgs<Key>) => string;

export interface I18n {
  locale: SupportedLocale;
  t: Translate;
}

const catalogs: Record<SupportedLocale, Record<TranslationKey, string>> = { en, ja };
const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

export function messagePlaceholders(message: string): string[] {
  return [...message.matchAll(PLACEHOLDER)].map((match) => match[1]).sort();
}

export function selectLocalizedMessage(english: string, localized?: string): string {
  if (!english.trim()) throw new Error("The canonical English translation must not be blank");
  return localized?.trim() ? localized : english;
}

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return value === "auto" || value === "en" || value === "ja";
}

export function resolveLocale(preference: LanguagePreference | string | undefined, detectedLanguage?: string): SupportedLocale {
  if (preference === "en" || preference === "ja") return preference;
  if (preference !== "auto") return "en";
  const normalized = detectedLanguage?.trim().toLowerCase().replace(/_/g, "-") ?? "";
  if (normalized === "ja" || normalized.startsWith("ja-")) return "ja";
  return "en";
}

export function compareDisplayText(a: string, b: string, locale: SupportedLocale): number {
  return new Intl.Collator(locale).compare(a, b);
}

function interpolate(message: string, values?: Record<string, string | number>): string {
  return message.replace(PLACEHOLDER, (_placeholder, name: string) => {
    if (!values || !(name in values)) throw new Error(`Missing translation value: ${name}`);
    return String(values[name]);
  });
}

export function createI18n(preference: LanguagePreference | string | undefined, detectedLanguage?: string): I18n {
  const locale = resolveLocale(preference, detectedLanguage);
  const t = (<Key extends TranslationKey>(key: Key, ...args: TranslationArgs<Key>): string => {
    const message = selectLocalizedMessage(en[key], catalogs[locale][key]);
    return interpolate(message, args[0] as Record<string, string | number> | undefined);
  }) as Translate;
  return { locale, t };
}

export function assertCatalogIntegrity(): void {
  const englishKeys = Object.keys(en).sort();
  const japaneseKeys = Object.keys(ja).sort();
  if (englishKeys.join("\n") !== japaneseKeys.join("\n")) throw new Error("Translation catalog keys do not match");
  for (const key of englishKeys as TranslationKey[]) {
    if (!en[key].trim()) throw new Error(`Blank canonical translation: ${key}`);
    if (messagePlaceholders(en[key]).join("\n") !== messagePlaceholders(ja[key]).join("\n")) {
      throw new Error(`Translation placeholders do not match: ${key}`);
    }
  }
}
