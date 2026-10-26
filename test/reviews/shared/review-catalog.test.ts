import { describe, expect, it } from "vitest";
import { classifyReviewFile, ReviewCatalog } from "../../../src/reviews/shared/review-catalog";
import { MemoryVault } from "../import/memory-vault";

const taskChange = (id: string, extra: Record<string, unknown> = {}) => JSON.stringify({ schemaVersion: 1, id, status: "pending", createdAt: "2026-10-20T09:00:00Z", tasks: [], ...extra });
const importReview = (reviewId: string, extra: Record<string, unknown> = {}) => JSON.stringify({ schemaVersion: 1, reviewId, reviewType: "import", status: "pending", ...extra });

describe("Review Catalog classification", () => {
  it("routes each review kind by its discriminator and file name", () => {
    expect(classifyReviewFile("P/proposal-a.json", "pending", taskChange("proposal-a"))).toEqual({
      type: "review", ref: { kind: "task-change", id: "proposal-a", location: "pending", path: "P/proposal-a.json" }
    });
    expect(classifyReviewFile("P/History/import-review-b.json", "history", importReview("import-review-b"))).toEqual({
      type: "review", ref: { kind: "import", id: "import-review-b", location: "history", path: "P/History/import-review-b.json" }
    });
    expect(classifyReviewFile("P/import-review-v2.json", "pending", importReview("import-review-v2", { schemaVersion: 2 }))).toMatchObject({ type: "review", ref: { kind: "import" } });
    // The unreleased Source candidate review is read as an Import review under its own name.
    expect(classifyReviewFile("P/source-review-old.json", "pending", importReview("source-review-old", { reviewType: "source-candidate" }))).toEqual({
      type: "review", ref: { kind: "import", id: "source-review-old", location: "pending", path: "P/source-review-old.json" }
    });
  });

  it("reports unreadable, unknown, unsupported and mismatched files instead of routing them", () => {
    const reason = (path: string, content: string) => {
      const entry = classifyReviewFile(path, "pending", content);
      return entry.type === "invalid" ? entry.reason : entry.type;
    };

    expect([reason("P/proposal-a.json", "{"), reason("P/proposal-a.json", "[]"), reason("P/proposal-a.json", "null")]).toEqual(["unreadable-json", "unreadable-json", "unreadable-json"]);
    expect(reason("P/proposal-a.json", taskChange("proposal-a", { schemaVersion: 2 }))).toBe("unsupported-version");
    expect(reason("P/import-review-b.json", importReview("import-review-b", { schemaVersion: 3 }))).toBe("unsupported-version");
    expect(reason("P/source-review-c.json", importReview("source-review-c", { reviewType: "source-candidate", schemaVersion: 2 }))).toBe("unsupported-version");
    expect(reason("P/source-review-c.json", importReview("source-review-c"))).toBe("mismatched-id");
    expect(reason("P/import-review-c.json", importReview("import-review-c", { reviewType: "source-candidate" }))).toBe("mismatched-id");
    expect(reason("P/proposal-a.json", taskChange("proposal-other"))).toBe("mismatched-id");
    expect(reason("P/import-review-b.json", importReview("import-review-other"))).toBe("mismatched-id");
    // The discriminator and the import-review-* name must agree in both directions.
    expect(reason("P/proposal-a.json", importReview("proposal-a"))).toBe("mismatched-id");
    expect(reason("P/import-review-b.json", JSON.stringify({ schemaVersion: 1, reviewId: "import-review-b" }))).toBe("mismatched-id");
    expect(reason("P/proposal-a.json", taskChange("proposal-a", { reviewType: "task-change" }))).toBe("unknown-type");
    expect(reason("P/notes.json", JSON.stringify({ schemaVersion: 1 }))).toBe("unknown-type");
  });
});

describe("Review Catalog listing", () => {
  function vault(): MemoryVault {
    const memory = new MemoryVault();
    memory.put("TaskMate/Proposals/proposal-a.json", taskChange("proposal-a"));
    memory.put("TaskMate/Proposals/import-review-b.json", importReview("import-review-b"));
    memory.put("TaskMate/Proposals/proposal-broken.json", "{");
    memory.put("TaskMate/Proposals/notes.md", "# Proposal folder note\n");
    memory.put("TaskMate/Proposals/Drafts/import-review-c.json", importReview("import-review-c"));
    memory.put("TaskMate/Proposals/History/proposal-old.json", taskChange("proposal-old", { status: "applied" }));
    memory.put("TaskMate/Proposals/History/import-review-done.json", importReview("import-review-done", { status: "history" }));
    memory.put("Notes/proposal-z.json", taskChange("proposal-z"));
    return memory;
  }

  it("lists mixed pending and history reviews directly inside the Proposal folders without changing any file", async () => {
    const memory = vault();
    const before = new Map([...memory.files].map(([path, entry]) => [path, entry.content]));
    const catalog = new ReviewCatalog(memory.app(), () => "TaskMate/Proposals");

    const pending = await catalog.list("pending");
    const history = await catalog.list("history");

    expect(pending.map((entry) => entry.type === "review" ? `${entry.ref.kind}:${entry.ref.id}` : `invalid:${entry.path}`).sort()).toEqual([
      "import:import-review-b", "invalid:TaskMate/Proposals/proposal-broken.json", "task-change:proposal-a"
    ]);
    expect(history.map((entry) => entry.type === "review" ? `${entry.ref.kind}:${entry.ref.id}:${entry.ref.location}` : entry.path).sort()).toEqual([
      "import:import-review-done:history", "task-change:proposal-old:history"
    ]);
    expect(new Map([...memory.files].map(([path, entry]) => [path, entry.content]))).toEqual(before);
  });

  it("follows the configured Proposal folder and falls back to the default", async () => {
    const memory = new MemoryVault();
    memory.put("Reviews/proposal-a.json", taskChange("proposal-a"));
    memory.put("TaskMate/Proposals/import-review-b.json", importReview("import-review-b"));

    expect((await new ReviewCatalog(memory.app(), () => "Reviews").list("pending")).map((entry) => entry.type === "review" && entry.ref.id)).toEqual(["proposal-a"]);
    expect((await new ReviewCatalog(memory.app(), () => "  ").list("pending")).map((entry) => entry.type === "review" && entry.ref.id)).toEqual(["import-review-b"]);
  });
});
