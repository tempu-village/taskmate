import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({
  ItemView: class {},
  Notice: class {}
}));

import { createI18n } from "../../../src/i18n";
import { formalApplyMessage, importReviewIdFromLink, importReviewIndexDetails } from "../../../src/reviews/import/review-view";
import type { FormalApplyResult } from "../../../src/reviews/import/review-repository";
import { parseImportReview } from "../../../src/reviews/import/proposal";
import { exampleText } from "./fixture";

function result(overrides: Partial<FormalApplyResult>): FormalApplyResult {
  return {
    review: parseImportReview(exampleText()),
    applied: [], failed: [], stale: [],
    provenance: { written: [], changed: [], failed: [] },
    archived: false,
    ...overrides
  };
}

describe("Import review view", () => {
  it("accepts only valid Import review links", () => {
    expect(importReviewIdFromLink({ review: "import-review-20261018-a" })).toBe("import-review-20261018-a");
    expect(importReviewIdFromLink({ review: "source-review-20261018-a" })).toBe("source-review-20261018-a");
    expect(importReviewIdFromLink({ review: "proposal-1" })).toBeNull();
    expect(importReviewIdFromLink({ review: "import-review-../x" })).toBeNull();
    expect(importReviewIdFromLink({})).toBeNull();
  });

  it("describes a review for the shared review list", () => {
    expect(importReviewIndexDetails({
      reviewId: "import-review-a", status: "partially-applied", health: "ok",
      createdAt: "2026-10-20T09:00:00Z", updatedAt: "2026-10-21T09:00:00Z", candidateCount: 3, appliedCount: 1, format: "v2" as const
    }, createI18n("en"))).toEqual({ sortKey: "2026-10-21T09:00:00Z", lines: ["Partially applied", "3 candidates, 1 applied"] });
    expect(importReviewIndexDetails({
      reviewId: "source-review-a", status: "pending", health: "ok",
      createdAt: "2026-10-20T09:00:00Z", updatedAt: "2026-10-21T09:00:00Z", candidateCount: 3, appliedCount: 0, format: "legacy"
    }, createI18n("ja")).lines).toEqual(["未決あり", "候補3件、反映済み0件", "旧形式のレビューです"]);
  });

  it("summarizes formal apply results, provenance problems and archiving", () => {
    const i18n = createI18n("en");

    expect(formalApplyMessage(result({ applied: ["IC-01", "IC-03"], archived: true }), i18n))
      .toBe("Applied 2, failed 0, stale 0. The review is complete and moved to history.");
    expect(formalApplyMessage(result({
      applied: ["IC-01"],
      failed: [{ candidateId: "IC-02", error: "x" }],
      stale: [{ candidateId: "IC-03", reason: "y" }],
      provenance: { written: [], changed: ["a.md"], failed: [{ path: "b.md", error: "z" }] }
    }), i18n)).toBe("Applied 1, failed 1, stale 1. 1 notes changed after review, so their import record was not written. Could not record the import on 1 notes; it will be retried on the next apply.");
  });
});
