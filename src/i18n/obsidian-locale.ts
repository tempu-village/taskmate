import { getLanguage, Platform } from "obsidian";

export function detectObsidianLanguage(): string | undefined {
  try {
    return typeof getLanguage === "function" ? getLanguage() : undefined;
  } catch {
    return undefined;
  }
}

// The desktop app records Obsidian's language for Task Pilot; the mobile app does not.
export function isDesktopObsidian(): boolean {
  return Platform.isDesktopApp;
}
