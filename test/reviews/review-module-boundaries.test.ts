import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const sourceRoot = resolve(root, "src");

describe("review Module boundaries", () => {
  it("keeps the runtime TypeScript import graph acyclic", () => {
    const graph = new Map(sourceFiles().map((file) => [file, runtimeDependencies(file)]));
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (file: string, path: string[]): void => {
      if (visiting.has(file)) {
        const cycleStart = path.indexOf(file);
        throw new Error(`Runtime import cycle: ${[...path.slice(cycleStart), file].map(projectPath).join(" -> ")}`);
      }
      if (visited.has(file)) return;
      visiting.add(file);
      for (const dependency of graph.get(file) ?? []) visit(dependency, [...path, file]);
      visiting.delete(file);
      visited.add(file);
    };

    for (const file of graph.keys()) visit(file, []);
  });

  it("prevents shared review code from depending on a feature review", () => {
    const violations = sourceFiles()
      .filter((file) => projectPath(file).startsWith("src/reviews/shared/"))
      .flatMap((file) => relativeDependencies(file)
        .filter((dependency) => {
          const path = projectPath(dependency);
          return path.startsWith("src/reviews/") && !path.startsWith("src/reviews/shared/");
        })
        .map((dependency) => `${projectPath(file)} -> ${projectPath(dependency)}`));

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

function sourceFiles(directory = sourceRoot): string[] {
  return readdirSync(directory)
    .flatMap((entry) => {
      const path = resolve(directory, entry);
      return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith(".ts") ? [path] : [];
    });
}

function runtimeDependencies(file: string): string[] {
  return importSpecifiers(file)
    .filter(({ typeOnly }) => !typeOnly)
    .map(({ specifier }) => resolveRelativeImport(file, specifier))
    .filter((dependency): dependency is string => dependency !== null);
}

function relativeDependencies(file: string): string[] {
  return importSpecifiers(file)
    .map(({ specifier }) => resolveRelativeImport(file, specifier))
    .filter((dependency): dependency is string => dependency !== null);
}

function importSpecifiers(file: string): Array<{ specifier: string; typeOnly: boolean }> {
  const source = readFileSync(file, "utf8");
  const imports: Array<{ specifier: string; typeOnly: boolean }> = [];
  const pattern = /\bimport\s+(type\s+)?(?:[\s\S]*?\sfrom\s+)?["']([^"']+)["']/g;
  for (const match of source.matchAll(pattern)) {
    imports.push({ typeOnly: Boolean(match[1]), specifier: match[2] });
  }
  return imports;
}

function resolveRelativeImport(file: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  const candidate = resolve(dirname(file), specifier);
  for (const path of [candidate, `${candidate}.ts`, resolve(candidate, "index.ts")]) {
    if (existsSync(path) && statSync(path).isFile()) return path;
  }
  throw new Error(`Cannot resolve ${specifier} from ${projectPath(file)}`);
}

function projectPath(file: string): string {
  return relative(root, file).replaceAll("\\", "/");
}
