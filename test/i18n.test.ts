import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { en } from "../src/i18n/en";
import { ja, jaTranslationStatus } from "../src/i18n/ja";
import {
  assertCatalogIntegrity,
  compareDisplayText,
  createI18n,
  isLanguagePreference,
  messagePlaceholders,
  desktopLanguageToRecord,
  resolveLocale,
  selectLocalizedMessage
} from "../src/i18n";

describe("translation catalogs", () => {
  it("keeps exact keys, non-empty English, and matching placeholders", () => {
    expect(jaTranslationStatus).toBe("ai-translated");
    expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
    expect(() => assertCatalogIntegrity()).not.toThrow();
    for (const [key, message] of Object.entries(en)) {
      expect(message.trim(), key).not.toBe("");
      expect(messagePlaceholders(ja[key as keyof typeof ja]), key).toEqual(messagePlaceholders(message));
    }
  });

  it("falls back to English for a missing or blank localized message", () => {
    expect(selectLocalizedMessage("English", undefined)).toBe("English");
    expect(selectLocalizedMessage("English", "   ")).toBe("English");
    expect(() => selectLocalizedMessage(" ", "日本語")).toThrow();
  });

  it("interpolates complete messages without erasing missing values", () => {
    expect(createI18n("en", "ja-JP").t("projects.taskCount", { count: 3 })).toBe("3 tasks");
    expect(createI18n("ja", "en-US").t("projects.taskCount", { count: 3 })).toBe("3件");
    const dynamicTranslate = createI18n("en", "en").t as (key: "projects.taskCount", values?: Record<string, string | number>) => string;
    expect(() => dynamicTranslate("projects.taskCount")).toThrow("Missing translation value: count");
  });

  it("distinguishes automatic external preservation from reviewed conflict resolution", () => {
    const japanese = createI18n("ja", "ja-JP");
    expect(japanese.t("conflict.externalPreserved")).toContain("別の場所");
    expect(japanese.t("conflict.resolved")).toBe("選択した内容で競合を解決し、タスクを保存しました。");
  });
});

describe("locale resolution", () => {
  it("accepts only stable persisted language values", () => {
    expect(["auto", "en", "ja"].every(isLanguagePreference)).toBe(true);
    expect(isLanguagePreference("ja-JP")).toBe(false);
  });

  it("recognizes Japanese and English locale variants", () => {
    expect(resolveLocale("auto", "ja")).toBe("ja");
    expect(resolveLocale("auto", "ja-JP")).toBe("ja");
    expect(resolveLocale("auto", "en")).toBe("en");
    expect(resolveLocale("auto", "en-US")).toBe("en");
  });

  it("falls back to English and lets explicit settings override Auto", () => {
    expect(resolveLocale("auto", undefined)).toBe("en");
    expect(resolveLocale("auto", "fr-FR")).toBe("en");
    expect(resolveLocale("invalid", "ja-JP")).toBe("en");
    expect(resolveLocale("en", "ja-JP")).toBe("en");
    expect(resolveLocale("ja", "en-US")).toBe("ja");
  });

  it("records the desktop app's Auto language for Task Pilot only when it changes", () => {
    expect(desktopLanguageToRecord(undefined, true, "ja")).toBe("ja");
    expect(desktopLanguageToRecord("ja", true, "ja-JP")).toBeNull();
    expect(desktopLanguageToRecord("ja", true, "en")).toBe("en");
    expect(desktopLanguageToRecord("en", true, "fr")).toBeNull();
    expect(desktopLanguageToRecord("fr", true, "fr")).toBe("en");
    // The mobile app never records, so a phone in another language cannot overwrite the desktop's value.
    expect(desktopLanguageToRecord("ja", false, "en")).toBeNull();
    expect(desktopLanguageToRecord(undefined, false, "ja")).toBeNull();
  });

  it("uses the resolved locale for display-only comparisons", () => {
    expect(compareDisplayText("あ", "い", "ja")).toBe(new Intl.Collator("ja").compare("あ", "い"));
  });
});

describe("UI copy boundaries", () => {
  it("keeps Japanese user-facing copy in the Japanese catalog", () => {
    const files = ["tasks/domain.ts", "labels/label-manager-modal.ts", "labels/label-picker-modal.ts", "main.ts", "projects/project-modal.ts", "settings.ts", "task-editor/step-modal.ts", "tasks/date-suggestions.ts", "labels/label-suggestions.ts", "task-editor/task-modal.ts", "task-editor/task-editing-flow.ts", "task-list/view.ts", "reviews/source-candidate/review-view.ts", "reviews/source-candidate/review-renderer.ts"];
    for (const file of files) {
      const source = readFileSync(fileURLToPath(new URL(`../src/${file}`, import.meta.url)), "utf8");
      expect(source, file).not.toMatch(/[ぁ-んァ-ヶ一-龠]/);
    }
  });

  it("rejects new literal copy at known rendering seams", () => {
    const files = ["labels/label-manager-modal.ts", "labels/label-picker-modal.ts", "main.ts", "projects/project-modal.ts", "settings.ts", "task-editor/step-modal.ts", "task-editor/task-modal.ts", "task-editor/task-editing-flow.ts", "task-list/view.ts", "reviews/source-candidate/review-view.ts", "reviews/source-candidate/review-renderer.ts"];
    const allowedText = new Set(["TaskMate", "⠿", "•••", "‹", "✓"]);
    for (const file of files) {
      const source = readFileSync(fileURLToPath(new URL(`../src/${file}`, import.meta.url)), "utf8");
      const literalText = [...source.matchAll(/text:\s*"([^"]*)"/g)].map((match) => match[1]);
      expect(literalText.filter((text) => !allowedText.has(text)), file).toEqual([]);
      expect(source, file).not.toMatch(/\.(?:setName|setDesc|setTitle|setPlaceholder)\(\s*["']/);
      expect(source, file).not.toMatch(/new Notice\(\s*["']/);
    }
  });
});
