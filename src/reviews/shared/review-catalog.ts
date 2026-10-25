import { normalizePath } from "obsidian";
import type { App } from "obsidian";

export type ReviewKind = "task-change" | "import";
export type ReviewLocation = "pending" | "history";

export interface ReviewReference {
  kind: ReviewKind;
  id: string;
  location: ReviewLocation;
  path: string;
}

export type InvalidReviewReason = "unreadable-json" | "unknown-type" | "unsupported-version" | "mismatched-id";

export type ReviewCatalogEntry =
  | { type: "review"; ref: ReviewReference }
  | { type: "invalid"; path: string; location: ReviewLocation; reason: InvalidReviewReason };

const TASK_CHANGE_ID = /^proposal-[A-Za-z0-9._-]+$/;
const IMPORT_REVIEW_ID = /^import-review-[A-Za-z0-9._-]+$/;

// Classifies one review file from its envelope only. Complete parsing, validation and application stay in the owning
// review Module, so a file classified here can still be rejected by that Module.
export function classifyReviewFile(path: string, location: ReviewLocation, content: string): ReviewCatalogEntry {
  const invalid = (reason: InvalidReviewReason): ReviewCatalogEntry => ({ type: "invalid", path, location, reason });
  const review = (kind: ReviewKind, id: string): ReviewCatalogEntry => ({ type: "review", ref: { kind, id, location, path } });
  const name = path.slice(path.lastIndexOf("/") + 1).replace(/\.json$/, "");
  let envelope: unknown;
  try {
    envelope = JSON.parse(content);
  } catch {
    return invalid("unreadable-json");
  }
  if (typeof envelope !== "object" || envelope === null || Array.isArray(envelope)) return invalid("unreadable-json");
  const { reviewType, schemaVersion, reviewId, id } = envelope as Record<string, unknown>;

  if (reviewType === "import") {
    // Both the discriminator and the import-review-* name must agree, and the name must match the stored ID.
    if (!IMPORT_REVIEW_ID.test(name) || reviewId !== name) return invalid("mismatched-id");
    return schemaVersion === 1 ? review("import", name) : invalid("unsupported-version");
  }
  if (reviewType !== undefined) return invalid("unknown-type");
  // Task change schema version 1 has no reviewType; the proposal-* name is its compatibility discriminator.
  if (TASK_CHANGE_ID.test(name)) {
    if (id !== name) return invalid("mismatched-id");
    return schemaVersion === 1 ? review("task-change", name) : invalid("unsupported-version");
  }
  return invalid(IMPORT_REVIEW_ID.test(name) ? "mismatched-id" : "unknown-type");
}

// Lists the review files directly inside the Proposal folder (pending) or its History folder. It only reads files.
export class ReviewCatalog {
  constructor(private readonly app: App, private readonly proposalFolder: () => string) {}

  async list(location: ReviewLocation): Promise<ReviewCatalogEntry[]> {
    const prefix = `${location === "pending" ? this.folder() : this.historyFolder()}/`;
    const files = this.app.vault.getFiles().filter((file) => (
      file.extension === "json" && file.path.startsWith(prefix) && !file.path.slice(prefix.length).includes("/")
    ));
    const entries: ReviewCatalogEntry[] = [];
    for (const file of files) {
      const entry = classifyReviewFile(file.path, location, await this.app.vault.cachedRead(file));
      if (entry.type === "invalid") console.warn(`TaskMate could not classify review file ${entry.path}: ${entry.reason}`);
      entries.push(entry);
    }
    return entries;
  }

  private folder(): string {
    return normalizePath(this.proposalFolder().trim() || "TaskMate/Proposals");
  }

  private historyFolder(): string {
    return normalizePath(`${this.folder()}/History`);
  }
}
