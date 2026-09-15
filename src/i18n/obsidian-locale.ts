import { getLanguage } from "obsidian";

export function detectObsidianLanguage(): string | undefined {
  try {
    return typeof getLanguage === "function" ? getLanguage() : undefined;
  } catch {
    return undefined;
  }
}
