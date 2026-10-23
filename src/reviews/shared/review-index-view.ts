import { ItemView, WorkspaceLeaf } from "obsidian";
import type { I18n } from "../../i18n";
import type TaskMatePlugin from "../../main";
import type { ReviewLocation } from "./review-catalog";
import { renderReviewIndex } from "./review-index";
import type { ReviewIndexCopy } from "./review-index";

export const REVIEW_INDEX_VIEW_TYPE = "taskmate-reviews";

// One Pending/History list for every review kind. The plugin decides which review view opens an entry.
export class ReviewIndexView extends ItemView {
  private location: ReviewLocation = "pending";

  constructor(leaf: WorkspaceLeaf, private readonly plugin: TaskMatePlugin) {
    super(leaf);
  }

  getViewType(): string { return REVIEW_INDEX_VIEW_TYPE; }
  getDisplayText(): string { return this.plugin.i18n().t("reviews.title"); }
  getIcon(): string { return "inbox"; }

  async onOpen(): Promise<void> { await this.render(); }

  requestRender(): void { void this.render(true); }

  async show(location: ReviewLocation): Promise<void> {
    this.location = location;
    await this.render();
  }

  private async render(preserveScroll = false): Promise<void> {
    const scrollTop = preserveScroll ? this.contentEl.scrollTop : 0;
    const items = await this.plugin.reviewIndex(this.location);
    renderReviewIndex(this.contentEl, items, this.location, reviewIndexCopy(this.plugin.i18n()), {
      open: (ref) => void this.plugin.openReview(ref, this.leaf),
      showLocation: (location) => void this.show(location)
    });
    this.contentEl.scrollTop = scrollTop;
  }
}

function reviewIndexCopy(i18n: I18n): ReviewIndexCopy {
  const { t } = i18n;
  return {
    title: t("reviews.title"),
    location: { pending: t("reviews.pending"), history: t("reviews.history") },
    empty: { pending: t("reviews.none"), history: t("reviews.historyNone") },
    kind: { "task-change": t("reviews.kind.taskChange"), "source-candidate": t("reviews.kind.sourceCandidate") },
    openAria: (kind, id) => t("reviews.openAria", { kind, id }),
    invalidTitle: t("reviews.invalidTitle"),
    invalidReason: {
      "unreadable-json": t("reviews.invalid.unreadableJson"),
      "unknown-type": t("reviews.invalid.unknownType"),
      "unsupported-version": t("reviews.invalid.unsupportedVersion"),
      "mismatched-id": t("reviews.invalid.mismatchedId"),
      "unreadable-review": t("reviews.invalid.unreadableReview")
    }
  };
}
