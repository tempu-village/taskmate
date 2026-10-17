import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { projectPath, relativeDependencies, sourceFiles, sourceRoot } from "../import-graph";

describe("review Module boundaries", () => {
  it("prevents shared review code from depending on a feature review", () => {
    const violations = sourceFiles()
      .filter((file) => reviewModule(file) === "shared")
      .flatMap((file) => relativeDependencies(file)
        .filter((dependency) => {
          const module = reviewModule(dependency);
          return module !== null && module !== "shared";
        })
        .map((dependency) => `${projectPath(file)} -> ${projectPath(dependency)}`));

    expect(violations).toEqual([]);
  });

  it("prevents review kinds from depending on one another", () => {
    const violations = sourceFiles()
      .flatMap((file) => {
        const module = reviewModule(file);
        if (module === null || module === "shared") return [];
        return relativeDependencies(file)
          .filter((dependency) => {
            const target = reviewModule(dependency);
            return target !== null && target !== "shared" && target !== module;
          })
          .map((dependency) => `${projectPath(file)} -> ${projectPath(dependency)}`);
      });

    expect(violations).toEqual([]);
  });

  it("keeps the Task change Proposal Domain independent of review Adapters", () => {
    const proposal = resolve(sourceRoot, "reviews/task-change/proposal.ts");
    const source = readFileSync(proposal, "utf8");
    expect(source).not.toMatch(/from\s+["']obsidian["']/);
    expect(relativeDependencies(proposal).map(projectPath)).not.toEqual(expect.arrayContaining([
      "src/reviews/task-change/proposal-repository.ts",
      "src/reviews/task-change/review-renderer.ts",
      "src/reviews/task-change/review-scroll.ts",
      "src/reviews/task-change/review-view.ts"
    ]));
  });
});

function reviewModule(file: string): string | null {
  const parts = projectPath(file).split("/");
  return parts[1] === "reviews" && parts.length > 3 ? parts[2] : null;
}
