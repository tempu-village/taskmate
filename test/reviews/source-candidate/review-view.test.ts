import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({
  ItemView: class {},
  Notice: class {}
}));

import { createI18n } from "../../../src/i18n";
import { formalApplyMessage, sourceReviewIdFromLink, sourceReviewIndexDetails } from "../../../src/reviews/source-candidate/review-view";
import type { FormalApplyResult } from "../../../src/reviews/source-candidate/review-repository";
import { parseSourceCandidateProposal } from "../../../src/reviews/source-candidate/proposal";
import { exampleText } from "./fixture";

function result(overrides: Partial<FormalApplyResult>): FormalApplyResult {
  return {
    review: parseSourceCandidateProposal(exampleText()),
    applied: [], failed: [], stale: [],
    provenance: { written: [], changed: [], failed: [] },
    archived: false,
    ...overrides
  };
}

describe("Source candidate review view", () => {
  it("accepts only valid Source candidate review links", () => {
    expect(sourceReviewIdFromLink({ review: "source-review-20261018-a" })).toBe("source-review-20261018-a");
    expect(sourceReviewIdFromLink({ review: "proposal-1" })).toBeNull();
    expect(sourceReviewIdFromLink({ review: "source-review-../x" })).toBeNull();
    expect(sourceReviewIdFromLink({})).toBeNull();
  });

  it("describes a review for the shared review list", () => {
    expect(sourceReviewIndexDetails({
      reviewId: "source-review-a", status: "partially-applied", health: "ok",
      createdAt: "2026-10-20T09:00:00Z", updatedAt: "2026-10-21T09:00:00Z", candidateCount: 3, appliedCount: 1
    }, createI18n("en"))).toEqual({ sortKey: "2026-10-21T09:00:00Z", lines: ["Partially applied", "3 candidates, 1 applied"] });
  });

  it("summarizes formal apply results, provenance problems and archiving", () => {
    const i18n = createI18n("en");

    expect(formalApplyMessage(result({ applied: ["SC-01", "SC-03"], archived: true }), i18n))
      .toBe("Applied 2, failed 0, stale 0. The review is complete and moved to history.");
    expect(formalApplyMessage(result({
      applied: ["SC-01"],
      failed: [{ candidateId: "SC-02", error: "x" }],
      stale: [{ candidateId: "SC-03", reason: "y" }],
      provenance: { written: [], changed: ["a.md"], failed: [{ path: "b.md", error: "z" }] }
    }), i18n)).toBe("Applied 1, failed 1, stale 1. 1 notes changed after review, so their import record was not written. Could not record the import on 1 notes; it will be retried on the next apply.");
  });
});
